"use server";

import { requireUser } from "@/lib/auth";
import { asUser } from "@/lib/db";

export type PaletteData = {
  applications: { id: string; company: string; title: string; status: string }[];
  jobs: { id: string; company: string; title: string }[];
};

/** Søknader og åpne stillinger til hurtigsøket (hentes første gang det åpnes). */
export async function getPaletteData(): Promise<PaletteData> {
  const user = await requireUser();
  return asUser(user.id, async (sql) => ({
    applications: await sql.query(
      `select a.id, c.name as company, j.title, s.label as status
         from applications a
         join jobs j on j.id = a.job_id
         join companies c on c.id = j.company_id
         join application_statuses s on s.id = a.status_id
        where not a.archived
        order by a.last_activity_at desc limit 300`,
    ),
    jobs: await sql.query(
      `select j.id, c.name as company, j.title
         from jobs j join companies c on c.id = j.company_id
        where j.status = 'open' and (j.deadline is null or j.deadline >= current_date)
        order by j.first_seen desc limit 500`,
    ),
  }));
}
