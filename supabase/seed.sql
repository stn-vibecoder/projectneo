-- =====================================================================
-- Testdata. Alle selskaper og stillinger er OPPDIKTET.
-- Lenker går til example.com. Frister regnes fra dagens dato, så
-- dataene alltid ser ferske ut.
--
-- Kjør i Supabase SQL Editor (eller: npx supabase db reset lokalt).
-- Trygt å kjøre flere ganger: gamle seed-data slettes først.
-- =====================================================================

delete from public.jobs where source = 'seed';
delete from public.companies c
  where c.created_by is null
    and not exists (select 1 from public.jobs j where j.company_id = c.id);

insert into public.companies (name, website, industry, description) values
  ('Nordvik Capital',           'https://example.com/nordvik',   'finance',    'Testselskap: nordisk investeringsbank med kontorer i Oslo og London.'),
  ('Skagerrak Securities',      'https://example.com/skagerrak', 'finance',    'Testselskap: meglerhus med fokus på energi og shipping.'),
  ('Hudson & Pine Partners',    'https://example.com/hudson',    'finance',    'Testselskap: amerikansk M&A-rådgiver.'),
  ('Thames Ridge Bank',         'https://example.com/thames',    'finance',    'Testselskap: britisk forretningsbank.'),
  ('Lindqvist Investment AB',   'https://example.com/lindqvist', 'finance',    'Testselskap: svensk kapitalforvalter.'),
  ('Fjell & Berg Consulting',   'https://example.com/fjellberg', 'consulting', 'Testselskap: strategikonsulenter i Norden.'),
  ('Meridian Strategy Group',   'https://example.com/meridian',  'consulting', 'Testselskap: internasjonalt strategihus.'),
  ('Kvarn Advisory',            'https://example.com/kvarn',     'consulting', 'Testselskap: svensk ledelsesrådgiver.'),
  ('Brekke Revisjon',           'https://example.com/brekke',    'audit',      'Testselskap: norsk revisjons- og rådgivningsselskap.'),
  ('Atlas Assurance',           'https://example.com/atlas',     'audit',      'Testselskap: globalt revisjonsnettverk.'),
  ('Polarlys Software',         'https://example.com/polarlys',  'tech',       'Testselskap: norsk SaaS-selskap.'),
  ('Nordlys Labs',              'https://example.com/nordlys',   'tech',       'Testselskap: svensk AI-oppstart.'),
  ('Brooklyn Data Co',          'https://example.com/brooklyn',  'tech',       'Testselskap: dataplattform i New York.'),
  ('Kingsway Fintech',          'https://example.com/kingsway',  'tech',       'Testselskap: betalingsselskap i London.'),
  ('Havbris Energi',            'https://example.com/havbris',   'industry',   'Testselskap: havvind og fornybar energi.'),
  ('Ståhlberg Industri',        'https://example.com/stahlberg', 'industry',   'Testselskap: svensk industrikonsern.'),
  ('Saga Media',                'https://example.com/saga',      'other',      'Testselskap: mediehus.')
on conflict do nothing;

insert into public.jobs
  (company_id, title, cities, location_raw, period, industry, deadline, url, description, source, dedupe_key, status, closed_at)
select
  c.id,
  v.title,
  v.cities::public.city[],
  v.loc,
  v.period::public.internship_period,
  c.industry,
  current_date + v.days,
  'https://example.com/jobs/' || v.key,
  'TESTDATA – oppdiktet stilling. ' || v.title || ' hos ' || c.name || '. '
    || 'Vi ser etter studenter med analytisk sans, gode samarbeidsevner og interesse for '
    || case c.industry
         when 'finance' then 'finansmarkeder, verdsettelse og transaksjoner.'
         when 'consulting' then 'strategi, problemløsning og kundearbeid.'
         when 'audit' then 'regnskap, revisjon og risikostyring.'
         when 'tech' then 'programvareutvikling, data og produkt.'
         when 'industry' then 'industri, energi og verdikjeder.'
         else 'kommunikasjon og forretningsutvikling.'
       end,
  'seed',
  v.key,
  v.status::public.job_status,
  case when v.status = 'closed' then now() - interval '3 days' end
from (values
  -- company,                    title,                                          cities,                 location,                    period,      days, key,      status
  ('Nordvik Capital',           'Summer Analyst 2027 – Investment Banking',     '{oslo}',               'Oslo',                      'summer',     21::int, 'seed-01', 'open'),
  ('Nordvik Capital',           'Summer Analyst 2027 – Equity Research',        '{oslo,london}',        'Oslo / London',             'summer',     35, 'seed-02', 'open'),
  ('Nordvik Capital',           'Winternship 2027 – Corporate Finance',         '{oslo}',               'Oslo',                      'winter',      6, 'seed-03', 'open'),
  ('Skagerrak Securities',      'Sommerjobb 2027 – Corporate Finance',          '{oslo}',               'Oslo sentrum',              'summer',     14, 'seed-04', 'open'),
  ('Skagerrak Securities',      'Internship – Shipping Research',               '{oslo}',               'Oslo',                      'autumn',     null, 'seed-05', 'open'),
  ('Hudson & Pine Partners',    '2027 Summer Analyst – M&A',                    '{new_york}',           'New York, NY',              'summer',     10, 'seed-06', 'open'),
  ('Hudson & Pine Partners',    'Off-Cycle Intern – Restructuring',             '{new_york,london}',    'New York / London',         'autumn',     45, 'seed-07', 'open'),
  ('Thames Ridge Bank',         'Spring Week & Summer Internship 2027',         '{london}',             'London, UK',                'summer',     18, 'seed-08', 'open'),
  ('Thames Ridge Bank',         'Markets Summer Analyst',                       '{london}',             'Canary Wharf, London',      'summer',      3, 'seed-09', 'open'),
  ('Lindqvist Investment AB',   'Praktikant – Kapitalförvaltning',              '{stockholm}',          'Stockholm',                 'full_year',  28, 'seed-10', 'open'),
  ('Lindqvist Investment AB',   'Summer Intern – Private Equity',               '{stockholm}',          'Stockholm',                 'summer',     40, 'seed-11', 'open'),
  ('Fjell & Berg Consulting',   'Summer Associate Intern 2027',                 '{oslo,stockholm}',     'Oslo / Stockholm',          'summer',     12, 'seed-12', 'open'),
  ('Fjell & Berg Consulting',   'Winternship – Strategy',                       '{oslo}',               'Oslo',                      'winter',      9, 'seed-13', 'open'),
  ('Meridian Strategy Group',   'Summer Consultant Intern',                     '{london}',             'London',                    'summer',     25, 'seed-14', 'open'),
  ('Meridian Strategy Group',   'Associate Intern – New York Office',           '{new_york}',           'Manhattan, New York',       'summer',     32, 'seed-15', 'open'),
  ('Kvarn Advisory',            'Sommarpraktik 2027 – Management Consulting',   '{stockholm}',          'Stockholm',                 'summer',     16, 'seed-16', 'open'),
  ('Brekke Revisjon',           'Sommerjobb revisjon 2027',                     '{oslo}',               'Oslo',                      'summer',     20, 'seed-17', 'open'),
  ('Brekke Revisjon',           'Internship – Skatt og avgift',                 '{oslo}',               'Oslo',                      'autumn',     50, 'seed-18', 'open'),
  ('Atlas Assurance',           'Audit Summer Intern 2027',                     '{london}',             'London',                    'summer',     22, 'seed-19', 'open'),
  ('Atlas Assurance',           'Audit & Assurance Intern',                     '{new_york}',           'New York',                  'summer',     30, 'seed-20', 'open'),
  ('Atlas Assurance',           'Praktikant – Revision',                        '{stockholm}',          'Stockholm',                 'full_year',  null, 'seed-21', 'open'),
  ('Polarlys Software',         'Sommerstudent – Utvikler 2027',                '{oslo}',               'Oslo',                      'summer',     27, 'seed-22', 'open'),
  ('Polarlys Software',         'Product Management Intern',                    '{oslo}',               'Oslo (hybrid)',             'summer',     38, 'seed-23', 'open'),
  ('Nordlys Labs',              'Machine Learning Intern',                      '{stockholm}',          'Stockholm',                 'summer',     15, 'seed-24', 'open'),
  ('Nordlys Labs',              'Software Engineering Intern (Winter)',         '{stockholm}',          'Stockholm',                 'winter',      8, 'seed-25', 'open'),
  ('Brooklyn Data Co',          'Data Science Intern – Summer 2027',            '{new_york}',           'Brooklyn, NY',              'summer',     19, 'seed-26', 'open'),
  ('Brooklyn Data Co',          'Software Engineer Intern',                     '{new_york}',           'New York',                  'summer',     null, 'seed-27', 'open'),
  ('Kingsway Fintech',          'Summer Internship – Payments Strategy',        '{london}',             'London',                    'summer',     24, 'seed-28', 'open'),
  ('Kingsway Fintech',          'Engineering Intern',                           '{london}',             'London (hybrid)',           'full_year',  42, 'seed-29', 'open'),
  ('Havbris Energi',            'Sommerjobb – Forretningsutvikling havvind',    '{oslo}',               'Oslo / Stavanger',          'summer',     17, 'seed-30', 'open'),
  ('Havbris Energi',            'Trainee/Intern – Finans',                      '{oslo}',               'Oslo',                      'autumn',     55, 'seed-31', 'open'),
  ('Ståhlberg Industri',        'Sommarjobb – Ekonomi & Controlling',           '{stockholm}',          'Södertälje / Stockholm',    'summer',     26, 'seed-32', 'open'),
  ('Saga Media',                'Internship – Kommersiell analyse',             '{oslo}',               'Oslo',                      'summer',     11, 'seed-33', 'open'),
  ('Meridian Strategy Group',   'Global Summer Intern Program',                 '{london,new_york,stockholm}', 'London / New York / Stockholm', 'summer', 60, 'seed-34', 'open'),
  -- To stengte stillinger (skal ikke vises i feeden)
  ('Thames Ridge Bank',         'Autumn Intern – Credit Risk',                  '{london}',             'London',                    'autumn',     -5, 'seed-35', 'closed'),
  ('Polarlys Software',         'Winternship – Backend',                        '{oslo}',               'Oslo',                      'winter',     -2, 'seed-36', 'closed')
) as v(company, title, cities, loc, period, days, key, status)
join public.companies c on c.name = v.company and c.created_by is null;
