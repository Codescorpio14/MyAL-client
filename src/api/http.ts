/** Thin fetch wrapper — replaces `MALClient.XShared/Comm/Query.cs`. */

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly url: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const DEFAULT_TIMEOUT = 20_000;

export async function fetchText(url: string, init: RequestInit = {}, timeout = DEFAULT_TIMEOUT): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new HttpError(response.status, `HTTP ${response.status} for ${url}`, url);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeout = DEFAULT_TIMEOUT): Promise<T> {
  const text = await fetchText(url, init, timeout);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(0, `Malformed JSON from ${url}`, url);
  }
}

export function formBody(data: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    params.append(key, String(value));
  }
  return params.toString();
}

export function encodeQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.append(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

/** Serialises requests: minimum `minGapMs` between calls (Query's 150ms sleep). */
export class RequestGate {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly minGapMs: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const started = Date.now();
      try {
        return await task();
      } finally {
        const elapsed = Date.now() - started;
        const wait = this.minGapMs - elapsed;
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
    });
    // Keep the chain alive even when a task rejects.
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

export async function withRetries<T>(
  task: () => Promise<T>,
  attempts: number,
  baseDelayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await task();
    } catch (err) {
      lastError = err;
      if (err instanceof HttpError && err.status === 429) {
        await new Promise((r) => setTimeout(r, (i + 1) * 2000));
        continue;
      }
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw lastError;
}
