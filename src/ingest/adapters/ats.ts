/**
 * Adaptere for rekrutteringssystemer (ATS) med offisielle, åpne
 * stillings-API-er: Greenhouse, Lever, Ashby og Teamtailor (RSS).
 */
import { fetchJson, fetchText } from "../http";
import { encodedHtmlToText, plain, toDate } from "../text";
import type { Adapter, AdapterResult, RawPosting, SourceConfig } from "../types";

// ---------------------------------------------------------------------
// Greenhouse – https://developers.greenhouse.io/job-board.html
// ---------------------------------------------------------------------

type GreenhouseJob = {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string } | null;
  offices?: { name?: string; location?: string | null }[];
  content?: string;
  company_name?: string;
  application_deadline?: string | null;
};

export function parseGreenhouse(data: { jobs: GreenhouseJob[] }, source: SourceConfig): AdapterResult {
  const postings: RawPosting[] = data.jobs.map((j) => ({
    externalId: String(j.id),
    title: j.title,
    company: source.name || j.company_name || source.identifier,
    locations: [j.location?.name ?? "", ...(j.offices ?? []).map((o) => o.location || o.name || "")].filter(Boolean),
    url: j.absolute_url,
    description: encodedHtmlToText(j.content),
    deadline: toDate(j.application_deadline ?? null),
  }));
  return { postings, complete: true, total: postings.length };
}

export const greenhouse: Adapter = {
  type: "greenhouse",
  async fetch(source) {
    const token = encodeURIComponent(source.identifier);
    const data = await fetchJson<{ jobs: GreenhouseJob[] }>(
      `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`,
      { timeoutMs: 40_000 },
    );
    return parseGreenhouse(data, source);
  },
};

// ---------------------------------------------------------------------
// Lever – https://github.com/lever/postings-api
// identifier: «site» eller «eu:site» for Levers EU-instans
// ---------------------------------------------------------------------

type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  descriptionPlain?: string;
  categories?: { location?: string; allLocations?: string[]; commitment?: string; team?: string };
};

export function parseLever(data: LeverPosting[], source: SourceConfig): AdapterResult {
  const postings: RawPosting[] = data.map((p) => ({
    externalId: p.id,
    title: p.text,
    company: source.name,
    locations: p.categories?.allLocations?.length ? p.categories.allLocations : [p.categories?.location ?? ""],
    url: p.hostedUrl,
    applyUrl: p.applyUrl ?? null,
    description: plain(p.descriptionPlain),
    internshipHint: /intern/i.test(p.categories?.commitment ?? ""),
  }));
  return { postings, complete: true, total: postings.length };
}

export const lever: Adapter = {
  type: "lever",
  async fetch(source) {
    const [region, site] = source.identifier.startsWith("eu:")
      ? ["eu", source.identifier.slice(3)]
      : ["global", source.identifier];
    const host = region === "eu" ? "api.eu.lever.co" : "api.lever.co";
    const data = await fetchJson<LeverPosting[]>(`https://${host}/v0/postings/${encodeURIComponent(site)}?mode=json`);
    return parseLever(data, source);
  },
};

// ---------------------------------------------------------------------
// Ashby – https://developers.ashbyhq.com/docs/public-job-posting-api
// ---------------------------------------------------------------------

type AshbyJob = {
  id: string;
  title: string;
  jobUrl: string;
  applyUrl?: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  employmentType?: string;
  isListed?: boolean;
  descriptionPlain?: string;
};

export function parseAshby(data: { jobs: AshbyJob[] }, source: SourceConfig): AdapterResult {
  const postings: RawPosting[] = data.jobs
    .filter((j) => j.isListed !== false)
    .map((j) => ({
      externalId: j.id,
      title: j.title,
      company: source.name,
      locations: [j.location ?? "", ...(j.secondaryLocations ?? []).map((l) => l.location ?? "")].filter(Boolean),
      url: j.jobUrl,
      applyUrl: j.applyUrl ?? null,
      description: plain(j.descriptionPlain),
      internshipHint: /intern/i.test(j.employmentType ?? ""),
    }));
  return { postings, complete: true, total: postings.length };
}

export const ashby: Adapter = {
  type: "ashby",
  async fetch(source) {
    const data = await fetchJson<{ jobs: AshbyJob[] }>(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.identifier)}`,
    );
    return parseAshby(data, source);
  },
};

// ---------------------------------------------------------------------
// BambooHR – karrieresidens åpne stillingsliste (/careers/list)
// identifier: underdomenet, f.eks. «summaequity»
// ---------------------------------------------------------------------

type BambooJob = {
  id: string;
  jobOpeningName: string;
  employmentStatusLabel?: string | null;
  location?: { city?: string | null; state?: string | null } | null;
  atsLocation?: { city?: string | null; country?: string | null } | null;
};

export function parseBamboo(data: { result: BambooJob[] }, source: SourceConfig): AdapterResult {
  const postings: RawPosting[] = data.result.map((j) => ({
    externalId: String(j.id),
    title: j.jobOpeningName,
    company: source.name,
    locations: [j.location?.city ?? j.atsLocation?.city ?? "", j.atsLocation?.country ?? ""].filter(Boolean) as string[],
    url: `https://${source.identifier}.bamboohr.com/careers/${j.id}`,
    internshipHint: /intern/i.test(j.employmentStatusLabel ?? ""),
  }));
  return { postings, complete: true, total: postings.length };
}

export const bamboohr: Adapter = {
  type: "bamboohr",
  async fetch(source) {
    const data = await fetchJson<{ result: BambooJob[] }>(
      `https://${encodeURIComponent(source.identifier)}.bamboohr.com/careers/list`,
    );
    return parseBamboo(data, source);
  },
};

// ---------------------------------------------------------------------
// Teamtailor – karrieresidens RSS-feed (/jobs.rss)
// identifier: karrieresidens adresse, f.eks. https://selskap.teamtailor.com
// ---------------------------------------------------------------------

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim() : null;
};

export function parseTeamtailor(xml: string, source: SourceConfig): AdapterResult {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const postings: RawPosting[] = items.map((item) => {
    const locs = (item.match(/<tt:location>[\s\S]*?<\/tt:location>/g) ?? []).map((l) =>
      [tag(l, "tt:city") ?? tag(l, "tt:name"), tag(l, "tt:country")].filter(Boolean).join(", "),
    );
    return {
      externalId: tag(item, "guid") ?? tag(item, "link") ?? "",
      title: plain(tag(item, "title")) ?? "",
      company: source.name,
      locations: locs,
      url: tag(item, "link"),
      description: encodedHtmlToText(tag(item, "description")),
    };
  });
  return { postings: postings.filter((p) => p.externalId && p.title), complete: true, total: postings.length };
}

export const teamtailor: Adapter = {
  type: "teamtailor",
  async fetch(source) {
    const base = source.identifier.replace(/\/+$/, "");
    const xml = await fetchText(`${base}/jobs.rss`, { headers: { Accept: "application/rss+xml" } });
    return parseTeamtailor(xml, source);
  },
};
