"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { asUser, type Sql } from "@/lib/db";
import { STATUS_CATEGORIES, STATUS_COLOR_NAMES, type StatusCategory } from "@/lib/domain";
import { fail, ok, type ActionResult } from "./result";

const statusInput = z.object({
  label: z.string().trim().min(1).max(40),
  category: z.enum(STATUS_CATEGORIES),
  color: z.enum(STATUS_COLOR_NAMES as [string, ...string[]]),
});

function revalidate() {
  revalidatePath("/settings");
  revalidatePath("/tracker");
  revalidatePath("/dashboard");
}

/** Feil med en melding som kan vises til brukeren. */
class UserError extends Error {}

async function otherSavedCount(sql: Sql, exceptId: string) {
  const [r] = await sql.query<{ n: number }>(
    `select count(*)::int as n from application_statuses where category = 'saved' and id <> $1`,
    [exceptId],
  );
  return r?.n ?? 0;
}

async function run(fn: () => Promise<void>): Promise<ActionResult> {
  const t = await getTranslations("common");
  try {
    await fn();
  } catch (e) {
    return fail(e instanceof UserError ? e.message : t("error"));
  }
  revalidate();
  return ok();
}

export async function updateStatus(
  id: string,
  input: { label: string; category: StatusCategory; color: string },
): Promise<ActionResult> {
  const t = await getTranslations();
  const parsed = statusInput.safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(id).success) return fail(t("common.error"));
  const user = await requireUser();

  return run(() =>
    asUser(user.id, async (sql) => {
      if (parsed.data.category !== "saved" && (await otherSavedCount(sql, id)) === 0) {
        throw new UserError(t("settings.lastOfCategory"));
      }
      await sql.query(`update application_statuses set label = $2, category = $3, color = $4 where id = $1`, [
        id,
        parsed.data.label,
        parsed.data.category,
        parsed.data.color,
      ]);
    }),
  );
}

export async function addStatus(input: { label: string; category: StatusCategory; color: string }): Promise<ActionResult> {
  const t = await getTranslations("common");
  const parsed = statusInput.safeParse(input);
  if (!parsed.success) return fail(t("error"));
  const user = await requireUser();

  return run(() =>
    asUser(user.id, async (sql) => {
      await sql.query(
        `insert into application_statuses (user_id, label, category, color, position)
         values ($1, $2, $3, $4, (select coalesce(max(position), -1) + 1 from application_statuses))`,
        [user.id, parsed.data.label, parsed.data.category, parsed.data.color],
      );
    }),
  );
}

export async function deleteStatus(id: string): Promise<ActionResult> {
  const t = await getTranslations();
  if (!z.uuid().safeParse(id).success) return fail(t("common.error"));
  const user = await requireUser();

  return run(() =>
    asUser(user.id, async (sql) => {
      const [status] = await sql.query<{ category: StatusCategory }>(
        `select category::text as category from application_statuses where id = $1`,
        [id],
      );
      if (!status) throw new Error("Fant ikke status");
      if (status.category === "saved" && (await otherSavedCount(sql, id)) === 0) {
        throw new UserError(t("settings.lastOfCategory"));
      }
      const [used] = await sql.query<{ n: number }>(
        `select count(*)::int as n from applications where status_id = $1`,
        [id],
      );
      if ((used?.n ?? 0) > 0) throw new UserError(t("settings.statusInUse"));
      await sql.query(`delete from application_statuses where id = $1`, [id]);
    }),
  );
}

/** Flytt en status ett hakk opp eller ned (bytter plass med naboen). */
export async function moveStatus(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const user = await requireUser();
  return run(() =>
    asUser(user.id, async (sql) => {
      const list = await sql.query<{ id: string }>(
        `select id from application_statuses order by position, created_at`,
      );
      const i = list.findIndex((s) => s.id === id);
      const j = direction === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      // Skriv sammenhengende posisjoner, så duplikater ikke skaper rot.
      for (const [idx, s] of list.entries()) {
        await sql.query(`update application_statuses set position = $2 where id = $1 and position <> $2`, [s.id, idx]);
      }
    }),
  );
}
