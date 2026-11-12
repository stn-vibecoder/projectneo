import "server-only";
import { connection } from "next/server";
import type { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { wrap, type Sql } from "./sql";
import { PG_TYPES, connectionOptions, databaseUrl } from "./url";

export { pgArray, type Sql } from "./sql";

/**
 * Databasetilgang. To moduser, samme SQL, migrasjoner og RLS i begge:
 *
 * SUPABASE (når DATABASE_URL eller POSTGRES_URL er satt, f.eks. på Vercel): vanlig Postgres
 * via Supabase sin «Transaction pooler». Migrasjonene kjøres av
 * scripts/db-push.ts før hvert bygg (npm run build).
 *
 * LOKAL (ellers): Postgres kjører inne i Node via PGlite, med data i
 * .data/pglite. Ingen konto eller installasjon trengs.
 *
 * All SQL kjøres som rollen «authenticated» med brukerens id satt,
 * akkurat som i Supabase, så tilgangsreglene (RLS) gjelder i begge.
 */

const DATABASE_URL = databaseUrl();

type TxLike = {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(text: string): Promise<unknown>;
};
/** Kjører en funksjon i én transaksjon, uansett database. */
type Runner = <T>(fn: (tx: TxLike) => Promise<T>) => Promise<T>;

const g = globalThis as typeof globalThis & {
  __pglite?: Promise<PGlite>;
  __migrations?: string;
  __migrating?: Promise<void>;
  __pg?: postgres.Sql;
};

// ---------------------------------------------------------------------
// Supabase / Postgres
// ---------------------------------------------------------------------

function pg(): postgres.Sql {
  const { url, ssl } = connectionOptions(DATABASE_URL);
  g.__pg ??= postgres(url, {
    ssl,
    types: PG_TYPES,
    // Supabase sin transaction pooler støtter ikke «prepared statements».
    prepare: false,
    max: Number(process.env.DB_POOL_MAX ?? 3),
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return g.__pg;
}

const pgRunner: Runner = (fn) =>
  pg().begin((tx) =>
    fn({
      query: async <T>(text: string, params: unknown[] = []) => ({
        rows: (await tx.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as T[],
      }),
      exec: (text: string) => tx.unsafe(text),
    }),
  ) as never;

// ---------------------------------------------------------------------
// Lokal (PGlite)
// ---------------------------------------------------------------------

async function localDb(): Promise<PGlite> {
  // Lastes bare inn i lokal modus, så PGlite aldri trengs på Vercel.
  const [{ PGlite }, { bootstrap }, fs, path] = await Promise.all([
    import("@electric-sql/pglite"),
    import("./bootstrap"),
    import("node:fs"),
    import("node:path"),
  ]);
  const seed = process.env.LOCAL_SEED === "true";
  const dataDir = process.env.LOCAL_DB_DIR ?? path.join(process.cwd(), ".data", "pglite");
  const migDir = path.join(process.cwd(), "supabase", "migrations");
  const list = () =>
    fs
      .readdirSync(migDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .join("|");

  g.__pglite ??= (async () => {
    fs.mkdirSync(dataDir, { recursive: true });
    const db = await PGlite.create(dataDir);
    await bootstrap(db, process.cwd(), { seed, localUser: true });
    g.__migrations = list();
    return db;
  })().catch((e) => {
    g.__pglite = undefined;
    throw e;
  });
  const db = await g.__pglite;

  // Nye migrasjonsfiler tas i bruk uten at serveren må startes på nytt.
  if (process.env.NODE_ENV !== "production" && list() !== g.__migrations) {
    // Lås: samtidige forespørsler skal vente på samme oppdatering, ikke kjøre den to ganger.
    g.__migrating ??= bootstrap(db, process.cwd(), { seed, localUser: true })
      .then(() => {
        g.__migrations = list();
      })
      .finally(() => {
        g.__migrating = undefined;
      });
    await g.__migrating;
  }
  return db;
}

const localRunner: Runner = async (fn) => {
  const db = await localDb();
  return db.transaction((tx) => fn({ query: (t, p) => tx.query(t, p), exec: (t) => tx.exec(t) }));
};

const run: Runner = DATABASE_URL ? pgRunner : localRunner;

export const DB_MODE: "postgres" | "local" = DATABASE_URL ? "postgres" : "local";

// ---------------------------------------------------------------------

/**
 * Kjører `fn` i én transaksjon som innlogget bruker (RLS gjelder).
 * Kaster feil -> alt rulles tilbake.
 */
export async function asUser<T>(userId: string, fn: (sql: Sql) => Promise<T>): Promise<T> {
  await connection(); // Databasekall skal aldri skje under bygging/forhåndsrendring.
  return run(async (tx) => {
    // Begge formene Supabase sin auth.uid() leser.
    await tx.query(
      `select set_config('request.jwt.claim.sub', $1, true),
              set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
      [userId],
    );
    await tx.exec(`set local role authenticated`);
    return fn(wrap(tx));
  });
}

/**
 * Kjører som tjenesterolle (uten RLS). KUN for serverjobber som henting
 * av stillinger, aldri med data styrt av brukeren uten validering.
 */
export async function asService<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  return run((tx) => fn(wrap(tx)));
}
