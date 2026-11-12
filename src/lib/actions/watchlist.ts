"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { asUser } from "@/lib/db";
import { fail, ok, type ActionResult } from "./result";

/** Følg / slutt å følge et selskap. */
export async function setWatched(companyId: string, watched: boolean): Promise<ActionResult> {
  const t = await getTranslations("common");
  if (!z.uuid().safeParse(companyId).success) return fail(t("error"));
  const user = await requireUser();
  try {
    await asUser(user.id, (sql) =>
      watched
        ? sql.query(`insert into watchlist (user_id, company_id) values ($1, $2) on conflict do nothing`, [user.id, companyId])
        : sql.query(`delete from watchlist where company_id = $1`, [companyId]),
    );
  } catch {
    return fail(t("error"));
  }
  revalidatePath("/feed");
  revalidatePath("/dashboard");
  revalidatePath("/jobs", "layout");
  return ok();
}
