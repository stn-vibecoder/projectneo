// NEXT_PUBLIC_* settes av Vercel sin Supabase-integrasjon; de uten prefiks er reserve på serveren.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

const emailList = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/**
 * Bare for «required»-modus: e-poster som får logge inn (ALLOWED_EMAILS).
 * Tom liste = alle kan lage konto.
 */
export function allowedEmails(): string[] {
  return emailList(process.env.ALLOWED_EMAILS);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  const list = allowedEmails();
  if (list.length === 0) return true;
  return Boolean(email) && list.includes(email!.trim().toLowerCase());
}

/** Administratorer (ADMIN_EMAILS): styrer de felles kildene. */
export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && emailList(process.env.ADMIN_EMAILS).includes(email!.trim().toLowerCase());
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function isSupabaseConfigured() {
  return SUPABASE_URL.startsWith("http") && SUPABASE_KEY.length > 20;
}

/**
 * Innloggingsmodus:
 * - «local»: ingen innlogging, én fast bruker (lokalt, eller NEXT_PUBLIC_LOGIN=off).
 * - «optional» (standard når Supabase er koblet til): alle kan se stillingene,
 *   men må logge inn for å lagre og bruke trackeren. Hver bruker har egne data.
 * - «required» (NEXT_PUBLIC_LOGIN=required): må logge inn for alt.
 */
export type AuthMode = "local" | "optional" | "required";

export function authMode(): AuthMode {
  if (!isSupabaseConfigured()) return "local";
  const v = process.env.NEXT_PUBLIC_LOGIN;
  if (v === "off") return "local";
  if (v === "required" || process.env.NEXT_PUBLIC_REQUIRE_LOGIN === "true") return "required";
  return "optional";
}

/** Sider som er åpne uten innlogging. Alt annet sender til /login. */
const PUBLIC_PREFIXES = ["/feed", "/login", "/auth", "/api/cron"];
export function isPublicPath(pathname: string, mode: AuthMode): boolean {
  const match = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  if (mode === "required") return ["/login", "/auth", "/api/cron"].some(match);
  // Stillingssider er åpne, men «Legg til stilling» krever innlogging.
  if (/^\/jobs\/[0-9a-f-]{36}$/i.test(pathname)) return true;
  return pathname === "/" || PUBLIC_PREFIXES.some(match);
}
