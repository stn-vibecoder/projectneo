/**
 * Lokal planlegger: henter alle kilder automatisk hver 6. time så lenge
 * appen kjører (npm run dev / npm start). Første henting skjer ett minutt
 * etter oppstart. På Vercel brukes Vercel Cron mot samme rute i stedet.
 */
const SIX_HOURS = 6 * 60 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL) return;
  if (process.env.DISABLE_AUTO_INGEST === "true") return;

  const g = globalThis as typeof globalThis & { __ingestTimer?: boolean };
  if (g.__ingestTimer) return;
  g.__ingestTimer = true;

  process.env.LOCAL_INGEST_SECRET ??= globalThis.crypto.randomUUID();

  const run = async () => {
    const port = process.env.PORT ?? "3000";
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/cron/ingest`, {
        headers: { Authorization: `Bearer ${process.env.LOCAL_INGEST_SECRET}` },
      });
      const body = (await res.json()) as { ran?: number; ok?: number };
      console.log(`[henting] ${body.ok ?? 0}/${body.ran ?? 0} kilder oppdatert`);
    } catch (e) {
      console.warn("[henting] feilet:", e instanceof Error ? e.message : e);
    }
  };

  setTimeout(run, 60_000);
  setInterval(run, SIX_HOURS);
}
