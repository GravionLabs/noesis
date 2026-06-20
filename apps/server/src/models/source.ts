import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { sources } from "../db/schema.js";

export type Source = InferSelectModel<typeof sources>;
export type NewSource = InferInsertModel<typeof sources>;
