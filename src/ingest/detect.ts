/**
 * Finner ut hva slags kilde en innlimt lenke er, og hvordan den kan hentes.
 * Først ut fra adressen; ellers hentes siden og vi ser etter spor av kjente
 * rekrutteringssystemer (innebygde stillingslister, RSS-lenker osv.).
 */
import type { SourceType } from "./types";

export type Detected =
  | { ok: true; type: SourceType; identifier: string; name: string; url: string }
  | { ok: false; reason: "invalid" | "workday" | "unsupported" | "unreachable"; system?: string; url?: string };

const titleCase = (s: string) =>
  s
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

/** Gjenkjenning kun ut fra adressen (ingen nettverk). */
export function detectFromUrl(raw: string): Detected | null {
  let u: URL;
  try {
    u = new URL(raw.trim().match(/^https?:\/\//) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const seg = u.pathname.split("/").filter(Boolean);
  const url = u.toString();

  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const forParam = u.searchParams.get("for");
    const token = forParam ?? (seg[0] === "embed" ? null : seg[0]);
    if (token) return { ok: true, type: "greenhouse", identifier: token, name: titleCase(token), url };
  }
  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") {
    if (seg[0]) {
      const id = host.includes(".eu.") ? `eu:${seg[0]}` : seg[0];
      return { ok: true, type: "lever", identifier: id, name: titleCase(seg[0]), url };
    }
  }
  if (host === "jobs.ashbyhq.com" && seg[0]) {
    return { ok: true, type: "ashby", identifier: seg[0], name: titleCase(seg[0]), url };
  }
  if (host.endsWith(".teamtailor.com") && !host.startsWith("app.")) {
    const sub = host.split(".")[0];
    return { ok: true, type: "teamtailor", identifier: `${u.protocol}//${u.host}`, name: titleCase(sub), url };
  }
  if (host.endsWith(".bamboohr.com")) {
    const sub = host.split(".")[0];
    return { ok: true, type: "bamboohr", identifier: sub, name: titleCase(sub), url };
  }
  if (host === "nu.nhhs.no") return { ok: true, type: "nhhs", identifier: "default", name: "NHHS (NHH)", url };
  if (host === "bindeleddet.no" || host === "apiv2.bindeleddet.no")
    return { ok: true, type: "bindeleddet", identifier: "default", name: "Bindeleddet (Indøk)", url };
  if (host === "arbeidsplassen.nav.no" || host === "nav.no")
    return { ok: true, type: "nav", identifier: "default", name: "NAV – arbeidsplassen.no (Oslo)", url };
  if (host === "arbetsformedlingen.se" || host.endsWith("jobtechdev.se"))
    return { ok: true, type: "jobtech", identifier: "default", name: "Arbetsförmedlingen (Stockholm)", url };
  if (/(^|\.)adzuna\.(co\.uk|com|no|se)$/.test(host))
    return { ok: true, type: "adzuna", identifier: "default", name: "Adzuna (London og New York)", url };
  if (host.endsWith("myworkdayjobs.com") || host.endsWith("workday.com"))
    return { ok: false, reason: "workday", system: "Workday", url };
  for (const [pattern, system] of [
    [/successfactors|sapsf/, "SAP SuccessFactors"],
    [/taleo\.net|oraclecloud\.com/, "Oracle"],
    [/smartrecruiters\.com/, "SmartRecruiters"],
    [/webcruiter/, "Webcruiter"],
    [/jobylon\.com/, "Jobylon"],
    [/avature\.net/, "Avature"],
    [/eightfold\.ai/, "Eightfold"],
    [/finn\.no$/, "FINN (vilkårene tillater ikke automatisk henting)"],
    [/linkedin\.com|indeed\.|glassdoor\./, "LinkedIn/Indeed/Glassdoor"],
  ] as const) {
    if (pattern.test(host)) return { ok: false, reason: "unsupported", system, url };
  }
  return null;
}

/** Spor av kjente systemer i HTML-en til en karriereside. */
export function detectFromHtml(html: string, pageUrl: string): Detected | null {
  const u = new URL(pageUrl);
  const name =
    html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<title[^>]*>([^<|–-]+)/i)?.[1]?.trim() ??
    titleCase(u.hostname.replace(/^www\.|^careers?\.|^jobs?\./, "").split(".")[0]);

  const gh = html.match(/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([a-z0-9_-]+)/i);
  if (gh && gh[1] !== "embed") return { ok: true, type: "greenhouse", identifier: gh[1], name, url: pageUrl };
  const lv = html.match(/jobs\.(eu\.)?lever\.co\/([a-z0-9_-]+)/i);
  if (lv) return { ok: true, type: "lever", identifier: lv[1] ? `eu:${lv[2]}` : lv[2], name, url: pageUrl };
  const ab = html.match(/jobs\.ashbyhq\.com\/([a-z0-9_.-]+)/i);
  if (ab) return { ok: true, type: "ashby", identifier: ab[1], name, url: pageUrl };
  if (/teamtailor/i.test(html) && /jobs\.rss|teamtailor-cdn|career-site/i.test(html)) {
    return { ok: true, type: "teamtailor", identifier: `${u.protocol}//${u.host}`, name, url: pageUrl };
  }
  const bamboo = html.match(/([a-z0-9-]+)\.bamboohr\.com/i);
  if (bamboo) return { ok: true, type: "bamboohr", identifier: bamboo[1].toLowerCase(), name, url: pageUrl };
  if (/myworkdayjobs\.com|myworkday\.com/i.test(html)) return { ok: false, reason: "workday", system: "Workday", url: pageUrl };
  for (const [pattern, system] of [
    [/jobylon/i, "Jobylon"],
    [/successfactors|sapsf/i, "SAP SuccessFactors"],
    [/oraclecloud|taleo/i, "Oracle"],
    [/avature/i, "Avature"],
    [/eightfold/i, "Eightfold"],
    [/phenompeople/i, "Phenom"],
    [/smartrecruiters/i, "SmartRecruiters"],
  ] as const) {
    if (pattern.test(html)) return { ok: false, reason: "unsupported", system, url: pageUrl };
  }
  return null;
}
