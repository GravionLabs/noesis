import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { docs } from "../db/schema.js";

export type Doc = InferSelectModel<typeof docs>;
export type NewDoc = InferInsertModel<typeof docs>;
