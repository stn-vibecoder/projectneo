"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUpDown, Briefcase, CalendarRange, Hourglass, MapPin, Search, Star, X } from "lucide-react";
import { FilterMenu } from "@/components/ui/filter-menu";
import { INDUSTRIES, PERIODS, type City } from "@/lib/domain";
import { cn } from "@/lib/utils";

const FILTER_KEYS = ["watch", "city", "industry", "period", "deadline", "q"] as const;

export function FeedFilters({
  cities,
  hasPreferredIndustries,
  count,
  watchCount,
}: {
  cities: City[];
  hasPreferredIndustries: boolean;
  count: number;
  watchCount: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const get = (k: string) => params.get(k) ?? "";

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const s = next.toString();
    startTransition(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  }

  // Søk med liten forsinkelse mens man skriver.
  useEffect(() => {
    if (q === get("q")) return;
    const id = setTimeout(() => update({ q: q.trim() }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = FILTER_KEYS.some((k) => get(k));

  const industryOptions = [
    ...(hasPreferredIndustries
      ? [
          { value: "", label: t("feed.myIndustries") },
          { value: "all", label: t("feed.allIndustries") },
        ]
      : [{ value: "", label: t("feed.allIndustries") }]),
    ...INDUSTRIES.map((v) => ({ value: v, label: t(`enums.industry.${v}`) })),
  ];

  const sortOptions = [
    { value: "", label: t("feed.sortDeadline") },
    { value: "newest", label: t("feed.sortNewest") },
    { value: "company", label: t("feed.sortCompany") },
  ];

  return (
    <div
      className={cn(
        "mb-6 rounded-2xl border border-border bg-surface shadow-sm shadow-black/[0.03] transition-opacity focus-within:border-accent/40",
        pending && "opacity-70",
      )}
    >
      {/* Søk */}
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-4 size-[18px] text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("feed.companyPlaceholder")}
          aria-label={t("feed.companyFilter")}
          className="h-14 w-full rounded-t-2xl bg-transparent pl-11 pr-11 text-[15px] text-foreground placeholder:text-muted/70 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              update({ q: "" });
            }}
            aria-label={t("feed.clearSearch")}
            className="absolute right-3 flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2.5 sm:px-4">
        <button
          type="button"
          aria-pressed={get("watch") === "1"}
          onClick={() => update({ watch: get("watch") === "1" ? "" : "1" })}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-colors [&_svg]:size-3.5",
            get("watch") === "1"
              ? "bg-gold-soft text-gold ring-1 ring-gold/40"
              : "bg-surface-muted text-muted hover:bg-border/60 hover:text-foreground",
          )}
        >
          <Star className={cn(get("watch") === "1" && "fill-current")} />
          {t("watch.filter")}
          <span className="num text-[11px] opacity-70">{watchCount}</span>
        </button>
        {cities.length > 1 && (
          <FilterMenu
            icon={<MapPin />}
            label={t("feed.cityAll")}
            value={get("city")}
            active={!!get("city")}
            onChange={(v) => update({ city: v })}
            options={[
              { value: "", label: t("feed.cityAll") },
              ...cities.map((c) => ({ value: c, label: t(`enums.city.${c}`) })),
            ]}
          />
        )}
        <FilterMenu
          icon={<Briefcase />}
          label={hasPreferredIndustries ? t("feed.myIndustries") : t("feed.industryFilter")}
          value={get("industry")}
          active={!!get("industry")}
          onChange={(v) => update({ industry: v })}
          options={industryOptions}
        />
        <FilterMenu
          icon={<CalendarRange />}
          label={t("feed.periodFilter")}
          value={get("period")}
          active={!!get("period")}
          onChange={(v) => update({ period: v })}
          options={[
            { value: "", label: t("feed.periodAll") },
            ...PERIODS.map((v) => ({ value: v, label: t(`enums.period.${v}`) })),
          ]}
        />
        <FilterMenu
          icon={<Hourglass />}
          label={t("feed.deadlineFilter")}
          value={get("deadline")}
          active={!!get("deadline")}
          onChange={(v) => update({ deadline: v })}
          options={[
            { value: "", label: t("feed.deadlineAny") },
            { value: "7", label: t("feed.deadline7") },
            { value: "30", label: t("feed.deadline30") },
            { value: "none", label: t("feed.deadlineNone") },
          ]}
        />

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              update(Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])));
            }}
            className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] text-muted hover:text-foreground"
          >
            <X className="size-3.5" />
            {t("common.clearFilters")}
          </button>
        )}

        <div className="ml-auto flex items-center gap-1 pl-2 text-[13px] text-muted">
          <span className="tabular-nums">{t("feed.results", { count })}</span>
          <span aria-hidden="true" className="px-1 text-border">
            |
          </span>
          <FilterMenu
            variant="ghost"
            align="right"
            icon={<ArrowUpDown />}
            label={sortOptions.find((o) => o.value === get("sort"))?.label ?? sortOptions[0].label}
            value={get("sort")}
            active={false}
            onChange={(v) => update({ sort: v })}
            options={sortOptions}
          />
        </div>
      </div>
    </div>
  );
}
