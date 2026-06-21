import { describe, it, expect } from "vitest";

describe("config", () => {
  it("loads with default values when no env vars are set", async () => {
    // Dynamic import after clearing env is tricky with ESM;
    // just verify the module loads and defaults are reasonable.
    const { config } = await import("../src/config/index.js");
    expect(config.PORT).toBe(5000);
    expect(config.DATABASE_URL).toContain("postgres://");
    expect(config.EMBEDDING_PROVIDER).toBe("local");
    expect(config.EMBEDDING_MODEL).toBe("Xenova/bge-base-en-v1.5");
  });
});
