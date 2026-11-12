import { connection } from "next/server";
import { runAllSources } from "@/ingest/run";

/**
 * Henter alle aktive kilder. Kalles av den lokale planleggeren
 * (src/instrumentation.ts) og senere av Vercel Cron.
 * Krever hemmelig nøkkel: CRON_SECRET (Vercel) eller en tilfeldig nøkkel
 * som planleggeren lager ved oppstart (lokalt).
 */
export async function GET(request: Request) {
  await connection();
  const auth = request.headers.get("authorization") ?? "";
  const allowed = [process.env.CRON_SECRET, process.env.LOCAL_INGEST_SECRET].filter(Boolean);
  if (!allowed.some((s) => auth === `Bearer ${s}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await runAllSources();
  return Response.json({
    ran: results.length,
    ok: results.filter((r) => r.ok).length,
    results: results.map((r) => (r.ok ? { name: r.name, internships: r.internships, inserted: r.inserted, closed: r.closed } : { name: r.name, error: r.error })),
  });
}
