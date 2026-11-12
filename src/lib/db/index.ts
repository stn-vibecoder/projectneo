import "server-only";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { connection } from "next/server";
import { PGlite } from "@electric-sql/pglite";
import { wrap, type Sql } from "./sql";

export { pgArray, type Sql } from "./sql";
import { bootstrap } from "./bootstrap";

/**
 * Databasetilgang.
 *
 * LOKAL MODUS (nå): Postgres kjører inne i Node via PGlite, med data i
 * .data/pglite. Ingen konto eller installasjon trengs.
 *
 * Senere kobles samme SQL mot Supabase (Postgres) med en vanlig
 * tilkoblingsstreng. All SQL kjøres som rollen «authenticated» med
 * brukerens id satt, akkurat som i Supabase, så RLS gjelder i begge.
 */

// Oppdiktede teststillinger lastes bare inn hvis LOCAL_SEED=true.
const SEED = process.env.LOCAL_SEED === "true";

const DATA_DIR = process.env.LOCAL_DB_DIR ?? path.join(process.cwd(), ".data", "pglite");

const g = globalThis as typeof globalThis & {
  __pglite?: Promise<PGlite>;
  __migrations?: string;
  __migrating?: Promise<void>;
};

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const migrationList = () => readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort().join("|");

async function open(): Promise<PGlite> {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = await PGlite.create(DATA_DIR);
  await bootstrap(db, process.cwd(), { seed: SEED, localUser: true });
  g.__migrations = migrationList();
  return db;
}

async function getDb(): Promise<PGlite> {
  // Gjenbrukes på tvers av hot reload i utvikling.
  g.__pglite ??= open().catch((e) => {
    g.__pglite = undefined;
    throw e;
  });
  const db = await g.__pglite;
  // Nye migrasjonsfiler tas i bruk uten at serveren må startes på nytt.
  if (process.env.NODE_ENV !== "production" && migrationList() !== g.__migrations) {
    // Lås: samtidige forespørsler skal vente på samme oppdatering, ikke kjøre den to ganger.
    g.__migrating ??= bootstrap(db, process.cwd(), { seed: SEED, localUser: true })
      .then(() => {
        g.__migrations = migrationList();
      })
      .finally(() => {
        g.__migrating = undefined;
      });
    await g.__migrating;
  }
  return db;
}

/**
 * Kjører `fn` i én transaksjon som innlogget bruker (RLS gjelder).
 * Kaster feil -> alt rulles tilbake.
 */
export async function asUser<T>(userId: string, fn: (sql: Sql) => Promise<T>): Promise<T> {
  await connection(); // Databasekall skal aldri skje under bygging/forhåndsrendring.
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await tx.exec(`set local role authenticated`);
    return fn(wrap(tx));
  });
}

/**
 * Kjører som tjenesterolle (uten RLS). KUN for serverjobber som henting
 * av stillinger, aldri med data styrt av brukeren uten validering.
 */
export async function asService<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction((tx) => fn(wrap(tx)));
}
