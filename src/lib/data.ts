import "server-only";
import { cache } from "react";
import { getCurrentUser, requireSourceAdmin, requireUser, type CurrentUser } from "@/lib/auth";
import { asService, asUser, asViewer, pgArray } from "@/lib/db";
import { TIME_ZONE } from "@/i18n/request";
import type { City, Industry, Period, StatusCategory } from "@/lib/domain";
import type { CalendarAppRow, CalendarEventRow } from "@/lib/tracker/calendar";
import type { StatusEventRow } from "@/lib/tracker/series";
import type {
  ApplicationEvent,
  ApplicationStatus,
  ApplicationWithRelations,
  Contact,
  Job,
  JobWithCompany,
  Preferences,
  Profile,
} from "@/lib/types";

/** Dagens dato i Oslo-tid som YYYY-MM-DD. */
export function todayInOslo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

/** Standardvalg for besøkende som ikke er logget inn: alle byer, økonomibransjene. */
export const GUEST_PREFS = {
  cities: ["oslo", "stockholm", "new_york", "london"] as City[],
  industries: ["finance", "consulting", "audit"] as Industry[],
};

/**
 * Den som ser på siden: innlogget bruker med profil og preferanser, eller
 * en besøkende (user = null) med standardvalg. Brukes av de åpne sidene.
 */
export const getViewer = cache(
  async (): Promise<{ user: CurrentUser | null; profile: Profile | null; cities: City[]; industries: Industry[] }> => {
    const user = await getCurrentUser();
    if (!user) return { user: null, profile: null, ...GUEST_PREFS };
    const { profile, prefs } = await getProfile();
    return { user, profile, cities: prefs.cities, industries: prefs.industries };
  },
);

export const getProfile = cache(async () => {
  const user = await requireUser();
  return asUser(user.id, async (sql) => {
    const profile = await sql.row<Profile>(`select to_jsonb(p) as row from profiles p where p.id = $1`, [user.id]);
    const prefs = await sql.row<Preferences>(`select to_jsonb(p) as row from user_preferences p where p.user_id = $1`, [
      user.id,
    ]);
    return {
      user,
      profile,
      prefs: prefs ?? ({ user_id: user.id, cities: [], industries: [], periods: [] } satisfies Preferences),
    };
  });
});

export const getStatuses = cache(async () => {
  const user = await requireUser();
  return asUser(user.id, (sql) =>
    sql.rows<ApplicationStatus>(
      `select to_jsonb(s) as row from application_statuses s order by s.position, s.created_at`,
    ),
  );
});

/** Søknad med stilling, selskap og status som ett JSON-objekt. */
export const APP_ROW = `
  to_jsonb(a) || jsonb_build_object(
    'job', to_jsonb(j) || jsonb_build_object('company', to_jsonb(c)),
    'status', to_jsonb(s)
  ) as row
  from applications a
  join jobs j on j.id = a.job_id
  join companies c on c.id = j.company_id
  join application_statuses s on s.id = a.status_id`;

export const getApplications = cache(async (opts: { includeArchived?: boolean } = {}) => {
  const user = await requireUser();
  return asUser(user.id, (sql) =>
    sql.rows<ApplicationWithRelations>(
      `select ${APP_ROW}
       ${opts.includeArchived ? "" : "where not a.archived"}
       order by a.board_position, a.created_at`,
    ),
  );
});

/** Alle kategorier hver søknad har vært innom (til trakt og svarrate). */
export const getStatusHistory = cache(async () => {
  const user = await requireUser();
  const rows = await asUser(user.id, (sql) =>
    sql.query<{ application_id: string; to_category: StatusCategory | null }>(
      `select application_id, to_category::text as to_category
         from application_events where type <> 'note' order by created_at`,
    ),
  );
  const map = new Map<string, StatusCategory[]>();
  for (const e of rows) {
    if (!e.to_category) continue;
    const list = map.get(e.application_id) ?? [];
    list.push(e.to_category);
    map.set(e.application_id, list);
  }
  return map;
});

export type SourceRow = {
  id: string;
  type: string;
  identifier: string;
  name: string;
  url: string | null;
  industry: Industry | null;
  enabled: boolean;
  last_run_at: string | null;
  last_status: "ok" | "error" | null;
  last_error: string | null;
  last_found: number | null;
  last_internships: number | null;
  open_jobs: number;
  notes: string | null;
  sector: string | null;
  /** For manuelle kilder: hvorfor de ikke kan hentes, og hvilket system de bruker. */
  reason: string | null;
  system: string | null;
  cities: string | null;
};

/** Brukerens kilder med antall åpne stillinger fra hver. */
/** De felles kildene (bare for administratorer). */
export const getSources = cache(async () => {
  const user = await requireSourceAdmin();
  return asUser(user.id, (sql) =>
    sql.rows<SourceRow>(
      `select to_jsonb(s) - 'state' || jsonb_build_object('open_jobs', (
                select count(distinct js.job_id) from job_sources js join jobs j on j.id = js.job_id
                 where js.source_id = s.id and js.active and j.status = 'open'),
              'reason', s.state->>'reason', 'system', s.state->>'system', 'cities', s.state->>'cities') as row
         from sources s order by s.created_at`,
    ),
  );
});

/** Statusendringer med tidspunkt, gruppert per søknad (til grafer over tid). */
export const getStatusEventsByApp = cache(async () => {
  const user = await requireUser();
  const rows = await asUser(user.id, (sql) =>
    sql.rows<StatusEventRow>(
      `select jsonb_build_object('application_id', application_id, 'to_category', to_category, 'created_at', created_at) as row
         from application_events where type <> 'note' order by created_at`,
    ),
  );
  const map = new Map<string, StatusEventRow[]>();
  for (const r of rows) {
    const list = map.get(r.application_id) ?? [];
    list.push(r);
    map.set(r.application_id, list);
  }
  return map;
});

/** Egne kalenderhendelser med selskap og stilling (hvis koblet til en søknad). */
export const getCalendarEvents = cache(async (applicationId?: string) => {
  const user = await requireUser();
  return asUser(user.id, (sql) =>
    sql.rows<CalendarEventRow>(
      `select to_jsonb(e) || jsonb_build_object('company', c.name, 'job_title', j.title) as row
         from calendar_events e
         left join applications a on a.id = e.application_id
         left join jobs j on j.id = a.job_id
         left join companies c on c.id = j.company_id
        ${applicationId ? "where e.application_id = $1" : ""}
        order by e.date, e.start_time nulls last`,
      applicationId ? [applicationId] : [],
    ),
  );
});

/** Søknader i formen kalenderen trenger (frister og neste steg). */
export function toCalendarApps(apps: ApplicationWithRelations[]): CalendarAppRow[] {
  return apps.map((a) => ({
    id: a.id,
    category: a.status.category,
    archived: a.archived,
    appliedAt: a.applied_at,
    deadline: a.deadline ?? a.job.deadline,
    nextStep: a.next_step,
    nextStepAt: a.next_step_at,
    company: a.job.company.name,
    jobTitle: a.job.title,
  }));
}

export async function getApplication(id: string) {
  const user = await requireUser();
  return asUser(user.id, async (sql) => {
    const app = await sql.row<ApplicationWithRelations>(`select ${APP_ROW} where a.id = $1`, [id]);
    if (!app) return null;
    const events = await sql.rows<ApplicationEvent>(
      `select to_jsonb(e) as row from application_events e where e.application_id = $1 order by e.created_at desc`,
      [id],
    );
    const contacts = await sql.rows<Contact>(
      `select to_jsonb(c) as row from contacts c where c.application_id = $1 order by c.created_at`,
      [id],
    );
    return { app, events, contacts };
  });
}

/** Én stilling (felles eller egen), eller null. */
export async function getJob(id: string) {
  const user = await getCurrentUser();
  // Kildenavnene er offentlige (de vises ved stillingen), men kildene eies av systembrukeren.
  const sources = await asService((sql) =>
    sql.query<{ name: string }>(
      `select s.name from job_sources js join sources s on s.id = js.source_id where js.job_id = $1 and js.active`,
      [id],
    ),
  );
  return asViewer(user, async (sql) => {
    const job = await sql.row<JobWithCompany>(
      `select to_jsonb(j) || jsonb_build_object('company', to_jsonb(c)) as row
         from jobs j join companies c on c.id = j.company_id where j.id = $1`,
      [id],
    );
    if (!job) return null;
    const [app] = user ? await sql.query<{ id: string }>(`select id from applications where job_id = $1`, [id]) : [];
    const [watch] = user
      ? await sql.query<{ company_id: string }>(`select company_id from watchlist where company_id = $1`, [job.company_id])
      : [];
    const others = await sql.rows<Job>(
      `select to_jsonb(j) as row from jobs j
        where j.company_id = $1 and j.id <> $2 and j.status = 'open'
        order by j.deadline asc nulls last limit 8`,
      [job.company_id, id],
    );
    return { job, applicationId: app?.id ?? null, watched: Boolean(watch), others, sources: sources.map((s) => s.name) };
  });
}

/** Id-ene til selskapene brukeren følger. */
export const getWatchedCompanyIds = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return new Set<string>();
  const rows = await asUser(user.id, (sql) => sql.query<{ company_id: string }>(`select company_id from watchlist`));
  return new Set(rows.map((r) => r.company_id));
});

export type WatchRow = {
  company_id: string;
  name: string;
  industry: Industry | null;
  open_jobs: number;
  new_jobs: number;
  next_deadline: string | null;
  next_job_id: string | null;
};

/** Watchlist som en kurstabell: åpne stillinger, nye siste 7 dager og neste frist per selskap. */
export const getWatchlist = cache(async () => {
  const user = await requireUser();
  const today = todayInOslo();
  return asUser(user.id, (sql) =>
    sql.rows<WatchRow>(
      `select jsonb_build_object(
                'company_id', c.id, 'name', c.name, 'industry', c.industry,
                'open_jobs', count(j.id),
                'new_jobs', count(j.id) filter (where j.first_seen > now() - interval '7 days'),
                'next_deadline', min(j.deadline) filter (where j.deadline >= $1::date),
                'next_job_id', (array_agg(j.id order by j.deadline asc nulls last) filter (where j.id is not null))[1]
              ) as row
         from watchlist w
         join companies c on c.id = w.company_id
         left join jobs j on j.company_id = c.id and j.status = 'open'
              and (j.deadline is null or j.deadline >= $1::date)
        group by c.id, c.name, c.industry
        order by count(j.id) desc, c.name`,
      [today],
    ),
  );
});

export type FeedFilters = {
  /** Bare selskaper på watchlisten. */
  watch?: boolean;
  city?: City;
  /** En bestemt bransje, "all" for alle, eller udefinert = brukerens valgte bransjer. */
  industry?: Industry | "all";
  period?: Period;
  deadline?: "7" | "30" | "none";
  q?: string;
  sort?: "deadline" | "newest" | "company";
};

export async function getFeed(filters: FeedFilters, cities: City[], preferredIndustries: Industry[] = []) {
  const user = await getCurrentUser();
  const today = todayInOslo();
  const selectedCities = filters.city ? [filters.city] : cities;
  if (selectedCities.length === 0) {
    return { jobs: [] as JobWithCompany[], savedByJob: new Map<string, string>(), today };
  }

  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  const where = [`j.status = 'open'`, `j.cities && ${p(pgArray(selectedCities))}::city[]`];

  if (filters.industry && filters.industry !== "all") {
    where.push(`j.industry = ${p(filters.industry)}::industry`);
  } else if (!filters.industry && preferredIndustries.length > 0) {
    // Brukerens bransjer som standard. Stillinger uten kjent bransje vises også.
    where.push(`(j.industry = any(${p(pgArray(preferredIndustries))}::industry[]) or j.industry is null)`);
  }
  if (filters.period) where.push(`j.period = ${p(filters.period)}::internship_period`);
  if (filters.watch && user) where.push(`j.company_id in (select company_id from watchlist)`);

  if (filters.deadline === "none") {
    where.push(`j.deadline is null`);
  } else if (filters.deadline === "7" || filters.deadline === "30") {
    const t = p(today);
    where.push(`j.deadline between ${t}::date and ${t}::date + ${p(Number(filters.deadline))}::int`);
  } else {
    // Skjul stillinger der fristen har gått ut.
    where.push(`(j.deadline is null or j.deadline >= ${p(today)}::date)`);
  }

  const needle = filters.q?.trim();
  if (needle) {
    const like = p(`%${needle.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    where.push(`(j.title ilike ${like} or c.name ilike ${like})`);
  }

  const order =
    filters.sort === "newest" ? `j.first_seen desc` : `j.deadline asc nulls last, j.first_seen desc`;

  const { jobs, saved } = await asViewer(user, async (sql) => ({
    jobs: await sql.rows<JobWithCompany>(
      `select to_jsonb(j) || jsonb_build_object('company', to_jsonb(c)) as row
         from jobs j join companies c on c.id = j.company_id
        where ${where.join(" and ")}
        order by ${order}
        limit 500`,
      params,
    ),
    saved: user ? await sql.query<{ id: string; job_id: string }>(`select id, job_id from applications`) : [],
  }));

  const sorted =
    filters.sort === "company" ? [...jobs].sort((a, b) => a.company.name.localeCompare(b.company.name, "nb")) : jobs;

  return { jobs: sorted, savedByJob: new Map(saved.map((s) => [s.job_id, s.id])), today };
}

/**
 * Status for hentingen, uten å vise selve kildene: hvor mange felles kilder
 * som hentes automatisk, og om noen av dem har vært hentet.
 */
export const getFetchStatus = cache(async () => {
  const [row] = await asService((sql) =>
    sql.query<{ total: number; fetched: number }>(
      `select count(*)::int as total, count(last_run_at)::int as fetched
         from sources where enabled and type <> 'manual'`,
    ),
  );
  return row ?? { total: 0, fetched: 0 };
});
