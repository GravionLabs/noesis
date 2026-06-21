import { config } from "../config/index.js";
import pg from "pg";

const CREATE_EXTENSION = `CREATE EXTENSION IF NOT EXISTS vector`;

const CREATE_SOURCES = `
CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  importer_type text NOT NULL DEFAULT 'llmstxt',
  enabled boolean NOT NULL DEFAULT true,
  config text,
  schedule text,
  last_imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_sources_url ON sources (url);
`;

const CREATE_DOCS = `
CREATE TABLE IF NOT EXISTS docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  content_md text,
  content_hash text,
  indexed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_docs_source_id_url ON docs (source_id, url);
`;

const CREATE_CHUNKS = `
CREATE TABLE IF NOT EXISTS chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  source_id uuid NOT NULL,
  content text NOT NULL,
  heading text,
  heading_path text[],
  chunk_index integer NOT NULL,
  token_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_chunks_doc_id ON chunks (doc_id);
CREATE INDEX IF NOT EXISTS ix_chunks_source_id ON chunks (source_id);
`;

const CREATE_EMBEDDINGS = `
CREATE TABLE IF NOT EXISTS embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id uuid NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  model text NOT NULL,
  dimensions integer NOT NULL,
  vector vector,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_embeddings_chunk_id_model ON embeddings (chunk_id, model);
`;

const CREATE_JOBS = `
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'import',
  source_id uuid REFERENCES sources(id),
  status text NOT NULL DEFAULT 'pending',
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_jobs_source_id ON jobs (source_id);
CREATE INDEX IF NOT EXISTS ix_jobs_status ON jobs (status);
`;

const ADD_JOB_RETRY_COLUMNS = `
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS duration_ms integer;
`;

const DROP_IMPORT_JOB_STATES = `DROP TABLE IF EXISTS import_job_states CASCADE`;

export async function runMigrations(pool: pg.Pool): Promise<void> {
  console.log("Running migrations...");

  await pool.query(DROP_IMPORT_JOB_STATES);
  console.log("  ✓ import_job_states (dropped legacy table)");

  await pool.query(CREATE_EXTENSION);
  console.log("  ✓ vector extension");

  await pool.query(CREATE_SOURCES);
  console.log("  ✓ sources");

  await pool.query(CREATE_DOCS);
  console.log("  ✓ docs");

  await pool.query(CREATE_CHUNKS);
  console.log("  ✓ chunks");

  await pool.query(CREATE_EMBEDDINGS);
  console.log("  ✓ embeddings");

  await pool.query(CREATE_JOBS);
  console.log("  ✓ jobs");

  await pool.query(ADD_JOB_RETRY_COLUMNS);
  console.log("  ✓ jobs (retry columns added)");

  console.log("\nAll migrations complete.");
}

async function migrate() {
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  migrate().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
