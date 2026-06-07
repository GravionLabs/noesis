import { config } from "../config.js";

type EmbedFn = (texts: string[]) => Promise<number[][]>;

let cachedEmbed: EmbedFn | null = null;

async function getHuggingFaceEmbed(): Promise<EmbedFn> {
  const { pipeline } = await import("@xenova/transformers");
  const embedder = await pipeline("feature-extraction", config.EMBEDDING_MODEL);

  return async (texts: string[]): Promise<number[][]> => {
    const results: number[][] = [];
    for (const text of texts) {
      const output = await embedder(text, { pooling: "mean", normalize: true });
      const data = output.data ? Array.from(output.data as Float32Array) : [];
      results.push(data);
    }
    return results;
  };
}

async function getOpenAIEmbed(): Promise<EmbedFn> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });

  return async (texts: string[]): Promise<number[][]> => {
    const response = await client.embeddings.create({
      model: config.EMBEDDING_MODEL,
      input: texts,
    });
    return response.data.map((d: { embedding: number[] }) => d.embedding);
  };
}

async function getOllamaEmbed(): Promise<EmbedFn> {
  return async (texts: string[]): Promise<number[][]> => {
    const results: number[][] = [];
    for (const text of texts) {
      const res = await fetch(`${config.OLLAMA_URL}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: config.EMBEDDING_MODEL, prompt: text }),
      });
      const data = (await res.json()) as { embedding?: number[] };
      results.push(data.embedding ?? []);
    }
    return results;
  };
}

export async function getEmbedFn(): Promise<EmbedFn> {
  if (cachedEmbed) return cachedEmbed;

  switch (config.EMBEDDING_PROVIDER) {
    case "openai":
      cachedEmbed = await getOpenAIEmbed();
      break;
    case "ollama":
      cachedEmbed = await getOllamaEmbed();
      break;
    default:
      cachedEmbed = await getHuggingFaceEmbed();
      break;
  }

  return cachedEmbed;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const fn = await getEmbedFn();
  return fn(texts);
}

export async function embedText(text: string): Promise<number[]> {
  const results = await embedTexts([text]);
  return results[0] ?? [];
}
