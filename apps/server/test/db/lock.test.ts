import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostgresLock } from "../../src/db/lock.js";

const mockDbExecute = vi.fn();

function createLock() {
  return new PostgresLock({
    database: { db: { execute: mockDbExecute } } as any,
  });
}

describe("PostgresLock", () => {
  let lock: PostgresLock;

  beforeEach(() => {
    vi.clearAllMocks();
    lock = createLock();
  });

  it("starts unlocked", () => {
    expect(lock.isHeld).toBe(false);
  });

  it("acquires lock when pg_try_advisory_lock returns true", async () => {
    mockDbExecute.mockResolvedValue({ rows: [{ locked: true }] });

    const result = await lock.tryAcquire();

    expect(result).toBe(true);
    expect(lock.isHeld).toBe(true);
    expect(mockDbExecute).toHaveBeenCalledWith(
      expect.objectContaining({}),
    );
  });

  it("does not acquire lock when pg_try_advisory_lock returns false", async () => {
    mockDbExecute.mockResolvedValue({ rows: [{ locked: false }] });

    const result = await lock.tryAcquire();

    expect(result).toBe(false);
    expect(lock.isHeld).toBe(false);
  });

  it("returns true immediately when lock is already held", async () => {
    mockDbExecute.mockResolvedValue({ rows: [{ locked: true }] });
    await lock.tryAcquire();
    expect(lock.isHeld).toBe(true);

    mockDbExecute.mockClear();
    const result = await lock.tryAcquire();

    expect(result).toBe(true);
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  it("releases the lock", async () => {
    mockDbExecute.mockResolvedValue({ rows: [{ locked: true }] });
    await lock.tryAcquire();
    expect(lock.isHeld).toBe(true);

    mockDbExecute.mockResolvedValue({ rows: [] });
    await lock.release();

    expect(lock.isHeld).toBe(false);
  });

  it("release is a no-op when not held", async () => {
    await lock.release();
    expect(mockDbExecute).not.toHaveBeenCalled();
  });
});
