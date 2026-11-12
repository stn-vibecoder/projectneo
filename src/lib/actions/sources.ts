"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { asService, asUser } from "@/lib/db";
import { isIndustry, type Industry } from "@/lib/domain";
import { safeUrl } from "@/lib/utils";
import { ADAPTERS } from "@/ingest/adapters";
import { detectFromHtml, detectFromUrl, type Detected } from "@/ingest/detect";
import { fetchPublicHtml } from "@/lib/prefill";
import { normalizePosting } from "@/ingest/normalize";
import { runAllSources, runSource, type RunResult } from "@/ingest/run";
import { closeOrphans } from "@/ingest/store";
import { sectorToIndustry, toImportRows } from "@/ingest/csv-import";
import { mapLimited, resolveRow } from "@/ingest/resolve";
import { isSourceType, type SourceConfig, type SourceType } from "@/ingest/types";
import { fail, ok, type ActionResult } from "./result";

function revalidate() {
  revalidatePath("/sources");
  revalidatePath("/feed");
  revalidatePath("/dashboard");
}

export type Preview = {
  type: SourceType;
  identifier: string;
  name: string;
  url: string;
  total: number;
  internships: number;
  samples: { title: string; company: string; cities: string[] }[];
};

/** Finn ut hva lenken er, og prøvehent for å vise hva kilden gir. */
export async function previewSource(rawUrl: string): Promise<ActionResult<Preview>> {
  const t = await getTranslations("sources");
  await requireUser();

  let detected: Detected | null = detectFromUrl(rawUrl);
  if (detected === null) {
    const url = safeUrl(rawUrl.match(/^https?:\/\//) ? rawUrl : `https://${rawUrl}`);
    if (!url) return fail(t("errors.invalid"));
    try {
      detected = detectFromHtml(await fetchPublicHtml(url), url) ?? { ok: false, reason: "unsupported" };
    } catch {
      detected = { ok: false, reason: "unreachable" };
    }
  }
  if (!detected.ok) {
    return fail(
      detected.reason === "workday"
        ? t("errors.workday")
        : detected.reason === "invalid"
          ? t("errors.invalid")
          : detected.reason === "unreachable"
            ? t("errors.unreachable")
            : detected.system
              ? t("errors.system", { system: detected.system })
              : t("errors.unsupported"),
    );
  }

  const config: SourceConfig = {
    id: "preview",
    type: detected.type,
    identifier: detected.identifier,
    name: detected.name,
    url: detected.url,
    industry: null,
    state: {},
  };
  try {
    // NAV hentes inkrementelt og er for tungt å prøvehente; vis bare at den gjenkjennes.
    if (detected.type === "nav") {
      return ok({ ...detected, total: 0, internships: 0, samples: [] });
    }
    const result = await ADAPTERS[detected.type].fetch(config);
    const normalized = result.postings.map((p) => normalizePosting(p, config)).filter((p) => p !== null);
    return ok({
      type: detected.type,
      identifier: detected.identifier,
      name: result.postings[0]?.company && detected.type === "greenhouse" ? result.postings[0].company : detected.name,
      url: detected.url,
      total: result.total ?? result.postings.length,
      internships: normalized.length,
      samples: normalized.slice(0, 5).map((p) => ({ title: p.title, company: p.company, cities: p.cities })),
    });
  } catch (e) {
    return fail(t("errors.fetch", { message: e instanceof Error ? e.message : String(e) }));
  }
}

const addSchema = z.object({
  type: z.string().refine(isSourceType),
  identifier: z.string().min(1).max(300),
  name: z.string().trim().min(1).max(120),
  url: z.string().max(500).nullable(),
  industry: z.string().nullable(),
});

/** Lagre en kilde og hent den med en gang. */
export async function addSource(input: z.infer<typeof addSchema>): Promise<ActionResult<RunResult | null>> {
  const t = await getTranslations("sources");
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return fail(t("errors.invalid"));
  const user = await requireUser();
  const industry: Industry | null = parsed.data.industry && isIndustry(parsed.data.industry) ? parsed.data.industry : null;

  let id: string;
  try {
    const [row] = await asUser(user.id, (sql) =>
      sql.query<{ id: string }>(
        `insert into sources (user_id, type, identifier, name, url, industry)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (user_id, type, identifier) do update set enabled = true, name = excluded.name,
           industry = coalesce(excluded.industry, sources.industry)
         returning id`,
        [user.id, parsed.data.type, parsed.data.identifier, parsed.data.name, safeUrl(parsed.data.url), industry],
      ),
    );
    id = row.id;
  } catch {
    return fail(t("errors.save"));
  }
  const result = await runSource(id);
  revalidate();
  return ok(result);
}

export async function setSourceEnabled(id: string, enabled: boolean): Promise<ActionResult> {
  const t = await getTranslations("common");
  if (!z.uuid().safeParse(id).success) return fail(t("error"));
  const user = await requireUser();
  await asUser(user.id, (sql) => sql.query(`update sources set enabled = $2 where id = $1`, [id, enabled]));
  revalidate();
  return ok();
}

export async function updateSourceIndustry(id: string, industry: string): Promise<ActionResult> {
  const t = await getTranslations("common");
  if (!z.uuid().safeParse(id).success) return fail(t("error"));
  const user = await requireUser();
  await asUser(user.id, (sql) =>
    sql.query(`update sources set industry = $2 where id = $1`, [id, isIndustry(industry) ? industry : null]),
  );
  revalidate();
  return ok();
}

export async function deleteSource(id: string): Promise<ActionResult> {
  const t = await getTranslations("common");
  if (!z.uuid().safeParse(id).success) return fail(t("error"));
  const user = await requireUser();
  const [deleted] = await asUser(user.id, (sql) =>
    sql.query<{ id: string }>(`delete from sources where id = $1 returning id`, [id]),
  );
  if (deleted) await asService((sql) => closeOrphans(sql));
  revalidate();
  return ok();
}

/** Hent én kilde nå (kun egne kilder). */
export async function runSourceNow(id: string): Promise<ActionResult<RunResult>> {
  const t = await getTranslations("common");
  if (!z.uuid().safeParse(id).success) return fail(t("error"));
  const user = await requireUser();
  const [own] = await asUser(user.id, (sql) => sql.query<{ id: string }>(`select id from sources where id = $1`, [id]));
  if (!own) return fail(t("error"));
  const result = await runSource(id);
  revalidate();
  return ok(result);
}

export async function runAllNow(): Promise<ActionResult<RunResult[]>> {
  const user = await requireUser();
  const results = await runAllSources(user.id);
  revalidate();
  return ok(results);
}

export type ImportSummary = {
  auto: { name: string; type: string; internships: number | null; error?: string }[];
  manual: { name: string; reason: string; system?: string }[];
};

/**
 * Importer en liste karrieresider (CSV). Hver rad blir enten en kilde som
 * hentes automatisk, eller en lenke som følges manuelt.
 */
export async function importSources(csv: string): Promise<ActionResult<ImportSummary>> {
  const t = await getTranslations("sources");
  const user = await requireUser();
  const rows = toImportRows(csv).slice(0, 300);
  if (rows.length === 0) return fail(t("import.empty"));

  const resolved = await mapLimited(rows, 6, async (row) => ({ row, res: await resolveRow(row) }));

  const autoIds: { id: string; name: string; type: string }[] = [];
  const summary: ImportSummary = { auto: [], manual: [] };
  await asUser(user.id, async (sql) => {
    for (const { row, res } of resolved) {
      const industry = sectorToIndustry(row.sector);
      const url = safeUrl(row.url.match(/^https?:\/\//) ? row.url : `https://${row.url}`);
      if (res.kind === "auto") {
        const [r] = await sql.query<{ id: string }>(
          `insert into sources (user_id, type, identifier, name, url, industry, notes, sector)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (user_id, type, identifier) do update
             set notes = coalesce(excluded.notes, sources.notes), sector = excluded.sector,
                 industry = coalesce(sources.industry, excluded.industry), enabled = true
           returning id`,
          [user.id, res.type, res.identifier, row.company.slice(0, 120), url, industry, row.notes, row.sector],
        );
        autoIds.push({ id: r.id, name: row.company, type: res.type });
      } else {
        await sql.query(
          `insert into sources (user_id, type, identifier, name, url, industry, notes, sector, state)
           values ($1, 'manual', $2, $3, $4, $5, $6, $7, $8::jsonb)
           on conflict (user_id, type, identifier) do update
             set name = excluded.name, notes = excluded.notes, sector = excluded.sector,
                 industry = excluded.industry, state = excluded.state`,
          [
            user.id,
            url ?? row.url,
            row.company.slice(0, 120),
            url,
            industry,
            row.notes,
            row.sector,
            JSON.stringify({ reason: res.reason, system: res.system ?? null, cities: row.cities }),
          ],
        );
        summary.manual.push({ name: row.company, reason: res.reason, system: res.system });
      }
    }
  });

  // Hent de automatiske kildene med en gang.
  for (const a of autoIds) {
    const r = await runSource(a.id);
    summary.auto.push(
      r.ok ? { name: a.name, type: a.type, internships: r.internships } : { name: a.name, type: a.type, internships: null, error: r.error },
    );
  }
  revalidate();
  return ok(summary);
}
