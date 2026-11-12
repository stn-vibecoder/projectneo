"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/lib/types";

/** Kompakt statusvelger. Alternativ til dra-og-slipp (mobil og tastatur). */
export function StatusSelect({
  statuses,
  value,
  onChange,
  disabled,
  className,
}: {
  statuses: ApplicationStatus[];
  value: string;
  onChange: (statusId: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("application");
  return (
    <select
      aria-label={t("changeStatus")}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn(
        "h-7 max-w-full rounded-md border border-border bg-surface px-1.5 text-xs text-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
    >
      {statuses.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
