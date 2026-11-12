import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildCalendarItems,
  itemsByDate,
  monthGrid,
  nextPlannedByApplication,
  shortTime,
  upcomingItems,
  type CalendarAppRow,
  type CalendarEventRow,
} from "./calendar";

const app = (p: Partial<CalendarAppRow> & Pick<CalendarAppRow, "id" | "category">): CalendarAppRow => ({
  archived: false,
  appliedAt: null,
  deadline: null,
  nextStep: null,
  nextStepAt: null,
  company: "Nordvik Capital",
  jobTitle: "Summer Analyst",
  ...p,
});

const event = (p: Partial<CalendarEventRow> & Pick<CalendarEventRow, "id" | "date">): CalendarEventRow => ({
  application_id: null,
  type: "interview",
  title: null,
  start_time: null,
  notes: null,
  company: null,
  job_title: null,
  ...p,
});

describe("monthGrid", () => {
  it("november 2026 starter på søndag -> første uke begynner mandag 26. okt.", () => {
    const g = monthGrid(2026, 10);
    expect(g[0][0]).toBe("2026-10-26");
    expect(g[0][6]).toBe("2026-11-01");
    expect(g.at(-1)!.at(-1)).toBe("2026-12-06");
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
  it("februar 2027 (starter mandag) har fire hele uker", () => {
    const g = monthGrid(2027, 1);
    expect(g).toHaveLength(4);
    expect(g[0][0]).toBe("2027-02-01");
    expect(g[3][6]).toBe("2027-02-28");
  });
  it("skuddår", () => {
    expect(monthGrid(2028, 1).flat()).toContain("2028-02-29");
  });
});

describe("addMonths", () => {
  it("over årsskiftet", () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2027, 0, -1)).toEqual({ year: 2026, month: 11 });
    expect(addMonths(2026, 10, -13)).toEqual({ year: 2025, month: 9 });
  });
});

describe("shortTime", () => {
  it("kutter sekunder", () => expect(shortTime("09:30:00")).toBe("09:30"));
  it("null", () => expect(shortTime(null)).toBeNull());
});

describe("buildCalendarItems", () => {
  const items = buildCalendarItems(
    [
      event({ id: "e1", date: "2026-11-12", start_time: "14:00:00", application_id: "a2", company: "Fjell & Berg" }),
      event({ id: "e2", date: "2026-11-12", start_time: "09:00:00", type: "info", title: "Bedriftspresentasjon" }),
    ],
    [
      app({ id: "a1", category: "saved", deadline: "2026-11-20" }),
      app({ id: "a2", category: "interview", appliedAt: "2026-10-01", nextStep: "Case", nextStepAt: "2026-11-14" }),
      app({ id: "a3", category: "applied", appliedAt: "2026-10-01", deadline: "2026-11-15" }), // søkt: ingen frist
      app({ id: "a4", category: "rejected", nextStepAt: "2026-11-13" }), // avsluttet
      app({ id: "a5", category: "saved", deadline: "2026-11-21", archived: true }), // arkivert
    ],
  );

  it("tar med egne hendelser, frister for lagrede og neste steg", () => {
    expect(items.map((i) => i.key)).toEqual(["event:e2", "event:e1", "next:a2", "deadline:a1"]);
  });
  it("sorterer på dato og klokkeslett", () => {
    expect(items[0].time).toBe("09:00");
    expect(items[1].time).toBe("14:00");
  });
  it("frist får riktig type og selskap", () => {
    const d = items.find((i) => i.key === "deadline:a1")!;
    expect(d.type).toBe("app_deadline");
    expect(d.company).toBe("Nordvik Capital");
    expect(d.eventId).toBeNull();
  });
  it("grupperer per dato", () => {
    expect(itemsByDate(items).get("2026-11-12")).toHaveLength(2);
  });
  it("kommende fra en dato", () => {
    expect(upcomingItems(items, "2026-11-13", 10).map((i) => i.key)).toEqual(["next:a2", "deadline:a1"]);
  });
  it("planlagte datoer per søknad (bare egne hendelser, ikke passerte)", () => {
    expect(nextPlannedByApplication(items, "2026-11-08").get("a2")).toBe("2026-11-12");
    expect(nextPlannedByApplication(items, "2026-11-13").has("a2")).toBe(false);
  });
});
