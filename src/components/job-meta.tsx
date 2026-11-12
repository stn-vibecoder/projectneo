import { useTranslations } from "next-intl";
import { CalendarClock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { Deadline } from "@/components/dates";
import type { Job } from "@/lib/types";

/** By, periode, bransje og frist for en stilling. */
export function JobMeta({ job, today, deadline }: { job: Job; today: string; deadline?: string | null }) {
  const t = useTranslations("enums");
  const cities = job.cities.length ? job.cities.map((c) => t(`city.${c}`)).join(" · ") : job.location_raw;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
        {cities && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" />
            {cities}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="size-3.5" />
          <Deadline value={deadline === undefined ? job.deadline : deadline} today={today} />
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {job.period !== "unknown" && <Badge>{t(`period.${job.period}`)}</Badge>}
        {job.industry && <Badge>{t(`industry.${job.industry}`)}</Badge>}
      </div>
    </div>
  );
}
