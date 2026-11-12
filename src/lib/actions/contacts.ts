"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { asUser } from "@/lib/db";
import { emptyToNull, safeUrl } from "@/lib/utils";
import { fail, ok, type ActionResult } from "./result";

export async function saveContact(
  applicationId: string,
  contactId: string | null,
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("common");
  if (!z.uuid().safeParse(applicationId).success) return fail(t("error"));
  if (contactId && !z.uuid().safeParse(contactId).success) return fail(t("error"));

  const name = emptyToNull(formData.get("name"));
  const email = emptyToNull(formData.get("email"));
  if (!name || name.length > 200) return fail(t("error"), { name: t("error") });
  if (email && !z.email().safeParse(email).success) return fail(t("error"), { email: t("error") });

  const values = [
    name,
    emptyToNull(formData.get("role")),
    email,
    emptyToNull(formData.get("phone")),
    safeUrl(emptyToNull(formData.get("linkedin_url"))),
    emptyToNull(formData.get("notes")),
  ];

  const user = await requireUser();
  try {
    await asUser(user.id, (sql) =>
      contactId
        ? sql.query(
            `update contacts set name = $2, role = $3, email = $4, phone = $5, linkedin_url = $6, notes = $7
             where id = $1`,
            [contactId, ...values],
          )
        : sql.query(
            `insert into contacts (application_id, user_id, name, role, email, phone, linkedin_url, notes)
             values ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [applicationId, user.id, ...values],
          ),
    );
  } catch {
    return fail(t("error"));
  }

  revalidatePath(`/tracker/${applicationId}`);
  return ok();
}

export async function deleteContact(applicationId: string, contactId: string): Promise<ActionResult> {
  const t = await getTranslations("common");
  if (!z.uuid().safeParse(contactId).success) return fail(t("error"));
  const user = await requireUser();
  try {
    await asUser(user.id, (sql) => sql.query(`delete from contacts where id = $1`, [contactId]));
  } catch {
    return fail(t("error"));
  }
  revalidatePath(`/tracker/${applicationId}`);
  return ok();
}
