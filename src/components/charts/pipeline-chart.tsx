"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { columnPath, niceTicks, useWidth } from "./use-width";
import { isoWeek } from "@/lib/tracker/series";

export type ChartSeries = { key: string; label: string; color: string; values: number[] };

const M = { l: 34, r: 104, t: 10 };
const MAIN_H = 180;
const GAP = 34;
const VOL_H = 54;
const X_LABEL_H = 22;
const H = M.t + MAIN_H + GAP + VOL_H + X_LABEL_H;

/**
 * «Kursgraf» for pipelinen: kumulative linjer øverst, og søknader per
 * uke som volum-søyler under (egen akse, ikke to y-akser i samme graf).
 */
export function PipelineChart({
  weeks,
  series,
  volume,
  volumeLabel,
}: {
  weeks: string[];
  series: ChartSeries[];
  volume: number[];
  volumeLabel: string;
}) {
  const t = useTranslations("charts");
  const format = useFormatter();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [idx, setIdx] = useState<number | null>(null);

  const n = weeks.length;
  const plotW = Math.max(40, width - M.l - M.r);
  const step = n > 1 ? plotW / (n - 1) : 0;
  const xAt = (i: number) => (n > 1 ? M.l + i * step : M.l + plotW / 2);

  const ticks = niceTicks(Math.max(1, ...series.flatMap((s) => s.values)), 4);
  const top = ticks[ticks.length - 1];
  const y = (v: number) => M.t + MAIN_H - (v / top) * MAIN_H;

  const volTop = M.t + MAIN_H + GAP;
  const volMax = niceTicks(Math.max(1, ...volume), 2).at(-1)!;
  const yv = (v: number) => volTop + VOL_H - (v / volMax) * VOL_H;
  const barW = Math.max(3, Math.min(24, (step || plotW) * 0.55));

  const shortDate = (w: string) =>
    format.dateTime(new Date(`${w}T12:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });

  // Månedsetiketter på x-aksen, uten kollisjoner.
  const monthLabels = useMemo(() => {
    const out: { i: number; text: string }[] = [];
    let lastX = -Infinity;
    weeks.forEach((w, i) => {
      const prev = weeks[i - 1];
      if (i > 0 && prev.slice(0, 7) === w.slice(0, 7)) return;
      const x = n > 1 ? M.l + i * step : M.l + plotW / 2;
      if (x - lastX < 44) return;
      lastX = x;
      out.push({ i, text: format.dateTime(new Date(`${w}T12:00:00Z`), { month: "short", timeZone: "UTC" }) });
    });
    return out;
  }, [weeks, n, step, plotW, format]);

  // Direkte etiketter i enden av linjene, skjøvet fra hverandre ved behov.
  const endLabels = useMemo(() => {
    const items = series
      .map((s) => ({ s, yEnd: y(s.values[n - 1] ?? 0), yLabel: y(s.values[n - 1] ?? 0) }))
      .sort((a, b) => a.yEnd - b.yEnd);
    for (let k = 1; k < items.length; k++) {
      if (items[k].yLabel - items[k - 1].yLabel < 15) items[k].yLabel = items[k - 1].yLabel + 15;
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, n, top]);

  const linePath = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const xEnd = xAt(n - 1);
  const hovered = idx ?? null;

  function pick(clientX: number, rect: DOMRect) {
    const px = clientX - rect.left;
    const i = n > 1 ? Math.round((px - M.l) / step) : 0;
    setIdx(Math.max(0, Math.min(n - 1, i)));
  }

  const tooltipLeft = hovered === null ? 0 : xAt(hovered) + 14 > width - 190 ? xAt(hovered) - 190 : xAt(hovered) + 14;

  return (
    <div className="flex flex-col gap-3">
      {/* Forklaring (alltid med ved flere serier) */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px]" style={{ background: "var(--viz-muted)" }} />
          {volumeLabel}
        </li>
      </ul>

      <div
        ref={ref}
        className="relative w-full outline-none"
        tabIndex={0}
        role="img"
        aria-label={t("pipelineAria", {
          weeks: n,
          summary: series.map((s) => `${s.label}: ${s.values[n - 1] ?? 0}`).join(", "),
        })}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, (i ?? n) - 1));
          if (e.key === "ArrowRight") setIdx((i) => Math.min(n - 1, (i ?? -1) + 1));
          if (e.key === "Escape") setIdx(null);
        }}
        onBlur={() => setIdx(null)}
      >
        <svg width={width} height={H} className="block select-none" aria-hidden="true">
          {/* Rutenett og y-akse (hovedgraf) */}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={M.l + plotW} y1={y(v)} y2={y(v)} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={M.l - 8} y={y(v) + 3.5} textAnchor="end" className="fill-muted text-[10px] tabular-nums">
                {v}
              </text>
            </g>
          ))}

          {/* Flate under første serie (svak vask) */}
          {series[0] && (
            <path
              d={`${linePath(series[0].values)}L${xEnd},${y(0)}L${xAt(0)},${y(0)}Z`}
              fill={series[0].color}
              opacity={0.1}
            />
          )}

          {/* Linjer, bakerst først */}
          {[...series].reverse().map((s) => (
            <path key={s.key} d={linePath(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {/* Endepunkter og direkte etiketter */}
          {endLabels.map(({ s, yEnd, yLabel }) => (
            <g key={s.key}>
              <circle cx={xEnd} cy={yEnd} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              {Math.abs(yLabel - yEnd) > 2 && (
                <line x1={xEnd + 5} y1={yEnd} x2={xEnd + 12} y2={yLabel} stroke="var(--viz-muted)" strokeWidth={1} />
              )}
              <text x={xEnd + 14} y={yLabel + 4} className="text-[11px]">
                <tspan className="fill-foreground font-semibold tabular-nums">{s.values[n - 1] ?? 0}</tspan>
                <tspan className="fill-muted"> {s.label}</tspan>
              </text>
            </g>
          ))}

          {/* Volum: søknader per uke */}
          <text x={M.l} y={volTop - 10} className="fill-muted text-[10px] font-semibold uppercase tracking-[0.12em]">
            {volumeLabel}
          </text>
          <line x1={M.l - barW / 2} x2={M.l + plotW + barW / 2} y1={volTop + VOL_H} y2={volTop + VOL_H} stroke="var(--viz-grid)" />
          <text x={M.l - 8} y={volTop + 3} textAnchor="end" className="fill-muted text-[10px] tabular-nums">
            {volMax}
          </text>
          {volume.map((v, i) => (
            <path
              key={weeks[i]}
              d={columnPath(xAt(i) - barW / 2, yv(v), barW, volTop + VOL_H - yv(v))}
              fill={i === hovered || (hovered === null && i === n - 1) ? "var(--viz-1)" : "var(--viz-muted)"}
              opacity={hovered === null || i === hovered ? 1 : 0.55}
            />
          ))}

          {/* X-akse: måneder */}
          {monthLabels.map((m) => (
            <text key={m.i} x={xAt(m.i)} y={H - 6} textAnchor="middle" className="fill-muted text-[10px]">
              {m.text}
            </text>
          ))}

          {/* Trådkors */}
          {hovered !== null && (
            <g>
              <line x1={xAt(hovered)} x2={xAt(hovered)} y1={M.t} y2={volTop + VOL_H} stroke="var(--muted)" strokeWidth={1} opacity={0.5} />
              {series.map((s) => (
                <circle key={s.key} cx={xAt(hovered)} cy={y(s.values[hovered])} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          )}

          {/* Treffflate for mus/berøring */}
          <rect
            x={M.l - Math.max(step / 2, 12)}
            y={M.t}
            width={plotW + Math.max(step, 24)}
            height={volTop + VOL_H - M.t}
            fill="transparent"
            onPointerMove={(e) => pick(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect())}
            onPointerDown={(e) => pick(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect())}
            onPointerLeave={() => setIdx(null)}
          />
        </svg>

        {hovered !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-44 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg shadow-black/10"
            style={{ left: Math.max(0, tooltipLeft) }}
          >
            <p className="eyebrow mb-1.5 text-[10px] text-muted">
              {t("week", { week: isoWeek(weeks[hovered]) })} · {shortDate(weeks[hovered])}
            </p>
            <ul className="flex flex-col gap-1">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="font-semibold tabular-nums text-foreground">{s.values[hovered]}</span>
                  <span className="truncate text-muted">{s.label}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 border-t border-border pt-1">
                <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: "var(--viz-1)" }} />
                <span className="font-semibold tabular-nums text-foreground">{volume[hovered]}</span>
                <span className="truncate text-muted">{t("thisWeek")}</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Tabellvisning for skjermlesere */}
      <table className="sr-only">
        <caption>{t("tableCaption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("weekCol")}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
            <th scope="col">{volumeLabel}</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr key={w}>
              <th scope="row">{t("week", { week: isoWeek(w) })}</th>
              {series.map((s) => (
                <td key={s.key}>{s.values[i]}</td>
              ))}
              <td>{volume[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
