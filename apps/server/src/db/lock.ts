import { sql } from "drizzle-orm";
import type { Database } from "./database.js";

const SCHEDULER_LOCK_ID = 0x4e4f4553;

export class PostgresLock {
  private database: Database;
  private held = false;

  constructor({ database }: { database: Database }) {
    this.database = database;
  }

  get isHeld(): boolean {
    return this.held;
  }

  async tryAcquire(lockId: number = SCHEDULER_LOCK_ID): Promise<boolean> {
    if (this.held) return true;

    const result = await this.database.db.execute<{ locked: boolean }>(
      sql`SELECT pg_try_advisory_lock(${lockId}) AS locked`,
    );

    this.held = result.rows[0]?.locked === true;
    return this.held;
  }

  async release(lockId: number = SCHEDULER_LOCK_ID): Promise<void> {
    if (!this.held) return;

    await this.database.db.execute(sql`SELECT pg_advisory_unlock(${lockId})`);
    this.held = false;
  }
}
