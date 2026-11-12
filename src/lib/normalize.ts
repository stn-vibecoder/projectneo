/**
 * Normalisering som deles mellom manuell registrering (fase 1) og
 * datakilde-adapterne (fase 2).
 */
import type { City, Period } from "@/lib/domain";

/** Speiler public.normalize_company_name() i databasen. */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // «Boston Consulting Group (BCG)» = «Boston Consulting Group»
    .replace(/\b(asa|as|ab|ltd|limited|inc|llc|plc|gmbh|llp|co)\b\.?/g, "")
    .replace(/[^a-z0-9æøåäö]+/g, " ")
    .trim();
}

const CITY_PATTERNS: { city: City; include: RegExp; exclude?: RegExp }[] = [
  { city: "oslo", include: /\boslo\b/i },
  { city: "stockholm", include: /\bstockholm\b/i },
  {
    city: "new_york",
    include: /\bnew york\b|\bnyc\b|\bmanhattan\b|\bbrooklyn\b|\bny,?\s*(?:us|usa)\b/i,
    exclude: /\bnew york mills\b/i,
  },
  {
    city: "london",
    include: /\blondon\b|\bcanary wharf\b/i,
    exclude: /\bnew london\b|\blondon,?\s*(?:on|ontario|ky|kentucky|oh|ohio)\b|\blondonderry\b/i,
  },
];

/** Finn hvilke av de støttede byene en stedstekst viser til. */
export function matchCities(text: string | null | undefined): City[] {
  if (!text) return [];
  const found: City[] = [];
  for (const p of CITY_PATTERNS) {
    if (!p.include.test(text)) continue;
    if (p.exclude) {
      // Fjern de ekskluderte frasene og sjekk på nytt, så "London / New London" fortsatt gir London.
      const cleaned = text.replace(new RegExp(p.exclude.source, "gi"), " ");
      if (!p.include.test(cleaned)) continue;
    }
    found.push(p.city);
  }
  return found;
}

/** Gjett periode ut fra tittel/tekst. */
export function guessPeriod(text: string | null | undefined): Period {
  if (!text) return "unknown";
  if (/winternship|\bwinter\b|\bvinter|\bvinterjobb/i.test(text)) return "winter";
  if (/\bsummer\b|\bsommer|\bsommar/i.test(text)) return "summer";
  if (/\bautumn\b|\bfall internship\b|\bhøst|\bhöst/i.test(text)) return "autumn";
  if (/full[- ]year|year[- ]long|12[- ]month|\bhelårs|\bhelår\b/i.test(text)) return "full_year";
  return "unknown";
}

/** HTML -> lesbar ren tekst (for stillingstekster fra JSON-LD o.l.). */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** ISO-dato/tidsstempel -> YYYY-MM-DD, eller null. */
export function toDateOnlyOrNull(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
