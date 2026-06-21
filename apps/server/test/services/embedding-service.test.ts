import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockProcessPendingChunks } = vi.hoisted(() => ({
  mockProcessPendingChunks: vi.fn(),
}));

vi.mock("../../src/embedding/batch-processor.js", () => ({
  processPendingChunks: mockProcessPendingChunks,
  countPendingChunks: vi.fn(),
}));

import { EmbeddingService } from "../../src/services/embedding-service.js";
import {
  LocalEmbeddingProvider,
  OllamaEmbeddingProvider,
  OpenAIEmbeddingProvider,
} from "../../src/embedding/index.js";
import type { Config } from "../../src/config/index.js";

const mockDatabase = {} as any;

function buildConfig(overrides: Partial<Config> = {}): Config {
  return {
    EMBEDDING_PROVIDER: "local",
    EMBEDDING_MODEL: "Xenova/bge-base-en-v1.5",
    OPENAI_API_KEY: "",
    OLLAMA_URL: "http://localhost:11434",
    ...overrides,
  } as Config;
}

describe("EmbeddingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("provider selection", () => {
    it("selects OllamaEmbeddingProvider for the ollama provider", () => {
      const service = new EmbeddingService({
        config: buildConfig({ EMBEDDING_PROVIDER: "ollama", OLLAMA_URL: "http://ollama:11434" }),
        database: mockDatabase,
      });

      expect(service.getProvider()).toBeInstanceOf(OllamaEmbeddingProvider);
    });

    it("selects OpenAIEmbeddingProvider for the openai provider", () => {
      const service = new EmbeddingService({
        config: buildConfig({ EMBEDDING_PROVIDER: "openai", OPENAI_API_KEY: "sk-test" }),
        database: mockDatabase,
      });

      expect(service.getProvider()).toBeInstanceOf(OpenAIEmbeddingProvider);
    });

    it("selects LocalEmbeddingProvider for the local provider", () => {
      const service = new EmbeddingService({
        config: buildConfig({ EMBEDDING_PROVIDER: "local" }),
        database: mockDatabase,
      });

      expect(service.getProvider()).toBeInstanceOf(LocalEmbeddingProvider);
    });
  });

  describe("embedTexts / embedText", () => {
    it("delegates embedTexts to the provider's embed method", async () => {
      const service = new EmbeddingService({
        config: buildConfig({ EMBEDDING_PROVIDER: "ollama" }),
        database: mockDatabase,
      });
      const embedSpy = vi
        .spyOn(service.getProvider(), "embed")
        .mockResolvedValue([[0.1, 0.2]]);

      const result = await service.embedTexts(["hello"]);

      expect(embedSpy).toHaveBeenCalledWith(["hello"]);
      expect(result).toEqual([[0.1, 0.2]]);
    });

    it("delegates embedText to embedTexts and unwraps the first vector", async () => {
      const service = new EmbeddingService({
        config: buildConfig({ EMBEDDING_PROVIDER: "ollama" }),
        database: mockDatabase,
      });
      vi.spyOn(service.getProvider(), "embed").mockResolvedValue([[0.3, 0.4]]);

      const result = await service.embedText("hello");

      expect(result).toEqual([0.3, 0.4]);
    });

    it("returns an empty array from embedText when no vector is produced", async () => {
      const service = new EmbeddingService({
        config: buildConfig({ EMBEDDING_PROVIDER: "ollama" }),
        database: mockDatabase,
      });
      vi.spyOn(service.getProvider(), "embed").mockResolvedValue([]);

      const result = await service.embedText("hello");

      expect(result).toEqual([]);
    });
  });

  describe("embedUnembeddedChunks", () => {
    it("delegates to processPendingChunks with the provider and sourceId", async () => {
      mockProcessPendingChunks.mockResolvedValue(7);
      const service = new EmbeddingService({
        config: buildConfig({ EMBEDDING_PROVIDER: "ollama" }),
        database: mockDatabase,
      });

      const result = await service.embedUnembeddedChunks("source-1");

      expect(result).toBe(7);
      expect(mockProcessPendingChunks).toHaveBeenCalledWith(
        mockDatabase,
        service.getProvider(),
        "source-1",
      );
    });

    it("works without a sourceId", async () => {
      mockProcessPendingChunks.mockResolvedValue(3);
      const service = new EmbeddingService({
        config: buildConfig({ EMBEDDING_PROVIDER: "ollama" }),
        database: mockDatabase,
      });

      const result = await service.embedUnembeddedChunks();

      expect(result).toBe(3);
      expect(mockProcessPendingChunks).toHaveBeenCalledWith(
        mockDatabase,
        service.getProvider(),
        undefined,
      );
    });
  });
});
