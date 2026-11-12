"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { asUser, pgArray } from "@/lib/db";
import { prefillFromUrl, type Prefill } from "@/lib/prefill";
import { normalizeCompanyName } from "@/lib/normalize";
import { isCity, isIndustry, isPeriod } from "@/lib/domain";
import { isValidDateOnly } from "@/lib/tracker/dates";
import { firstSavedStatusId, topPosition } from "@/lib/tracker/queries";
import { emptyToNull, safeUrl } from "@/lib/utils";
import { fail, ok, type ActionResult } from "./result";

export async function prefillJob(url: string): Promise<ActionResult<Prefill>> {
  const t = await getTranslations("job");
  await requireUser();
  const clean = safeUrl(url);
  if (!clean) return fail(t("errors.url"));
  try {
    return ok(await prefillFromUrl(clean));
  } catch {
    return fail(t("prefillFailed"));
  }
}

export async function createManualJob(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = await getTranslations();
  const user = await requireUser();

  const companyName = emptyToNull(formData.get("company"));
  const title = emptyToNull(formData.get("title"));
  const rawUrl = emptyToNull(formData.get("url"));
  const deadline = emptyToNull(formData.get("deadline"));
  const period = String(formData.get("period") ?? "unknown");
  const industry = String(formData.get("industry") ?? "");
  const cities = [...new Set(formData.getAll("cities").map(String).filter(isCity))];

  const fieldErrors: Record<string, string> = {};
  if (!companyName || companyName.length > 200) fieldErrors.company = t("job.errors.company");
  if (!title || title.length > 300) fieldErrors.title = t("job.errors.title");
  if (rawUrl && !safeUrl(rawUrl)) fieldErrors.url = t("job.errors.url");
  if (deadline && !isValidDateOnly(deadline)) fieldErrors.deadline = t("job.errors.date");
  if (Object.keys(fieldErrors).length) return fail(t("common.error"), fieldErrors);

  const url = safeUrl(rawUrl);
  const industryValue = isIndustry(industry) ? industry : null;

  let applicationId: string;
  try {
    applicationId = await asUser(user.id, async (sql) => {
      // Gjenbruk felles selskap med samme navn hvis det finnes, ellers lag et privat.
      const [existing] = await sql.query<{ id: string }>(
        `select id from companies where normalized_name = $1 order by created_by nulls first limit 1`,
        [normalizeCompanyName(companyName!)],
      );
      const companyId =
        existing?.id ??
        (
          await sql.query<{ id: string }>(
            `insert into companies (name, created_by, industry) values ($1, $2, $3) returning id`,
            [companyName, user.id, industryValue],
          )
        )[0].id;

      const [job] = await sql.query<{ id: string }>(
        `insert into jobs (company_id, title, cities, location_raw, period, industry, deadline,
                           url, apply_url, description, source, created_by)
         values ($1, $2, $3::city[], $4, $5, $6, $7, $8, $8, $9, 'manual', $10)
         returning id`,
        [
          companyId,
          title,
          pgArray(cities),
          emptyToNull(formData.get("location")),
          isPeriod(period) ? period : "unknown",
          industryValue,
          deadline,
          url,
          emptyToNull(formData.get("description"))?.slice(0, 20_000) ?? null,
          user.id,
        ],
      );

      const statusId = await firstSavedStatusId(sql);
      if (!statusId) throw new Error("Mangler Lagret-status");
      const [app] = await sql.query<{ id: string }>(
        `insert into applications (user_id, job_id, status_id, board_position)
         values ($1, $2, $3, $4) returning id`,
        [user.id, job.id, statusId, await topPosition(sql, statusId)],
      );
      return app.id;
    });
  } catch {
    return fail(t("common.error"));
  }

  revalidatePath("/tracker");
  revalidatePath("/dashboard");
  redirect(`/tracker/${applicationId}?created=1`);
}
