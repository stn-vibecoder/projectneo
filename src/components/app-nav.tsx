"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Briefcase, LayoutDashboard, Landmark, LogOut, Plus, Radar, Search, Settings, SquareKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/lib/actions/auth";
import { openCommandPalette } from "@/components/command-palette";

const ITEMS = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/feed", key: "feed", icon: Briefcase },
  { href: "/tracker", key: "tracker", icon: SquareKanban },
  { href: "/sources", key: "sources", icon: Radar },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

function Logo({ inverted = false }: { inverted?: boolean }) {
  const t = useTranslations("app");
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-md border border-gold/40 bg-sidebar text-gold">
        <Landmark className="size-[18px]" />
      </span>
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            "block truncate font-serif text-[17px] font-semibold",
            inverted ? "text-sidebar-foreground" : "text-foreground",
          )}
        >
          {t("name")}
        </span>
        <span className={cn("eyebrow block text-[9px]", inverted ? "text-gold" : "text-gold")}>{t("sectors")}</span>
      </span>
    </Link>
  );
}

export function Sidebar({ showSignOut = false }: { showSignOut?: boolean }) {
  const t = useTranslations("nav");
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-5 text-sidebar-foreground lg:flex">
      <Logo inverted />
      <Link
        href="/jobs/new"
        className="mt-7 inline-flex h-9 items-center gap-2 rounded-md border border-gold/40 px-3 text-sm font-medium text-gold transition-colors hover:bg-gold/10"
      >
        <Plus className="size-4" />
        {t("addJob")}
      </Link>
      <button
        type="button"
        onClick={openCommandPalette}
        className="mt-2 inline-flex h-9 items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-hover/60 px-3 text-sm text-sidebar-muted transition-colors hover:text-sidebar-foreground"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">{t("search")}</span>
        <kbd className="rounded border border-sidebar-border px-1.5 font-mono text-[10px]">⌘K</kbd>
      </button>
      <p className="eyebrow mt-6 mb-2 px-3 text-sidebar-muted">{t("menu")}</p>
      <Suspense fallback={<SidebarLinks isActive={() => false} />}>
        <ActiveLinks variant="sidebar" />
      </Suspense>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-sidebar-border pt-4">
        <ThemeToggle inverted />
        {showSignOut && (
          <form action={signOut}>
            <button
              type="submit"
              title={t("signOut")}
              aria-label={t("signOut")}
              className="flex size-9 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}

export function MobileHeader() {
  const t = useTranslations("nav");
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:hidden">
      <Logo inverted />
      <div className="flex items-center gap-2">
        {/* Temavelgeren ligger under Innstillinger på mobil, så toppen holdes ren. */}
        <ThemeToggle inverted className="max-sm:hidden" />
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label={t("search")}
          className="flex size-9 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
        >
          <Search className="size-[18px]" />
        </button>
        <Link
          href="/jobs/new"
          aria-label={t("addJob")}
          className={cn(buttonVariants({ size: "icon" }), "bg-gold text-sidebar hover:opacity-90")}
        >
          <Plus />
        </Link>
      </div>
    </header>
  );
}

export function MobileTabs() {
  return (
    <Suspense fallback={<TabLinks isActive={() => false} />}>
      <ActiveLinks variant="tabs" />
    </Suspense>
  );
}

/** usePathname() er kjøretidsdata; holdes inne i Suspense så sidene kan forhåndsrendres. */
function ActiveLinks({ variant }: { variant: "sidebar" | "tabs" }) {
  const isActive = useActive();
  return variant === "sidebar" ? <SidebarLinks isActive={isActive} /> : <TabLinks isActive={isActive} />;
}

function SidebarLinks({ isActive }: { isActive: (href: string) => boolean }) {
  const t = useTranslations("nav");
  return (
    <nav aria-label={t("mainNav")} className="flex flex-col gap-0.5">
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-9 items-center gap-3 rounded-md px-3 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground",
              active && "bg-sidebar-hover font-medium text-sidebar-foreground",
            )}
          >
            {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gold" />}
            <Icon className={cn("size-4", active && "text-gold")} />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

function TabLinks({ isActive }: { isActive: (href: string) => boolean }) {
  const t = useTranslations("nav");
  return (
    <nav
      aria-label={t("mainNav")}
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-sidebar-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] text-sidebar-muted",
              active && "font-medium text-gold",
            )}
          >
            {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-gold" />}
            <Icon className="size-5" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
