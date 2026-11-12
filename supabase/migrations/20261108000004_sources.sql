-- =====================================================================
-- Fase 2: kilder for automatisk henting av stillinger.
--
-- sources      – det brukeren har lagt inn (karriereside, jobbtavle, API)
-- job_sources  – hvilke kilder en stilling er funnet i (samme stilling
--                kan komme fra flere kilder; den stenges først når den er
--                borte fra alle)
--
-- Stillinger (jobs) er felles. Henting skriver med tjenesterollen.
-- =====================================================================

create table public.sources (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type              text not null check (type in (
                      'greenhouse', 'lever', 'ashby', 'teamtailor',
                      'nhhs', 'bindeleddet', 'nav', 'jobtech', 'adzuna')),
  identifier        text not null,                -- board-token, side-navn, URL eller 'default'
  name              text not null check (char_length(name) between 1 and 120),
  url               text,                         -- lenken brukeren limte inn
  industry          public.industry,              -- standardbransje for stillinger fra kilden
  enabled           boolean not null default true,
  state             jsonb not null default '{}',  -- f.eks. markør for inkrementelle feeder (NAV)
  last_run_at       timestamptz,
  last_status       text check (last_status in ('ok', 'error')),
  last_error        text,
  last_found        integer,                      -- antall stillinger i kilden
  last_internships  integer,                      -- antall som passet (internship + by)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, type, identifier)
);

create trigger sources_updated_at before update on public.sources
  for each row execute function public.set_updated_at();

create table public.job_sources (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs (id) on delete cascade,
  source_id    uuid not null references public.sources (id) on delete cascade,
  external_id  text not null,
  url          text,
  active       boolean not null default true,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  unique (source_id, external_id)
);

create index job_sources_job_idx on public.job_sources (job_id);
create index jobs_dedupe_idx on public.jobs (dedupe_key) where created_by is null;

alter table public.sources enable row level security;
alter table public.job_sources enable row level security;

create policy "kilder: alt på egne" on public.sources
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Koblingene kan leses (for å vise «Kilde» på stillinger); bare tjenesterollen skriver.
create policy "kildekoblinger: les" on public.job_sources
  for select to authenticated using (true);
