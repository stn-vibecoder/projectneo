/**
 * Import av karrieresider fra CSV (rene funksjoner, se csv-import.test.ts).
 * Forventer kolonner som «selskap, sektor, byer, url, merknad», men godtar
 * også engelske navn (company, sector, cities, url, notes).
 */
import type { Industry } from "@/lib/domain";

export type ImportRow = {
  company: string;
  sector: string | null;
  cities: string | null;
  url: string;
  notes: string | null;
  /** Ekstra lenker funnet i merknaden. */
  extraUrls: string[];
};

/** Enkel, robust CSV-tolker (komma eller semikolon, anførselstegn, BOM). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const HEADERS: Record<keyof Omit<ImportRow, "extraUrls">, string[]> = {
  company: ["selskap", "company", "firma", "navn", "name"],
  sector: ["sektor", "sector", "bransje", "industry"],
  cities: ["byer", "by", "cities", "city"],
  url: ["url", "lenke", "link", "karriereside"],
  notes: ["merknad", "notes", "note", "kommentar"],
};

export function toImportRows(text: string): ImportRow[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  const idx = (key: keyof typeof HEADERS) =>
    header.findIndex((h) => HEADERS[key].includes(h.trim().toLowerCase()));
  const col = { company: idx("company"), sector: idx("sector"), cities: idx("cities"), url: idx("url"), notes: idx("notes") };
  if (col.company < 0 || col.url < 0) return [];
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() || null : null);
  return body
    .map((r) => {
      const notes = get(r, col.notes);
      return {
        company: get(r, col.company) ?? "",
        sector: get(r, col.sector),
        cities: get(r, col.cities),
        url: get(r, col.url) ?? "",
        notes,
        extraUrls: (notes?.match(/https?:\/\/[^\s",)]+/g) ?? []).map((u) => u.replace(/[.;]+$/, "")),
      };
    })
    .filter((r) => r.company && r.url);
}

/** Sektor fra lista -> bransje i appen. */
export function sectorToIndustry(sector: string | null): Industry | null {
  if (!sector) return null;
  const s = sector.toLowerCase();
  if (/revisjon|audit|regnskap/.test(s)) return "audit";
  if (/consult|konsulent|rådgiv/.test(s)) return "consulting";
  if (/bank|invest|finans|financ|kapital|equity|hedge|trading|fond|asset/.test(s)) return "finance";
  if (/tech|it\b|data/.test(s)) return "tech";
  if (/portal|jobb/.test(s)) return null;
  return "other";
}

const COMPANY_NOISE = new Set(["as", "asa", "ab", "co", "company", "and", "og", "the", "partners", "group", "inc", "llc", "plc"]);

/** Mulige navn på en offentlig stillingsside, f.eks. «Jane Street» -> janestreet, jane-street, jane. */
export function slugCandidates(company: string): string[] {
  const words = company
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, " ")
    .split(/[^A-Za-z0-9]+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w && !COMPANY_NOISE.has(w));
  const out = new Set<string>();
  if (words.length) {
    out.add(words.join(""));
    out.add(words.join("-"));
    if (words.length > 1 && words[0].length >= 4) out.add(words[0]);
  }
  return [...out].filter((s) => s.length >= 3);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9æøåäö]/g, "");
const ALLOWED_EXTRA = /^(advisors?|partners|group|capital|securities|ab|as|asa|ltd|inc|norge|norway|sverige|sweden|uk|us|nordic|careers?)*$/;

/**
 * Er stillingssiden vi fant faktisk dette selskapet? «Nordic Capital» ↔
 * «Nordic Capital Advisors» er ok; «Apollo» ↔ «Apollo Education Systems» er ikke.
 */
export function boardMatchesCompany(company: string, boardName: string): boolean {
  const a = norm(company.replace(/\(.*?\)/g, ""));
  const b = norm(boardName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b)) return ALLOWED_EXTRA.test(a.slice(b.length));
  if (b.startsWith(a)) return ALLOWED_EXTRA.test(b.slice(a.length));
  return false;
}
