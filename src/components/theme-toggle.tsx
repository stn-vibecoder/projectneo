"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", icon: Sun, key: "themeLight" },
  { value: "dark", icon: Moon, key: "themeDark" },
  { value: "system", icon: Monitor, key: "themeSystem" },
] as const;

export function ThemeToggle({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const t = useTranslations("nav");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- unngår hydreringsavvik for tema
  useEffect(() => setMounted(true), []);

  return (
    <div role="radiogroup" aria-label={t("theme")} className={cn(
        "inline-flex rounded-md border p-0.5",
        inverted ? "border-sidebar-border bg-sidebar-hover" : "border-border bg-surface",
        className,
      )}>
      {OPTIONS.map(({ value, icon: Icon, key }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={t(key)}
            aria-label={t(key)}
            onClick={() => setTheme(value)}
            className={cn(
              "flex size-7 items-center justify-center rounded transition-colors",
              inverted
                ? cn("text-sidebar-muted hover:text-sidebar-foreground", active && "bg-sidebar text-gold")
                : cn("text-muted hover:text-foreground", active && "bg-surface-muted text-foreground"),
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
