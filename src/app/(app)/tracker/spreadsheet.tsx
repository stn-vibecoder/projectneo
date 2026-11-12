"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Download, ListTree, MapPin, Plus, Search, SquareKanban } from "lucide-react";
import { CityIcon } from "@/components/city-icon";
import { FilterMenu } from "@/components/ui/filter-menu";
import { moveApplication, updateApplicationField, type EditableField } from "@/lib/actions/applications";
import { RatingSelect } from "@/components/rating-select";
import { RATINGS, statusColor, type City } from "@/lib/domain";
import { daysBetween, daysSince } from "@/lib/tracker/dates";
import type { ApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TrackerItem } from "./types";

// ---------------------------------------------------------------------
// Kolonner
// ---------------------------------------------------------------------

type ColKey =
  | "number"
  | "company"
  | "title"
  | "city"
  | "industry"
  | "status"
  | "rating"
  | "appliedAt"
  | "deadline"
  | "daysToDeadline"
  | "nextStep"
  | "nextStepAt"
  | "lastActivity"
  | "notes";

const COLS: { key: ColKey; width: number; sortable: boolean; align?: "right" | "center" }[] = [
  { key: "number", width: 44, sortable: false, align: "center" },
  { key: "company", width: 200, sortable: true },
  { key: "title", width: 270, sortable: true },
  { key: "city", width: 130, sortable: true },
  { key: "industry", width: 140, sortable: true },
  { key: "status", width: 180, sortable: true },
  { key: "rating", width: 78, sortable: true, align: "center" },
  { key: "appliedAt", width: 136, sortable: true },
  { key: "deadline", width: 136, sortable: true },
  { key: "daysToDeadline", width: 86, sortable: true, align: "right" },
  { key: "nextStep", width: 220, sortable: true },
  { key: "nextStepAt", width: 136, sortable: true },
  { key: "lastActivity", width: 86, sortable: true, align: "right" },
  { key: "notes", width: 300, sortable: false },
];

// Kolonnene som står fast når man ruller sidelengs.
const STICKY_LEFT: Partial<Record<ColKey, number>> = { number: 0, company: 44 };

type Sort = { key: ColKey; dir: 1 | -1 } | null;

// ---------------------------------------------------------------------
// Redigerbar celle
// ---------------------------------------------------------------------

function EditableCell({
  value,
  type,
  field,
  applicationId,
  row,
  col,
  placeholder,
  className,
}: {
  value: string | null;
  type: "text" | "date";
  field: EditableField;
  applicationId: string;
  row: number;
  col: number;
  placeholder?: string;
  className?: string;
}) {
  const t = useTranslations("tracker");
  const ref = useRef<HTMLInputElement>(null);
  const saved = useRef(value ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [, start] = useTransition();

  // Hold cellen i synk med serveren når den ikke er i bruk.
  useEffect(() => {
    saved.current = value ?? "";
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.value = value ?? "";
      ref.current.dataset.empty = String(!value);
    }
  }, [value]);

  function commit() {
    const next = ref.current?.value ?? "";
    if (next.trim() === saved.current.trim()) return;
    setState("saving");
    start(async () => {
      const res = await updateApplicationField(applicationId, field, next);
      if (res.ok) {
        saved.current = next;
        setState("saved");
        setTimeout(() => setState("idle"), 900);
      } else {
        if (ref.current) ref.current.value = saved.current;
        setState("idle");
        toast.error(res.error || t("saveFailed"));
      }
    });
  }

  return (
    <input
      ref={ref}
      type={type}
      defaultValue={value ?? ""}
      placeholder={placeholder}
      data-cell={`${row}:${col}`}
      aria-label={field}
      data-empty={!value}
      // Som i et regneark: det du skriver erstatter innholdet i cellen.
      onFocus={(e) => type === "text" && e.currentTarget.select()}
      onInput={(e) => (e.currentTarget.dataset.empty = String(!e.currentTarget.value))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          // Som i Excel: Enter lagrer og går ned til cellen under.
          e.preventDefault();
          ref.current?.blur();
          const below = document.querySelector<HTMLInputElement>(`[data-cell="${row + 1}:${col}"]`);
          below?.focus();
        }
        if (e.key === "Escape") {
          if (ref.current) ref.current.value = saved.current;
          ref.current?.blur();
        }
      }}
      className={cn(
        "h-9 w-full min-w-0 bg-transparent px-2.5 text-[13px] text-foreground transition-colors placeholder:text-muted/40 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent",
        // Skjul nettleserens «dd.mm.åååå» i tomme datoceller til de får fokus.
        type === "date" && "tabular-nums data-[empty=true]:[&:not(:focus)]:text-transparent",
        state === "saving" && "bg-gold-soft",
        state === "saved" && "bg-positive/10",
        className,
      )}
    />
  );
}

function StatusCell({ item, statuses }: { item: TrackerItem; statuses: ApplicationStatus[] }) {
  const t = useTranslations("tracker");
  const [pending, start] = useTransition();
  const current = statuses.find((s) => s.id === item.statusId);
  return (
    <div className="relative flex h-9 items-center">
      <span className={cn("pointer-events-none absolute left-2.5 size-2 rounded-full", statusColor(current?.color ?? "slate").dot)} />
      <select
        aria-label={t("cols.status")}
        value={item.statusId}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          start(async () => {
            const res = await moveApplication({ applicationId: item.id, statusId: next });
            if (res.ok) toast.success(t("moved", { status: statuses.find((s) => s.id === next)?.label ?? "" }));
            else toast.error(res.error);
          });
        }}
        className="h-9 w-full cursor-pointer appearance-none bg-transparent pl-6 pr-6 text-[13px] font-medium text-foreground focus:bg-surface focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent disabled:opacity-50"
      >
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------
// Regnearket
// ---------------------------------------------------------------------

export function Spreadsheet({
  items,
  statuses,
  today,
  showArchived,
}: {
  items: TrackerItem[];
  statuses: ApplicationStatus[];
  today: string;
  showArchived: boolean;
}) {
  const t = useTranslations();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [grouped, setGrouped] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort>(null);

  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const cityOptions = useMemo(() => [...new Set(items.flatMap((i) => i.cities))], [items]);

  const toDeadline = (i: TrackerItem) => (i.deadline && !i.appliedAt ? daysBetween(today, i.deadline) : null);
  const sinceActivity = (i: TrackerItem) => daysSince(i.lastActivityAt, today);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!statusFilter || i.statusId === statusFilter) &&
        (!cityFilter || i.cities.includes(cityFilter as City)) &&
        (!needle ||
          i.company.toLowerCase().includes(needle) ||
          i.title.toLowerCase().includes(needle) ||
          (i.notes ?? "").toLowerCase().includes(needle) ||
          (i.nextStep ?? "").toLowerCase().includes(needle)),
    );
  }, [items, q, statusFilter, cityFilter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const val = (i: TrackerItem): string | number | null => {
      switch (sort.key) {
        case "company":
          return i.company;
        case "title":
          return i.title;
        case "city":
          return i.cities[0] ?? null;
        case "industry":
          return i.industry ? t(`enums.industry.${i.industry}`) : null;
        case "status":
          return statusById.get(i.statusId)?.position ?? 0;
        case "rating":
          return i.rating ? RATINGS.indexOf(i.rating) : null;
        case "appliedAt":
          return i.appliedAt;
        case "deadline":
          return i.deadline;
        case "daysToDeadline":
          return toDeadline(i);
        case "nextStep":
          return i.nextStep;
        case "nextStepAt":
          return i.nextStepAt;
        case "lastActivity":
          return sinceActivity(i);
        default:
          return null;
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1; // tomme celler alltid nederst
      if (vb === null) return -1;
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "nb");
      return cmp * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, statusById, today]);

  const groups = useMemo(() => {
    if (!grouped) return [{ status: null as ApplicationStatus | null, rows: sorted }];
    return statuses
      .map((s) => ({ status: s as ApplicationStatus | null, rows: sorted.filter((i) => i.statusId === s.id) }))
      .filter((g) => g.rows.length > 0);
  }, [grouped, sorted, statuses]);

  // Summeringslinje
  const applied = filtered.filter((i) => i.appliedAt).length;
  const due7 = filtered.filter((i) => {
    const d = toDeadline(i);
    return d !== null && d >= 0 && d <= 7;
  }).length;
  const avgSince = filtered.length
    ? Math.round(filtered.reduce((sum, i) => sum + sinceActivity(i), 0) / filtered.length)
    : 0;

  const totalWidth = COLS.reduce((s, c) => s + c.width, 0);
  // Radnummer som i et regneark: fortløpende over synlige rader.
  const rowNumbers = new Map(
    groups
      .flatMap((g) => (g.status && collapsed.has(g.status.id) ? [] : g.rows))
      .map((i, idx) => [i.id, idx + 1] as const),
  );

  const stickyCell = (key: ColKey) =>
    key in STICKY_LEFT ? { position: "sticky" as const, left: STICKY_LEFT[key], zIndex: 10 } : undefined;

  return (
    <div className="flex flex-col gap-3">
      {/* Verktøylinje */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("tracker.searchPlaceholder")}
            aria-label={t("tracker.searchPlaceholder")}
            className="h-8 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-[13px] placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <FilterMenu
          icon={<SquareKanban />}
          label={t("tracker.allStatuses")}
          value={statusFilter}
          active={!!statusFilter}
          onChange={setStatusFilter}
          options={[{ value: "", label: t("tracker.allStatuses") }, ...statuses.map((s) => ({ value: s.id, label: s.label }))]}
        />
        {cityOptions.length > 1 && (
          <FilterMenu
            icon={<MapPin />}
            label={t("tracker.allCities")}
            value={cityFilter}
            active={!!cityFilter}
            onChange={setCityFilter}
            options={[{ value: "", label: t("tracker.allCities") }, ...cityOptions.map((c) => ({ value: c, label: t(`enums.city.${c}`) }))]}
          />
        )}
        <button
          type="button"
          aria-pressed={grouped}
          onClick={() => setGrouped((g) => !g)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors [&_svg]:size-3.5",
            grouped ? "bg-accent-soft text-accent ring-1 ring-accent/30" : "bg-surface-muted text-muted hover:text-foreground",
          )}
        >
          <ListTree />
          {t("tracker.groupByStatus")}
        </button>
        <Link
          href="/jobs/new"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium hover:bg-surface-muted [&_svg]:size-3.5"
        >
          <Plus />
          {t("tracker.addRow")}
        </Link>
        <a
          href={`/tracker/export${showArchived ? "?archived=1" : ""}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium hover:bg-surface-muted [&_svg]:size-3.5"
        >
          <Download />
          {t("tracker.export")}
        </a>
      </div>
      <p className="text-xs text-muted">{t("tracker.editHint")}</p>

      {/* Rutenettet */}
      <div className="relative max-h-[calc(100dvh-270px)] min-h-72 overflow-auto rounded-lg border border-border bg-surface">
        <table className="border-separate border-spacing-0 text-[13px]" style={{ width: totalWidth, tableLayout: "fixed" }}>
          <colgroup>
            {COLS.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLS.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : undefined}
                    style={{ ...stickyCell(c.key), top: 0, zIndex: c.key in STICKY_LEFT ? 30 : 20, position: "sticky" }}
                    className={cn(
                      "eyebrow h-9 border-b border-r border-border bg-surface-muted px-2.5 text-left text-[10px] text-muted last:border-r-0",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.key === "company" && "border-r-2",
                    )}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSort((s) => (s?.key !== c.key ? { key: c.key, dir: 1 } : s.dir === 1 ? { key: c.key, dir: -1 } : null))
                        }
                        className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", active && "text-foreground")}
                      >
                        {t(`tracker.cols.${c.key}`)}
                        {active && (sort!.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                      </button>
                    ) : (
                      t(`tracker.cols.${c.key}`)
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          {groups.map((g) => {
            const isCollapsed = g.status ? collapsed.has(g.status.id) : false;
            return (
              <tbody key={g.status?.id ?? "all"}>
                {g.status && (
                  <tr>
                    <td colSpan={COLS.length} className="h-8 border-b border-border bg-surface-muted/60 p-0">
                      <button
                        type="button"
                        aria-expanded={!isCollapsed}
                        onClick={() =>
                          setCollapsed((prev) => {
                            const next = new Set(prev);
                            if (next.has(g.status!.id)) next.delete(g.status!.id);
                            else next.add(g.status!.id);
                            return next;
                          })
                        }
                        className="sticky left-0 inline-flex h-8 items-center gap-2 px-2.5 text-left"
                      >
                        {isCollapsed ? <ChevronRight className="size-3.5 text-muted" /> : <ChevronDown className="size-3.5 text-muted" />}
                        <span className={cn("size-2 rounded-full", statusColor(g.status.color).dot)} />
                        <span className="eyebrow text-foreground">{g.status.label}</span>
                        <span className="num rounded-sm bg-surface px-1.5 text-[11px] text-muted">{g.rows.length}</span>
                      </button>
                    </td>
                  </tr>
                )}
                {!isCollapsed &&
                  g.rows.map((i) => {
                    const r = rowNumbers.get(i.id) ?? 0;
                    const dl = toDeadline(i);
                    const since = sinceActivity(i);
                    return (
                      <tr key={i.id} className={cn("group", i.archived && "opacity-60")}>
                        {/* # */}
                        <td
                          style={stickyCell("number")}
                          className="num h-9 border-b border-r border-border bg-surface-muted text-center text-[11px] text-muted group-hover:bg-accent-soft"
                        >
                          {r}
                        </td>
                        {/* Selskap */}
                        <td
                          style={stickyCell("company")}
                          // Faste kolonner må ha helt dekkende bakgrunn, ellers skinner innholdet under gjennom.
                          className="h-9 truncate border-b border-r-2 border-border bg-surface px-2.5 font-medium group-hover:bg-accent-soft"
                          title={i.company}
                        >
                          {i.company}
                        </td>
                        {/* Stilling */}
                        <td className="h-9 truncate border-b border-r border-border px-2.5 group-hover:bg-accent-soft/30" title={i.title}>
                          <Link href={`/tracker/${i.id}`} className="hover:text-accent hover:underline">
                            {i.title}
                          </Link>
                        </td>
                        {/* By */}
                        <td className="h-9 border-b border-r border-border px-2.5 text-muted group-hover:bg-accent-soft/30">
                          {i.cities[0] && (
                            <span className="inline-flex items-center gap-1.5">
                              <CityIcon city={i.cities[0]} className="size-3.5 text-gold" />
                              {t(`enums.city.${i.cities[0]}`)}
                              {i.cities.length > 1 && <span className="num text-[11px]">+{i.cities.length - 1}</span>}
                            </span>
                          )}
                        </td>
                        {/* Bransje */}
                        <td className="h-9 truncate border-b border-r border-border px-2.5 text-muted group-hover:bg-accent-soft/30">
                          {i.industry ? t(`enums.industry.${i.industry}`) : ""}
                        </td>
                        {/* Status */}
                        <td className="h-9 border-b border-r border-border p-0 group-hover:bg-accent-soft/30">
                          <StatusCell item={i} statuses={statuses} />
                        </td>
                        {/* Rating */}
                        <td className="h-9 border-b border-r border-border p-0 text-center group-hover:bg-accent-soft/30">
                          <RatingSelect applicationId={i.id} value={i.rating} cell />
                        </td>
                        {/* Søkt */}
                        <td className="h-9 border-b border-r border-border p-0 group-hover:bg-accent-soft/30">
                          <EditableCell value={i.appliedAt} type="date" field="applied_at" applicationId={i.id} row={r} col={6} />
                        </td>
                        {/* Frist */}
                        <td className="h-9 border-b border-r border-border p-0 group-hover:bg-accent-soft/30">
                          <EditableCell
                            value={i.deadline}
                            type="date"
                            field="deadline"
                            applicationId={i.id}
                            row={r}
                            col={7}
                            className={cn(dl !== null && dl >= 0 && dl <= 3 && "font-semibold text-negative")}
                          />
                        </td>
                        {/* Til frist (beregnet) */}
                        <td
                          className={cn(
                            "num h-9 border-b border-r border-border px-2.5 text-right group-hover:bg-accent-soft/30",
                            dl === null && "text-muted",
                            dl !== null && dl < 0 && "text-muted",
                            dl !== null && dl >= 0 && dl <= 3 && "font-semibold text-negative",
                            dl !== null && dl > 3 && dl <= 7 && "text-gold",
                          )}
                        >
                          {dl === null ? "" : dl < 0 ? t("tracker.overdue") : t("tracker.daysShort", { count: dl })}
                        </td>
                        {/* Neste steg */}
                        <td className="h-9 border-b border-r border-border p-0 group-hover:bg-accent-soft/30">
                          <EditableCell
                            value={i.nextStep}
                            type="text"
                            field="next_step"
                            applicationId={i.id}
                            row={r}
                            col={9}
                            placeholder="–"
                          />
                        </td>
                        {/* Dato neste steg */}
                        <td className="h-9 border-b border-r border-border p-0 group-hover:bg-accent-soft/30">
                          <EditableCell value={i.nextStepAt} type="date" field="next_step_at" applicationId={i.id} row={r} col={10} />
                        </td>
                        {/* Sist aktiv (beregnet) */}
                        <td
                          className={cn(
                            "num h-9 border-b border-r border-border px-2.5 text-right text-muted group-hover:bg-accent-soft/30",
                            since >= 14 && "text-gold",
                          )}
                        >
                          {t("tracker.daysShort", { count: since })}
                        </td>
                        {/* Notater */}
                        <td className="h-9 border-b border-border p-0 group-hover:bg-accent-soft/30">
                          <EditableCell value={i.notes} type="text" field="notes" applicationId={i.id} row={r} col={12} placeholder="–" />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            );
          })}

          {filtered.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={COLS.length} className="h-24 px-4 text-sm text-muted">
                  <span className="sticky left-4">{t("tracker.noResults")}</span>
                </td>
              </tr>
            </tbody>
          )}

          {/* Summeringslinje */}
          <tfoot>
            <tr>
              <td colSpan={COLS.length} className="sticky bottom-0 z-20 h-9 border-t border-border bg-surface-muted p-0">
                <div className="num sticky left-0 inline-flex h-9 items-center gap-4 px-3 text-[12px] text-muted">
                  <span className="font-semibold text-foreground">
                    Σ {t("tracker.footerCount", { count: filtered.length })}
                  </span>
                  <span>{t("tracker.footerApplied", { count: applied })}</span>
                  <span className={cn(due7 > 0 && "font-medium text-negative")}>{t("tracker.footerDue", { count: due7 })}</span>
                  <span>{t("tracker.footerAvg", { count: avgSince })}</span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
