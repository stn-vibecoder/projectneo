import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { LOCAL_USER } from "@/lib/db/bootstrap";

export type CurrentUser = { id: string; email: string | null };

/**
 * Innlogget bruker.
 *
 * LOKAL MODUS: alle forespørsler kjører som én fast lokal bruker, uten
 * innlogging. Når Supabase kobles på, hentes brukeren fra Supabase Auth
 * her (se src/lib/supabase/server.ts), og resten av appen er uendret.
 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  await connection();
  return { id: LOCAL_USER.id, email: null };
});

export const AUTH_MODE = "local" as "local" | "supabase";
