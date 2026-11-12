"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { asUser } from "@/lib/db";
import { todayInOslo } from "@/lib/data";
import { computeStatusChange } from "@/lib/tracker/status-logic";
import { firstSavedStatusId, topPosition } from "@/lib/tracker/queries";
import { isValidDateOnly } from "@/lib/tracker/dates";
import { isRating, type StatusCategory } from "@/lib/domain";
import { emptyToNull, safeUrl } from "@/lib/utils";
import { fail, ok, type ActionResult } from "./result";

function revalidateTracker(applicationId?: string) {
  revalidatePath("/tracker");
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  if (applicationId) revalidatePath(`/tracker/${applicationId}`);
}

const uuid = z.uuid();

/** Lagre en stilling fra feeden i trackeren (ett klikk). */
export async function saveJobToTracker(jobId: string): Promise<ActionResult<{ applicationId: string }>> {
  const t = await getTranslations("common");
  if (!uuid.safeParse(jobId).success) return fail(t("error"));
  const user = await requireUser();

  try {
    const applicationId = await asUser(user.id, async (sql) => {
      const [existing] = await sql.query<{ id: string }>(`select id from applications where job_id = $1`, [jobId]);
      if (existing) return existing.id;
      const statusId = await firstSavedStatusId(sql);
      if (!statusId) throw new Error("Mangler Lagret-status");
      const [created] = await sql.query<{ id: string }>(
        `insert into applications (user_id, job_id, status_id, board_position)
         values ($1, $2, $3, $4) returning id`,
        [user.id, jobId, statusId, await topPosition(sql, statusId)],
      );
      return created.id;
    });
    revalidateTracker();
    return ok({ applicationId });
  } catch {
    return fail(t("error"));
  }
}

const moveSchema = z.object({
  applicationId: z.uuid(),
  statusId: z.uuid(),
  position: z.number().optional(), // zod v4 avviser Infinity/NaN som standard
});

/** Flytt en søknad til en status (og evt. ny plass i kolonnen). */
export async function moveApplication(input: z.infer<typeof moveSchema>): Promise<ActionResult> {
  const t = await getTranslations("tracker");
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return fail(t("moveFailed"));
  const { applicationId, statusId, position } = parsed.data;
  const user = await requireUser();

  try {
    const changed = await asUser(user.id, async (sql) => {
      const [app] = await sql.query<{ status_id: string; applied_at: string | null; category: StatusCategory }>(
        `select a.status_id, a.applied_at::text as applied_at, s.category::text as category
           from applications a join application_statuses s on s.id = a.status_id
          where a.id = $1`,
        [applicationId],
      );
      const [target] = await sql.query<{ id: string; category: StatusCategory }>(
        `select id, category::text as category from application_statuses where id = $1`,
        [statusId],
      );
      if (!app || !target) throw new Error("Fant ikke søknad eller status");

      const patch = computeStatusChange(
        { currentStatusId: app.status_id, currentCategory: app.category, appliedAt: app.applied_at },
        target,
        new Date(),
        todayInOslo(),
      );
      const newPosition = position ?? (patch ? await topPosition(sql, statusId) : undefined);
      if (!patch && newPosition === undefined) return false;

      await sql.query(
        `update applications set
           status_id        = coalesce($2, status_id),
           last_activity_at = coalesce($3::timestamptz, last_activity_at),
           applied_at       = coalesce(applied_at, $4::date),
           board_position   = coalesce($5, board_position)
         where id = $1`,
        [applicationId, patch?.status_id ?? null, patch?.last_activity_at ?? null, patch?.applied_at ?? null, newPosition ?? null],
      );
      return true;
    });
    if (changed) revalidateTracker(applicationId);
    return ok();
  } catch {
    return fail(t("moveFailed"));
  }
}

const dateOrNull = (v: FormDataEntryValue | null) => {
  const s = emptyToNull(v);
  return s && isValidDateOnly(s) ? s : null;
};

export async function updateApplication(
  applicationId: string,
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations();
  if (!uuid.safeParse(applicationId).success) return fail(t("common.error"));

  const fieldErrors: Record<string, string> = {};
  for (const k of ["applied_at", "deadline", "next_step_at"]) {
    const raw = emptyToNull(formData.get(k));
    if (raw && !isValidDateOnly(raw)) fieldErrors[k] = t("job.errors.date");
  }
  for (const k of ["cv_url", "cover_letter_url"]) {
    const raw = emptyToNull(formData.get(k));
    if (raw && !safeUrl(raw)) fieldErrors[k] = t("job.errors.url");
  }
  if (Object.keys(fieldErrors).length) return fail(t("common.error"), fieldErrors);

  const user = await requireUser();
  try {
    await asUser(user.id, (sql) =>
      sql.query(
        `update applications set
           applied_at = $2, deadline = $3, next_step = $4, next_step_at = $5,
           cv_url = $6, cover_letter_url = $7, notes = $8
         where id = $1`,
        [
          applicationId,
          dateOrNull(formData.get("applied_at")),
          dateOrNull(formData.get("deadline")),
          emptyToNull(formData.get("next_step"))?.slice(0, 200) ?? null,
          dateOrNull(formData.get("next_step_at")),
          safeUrl(emptyToNull(formData.get("cv_url"))),
          safeUrl(emptyToNull(formData.get("cover_letter_url"))),
          emptyToNull(formData.get("notes"))?.slice(0, 10_000) ?? null,
        ],
      ),
    );
  } catch {
    return fail(t("common.error"));
  }
  revalidateTracker(applicationId);
  return ok();
}

const FIELD_TYPES = {
  applied_at: "date",
  deadline: "date",
  next_step: "text",
  next_step_at: "date",
  notes: "text",
  rating: "rating",
} as const;
export type EditableField = keyof typeof FIELD_TYPES;

/** Oppdater én celle i regnearket. Tom verdi = fjern. */
export async function updateApplicationField(
  applicationId: string,
  field: EditableField,
  value: string,
): Promise<ActionResult> {
  const t = await getTranslations();
  if (!uuid.safeParse(applicationId).success || !(field in FIELD_TYPES)) return fail(t("common.error"));
  const raw = value.trim();
  let clean: string | null = raw.length ? raw : null;
  if (FIELD_TYPES[field] === "date") {
    if (clean && !isValidDateOnly(clean)) return fail(t("job.errors.date"));
  } else if (FIELD_TYPES[field] === "rating") {
    if (clean && !isRating(clean)) return fail(t("common.error"));
  } else if (clean) {
    clean = clean.slice(0, field === "notes" ? 10_000 : 200);
  }

  const user = await requireUser();
  try {
    // Feltnavnet er hvitlistet over, så det er trygt å sette inn i SQL-en.
    await asUser(user.id, (sql) =>
      sql.query(`update applications set ${field} = $2 where id = $1`, [applicationId, clean]),
    );
  } catch {
    return fail(t("common.error"));
  }
  revalidateTracker(applicationId);
  return ok();
}

export async function addNote(applicationId: string, note: string): Promise<ActionResult> {
  const t = await getTranslations("common");
  const text = note.trim();
  if (!uuid.safeParse(applicationId).success || !text || text.length > 2000) return fail(t("error"));
  const user = await requireUser();
  try {
    await asUser(user.id, async (sql) => {
      await sql.query(
        `insert into application_events (application_id, user_id, type, note) values ($1, $2, 'note', $3)`,
        [applicationId, user.id, text],
      );
      await sql.query(`update applications set last_activity_at = now() where id = $1`, [applicationId]);
    });
  } catch {
    return fail(t("error"));
  }
  revalidateTracker(applicationId);
  return ok();
}

export async function setArchived(applicationId: string, archived: boolean): Promise<ActionResult> {
  const t = await getTranslations("common");
  if (!uuid.safeParse(applicationId).success) return fail(t("error"));
  const user = await requireUser();
  try {
    await asUser(user.id, (sql) =>
      sql.query(`update applications set archived = $2 where id = $1`, [applicationId, archived]),
    );
  } catch {
    return fail(t("error"));
  }
  revalidateTracker(applicationId);
  return ok();
}

export async function deleteApplication(applicationId: string) {
  if (!uuid.safeParse(applicationId).success) return;
  const user = await requireUser();
  await asUser(user.id, async (sql) => {
    const [app] = await sql.query<{ job_id: string; manual: boolean }>(
      `select a.job_id, (j.created_by is not null) as manual
         from applications a join jobs j on j.id = a.job_id where a.id = $1`,
      [applicationId],
    );
    await sql.query(`delete from applications where id = $1`, [applicationId]);
    // Manuelle stillinger hører til søknaden og slettes sammen med den.
    if (app?.manual) await sql.query(`delete from jobs where id = $1`, [app.job_id]);
  });
  revalidateTracker();
  redirect("/tracker");
}

export async function loadDemoData(): Promise<ActionResult<{ count: number }>> {
  const t = await getTranslations("tracker");
  const user = await requireUser();
  try {
    const [r] = await asUser(user.id, (sql) => sql.query<{ n: number }>(`select load_demo_applications() as n`));
    revalidateTracker();
    return ok({ count: Number(r?.n ?? 0) });
  } catch {
    return fail(t("demoFailed"));
  }
}
