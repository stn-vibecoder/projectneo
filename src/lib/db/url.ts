/**
 * Tilkoblingsstreng til Postgres. DATABASE_URL, eller POSTGRES_URL som
 * Vercel sin Supabase-integrasjon legger inn automatisk.
 */
export function databaseUrl(): string {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

/**
 * Gjør strengen klar for postgres.js: fjerner parametre den ikke forstår
 * (f.eks. «supa=base-pooler.x» fra Vercel) og slår på SSL for alt som ikke
 * kjører på maskinen selv.
 */
export function connectionOptions(raw: string): { url: string; ssl: false | "require" } {
  const u = new URL(raw);
  const local = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  const sslmode = u.searchParams.get("sslmode");
  for (const key of [...u.searchParams.keys()]) u.searchParams.delete(key);
  return { url: u.toString(), ssl: local || sslmode === "disable" ? false : "require" };
}
