import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";

export async function createClient() {
  // Les cookies først: da vet Next.js at siden er dynamisk og prøver ikke å forhåndsrendre den.
  const cookieStore = await cookies();
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase er ikke konfigurert. Se .env.example og README.");
  }
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Kalt fra en Server Component: proxy.ts tar seg av sesjonsfornying.
        }
      },
    },
  });
}

/** Innlogget bruker (verifisert mot Supabase Auth), én gang per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** Som getUser, men sender til /login hvis ingen er innlogget. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
