import { getTranslations } from "next-intl/server";
import { getApplications, getCalendarEvents, toCalendarApps } from "@/lib/data";
import { SITE_URL } from "@/lib/env";
import { buildCalendarItems } from "@/lib/tracker/calendar";
import { toIcs } from "@/lib/tracker/ics";

/** Last ned kalenderen (frister, intervjuer, neste steg) som .ics. */
export async function GET() {
  const t = await getTranslations();
  const [apps, events] = await Promise.all([getApplications(), getCalendarEvents()]);
  const items = buildCalendarItems(events, toCalendarApps(apps));

  const ics = toIcs(
    items.map((it) => {
      const type = t(`calendar.types.${it.type}`);
      const who = [it.company, it.jobTitle].filter(Boolean).join(" – ");
      return {
        uid: it.key.replace(/[^a-zA-Z0-9-]/g, "-"),
        date: it.date,
        time: it.time,
        summary: [it.title ?? type, who].filter(Boolean).join(": "),
        description: [it.title ? type : null, it.notes].filter(Boolean).join("\n") || null,
        url: it.applicationId ? `${SITE_URL}/tracker/${it.applicationId}` : null,
      };
    }),
    new Date(),
    t("app.name"),
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="internship-portalen.ics"',
      "Cache-Control": "no-store",
    },
  });
}
