"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { columnPath, useWidth } from "./use-width";
import { addDays, isoWeek, type DeadlineBucket } from "@/lib/tracker/series";

const M = { l: 8, r: 8, t: 22, b: 22 };
const PLOT_H = 72;
const H = M.t + PLOT_H + M.b;

/**
 * «Forfallsprofil»: hvor mange søknadsfrister som forfaller hver uke
 * fremover, som en løpetidsprofil for obligasjoner.
 */
export function DeadlineProfile({ buckets }: { buckets: DeadlineBucket[] }) {
  const t = useTranslations("charts");
  const format = useFormatter();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const n = buckets.length;
  const band = (width - M.l - M.r) / n;
  const barW = Math.min(24, band * 0.6);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const maxIndex = buckets.findIndex((b) => b.count === max && max > 0);
  const y = (v: number) => M.t + PLOT_H - (v / max) * PLOT_H;
  const range = (w: string) => {
    const f = (d: string) => format.dateTime(new Date(`${d}T12:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });
    return `${f(w)}–${f(addDays(w, 6))}`;
  };

  return (
    <div ref={ref} className="relative w-full">
      <svg width={width} height={H} className="block" role="img" aria-label={t("deadlineAria", { summary: buckets.map((b) => `${t("week", { week: isoWeek(b.week) })}: ${b.count}`).join(", ") })}>
        <line x1={M.l} x2={width - M.r} y1={M.t + PLOT_H} y2={M.t + PLOT_H} stroke="var(--viz-grid)" />
        {buckets.map((b, i) => {
          const cx = M.l + band * i + band / 2;
          const active = hover === i;
          return (
            <g key={b.week}>
              {b.count > 0 && (
                <path
                  d={columnPath(cx - barW / 2, y(b.count), barW, M.t + PLOT_H - y(b.count))}
                  fill={i === 0 || active ? "var(--viz-2)" : "var(--viz-1)"}
                  opacity={hover === null || active ? 1 : 0.55}
                />
              )}
              {/* Etikett bare på høyeste søyle; resten i verktøytips. */}
              {(i === maxIndex || active) && b.count > 0 && (
                <text x={cx} y={y(b.count) - 6} textAnchor="middle" className="fill-foreground text-[11px] font-semibold tabular-nums">
                  {b.count}
                </text>
              )}
              <text x={cx} y={H - 6} textAnchor="middle" className="fill-muted text-[10px] tabular-nums">
                {i === 0 ? t("now") : `u.${isoWeek(b.week)}`}
              </text>
              <rect
                x={cx - band / 2}
                y={M.t - 16}
                width={band}
                height={PLOT_H + 16}
                fill="transparent"
                tabIndex={0}
                aria-label={`${t("week", { week: isoWeek(b.week) })}: ${b.count}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="outline-none"
              />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1 text-xs shadow-md"
          style={{ left: Math.min(Math.max(M.l + band * hover + band / 2, 80), width - 80) }}
        >
          <span className="font-semibold tabular-nums">{t("deadlines", { count: buckets[hover].count })}</span>{" "}
          <span className="text-muted">
            · {t("week", { week: isoWeek(buckets[hover].week) })} ({range(buckets[hover].week)})
          </span>
        </div>
      )}
    </div>
  );
}
