"use client";

import { useCallback, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addMonths,
  itemsByDate,
  monthGrid,
  upcomingItems,
  type CalendarItem,
} from "@/lib/tracker/calendar";
import { dateOnlyToDate } from "@/lib/tracker/dates";
import { cn } from "@/lib/utils";
import { CalendarItemRow, TYPE_STYLE, useItemLabel } from "./calendar-item";
import { EventForm, type ApplicationOption } from "./event-form";

const MONDAY = "2024-01-01"; // brukes til ukedagsnavn

function DayCell({
  date,
  items,
  inMonth,
  isToday,
  isSelected,
  onSelect,
}: {
  date: string;
  items: CalendarItem[];
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("calendar");
  const format = useFormatter();
  const label = useItemLabel();
  const day = Number(date.slice(8, 10));

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`${format.dateTime(dateOnlyToDate(date), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}${items.length ? `, ${items.length}` : ""}`}
      className={cn(
        "flex min-h-14 flex-col items-stretch gap-0.5 rounded-md border border-transparent p-1 text-left transition-colors hover:bg-surface-muted sm:min-h-20",
        !inMonth && "opacity-40",
        isSelected && "border-accent bg-accent-soft/60 hover:bg-accent-soft/60",
      )}
    >
      <span
        className={cn(
          "num flex size-6 items-center justify-center self-center rounded-full text-xs sm:self-start",
          isToday && "bg-gold font-semibold text-sidebar",
        )}
      >
        {day}
      </span>
      {/* Mobil: prikker. Større skjermer: små etiketter. */}
      {items.length > 0 && (
        <span className="flex justify-center gap-0.5 sm:hidden">
          {items.slice(0, 3).map((it) => (
            <span key={it.key} className={cn("size-1.5 rounded-full", TYPE_STYLE[it.type].dot)} />
          ))}
        </span>
      )}
      <span className="hidden flex-col gap-0.5 sm:flex">
        {items.slice(0, 2).map((it) => (
          <span key={it.key} className={cn("truncate rounded px-1 text-[10px] leading-4", TYPE_STYLE[it.type].chip)}>
            {it.time ? `${it.time} ` : ""}
            {it.company ?? label(it)}
          </span>
        ))}
        {items.length > 2 && <span className="px-1 text-[10px] text-muted">{t("more", { count: items.length - 2 })}</span>}
      </span>
    </button>
  );
}

export function Calendar({
  items,
  today,
  applications,
}: {
  items: CalendarItem[];
  today: string;
  applications: ApplicationOption[];
}) {
  const t = useTranslations("calendar");
  const format = useFormatter();
  const [view, setView] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));
  const [selected, setSelected] = useState(today);
  const [adding, setAdding] = useState(false);
  const closeForm = useCallback(() => setAdding(false), []);

  const grid = useMemo(() => monthGrid(view.year, view.month), [view]);
  const byDate = useMemo(() => itemsByDate(items), [items]);
  const selectedItems = byDate.get(selected) ?? [];
  const upcoming = upcomingItems(items, today, 8).filter((i) => i.date !== selected);
  const monthPrefix = `${view.year}-${String(view.month + 1).padStart(2, "0")}`;

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = dateOnlyToDate(MONDAY);
        d.setUTCDate(d.getUTCDate() + i);
        return format.dateTime(d, { weekday: "short", timeZone: "UTC" });
      }),
    [format],
  );

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="inline-flex items-center gap-2 whitespace-nowrap font-serif text-base font-semibold">
          <CalendarDays className="size-4 text-gold" />
          <span className="capitalize">
            {format.dateTime(dateOnlyToDate(`${monthPrefix}-01`), { month: "long", year: "numeric", timeZone: "UTC" })}
          </span>
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("prevMonth")}
            onClick={() => setView((v) => addMonths(v.year, v.month, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setView({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 });
              setSelected(today);
            }}
          >
            {t("today")}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("nextMonth")}
            onClick={() => setView((v) => addMonths(v.year, v.month, 1))}
          >
            <ChevronRight />
          </Button>
          <Button size="sm" variant="soft" className="ml-1" onClick={() => setAdding(true)}>
            <Plus />
            <span className="hidden sm:inline">{t("add")}</span>
          </Button>
          <a
            href="/calendar/export"
            title={t("exportHelp")}
            aria-label={t("export")}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <Download className="size-4" />
          </a>
        </div>
      </div>

      <div className="px-2 pt-2 sm:px-3">
        <div className="grid grid-cols-7 gap-0.5 pb-1 text-center text-[11px] font-medium uppercase text-muted">
          {weekdays.map((w) => (
            <span key={w}>{w.replace(".", "")}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {grid.flat().map((date) => (
            <DayCell
              key={date}
              date={date}
              items={byDate.get(date) ?? []}
              inMonth={date.startsWith(monthPrefix)}
              isToday={date === today}
              isSelected={date === selected}
              onSelect={() => {
                setSelected(date);
                if (!date.startsWith(monthPrefix)) {
                  setView({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 });
                }
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        {adding && <EventForm key={selected} defaultDate={selected} applications={applications} onDone={closeForm} />}

        <section>
          <h3 className="eyebrow text-muted">
            {format.dateTime(dateOnlyToDate(selected), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
          </h3>
          {selectedItems.length === 0 ? (
            <p className="py-2 text-sm text-muted">{t("noItemsDay")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {selectedItems.map((it) => (
                <CalendarItemRow key={it.key} item={it} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="eyebrow text-muted">{t("upcoming")}</h3>
          {upcoming.length === 0 ? (
            <p className="py-2 text-sm text-muted">{t("noUpcoming")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((it) => (
                <CalendarItemRow key={it.key} item={it} showDate />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
