import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Archive, Briefcase, Columns3, Plus, SquareKanban, Table2 } from "lucide-react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getApplications, getStatuses, todayInOslo } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Board } from "./board";
import { Spreadsheet } from "./spreadsheet";
import { toTrackerItem } from "./types";

export const metadata = { title: "Søknader" };

async function TrackerContent({ searchParams }: PageProps<"/tracker">) {
  const t = await getTranslations();
  const sp = await searchParams;
  // Regneark er standard; tavla er et alternativ.
  const view = sp.view === "board" ? "board" : "sheet";
  const showArchived = sp.archived === "1";

  const [apps, statuses] = await Promise.all([getApplications({ includeArchived: showArchived }), getStatuses()]);
  const today = todayInOslo();
  const items = apps.map(toTrackerItem);

  const href = (params: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { view, archived: showArchived ? "1" : undefined, ...params };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "view" && v === "sheet")) next.set(k, v);
    const s = next.toString();
    return s ? `/tracker?${s}` : "/tracker";
  };

  if (items.length === 0 && !showArchived) {
    return (
      <>
        <PageHeader eyebrow={t("tracker.eyebrow")} title={t("tracker.title")} />
        <EmptyState icon={<SquareKanban />} title={t("tracker.emptyTitle")} body={t("tracker.emptyBody")}>
          <Link href="/feed" className={buttonVariants()}>
            <Briefcase />
            {t("tracker.goToFeed")}
          </Link>
          <Link href="/jobs/new" className={buttonVariants({ variant: "secondary" })}>
            <Plus />
            {t("nav.addJob")}
          </Link>
        </EmptyState>
      </>
    );
  }

  // Signatur som tvinger tavlen til å bygges på nytt når serverdata endres.
  const boardKey = items.map((i) => `${i.id}:${i.statusId}:${i.position}`).join("|") + statuses.map((s) => s.id).join();

  return (
    <>
      <PageHeader
        eyebrow={t("tracker.eyebrow")}
        title={t("tracker.title")}
        description={t("tracker.count", { count: items.length })}
        actions={
          <>
            <div role="tablist" className="inline-flex rounded-md border border-border bg-surface p-0.5">
              {(
                [
                  { key: "sheet", icon: Table2, label: t("tracker.sheet") },
                  { key: "board", icon: Columns3, label: t("tracker.board") },
                ] as const
              ).map(({ key, icon: Icon, label }) => (
                <Link
                  key={key}
                  role="tab"
                  aria-selected={view === key}
                  href={href({ view: key })}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm text-muted",
                    view === key && "bg-surface-muted font-medium text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </div>
            <Link
              href={href({ archived: showArchived ? undefined : "1" })}
              className={buttonVariants({ variant: showArchived ? "soft" : "secondary", size: "md" })}
            >
              <Archive />
              {t("tracker.showArchived")}
            </Link>
          </>
        }
      />
      {view === "board" ? (
        <Board key={boardKey} items={items.filter((i) => !i.archived)} statuses={statuses} today={today} />
      ) : (
        <Spreadsheet items={items} statuses={statuses} today={today} showArchived={showArchived} />
      )}
    </>
  );
}

/** Egen Suspense-grense: skjelettet vises med en gang du navigerer hit. */
export default function TrackerPage(props: PageProps<"/tracker">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TrackerContent {...props} />
    </Suspense>
  );
}
