/**
 * Morgenrapporten: det viktigste i dag, i prioritert rekkefølge.
 * Ren funksjon (se brief.test.ts).
 */
import { daysBetween } from "./dates";

export type BriefKind = "deadline" | "today" | "tomorrow" | "followup" | "closing" | "new_jobs" | "watchlist";
export type BriefTone = "urgent" | "notice" | "info";

export type BriefItem = {
  kind: BriefKind;
  tone: BriefTone;
  count: number;
  /** Navn som kan vises (selskaper/hendelser), maks tre. */
  names: string[];
  href: string;
};

export type BriefInput = {
  today: string;
  /** Lagrede, ikke søkte: selskap og frist. */
  savedDeadlines: { company: string; deadline: string }[];
  /** Kalender: dato og tittel. */
  calendar: { date: string; label: string }[];
  /** Søknader uten svar over grensen. */
  followUps: { company: string }[];
  /** Åpne stillinger i brukerens byer/bransjer: første gang sett og selskap. */
  openJobs: { firstSeen: string; company: string; companyId: string; deadline?: string | null; saved?: boolean }[];
  watchedCompanyIds: ReadonlySet<string>;
  /** Hvor mange dager «ny» varer. */
  newWithinDays?: number;
};

const top = (names: string[]) => [...new Set(names)].slice(0, 3);

export function buildBrief(input: BriefInput): BriefItem[] {
  const { today } = input;
  const newDays = input.newWithinDays ?? 3;
  const items: BriefItem[] = [];

  const urgent = input.savedDeadlines.filter((d) => {
    const n = daysBetween(today, d.deadline);
    return n >= 0 && n <= 3;
  });
  if (urgent.length) {
    items.push({ kind: "deadline", tone: "urgent", count: urgent.length, names: top(urgent.map((u) => u.company)), href: "/tracker" });
  }

  const todays = input.calendar.filter((c) => c.date === today);
  if (todays.length) {
    items.push({ kind: "today", tone: "urgent", count: todays.length, names: top(todays.map((c) => c.label)), href: "/dashboard#kalender" });
  }
  const tomorrow = input.calendar.filter((c) => daysBetween(today, c.date) === 1);
  if (tomorrow.length) {
    items.push({ kind: "tomorrow", tone: "notice", count: tomorrow.length, names: top(tomorrow.map((c) => c.label)), href: "/dashboard#kalender" });
  }

  if (input.followUps.length) {
    items.push({
      kind: "followup",
      tone: "notice",
      count: input.followUps.length,
      names: top(input.followUps.map((f) => f.company)),
      href: "/tracker",
    });
  }

  // Åpne stillinger du ikke har lagret, som stenger innen 3 dager.
  const closing = input.openJobs.filter((j) => {
    if (j.saved || !j.deadline) return false;
    const n = daysBetween(today, j.deadline);
    return n >= 0 && n <= 3;
  });
  if (closing.length) {
    items.push({ kind: "closing", tone: "notice", count: closing.length, names: top(closing.map((j) => j.company)), href: "/feed?deadline=7" });
  }

  const fresh = input.openJobs.filter((j) => {
    const n = daysBetween(j.firstSeen.slice(0, 10), today);
    return n >= 0 && n < newDays;
  });
  const freshWatched = fresh.filter((j) => input.watchedCompanyIds.has(j.companyId));
  if (freshWatched.length) {
    items.push({
      kind: "watchlist",
      tone: "notice",
      count: freshWatched.length,
      names: top(freshWatched.map((j) => j.company)),
      href: "/feed?watch=1&sort=newest",
    });
  }
  if (fresh.length) {
    items.push({ kind: "new_jobs", tone: "info", count: fresh.length, names: top(fresh.map((j) => j.company)), href: "/feed?sort=newest" });
  }
  return items;
}
