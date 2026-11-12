/**
 * Offentlige jobbdatabaser med offisielle API-er:
 *  - NAV / arbeidsplassen.no (Oslo) – https://navikt.github.io/pam-stilling-feed/
 *  - Arbetsförmedlingen JobSearch (Stockholm) – åpne data
 *  - Adzuna (London og New York) – krever gratis nøkkel
 */
import { isInternshipTitle } from "@/config/internship-keywords";
import { matchCities } from "@/lib/normalize";
import { fetchJson, fetchText, sleep } from "../http";
import { plain, toDate } from "../text";
import type { Adapter, AdapterResult, RawPosting, SourceConfig } from "../types";

// ---------------------------------------------------------------------
// NAV
// Feeden er inkrementell: vi husker hvor vi slapp (state.cursor) og leser
// bare nye sider. Oslo-annonser med internship-tittel hentes i detalj.
// Vilkår: inaktive annonser skal fjernes straks -> de stenges i appen.
// ---------------------------------------------------------------------

const NAV_BASE = "https://pam-stilling-feed.nav.no";
const NAV_MAX_PAGES = 40;
const NAV_MAX_ENTRIES = 150;

type NavFeedPage = {
  next_url: string | null;
  next_id: string | null;
  feed_url?: string;
  items: {
    id: string;
    url: string;
    title: string;
    _feed_entry: { uuid: string; status: "ACTIVE" | "INACTIVE"; title: string; businessName?: string; municipal?: string };
  }[];
};

type NavEntry = {
  uuid: string;
  status: string;
  ad_content?: {
    title: string;
    link?: string;
    applicationUrl?: string;
    applicationDue?: string;
    description?: string;
    employer?: { name?: string };
    workLocations?: { city?: string; municipal?: string }[];
  };
};

/** Velg ut relevante og fjernede annonser fra én feedside. */
export function scanNavPage(page: NavFeedPage): { wanted: string[]; removed: string[] } {
  const wanted: string[] = [];
  const removed: string[] = [];
  for (const item of page.items) {
    const fe = item._feed_entry;
    if (fe.status !== "ACTIVE") {
      removed.push(fe.uuid);
      continue;
    }
    if (matchCities(fe.municipal ?? "").length && isInternshipTitle(fe.title)) wanted.push(fe.uuid);
  }
  return { wanted, removed };
}

export function parseNavEntry(entry: NavEntry): RawPosting | null {
  const ad = entry.ad_content;
  if (!ad || entry.status !== "ACTIVE") return null;
  return {
    externalId: entry.uuid,
    title: ad.title,
    company: ad.employer?.name ?? "Ukjent arbeidsgiver",
    locations: (ad.workLocations ?? []).map((w) => w.city || w.municipal || "").filter(Boolean),
    url: ad.link ?? null,
    applyUrl: ad.applicationUrl || ad.link || null,
    description: plain(ad.description),
    deadline: toDate(ad.applicationDue ?? null),
  };
}

async function navToken(): Promise<string> {
  if (process.env.NAV_FEED_TOKEN) return process.env.NAV_FEED_TOKEN;
  // Offentlig testtoken (byttes jevnlig). Egen token: se README.
  const text = await fetchText(`${NAV_BASE}/api/publicToken`);
  const m = text.match(/eyJ[\w.-]+/);
  if (!m) throw new Error("Fant ikke NAV-token. Legg inn NAV_FEED_TOKEN i .env.local.");
  return m[0];
}

export const nav: Adapter = {
  type: "nav",
  async fetch(source) {
    const headers = { Authorization: `Bearer ${await navToken()}` };
    let url = typeof source.state.cursor === "string" ? `${NAV_BASE}${source.state.cursor}` : `${NAV_BASE}/api/v1/feed`;
    const firstHeaders: Record<string, string> = { ...headers };
    if (!source.state.cursor) {
      // Første kjøring: start 45 dager tilbake i stedet for fra 2019.
      firstHeaders["If-Modified-Since"] = new Date(Date.now() - 45 * 86_400_000).toUTCString();
    }

    const wanted = new Set<string>();
    const removed = new Set<string>();
    let cursor = source.state.cursor as string | undefined;
    for (let pageNo = 0; pageNo < NAV_MAX_PAGES; pageNo++) {
      const page = await fetchJson<NavFeedPage>(url, { headers: pageNo === 0 ? firstHeaders : headers, timeoutMs: 40_000 });
      const scan = scanNavPage(page);
      scan.wanted.forEach((id) => wanted.add(id));
      scan.removed.forEach((id) => {
        removed.add(id);
        wanted.delete(id);
      });
      cursor = page.feed_url ?? cursor;
      if (!page.next_url || !page.next_id || page.items.length === 0) break;
      url = `${NAV_BASE}${page.next_url}`;
      cursor = page.next_url;
      await sleep(200);
    }

    const postings: RawPosting[] = [];
    for (const id of [...wanted].slice(0, NAV_MAX_ENTRIES)) {
      const entry = await fetchJson<NavEntry>(`${NAV_BASE}/api/v1/feedentry/${id}`, { headers });
      const p = parseNavEntry(entry);
      if (p) postings.push(p);
      else removed.add(id);
      await sleep(150);
    }
    return { postings, complete: false, removedIds: [...removed], state: { cursor } };
  },
};

// ---------------------------------------------------------------------
// Arbetsförmedlingen JobSearch – åpne data, ingen nøkkel
// ---------------------------------------------------------------------

const JOBTECH_STOCKHOLM = "AvNB_uwa_6n6"; // kommune-ID for Stockholm
const JOBTECH_QUERIES = ["praktikant", "praktik", "internship", "trainee", "sommarjobb", "summer intern"];

type JobTechHit = {
  id: string;
  headline: string;
  webpage_url: string;
  application_deadline?: string | null;
  employer?: { name?: string };
  workplace_address?: { city?: string | null; municipality?: string | null };
  application_details?: { url?: string | null };
  description?: { text?: string };
  removed?: boolean;
};

export function parseJobTech(hits: JobTechHit[]): RawPosting[] {
  return hits
    .filter((h) => !h.removed)
    .map((h) => ({
      externalId: h.id,
      title: h.headline,
      company: h.employer?.name ?? "Okänd arbetsgivare",
      locations: [h.workplace_address?.municipality ?? h.workplace_address?.city ?? ""].filter(Boolean),
      url: h.webpage_url,
      applyUrl: h.application_details?.url ?? h.webpage_url,
      description: plain(h.description?.text),
      deadline: toDate(h.application_deadline ?? null),
    }));
}

export const jobtech: Adapter = {
  type: "jobtech",
  async fetch() {
    const byId = new Map<string, RawPosting>();
    for (const q of JOBTECH_QUERIES) {
      const params = new URLSearchParams({ q, municipality: JOBTECH_STOCKHOLM, limit: "100" });
      const data = await fetchJson<{ hits: JobTechHit[] }>(`https://jobsearch.api.jobtechdev.se/search?${params}`);
      for (const p of parseJobTech(data.hits)) byId.set(p.externalId, p);
      await sleep(200);
    }
    const postings = [...byId.values()];
    return { postings, complete: true, total: postings.length };
  },
};

// ---------------------------------------------------------------------
// Adzuna – London (gb) og New York (us). Krever ADZUNA_APP_ID/APP_KEY.
// Vilkår: Adzuna skal krediteres der stillingene vises.
// ---------------------------------------------------------------------

type AdzunaResult = {
  id: string;
  title: string;
  redirect_url: string;
  description?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
};

export function parseAdzuna(results: AdzunaResult[]): RawPosting[] {
  return results.map((r) => ({
    externalId: r.id,
    title: plain(r.title) ?? r.title,
    company: r.company?.display_name ?? "Unknown",
    locations: [r.location?.display_name ?? "", ...(r.location?.area ?? [])].filter(Boolean),
    url: r.redirect_url,
    description: plain(r.description),
  }));
}

export const adzuna: Adapter = {
  type: "adzuna",
  async fetch() {
    const id = process.env.ADZUNA_APP_ID;
    const key = process.env.ADZUNA_APP_KEY;
    if (!id || !key) throw new Error("Mangler ADZUNA_APP_ID og ADZUNA_APP_KEY i .env.local (gratis på developer.adzuna.com).");
    const byId = new Map<string, RawPosting>();
    for (const [country, where] of [
      ["gb", "London"],
      ["us", "New York"],
    ] as const) {
      const params = new URLSearchParams({
        app_id: id,
        app_key: key,
        what_or: "intern internship placement analyst",
        where,
        results_per_page: "50",
        "content-type": "application/json",
      });
      const data = await fetchJson<{ results: AdzunaResult[] }>(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
      );
      for (const p of parseAdzuna(data.results)) byId.set(p.externalId, p);
      await sleep(300);
    }
    const postings = [...byId.values()];
    return { postings, complete: true, total: postings.length };
  },
};

export type { SourceConfig, AdapterResult };
