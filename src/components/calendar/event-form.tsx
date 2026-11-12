"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { addCalendarEvent } from "@/lib/actions/calendar";
import type { ActionResult } from "@/lib/actions/result";
import { CALENDAR_EVENT_TYPES, type CalendarEventType } from "@/lib/tracker/calendar";

export type ApplicationOption = { id: string; label: string };

/** Skjema for å legge inn en dato (intervju, frist, test …) i kalenderen. */
export function EventForm({
  defaultDate,
  defaultType = "interview",
  applications,
  fixedApplicationId,
  onDone,
}: {
  defaultDate: string;
  defaultType?: CalendarEventType;
  applications?: ApplicationOption[];
  fixedApplicationId?: string;
  onDone: () => void;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addCalendarEvent, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state?.ok) {
      toast.success(t("calendar.added"));
      onDone();
    } else if (state && !state.fieldErrors) toast.error(state.error);
  }, [state, onDone, t]);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-surface-muted/40 p-3 sm:p-4">
      {fixedApplicationId && <input type="hidden" name="application_id" value={fixedApplicationId} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("calendar.type")} htmlFor="ev-type" error={errors.type}>
          <Select id="ev-type" name="type" defaultValue={defaultType}>
            {CALENDAR_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`calendar.types.${type}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("calendar.date")} htmlFor="ev-date" error={errors.date}>
          <Input id="ev-date" name="date" type="date" defaultValue={defaultDate} required />
        </Field>
        <Field label={t("calendar.time")} htmlFor="ev-time" optional={t("common.optional")} error={errors.time}>
          <Input id="ev-time" name="time" type="time" step={300} />
        </Field>
      </div>

      {!fixedApplicationId && applications && (
        <Field label={t("calendar.application")} htmlFor="ev-app" optional={t("common.optional")}>
          <Select id="ev-app" name="application_id" defaultValue="">
            <option value="">{t("calendar.noApplication")}</option>
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label={t("calendar.titleField")} htmlFor="ev-title" optional={t("common.optional")}>
        <Input id="ev-title" name="title" maxLength={200} placeholder={t("calendar.titlePlaceholder")} />
      </Field>
      <Field label={t("calendar.notes")} htmlFor="ev-notes" optional={t("common.optional")}>
        <Textarea id="ev-notes" name="notes" rows={2} maxLength={2000} placeholder={t("calendar.notesPlaceholder")} className="min-h-16" />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? t("common.saving") : t("calendar.save")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}
