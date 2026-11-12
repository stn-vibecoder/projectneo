/**
 * Kalender: samler egne hendelser, søknadsfrister og «neste steg» til én
 * liste, og lager månedsrutenett. Rene funksjoner (se calendar.test.ts).
 */
import type { StatusCategory } from "@/lib/domain";
import { isActiveCategory } from "./status-logic";
import { daysBetween } from "./dates";

export const CALENDAR_EVENT_TYPES = ["interview", "assessment", "test", "info", "deadline", "other"] as const;
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

/** Type slik den vises: egne typer + avledede (søknadsfrist og neste steg). */
export type CalendarItemType = CalendarEventType | "app_deadline" | "next_step";

export type CalendarItem = {
  key: string;
  type: CalendarItemType;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  title: string | null; // null = vis typenavnet
  company: string | null;
  jobTitle: string | null;
  applicationId: string | null;
  eventId: string | null; // satt for egne hendelser (kan slettes)
  notes: string | null;
};

export type CalendarEventRow = {
  id: string;
  application_id: string | null;
  type: CalendarEventType;
  title: string | null;
  date: string;
  start_time: string | null;
  notes: string | null;
  company: string | null;
  job_title: string | null;
};

export type CalendarAppRow = {
  id: string;
  category: StatusCategory;
  archived: boolean;
  appliedAt: string | null;
  deadline: string | null; // effektiv frist
  nextStep: string | null;
  nextStepAt: string | null;
  company: string;
  jobTitle: string;
};

export function isCalendarEventType(v: string): v is CalendarEventType {
  return (CALENDAR_EVENT_TYPES as readonly string[]).includes(v);
}

/** "HH:MM:SS" eller "HH:MM" -> "HH:MM". */
export function shortTime(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = t.match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

export function buildCalendarItems(events: CalendarEventRow[], apps: CalendarAppRow[]): CalendarItem[] {
  const items: CalendarItem[] = events.map((e) => ({
    key: `event:${e.id}`,
    type: e.type,
    date: e.date.slice(0, 10),
    time: shortTime(e.start_time),
    title: e.title,
    company: e.company,
    jobTitle: e.job_title,
    applicationId: e.application_id,
    eventId: e.id,
    notes: e.notes,
  }));

  for (const a of apps) {
    if (a.archived || !isActiveCategory(a.category)) continue;
    // Søknadsfrist er bare relevant før man har søkt.
    if (a.deadline && a.category === "saved" && !a.appliedAt) {
      items.push({
        key: `deadline:${a.id}`,
        type: "app_deadline",
        date: a.deadline,
        time: null,
        title: null,
        company: a.company,
        jobTitle: a.jobTitle,
        applicationId: a.id,
        eventId: null,
        notes: null,
      });
    }
    if (a.nextStepAt) {
      items.push({
        key: `next:${a.id}`,
        type: "next_step",
        date: a.nextStepAt,
        time: null,
        title: a.nextStep,
        company: a.company,
        jobTitle: a.jobTitle,
        applicationId: a.id,
        eventId: null,
        notes: null,
      });
    }
  }

  return sortItems(items);
}

export function sortItems(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
      a.key.localeCompare(b.key),
  );
}

export function itemsByDate(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const it of items) {
    const list = map.get(it.date) ?? [];
    list.push(it);
    map.set(it.date, list);
  }
  return map;
}

/** Kommende elementer fra og med `from`, maks `limit` stk. */
export function upcomingItems(items: CalendarItem[], from: string, limit = 6): CalendarItem[] {
  return items.filter((i) => daysBetween(from, i.date) >= 0).slice(0, limit);
}

/** Tidligste planlagte dato (i dag eller senere) per søknad, fra egne hendelser. */
export function nextPlannedByApplication(items: CalendarItem[], today: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const it of items) {
    if (!it.applicationId || !it.eventId) continue;
    if (daysBetween(today, it.date) < 0) continue;
    const cur = map.get(it.applicationId);
    if (!cur || it.date < cur) map.set(it.applicationId, it.date);
  }
  return map;
}

// ---------------------------------------------------------------------
// Månedsrutenett (mandag først)
// ---------------------------------------------------------------------

function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

/**
 * Uker for en måned (month: 0-11). Hver uke har 7 datoer, mandag–søndag,
 * inkludert dager fra måneden før/etter så rutenettet blir fullt.
 */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7; // mandag = 0
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const grid: string[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) week.push(iso(year, month, 1 - offset + w * 7 + d));
    grid.push(week);
  }
  return grid;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}
