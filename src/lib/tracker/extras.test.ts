import { describe, expect, it } from "vitest";
import { buildBrief } from "./brief";
import { toIcs } from "./ics";
import { expectedOffers, MIN_SAMPLE, type AppForMetrics } from "./status-logic";

const TODAY = "2026-11-12";
const app = (p: Partial<AppForMetrics> & Pick<AppForMetrics, "category">): AppForMetrics => ({
  id: Math.random().toString(36),
  history: [],
  appliedAt: "2026-10-01",
  lastActivityAt: "2026-11-01T10:00:00Z",
  deadline: null,
  nextStepAt: null,
  ...p,
});

describe("expectedOffers", () => {
  it("bruker standardanslag med lite historikk", () => {
    const r = expectedOffers([app({ category: "applied" }), app({ category: "interview" }), app({ category: "offer" })]);
    expect(r).toEqual({ expected: 1.4, calibrated: false }); // 0.05 + 0.30 + 1 = 1.35 -> 1.4
  });
  it("teller ikke lagrede, avsluttede eller arkiverte", () => {
    const r = expectedOffers([
      app({ category: "saved" }),
      app({ category: "rejected" }),
      app({ category: "withdrawn" }),
      app({ category: "accepted" }),
      app({ category: "interview", archived: true }),
    ]);
    expect(r.expected).toBe(0);
  });
  it("kalibrerer mot egne tall når nok søknader har nådd trinnet", () => {
    // 10 har søkt, 2 av dem fikk tilbud -> 20 % per aktiv «søkt».
    const apps = [
      ...Array.from({ length: MIN_SAMPLE - 3 }, () => app({ category: "rejected", history: ["applied", "rejected"] })),
      app({ category: "accepted", history: ["applied", "interview", "offer", "accepted"] }),
      app({ category: "declined", history: ["applied", "offer", "declined"] }),
      app({ category: "applied" }),
      app({ category: "applied" }),
      app({ category: "applied" }),
    ];
    const r = expectedOffers(apps);
    expect(r.calibrated).toBe(true);
    expect(r.expected).toBe(0.6); // 3 × (2 / 10)
  });
});

describe("buildBrief", () => {
  const base = {
    today: TODAY,
    savedDeadlines: [],
    calendar: [],
    followUps: [],
    openJobs: [],
    watchedCompanyIds: new Set<string>(),
  };
  it("er tom når ingenting haster", () => {
    expect(buildBrief(base)).toEqual([]);
  });
  it("prioriterer frister og dagens avtaler først", () => {
    const items = buildBrief({
      ...base,
      savedDeadlines: [
        { company: "EQT", deadline: "2026-11-14" },
        { company: "Point72", deadline: "2026-11-30" }, // for langt frem
        { company: "FSN", deadline: "2026-11-10" }, // passert
      ],
      calendar: [
        { date: TODAY, label: "Intervju – ABG" },
        { date: "2026-11-13", label: "Case – BCG" },
      ],
      followUps: [{ company: "Nordea" }],
      openJobs: [
        { firstSeen: "2026-11-11T08:00:00Z", company: "EQT", companyId: "c1" },
        { firstSeen: "2026-11-12T08:00:00Z", company: "Summa", companyId: "c2" },
        { firstSeen: "2026-11-01T08:00:00Z", company: "Gammel", companyId: "c3", deadline: "2026-11-13" },
        { firstSeen: "2026-11-01T08:00:00Z", company: "Lagret", companyId: "c4", deadline: "2026-11-13", saved: true },
      ],
      watchedCompanyIds: new Set(["c1"]),
    });
    expect(items.map((i) => i.kind)).toEqual(["deadline", "today", "tomorrow", "followup", "closing", "watchlist", "new_jobs"]);
    expect(items[4]).toMatchObject({ count: 1, names: ["Gammel"] });
    expect(items[0]).toMatchObject({ count: 1, names: ["EQT"], tone: "urgent" });
    expect(items[5]).toMatchObject({ count: 1, names: ["EQT"] });
    expect(items[6].count).toBe(2);
  });
});

describe("toIcs", () => {
  const now = new Date("2026-11-12T09:00:00Z");
  it("lager heldagshendelser og hendelser med klokkeslett", () => {
    const ics = toIcs(
      [
        { uid: "a", date: "2026-11-20", time: null, summary: "Søknadsfrist: EQT; Stockholm, PE" },
        { uid: "b", date: "2026-11-18", time: "10:30", summary: "Intervju – ABG", description: "Linje 1\nLinje 2" },
        { uid: "c", date: "2026-12-31", time: "23:30", summary: "Sent" },
      ],
      now,
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261121");
    expect(ics).toContain("SUMMARY:Søknadsfrist: EQT\; Stockholm\\, PE");
    expect(ics).toContain("DTSTART;TZID=Europe/Oslo:20261118T103000\r\nDTEND;TZID=Europe/Oslo:20261118T113000");
    expect(ics).toContain("DESCRIPTION:Linje 1\\nLinje 2");
    expect(ics).toContain("DTEND;TZID=Europe/Oslo:20270101T003000");
    expect(ics).toContain("DTSTAMP:20261112T090000Z");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });
  it("bryter lange linjer", () => {
    const ics = toIcs([{ uid: "x", date: "2026-11-20", time: null, summary: "A".repeat(200) }], now);
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});
