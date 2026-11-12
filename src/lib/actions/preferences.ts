"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { asUser, pgArray } from "@/lib/db";
import { isCity, isIndustry, isPeriod } from "@/lib/domain";
import { emptyToNull } from "@/lib/utils";
import { fail, ok, type ActionResult } from "./result";

function readPreferences(formData: FormData) {
  const strings = (k: string) => formData.getAll(k).filter((v): v is string => typeof v === "string");
  return {
    cities: [...new Set(strings("cities").filter(isCity))],
    industries: [...new Set(strings("industries").filter(isIndustry))],
    periods: [...new Set(strings("periods").filter(isPeriod))],
  };
}

async function save(formData: FormData, markOnboarded: boolean) {
  const user = await requireUser();
  const prefs = readPreferences(formData);
  await asUser(user.id, async (sql) => {
    await sql.query(
      `insert into user_preferences (user_id, cities, industries, periods)
       values ($1, $2::city[], $3::industry[], $4::internship_period[])
       on conflict (user_id) do update
         set cities = excluded.cities, industries = excluded.industries, periods = excluded.periods`,
      [user.id, pgArray(prefs.cities), pgArray(prefs.industries), pgArray(prefs.periods)],
    );
    await sql.query(
      `update profiles set study_field = $2,
              onboarded_at = case when $3::boolean then coalesce(onboarded_at, now()) else onboarded_at end
        where id = $1`,
      [user.id, emptyToNull(formData.get("study_field"))?.slice(0, 120) ?? null, markOnboarded],
    );
  });
}

export async function completeOnboarding(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = await getTranslations();
  if (readPreferences(formData).cities.length === 0) return fail(t("onboarding.citiesRequired"));
  try {
    await save(formData, true);
  } catch {
    return fail(t("common.error"));
  }
  revalidatePath("/", "layout");
  redirect("/feed");
}

export async function updatePreferences(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = await getTranslations();
  if (readPreferences(formData).cities.length === 0) return fail(t("onboarding.citiesRequired"));
  try {
    await save(formData, false);
  } catch {
    return fail(t("common.error"));
  }
  revalidatePath("/", "layout");
  return ok();
}

export async function updateProfile(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const t = await getTranslations();
  const days = Number(formData.get("ghosting_days"));
  if (!Number.isInteger(days) || days < 1 || days > 180) return fail(t("common.error"));
  const user = await requireUser();
  try {
    await asUser(user.id, (sql) =>
      sql.query(`update profiles set display_name = $2, ghosting_days = $3 where id = $1`, [
        user.id,
        emptyToNull(formData.get("display_name"))?.slice(0, 80) ?? null,
        days,
      ]),
    );
  } catch {
    return fail(t("common.error"));
  }
  revalidatePath("/", "layout");
  return ok();
}
