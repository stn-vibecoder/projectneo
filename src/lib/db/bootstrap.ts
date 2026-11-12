/**
 * Setter opp en Postgres-database (PGlite) med samme skjema som Supabase:
 * auth-etterligning, alle migrasjoner (kun nye kjøres), seed én gang og
 * en lokal bruker. Brukes av lokal modus og av databasetestene.
 */
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { LOCAL_USER } from "./local-user";

export { LOCAL_USER };

export async function bootstrap(db: PGlite, root: string, opts: { seed?: boolean; localUser?: boolean } = {}) {
  const supa = path.join(root, "supabase");
  await db.exec(readFileSync(path.join(supa, "local", "auth-stub.sql"), "utf8"));
  await db.exec(`create table if not exists public._local_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);

  const applied = new Set(
    (await db.query<{ name: string }>(`select name from public._local_migrations`)).rows.map((r) => r.name),
  );

  const migDir = path.join(supa, "migrations");
  for (const file of readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(readFileSync(path.join(migDir, file), "utf8"));
      await tx.query(`insert into public._local_migrations (name) values ($1)`, [file]);
    });
  }
  // Nye tabeller fra migrasjonene skal også være tilgjengelige for rollene.
  await db.exec(`grant all on all tables in schema public to anon, authenticated, service_role`);

  if (opts.seed && !applied.has("__seed")) {
    await db.exec(readFileSync(path.join(supa, "seed.sql"), "utf8"));
    await db.query(`insert into public._local_migrations (name) values ('__seed')`);
  }

  if (opts.localUser) {
    await db.query(`insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing`, [
      LOCAL_USER.id,
      LOCAL_USER.email,
    ]);
  }
}
