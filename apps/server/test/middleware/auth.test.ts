import { describe, it, expect, vi } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createRequireApiKey } from "../../src/middleware/auth.js";
import type { Config } from "../../src/config/index.js";

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
  it("passes through without checking headers when no API_KEY is configured", async () => {
    const requireApiKey = createRequireApiKey({ config: { API_KEY: "" } as Config });
    const reply = buildReply();
    const req = buildRequest();

    await requireApiKey(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it("passes through when the x-api-key header matches", async () => {
    const requireApiKey = createRequireApiKey({ config: { API_KEY: "secret-key" } as Config });
    const reply = buildReply();
    const req = buildRequest({ "x-api-key": "secret-key" });

    await requireApiKey(req, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the x-api-key header is missing", async () => {
    const requireApiKey = createRequireApiKey({ config: { API_KEY: "secret-key" } as Config });
    const reply = buildReply();
    const req = buildRequest();

    await requireApiKey(req, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("rejects with 401 when the x-api-key header is wrong", async () => {
    const requireApiKey = createRequireApiKey({ config: { API_KEY: "secret-key" } as Config });
    const reply = buildReply();
    const req = buildRequest({ "x-api-key": "wrong-key" });

    await requireApiKey(req, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("always returns a Promise so Fastify can detect hook completion", () => {
    const requireApiKey = createRequireApiKey({ config: { API_KEY: "" } as Config });
    const reply = buildReply();
    const req = buildRequest();

    const result = requireApiKey(req, reply);

    expect(result).toBeInstanceOf(Promise);
  });
});
