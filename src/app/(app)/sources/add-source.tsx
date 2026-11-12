"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CircleAlert, LoaderCircle, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { CityIcon } from "@/components/city-icon";
import { addSource, previewSource, type Preview } from "@/lib/actions/sources";
import { INDUSTRIES, isCity } from "@/lib/domain";

export function AddSource() {
  const t = useTranslations();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [checking, startCheck] = useTransition();
  const [adding, startAdd] = useTransition();

  function check() {
    if (!url.trim()) return;
    setError(null);
    setPreview(null);
    startCheck(async () => {
      const res = await previewSource(url.trim());
      if (res.ok) {
        setPreview(res.data);
        setName(res.data.name);
      } else setError(res.error);
    });
  }

  function add() {
    if (!preview) return;
    startAdd(async () => {
      const res = await addSource({
        type: preview.type,
        identifier: preview.identifier,
        name: name.trim() || preview.name,
        url: preview.url,
        industry: industry || null,
      });
      if (!res.ok) {
            toast.error(res.error);
            return;
          }
      const r = res.data;
      if (r && r.ok) toast.success(t("sources.added", { name: r.name, internships: r.internships }));
      else if (r) toast.error(t("sources.ranError", { name: r.name, error: r.error }));
      setUrl("");
      setPreview(null);
      setIndustry("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("sources.urlPlaceholder")}
            aria-label={t("sources.urlPlaceholder")}
            className="pl-9"
            inputMode="url"
          />
        </div>
        <Button type="submit" disabled={checking || !url.trim()}>
          {checking ? <LoaderCircle className="animate-spin" /> : null}
          {checking ? t("sources.checking") : t("sources.check")}
        </Button>
      </form>

      {error && (
        <p role="alert" className="flex gap-2 rounded-md border border-border bg-surface-muted px-3 py-2.5 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-gold" />
          {error}
        </p>
      )}

      {preview && (
        <div className="flex flex-col gap-4 rounded-md border border-gold/40 bg-gold-soft/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-gold/40 bg-surface text-foreground">{t(`sources.types.${preview.type}`)}</Badge>
            <p className="text-sm">
              {preview.type === "nav"
                ? t("sources.previewNav")
                : t("sources.previewFound", { total: preview.total, internships: preview.internships })}
            </p>
          </div>
          {preview.samples.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {preview.samples.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-2">
                  <span className="font-medium">{s.title}</span>
                  <span className="text-muted">· {s.company}</span>
                  {s.cities.filter(isCity).map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 text-xs text-muted">
                      <CityIcon city={c} className="size-3.5 text-gold" />
                      {t(`enums.city.${c}`)}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("sources.nameLabel")} htmlFor="src-name">
              <Input id="src-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </Field>
            <Field label={t("sources.industryLabel")} htmlFor="src-industry">
              <Select id="src-industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                <option value="">{t("sources.industryNone")}</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {t(`enums.industry.${i}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <Button onClick={add} disabled={adding}>
              {adding ? <LoaderCircle className="animate-spin" /> : <Plus />}
              {adding ? t("sources.running") : t("sources.add")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
