/**
 * Tidsserier for grafene: når hver søknad nådde viktige milepæler, og
 * antall per uke. Rene funksjoner (se series.test.ts).
 */
import type { StatusCategory } from "@/lib/domain";
import { TIME_ZONE } from "@/i18n/request";
import { daysBetween } from "./dates";

export type StatusEventRow = {
  application_id: string;
  to_category: StatusCategory | null;
  created_at: string; // ISO-tidsstempel
};

export type Milestones = {
  applied: string | null;
  responded: string | null;
  interview: string | null;
  offer: string | null;
  rejected: string | null;
};

export const MILESTONE_KEYS = ["applied", "responded", "interview", "offer", "rejected"] as const;
export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

const RESPONSE: ReadonlySet<StatusCategory> = new Set([
  "screening",
  "interview",
  "assessment",
  "offer",
  "accepted",
  "declined",
  "rejected",
]);
const INTERVIEW: ReadonlySet<StatusCategory> = new Set(["interview", "assessment", "offer", "accepted", "declined"]);
const OFFER: ReadonlySet<StatusCategory> = new Set(["offer", "accepted", "declined"]);
const APPLIED: ReadonlySet<StatusCategory> = new Set([...RESPONSE, "applied"]);

const osloDate = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

/** ISO-tidsstempel -> kalenderdag i Oslo (YYYY-MM-DD). */
export function toOsloDate(timestamp: string): string {
  return timestamp.length <= 10 ? timestamp : osloDate.format(new Date(timestamp));
}

/** Milepæler for én søknad ut fra søknadsdato og statushistorikk (kronologisk). */
export function milestonesFor(appliedAt: string | null, events: readonly StatusEventRow[]): Milestones {
  const first = (set: ReadonlySet<StatusCategory>) => {
    const e = events.find((ev) => ev.to_category && set.has(ev.to_category));
    return e ? toOsloDate(e.created_at) : null;
  };
  return {
    applied: appliedAt ?? first(APPLIED),
    responded: first(RESPONSE),
    interview: first(INTERVIEW),
    offer: first(OFFER),
    rejected: first(new Set<StatusCategory>(["rejected"])),
  };
}

/** Mandagen i uken datoen tilhører. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO-ukenummer (uke 1 er uken med årets første torsdag). */
export function isoWeek(date: string): number {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export type WeeklySeries = {
  weeks: string[]; // mandager, eldst først
} & Record<MilestoneKey, number[]>; // nye per uke

/**
 * Antall nye milepæler per uke, fra første uke med aktivitet (men minst
 * `minWeeks` uker tilbake) til og med inneværende uke.
 */
export function weeklySeries(all: readonly Milestones[], today: string, minWeeks = 12): WeeklySeries {
  const current = weekStart(today);
  let start = addDays(current, -7 * (minWeeks - 1));
  for (const m of all) {
    for (const k of MILESTONE_KEYS) {
      const d = m[k];
      if (d && d < start) start = weekStart(d);
    }
  }
  const weeks: string[] = [];
  for (let w = start; w <= current; w = addDays(w, 7)) weeks.push(w);
  const index = new Map(weeks.map((w, i) => [w, i]));

  const series = Object.fromEntries(MILESTONE_KEYS.map((k) => [k, weeks.map(() => 0)])) as Record<MilestoneKey, number[]>;
  for (const m of all) {
    for (const k of MILESTONE_KEYS) {
      const d = m[k];
      if (!d || d > today) continue;
      const i = index.get(weekStart(d));
      if (i !== undefined) series[k][i]++;
    }
  }
  return { weeks, ...series };
}

export function cumulative(values: readonly number[]): number[] {
  let sum = 0;
  return values.map((v) => (sum += v));
}

/** Svarrate (0–100) per uke, regnet kumulativt. null før første søknad. */
export function responseRateSeries(s: WeeklySeries): (number | null)[] {
  const applied = cumulative(s.applied);
  const responded = cumulative(s.responded);
  return applied.map((a, i) => (a > 0 ? Math.round((responded[i] / a) * 100) : null));
}

/** Antall milepæler av en type de siste `days` dagene (inkludert i dag). */
export function countSince(all: readonly Milestones[], key: MilestoneKey, today: string, days: number): number {
  return all.filter((m) => {
    const d = m[key];
    if (!d) return false;
    const ago = daysBetween(d, today);
    return ago >= 0 && ago < days;
  }).length;
}

/** Svarrate per en gitt dato (kumulativt), 0–100, eller null. */
export function responseRateAt(all: readonly Milestones[], date: string): number | null {
  const applied = all.filter((m) => m.applied && m.applied <= date).length;
  if (applied === 0) return null;
  const responded = all.filter((m) => m.responded && m.responded <= date).length;
  return Math.round((responded / applied) * 100);
}

// ---------------------------------------------------------------------
// Forfallsprofil: frister per uke fremover
// ---------------------------------------------------------------------

export type DeadlineBucket = { week: string; count: number };

export function deadlineProfile(
  deadlines: readonly (string | null)[],
  today: string,
  weeks = 10,
): { buckets: DeadlineBucket[]; later: number; none: number } {
  const first = weekStart(today);
  const buckets: DeadlineBucket[] = Array.from({ length: weeks }, (_, i) => ({ week: addDays(first, i * 7), count: 0 }));
  const end = addDays(first, weeks * 7); // eksklusiv
  let later = 0;
  let none = 0;
  for (const d of deadlines) {
    if (!d) {
      none++;
      continue;
    }
    if (d < today) continue;
    if (d >= end) {
      later++;
      continue;
    }
    const i = Math.floor(daysBetween(first, d) / 7);
    buckets[i].count++;
  }
  return { buckets, later, none };
}
