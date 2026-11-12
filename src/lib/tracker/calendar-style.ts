import type { CalendarItemType } from "./calendar";

/** Farge per type. Klassene står ferdig skrevet så Tailwind finner dem. */
export const TYPE_STYLE: Record<CalendarItemType, { dot: string; chip: string }> = {
  interview: { dot: "bg-violet-500", chip: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200" },
  assessment: { dot: "bg-amber-500", chip: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  test: { dot: "bg-cyan-500", chip: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200" },
  info: { dot: "bg-blue-500", chip: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" },
  deadline: { dot: "bg-red-500", chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  other: { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  app_deadline: { dot: "bg-red-500", chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  next_step: { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
};
