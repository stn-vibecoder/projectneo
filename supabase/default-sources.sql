-- Standardkildene (supabase/default-sources.json) for en bruker.
-- $1 = bruker-id, $2 = innholdet i JSON-filen. Kilder som finnes fra før røres ikke.
insert into public.sources (user_id, type, identifier, name, url, industry, enabled, notes, sector, state)
select $1::uuid, x.type, x.identifier, x.name, x.url, x.industry::public.industry,
       coalesce(x.enabled, true), x.notes, x.sector, coalesce(x.state, '{}'::jsonb)
  from jsonb_to_recordset($2::jsonb) as x(
         type text, identifier text, name text, url text, industry text,
         enabled boolean, notes text, sector text, state jsonb)
on conflict (user_id, type, identifier) do nothing
