import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { embeddings } from "../db/schema.js";

export type Embedding = InferSelectModel<typeof embeddings>;
export type NewEmbedding = InferInsertModel<typeof embeddings>;
