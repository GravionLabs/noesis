import { db } from "../db/pool.js";
import { sources } from "../db/schema.js";
import { eq } from "drizzle-orm";

export interface CreateSourceInput {
  name: string;
  url: string;
  importerType?: string;
  config?: string;
  schedule?: string;
}

export async function listSources() {
  return db.select().from(sources).orderBy(sources.name);
}

export async function getSource(id: string) {
  const rows = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getSourceByUrl(url: string) {
  const rows = await db.select().from(sources).where(eq(sources.url, url)).limit(1);
  return rows[0] ?? null;
}

export async function createSource(input: CreateSourceInput) {
  const existing = await getSourceByUrl(input.url);
  if (existing) return null;

  const rows = await db
    .insert(sources)
    .values({
      name: input.name,
      url: input.url,
      importerType: input.importerType ?? "llmstxt",
      config: input.config ?? null,
      schedule: input.schedule ?? null,
    })
    .returning();
  return rows[0];
}

export async function deleteSource(id: string) {
  const rows = await db.delete(sources).where(eq(sources.id, id)).returning();
  return rows[0] ?? null;
}

export async function updateLastImported(sourceId: string) {
  await db
    .update(sources)
    .set({ lastImportedAt: new Date(), updatedAt: new Date() })
    .where(eq(sources.id, sourceId));
}
