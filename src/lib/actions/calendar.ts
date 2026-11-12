"use server";

import { revalidatePath } from "next/cache";
import { getFormatter, getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { asUser } from "@/lib/db";
import { isCalendarEventType } from "@/lib/tracker/calendar";
import { dateOnlyToDate, isValidDateOnly } from "@/lib/tracker/dates";
import { emptyToNull } from "@/lib/utils";
import { fail, ok, type ActionResult } from "./result";

function revalidate(applicationId: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/tracker");
  if (applicationId) revalidatePath(`/tracker/${applicationId}`);
}

export async function addCalendarEvent(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = await getTranslations();
  const format = await getFormatter();
  const type = String(formData.get("type") ?? "");
  const date = emptyToNull(formData.get("date"));
  const time = emptyToNull(formData.get("time"));
  const applicationId = emptyToNull(formData.get("application_id"));
  const title = emptyToNull(formData.get("title"))?.slice(0, 200) ?? null;
  const notes = emptyToNull(formData.get("notes"))?.slice(0, 2000) ?? null;

  const fieldErrors: Record<string, string> = {};
  if (!isCalendarEventType(type)) fieldErrors.type = t("common.error");
  if (!date || !isValidDateOnly(date)) fieldErrors.date = t("job.errors.date");
  if (time && !/^\d{2}:\d{2}$/.test(time)) fieldErrors.time = t("calendar.errors.time");
  if (applicationId && !z.uuid().safeParse(applicationId).success) fieldErrors.application_id = t("common.error");
  if (Object.keys(fieldErrors).length) return fail(t("common.error"), fieldErrors);

  const user = await requireUser();
  try {
    await asUser(user.id, async (sql) => {
      await sql.query(
        `insert into calendar_events (user_id, application_id, type, title, date, start_time, notes)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [user.id, applicationId, type, title, date, time, notes],
      );
      if (applicationId) {
        // En ny avtale betyr kontakt med arbeidsgiveren: logg den og nullstill «ikke hørt noe».
        const label = title ?? t(`calendar.types.${type}`);
        const when =
          format.dateTime(dateOnlyToDate(date!), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) +
          (time ? ` ${t("calendar.at", { time })}` : "");
        await sql.query(
          `insert into application_events (application_id, user_id, type, note) values ($1, $2, 'note', $3)`,
          [applicationId, user.id, t("calendar.historyNote", { label, when })],
        );
        await sql.query(`update applications set last_activity_at = now() where id = $1`, [applicationId]);
      }
    });
  } catch {
    return fail(t("common.error"));
  }
  revalidate(applicationId);
  return ok();
}

export async function deleteCalendarEvent(eventId: string): Promise<ActionResult> {
  const t = await getTranslations("common");
  if (!z.uuid().safeParse(eventId).success) return fail(t("error"));
  const user = await requireUser();
  let applicationId: string | null = null;
  try {
    await asUser(user.id, async (sql) => {
      const [row] = await sql.query<{ application_id: string | null }>(
        `delete from calendar_events where id = $1 returning application_id`,
        [eventId],
      );
      applicationId = row?.application_id ?? null;
    });
  } catch {
    return fail(t("error"));
  }
  revalidate(applicationId);
  return ok();
}
