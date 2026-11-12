import "server-only";
import { fetchPublicHtml } from "@/lib/prefill";
import { boardMatchesCompany, slugCandidates, type ImportRow } from "./csv-import";
import { detectFromHtml, detectFromUrl } from "./detect";
import { fetchJson, fetchText } from "./http";
import type { SourceType } from "./types";

export type Resolution =
  | { kind: "auto"; type: SourceType; identifier: string }
  | { kind: "manual"; reason: "workday" | "unsupported" | "unreachable" | "none"; system?: string };

/** Sjekk om et selskap har en offentlig Greenhouse- eller Teamtailor-side med riktig navn. */
async function guessBoards(company: string): Promise<Resolution | null> {
  for (const slug of slugCandidates(company)) {
    try {
      const board = await fetchJson<{ name?: string }>(`https://boards-api.greenhouse.io/v1/boards/${slug}`, { timeoutMs: 8_000 });
      if (board.name && boardMatchesCompany(company, board.name)) return { kind: "auto", type: "greenhouse", identifier: slug };
    } catch {
      // finnes ikke
    }
    try {
      const rss = await fetchText(`https://${slug}.teamtailor.com/jobs.rss`, { timeoutMs: 8_000 });
      const title = rss.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
      if (rss.includes("<rss") && title && boardMatchesCompany(company, title)) {
        return { kind: "auto", type: "teamtailor", identifier: `https://${slug}.teamtailor.com` };
      }
    } catch {
      // finnes ikke
    }
  }
  return null;
}

/**
 * Finn ut hvordan et selskap fra lista kan følges: automatisk (kjent system
 * med åpen stillingsliste) eller manuelt (med grunnen til at det ikke går).
 */
export async function resolveRow(row: ImportRow): Promise<Resolution> {
  let manual: Resolution | null = null;
  for (const url of [row.url, ...row.extraUrls]) {
    const fromUrl = detectFromUrl(url);
    if (fromUrl?.ok) return { kind: "auto", type: fromUrl.type, identifier: fromUrl.identifier };
    if (fromUrl && !fromUrl.ok) {
      if (fromUrl.reason !== "invalid") manual ??= { kind: "manual", reason: fromUrl.reason, system: fromUrl.system };
      continue;
    }
    try {
      const page = url.match(/^https?:\/\//) ? url : `https://${url}`;
      const fromHtml = detectFromHtml(await fetchPublicHtml(page), page);
      if (fromHtml?.ok) return { kind: "auto", type: fromHtml.type, identifier: fromHtml.identifier };
      if (fromHtml && !fromHtml.ok && fromHtml.reason !== "invalid")
        manual ??= { kind: "manual", reason: fromHtml.reason, system: fromHtml.system };
    } catch {
      manual ??= { kind: "manual", reason: "unreachable" };
    }
  }
  return (await guessBoards(row.company)) ?? manual ?? { kind: "manual", reason: "none" };
}

/** Kjør med begrenset samtidighet, så vi ikke hamrer på mange sider samtidig. */
export async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
