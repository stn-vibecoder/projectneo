-- Demodata-funksjonen ligger i en migrasjon (ikke i seed.sql), så endringer
-- i den også når databaser som allerede er seedet. Den bruker bare
-- stillinger med source = 'seed', og gjør ingenting uten testdata.
-- =====================================================================
-- Demodata for innlogget bruker: kalles fra appen ("Fyll med eksempeldata")
-- eller manuelt. Lager søknader i alle statuser med realistisk historikk.
-- Hopper over stillinger brukeren allerede følger, så den kan kjøres flere ganger.
-- =====================================================================
create or replace function public.load_demo_applications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer := 0;
  v_app uuid;
  v_job uuid;
  v_step text;
  v_day integer;
  r record;
begin
  if v_user is null then
    raise exception 'Ikke innlogget';
  end if;
  if not exists (select 1 from public.jobs where source = 'seed') then
    raise exception 'Fant ingen testdata. Kjør supabase/seed.sql først.';
  end if;

  for r in
    select * from (values
      -- key,      sti av kategorier (første = opprettet),                 dager siden start, next_step,                          next_step_om_dager, notat
      ('seed-01', array['saved','applied','screening','interview'],          30, 'Andre intervju (superday)',          4,    'Fikk god kontakt med teamet i første runde.'),
      ('seed-04', array['saved','applied'],                                  40, null,                                 null, 'Søkte via skjema. Ingen respons enda.'),
      ('seed-06', array['saved','applied','screening'],                      20, 'HireVue-test',                       2,    null),
      ('seed-08', array['saved','applied','rejected'],                       40, null,                                 null, 'Standard avslag etter CV-screening.'),
      ('seed-12', array['saved','applied','interview','assessment'],         35, 'Case-intervju',                      6,    'Øv på markedsstørrelse og profitabilitet.'),
      ('seed-14', array['saved','applied','interview','assessment','offer'], 50, 'Svare på tilbud',                    7,    'Tilbud mottatt – svarfrist om en uke.'),
      ('seed-17', array['saved','applied'],                                  34, null,                                 null, null),
      ('seed-19', array['saved','applied','screening','rejected'],           28, null,                                 null, 'Strøk på numerisk test – øv mer.'),
      ('seed-22', array['saved'],                                             2, 'Skrive søknadsbrev',                 5,    null),
      ('seed-24', array['saved'],                                             1, null,                                 null, null),
      ('seed-26', array['saved','applied','withdrawn'],                      22, null,                                 null, 'Trakk søknaden – prioriterer Europa.'),
      ('seed-28', array['saved','applied','interview','assessment','offer','accepted'], 60, null,                     null, 'Takket ja!'),
      ('seed-30', array['saved','applied'],                                  16, null,                                 null, null),
      ('seed-02', array['saved'],                                             3, null,                                 null, null)
    ) as t(key, path, days_ago, next_step, next_in, notes)
  loop
    select id into v_job from public.jobs where dedupe_key = r.key and source = 'seed';
    continue when v_job is null;
    continue when exists (select 1 from public.applications where user_id = v_user and job_id = v_job);

    insert into public.applications (user_id, job_id, status_id, notes, next_step,
                                     next_step_at, board_position, created_at)
    values (v_user, v_job,
            (select id from public.application_statuses
              where user_id = v_user and category = 'saved' order by position limit 1),
            r.notes, r.next_step,
            case when r.next_in is not null then current_date + r.next_in end,
            v_count, now() - make_interval(days => r.days_ago))
    returning id into v_app;

    update public.application_events set created_at = now() - make_interval(days => r.days_ago)
      where application_id = v_app;

    -- Gå gjennom stien; hvert steg logges av triggeren og tidsstemples bakover.
    for i in 2 .. coalesce(array_length(r.path, 1), 1) loop
      v_step := r.path[i];
      v_day := greatest(r.days_ago - (i - 1) * greatest(r.days_ago / array_length(r.path, 1), 1), 0);
      update public.applications
        set status_id = (select id from public.application_statuses
                          where user_id = v_user and category = v_step::public.status_category
                          order by position limit 1),
            applied_at = coalesce(applied_at,
                                  case when v_step <> 'saved' then current_date - v_day end),
            last_activity_at = now() - make_interval(days => v_day)
        where id = v_app;
      update public.application_events e
        set created_at = now() - make_interval(days => v_day)
        where e.id = (select id from public.application_events
                       where application_id = v_app order by created_at desc, id limit 1)
          and e.type = 'status_changed';
    end loop;

    if array_length(r.path, 1) = 1 then
      update public.applications set last_activity_at = now() - make_interval(days => r.days_ago)
        where id = v_app;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.load_demo_applications() from public, anon;
grant execute on function public.load_demo_applications() to authenticated;
