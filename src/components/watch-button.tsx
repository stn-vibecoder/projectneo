"use client";

import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { setWatched } from "@/lib/actions/watchlist";
import { cn } from "@/lib/utils";

/** Stjerne for å følge et selskap (watchlist). */
export function WatchButton({
  companyId,
  companyName,
  watched,
  withLabel = false,
  className,
}: {
  companyId: string;
  companyName: string;
  watched: boolean;
  withLabel?: boolean;
  className?: string;
}) {
  const t = useTranslations("watch");
  const [, start] = useTransition();
  const [on, setOn] = useOptimistic(watched);
  const label = on ? t("remove") : t("add");

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${label}: ${companyName}`}
      title={label}
      onClick={() =>
        start(async () => {
          const next = !on;
          setOn(next);
          const res = await setWatched(companyId, next);
          if (res.ok) toast.success(t(next ? "added" : "removed", { name: companyName }));
          else toast.error(res.error);
        })
      }
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium transition-colors",
        on ? "text-gold" : "text-muted hover:text-gold",
        withLabel && "h-8 border border-border bg-surface px-3 text-sm",
        className,
      )}
    >
      <Star className={cn("size-4 transition-transform active:scale-125", on && "fill-current")} />
      {withLabel && label}
    </button>
  );
}
