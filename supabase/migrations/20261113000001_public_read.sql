-- =====================================================================
-- Åpen nettside: besøkende uten innlogging (rollen «anon») kan lese de
-- felles stillingene og selskapene. Alt personlig (søknader, watchlist,
-- kalender, kilder, profiler) er fortsatt bare for eieren.
-- =====================================================================

grant usage on schema public to anon;
grant select on public.jobs, public.companies to anon;

create policy "selskaper: besøkende leser felles" on public.companies
  for select to anon using (created_by is null);

create policy "stillinger: besøkende leser felles" on public.jobs
  for select to anon using (created_by is null);
