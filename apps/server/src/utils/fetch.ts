const DEFAULT_TIMEOUT_MS = 30_000;

export interface FetchOptions {
  timeoutMs?: number;
}

export async function fetchOrThrow(
  url: string,
  options?: FetchOptions,
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Noesis/1.0",
      },
    });

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    return res;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Failed to fetch")) {
      throw err;
    }
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch ${url}: ${cause}`);
  } finally {
    clearTimeout(timeout);
  }
}
