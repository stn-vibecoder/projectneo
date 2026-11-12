import "server-only";
import { asService } from "@/lib/db";
import type { Industry } from "@/lib/domain";
import { ADAPTERS } from "./adapters";
import { normalizePosting } from "./normalize";
import { storePostings, type StoreSummary } from "./store";
import type { SourceConfig, SourceType } from "./types";

export type RunResult =
  | ({ ok: true; sourceId: string; name: string; found: number; internships: number } & StoreSummary)
  | { ok: false; sourceId: string; name: string; error: string };

type SourceRow = {
  id: string;
  type: SourceType;
  identifier: string;
  name: string;
  url: string | null;
  industry: Industry | null;
  state: Record<string, unknown>;
};

const g = globalThis as typeof globalThis & { __ingestRunning?: Set<string> };
const running = (g.__ingestRunning ??= new Set());

/** Henter én kilde. Nettverk skjer utenfor databasetransaksjonen. */
export async function runSource(sourceId: string): Promise<RunResult> {
  const [src] = await asService((sql) =>
    sql.rows<SourceRow>(
      `select jsonb_build_object('id', id, 'type', type, 'identifier', identifier, 'name', name, 'url', url,
                                 'industry', industry, 'state', state) as row
         from sources where id = $1`,
      [sourceId],
    ),
  );
  if (!src) return { ok: false, sourceId, name: "?", error: "Fant ikke kilden" };
  if (!(src.type in ADAPTERS)) return { ok: false, sourceId, name: src.name, error: "Følges manuelt – hentes ikke automatisk" };
  if (running.has(sourceId)) return { ok: false, sourceId, name: src.name, error: "Henter allerede" };
  running.add(sourceId);

  try {
    const config: SourceConfig = { ...src, state: src.state ?? {} };
    const result = await ADAPTERS[src.type].fetch(config);
    const normalized = result.postings
      .map((p) => normalizePosting(p, config))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const summary = await asService(async (sql) => {
      const s = await storePostings(sql, src.id, src.type, normalized, {
        complete: result.complete,
        removedIds: result.removedIds,
      });
      await sql.query(
        `update sources set last_run_at = now(), last_status = 'ok', last_error = null,
                            last_found = $2, last_internships = $3, state = coalesce($4::jsonb, state)
          where id = $1`,
        [
          src.id,
          result.total ?? result.postings.length,
          normalized.length,
          result.state ? JSON.stringify(result.state) : null,
        ],
      );
      return s;
    });
    return { ok: true, sourceId, name: src.name, found: result.total ?? result.postings.length, internships: normalized.length, ...summary };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await asService((sql) =>
      sql.query(
        `update sources set last_run_at = now(), last_status = 'error', last_error = $2 where id = $1`,
        [src.id, error.slice(0, 500)],
      ),
    );
    return { ok: false, sourceId, name: src.name, error };
  } finally {
    running.delete(sourceId);
  }
}

/** Henter alle aktive kilder (for én bruker, eller alle hvis userId mangler), én om gangen. */
export async function runAllSources(userId?: string): Promise<RunResult[]> {
  const ids = await asService((sql) =>
    sql.query<{ id: string }>(
      `select id from sources where enabled and type <> 'manual' ${userId ? "and user_id = $1" : ""} order by last_run_at nulls first`,
      userId ? [userId] : [],
    ),
  );
  const results: RunResult[] = [];
  for (const { id } of ids) results.push(await runSource(id));
  return results;
}
