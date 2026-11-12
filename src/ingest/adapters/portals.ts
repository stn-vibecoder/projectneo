/**
 * Studentportaler: NHHS (NHH) og Bindeleddet (Indøk, NTNU).
 *
 * Ingen av dem har dokumenterte API-er. Brukeren har bedt om henting for
 * personlig bruk; kildene kan slås av med STUDENT_PORTALS_ENABLED=false.
 * Vi henter én side/ett kall per kjøring, med egen User-Agent.
 */
import { fetchJson, fetchText } from "../http";
import { guessIndustry, plain, toDate } from "../text";
import type { Adapter, AdapterResult, RawPosting, SourceConfig } from "../types";

export const STUDENT_PORTALS_ENABLED = process.env.STUDENT_PORTALS_ENABLED !== "false";

const decodeAttr = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

// ---------------------------------------------------------------------
// NHHS – https://www.nu.nhhs.no/jobs/ (serverrendret liste med data-attributter)
// ---------------------------------------------------------------------

export function parseNhhs(html: string): AdapterResult {
  const rows = html.match(/<a class="jb-job-row"[\s\S]*?>/g) ?? [];
  const attr = (row: string, name: string) => {
    const m = row.match(new RegExp(`data-${name}="([^"]*)"`));
    return m ? decodeAttr(m[1]).trim() : "";
  };
  const postings: RawPosting[] = rows
    .map((row) => {
      const id = attr(row, "job-id");
      const type = attr(row, "type");
      return {
        externalId: id,
        title: attr(row, "title"),
        company: attr(row, "company"),
        locations: [attr(row, "city"), attr(row, "country")].filter(Boolean),
        url: id ? `https://www.nu.nhhs.no/jobs/${id}/details` : null,
        deadline: toDate(attr(row, "deadline")),
        internshipHint: type === "internship",
        industry: guessIndustry(attr(row, "industry")),
      };
    })
    .filter((p) => p.externalId && p.title);
  return { postings, complete: true, total: postings.length };
}

export const nhhs: Adapter = {
  type: "nhhs",
  async fetch() {
    if (!STUDENT_PORTALS_ENABLED) throw new Error("Studentportaler er slått av (STUDENT_PORTALS_ENABLED=false).");
    return parseNhhs(await fetchText("https://www.nu.nhhs.no/jobs/"));
  },
};

// ---------------------------------------------------------------------
// Bindeleddet – JSON som nettsiden selv bruker (apiv2.bindeleddet.no/jobs/)
// job_type: S = sommerjobb/internship, T = trainee, F = fast, D = deltid, A = arrangement
// ---------------------------------------------------------------------

type BindeleddetJob = {
  id: number;
  title: string;
  company_name: string;
  location?: string | null;
  deadline?: string | null;
  job_type?: string;
  search_url?: string | null;
  description?: string | null;
  is_visible?: boolean;
};

export function parseBindeleddet(data: BindeleddetJob[]): AdapterResult {
  const postings: RawPosting[] = data
    .filter((j) => j.is_visible !== false && j.job_type !== "A")
    .map((j) => ({
      externalId: String(j.id),
      title: j.title,
      company: j.company_name,
      locations: [j.location ?? ""].filter(Boolean),
      url: j.search_url || `https://bindeleddet.no/jobs/${j.id}`,
      description: plain(j.description, 5_000),
      deadline: toDate(j.deadline ?? null),
      internshipHint: j.job_type === "S" || j.job_type === "T",
    }));
  return { postings, complete: true, total: postings.length };
}

export const bindeleddet: Adapter = {
  type: "bindeleddet",
  async fetch() {
    if (!STUDENT_PORTALS_ENABLED) throw new Error("Studentportaler er slått av (STUDENT_PORTALS_ENABLED=false).");
    return parseBindeleddet(await fetchJson<BindeleddetJob[]>("https://apiv2.bindeleddet.no/jobs/"));
  },
};

export type { SourceConfig };
