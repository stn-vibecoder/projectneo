"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCalendarEvent } from "@/lib/actions/calendar";
import type { CalendarItem } from "@/lib/tracker/calendar";
import { TYPE_STYLE } from "@/lib/tracker/calendar-style";

export { TYPE_STYLE };
import { dateOnlyToDate } from "@/lib/tracker/dates";
import { cn } from "@/lib/utils";


export function useItemLabel() {
  const t = useTranslations("calendar");
  return (item: CalendarItem) => item.title ?? t(`types.${item.type}`);
}

export function CalendarItemRow({
  item,
  showDate = false,
  showApplication = true,
}: {
  item: CalendarItem;
  showDate?: boolean;
  showApplication?: boolean;
}) {
  const t = useTranslations("calendar");
  const format = useFormatter();
  const label = useItemLabel();
  const [pending, start] = useTransition();
  const style = TYPE_STYLE[item.type];

  return (
    <li className={cn("flex items-start gap-3 py-2.5", pending && "opacity-50")}>
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", style.dot)} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{label(item)}</span>
          {item.title && <span className="text-xs text-muted">{t(`types.${item.type}`)}</span>}
        </p>
        <p className="text-xs text-muted">
          {showDate && (
            <>
              {format.dateTime(dateOnlyToDate(item.date), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
              {item.time ? " " : ""}
            </>
          )}
          {item.time && t("at", { time: item.time })}
          {(showDate || item.time) && showApplication && item.company ? " · " : ""}
          {showApplication && item.applicationId && item.company && (
            <Link href={`/tracker/${item.applicationId}`} className="hover:text-foreground hover:underline">
              {item.company}
              {item.jobTitle ? ` – ${item.jobTitle}` : ""}
            </Link>
          )}
        </p>
        {item.notes && <p className="mt-0.5 whitespace-pre-line text-xs">{item.notes}</p>}
      </div>
      {item.eventId && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("remove")}
          title={t("remove")}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await deleteCalendarEvent(item.eventId!);
              if (res.ok) toast.success(t("deleted"));
              else toast.error(res.error);
            })
          }
        >
          <Trash2 />
        </Button>
      )}
    </li>
  );
}
