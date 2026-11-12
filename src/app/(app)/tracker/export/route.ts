import { getTranslations } from "next-intl/server";
import { getApplications, todayInOslo } from "@/lib/data";
import { toCsv } from "@/lib/tracker/csv";
import { effectiveDeadline } from "@/lib/tracker/status-logic";

/** Last ned alle søknader som CSV (åpnes direkte i Excel / Numbers / Google Sheets). */
export async function GET(request: Request) {
  const t = await getTranslations();
  const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
  const apps = await getApplications({ includeArchived });
  const today = todayInOslo();

  const header = [
    t("tracker.cols.company"),
    t("tracker.cols.title"),
    t("tracker.cols.city"),
    t("tracker.cols.industry"),
    t("tracker.cols.status"),
    t("tracker.cols.rating"),
    t("tracker.cols.appliedAt"),
    t("tracker.cols.deadline"),
    t("tracker.cols.nextStep"),
    t("tracker.cols.nextStepAt"),
    t("tracker.cols.lastActivity"),
    t("tracker.cols.notes"),
    t("tracker.cols.link"),
    t("tracker.cols.archived"),
  ];

  const rows = apps.map((a) => [
    a.job.company.name,
    a.job.title,
    a.job.cities.map((c) => t(`enums.city.${c}`)).join(", "),
    a.job.industry ? t(`enums.industry.${a.job.industry}`) : "",
    a.status.label,
    a.rating,
    a.applied_at,
    effectiveDeadline(a, a.job),
    a.next_step,
    a.next_step_at,
    a.last_activity_at.slice(0, 10),
    a.notes,
    a.job.apply_url ?? a.job.url,
    a.archived ? t("common.yes") : "",
  ]);

  return new Response(toCsv([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="soknader-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
