"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, LoaderCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addSource,
  deleteSource,
  runAllNow,
  runSourceNow,
  setSourceEnabled,
  updateSourceIndustry,
} from "@/lib/actions/sources";
import type { RunResult } from "@/ingest/run";
import { INDUSTRIES } from "@/lib/domain";
import { cn } from "@/lib/utils";

function useReport() {
  const t = useTranslations("sources");
  return (r: RunResult) =>
    r.ok
      ? toast.success(t("ranOk", { name: r.name, internships: r.internships, inserted: r.inserted, closed: r.closed }))
      : toast.error(t("ranError", { name: r.name, error: r.error }));
}

export function RunAllButton({ disabled }: { disabled?: boolean }) {
  const t = useTranslations("sources");
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending || disabled}
      onClick={() =>
        start(async () => {
          const res = await runAllNow();
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          const ok = res.data.filter((r) => r.ok).length;
          toast.success(t("runAllDone", { ok, total: res.data.length }));
          res.data.filter((r) => !r.ok).forEach((r) => !r.ok && toast.error(t("ranError", { name: r.name, error: r.error })));
        })
      }
    >
      <RefreshCw className={cn(pending && "animate-spin")} />
      {pending ? t("running") : t("runAll")}
    </Button>
  );
}

export function RunNowButton({ id }: { id: string }) {
  const t = useTranslations("sources");
  const report = useReport();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title={t("runNow")}
      aria-label={t("runNow")}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await runSourceNow(id);
          if (res.ok) report(res.data);
          else toast.error(res.error);
        })
      }
    >
      <RefreshCw className={cn(pending && "animate-spin")} />
    </Button>
  );
}

export function DeleteSourceButton({ id }: { id: string }) {
  const t = useTranslations("sources");
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title={t("remove")}
      aria-label={t("remove")}
      disabled={pending}
      onClick={() => {
        if (!confirm(t("removeConfirm"))) return;
        start(async () => {
          const res = await deleteSource(id);
          if (!res.ok) toast.error(res.error);
        });
      }}
    >
      <Trash2 />
    </Button>
  );
}

export function EnabledToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const t = useTranslations("sources");
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={t("colActive")}
      disabled={pending}
      onClick={() => start(async () => void (await setSourceEnabled(id, !enabled)))}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        enabled ? "bg-accent" : "bg-border",
      )}
    >
      <span className={cn("inline-block size-4 rounded-full bg-surface shadow transition-transform", enabled ? "translate-x-4.5" : "translate-x-0.5")} />
    </button>
  );
}

export function IndustrySelect({ id, value }: { id: string; value: string | null }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={t("sources.colIndustry")}
      value={value ?? ""}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        start(async () => void (await updateSourceIndustry(id, v)));
      }}
      className="h-8 w-full rounded-md border border-transparent bg-transparent px-1.5 text-[13px] hover:border-border focus:border-border focus:outline-none"
    >
      <option value="">{t("sources.industryNone")}</option>
      {INDUSTRIES.map((i) => (
        <option key={i} value={i}>
          {t(`enums.industry.${i}`)}
        </option>
      ))}
    </select>
  );
}

export function PresetButton({
  type,
  name,
  url,
  added,
}: {
  type: "nhhs" | "bindeleddet" | "nav" | "jobtech" | "adzuna";
  name: string;
  url: string;
  added: boolean;
}) {
  const t = useTranslations("sources");
  const report = useReport();
  const [pending, start] = useTransition();
  if (added)
    return (
      <span className="inline-flex h-8 items-center gap-1 px-2 text-xs font-medium text-positive">
        <Check className="size-3.5" />
        {t("presetAdded")}
      </span>
    );
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await addSource({ type, identifier: "default", name, url, industry: null });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          if (res.data) report(res.data);
        })
      }
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <Plus />}
      {t("presetAdd")}
    </Button>
  );
}
