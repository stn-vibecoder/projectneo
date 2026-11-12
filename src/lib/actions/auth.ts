"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL, isAllowedEmail } from "@/lib/env";

export type AuthState = { error?: string; message?: string } | null;

async function origin() {
  const h = await headers();
  return h.get("origin") ?? SITE_URL;
}

/** Bare relative stier, så ?next= ikke kan sende brukeren til en annen side. */
function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

const credentials = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function signInWithPassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("auth");
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: t("invalidCredentials") };
  if (!isAllowedEmail(parsed.data.email)) return { error: t("forbidden") };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return { error: t("emailNotConfirmed") };
    if (error.code === "invalid_credentials") return { error: t("invalidCredentials") };
    return { error: t("genericError") };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("auth");
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: t("passwordHint") };
  // Personlig app: bare godkjente e-poster kan lage konto.
  if (!isAllowedEmail(parsed.data.email)) return { error: t("forbidden") };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${await origin()}/auth/callback?next=/onboarding` },
  });
  if (error) return { error: error.message || t("genericError") };
  if (data.session) redirect("/onboarding");
  return { message: t("checkEmail") };
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Ut til stillingene, som er åpne for alle.
  redirect("/feed");
}
