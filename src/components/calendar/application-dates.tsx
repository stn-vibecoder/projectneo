"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarItem } from "@/lib/tracker/calendar";
import { CalendarItemRow } from "./calendar-item";
import { EventForm } from "./event-form";

/** Datoer for én søknad (på søknadssiden), med skjema for å legge til. */
export function ApplicationDates({
  applicationId,
  items,
  today,
}: {
  applicationId: string;
  items: CalendarItem[];
  today: string;
}) {
  const t = useTranslations("calendar");
  const [adding, setAdding] = useState(false);
  const close = useCallback(() => setAdding(false), []);

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && !adding && <p className="text-sm text-muted">{t("noItemsApp")}</p>}
      {items.length > 0 && (
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <CalendarItemRow key={it.key} item={it} showDate showApplication={false} />
          ))}
        </ul>
      )}
      {adding ? (
        <EventForm defaultDate={today} fixedApplicationId={applicationId} onDone={close} />
      ) : (
        <div>
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus />
            {t("add")}
          </Button>
        </div>
      )}
    </div>
  );
}
