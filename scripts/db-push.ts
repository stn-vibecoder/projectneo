/**
 * Kjører databasemigrasjonene mot Supabase (eller en annen Postgres).
 *
 *   DATABASE_URL=... npm run db:push
 *
 * Kjøres automatisk før hvert bygg på Vercel (se «build» i package.json;
 * uten database gjør skriptet ingenting), så skjemaet alltid er oppdatert når en ny versjon går ut.
 * Bare nye migrasjoner kjøres. En lås hindrer at to bygg migrerer samtidig.
 *
 * Kun for testing mot en tom Postgres uten Supabase:
 *   --auth-stub     legg inn etterligningen av Supabase-auth først
 *   (den faste systembrukeren og standardkildene opprettes alltid)
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { PG_TYPES, connectionOptions, databaseUrl } from "../src/lib/db/url";

const url = databaseUrl();
const args = new Set(process.argv.slice(2));

if (!url) {
  if (process.env.VERCEL) {
    console.error(
      "\n✗ Fant ingen database (DATABASE_URL / POSTGRES_URL).\n" +
        "  Koble på Supabase i Vercel: prosjektet → Storage → Create Database → Supabase.\n",
    );
    process.exit(1);
  }
  console.log("DATABASE_URL er ikke satt: lokal modus, ingen migrering mot Supabase.");
  process.exit(0);
}

const root = process.cwd();
const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";
const conn = connectionOptions(url);
const sql = postgres(conn.url, { ssl: conn.ssl, types: PG_TYPES, prepare: false, max: 1, onnotice: () => {} });

async function main() {
  if (args.has("--auth-stub")) {
    await sql.unsafe(readFileSync(path.join(root, "supabase", "local", "auth-stub.sql"), "utf8"));
  }

  const [{ ok }] = await sql<{ ok: boolean }[]>`select to_regclass('auth.users') is not null as ok`;
  if (!ok) throw new Error("Fant ikke auth.users. Er DATABASE_URL en Supabase-database?");

  // Migrasjonsloggen ligger i et eget skjema som ikke er synlig via Supabase sitt API.
  await sql.unsafe(`
    create schema if not exists app_private;
    revoke all on schema app_private from public;
    create table if not exists app_private.migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const files = readdirSync(path.join(root, "supabase", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('internship-portal-migrations'))`;
    const applied = new Set((await tx<{ name: string }[]>`select name from app_private.migrations`).map((r) => r.name));
    for (const file of files) {
      if (applied.has(file)) continue;
      console.log(`→ ${file}`);
      await tx.unsafe(readFileSync(path.join(root, "supabase", "migrations", file), "utf8"));
      await tx`insert into app_private.migrations (name) values (${file})`;
      count++;
    }
    // Nye tabeller skal være tilgjengelige for rollene (RLS bestemmer hva hver bruker ser).
    await tx.unsafe(`
      grant usage on schema public to anon, authenticated, service_role;
      grant all on all tables in schema public to authenticated, service_role;
      grant usage, select on all sequences in schema public to authenticated, service_role;
    `);
  });

  // Den faste systembrukeren eier de felles kildene (og er «deg» uten innlogging).
  {
    await sql`insert into auth.users (id, email) values (${LOCAL_USER_ID}, 'student@lokal')
              on conflict (id) do nothing`;

    // Standardkildene legges inn én gang. Sletter du en kilde i appen, kommer den ikke tilbake.
    const [done] = await sql`select 1 from app_private.migrations where name = '__default_sources'`;
    if (!done) {
      const list = readFileSync(path.join(root, "supabase", "default-sources.json"), "utf8");
      const insert = readFileSync(path.join(root, "supabase", "default-sources.sql"), "utf8");
      const res = await sql.unsafe(insert, [LOCAL_USER_ID, list]);
      await sql`insert into app_private.migrations (name) values ('__default_sources')`;
      console.log(`✓ ${res.count} standardkilder lagt inn.`);
    }
  }

  console.log(count ? `✓ ${count} migrasjon(er) kjørt.` : "✓ Databasen er oppdatert.");
}

main()
  .catch((e) => {
    console.error("✗ Migrering feilet:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
