"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChipGroup, Field, Input } from "@/components/ui/form";
import { CITIES, INDUSTRIES, PERIODS } from "@/lib/domain";
import { CityIcon } from "@/components/city-icon";
import type { ActionResult } from "@/lib/actions/result";
import type { Preferences } from "@/lib/types";

export function PreferencesForm({
  action,
  initial,
  studyField,
  submitLabel,
  successMessage,
}: {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  initial: Pick<Preferences, "cities" | "industries" | "periods">;
  studyField: string | null;
  submitLabel: string;
  successMessage?: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state?.ok && successMessage) toast.success(successMessage);
    if (state && !state.ok) toast.error(state.error);
  }, [state, successMessage]);

  const opts = (values: readonly string[], ns: "city" | "industry" | "period") =>
    values.map((v) => ({ value: v, label: t(`enums.${ns}.${v}`) }));

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <ChipGroup
        name="cities"
        legend={t("onboarding.citiesLabel")}
        hint={t("onboarding.citiesHelp")}
        options={CITIES.map((c) => ({ value: c, label: t(`enums.city.${c}`), icon: <CityIcon city={c} /> }))}
        defaultValue={initial.cities}
        required
      />
      <ChipGroup
        name="industries"
        legend={
          <>
            {t("onboarding.industriesLabel")} <span className="font-normal text-muted">({t("common.optional")})</span>
          </>
        }
        options={opts(INDUSTRIES, "industry")}
        defaultValue={initial.industries}
      />
      <ChipGroup
        name="periods"
        legend={
          <>
            {t("onboarding.periodsLabel")} <span className="font-normal text-muted">({t("common.optional")})</span>
          </>
        }
        options={opts(
          PERIODS.filter((p) => p !== "unknown"),
          "period",
        )}
        defaultValue={initial.periods}
      />
      <Field label={t("onboarding.studyFieldLabel")} htmlFor="study_field" optional={t("common.optional")}>
        <Input
          id="study_field"
          name="study_field"
          defaultValue={studyField ?? ""}
          placeholder={t("onboarding.studyFieldPlaceholder")}
          maxLength={120}
        />
      </Field>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
