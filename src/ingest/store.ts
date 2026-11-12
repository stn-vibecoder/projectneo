/**
 * Skriver resultatet av en henting til databasen. Delt ut fra run.ts så
 * det kan testes direkte mot en database i minnet.
 */
import { pgArray, type Sql } from "@/lib/db/sql";
import type { NormalizedPosting } from "./normalize";

export type StoreSummary = { inserted: number; updated: number; linked: number; closed: number };

async function companyId(sql: Sql, name: string, industry: string | null): Promise<string> {
  const [existing] = await sql.query<{ id: string }>(
    `select id from companies where created_by is null and normalized_name = normalize_company_name($1) limit 1`,
    [name],
  );
  if (existing) {
    if (industry) await sql.query(`update companies set industry = coalesce(industry, $2) where id = $1`, [existing.id, industry]);
    return existing.id;
  }
  const [created] = await sql.query<{ id: string }>(
    `insert into companies (name, industry) values ($1, $2) returning id`,
    [name.slice(0, 200), industry],
  );
  return created.id;
}

/**
 * Lagrer stillingene fra én kjøring av én kilde.
 * - Kjent (samme kilde + id): oppdater og hold åpen.
 * - Ny, men samme selskap+tittel finnes fra en annen kilde: koble til den.
 * - Ellers: ny stilling.
 * Til slutt: stillinger som er borte fra alle kildene sine, stenges.
 */
export async function storePostings(
  sql: Sql,
  sourceId: string,
  sourceType: string,
  postings: NormalizedPosting[],
  opts: { complete: boolean; removedIds?: string[] },
): Promise<StoreSummary> {
  const summary: StoreSummary = { inserted: 0, updated: 0, linked: 0, closed: 0 };
  const seen: string[] = [];

  for (const p of postings) {
    seen.push(p.externalId);
    const fields = [
      p.title.slice(0, 300),
      pgArray(p.cities),
      p.locationRaw,
      p.period,
      p.industry,
      p.deadline ?? null,
      p.url,
      p.applyUrl ?? p.url,
      p.description ?? null,
    ];

    const [link] = await sql.query<{ job_id: string }>(
      `select job_id from job_sources where source_id = $1 and external_id = $2`,
      [sourceId, p.externalId],
    );

    let jobId = link?.job_id;
    if (jobId) {
      await sql.query(
        `update jobs set title = $2, cities = $3::city[], location_raw = $4, period = $5,
                         industry = coalesce($6::industry, industry), deadline = $7, url = $8, apply_url = $9,
                         description = coalesce($10, description), status = 'open', closed_at = null, last_seen = now()
          where id = $1`,
        [jobId, ...fields],
      );
      summary.updated++;
    } else {
      const [dup] = await sql.query<{ id: string }>(
        `select id from jobs where created_by is null and dedupe_key = $1 order by status, first_seen limit 1`,
        [p.dedupeKey],
      );
      if (dup) {
        jobId = dup.id;
        await sql.query(
          `update jobs set status = 'open', closed_at = null, last_seen = now(),
                           deadline = coalesce(deadline, $2), description = coalesce(description, $3)
            where id = $1`,
          [jobId, p.deadline ?? null, p.description ?? null],
        );
        summary.linked++;
      } else {
        const cid = await companyId(sql, p.company, p.industry);
        const [job] = await sql.query<{ id: string }>(
          `insert into jobs (company_id, title, cities, location_raw, period, industry, deadline, url, apply_url,
                             description, source, dedupe_key)
           values ($1, $2, $3::city[], $4, $5, $6, $7, $8, $9, $10, $11, $12)
           returning id`,
          [cid, ...fields, sourceType, p.dedupeKey],
        );
        jobId = job.id;
        summary.inserted++;
      }
    }

    await sql.query(
      `insert into job_sources (job_id, source_id, external_id, url)
       values ($1, $2, $3, $4)
       on conflict (source_id, external_id)
       do update set job_id = excluded.job_id, url = excluded.url, active = true, last_seen = now()`,
      [jobId, sourceId, p.externalId, p.url],
    );
  }

  // Marker koblinger som borte.
  if (opts.complete) {
    await sql.query(
      `update job_sources set active = false
        where source_id = $1 and active and not (external_id = any($2::text[]))`,
      [sourceId, pgArray(seen)],
    );
  } else if (opts.removedIds?.length) {
    await sql.query(
      `update job_sources set active = false where source_id = $1 and external_id = any($2::text[])`,
      [sourceId, pgArray(opts.removedIds)],
    );
  }

  // Steng stillinger uten aktive kilder igjen (slettes ikke – de kan ligge i trackeren).
  const closed = await sql.query<{ id: string }>(
    `update jobs j set status = 'closed', closed_at = now(),
            description = case when j.source = 'nav' then null else j.description end
      where j.status = 'open' and j.created_by is null
        and exists (select 1 from job_sources s where s.job_id = j.id and s.source_id = $1)
        and not exists (select 1 from job_sources s where s.job_id = j.id and s.active)
      returning j.id`,
    [sourceId],
  );
  summary.closed = closed.length;
  return summary;
}

/** Når en kilde slettes: steng stillinger som ikke lenger har noen aktive kilder. */
export async function closeOrphans(sql: Sql): Promise<number> {
  const rows = await sql.query<{ id: string }>(
    `update jobs j set status = 'closed', closed_at = now()
      where j.status = 'open' and j.created_by is null and j.source <> 'seed' and j.source <> 'manual'
        and not exists (select 1 from job_sources s where s.job_id = j.id and s.active)
      returning j.id`,
  );
  return rows.length;
}
