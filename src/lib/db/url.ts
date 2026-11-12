/**
 * Tilkoblingsstreng til Postgres. DATABASE_URL, eller POSTGRES_URL som
 * Vercel sin Supabase-integrasjon legger inn automatisk (eventuelt med prefiks).
 */
export function databaseUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.POSTGRES_URL) return env.POSTGRES_URL;
  // Vercel kan legge på et eget prefiks, f.eks. STORAGE_POSTGRES_URL.
  const key = Object.keys(env)
    .filter((k) => /(^|_)POSTGRES_URL$/.test(k) && env[k])
    .sort()[0];
  return key ? env[key]! : "";
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

/**
 * JSON-parametre skal oppføre seg som i PGlite: en ferdig JSON-tekst
 * (f.eks. JSON.stringify(...) med ::jsonb) sendes som den er, i stedet for
 * å bli pakket inn som en JSON-streng. Brukes av postgres.js.
 */
const serializeJson = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));
export const PG_TYPES = {
  json: { to: 114, from: [114], serialize: serializeJson, parse: (v: string) => JSON.parse(v) },
  jsonb: { to: 3802, from: [3802], serialize: serializeJson, parse: (v: string) => JSON.parse(v) },
};
