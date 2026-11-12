-- =====================================================================
-- Samme selskap skrevet på ulike måter («Boston Consulting Group» og
-- «Boston Consulting Group (BCG)») skal være ett selskap og én stilling.
-- 1) Navnenormaliseringen ser bort fra parenteser.
-- 2) Eksisterende duplikater slås sammen (selskaper, så stillinger).
-- =====================================================================

create or replace function public.normalize_company_name(name text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    regexp_replace(
      regexp_replace(lower(coalesce(name, '')), '\([^)]*\)', ' ', 'g'),
      '\m(asa|as|ab|ltd|limited|inc|llc|plc|gmbh|llp|co)\M\.?', '', 'g'),
    '[^a-z0-9æøåäö]+', ' ', 'g'))
$$;

-- Felles selskaper: slå sammen de som nå får likt normalisert navn.
do $$
declare
  r record;
  keep uuid;
begin
  for r in
    select id, public.normalize_company_name(name) as nn, normalized_name as old_nn
      from public.companies where created_by is null order by created_at, id
  loop
    continue when r.nn = r.old_nn;
    select id into keep from public.companies
      where created_by is null and normalized_name = r.nn and id <> r.id limit 1;
    if keep is not null then
      update public.jobs set company_id = keep where company_id = r.id;
      insert into public.watchlist (user_id, company_id)
        select user_id, keep from public.watchlist where company_id = r.id
        on conflict do nothing;
      delete from public.companies where id = r.id;
    else
      update public.companies set normalized_name = r.nn where id = r.id;
    end if;
  end loop;
end $$;

-- Private selskaper: bare oppdater navnet der det ikke gir kollisjon.
update public.companies c
   set normalized_name = public.normalize_company_name(c.name)
 where c.created_by is not null
   and c.normalized_name <> public.normalize_company_name(c.name)
   and not exists (select 1 from public.companies o
                    where o.created_by = c.created_by and o.id <> c.id
                      and o.normalized_name = public.normalize_company_name(c.name));

-- Hentede stillinger: regn ut nøkkelen på nytt og slå sammen like.
update public.jobs j
   set dedupe_key = public.normalize_company_name(c.name) || '|' ||
       trim(regexp_replace(lower(j.title), '[^a-z0-9æøåäö]+', ' ', 'g'))
  from public.companies c
 where c.id = j.company_id and j.created_by is null and j.source not in ('seed', 'manual');

do $$
declare
  d record;
  keep uuid;
begin
  for d in
    select dedupe_key from public.jobs
     where created_by is null and dedupe_key is not null and source not in ('seed', 'manual')
     group by dedupe_key having count(*) > 1
  loop
    select id into keep from public.jobs
      where created_by is null and dedupe_key = d.dedupe_key
      order by (status = 'open') desc, first_seen, id limit 1;

    update public.job_sources set job_id = keep
      where job_id in (select id from public.jobs
                        where created_by is null and dedupe_key = d.dedupe_key and id <> keep);

    -- Flytt søknader over, unntatt der brukeren allerede har en søknad på den vi beholder.
    update public.applications a set job_id = keep
      where a.job_id in (select id from public.jobs
                          where created_by is null and dedupe_key = d.dedupe_key and id <> keep)
        and not exists (select 1 from public.applications b
                         where b.user_id = a.user_id and b.job_id = keep);

    delete from public.jobs j
      where j.created_by is null and j.dedupe_key = d.dedupe_key and j.id <> keep
        and not exists (select 1 from public.applications a where a.job_id = j.id);
  end loop;
end $$;
