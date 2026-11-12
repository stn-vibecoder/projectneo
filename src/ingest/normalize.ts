import { isInternshipTitle } from "@/config/internship-keywords";
import type { City, Industry, Period } from "@/lib/domain";
import { guessPeriod, matchCities, normalizeCompanyName } from "@/lib/normalize";
import type { RawPosting, SourceConfig } from "./types";

export type NormalizedPosting = RawPosting & {
  cities: City[];
  period: Period;
  industry: Industry | null;
  locationRaw: string | null;
  dedupeKey: string;
};

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9æøåäö]+/g, " ")
    .trim();
}

export function dedupeKey(company: string, title: string): string {
  return `${normalizeCompanyName(company)}|${normalizeTitle(title)}`;
}

/**
 * Gjør en rå stilling klar for databasen – eller null hvis den ikke er et
 * internship i en av byene vi følger.
 */
export function normalizePosting(p: RawPosting, source: Pick<SourceConfig, "industry">): NormalizedPosting | null {
  const title = p.title.trim();
  if (!title) return null;
  const fromLocations = [...new Set(p.locations.flatMap((l) => matchCities(l)))];
  const cities = fromLocations.length ? fromLocations : matchCities(title);
  if (cities.length === 0) return null;
  if (!p.internshipHint && !isInternshipTitle(title)) return null;

  return {
    ...p,
    title,
    cities,
    period: guessPeriod(`${title} ${(p.description ?? "").slice(0, 400)}`),
    industry: p.industry ?? source.industry ?? null,
    locationRaw: p.locations.join(" / ").slice(0, 200) || null,
    dedupeKey: dedupeKey(p.company, title),
  };
}
