"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Briefcase,
  Columns3,
  Download,
  FileText,
  LayoutDashboard,
  Plus,
  Radar,
  Search,
  Settings,
  SquareKanban,
  Table2,
} from "lucide-react";
import { getPaletteData, type PaletteData } from "@/lib/actions/palette";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "open-command-palette";

/** Åpne hurtigsøket fra en knapp hvor som helst i appen. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type Item = {
  key: string;
  group: "pages" | "actions" | "applications" | "jobs";
  label: string;
  sub?: string;
  href: string;
  /** Vanlig nedlasting/lenke i stedet for klientnavigasjon. */
  hard?: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

const GROUPS = ["pages", "actions", "applications", "jobs"] as const;
const MAX_PER_GROUP = 6;

export function CommandPalette() {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [data, setData] = useState<PaletteData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  // Åpne med ⌘K / Ctrl+K, eller fra en knapp.
  useEffect(() => {
    const show = () => {
      lastFocus.current = document.activeElement as HTMLElement | null;
      setQ("");
      setActive(0);
      setOpen(true);
      // Hent ferske data hver gang det åpnes (billig, og alltid oppdatert).
      getPaletteData().then(setData).catch(() => setData({ applications: [], jobs: [] }));
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, show);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else lastFocus.current?.focus?.();
  }, [open]);

  const all = useMemo<Item[]>(() => {
    const items: Item[] = [
      { key: "p-dash", group: "pages", label: t("nav.dashboard"), href: "/dashboard", icon: LayoutDashboard },
      { key: "p-feed", group: "pages", label: t("nav.feed"), href: "/feed", icon: Briefcase },
      { key: "p-tracker", group: "pages", label: t("nav.tracker"), sub: t("palette.sheet"), href: "/tracker", icon: Table2 },
      { key: "p-board", group: "pages", label: t("nav.tracker"), sub: t("palette.board"), href: "/tracker?view=board", icon: Columns3 },
      { key: "p-sources", group: "pages", label: t("nav.sources"), href: "/sources", icon: Radar },
      { key: "p-settings", group: "pages", label: t("nav.settings"), href: "/settings", icon: Settings },
      { key: "a-add", group: "actions", label: t("nav.addJob"), href: "/jobs/new", icon: Plus },
      { key: "a-export", group: "actions", label: t("palette.export"), href: "/tracker/export", hard: true, icon: Download },
    ];
    for (const a of data?.applications ?? []) {
      items.push({ key: `app-${a.id}`, group: "applications", label: `${a.company} – ${a.title}`, sub: a.status, href: `/tracker/${a.id}`, icon: SquareKanban });
    }
    for (const j of data?.jobs ?? []) {
      items.push({ key: `job-${j.id}`, group: "jobs", label: j.title, sub: j.company, href: `/jobs/${j.id}`, icon: FileText });
    }
    return items;
  }, [data, t]);

  const results = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (i: Item) => {
      const hay = `${i.label} ${i.sub ?? ""}`.toLowerCase();
      return tokens.every((tok) => hay.includes(tok));
    };
    return GROUPS.flatMap((g) => {
      const items = all.filter((i) => i.group === g && match(i));
      // Uten søk: vis bare sider og handlinger, så lista er kort.
      if (!tokens.length && (g === "applications" || g === "jobs")) return items.slice(0, 3);
      return items.slice(0, MAX_PER_GROUP);
    });
  }, [all, q]);

  const current = Math.min(active, Math.max(0, results.length - 1));

  function go(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    if (item.hard) window.location.assign(item.href);
    else router.push(item.href);
  }

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [current, results]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="presentation">
      <button type="button" aria-label={t("common.close")} tabIndex={-1} onClick={() => setOpen(false)} className="animate-fade absolute inset-0 cursor-default bg-sidebar/60 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("palette.open")}
        className="animate-pop relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/30"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((current + 1) % Math.max(1, results.length));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((current - 1 + results.length) % Math.max(1, results.length));
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(results[current]);
          } else if (e.key === "Tab") {
            e.preventDefault(); // hold fokus i dialogen
          }
        }}
      >
        <div className="relative flex items-center border-b border-border">
          <Search className="pointer-events-none absolute left-4 size-[18px] text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[current] ? `palette-${results[current].key}` : undefined}
            aria-label={t("palette.placeholder")}
            placeholder={t("palette.placeholder")}
            className="h-13 w-full bg-transparent pl-11 pr-4 text-[15px] placeholder:text-muted/70 focus:outline-none"
          />
        </div>

        <div ref={listRef} id="palette-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">{data ? t("palette.empty") : t("palette.loading")}</p>}
          {GROUPS.map((g) => {
            const items = results.filter((r) => r.group === g);
            if (!items.length) return null;
            return (
              <div key={g} role="group" aria-label={t(`palette.${g}`)}>
                <p className="eyebrow px-3 pb-1 pt-2.5 text-[10px] text-muted">{t(`palette.${g}`)}</p>
                {items.map((item) => {
                  const index = results.indexOf(item);
                  const selected = index === current;
                  return (
                    <div
                      key={item.key}
                      id={`palette-${item.key}`}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => setActive(index)}
                      onClick={() => go(item)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
                        selected && "bg-accent-soft text-accent",
                      )}
                    >
                      <item.icon className={cn("size-4 shrink-0", selected ? "text-accent" : "text-muted")} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.sub && <span className="max-w-40 shrink-0 truncate text-xs text-muted">{item.sub}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p className="border-t border-border bg-surface-muted/60 px-4 py-2 text-[11px] text-muted">{t("palette.hint")}</p>
      </div>
    </div>
  );
}
