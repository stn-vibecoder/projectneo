/**
 * Kjører migrasjoner + seed mot en Postgres i minnet (PGlite) med en
 * forenklet Supabase-auth, og sjekker triggere og RLS.
 *
 *   npm run db:verify
 *
 * Krever ingen Supabase-konto eller Docker.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { bootstrap } from "../src/lib/db/bootstrap";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const db = new PGlite();


let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}`, detail ?? "");
  }
}

async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

async function main() {
  // Samme oppsett som lokal modus: auth-etterligning + migrasjoner + seed.
  await bootstrap(db, root, { seed: true });
  console.log("migrasjoner og seed ok");
  // Seed skal tåle å kjøres flere ganger.
  await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
  console.log("seed ok (kjørt to ganger)");

  const A = "00000000-0000-0000-0000-00000000000a";
  const B = "00000000-0000-0000-0000-00000000000b";
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${A}', 'a@test.no', '{"full_name":"Ada Test"}'),
      ('${B}', 'b@test.no', '{}');
  `);

  console.log("\nRegistrering");
  const statuses = await db.query<{ n: number }>(
    `select count(*)::int as n from application_statuses where user_id = $1`, [A]);
  check("10 standardstatuser opprettes", statuses.rows[0].n === 10, statuses.rows);
  const prof = await db.query<{ display_name: string }>(`select display_name from profiles where id = $1`, [A]);
  check("profil får navn fra metadata", prof.rows[0]?.display_name === "Ada Test", prof.rows);

  const jobs = await db.query<{ n: number }>(`select count(*)::int as n from jobs where source='seed'`);
  check("36 seed-stillinger", jobs.rows[0].n === 36, jobs.rows);

  console.log("\nDemodata og statuslogg");
  const demo = await asUser(A, () => db.query<{ n: number }>(`select load_demo_applications() as n`));
  check("demodata lager 14 søknader", demo.rows[0].n === 14, demo.rows);
  const demoAgain = await asUser(A, () => db.query<{ n: number }>(`select load_demo_applications() as n`));
  check("demodata kjøres ikke to ganger", demoAgain.rows[0].n === 0);

  const offerEvents = await db.query<{ type: string; to_category: string; created_at: Date }>(
    `select e.type, e.to_category, e.created_at from application_events e
       join applications a on a.id = e.application_id
       join jobs j on j.id = a.job_id
      where j.dedupe_key = 'seed-14' and a.user_id = $1 order by e.created_at`, [A]);
  check("historikk har 5 hendelser for tilbud-søknaden", offerEvents.rows.length === 5, offerEvents.rows);
  const times = offerEvents.rows.map((r) => new Date(r.created_at).getTime());
  check("historikken er kronologisk bakoverdatert",
    times.every((t, i) => i === 0 || t >= times[i - 1]) && times[0] < Date.now() - 86_400_000 * 10, offerEvents.rows);

  console.log("\nRLS");
  const bSeesA = await asUser(B, () => db.query<{ n: number }>(`select count(*)::int as n from applications`));
  check("B ser ingen av A sine søknader", bSeesA.rows[0].n === 0, bSeesA.rows);
  const bEvents = await asUser(B, () => db.query<{ n: number }>(`select count(*)::int as n from application_events`));
  check("B ser ingen av A sine hendelser", bEvents.rows[0].n === 0);
  const aSees = await asUser(A, () => db.query<{ n: number }>(`select count(*)::int as n from applications`));
  check("A ser sine 14 søknader", aSees.rows[0].n === 14);
  const bJobs = await asUser(B, () => db.query<{ n: number }>(`select count(*)::int as n from jobs`));
  check("B ser felles stillinger", bJobs.rows[0].n === 36);

  // A lager en privat manuell stilling
  const priv = await asUser(A, async () => {
    const c = await db.query<{ id: string }>(
      `insert into companies (name, created_by) values ('Mitt Lille AS', $1) returning id`, [A]);
    const j = await db.query<{ id: string }>(
      `insert into jobs (company_id, title, cities, created_by) values ($1, 'Manuell stilling', '{oslo}', $2) returning id`,
      [c.rows[0].id, A]);
    return j.rows[0].id;
  });
  const bPriv = await asUser(B, () => db.query(`select id from jobs where id = $1`, [priv]));
  check("B ser ikke A sin manuelle stilling", bPriv.rows.length === 0);

  // B prøver å lage søknad på A sin private stilling
  let blocked = false;
  try {
    await asUser(B, async () => {
      const s = await db.query<{ id: string }>(
        `select id from application_statuses where user_id = $1 and category = 'saved'`, [B]);
      await db.query(`insert into applications (user_id, job_id, status_id) values ($1, $2, $3)`,
        [B, priv, s.rows[0].id]);
    });
  } catch {
    blocked = true;
  }
  check("B kan ikke søke på A sin private stilling", blocked);

  // B prøver å bruke A sin status
  blocked = false;
  try {
    await asUser(B, async () => {
      const s = await db.query<{ id: string }>(
        `select id from application_statuses where user_id = $1 limit 1`, [A]);
      const j = await db.query<{ id: string }>(`select id from jobs where dedupe_key = 'seed-05'`);
      await db.query(`insert into applications (user_id, job_id, status_id) values ($1, $2, $3)`,
        [B, j.rows[0].id, s.rows[0]?.id ?? "00000000-0000-0000-0000-000000000000"]);
    });
  } catch {
    blocked = true;
  }
  check("B kan ikke bruke A sin status", blocked);

  // B kan ikke forfalske statuslogg
  blocked = false;
  try {
    await asUser(B, async () => {
      const a = await db.query<{ id: string }>(`select id from applications where user_id = $1 limit 1`, [A]);
      await db.query(
        `insert into application_events (application_id, user_id, type) values ($1, $2, 'status_changed')`,
        [a.rows[0]?.id ?? A, B]);
    });
  } catch {
    blocked = true;
  }
  check("B kan ikke skrive hendelser", blocked);

  // A kan ikke endre felles stillinger
  const upd = await asUser(A, () =>
    db.query(`update jobs set title = 'hacket' where source = 'seed' returning id`));
  check("A kan ikke endre felles stillinger", upd.rows.length === 0);

  // Status i bruk kan ikke slettes
  blocked = false;
  try {
    await asUser(A, () =>
      db.query(`delete from application_statuses where user_id = $1 and category = 'applied'`, [A]));
  } catch {
    blocked = true;
  }
  check("status i bruk kan ikke slettes", blocked);

  console.log("\nKalender");
  await asUser(A, async () => {
    const a = await db.query<{ id: string }>(`select id from applications where user_id = $1 limit 1`, [A]);
    await db.query(
      `insert into calendar_events (user_id, application_id, type, date, start_time) values ($1, $2, 'interview', '2026-12-01', '14:00')`,
      [A, a.rows[0].id],
    );
  });
  const aEvents = await asUser(A, () => db.query<{ n: number }>(`select count(*)::int as n from calendar_events`));
  check("A ser sin kalenderhendelse", aEvents.rows[0].n === 1);
  const bCal = await asUser(B, () => db.query<{ n: number }>(`select count(*)::int as n from calendar_events`));
  check("B ser ikke A sin kalender", bCal.rows[0].n === 0);
  blocked = false;
  try {
    await asUser(B, async () => {
      const a = await db.query<{ id: string }>(`select id from applications where user_id = $1 limit 1`, [A]);
      await db.query(
        `insert into calendar_events (user_id, application_id, type, date) values ($1, $2, 'interview', '2026-12-01')`,
        [B, a.rows[0]?.id ?? "00000000-0000-0000-0000-000000000000"],
      );
    });
  } catch {
    blocked = true;
  }
  check("B kan ikke koble hendelse til A sin søknad", blocked);
  const bOwn = await asUser(B, () =>
    db.query(`insert into calendar_events (user_id, type, date) values ($1, 'info', '2026-12-02') returning id`, [B]),
  );
  check("B kan lage frittstående hendelse", bOwn.rows.length === 1);

  console.log("\nWatchlist og rating");
  const comp = await db.query<{ id: string }>(`insert into companies (name) values ('Felles Bank ASA') returning id`);
  await asUser(A, () => db.query(`insert into watchlist (user_id, company_id) values ($1, $2)`, [A, comp.rows[0].id]));
  const bWatch = await asUser(B, () => db.query<{ n: number }>(`select count(*)::int as n from watchlist`));
  check("B ser ikke A sin watchlist", bWatch.rows[0].n === 0);
  blocked = false;
  try {
    await asUser(B, () => db.query(`insert into watchlist (user_id, company_id) values ($1, $2)`, [A, comp.rows[0].id]));
  } catch {
    blocked = true;
  }
  check("B kan ikke legge til i A sin watchlist", blocked);
  blocked = false;
  try {
    await asUser(A, () => db.query(`update applications set rating = 'ZZZ' where user_id = $1`, [A]));
  } catch {
    blocked = true;
  }
  check("ugyldig rating avvises", blocked);
  const rated = await asUser(A, () => db.query(`update applications set rating = 'AAA' where user_id = $1 returning id`, [A]));
  check("gyldig rating lagres", rated.rows.length > 0);

  console.log("\nNormalisering");
  const norm = await db.query<{ a: string; b: string }>(
    `select normalize_company_name('Nordvik Capital ASA') a, normalize_company_name('Hudson & Pine Partners, LLC') b`);
  const alias = await db.query<{ a: string }>(`select normalize_company_name('Boston Consulting Group (BCG)') a`);
  check("parenteser i selskapsnavn ignoreres", alias.rows[0].a === "boston consulting group", alias.rows);
  check("selskapsnavn normaliseres", norm.rows[0].a === "nordvik capital" && norm.rows[0].b === "hudson pine partners", norm.rows);

  console.log(failures === 0 ? "\nAlt OK ✅" : `\n${failures} feil ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
