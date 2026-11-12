-- =====================================================================
-- Watchlist: selskaper brukeren følger (som en aksje-watchlist).
-- Rating: brukerens egen prioritering av en søknad, i kredittrating-stil
--   AAA = drømmejobb, AA = svært aktuell, A = aktuell, BBB = reserve.
-- =====================================================================

create table public.watchlist (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, company_id)
);

alter table public.watchlist enable row level security;

create policy "watchlist: alt på egne" on public.watchlist
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.companies c
                where c.id = company_id
                  and (c.created_by is null or c.created_by = (select auth.uid())))
  );

alter table public.applications
  add column rating text check (rating in ('AAA', 'AA', 'A', 'BBB'));
