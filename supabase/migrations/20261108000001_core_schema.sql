-- =====================================================================
-- Fase 1: kjerneskjema for internship-portalen
-- Profiler, preferanser, selskaper, stillinger, søknader, statuser,
-- statushistorikk og kontaktpersoner. RLS på alle tabeller.
-- =====================================================================

-- ---------- Enums ----------------------------------------------------
-- Nye byer legges til med: alter type public.city add value 'berlin';
create type public.city as enum ('oslo', 'stockholm', 'new_york', 'london');

create type public.industry as enum (
  'finance', 'consulting', 'audit', 'tech', 'industry', 'other'
);

create type public.internship_period as enum (
  'summer', 'autumn', 'winter', 'full_year', 'unknown'
);

create type public.job_status as enum ('open', 'closed');

-- Faste kategorier som dashboardet regner på. Brukeren kan ha så mange
-- egendefinerte statuser hen vil, men hver status tilhører én kategori.
create type public.status_category as enum (
  'saved',       -- Lagret
  'applied',     -- Søkt
  'screening',   -- Online-test
  'interview',   -- Intervju
  'assessment',  -- Case / Assessment Center
  'offer',       -- Tilbud
  'accepted',    -- Takket ja
  'declined',    -- Avslått tilbud
  'rejected',    -- Avslag
  'withdrawn'    -- Trukket
);

-- ---------- Hjelpefunksjoner -----------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_company_name(name text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    regexp_replace(lower(coalesce(name, '')),
      '\m(asa|as|ab|ltd|limited|inc|llc|plc|gmbh|llp|co)\M\.?', '', 'g'),
    '[^a-z0-9æøåäö]+', ' ', 'g'))
$$;

-- ---------- Profiler og preferanser ----------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text,
  locale         text not null default 'nb',
  study_field    text,
  ghosting_days  integer not null default 14 check (ghosting_days between 1 and 180),
  onboarded_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.user_preferences (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  cities      public.city[] not null default '{}',
  industries  public.industry[] not null default '{}',
  periods     public.internship_period[] not null default '{}',
  updated_at  timestamptz not null default now()
);

-- ---------- Selskaper -------------------------------------------------
-- created_by = null  -> felles selskap (seed / automatisk henting)
-- created_by = bruker -> privat selskap opprettet ved manuell registrering
create table public.companies (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 1 and 200),
  normalized_name  text not null,
  website          text,
  industry         public.industry,
  description      text,
  created_by       uuid references public.profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index companies_global_name_key
  on public.companies (normalized_name) where created_by is null;
create unique index companies_private_name_key
  on public.companies (created_by, normalized_name) where created_by is not null;

create or replace function public.companies_fill_normalized()
returns trigger
language plpgsql
as $$
begin
  new.normalized_name = public.normalize_company_name(new.name);
  return new;
end;
$$;

-- ---------- Stillinger ------------------------------------------------
-- created_by = null  -> hentet automatisk / seed, synlig for alle innloggede
-- created_by = bruker -> manuelt lagt inn, kun synlig for den brukeren
create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 300),
  cities        public.city[] not null default '{}',
  location_raw  text,
  period        public.internship_period not null default 'unknown',
  industry      public.industry,
  deadline      date,
  url           text,
  apply_url     text,
  description   text,
  source        text not null default 'manual',
  status        public.job_status not null default 'open',
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  closed_at     timestamptz,
  dedupe_key    text,
  created_by    uuid references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index jobs_cities_idx on public.jobs using gin (cities);
create index jobs_status_deadline_idx on public.jobs (status, deadline);
create index jobs_company_idx on public.jobs (company_id);
create index jobs_created_by_idx on public.jobs (created_by) where created_by is not null;

-- ---------- Søknadsstatuser (egendefinerte per bruker) ---------------
create table public.application_statuses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 40),
  category    public.status_category not null,
  color       text not null default 'slate',
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (id, user_id)
);

create index application_statuses_user_idx on public.application_statuses (user_id, position);

-- ---------- Søknader --------------------------------------------------
create table public.applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  job_id            uuid not null references public.jobs (id) on delete cascade,
  status_id         uuid not null,
  applied_at        date,
  deadline          date,          -- overstyrer jobs.deadline hvis satt
  next_step         text,
  next_step_at      date,
  cv_url            text,
  cover_letter_url  text,
  notes             text,
  board_position    double precision not null default 0,
  last_activity_at  timestamptz not null default now(),
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, job_id),
  -- status må tilhøre samme bruker
  foreign key (status_id, user_id)
    references public.application_statuses (id, user_id) on delete restrict
);

create index applications_user_status_idx on public.applications (user_id, status_id, board_position);

-- ---------- Statushistorikk ------------------------------------------
-- Labels og kategorier lagres som øyeblikksbilde, så loggen er lesbar
-- selv om en status senere får nytt navn eller slettes.
create table public.application_events (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references public.applications (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  type             text not null check (type in ('created', 'status_changed', 'note')),
  from_status_id   uuid references public.application_statuses (id) on delete set null,
  to_status_id     uuid references public.application_statuses (id) on delete set null,
  from_label       text,
  to_label         text,
  from_category    public.status_category,
  to_category      public.status_category,
  note             text,
  created_at       timestamptz not null default now()
);

create index application_events_app_idx on public.application_events (application_id, created_at);
create index application_events_user_idx on public.application_events (user_id);

-- ---------- Kontaktpersoner ------------------------------------------
create table public.contacts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  application_id  uuid not null references public.applications (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 200),
  role            text,
  email           text,
  phone           text,
  linkedin_url    text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index contacts_application_idx on public.contacts (application_id);

-- ---------- Triggere --------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();
create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger companies_normalize before insert or update of name on public.companies
  for each row execute function public.companies_fill_normalized();
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- Logg alle statusendringer automatisk, så ingen endring kan gå uten logg.
create or replace function public.log_application_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from public.application_statuses%rowtype;
  v_to   public.application_statuses%rowtype;
begin
  select * into v_to from public.application_statuses where id = new.status_id;

  if tg_op = 'INSERT' then
    insert into public.application_events
      (application_id, user_id, type, to_status_id, to_label, to_category)
    values
      (new.id, new.user_id, 'created', v_to.id, v_to.label, v_to.category);
  elsif new.status_id is distinct from old.status_id then
    select * into v_from from public.application_statuses where id = old.status_id;
    insert into public.application_events
      (application_id, user_id, type,
       from_status_id, to_status_id, from_label, to_label, from_category, to_category)
    values
      (new.id, new.user_id, 'status_changed',
       v_from.id, v_to.id, v_from.label, v_to.label, v_from.category, v_to.category);
  end if;
  return new;
end;
$$;

create trigger applications_log_status
  after insert or update of status_id on public.applications
  for each row execute function public.log_application_status();

-- Standardstatuser for en bruker (brukes ved registrering)
create or replace function public.create_default_statuses(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.application_statuses (user_id, label, category, color, position)
  values
    (p_user_id, 'Lagret',                 'saved',      'slate',   0),
    (p_user_id, 'Søkt',                   'applied',    'blue',    1),
    (p_user_id, 'Online-test',            'screening',  'cyan',    2),
    (p_user_id, 'Intervju',               'interview',  'violet',  3),
    (p_user_id, 'Case/Assessment Center', 'assessment', 'amber',   4),
    (p_user_id, 'Tilbud',                 'offer',      'emerald', 5),
    (p_user_id, 'Takket ja',              'accepted',   'green',   6),
    (p_user_id, 'Avslått tilbud',         'declined',   'zinc',    7),
    (p_user_id, 'Avslag',                 'rejected',   'red',     8),
    (p_user_id, 'Trukket',                'withdrawn',  'stone',   9);
$$;

revoke execute on function public.create_default_statuses(uuid) from public;

-- Ny bruker i auth.users -> profil, preferanser og standardstatuser
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name',
                           new.raw_user_meta_data ->> 'name',
                           split_part(new.email, '@', 1)));
  insert into public.user_preferences (user_id) values (new.id);
  perform public.create_default_statuses(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ---------------------------------------
alter table public.profiles             enable row level security;
alter table public.user_preferences     enable row level security;
alter table public.companies            enable row level security;
alter table public.jobs                 enable row level security;
alter table public.application_statuses enable row level security;
alter table public.applications         enable row level security;
alter table public.application_events   enable row level security;
alter table public.contacts             enable row level security;

-- profiles
create policy "profiles: les egen" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: oppdater egen" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- user_preferences
create policy "preferanser: les egne" on public.user_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "preferanser: opprett egne" on public.user_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "preferanser: oppdater egne" on public.user_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- companies: felles + egne private
create policy "selskaper: les felles og egne" on public.companies
  for select to authenticated using (created_by is null or created_by = (select auth.uid()));
create policy "selskaper: opprett private" on public.companies
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "selskaper: endre private" on public.companies
  for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "selskaper: slett private" on public.companies
  for delete to authenticated using (created_by = (select auth.uid()));

-- jobs: felles + egne manuelle
create policy "stillinger: les felles og egne" on public.jobs
  for select to authenticated using (created_by is null or created_by = (select auth.uid()));
create policy "stillinger: opprett manuelle" on public.jobs
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "stillinger: endre manuelle" on public.jobs
  for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "stillinger: slett manuelle" on public.jobs
  for delete to authenticated using (created_by = (select auth.uid()));

-- application_statuses
create policy "statuser: alt på egne" on public.application_statuses
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- applications: stillingen må være synlig for brukeren (felles eller egen)
create policy "søknader: alt på egne" on public.applications
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.jobs j
                where j.id = job_id
                  and (j.created_by is null or j.created_by = (select auth.uid())))
  );

-- application_events: les egne, opprett kun notater. Loggen kan ikke endres.
create policy "hendelser: les egne" on public.application_events
  for select to authenticated using (user_id = (select auth.uid()));
create policy "hendelser: opprett notater" on public.application_events
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and type = 'note'
    and exists (select 1 from public.applications a
                where a.id = application_id and a.user_id = (select auth.uid()))
  );

-- contacts
create policy "kontakter: alt på egne" on public.contacts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.applications a
                where a.id = application_id and a.user_id = (select auth.uid()))
  );
