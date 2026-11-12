import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { isInternshipTitle } from "@/config/internship-keywords";
import { bootstrap, LOCAL_USER } from "@/lib/db/bootstrap";
import { wrap } from "@/lib/db/sql";
import { parseAshby, parseGreenhouse, parseLever, parseTeamtailor } from "./adapters/ats";
import { parseBindeleddet, parseNhhs } from "./adapters/portals";
import { parseAdzuna, parseJobTech, parseNavEntry, scanNavPage } from "./adapters/public";
import { dedupeKey, normalizePosting } from "./normalize";
import { storePostings } from "./store";
import type { RawPosting, SourceConfig } from "./types";

const fx = (name: string) => readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");
const json = (name: string) => JSON.parse(fx(name));
const source = (p: Partial<SourceConfig> = {}): SourceConfig => ({
  id: "s1",
  type: "greenhouse",
  identifier: "x",
  name: "Testselskap",
  url: null,
  industry: "finance",
  state: {},
  ...p,
});

describe("internship-filter", () => {
  it.each([
    "Summer Analyst Intern 2027",
    "Investment Banking Summer Analyst",
    "Software Engineering Intern",
    "Sommerjobb 2027 – analyse",
    "Sommarpraktik ekonomi",
    "Praktikant – Kapitalförvaltning",
    "Graduate Trainee Programme",
    "Winternship – Strategy",
    "Off-cycle Internship, Markets",
    "Spring Week 2027",
    "HR Intern",
    "Praktik inom rekrytering och konsultmatchning",
    "LIA-praktik inom Lön, vt 2027",
    "Praktikplats Grafisk designer",
    "Summer Placement – Audit",
  ])("tar med «%s»", (t) => expect(isInternshipTitle(t)).toBe(true));

  it.each([
    "Senior Software Engineer",
    "Internal Audit Manager",
    "International Sales Lead",
    "Internrevisor",
    "Intern utlysning: Rådgiver",
    "Sommervikar barnehage",
    "Internship Program Manager",
    "Customer Success Manager - Finnish speaking",
    "Receptionist till intern reception på bank i city (vikariat)",
    "Tandhygienist till liten och trivsam praktik i Hässelby Strand.",
  ])("hopper over «%s»", (t) => expect(isInternshipTitle(t)).toBe(false));
});

describe("normalizePosting", () => {
  const base: RawPosting = { externalId: "1", title: "Summer Analyst 2027", company: "Nordvik Capital ASA", locations: ["London, UK"], url: "u" };
  it("beholder internships i byene vi følger", () => {
    const n = normalizePosting(base, source())!;
    expect(n.cities).toEqual(["london"]);
    expect(n.period).toBe("summer");
    expect(n.industry).toBe("finance");
    expect(n.dedupeKey).toBe("nordvik capital|summer analyst 2027");
  });
  it("forkaster andre byer", () => {
    expect(normalizePosting({ ...base, locations: ["Dublin"] }, source())).toBeNull();
  });
  it("forkaster ikke-internships uten hint", () => {
    expect(normalizePosting({ ...base, title: "Associate" }, source())).toBeNull();
  });
  it("internship-hint fra kilden overstyrer tittelfilteret", () => {
    expect(normalizePosting({ ...base, title: "Associate", internshipHint: true }, source())).not.toBeNull();
  });
  it("bruker tittelen når sted mangler", () => {
    expect(normalizePosting({ ...base, title: "Intern – Oslo", locations: [] }, source())?.cities).toEqual(["oslo"]);
  });
  it("samme stilling fra to kilder gir samme nøkkel", () => {
    expect(dedupeKey("Nordvik Capital AS", "Summer Analyst – 2027")).toBe(dedupeKey("Nordvik Capital", "summer analyst - 2027"));
  });
});

describe("adaptere (ekte svar, nedkortet)", () => {
  it("Greenhouse", () => {
    const r = parseGreenhouse(json("greenhouse.json"), source({ name: "Stripe" }));
    expect(r.complete).toBe(true);
    expect(r.postings).toHaveLength(3);
    const intern = r.postings.find((p) => p.externalId === "999001")!;
    expect(intern).toMatchObject({ title: "Summer Analyst Intern 2027", company: "Stripe", deadline: "2026-12-01" });
    expect(intern.locations).toContain("London, UK");
    expect(r.postings[0].description).not.toContain("&lt;");
  });
  it("Lever", () => {
    const r = parseLever(json("lever.json"), source({ name: "Palantir" }));
    const intern = r.postings.find((p) => p.externalId === "intern-1")!;
    expect(intern.internshipHint).toBe(true);
    expect(intern.locations).toEqual(["New York, NY", "London, United Kingdom"]);
  });
  it("Ashby", () => {
    const r = parseAshby(json("ashby.json"), source({ name: "Ramp" }));
    expect(r.postings.find((p) => p.externalId === "ashby-intern")?.internshipHint).toBe(true);
    expect(r.postings[0].locations.length).toBeGreaterThan(0);
  });
  it("Teamtailor (RSS)", () => {
    const r = parseTeamtailor(fx("teamtailor.xml"), source({ name: "Teamtailor" }));
    expect(r.postings).toHaveLength(3);
    expect(r.postings[0].locations[0]).toMatch(/Stockholm/);
    expect(r.postings[2].title).toBe("Summer Internship 2027 – Business Analyst");
  });
  it("NHHS", () => {
    const r = parseNhhs(fx("nhhs.html"));
    expect(r.postings.length).toBeGreaterThan(3);
    const p = r.postings[0];
    expect(p.url).toMatch(/^https:\/\/www\.nu\.nhhs\.no\/jobs\/\d+\/details$/);
    expect(r.postings.some((x) => x.internshipHint)).toBe(true);
  });
  it("Bindeleddet", () => {
    const r = parseBindeleddet(json("bindeleddet.json"));
    expect(r.postings.filter((p) => p.internshipHint).length).toBeGreaterThanOrEqual(3);
    expect(r.postings.every((p) => p.url)).toBe(true);
  });
  it("Arbetsförmedlingen", () => {
    const hits = parseJobTech(json("jobtech.json").hits);
    expect(hits[0].locations[0]).toBe("Stockholm");
    expect(hits[0].deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("NAV: velger Oslo-internships og fanger opp inaktive", () => {
    const scan = scanNavPage(json("nav-feed.json"));
    expect(scan.wanted).toEqual(["nav-intern-1"]);
    expect(scan.removed).toContain("nav-old-1");
    const p = parseNavEntry(json("nav-entry.json"))!;
    expect(p).toMatchObject({ externalId: "nav-intern-1", company: "Testbanken ASA", deadline: "2026-11-20" });
    expect(p.locations).toContain("OSLO");
  });
  it("Adzuna", () => {
    const r = parseAdzuna([
      { id: "a1", title: "<strong>Summer</strong> Intern", redirect_url: "https://x", company: { display_name: "Bank" }, location: { display_name: "London, UK", area: ["UK", "London"] } },
    ]);
    expect(r[0].title).toBe("Summer Intern");
  });
});

describe("lagring (Postgres i minnet)", () => {
  let db: PGlite;
  const SRC = "00000000-0000-4000-8000-0000000000aa";
  const SRC2 = "00000000-0000-4000-8000-0000000000bb";

  beforeAll(async () => {
    db = await PGlite.create();
    await bootstrap(db, path.join(__dirname, "..", ".."), { seed: false, localUser: true, defaultSources: false });
    await db.query(
      `insert into sources (id, user_id, type, identifier, name) values ($1, $3, 'greenhouse', 'a', 'A'), ($2, $3, 'lever', 'b', 'B')`,
      [SRC, SRC2, LOCAL_USER.id],
    );
  }, 60_000);

  const posting = (id: string, title: string, company = "Nordvik Capital") =>
    normalizePosting({ externalId: id, title, company, locations: ["Oslo"], url: `https://x/${id}` }, { industry: "finance" })!;

  const count = async (where: string) =>
    (await db.query<{ n: number }>(`select count(*)::int as n from jobs where ${where}`)).rows[0].n;

  it("setter inn nye stillinger og selskap", async () => {
    const s = await db.transaction((tx) =>
      storePostings(wrap(tx), SRC, "greenhouse", [posting("1", "Summer Analyst 2027"), posting("2", "Winternship 2027")], { complete: true }),
    );
    expect(s.inserted).toBe(2);
    expect(await count("source = 'greenhouse' and status = 'open'")).toBe(2);
  });

  it("oppdaterer kjente uten duplikater", async () => {
    const s = await db.transaction((tx) =>
      storePostings(wrap(tx), SRC, "greenhouse", [posting("1", "Summer Analyst 2027"), posting("2", "Winternship 2027")], { complete: true }),
    );
    expect(s).toMatchObject({ inserted: 0, updated: 2 });
    expect(await count("source = 'greenhouse'")).toBe(2);
  });

  it("kobler samme stilling fra en annen kilde i stedet for å lage duplikat", async () => {
    const s = await db.transaction((tx) =>
      storePostings(wrap(tx), SRC2, "lever", [posting("x", "Summer Analyst 2027", "Nordvik Capital AS")], { complete: true }),
    );
    expect(s).toMatchObject({ inserted: 0, linked: 1 });
    expect(await count("dedupe_key = 'nordvik capital|summer analyst 2027'")).toBe(1);
  });

  it("stenger stillinger som forsvinner – men bare når de er borte fra alle kilder", async () => {
    const s = await db.transaction((tx) =>
      storePostings(wrap(tx), SRC, "greenhouse", [], { complete: true }),
    );
    // «Winternship» fantes bare i kilde A -> stengt. «Summer Analyst» finnes fortsatt i kilde B -> åpen.
    expect(s.closed).toBe(1);
    expect(await count("title = 'Winternship 2027' and status = 'closed'")).toBe(1);
    expect(await count("title = 'Summer Analyst 2027' and status = 'open'")).toBe(1);
  });

  it("gjenåpner en stilling som dukker opp igjen", async () => {
    await db.transaction((tx) => storePostings(wrap(tx), SRC, "greenhouse", [posting("2", "Winternship 2027")], { complete: true }));
    expect(await count("title = 'Winternship 2027' and status = 'open'")).toBe(1);
  });

  it("inkrementelle kilder stenger bare oppgitte id-er", async () => {
    await db.transaction((tx) =>
      storePostings(wrap(tx), SRC2, "lever", [], { complete: false, removedIds: [] }),
    );
    expect(await count("title = 'Summer Analyst 2027' and status = 'open'")).toBe(1);
    await db.transaction((tx) =>
      storePostings(wrap(tx), SRC2, "lever", [], { complete: false, removedIds: ["x"] }),
    );
    // Fortsatt åpen fordi kilde A ikke har den aktiv? Den ble deaktivert i A tidligere -> nå stengt.
    expect(await count("title = 'Summer Analyst 2027' and status = 'closed'")).toBe(1);
  });
});

describe("BambooHR", () => {
  it("leser stillingslista", async () => {
    const { parseBamboo } = await import("./adapters/ats");
    const r = parseBamboo(JSON.parse(fx("bamboohr.json")), source({ name: "Summa Equity", identifier: "summaequity" }));
    expect(r.postings).toHaveLength(3);
    const sth = r.postings.find((p) => p.externalId === "999")!;
    expect(sth.url).toBe("https://summaequity.bamboohr.com/careers/999");
    expect(normalizePosting(sth, source())?.cities).toEqual(["stockholm"]);
  });
});
