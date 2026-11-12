import { Suspense } from "react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  BellRing,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  ChartLine,
  ChevronRight,
  Hourglass,
  LayoutDashboard,
  Newspaper,
  PieChart,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, StatusBadge, PageSkeleton } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Deadline, SinceText } from "@/components/dates";
import { Calendar } from "@/components/calendar/calendar";
import { Ticker } from "@/components/ticker";
import {
  getApplications,
  getCalendarEvents,
  getFeed,
  getProfile,
  getStatusEventsByApp,
  getStatusHistory,
  getWatchedCompanyIds,
  getWatchlist,
  toCalendarApps,
  todayInOslo,
} from "@/lib/data";
import { Sparkline } from "@/components/charts/sparkline";
import { PipelineChart } from "@/components/charts/pipeline-chart";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import { INDUSTRIES, type Industry } from "@/lib/domain";
import { addDays, countSince, cumulative, milestonesFor, responseRateAt, responseRateSeries, weeklySeries } from "@/lib/tracker/series";
import { buildCalendarItems, nextPlannedByApplication, upcomingItems } from "@/lib/tracker/calendar";
import { TYPE_STYLE } from "@/lib/tracker/calendar-style";
import { dateOnlyToDate, daysBetween, daysSince } from "@/lib/tracker/dates";
import { buildBrief, type BriefKind } from "@/lib/tracker/brief";
import {
  computeMetrics,
  effectiveDeadline,
  expectedOffers,
  ghostedApplications,
  isActiveCategory,
  upcomingDeadlines,
  type AppForMetrics,
} from "@/lib/tracker/status-logic";
import type { ApplicationWithRelations } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Oversikt" };

type Row = AppForMetrics & { app: ApplicationWithRelations };

type Tone = "positive" | "negative" | "gold";

/**
 * Én celle i «kurstavla»: etikett, stort tall, endring siste periode
 * (fargen sier om endringen er bra eller dårlig) og en 12-ukers trend.
 */
function Quote({
  label,
  value,
  tone,
  delta,
  sub,
  spark,
  sparkLabel,
  title,
}: {
  title?: string;
  label: string;
  value: string | number;
  tone?: Tone;
  delta?: { text: string; good: boolean | null };
  sub?: string;
  spark?: (number | null)[];
  sparkLabel?: string;
}) {
  return (
    <div className="flex flex-col bg-surface px-4 py-4 sm:px-5" title={title}>
      <p className="eyebrow text-muted">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p
          className={cn(
            "text-[28px] font-semibold leading-none tracking-tight",
            tone === "positive" && "text-positive",
            tone === "negative" && "text-negative",
            tone === "gold" && "text-gold",
          )}
        >
          {value}
        </p>
        {spark && <Sparkline values={spark} width={72} height={26} label={sparkLabel} />}
      </div>
      {delta && (
        <p
          className={cn(
            "num mt-2 text-[11px] font-medium",
            delta.good === true && "text-positive",
            delta.good === false && "text-negative",
            delta.good === null && "text-muted",
          )}
        >
          {delta.text}
        </p>
      )}
      {sub && <p className="num mt-0.5 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

/** Fast farge per bransje (fargen følger bransjen, aldri rekkefølgen), og tekstfarge inne i blokken. */
const INDUSTRY_COLOR: Record<Industry, { color: string; ink: "light" | "dark" }> = {
  finance: { color: "var(--viz-1)", ink: "light" },
  consulting: { color: "var(--viz-2)", ink: "dark" },
  audit: { color: "var(--viz-3)", ink: "dark" },
  tech: { color: "var(--viz-4)", ink: "light" },
  industry: { color: "var(--viz-5)", ink: "dark" },
  other: { color: "var(--viz-6)", ink: "dark" },
};

const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±");

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

const BRIEF_ICON: Record<BriefKind, React.ComponentType<{ className?: string }>> = {
  deadline: Hourglass,
  today: CalendarCheck,
  tomorrow: CalendarClock,
  followup: BellRing,
  closing: Hourglass,
  watchlist: Star,
  new_jobs: Sparkles,
};

/** Liten nøkkeltall-rute i «Markedet nå». */
function MarketStat({ label, value, href, tone }: { label: string; value: number; href: string; tone?: "gold" | "negative" }) {
  return (
    <Link href={href} className="group flex flex-col bg-surface px-4 py-3 transition-colors hover:bg-surface-muted/60">
      <span className="eyebrow text-[10px] text-muted">{label}</span>
      <span
        className={cn(
          "mt-1 text-[22px] font-semibold leading-none tracking-tight",
          tone === "gold" && value > 0 && "text-gold",
          tone === "negative" && value > 0 && "text-negative",
        )}
      >
        {value}
      </span>
    </Link>
  );
}

function AppLine({ row, children }: { row: Row; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={`/tracker/${row.id}`}
        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted/60 sm:px-5"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.app.job.title}</p>
          <p className="truncate text-xs text-muted">{row.app.job.company.name}</p>
        </div>
        <div className="shrink-0 text-right text-xs">{children}</div>
      </Link>
    </li>
  );
}

async function DashboardContent() {
  const t = await getTranslations();
  const [{ profile, user, prefs }, apps, history, events, statusEvents, watchlist, watchedIds] = await Promise.all([
    getProfile(),
    getApplications(),
    getStatusHistory(),
    getCalendarEvents(),
    getStatusEventsByApp(),
    getWatchlist(),
    getWatchedCompanyIds(),
  ]);
  // Markedet: åpne stillinger i brukerens byer og bransjer.
  const { jobs: market, savedByJob } = await getFeed({}, prefs.cities, prefs.industries);
  const today = todayInOslo();
  const format = await getFormatter();
  const dateline = format.dateTime(dateOnlyToDate(today), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const calendarItems = buildCalendarItems(events, toCalendarApps(apps));
  // Et planlagt intervju o.l. i kalenderen teller som «neste steg» (ingen oppfølgingspåminnelse).
  const planned = nextPlannedByApplication(calendarItems, today);
  const applicationOptions = apps
    .filter((a) => !a.archived)
    .map((a) => ({ id: a.id, label: `${a.job.company.name} – ${a.job.title}` }))
    .sort((a, b) => a.label.localeCompare(b.label, "nb"));
  const calendar = (
    <Card id="kalender" className="scroll-mt-20 overflow-hidden max-lg:order-first">
      <Calendar items={calendarItems} today={today} applications={applicationOptions} />
    </Card>
  );
  const ticker = (
    <Ticker
      title={t("dashboard.tickerTitle")}
      entries={upcomingItems(calendarItems, today, 12).map((it) => ({
        key: it.key,
        href: it.applicationId ? `/tracker/${it.applicationId}` : null,
        company: it.company ?? it.title ?? t(`calendar.types.${it.type}`),
        label: it.company ? (it.title ?? t(`calendar.types.${it.type}`)) : t(`calendar.types.${it.type}`),
        date: it.date,
        dotClass: TYPE_STYLE[it.type].dot,
      }))}
    />
  );
  const ghostingDays = profile?.ghosting_days ?? 14;
  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "";

  const rows: Row[] = apps.map((a) => ({
    id: a.id,
    category: a.status.category,
    history: history.get(a.id) ?? [],
    appliedAt: a.applied_at,
    lastActivityAt: a.last_activity_at,
    deadline: effectiveDeadline(a, a.job),
    nextStepAt: planned.get(a.id) ?? a.next_step_at,
    archived: a.archived,
    app: a,
  }));

  const ghosted = ghostedApplications(rows, ghostingDays, today);
  const brief = buildBrief({
    today,
    savedDeadlines: rows
      .filter((r) => !r.archived && r.category === "saved" && r.deadline)
      .map((r) => ({ company: r.app.job.company.name, deadline: r.deadline! })),
    calendar: calendarItems
      .filter((it) => it.type !== "app_deadline")
      .map((it) => ({ date: it.date, label: it.company ?? it.title ?? t(`calendar.types.${it.type}`) })),
    followUps: ghosted.map((r) => ({ company: r.app.job.company.name })),
    openJobs: market.map((j) => ({
      firstSeen: j.first_seen,
      company: j.company.name,
      companyId: j.company_id,
      deadline: j.deadline,
      saved: savedByJob.has(j.id),
    })),
    watchedCompanyIds: watchedIds,
  });

  const briefAndMarket = (
    <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader
          title={
            <>
              <Newspaper />
              {t("dashboard.briefTitle")}
            </>
          }
        />
        {brief.length === 0 ? (
          <p className="p-4 text-sm text-muted sm:p-5">{t("dashboard.briefEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {brief.map((b) => {
              const Icon = BRIEF_ICON[b.kind];
              return (
                <li key={b.kind}>
                  <Link href={b.href} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/60 sm:px-5">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md",
                        b.tone === "urgent" && "bg-negative/10 text-negative",
                        b.tone === "notice" && "bg-gold-soft text-gold",
                        b.tone === "info" && "bg-accent-soft text-accent",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{t(`dashboard.brief.${b.kind}`, { count: b.count })}</span>
                      <span className="ml-2 text-xs text-muted">{b.names.join(" · ")}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={
            <>
              <Briefcase />
              {t("dashboard.marketTitle")}
            </>
          }
        />
        <div className="grid grid-cols-2 gap-px bg-border">
          <MarketStat label={t("dashboard.marketOpen")} value={market.length} href="/feed" />
          <MarketStat
            label={t("dashboard.marketNew")}
            value={market.filter((j) => daysSince(j.first_seen, today) < 7).length}
            href="/feed?sort=newest"
            tone="gold"
          />
          <MarketStat
            label={t("dashboard.marketDue")}
            value={market.filter((j) => j.deadline && daysBetween(today, j.deadline) <= 7).length}
            href="/feed?deadline=7"
            tone="negative"
          />
          <MarketStat label={t("dashboard.marketWatch")} value={watchlist.length} href="/feed?watch=1" />
        </div>
      </Card>
    </div>
  );

  const watchlistCard = (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <>
            <Star />
            {t("watch.title")}
          </>
        }
        description={t("watch.help")}
      />
      {watchlist.length === 0 ? (
        <p className="p-4 text-sm text-muted sm:p-5">{t("watch.empty")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="eyebrow text-[10px] text-muted">
              <th scope="col" className="px-4 py-2 text-left font-semibold sm:px-5">{t("watch.colCompany")}</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">{t("watch.colOpen")}</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">{t("watch.colNew")}</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold sm:px-5">{t("watch.colNext")}</th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((w) => (
              <tr key={w.company_id} className="border-t border-border hover:bg-surface-muted/60">
                <td className="max-w-0 truncate px-4 py-2.5 font-medium sm:px-5">
                  <Link
                    href={w.open_jobs === 1 && w.next_job_id ? `/jobs/${w.next_job_id}` : `/feed?industry=all&q=${encodeURIComponent(w.name)}`}
                    className="hover:text-accent hover:underline"
                  >
                    {w.name}
                  </Link>
                </td>
                <td className="num px-2 py-2.5 text-right">{w.open_jobs}</td>
                <td className={cn("num px-2 py-2.5 text-right", w.new_jobs > 0 ? "font-semibold text-positive" : "text-muted")}>
                  {w.new_jobs > 0 ? `+${w.new_jobs}` : t("watch.none")}
                </td>
                <td className="num whitespace-nowrap px-4 py-2.5 text-right text-xs sm:px-5">
                  {w.next_deadline ? <Deadline value={w.next_deadline} today={today} /> : <span className="text-muted">{t("watch.none")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );

  if (rows.length === 0) {
    return (
      <>
        <PageHeader eyebrow={dateline} title={t("dashboard.greeting", { name })} />
        {ticker}
        {briefAndMarket}
        <EmptyState icon={<LayoutDashboard />} title={t("dashboard.emptyTitle")} body={t("dashboard.emptyBody")}>
          <Link href="/feed" className={buttonVariants()}>
            <Briefcase />
            {t("tracker.goToFeed")}
          </Link>
          <Link href="/jobs/new" className={buttonVariants({ variant: "secondary" })}>
            <Plus />
            {t("nav.addJob")}
          </Link>
        </EmptyState>
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          {watchlistCard}
          {calendar}
        </div>
      </>
    );
  }

  const m = computeMetrics(rows);
  const forecast = expectedOffers(rows);

  // Tidsserier til kurstavla og pipeline-grafen.
  const tracked = apps.filter((a) => !a.archived);
  const ms = tracked.map((a) => milestonesFor(a.applied_at, statusEvents.get(a.id) ?? []));
  const weekly = weeklySeries(ms, today, 12);
  const last12 = <T,>(arr: T[]) => arr.slice(-12);
  const rateNow = m.responseRate === null ? null : Math.round(m.responseRate * 100);
  const rateThen = responseRateAt(ms, addDays(today, -30));
  const new7 = countSince(ms, "applied", today, 7);
  const int30 = countSince(ms, "interview", today, 30);
  const off30 = countSince(ms, "offer", today, 30);
  const rej30 = countSince(ms, "rejected", today, 30);

  const allocation = INDUSTRIES.map((ind) => ({
    key: ind,
    label: t(`enums.industry.${ind}`),
    value: tracked.filter((a) => isActiveCategory(a.status.category) && (a.job.industry ?? "other") === ind).length,
    ...INDUSTRY_COLOR[ind],
  }));
  const deadlines = upcomingDeadlines(rows, today, 14);
  const maxFunnel = Math.max(1, ...m.funnel.map((f) => f.count));

  return (
    <>
      <PageHeader
        eyebrow={dateline}
        title={t("dashboard.greeting", { name })}
        description={t("tracker.count", { count: m.total })}
      />

      {ticker}
      {briefAndMarket}

      {m.applied === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface px-5 py-4 text-sm text-muted">
          {t("dashboard.noAppliedYet")}
        </p>
      ) : (
        <>
          {/* Kurstavle: nøkkeltall side om side med tynne skillelinjer. */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
            <Quote
              label={t("dashboard.applied")}
              value={m.applied}
              delta={{ text: t("dashboard.delta7", { sign: signed(new7), count: new7 }), good: new7 > 0 ? true : null }}
              spark={last12(weekly.applied)}
              sparkLabel={t("dashboard.sparkApplied")}
            />
            <Quote
              label={t("dashboard.responseRate")}
              value={rateNow === null ? "–" : `${rateNow}%`}
              tone="gold"
              delta={
                rateNow !== null && rateThen !== null
                  ? {
                      text: t("dashboard.deltaPp", { sign: signed(rateNow - rateThen), count: Math.abs(rateNow - rateThen) }),
                      good: rateNow === rateThen ? null : rateNow > rateThen,
                    }
                  : undefined
              }
              sub={t("dashboard.responseRateHelp", { responded: m.responded, applied: m.applied })}
              spark={last12(responseRateSeries(weekly))}
              sparkLabel={t("dashboard.sparkRate")}
            />
            <Quote
              label={t("dashboard.interviews")}
              value={m.interviews}
              delta={{ text: t("dashboard.delta30", { sign: signed(int30), count: int30 }), good: int30 > 0 ? true : null }}
              sub={pct(m.interviews, m.applied) === null ? undefined : t("dashboard.shareOfApplied", { pct: pct(m.interviews, m.applied)! })}
              spark={last12(weekly.interview)}
              sparkLabel={t("dashboard.sparkInterviews")}
            />
            <Quote
              label={t("dashboard.offers")}
              value={m.offers}
              tone={m.offers > 0 ? "positive" : undefined}
              delta={{ text: t("dashboard.delta30", { sign: signed(off30), count: off30 }), good: off30 > 0 ? true : null }}
              sub={pct(m.offers, m.applied) === null ? undefined : t("dashboard.shareOfApplied", { pct: pct(m.offers, m.applied)! })}
              spark={last12(weekly.offer)}
              sparkLabel={t("dashboard.sparkOffers")}
            />
            <Quote
              label={t("dashboard.rejected")}
              value={m.rejected}
              delta={{ text: t("dashboard.delta30", { sign: signed(rej30), count: rej30 }), good: rej30 > 0 ? false : null }}
              sub={pct(m.rejected, m.applied) === null ? undefined : t("dashboard.shareOfApplied", { pct: pct(m.rejected, m.applied)! })}
              spark={last12(weekly.rejected)}
              sparkLabel={t("dashboard.sparkRejected")}
            />
            <Quote
              label={t("dashboard.active")}
              value={m.active}
              delta={{
                text: t("dashboard.expected", { count: format.number(forecast.expected, { maximumFractionDigits: 1 }) }),
                good: forecast.expected >= 1 ? true : null,
              }}
              sub={t("dashboard.inProcess")}
              title={t("dashboard.expectedHelp")}
            />
          </div>

          {/* Pipeline-utvikling: kumulative linjer + volum per uke */}
          <Card className="mt-6">
            <CardHeader
              title={
                <>
                  <ChartLine />
                  {t("dashboard.pipelineTitle")}
                </>
              }
              description={t("dashboard.pipelineHelp")}
            />
            <div className="px-3 pb-3 pt-4 sm:px-5">
              <PipelineChart
                weeks={weekly.weeks}
                series={[
                  { key: "applied", label: t("dashboard.seriesApplied"), color: "var(--viz-1)", values: cumulative(weekly.applied) },
                  { key: "interview", label: t("dashboard.seriesInterviews"), color: "var(--viz-2)", values: cumulative(weekly.interview) },
                  { key: "offer", label: t("dashboard.seriesOffers"), color: "var(--viz-5)", values: cumulative(weekly.offer) },
                ]}
                volume={weekly.applied}
                volumeLabel={t("dashboard.volume")}
              />
            </div>
          </Card>
        </>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={t("dashboard.funnel")} description={t("dashboard.funnelHelp")} />
            <ol className="flex flex-col gap-3 p-4 sm:p-5">
              {m.funnel.map((f, i) => {
                const prev = i > 0 ? m.funnel[i - 1].count : null;
                const conv = prev ? pct(f.count, prev) : null;
                return (
                  <li
                    key={f.stage}
                    className="grid grid-cols-[8.5rem_1fr_2rem_3rem] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_2rem_3.5rem]"
                  >
                    <span className="truncate text-muted">{t(`enums.category.${f.stage}`)}</span>
                    <span className="h-2 overflow-hidden rounded-sm bg-surface-muted" aria-hidden="true">
                      <span
                        className={cn("block h-full rounded-sm transition-[width]", i >= 5 ? "bg-gold" : "bg-accent")}
                        style={{ width: `${(f.count / maxFunnel) * 100}%` }}
                      />
                    </span>
                    <span className="num text-right font-medium">{f.count}</span>
                    <span className="num text-right text-[11px] text-muted" title={t("dashboard.conversion")}>
                      {conv === null ? "" : `${conv}%`}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card>
            <CardHeader
              title={
                <>
                  <PieChart />
                  {t("dashboard.allocationTitle")}
                </>
              }
              description={t("dashboard.allocationHelp")}
            />
            <div className="p-4 pt-9 sm:p-5 sm:pt-9">
              {allocation.some((a) => a.value > 0) ? (
                <SegmentedBar segments={allocation} ariaLabel={t("dashboard.allocationAria")} />
              ) : (
                <p className="text-sm text-muted">{t("dashboard.noAllocation")}</p>
              )}
            </div>
          </Card>

          {watchlistCard}

          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Hourglass />
                  {t("dashboard.upcomingDeadlines")}
                </span>
              }
              description={t("dashboard.upcomingDeadlinesHelp")}
            />
            {deadlines.length === 0 ? (
              <p className="p-4 text-sm text-muted sm:p-5">{t("dashboard.noDeadlines")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {deadlines.map((r) => (
                  <AppLine key={r.id} row={r}>
                    <Deadline value={r.deadline} today={today} />
                  </AppLine>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <BellRing />
                  {t("dashboard.ghosted", { days: ghostingDays })}
                </span>
              }
              description={t("dashboard.ghostedHelp")}
            />
            {ghosted.length === 0 ? (
              <p className="p-4 text-sm text-muted sm:p-5">{t("dashboard.noGhosted")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {ghosted.map((r) => (
                  <AppLine key={r.id} row={r}>
                    <StatusBadge label={r.app.status.label} color={r.app.status.color} />
                    <p className="mt-1 text-muted">
                      <SinceText timestamp={r.lastActivityAt} today={today} />
                    </p>
                  </AppLine>
                ))}
              </ul>
            )}
          </Card>
        </div>
        {calendar}
      </div>
    </>
  );
}

/** Egen Suspense-grense: skjelettet vises med en gang du navigerer hit. */
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
