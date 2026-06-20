import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { jobs } from "../db/schema.js";

export type Job = InferSelectModel<typeof jobs>;
export type NewJob = InferInsertModel<typeof jobs>;
