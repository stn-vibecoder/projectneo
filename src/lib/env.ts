export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/**
 * E-postadresser som får logge inn (kommaseparert i ALLOWED_EMAILS).
 * Appen er personlig: uten liste slipper ingen inn når den ligger på nett.
 */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.trim().toLowerCase());
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function isSupabaseConfigured() {
  return SUPABASE_URL.startsWith("http") && SUPABASE_KEY.length > 20;
}

/**
 * Innlogging er AV som standard, også på nett: appen bruker én fast bruker,
 * og alle med lenken kommer inn. Slå på med NEXT_PUBLIC_REQUIRE_LOGIN=true
 * (krever Supabase-nøklene og ALLOWED_EMAILS).
 */
export function isLoginEnabled() {
  return process.env.NEXT_PUBLIC_REQUIRE_LOGIN === "true" && isSupabaseConfigured();
}
