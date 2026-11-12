import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LOCAL_USER } from "@/lib/db/local-user";
import { isAllowedEmail, isLoginEnabled } from "@/lib/env";
import { requireUser as requireSupabaseUser } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/**
 * «local» (standard, også på Vercel): én fast bruker, ingen innlogging.
 * «supabase»: innlogging med Supabase Auth, slås på med NEXT_PUBLIC_REQUIRE_LOGIN=true.
 */
export const AUTH_MODE: "local" | "supabase" = isLoginEnabled() ? "supabase" : "local";

/** Innlogget bruker. Sender til /login hvis ingen er innlogget eller e-posten ikke er godkjent. */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  await connection();
  if (AUTH_MODE === "local") {
    return { id: LOCAL_USER.id, email: null };
  }
  const user = await requireSupabaseUser();
  if (!isAllowedEmail(user.email)) redirect("/login?error=forbidden");
  return { id: user.id, email: user.email ?? null };
});
