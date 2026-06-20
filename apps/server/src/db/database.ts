import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import type { Config } from "../config/index.js";

export class Database {
  readonly pool: pg.Pool;
  readonly db: ReturnType<typeof drizzle>;

  constructor({ config }: { config: Config }) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
    });

    this.pool.on("error", (err) => {
      console.error("Unexpected Postgres pool error:", err);
    });

    this.db = drizzle(this.pool, { schema });
  }

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<pg.QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async getClient(): Promise<pg.PoolClient> {
    return this.pool.connect();
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}
