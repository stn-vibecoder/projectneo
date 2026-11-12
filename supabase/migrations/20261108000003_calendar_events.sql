-- =====================================================================
-- Kalender: datoer brukeren legger inn selv (intervju, case, test,
-- bedriftspresentasjon, frist, annet). Kan kobles til en søknad.
-- Søknadsfrister og «neste steg» vises også i kalenderen, men hentes
-- fra jobs/applications og lagres ikke her.
-- =====================================================================

create type public.calendar_event_type as enum (
  'interview',   -- Intervju
  'assessment',  -- Case / Assessment Center
  'test',        -- Online-test
  'info',        -- Bedriftspresentasjon / event
  'deadline',    -- Frist (egen)
  'other'        -- Annet
);

create table public.calendar_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  application_id  uuid references public.applications (id) on delete cascade,
  type            public.calendar_event_type not null default 'other',
  title           text check (title is null or char_length(title) between 1 and 200),
  date            date not null,
  start_time      time,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index calendar_events_user_date_idx on public.calendar_events (user_id, date);
create index calendar_events_application_idx on public.calendar_events (application_id)
  where application_id is not null;

create trigger calendar_events_updated_at before update on public.calendar_events
  for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;

create policy "kalender: alt på egne" on public.calendar_events
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      application_id is null
      or exists (select 1 from public.applications a
                 where a.id = application_id and a.user_id = (select auth.uid()))
    )
  );
