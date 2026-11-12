import "server-only";

export const USER_AGENT = "Mozilla/5.0 (compatible; InternshipPortal/1.0; personal use)";

export class FetchError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

/** Høflig henting: tidsavbrudd, egen User-Agent og ett nytt forsøk ved 429/5xx. */
export async function fetchText(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<string> {
  const { timeoutMs = 20_000, ...rest } = init;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      ...rest,
      headers: { "User-Agent": USER_AGENT, ...(rest.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (res.ok) return res.text();
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await sleep(1500);
      continue;
    }
    throw new FetchError(`HTTP ${res.status} fra ${new URL(url).host}`, res.status);
  }
  throw new FetchError(`Fikk ikke svar fra ${new URL(url).host}`);
}

export async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const text = await fetchText(url, { ...init, headers: { Accept: "application/json", ...(init.headers ?? {}) } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new FetchError(`Uventet svar (ikke JSON) fra ${new URL(url).host}`);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
