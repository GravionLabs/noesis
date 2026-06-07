import amqp, { type ChannelModel } from "amqplib";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { getSource, updateLastImported } from "./source-service.js";
import { createJob, updateJobStatus } from "./job-service.js";

let model: ChannelModel | null = null;

async function getModel(): Promise<ChannelModel> {
  if (!model) {
    model = await amqp.connect(config.RABBITMQ_URL);
    model.on("error", (err) => {
      console.error("RabbitMQ connection error:", err);
      model = null;
    });
    model.on("close", () => {
      model = null;
    });
  }
  return model;
}

export async function publishStartCrawlJob(
  jobId: string,
  sourceId: string,
  url: string,
  type: string,
  crawlConfig?: Record<string, unknown>,
) {
  const conn = await getModel();
  const ch = await conn.createChannel();
  try {
    await ch.assertExchange("noesis.start-crawl-job", "fanout", { durable: true });
    ch.publish(
      "noesis.start-crawl-job",
      "",
      Buffer.from(
        JSON.stringify({
          jobId,
          sourceId,
          url,
          type,
          config: crawlConfig ?? {},
        }),
      ),
      { contentType: "application/json", persistent: true },
    );
  } finally {
    await ch.close();
  }
}

export async function publishStartEmbedJob(jobId: string, sourceId: string) {
  const conn = await getModel();
  const ch = await conn.createChannel();
  try {
    await ch.assertQueue("noesis.start-embed-job", { durable: true });
    ch.sendToQueue(
      "noesis.start-embed-job",
      Buffer.from(
        JSON.stringify({ job_id: jobId, source_id: sourceId }),
      ),
      { contentType: "application/json", persistent: true },
    );
  } finally {
    await ch.close();
  }
}

export async function triggerImport(sourceId: string) {
  const source = await getSource(sourceId);
  if (!source) throw new Error(`Source ${sourceId} not found`);

  const job = await createJob({ type: "import", sourceId, status: "pending" });
  const jobId = job.id;

  await updateJobStatus(jobId, "running");

  const importerType = source.importerType;

  switch (importerType) {
    case "llmstxt":
      await handleLlmsTxt(source.url, sourceId, jobId);
      break;

    case "llmstxt-meta":
      await publishStartCrawlJob(jobId, sourceId, source.url, "ingest-llmstxt");
      break;

    case "llmstxt-crawl":
      await publishStartCrawlJob(jobId, sourceId, source.url, "crawl-llmstxt", {
        includeOptional: parseOptionalConfig(source.config),
      });
      break;

    default:
      await publishStartCrawlJob(jobId, sourceId, source.url, importerType);
      break;
  }

  return job;
}

async function handleLlmsTxt(url: string, sourceId: string, jobId: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const text = await res.text();
  const chunks = chunkByH2(text, url, sourceId);

  if (chunks.length === 0) {
    await updateJobStatus(jobId, "done");
    await updateLastImported(sourceId);
    return;
  }

  const title =
    text.match(/^#\s+(.+)/m)?.[1]?.trim() ?? new URL(url).hostname;

  const docResult = await query<{ id: string }>(
    `INSERT INTO docs (source_id, url, title, content_md, content_hash)
     VALUES ($1, $2, $3, $4, md5($4))
     ON CONFLICT (source_id, url)
     DO UPDATE SET title = EXCLUDED.title, content_md = EXCLUDED.content_md,
                   content_hash = EXCLUDED.content_hash, indexed_at = now()
     RETURNING id`,
    [sourceId, url, title, text],
  );
  const docId = docResult.rows[0].id;

  for (const chunk of chunks) {
    await query(
      `INSERT INTO chunks (doc_id, source_id, content, heading, heading_path, chunk_index)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [docId, sourceId, chunk.content, chunk.heading, chunk.headingPath, chunk.chunkIndex],
    );
  }

  await publishStartEmbedJob(jobId, sourceId);
}

export async function handleCrawlCompleted(msg: {
  jobId: string;
  sourceId: string;
  docCount: number;
  chunkCount: number;
}) {
  await publishStartEmbedJob(msg.jobId, msg.sourceId);
}

export async function handleEmbedCompleted(msg: {
  jobId: string;
  sourceId: string;
}) {
  await updateJobStatus(msg.jobId, "done");
  await updateLastImported(msg.sourceId);
}

export async function startRabbitConsumers() {
  const conn = await getModel();
  const ch = await conn.createChannel();
  ch.prefetch(1);

  await ch.assertQueue("noesis.crawl-completed", { durable: true });
  await ch.assertQueue("noesis.embed-completed", { durable: true });

  ch.consume("noesis.crawl-completed", async (msg) => {
    if (!msg) return;
    try {
      const body = JSON.parse(msg.content.toString()) as {
        jobId: string;
        sourceId: string;
        docCount: number;
        chunkCount: number;
      };
      await handleCrawlCompleted(body);
      ch.ack(msg);
    } catch (err) {
      console.error("Error handling crawl-completed:", err);
      ch.nack(msg, false, false);
    }
  });

  ch.consume("noesis.embed-completed", async (msg) => {
    if (!msg) return;
    try {
      const body = JSON.parse(msg.content.toString()) as {
        jobId: string;
        sourceId: string;
      };
      await handleEmbedCompleted(body);
      ch.ack(msg);
    } catch (err) {
      console.error("Error handling embed-completed:", err);
      ch.nack(msg, false, false);
    }
  });

  console.log("RabbitMQ consumers ready (crawl-completed, embed-completed)");
}

function parseOptionalConfig(configStr: string | null): boolean {
  if (!configStr) return false;
  try {
    const parsed = JSON.parse(configStr) as { includeOptional?: boolean };
    return parsed.includeOptional ?? false;
  } catch {
    return false;
  }
}

function chunkByH2(
  text: string,
  url: string,
  sourceId: string,
): Array<{
  content: string;
  heading: string | undefined;
  headingPath: string[];
  chunkIndex: number;
}> {
  const MAX_CHARS = 2000;
  const chunks: Array<{
    content: string;
    heading: string | undefined;
    headingPath: string[];
    chunkIndex: number;
  }> = [];
  const headingPath: string[] = [];
  let currentHeading: string | undefined;
  let buffer = "";
  let chunkIndex = 0;

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 50) {
      chunks.push({
        content: trimmed,
        heading: currentHeading,
        headingPath: [...headingPath],
        chunkIndex: chunkIndex++,
      });
    }
    buffer = "";
  };

  for (const line of text.split("\n")) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      flush();
      const level = headingMatch[1].length;
      currentHeading = headingMatch[2];
      headingPath.splice(level - 1);
      headingPath[level - 1] = currentHeading;
    } else {
      buffer += line + "\n";
      if (buffer.length >= MAX_CHARS) flush();
    }
  }
  flush();

  return chunks;
}
