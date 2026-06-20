import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "../config.js";
import * as schema from "./schema.js";

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error:", err);
});

export const db = drizzle(pool, { schema });

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}
