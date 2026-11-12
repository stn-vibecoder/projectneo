"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** `ink`: tekstfarge inne i blokken – hvit på mørke farger, nesten svart på lyse. */
export type Segment = { key: string; label: string; value: number; color: string; ink?: "light" | "dark" };

/**
 * Én helhet delt i deler (høy segmentert stolpe): andelen står inne i
 * blokken når den får plass, navnene står i forklaringen under.
 */
export function SegmentedBar({ segments, ariaLabel }: { segments: Segment[]; ariaLabel: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const parts = segments.filter((s) => s.value > 0);
  const total = parts.reduce((a, s) => a + s.value, 0);
  if (total === 0) return null;
  const share = (v: number) => Math.round((v / total) * 100);
  const active = parts.find((p) => p.key === hover);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div
          role="img"
          aria-label={`${ariaLabel}: ${parts.map((p) => `${p.label} ${p.value} (${share(p.value)}%)`).join(", ")}`}
          className="flex h-7 w-full gap-0.5"
        >
          {parts.map((p) => (
            <div
              key={p.key}
              tabIndex={0}
              onPointerEnter={() => setHover(p.key)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(p.key)}
              onBlur={() => setHover(null)}
              className={cn(
                "flex h-full min-w-0 items-center overflow-hidden rounded px-2 outline-none transition-opacity",
                hover && hover !== p.key && "opacity-60",
              )}
              style={{ flexGrow: p.value, flexBasis: 0, background: p.color }}
            >
              {/* Andelen vises bare når den får plass (ca. 9 %+). */}
              {share(p.value) >= 9 && (
                <span
                  className={cn(
                    "text-[11px] font-semibold tabular-nums",
                    p.ink === "dark" ? "text-[#0b0b0b]" : "text-white",
                  )}
                >
                  {share(p.value)}%
                </span>
              )}
            </div>
          ))}
        </div>
        {active && (
          <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1 text-xs shadow-md">
            <span className="font-semibold tabular-nums">{active.value}</span>{" "}
            <span className="text-muted">
              {active.label} · {share(active.value)}%
            </span>
          </div>
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        {parts.map((p) => (
          <li key={p.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px]" style={{ background: p.color }} />
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
