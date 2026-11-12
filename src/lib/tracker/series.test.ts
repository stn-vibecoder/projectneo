import { describe, expect, it } from "vitest";
import {
  countSince,
  cumulative,
  deadlineProfile,
  isoWeek,
  milestonesFor,
  responseRateAt,
  responseRateSeries,
  weekStart,
  weeklySeries,
  type Milestones,
} from "./series";

const TODAY = "2026-11-08"; // søndag, uke 45

const ev = (to: string, at: string) => ({ application_id: "a", to_category: to as never, created_at: at });

describe("weekStart / isoWeek", () => {
  it("mandag i samme uke", () => {
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
  });
  it("ISO-ukenummer", () => {
    expect(isoWeek("2026-11-08")).toBe(45);
    expect(isoWeek("2026-12-31")).toBe(53);
    expect(isoWeek("2027-01-04")).toBe(1);
  });
});

describe("milestonesFor", () => {
  it("finner første dato for hver milepæl", () => {
    const m = milestonesFor("2026-10-01", [
      ev("saved", "2026-09-28T10:00:00Z"),
      ev("applied", "2026-10-01T10:00:00Z"),
      ev("screening", "2026-10-10T10:00:00Z"),
      ev("interview", "2026-10-20T10:00:00Z"),
      ev("offer", "2026-11-01T10:00:00Z"),
    ]);
    expect(m).toEqual({
      applied: "2026-10-01",
      responded: "2026-10-10",
      interview: "2026-10-20",
      offer: "2026-11-01",
      rejected: null,
    });
  });
  it("avslag teller som svar", () => {
    const m = milestonesFor(null, [ev("applied", "2026-10-01T10:00:00Z"), ev("rejected", "2026-10-15T10:00:00Z")]);
    expect(m.applied).toBe("2026-10-01");
    expect(m.responded).toBe("2026-10-15");
    expect(m.rejected).toBe("2026-10-15");
    expect(m.interview).toBeNull();
  });
  it("bruker Oslo-tid (sent på kvelden UTC er neste dag i Oslo)", () => {
    expect(milestonesFor(null, [ev("applied", "2026-10-01T23:30:00Z")]).applied).toBe("2026-10-02");
  });
});

const ms = (p: Partial<Milestones>): Milestones => ({
  applied: null,
  responded: null,
  interview: null,
  offer: null,
  rejected: null,
  ...p,
});

describe("weeklySeries", () => {
  const all = [
    ms({ applied: "2026-11-03", responded: "2026-11-06" }),
    ms({ applied: "2026-11-04" }),
    ms({ applied: "2026-10-27", interview: "2026-11-02" }),
    ms({ applied: "2026-08-05" }), // eldre enn 12 uker -> utvider vinduet
  ];
  const s = weeklySeries(all, TODAY, 12);

  it("starter ved første aktivitet og slutter i inneværende uke", () => {
    expect(s.weeks[0]).toBe("2026-08-03");
    expect(s.weeks.at(-1)).toBe("2026-11-02");
  });
  it("teller per uke", () => {
    expect(s.applied.at(-1)).toBe(2);
    expect(s.applied.at(-2)).toBe(1);
    expect(s.applied[0]).toBe(1);
    expect(s.interview.at(-1)).toBe(1);
  });
  it("minst 12 uker uten gammel aktivitet", () => {
    expect(weeklySeries([ms({ applied: "2026-11-03" })], TODAY, 12).weeks).toHaveLength(12);
  });
  it("kumulativ sum og svarrate", () => {
    expect(cumulative([1, 0, 2])).toEqual([1, 1, 3]);
    expect(responseRateSeries(s).at(-1)).toBe(25);
  });
});

describe("countSince / responseRateAt", () => {
  const all = [ms({ applied: "2026-11-08" }), ms({ applied: "2026-11-02" }), ms({ applied: "2026-10-01", responded: "2026-10-20" })];
  it("siste 7 dager inkluderer i dag, ikke 7 dager siden", () => {
    expect(countSince(all, "applied", TODAY, 7)).toBe(2);
    expect(countSince(all, "applied", TODAY, 6)).toBe(1);
  });
  it("svarrate på en dato", () => {
    expect(responseRateAt(all, "2026-10-25")).toBe(100);
    expect(responseRateAt(all, TODAY)).toBe(33);
    expect(responseRateAt(all, "2026-09-01")).toBeNull();
  });
});

describe("deadlineProfile", () => {
  it("frister per uke fremover, senere og uten frist", () => {
    const p = deadlineProfile(["2026-11-08", "2026-11-09", "2026-11-20", "2026-11-01", "2027-03-01", null], TODAY, 4);
    expect(p.buckets.map((b) => b.week)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(p.buckets.map((b) => b.count)).toEqual([1, 1, 1, 0]);
    expect(p.later).toBe(1);
    expect(p.none).toBe(1);
  });
});
