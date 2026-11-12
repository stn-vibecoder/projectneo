import "server-only";
import type { Sql } from "@/lib/db";

/** Første status i kategorien «Lagret» for innlogget bruker. */
export async function firstSavedStatusId(sql: Sql): Promise<string | null> {
  const [r] = await sql.query<{ id: string }>(
    `select id from application_statuses where category = 'saved' order by position limit 1`,
  );
  return r?.id ?? null;
}

/** Posisjon øverst i en kolonne på tavlen. */
export async function topPosition(sql: Sql, statusId: string): Promise<number> {
  const [r] = await sql.query<{ min: number | null }>(
    `select min(board_position) as min from applications where status_id = $1`,
    [statusId],
  );
  return r?.min === null || r?.min === undefined ? 0 : r.min - 1;
}
