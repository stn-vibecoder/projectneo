# Prosjektrapport: Internship-portalen (projectneo)

Rapporten er skrevet for å sette en ny utvikler eller AI-agent inn i prosjektet.
Claude Code leser den automatisk via `CLAUDE.md`.
Den beskriver hva appen er, hvordan den er bygget, hvilke beslutninger eieren har tatt,
og hvor arbeidet står. Sist oppdatert: 12. november 2026.

---

## 1. Kort fortalt

En webapp for **økonomistudenter som leter etter internships** innen bank/finans/IB,
konsulent og revisjon (Big 4) i **Oslo, Stockholm, New York og London**. Appen har to deler:

1. **Feed:** henter stillinger automatisk fra lovlige kilder (åpne ATS-API-er,
   offentlige jobbdatabaser og to studentportaler), filtrerer bort alt som ikke er
   internships, fjerner duplikater og markerer stillinger som forsvinner som stengt.
2. **Søknadstracker (viktigst):** et regneark der hver søknad er en rad med
   status, datoer, rating og notater. Den har også tavlevisning, kalender, statushistorikk,
   nøkkeltall og CSV-eksport.

- **Språk:** norsk bokmål i hele brukergrensesnittet, men klart for flere språk.
- **Bruk:** kun personlig, ikke kommersielt.
- **Eieren:** økonomistudent, ikke utvikler. Forklaringer til eieren skal være på enkel norsk, steg for steg.

---

## 2. Status nå

| Del | Status |
|---|---|
| Fase 1: tracker, feed, onboarding, innstillinger | Ferdig |
| Fase 2: automatisk henting fra kilder | Ferdig |
| UX-runde: stillingsside, watchlist, rating, morgenrapport, ⌘K, .ics | Ferdig |
| Klargjort for Vercel (Postgres, migrering i bygg, cron) | Ferdig, testet mot ekte Postgres lokalt |
| Deploy til Vercel | Ferdig. Kjører uten innlogging, med 84 standardkilder (avsnitt 11) |
| Fase 3: AI-søknadstips (Anthropic API) | Ikke startet |
| Brukere og innlogging (valgfri, Google + e-post) | Bygget 13.11.2026. Google-oppsett i Google Cloud og Supabase gjenstår (README) |
| Fase 4: e-postpåminnelser | Ikke startet |

- **Kode:** `~/Developer/internship-portal` på eierens Mac. Ikke i iCloud, fordi node_modules ga synkroniseringsproblemer.
- **GitHub:** `stn-vibecoder/projectneo`, gren `main`. Repoet er **offentlig**, eieren valgte det selv.
- Alle tester og produksjonsbygget består (`npm run check`, 197 tester, pluss databasetester).

---

## Samarbeid: to eiere

Prosjektet eies av to personer som begge bruker Claude.

- **GitHub-repo:** `stn-vibecoder/projectneo`. Den andre eieren er lagt til som collaborator.
- **Vercel:** prosjektet ligger på `stn-vibecoder` sin Hobby-konto. Testet 12.11.2026: commits fra den andre eierens Claude (via Claude GitHub-appen) bygges og publiseres automatisk. Ingen blokkering.
- **Claude på nett (claude.ai)** får GitHub-tilgang via Claude GitHub-appen. Den er installert på `stn-vibecoder` med tilgang til `projectneo`.
- **Begge kan endre fritt og pushe rett til `main`**, uten godkjenning fra den andre. Hver push til `main` går rett ut på nettsiden.
- **Før hver push:**
  1. Kjør `git pull --rebase` (den andre kan ha pushet i mellomtiden).
  2. Kjør `npm run check`.
  3. Helst også `npm run build`.
  Skriv commit-meldinger på norsk.
- Store eller risikable endringer kan gjerne gjøres på en egen gren først, men det er ikke påkrevd.
- **Hver utvikler har sin egen lokale database** i `.data/` (ikke i git). Det er bare nettsiden som har felles data.
- **Ingen nøkler eller passord trengs lokalt.** Appen kjører i lokal modus uten `.env.local`.

## 3. Eierens beslutninger (skal respekteres)

- **Aldri skrap LinkedIn, Indeed eller Glassdoor.** Bare lovlige kilder: offisielle API-er og RSS.
- **NHHS og Bindeleddet** hentes automatisk på eierens eget ansvar, kun til personlig bruk.
  - Begge ligger bak bryteren `STUDENT_PORTALS_ENABLED`.
  - Henting skal skje sjelden og med generisk User-Agent.
  - Hvis appen blir offentlig eller kommersiell, må dette tas opp igjen og bryteren slås av.
- **Åpen nettside med valgfri innlogging** (besluttet 13.11.2026): alle kan se stillingene, men må logge inn med Google eller e-post for å lagre. Hver bruker har egne data. Eksisterende data fra perioden uten innlogging ble ikke flyttet; alle startet på nytt.
- **Hemmeligheter** ligger bare i `.env.local` eller som miljøvariabler i Vercel, aldri i koden.
  - Repoet er offentlig: sjekk alltid for nøkler før commit.
- **Design:** eieren liker **navy/gull-fargene** og **regnearkløsningen** for søknader svært godt. De skal beholdes.
- **Ingen oppdiktede stillinger.** Seed-stillingene er fjernet.
- **Git:** commit og push bare når eieren ber om det. Attribusjon i commits: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Markedsføring:** ingen logoer eller antydet samarbeid med ekte selskaper. Det gjelder også reklamefilm-materialet i `reklamefilm/`.

---

## 4. Teknologi

- **Next.js 16.4.5** (App Router, Turbopack).
  - `cacheComponents: true` og `partialPrefetching: true` i `next.config.ts`.
  - **Viktig:** dette er nyere enn de fleste modellers treningsdata. Les `node_modules/next/dist/docs/` før du endrer Next-spesifikke ting (se `AGENTS.md`).
  - `src/proxy.ts` erstatter middleware.
- React 19.3, TypeScript, **Tailwind CSS v4** (`@theme inline`, egne `@utility num` / `eyebrow`).
- Øvrige biblioteker:
  - next-intl v4 med fast `nb`-språk. Alle tekster ligger i `src/messages/nb.json`.
  - next-themes for lys/mørk modus.
  - sonner for toasts.
  - dnd-kit for tavla.
  - zod v4.
  - lucide-react v1.
- **Database:**
  - Lokalt: PGlite, som er Postgres kompilert til WebAssembly og kjører inne i Node.
  - På nett: Postgres hos Supabase, via driveren `postgres` (postgres.js).
- Tester: Vitest, og `scripts/verify-db.ts` for triggere og RLS.

---

## 5. Kjøremoduser

Velges automatisk ut fra miljøvariabler (`authMode()` i `src/lib/env.ts`, `src/lib/auth.ts`, `src/lib/db/index.ts`):

| Modus | Når | Hvem ser hva |
|---|---|---|
| **local** | Ingen Supabase-nøkler (Macen), eller `NEXT_PUBLIC_LOGIN=off` | Ingen innlogging. Én fast bruker |
| **optional** (Vercel nå) | Supabase-nøkler finnes | Alle ser feed og stillingssider. Innlogging (Google/e-post) kreves for tracker, Oversikt, kalender, innstillinger og lagring. Hver bruker har egne data |
| **required** | `NEXT_PUBLIC_LOGIN=required` | Innlogging for alt. `ALLOWED_EMAILS` kan begrense hvem |

- **Åpne sider:** `/feed`, `/jobs/<id>`, `/login`, `/auth/*` og `/api/cron` (se `isPublicPath`). Resten sender til `/login?next=…`, og etter innlogging kommer man tilbake dit.
- **Besøkende:** spørringer kjøres med `asAnon()` / `asViewer()` som rollen `anon`. RLS gir bare lesetilgang til felles `jobs` og `companies` (migrasjon `…13000001_public_read`).
- **Standardvalg for besøkende:** alle fire byer og bransjene finans, konsulent og revisjon (`GUEST_PREFS` i `data.ts`).
- **Kilder er felles** og eies av systembrukeren (`SOURCES_OWNER_ID`).
  - Bare administratorer (`ADMIN_EMAILS`) ser Kilder-siden og kan endre den.
  - `requireSourceAdmin()` sjekker rollen og kjører spørringene som systembrukeren.
  - Lokalt er alle administratorer.
- **Eierne har valgt å beholde NHHS og Bindeleddet for alle** (også besøkende) på eget ansvar, selv om nettsiden nå er åpen og ikke lenger kun til personlig bruk.

**Den faste brukeren:**
- id `00000000-0000-4000-8000-000000000001`, definert i `src/lib/db/local-user.ts`.
- På Postgres oppretter `scripts/db-push.ts` brukeren i `auth.users` når innlogging er av.
- En trigger lager så profil, preferanser og 10 standardstatuser.

**Viktige miljøvariabler** (se `.env.example`):

| Variabel | Hva den gjør |
|---|---|
| `DATABASE_URL` / `POSTGRES_URL` | Tilkobling til Postgres. Vercel sin Supabase-integrasjon setter `POSTGRES_URL` |
| `DB_POOL_MAX` | Antall koblinger per instans, standard 3 |
| `CRON_SECRET` | Kreves av `/api/cron/ingest` |
| `NEXT_PUBLIC_LOGIN` | `optional` (standard med Supabase), `required` eller `off` |
| `ADMIN_EMAILS` | Administratorer som styrer de felles kildene |
| `ALLOWED_EMAILS` | Bare i `required`-modus: hvem som får logge inn (tom = alle) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (eller `_PUBLISHABLE_KEY`) | Supabase-nøkler for innlogging |
| `NEXT_PUBLIC_GOOGLE_LOGIN` | Viser Google-knappen |
| `STUDENT_PORTALS_ENABLED` | Henting fra NHHS og Bindeleddet |
| `NAV_FEED_TOKEN` | Egen NAV-token (valgfri) |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Adzuna-nøkler (valgfrie) |
| `DISABLE_AUTO_INGEST` | Slår av den lokale planleggeren |
| `LOCAL_SEED` | Laster inn testdata lokalt |
| `LOCAL_DB_DIR` | Annen mappe for den lokale databasen, f.eks. en kopi til testing |

---

## 6. Database

**Migrasjoner** ligger i `supabase/migrations/`. De er felles for begge modusene og kjøres i navnerekkefølge:

| Fil | Innhold |
|---|---|
| `…08000001_core_schema` | Enums (city, industry, internship_period, job_status, status_category) og tabellene profiles, user_preferences, companies, jobs, application_statuses, applications, application_events, contacts. Triggere for ny bruker, statuslogg og normalisert selskapsnavn. RLS. |
| `…08000002_demo_data_function` | `load_demo_applications()`. Ubrukt nå |
| `…08000003_calendar_events` | Kalenderhendelser: intervju, case, test, info, frist, annet |
| `…08000004_sources` | `sources` (per bruker) og `job_sources` (stilling ↔ kilde) |
| `…08000005_manual_sources_and_cleanup` | Manuelle kilder, `notes`/`sector`, sletter seed-data |
| `…12000001_watchlist_and_rating` | `watchlist` og `applications.rating` (AAA/AA/A/BBB) |
| `…12000002_merge_company_aliases` | Selskapsnavn normaliseres uten parenteser, og duplikater slås sammen |

**Slik kjøres migrasjonene:**
- **Lokalt:** `src/lib/db/bootstrap.ts` legger først inn `supabase/local/auth-stub.sql`, som etterligner Supabase sitt auth-skjema og roller. Deretter kjøres nye migrasjoner automatisk ved oppstart og ved nye filer, med logg i `public._local_migrations`.
- **Postgres/Supabase:** `scripts/db-push.ts` kjøres som en del av `npm run build`. Uten database gjør skriptet ingenting lokalt, men på Vercel feiler det med en tydelig melding. Loggen ligger i `app_private.migrations`, og en advisory lock hindrer at to bygg migrerer samtidig.

**Mønstre i koden:**
- `asUser(userId, fn)` kjører SQL som rollen `authenticated` med `request.jwt.claim.sub` og `request.jwt.claims` satt, så **RLS gjelder alltid**.
- `asService(fn)` er uten RLS og brukes bare til henting av stillinger.
- Rader leses som `select to_jsonb(x) as row` via `sql.rows()` / `sql.row()`, så datoer og lister blir like i begge drivere.
- Lister sendes med `pgArray([...])` pluss cast, f.eks. `$2::city[]`.
- JSON sendes som `JSON.stringify(...)` pluss `::jsonb`.
- Alle 12 tabeller har RLS.
- Felles stillinger og selskaper har `created_by is null`. Manuelt lagt inn har `created_by = brukeren`.

---

## 7. Henting av stillinger (`src/ingest/`)

Flyten: **adapter → `normalizePosting` → `storePostings` → kildestatus.**

1. Adapteren henter stillingene fra kilden.
2. `normalizePosting` gjenkjenner byen og filtrerer på internship-ord.
3. `storePostings` gjør dette:
   - kobler stillingen til kilden via `job_sources`;
   - fjerner duplikater med `dedupe_key` (normalisert selskap|tittel);
   - lukker stillinger som er borte fra alle kildene sine, enten ved komplett eller inkrementell henting.

**Adaptere:**
- `ats.ts`: Greenhouse, Lever, Ashby, BambooHR og Teamtailor (via RSS).
- `portals.ts`: NHHS (HTML) og Bindeleddet (API). Begge bak `STUDENT_PORTALS_ENABLED`.
- `public.ts`: NAV (inkrementell markør), Arbetsförmedlingen/JobTech og Adzuna.

**Øvrige filer:**
- `detect.ts` / `resolve.ts`: gjenkjenner en innlimt lenke og gjetter riktig jobbtavle.
- `csv-import.ts`: CSV-import av en liste karrieresider. Hver rad blir enten en automatisk kilde eller en «følges manuelt»-lenke.
- `src/config/internship-keywords.ts`: ordlistene INCLUDE/EXCLUDE (regex mot tittel).

**Når hentingen kjører:**
- Lokalt starter `src/instrumentation.ts` en henting hver 6. time, første gang etter 60 sekunder.
- På Vercel kjører `vercel.json` cron `0 5 * * *`, altså én gang i døgnet. Vercel Hobby tillater ikke oftere.
- Begge kaller `/api/cron/ingest` med `Authorization: Bearer <secret>`.

`__fixtures__/` inneholder forkortede ekte svar som brukes i testene.

**Eierens lokale data:**
- 13 kilder, deriblant 11 automatiske fra `karrieresider.csv`: ABG, Pareto, Nordea, Investor AB, EQT, Jane Street, Point72, FSN Capital, Summa Equity, Nordic Capital og NHHS.
- I tillegg 71 manuelle kilder, for eksempel Workday-sider som ikke kan hentes.
- Disse ligger bare i den lokale databasen og må importeres på nytt på Vercel (Kilder → Importer liste).

---

## 8. Sider og funksjoner (`src/app/(app)/`)

- **Oversikt** (`dashboard`):
  - dato, ticker, morgenrapport og «Markedet nå»;
  - kurstavle med sparklines og forventede tilbud, vist først når noe er søkt;
  - pipeline-graf, trakt, porteføljeallokering (bransjer), watchlist-tabell, frister, «ikke hørt noe» og kalender.
- **Stillinger** (`feed`):
  - filtre: watchlist, by, bransje, periode, frist og søk;
  - forfallsprofil (graf, skjult når ingen stillinger har frist);
  - kort med «Ny»-merke, stjerne (watchlist) og Lagre-knapp.
  - Hele kortet lenker til `/jobs/[id]`.
- **Stillingsside** (`jobs/[id]`): utlysningstekst, nøkkelinfo og flere stillinger hos samme selskap.
- **Søknader** (`tracker`):
  - **regneark** som standard, med tavle som alternativ;
  - regnearket har faste kolonner, gruppering etter status, redigering direkte i cellene (Enter går ned, Esc angrer), rating-kolonne, beregnede kolonner og summeringslinje;
  - CSV-eksport for norsk Excel (`;` og BOM);
  - detaljside med datoer, kontakter og historikk.
- **Kilder** (`sources`): lim inn lenke → sjekk → legg til; ferdige kilder; CSV-import; «Oppdater alle».
- **Innstillinger:** byer og bransjer, statuser (navn, farge, rekkefølge, egne), «ikke hørt noe»-grense og tema.
- **Legg til stilling** (`jobs/new`): manuell registrering, med «Hent info» fra JSON-LD/OpenGraph.
- **Kalender:** egne hendelser, frister og neste steg. Eksport som `.ics` via `/calendar/export`.
- **Hurtigsøk:** ⌘K / Ctrl+K (`src/components/command-palette.tsx`).

---

## 9. Design

- **Finansstil.** Lys modus:
  - primær **navy `#14315c`**;
  - sidemeny `#0b1626`;
  - **gull `#a8842f`** (mørk modus `#d4b062`).
- **Fonter:**
  - Source Serif 4 til overskrifter;
  - IBM Plex Mono bare til store tall og selskapsmerker;
  - `num` = tabulære sifre i vanlig font, fordi Plex Mono sin 0 lignet 8 i små størrelser.
- **Grafer:** fargene `--viz-1..6` (navy, gull, magenta, fiolett, grønn, oransje) er validert for kontrast.
- **Fargetokens** ligger i `src/app/globals.css`. Tailwind-klassene bruker tokens, ikke hex-verdier.
- **Mobil:** egen fanelinje nederst.
- **Myke overganger:** respekterer `prefers-reduced-motion`.
- **Skjult for søkemotorer:** `noindex` er satt i `src/app/layout.tsx`.

---

## 10. Fallgruver og konvensjoner

- **cacheComponents:**
  - Dynamisk datatilgang må ligge inne i `<Suspense>`. Hver side er bygget som `XContent` inne i `Suspense fallback={<PageSkeleton/>}`.
  - `connection()` kalles før databasekall.
  - `usePathname` holdes inne i Suspense.
  - Ellers kommer advarsler og feil om «instant»- og prerender-validering.
- **React 19 nullstiller ukontrollerte skjema** etter en server action. Redigerbare felter bruker `defaultValue` og en `useEffect` som synkroniserer.
- **Server actions** returnerer `ActionResult` (`ok()` / `fail()`) fra `src/lib/actions/result.ts`.
- **PGlite** serialiserer ikke JS-lister automatisk (bruk `pgArray`) og gir datoer som objekter (les via `to_jsonb`).
- **Én prosess om gangen:** den lokale databasen tåler ikke to `npm run dev` samtidig.
- **Test mot Postgres:** `@electric-sql/pglite-socket` henger på enkelte spørringer og skal ikke brukes. Bruk npm-pakken `embedded-postgres` (ekte Postgres) i en egen mappe utenfor prosjektet.
- **Nettlesertesting:** JavaScript-verktøyet kjører i en isolert kontekst. For å utløse React-hendelser må du injisere et `<script>` eller bruke ekte klikk og tastetrykk.
- **Supabase transaction pooler** krever `prepare: false`. `src/lib/db/url.ts` fjerner parametre postgres.js ikke forstår, som `supa=base-pooler.x`, og slår på SSL.
- **Ny kode skal følge eksisterende mønstre:**
  - tekster i `nb.json`;
  - norske kommentarer;
  - fargetokens;
  - per-side Suspense;
  - `asUser` for all brukerdata.

---

## 11. Deploy til Vercel: ferdig

**Status:**
- Appen kjører på Vercel som prosjektet `projectneo` på eierens Hobby-konto, uten innlogging.
- Databasen er Supabase, opprettet via Vercel → Storage, region Stockholm. Vercel setter `POSTGRES_URL` automatisk.
- `CRON_SECRET` er satt, og kildene hentes én gang i døgnet.
- Hver push til `main` bygger og deployer automatisk. `npm run build` kjører migrasjonene først.

**Standardkilder:**
- `supabase/default-sources.json` inneholder 84 kilder: 13 automatiske og 71 manuelle, eksportert fra eierens lokale database.
- De legges inn én gang for den faste brukeren, sammen med `supabase/default-sources.sql`:
  - på Postgres via `scripts/db-push.ts`, med markøren `__default_sources` i `app_private.migrations`;
  - lokalt via `bootstrap.ts`.
- Slettede kilder kommer ikke tilbake.
- Eieren har bekreftet at kildene vises på nettsiden.

**Kjente forhold:**
- Vercels genererte deploy-adresser (`projectneo-git-main-…`, `projectneo-<hash>-…`) er låst med Vercel Deployment Protection. Produksjonsdomenet under Overview → Domains er åpent.
- JSON-parametre: postgres.js pakket først inn `JSON.stringify(...)` som en JSON-streng. `PG_TYPES` i `src/lib/db/url.ts` sender nå ferdig JSON-tekst uendret, slik PGlite gjør.
- Den lokale databasen og den på nett er **separate**. Søknader på Macen er ikke kopiert til nett.

## 12. Kommandoer

| Kommando | Hva |
|---|---|
| `npm run dev` | Start lokalt på http://localhost:3000 |
| `npm run check` | Typesjekk, lint, enhetstester og databasetester |
| `npm test` | Bare enhetstester |
| `npm run db:verify` | Migrasjoner, triggere og RLS i en database i minnet |
| `npm run db:push` | Migrer databasen i `DATABASE_URL` / `POSTGRES_URL` |
| `npm run build` | `db:push` og deretter `next build` |
| `npm run db:reset` | Slett den lokale databasen (stopp dev-serveren først) |

npm-cachen var tidligere eid av root. Hvis `npm install` feiler med EACCES, bruk `npm_config_cache=~/.npm-cache-ip`.

---

## 13. Mulige neste oppgaver

- **Fase 3:** AI-søknadstips per stilling med Anthropic API.
  - Nøkkel i `ANTHROPIC_API_KEY`, daglig grense i `AI_TIPS_DAILY_LIMIT`.
  - Bruk siste Claude-modell.
- **Fase 4:**
  - e-postpåminnelser om frister;
  - slå på innlogging når eieren ønsker det;
  - eventuelt et skript som kopierer kilder og søknader fra den lokale databasen til Supabase.
- Engelsk språkfil (`src/messages/en.json`).
