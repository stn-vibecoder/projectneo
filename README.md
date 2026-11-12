# Internship-portalen

Finn internships i Oslo, Stockholm, New York og London, følg søknadene dine og få
søknadstips for hver stilling. Første versjon er laget for økonomistudenter
(bank/finans/IB, konsulent og revisjon).

**Status:** Fase 1 og 2 er ferdige og kjører i **lokal modus**: ingen innlogging og
ingen konto. Databasen ligger på maskinen din. Supabase og innlogging kobles på
når appen nærmer seg ferdig.

## Kom i gang

```bash
cd ~/Developer/internship-portal
npm install        # bare første gang
npm run dev
```

Åpne <http://localhost:3000>. Første gang går du gjennom onboarding (byer og
bransjer), og så er du inne.

- Dataene lagres i mappen `.data/` og blir liggende til neste gang.
- Vil du starte helt på nytt: stopp serveren (Ctrl+C) og kjør `npm run db:reset`.
- Stillingene kommer fra kildene dine (se «Kilder» under). Oppdiktede
  teststillinger lastes bare inn hvis du starter med `LOCAL_SEED=true npm run dev`.

## Slik tester du fase 1

1. **Onboarding:** Velg for eksempel Oslo og London. Bank/finans, konsulent og
   revisjon er forhåndsvalgt.
2. **Feed:** Stillinger i byene og bransjene dine, sortert på frist. Test filtrene.
   Velg «Alle bransjer» for å se tech- og industristillinger også.
3. **Lagre:** Klikk «Lagre» på en stilling. Den havner under «Lagret» i trackeren.
4. **Eksempeldata:** Klikk «Fyll med eksempeldata» under Søknader.
5. **Tavle:** Dra kort mellom kolonnene (på mobil: hold inne, eller bruk
   statusvelgeren på kortet). Første flytt ut av «Lagret» setter søknadsdato automatisk.
6. **Tabell:** Sorter på kolonner og filtrer på status eller fritekst.
7. **Detaljside:** Datoer, neste steg, lenker til CV og søknad, notater,
   kontaktpersoner og historikk. Alle statusendringer logges automatisk.
8. **Dashboard:** Antall søkt, svarrate, intervjuer, tilbud, trakt, kommende
   frister, neste steg og «ikke hørt noe på X dager». X kan endres under Innstillinger.
9. **Manuell stilling:** «Legg til stilling». Lim inn en lenke og trykk «Hent info».
   Mange karrieresider har strukturerte data som fyller ut feltene.
10. **Innstillinger:** Endre byer og bransjer, gi statuser nytt navn, bytt farge,
    endre rekkefølge, legg til egne statuser. Bytt mellom lys og mørk modus.

## Kilder (automatisk henting av stillinger)

Under **Kilder** i menyen bestemmer du hvor appen leter:

- **Lim inn en lenke** til en karriereside eller jobbtavle og trykk **Sjekk**.
  Appen finner ut hva slags side det er, prøvehenter og viser hvor mange
  internships den har i byene dine. Velg bransje og trykk **Legg til og hent**.
- **Ferdige kilder:** NHHS, Bindeleddet, NAV (Oslo), Arbetsförmedlingen
  (Stockholm) og Adzuna (London/New York, trenger gratis nøkkel).
- **Importer liste:** lim inn eller velg en CSV (selskap, sektor, byer, url,
  merknad). Hver rad blir enten en kilde som hentes automatisk, eller en lenke
  under **Følges manuelt** (med grunnen, f.eks. Workday) som du sjekker selv.
- **Oppdater alle** henter alt på nytt. Mens appen kjører hentes alle kilder
  automatisk hver 6. time (første gang ett minutt etter oppstart).

| Type | Hvordan | Merknad |
|---|---|---|
| Greenhouse, Lever, Ashby | Offisielle, åpne API-er | Lim inn f.eks. `boards.greenhouse.io/selskap` |
| Teamtailor | Karrieresidens RSS-feed | Fungerer også på egne domener |
| BambooHR | Karrieresidens åpne stillingsliste | F.eks. `selskap.bamboohr.com/careers` |
| NHHS, Bindeleddet | Leser stillingslisten | Kun personlig bruk, kan slås av (`STUDENT_PORTALS_ENABLED=false`) |
| NAV | Offisiell stillingsfeed | Inkrementell; uten egen token brukes NAVs offentlige testtoken |
| Arbetsförmedlingen | JobSearch-API (åpne data) | Ingen nøkkel |
| Adzuna | Offisielt API | Krever `ADZUNA_APP_ID`/`ADZUNA_APP_KEY`, og Adzuna skal krediteres |
| Workday, Oracle, SuccessFactors, LinkedIn, Indeed | Ikke støttet | Ingen åpne API-er / vilkår forbyr henting. Legg inn manuelt |

Hva som regnes som internship styres av ordlistene i
`src/config/internship-keywords.ts`. Stillinger som forsvinner fra alle kildene
sine markeres som **stengt** (de slettes ikke, så trackeren beholder dem).
Samme stilling fra flere kilder vises bare én gang.

## Nyttige funksjoner

- **Hurtigsøk (⌘K / Ctrl+K):** hopp til en side, søknad eller åpen stilling.
- **Stillingsside:** klikk på en stilling i feeden for hele utlysningen og andre stillinger hos selskapet.
- **Watchlist:** stjernen ved et selskap følger det. Egen tabell på Oversikt og eget filter i feeden.
- **Rating:** egen prioritering per søknad i kredittrating-stil (AAA = drømmejobb … BBB = reserve). Kolonne i regnearket.
- **Morgenrapport** og **Markedet nå** øverst på Oversikt: hva som haster, nye stillinger og frister.
- **Forventede tilbud:** sannsynlighetsvektet anslag (`expectedOffers` i `src/lib/tracker/status-logic.ts`). Bruker egne tall når minst 8 søknader har nådd et trinn.
- **Kalendereksport:** nedlastingsikonet i kalenderen gir en `.ics`-fil for Google/Apple/Outlook.

## Kommandoer

| Kommando | Hva |
|---|---|
| `npm run dev` | Start appen på <http://localhost:3000> |
| `npm run db:reset` | Slett den lokale databasen (stopp `npm run dev` først) |
| `npm test` | Enhetstester (statuslogikk, dashboard-beregninger, normalisering) |
| `npm run db:verify` | Migrasjoner + seed i en database i minnet, med tester av triggere og RLS |
| `npm run check` | Typesjekk, lint og alle tester |
| `npm run build` | Produksjonsbygg |
| `npm run db:push` | Kjør migrasjonene mot databasen i `DATABASE_URL` (skjer automatisk på Vercel) |

## Teknologi

- Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind CSS v4
- Postgres. Lokalt via **PGlite** (Postgres kompilert til WebAssembly, kjører inne
  i Node), senere **Supabase**. Samme SQL, migrasjoner og RLS i begge.
- dnd-kit (dra-og-slipp), next-intl (norsk nå, klar for engelsk), zod, Vitest

## Struktur

```
src/
  app/
    (onboarding)/       Byvalg og preferanser for nye brukere
    (app)/              Dashboard, feed, tracker, jobs/new, settings
    (auth)/login, auth/ Innlogging med Supabase (inaktiv i lokal modus)
  components/           UI-komponenter (ui/ = knapper, skjema, kort)
  lib/
    db/                 Databasetilkobling (PGlite) og oppsett av skjema
    auth.ts             Hvem er innlogget (lokal modus: én fast bruker)
    actions/            Server actions (all skriving går hit)
    tracker/            Statuslogikk og datoer (rene funksjoner + tester)
    data.ts             Lesing fra databasen
    normalize.ts        By-, periode- og selskapsnormalisering (deles med fase 2)
    job-posting.ts      Leser stillingsinfo (JSON-LD/OpenGraph) fra en side
  messages/nb.json      Alle tekster. Legg til en.json for engelsk
supabase/
  migrations/           Skjema, triggere, RLS og demodata-funksjon
  seed.sql              Testdata (stillinger og selskaper)
  local/auth-stub.sql   Etterligner Supabase-auth lokalt
scripts/verify-db.ts    Databasetester
```

## Datamodell (kort)

- `profiles`, `user_preferences`: profil og byer/bransjer/perioder
- `companies`, `jobs`: felles (hentet / seed) eller private (manuelt lagt inn)
- `application_statuses`: egendefinerte statuser per bruker. Hver status har en
  fast **kategori** som dashboardet regner på
- `applications`: én per bruker per stilling
- `application_events`: statushistorikk (skrives av en databasetrigger) og notater
- `contacts`: kontaktpersoner per søknad

All SQL kjøres som rollen `authenticated` med brukerens id satt, også lokalt, så
tilgangsreglene (RLS) testes hele veien.

## Legge appen ut på nett (Vercel)

Appen kan ligge på Vercel **uten innlogging**, som finansterminalen. Den trenger
en database på nett for å huske dataene. Den lages inne i Vercel:

1. **Importer repoet:** vercel.com → *Add New → Project* → velg `projectneo` → **Deploy**.
   Første bygg feiler med «Fant ingen database». Det er forventet.
2. **Lag databasen:** prosjektet i Vercel → **Storage** → *Create Database* →
   **Supabase** → region **Stockholm (eu-north-1)** → *Create* → **Connect** til prosjektet.
   Vercel legger inn tilkoblingen (`POSTGRES_URL`) selv.
3. **Nøkkel for daglig henting:** *Settings → Environment Variables* → legg til
   `CRON_SECRET` med en lang, tilfeldig tekst (f.eks. 40 tilfeldige bokstaver og tall).
4. **Bygg på nytt:** *Deployments* → de tre prikkene på siste bygg → **Redeploy**.
   Byggingen kjører databasemigrasjonene automatisk (`scripts/db-push.ts`).
5. Åpne lenken, gå gjennom oppstarten og legg inn kildene på nytt (Kilder →
   ferdige kilder, og **Importer liste** med `karrieresider.csv`).

Det som skjer på Vercel:

- Alle kilder hentes **én gang i døgnet** (Vercel Hobby tillater ikke oftere).
  Trykk «Oppdater alle» under Kilder for å hente med en gang.
- Siden er skjult for søkemotorer (`noindex`), men **alle med lenken kommer inn**
  og kan endre dataene. Ikke del lenken offentlig.
- Lokalt (`npm run dev`) brukes fortsatt databasen på Macen. Den er ikke koblet
  til den på nett.

**Slå på innlogging senere:** sett `NEXT_PUBLIC_REQUIRE_LOGIN=true`,
`ALLOWED_EMAILS=din@epost.no` og (hvis ikke Vercel har lagt dem inn)
`NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_ANON_KEY`, og bygg på nytt.
I Supabase: *Authentication → URL Configuration* → sett **Site URL** til
Vercel-lenken. Bare e-postene på listen kan lage konto og logge inn.

## Kjente forhold

- **npm-cache:** `~/.npm` har mapper som eies av root (fra en tidligere `sudo npm`).
  Fiks det med `sudo chown -R $(id -u):$(id -g) ~/.npm`.
- **Én prosess om gangen:** Den lokale databasen kan bare brukes av én prosess.
  Ikke kjør `npm run dev` i to terminaler samtidig.
- **Studentportaler (fase 2):** Henting fra NHHS og Bindeleddet er bare til
  personlig bruk og kan slås av med en bryter i config.

## Neste faser

3. AI-søknadstips med Anthropic API
4. E-postpåminnelser, CSV-eksport, Supabase + innlogging, finpuss og deploy til Vercel

