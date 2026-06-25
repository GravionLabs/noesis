import {
  boolean,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const floatVec = customType<{ data: number[] }>({
  dataType() {
    return "vector";
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      return value
        .slice(1, -1)
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
    }
    if (Array.isArray(value)) return value as number[];
    return [];
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
});

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    importerType: text("importer_type").notNull().default("llmstxt"),
    enabled: boolean("enabled").notNull().default(true),
    config: text("config"),
    schedule: text("schedule"),
    lastImportedAt: timestamp("last_imported_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("ix_sources_url").on(table.url)],
);

export const docs = pgTable(
  "docs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    contentMd: text("content_md"),
    contentHash: text("content_hash"),
    indexedAt: timestamp("indexed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ix_docs_source_id_url").on(table.sourceId, table.url),
  ],
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    docId: uuid("doc_id")
      .notNull()
      .references(() => docs.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    heading: text("heading"),
    headingPath: text("heading_path").array(),
    chunkIndex: integer("chunk_index").notNull(),
    tokenCount: integer("token_count"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_chunks_doc_id").on(table.docId),
    index("ix_chunks_source_id").on(table.sourceId),
  ],
);

export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => chunks.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    dimensions: integer("dimensions").notNull(),
    vector: floatVec("vector"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ix_embeddings_chunk_id_model").on(table.chunkId, table.model),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull().default("import"),
    sourceId: uuid("source_id")
      .references(() => sources.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),
    durationMs: integer("duration_ms"),
    result: text("result"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_jobs_source_id").on(table.sourceId),
    index("ix_jobs_status").on(table.status),
  ],
);

