/**
 * Leser stillingsinfo fra HTML: JSON-LD (schema.org/JobPosting) eller
 * OpenGraph som reserve. Ren funksjon uten nettverk, så den kan testes.
 */
import { guessPeriod, htmlToText, matchCities, toDateOnlyOrNull } from "@/lib/normalize";
import type { City, Period } from "@/lib/domain";

export type Prefill = {
  title?: string;
  company?: string;
  location?: string;
  cities: City[];
  period: Period;
  deadline?: string | null;
  description?: string;
  foundJsonLd: boolean;
};

type JsonLdNode = Record<string, unknown>;

function findJobPosting(node: unknown): JsonLdNode | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = findJobPosting(n);
      if (f) return f;
    }
    return null;
  }
  const obj = node as JsonLdNode;
  const type = obj["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return obj;
  if (obj["@graph"]) return findJobPosting(obj["@graph"]);
  return null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function locationText(jobLocation: unknown): string | undefined {
  const locs = Array.isArray(jobLocation) ? jobLocation : [jobLocation];
  const parts = locs
    .map((l) => {
      const addr = (l as JsonLdNode | undefined)?.address as JsonLdNode | string | undefined;
      if (typeof addr === "string") return addr;
      if (!addr) return undefined;
      return [str(addr.addressLocality), str(addr.addressRegion), str(addr.addressCountry)].filter(Boolean).join(", ");
    })
    .filter(Boolean);
  return parts.length ? parts.join(" / ") : undefined;
}

function meta(html: string, key: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
    "i",
  );
  const m = html.match(re);
  return m ? htmlToText(m[1] ?? m[2] ?? "") || undefined : undefined;
}

export function extractPrefill(html: string): Prefill {
  let posting: JsonLdNode | null = null;
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      posting = findJobPosting(JSON.parse(m[1].trim()));
      if (posting) break;
    } catch {
      // Ugyldig JSON-LD: prøv neste blokk.
    }
  }

  if (posting) {
    const org = posting.hiringOrganization as JsonLdNode | string | undefined;
    const title = str(posting.title);
    const location = locationText(posting.jobLocation);
    const description = str(posting.description) ? htmlToText(posting.description as string) : undefined;
    return {
      title,
      company: typeof org === "string" ? org : str(org?.name),
      location,
      cities: matchCities(location),
      period: guessPeriod(`${title ?? ""} ${description?.slice(0, 500) ?? ""}`),
      deadline: toDateOnlyOrNull(posting.validThrough),
      description: description?.slice(0, 20_000),
      foundJsonLd: true,
    };
  }

  const title = meta(html, "og:title") ?? str(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]);
  const description = meta(html, "og:description") ?? meta(html, "description");
  return {
    title: title ? htmlToText(title) : undefined,
    company: meta(html, "og:site_name"),
    cities: matchCities(`${title ?? ""} ${description ?? ""}`),
    period: guessPeriod(title),
    description,
    foundJsonLd: false,
  };
}

