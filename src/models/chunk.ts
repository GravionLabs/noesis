import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { chunks } from "../db/schema.js";

export type Chunk = InferSelectModel<typeof chunks>;
export type NewChunk = InferInsertModel<typeof chunks>;
