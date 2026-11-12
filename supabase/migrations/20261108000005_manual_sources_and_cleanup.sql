-- =====================================================================
-- 1) BambooHR som kildetype, og «manuell» kilde: karrieresider som ikke
--    kan hentes automatisk (Workday, Oracle o.l.), men som brukeren vil
--    følge. De lagres som lenker med merknad og hentes aldri.
-- 2) Fjern de oppdiktede teststillingene (source = 'seed'). Søknader og
--    kalenderhendelser knyttet til dem slettes sammen med dem.
-- =====================================================================

alter table public.sources drop constraint if exists sources_type_check;
alter table public.sources add constraint sources_type_check check (type in (
  'greenhouse', 'lever', 'ashby', 'teamtailor', 'bamboohr',
  'nhhs', 'bindeleddet', 'nav', 'jobtech', 'adzuna', 'manual'));

alter table public.sources add column if not exists notes text;
alter table public.sources add column if not exists sector text;

delete from public.jobs where source = 'seed';
delete from public.companies c
 where c.created_by is null
   and not exists (select 1 from public.jobs j where j.company_id = c.id);
