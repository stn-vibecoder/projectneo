import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LOCAL_USER } from "@/lib/db/local-user";
import { authMode, isAdminEmail, isAllowedEmail } from "@/lib/env";
import { getUser as getSupabaseUser } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/** Se `authMode()` i src/lib/env.ts: «local», «optional» eller «required». */
export const AUTH_MODE = authMode();

/**
 * Den faste brukeren som eier de felles kildene. Lokalt er det også deg.
 * På nett logger ingen inn som denne brukeren; administratorer styrer kildene.
 */
export const SOURCES_OWNER_ID = LOCAL_USER.id;

/** Innlogget bruker, eller null for besøkende som ikke er logget inn. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  await connection();
  if (AUTH_MODE === "local") return { id: LOCAL_USER.id, email: null };
  const user = await getSupabaseUser().catch(() => null);
  if (!user || !isAllowedEmail(user.email)) return null;
  return { id: user.id, email: user.email ?? null };
});

/** Innlogget bruker; sender til /login hvis ingen er innlogget. */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
});

/** Kan styre de felles kildene: alle lokalt, ellers bare e-poster i ADMIN_EMAILS. */
export function isAdmin(user: CurrentUser | null): boolean {
  if (!user) return false;
  return AUTH_MODE === "local" || isAdminEmail(user.email);
}

/**
 * For alt under Kilder. Sjekker at brukeren er administrator, og returnerer
 * eieren av de felles kildene, så databasekallene (med RLS) gjelder dem.
 */
export const requireSourceAdmin = cache(async (): Promise<CurrentUser> => {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/feed");
  return { id: SOURCES_OWNER_ID, email: user.email };
});
