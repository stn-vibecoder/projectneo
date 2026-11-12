"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChipGroup, Field, Input, Select, Textarea } from "@/components/ui/form";
import { CITIES, INDUSTRIES, PERIODS, type City, type Period } from "@/lib/domain";
import { createManualJob, prefillJob } from "@/lib/actions/jobs";
import type { ActionResult } from "@/lib/actions/result";

type Values = {
  url: string;
  company: string;
  title: string;
  location: string;
  cities: City[];
  period: Period;
  industry: string;
  deadline: string;
  description: string;
};

function fromFormData(fd: FormData): Values {
  const s = (k: string) => String(fd.get(k) ?? "");
  return {
    url: s("url"),
    company: s("company"),
    title: s("title"),
    location: s("location"),
    cities: fd.getAll("cities").map(String) as City[],
    period: (s("period") || "unknown") as Period,
    industry: s("industry"),
    deadline: s("deadline"),
    description: s("description"),
  };
}

export function ManualJobForm({ defaultCities }: { defaultCities: City[] }) {
  const t = useTranslations();
  const [values, setValues] = useState<Values>({
    url: "",
    company: "",
    title: "",
    location: "",
    cities: defaultCities,
    period: "unknown",
    industry: "",
    deadline: "",
    description: "",
  });
  const [state, formAction, submitting] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    // React nullstiller skjemaet etter innsending. Ta vare på det brukeren
    // skrev, så feltene ikke tømmes ved valideringsfeil.
    setValues(fromFormData(fd));
    return createManualJob(prev, fd);
  }, null);
  const [prefilling, startPrefill] = useTransition();
  // Skjemaet remountes etter forhåndsutfylling, så defaultValue-ene oppdateres.
  const [formKey, setFormKey] = useState(0);

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  function prefill(form: HTMLFormElement) {
    const url = String(new FormData(form).get("url") ?? "").trim();
    if (!url) return;
    startPrefill(async () => {
      const res = await prefillJob(url);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const p = res.data;
      const current = Object.fromEntries(new FormData(form)) as Record<string, string>;
      setValues({
        url,
        company: p.company ?? current.company ?? "",
        title: p.title ?? current.title ?? "",
        location: p.location ?? current.location ?? "",
        cities: p.cities.length ? p.cities : values.cities,
        period: p.period !== "unknown" ? p.period : ((current.period as Period) ?? "unknown"),
        industry: current.industry ?? "",
        deadline: p.deadline ?? current.deadline ?? "",
        description: p.description ?? current.description ?? "",
      });
      setFormKey((k) => k + 1);
      if (p.foundJsonLd) toast.success(t("job.prefillOk"));
      else toast.message(t("job.prefillPartial"));
    });
  }

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-5">
      <Field label={t("job.url")} htmlFor="url" optional={t("common.optional")} error={errors.url}>
        <div className="flex gap-2">
          <Input id="url" name="url" type="url" inputMode="url" defaultValue={values.url} placeholder={t("job.urlPlaceholder")} />
          <Button
            variant="secondary"
            disabled={prefilling}
            onClick={(e) => prefill(e.currentTarget.form!)}
            className="shrink-0"
          >
            {prefilling ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            {prefilling ? t("job.prefilling") : t("job.prefill")}
          </Button>
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("job.company")} htmlFor="company" error={errors.company}>
          <Input id="company" name="company" defaultValue={values.company} required maxLength={200} />
        </Field>
        <Field label={t("job.title")} htmlFor="title" error={errors.title}>
          <Input id="title" name="title" defaultValue={values.title} required maxLength={300} />
        </Field>
      </div>

      <ChipGroup
        name="cities"
        legend={t("job.cities")}
        options={CITIES.map((c) => ({ value: c, label: t(`enums.city.${c}`) }))}
        defaultValue={values.cities}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("job.location")} htmlFor="location" optional={t("common.optional")}>
          <Input id="location" name="location" defaultValue={values.location} placeholder={t("job.locationPlaceholder")} />
        </Field>
        <Field label={t("job.deadline")} htmlFor="deadline" optional={t("common.optional")} error={errors.deadline}>
          <Input id="deadline" name="deadline" type="date" defaultValue={values.deadline} />
        </Field>
        <Field label={t("job.period")} htmlFor="period">
          <Select id="period" name="period" defaultValue={values.period}>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(`enums.period.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("job.industry")} htmlFor="industry" optional={t("common.optional")}>
          <Select id="industry" name="industry" defaultValue={values.industry}>
            <option value="">–</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {t(`enums.industry.${i}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label={t("job.description")}
        htmlFor="description"
        optional={t("common.optional")}
        hint={t("job.descriptionHelp")}
      >
        <Textarea id="description" name="description" defaultValue={values.description} rows={8} />
      </Field>

      {state && !state.ok && !Object.keys(errors).length && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? t("common.saving") : t("job.submit")}
        </Button>
      </div>
    </form>
  );
}
