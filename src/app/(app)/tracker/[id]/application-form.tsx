"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { updateApplication } from "@/lib/actions/applications";
import type { ActionResult } from "@/lib/actions/result";
import type { Application } from "@/lib/types";

export function ApplicationForm({ app, jobDeadline }: { app: Application; jobDeadline: string | null }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateApplication.bind(null, app.id),
    null,
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state?.ok) toast.success(t("application.updated"));
    else if (state && !state.fieldErrors) toast.error(state.error);
  }, [state, t]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("application.appliedAt")} htmlFor="applied_at" error={errors.applied_at}>
          <Input id="applied_at" name="applied_at" type="date" defaultValue={app.applied_at ?? ""} />
        </Field>
        <Field
          label={t("application.deadline")}
          htmlFor="deadline"
          hint={t("application.deadlineHelp")}
          error={errors.deadline}
        >
          {/* Tomt felt = stillingens frist gjelder (oppdateres automatisk fra kilden). */}
          <Input id="deadline" name="deadline" type="date" defaultValue={app.deadline ?? ""} placeholder={jobDeadline ?? undefined} />
        </Field>
        <Field label={t("application.nextStep")} htmlFor="next_step">
          <Input
            id="next_step"
            name="next_step"
            defaultValue={app.next_step ?? ""}
            placeholder={t("application.nextStepPlaceholder")}
            maxLength={200}
          />
        </Field>
        <Field label={t("application.nextStepAt")} htmlFor="next_step_at" error={errors.next_step_at}>
          <Input id="next_step_at" name="next_step_at" type="date" defaultValue={app.next_step_at ?? ""} />
        </Field>
        <Field label={t("application.cvUrl")} htmlFor="cv_url" error={errors.cv_url}>
          <Input
            id="cv_url"
            name="cv_url"
            type="url"
            defaultValue={app.cv_url ?? ""}
            placeholder={t("application.linkPlaceholder")}
          />
        </Field>
        <Field label={t("application.coverLetterUrl")} htmlFor="cover_letter_url" error={errors.cover_letter_url}>
          <Input
            id="cover_letter_url"
            name="cover_letter_url"
            type="url"
            defaultValue={app.cover_letter_url ?? ""}
            placeholder={t("application.linkPlaceholder")}
          />
        </Field>
      </div>
      <Field label={t("application.notes")} htmlFor="notes">
        <Textarea
          id="notes"
          name="notes"
          defaultValue={app.notes ?? ""}
          rows={5}
          placeholder={t("application.notesPlaceholder")}
        />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
