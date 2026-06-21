import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";

const mockConfig: { API_KEY: string } = { API_KEY: "" };

vi.mock("../../src/config.js", () => ({
  get config() {
    return mockConfig;
  },
}));

import { requireApiKey } from "../../src/middleware/auth.js";

function buildReply() {
  const reply = {
    code: vi.fn(),
    send: vi.fn(),
  } as unknown as FastifyReply;
  (reply.code as any).mockReturnValue(reply);
  return reply;
}

function buildRequest(headers: Record<string, string> = {}) {
  return { headers } as unknown as FastifyRequest;
}

describe("requireApiKey", () => {
  beforeEach(() => {
    mockConfig.API_KEY = "";
  });

  it("passes through without checking headers when no API_KEY is configured", async () => {
    mockConfig.API_KEY = "";
    const reply = buildReply();
    const req = buildRequest();

    await requireApiKey(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it("passes through when the x-api-key header matches", async () => {
    mockConfig.API_KEY = "secret-key";
    const reply = buildReply();
    const req = buildRequest({ "x-api-key": "secret-key" });

    await requireApiKey(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the x-api-key header is missing", async () => {
    mockConfig.API_KEY = "secret-key";
    const reply = buildReply();
    const req = buildRequest();

    await requireApiKey(req, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("rejects with 401 when the x-api-key header is wrong", async () => {
    mockConfig.API_KEY = "secret-key";
    const reply = buildReply();
    const req = buildRequest({ "x-api-key": "wrong-key" });

    await requireApiKey(req, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("always returns a Promise so Fastify can detect hook completion", () => {
    mockConfig.API_KEY = "";
    const reply = buildReply();
    const req = buildRequest();

    const result = requireApiKey(req, reply);

    expect(result).toBeInstanceOf(Promise);
  });
});
