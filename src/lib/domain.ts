// Faste verdier som speiler enums i databasen. Tekstene ligger i
// src/messages/*.json under "enums", så de kan oversettes.

export const CITIES = ["oslo", "stockholm", "new_york", "london"] as const;
export type City = (typeof CITIES)[number];

export const INDUSTRIES = ["finance", "consulting", "audit", "tech", "industry", "other"] as const;
export type Industry = (typeof INDUSTRIES)[number];

/** Forhåndsvalgt i onboarding: appen retter seg først mot økonomistudenter. */
export const DEFAULT_INDUSTRIES = ["finance", "consulting", "audit"] as const satisfies readonly Industry[];

export const PERIODS = ["summer", "autumn", "winter", "full_year", "unknown"] as const;
export type Period = (typeof PERIODS)[number];

export const STATUS_CATEGORIES = [
  "saved",
  "applied",
  "screening",
  "interview",
  "assessment",
  "offer",
  "accepted",
  "declined",
  "rejected",
  "withdrawn",
] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

/** Egen prioritering av en søknad, i kredittrating-stil (AAA er best). */
export const RATINGS = ["AAA", "AA", "A", "BBB"] as const;
export type Rating = (typeof RATINGS)[number];
export function isRating(v: string): v is Rating {
  return (RATINGS as readonly string[]).includes(v);
}

export function isCity(v: string): v is City {
  return (CITIES as readonly string[]).includes(v);
}
export function isIndustry(v: string): v is Industry {
  return (INDUSTRIES as readonly string[]).includes(v);
}
export function isPeriod(v: string): v is Period {
  return (PERIODS as readonly string[]).includes(v);
}

// Fargepalett for statuser. Klassene må stå ferdig skrevet her så
// Tailwind finner dem.
export const STATUS_COLORS = {
  slate: { dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  blue: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
  cyan: { dot: "bg-cyan-500", badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200" },
  violet: { dot: "bg-violet-500", badge: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200" },
  amber: { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  emerald: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  green: { dot: "bg-green-600", badge: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" },
  zinc: { dot: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  red: { dot: "bg-red-500", badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  stone: { dot: "bg-stone-400", badge: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300" },
  pink: { dot: "bg-pink-500", badge: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200" },
  orange: { dot: "bg-orange-500", badge: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200" },
} as const;
export type StatusColor = keyof typeof STATUS_COLORS;
export const STATUS_COLOR_NAMES = Object.keys(STATUS_COLORS) as StatusColor[];

export function statusColor(name: string) {
  return STATUS_COLORS[(name in STATUS_COLORS ? name : "slate") as StatusColor];
}
