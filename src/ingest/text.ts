import { htmlToText } from "@/lib/normalize";
import type { Industry } from "@/lib/domain";

/** HTML som er entitets-kodet (som hos Greenhouse) -> ren tekst. */
export function encodedHtmlToText(s: string | null | undefined): string | null {
  if (!s) return null;
  const decoded = s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  return htmlToText(decoded).slice(0, 20_000) || null;
}

export function plain(s: string | null | undefined, max = 20_000): string | null {
  if (!s) return null;
  const t = htmlToText(s);
  return t ? t.slice(0, max) : null;
}

/** Diverse datoformater -> YYYY-MM-DD, ellers null («Snarest» o.l.). */
export function toDate(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const nor = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (nor) return `${nor[3]}-${nor[2].padStart(2, "0")}-${nor[1].padStart(2, "0")}`;
  return null;
}

/** Gjett bransje ut fra en bransjetekst fra kilden. */
export function guessIndustry(text: string | null | undefined): Industry | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/bank|financ|finans|invest|private equity|capital|asset|insurance|forsikring|securities/.test(t)) return "finance";
  if (/consult|konsulent|rådgiv|advisory|strategy|strategi/.test(t)) return "consulting";
  if (/audit|revisjon|accounting|regnskap|tax|skatt/.test(t)) return "audit";
  if (/tech|software|it\b|data|ikt|engineering|ingeniør/.test(t)) return "tech";
  if (/industri|industry|energy|energi|petroleum|olje|shipping|manufactur/.test(t)) return "industry";
  return "other";
}
