import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { dateOnlyToDate, daysBetween, daysSince } from "@/lib/tracker/dates";

/** Viser en dato (YYYY-MM-DD) på brukerens språk, f.eks. «12. des.». */
export function DateText({ value, withYear = false }: { value: string; withYear?: boolean }) {
  const format = useFormatter();
  return (
    <time dateTime={value.slice(0, 10)}>
      {format.dateTime(dateOnlyToDate(value), {
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
        timeZone: "UTC",
      })}
    </time>
  );
}

/** «i dag», «i morgen», «om 5 dager», «for 3 dager siden». */
export function RelativeDay({ value, today }: { value: string; today: string }) {
  const t = useTranslations("common");
  const d = daysBetween(today, value.slice(0, 10));
  if (d === 0) return <>{t("today")}</>;
  if (d === 1) return <>{t("tomorrow")}</>;
  if (d === -1) return <>{t("yesterday")}</>;
  return <>{d > 0 ? t("inDays", { count: d }) : t("daysAgo", { count: -d })}</>;
}

/** Tid siden et tidsstempel, i kalenderdager. */
export function SinceText({ timestamp, today }: { timestamp: string; today: string }) {
  const t = useTranslations("common");
  const d = daysSince(timestamp, today);
  if (d <= 0) return <>{t("today")}</>;
  if (d === 1) return <>{t("yesterday")}</>;
  return <>{t("daysAgo", { count: d })}</>;
}

/** Frist med farge: rød når det haster (≤ 3 dager), gul innen en uke. */
export function Deadline({ value, today, className }: { value: string | null; today: string; className?: string }) {
  const t = useTranslations("feed");
  if (!value) return <span className={cn("text-muted", className)}>{t("noDeadline")}</span>;
  const d = daysBetween(today, value);
  const tone = d < 0 ? "text-muted line-through" : d <= 3 ? "text-danger font-medium" : d <= 7 ? "text-amber-600 dark:text-amber-400" : "";
  return (
    <span className={cn(tone, className)}>
      <DateText value={value} /> · <RelativeDay value={value} today={today} />
    </span>
  );
}
