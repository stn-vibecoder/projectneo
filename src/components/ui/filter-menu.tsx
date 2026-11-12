"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

/**
 * Kompakt filterknapp («pill») som åpner en liten meny.
 * Lyser opp når et annet valg enn standard er aktivt.
 */
export function FilterMenu({
  icon,
  label,
  value,
  options,
  onChange,
  active,
  align = "left",
  variant = "pill",
}: {
  icon?: React.ReactNode;
  /** Vises når standardvalget er aktivt, f.eks. «By». */
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  /** Om filteret skal vises som aktivt (fremhevet). */
  active: boolean;
  align?: "left" | "right";
  variant?: "pill" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-colors [&_svg]:size-3.5",
          variant === "pill" &&
            (active
              ? "bg-accent-soft text-accent ring-1 ring-accent/30"
              : "bg-surface-muted text-muted hover:bg-border/60 hover:text-foreground"),
          variant === "ghost" && "text-muted hover:text-foreground",
          open && !active && variant === "pill" && "bg-border/60 text-foreground",
        )}
      >
        {icon}
        <span>{active && current ? current.label : label}</span>
        <ChevronDown className={cn("opacity-60 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ul
          id={menuId}
          role="listbox"
          className={cn(
            "absolute top-full z-40 mt-2 max-h-80 min-w-52 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg shadow-black/5 dark:shadow-black/40",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-muted",
                    selected && "font-medium text-accent",
                  )}
                >
                  {o.label}
                  {selected && <Check className="size-4" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
