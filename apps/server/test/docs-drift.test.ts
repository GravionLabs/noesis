import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");

// "CRAWLER_URL" is intentionally mentioned in AGENTS.md to document its absence.
const FORBIDDEN = [
  ":3001",
  "rabbitmq",
  "ef-migrate",
  "embedder service",
  "/jobs/crawl",
] as const;

const DOCS = ["AGENTS.md", "infra/README.md"] as const;

describe("docs drift guard", () => {
  for (const doc of DOCS) {
    describe(doc, () => {
      const content = readFileSync(resolve(repoRoot, doc), "utf-8").toLowerCase();

      for (const term of FORBIDDEN) {
        it(`must not contain "${term}"`, () => {
          expect(content).not.toContain(term.toLowerCase());
        });
      }
    });
  }
});
