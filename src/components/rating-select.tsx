"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateApplicationField } from "@/lib/actions/applications";
import { RATINGS, type Rating } from "@/lib/domain";
import { cn } from "@/lib/utils";

/** Sterkere rating = mer gull. Klassene står ferdig skrevet så Tailwind finner dem. */
export const RATING_STYLE: Record<Rating, string> = {
  AAA: "bg-gold text-sidebar",
  AA: "bg-gold-soft text-gold ring-1 ring-gold/50",
  A: "bg-surface-muted text-foreground ring-1 ring-border",
  BBB: "bg-surface-muted text-muted ring-1 ring-border",
};

export function RatingBadge({ rating, className }: { rating: Rating; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 min-w-9 items-center justify-center rounded-sm px-1 font-mono text-[10px] font-semibold tracking-wider", RATING_STYLE[rating], className)}>
      {rating}
    </span>
  );
}

/** Velg rating for en søknad. `cell`: uten ramme, for bruk i regnearket. */
export function RatingSelect({ applicationId, value, cell = false }: { applicationId: string; value: Rating | null; cell?: boolean }) {
  const t = useTranslations("rating");
  const [pending, start] = useTransition();
  return (
    <span
      className={cn(
        "relative inline-flex items-center focus-within:ring-2 focus-within:ring-inset focus-within:ring-accent",
        cell ? "h-9 w-full justify-center px-2" : "h-9 rounded-md border border-border bg-surface px-2.5",
      )}
      title={t("help")}
    >
      {value ? <RatingBadge rating={value} /> : <span className="px-1 text-[13px] text-muted/50">–</span>}
      <select
        aria-label={t("label")}
        value={value ?? ""}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          start(async () => {
            const res = await updateApplicationField(applicationId, "rating", next);
            if (!res.ok) toast.error(res.error);
          });
        }}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
      >
        <option value="">{t("none")}</option>
        {RATINGS.map((r) => (
          <option key={r} value={r}>
            {t(r)}
          </option>
        ))}
      </select>
    </span>
  );
}
