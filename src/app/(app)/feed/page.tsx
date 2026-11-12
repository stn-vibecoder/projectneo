import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChartColumn, CloudDownload, ExternalLink, Inbox, MapPin, Plus, Radar } from "lucide-react";
import { Card, CardHeader, CompanyMark, EmptyState, PageHeader, PageSkeleton } from "@/components/ui/card";
import { DeadlineProfile } from "@/components/charts/deadline-profile";
import { CityIcon } from "@/components/city-icon";
import { deadlineProfile } from "@/lib/tracker/series";
import { buttonVariants } from "@/components/ui/button";
import { JobMeta } from "@/components/job-meta";
import { SinceText } from "@/components/dates";
import { getFeed, getProfile, getSources, getWatchedCompanyIds, type FeedFilters as Filters } from "@/lib/data";
import { RunAllButton } from "../sources/source-controls";
import { WatchButton } from "@/components/watch-button";
import { daysSince } from "@/lib/tracker/dates";
import { isCity, isIndustry, isPeriod } from "@/lib/domain";
import { cn, safeUrl } from "@/lib/utils";
import { FeedFilters } from "./feed-filters";
import { SaveJobButton } from "./save-job-button";

export const metadata = { title: "Stillinger" };

function parseFilters(sp: Record<string, string | string[] | undefined>, allowed: string[]): Filters {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const city = s("city");
  const industry = s("industry");
  const period = s("period");
  const deadline = s("deadline");
  const sort = s("sort");
  return {
    watch: s("watch") === "1",
    city: city && isCity(city) && allowed.includes(city) ? city : undefined,
    industry: industry === "all" ? "all" : industry && isIndustry(industry) ? industry : undefined,
    period: period && isPeriod(period) ? period : undefined,
    deadline: deadline === "7" || deadline === "30" || deadline === "none" ? deadline : undefined,
    q: s("q")?.slice(0, 100),
    sort: sort === "newest" || sort === "company" ? sort : "deadline",
  };
}

/**
 * Tom feed: skyldes det at kildene aldri er hentet (f.eks. rett etter
 * oppstart på nett), vis «Hent stillinger nå». Ellers vises vanlig melding (children).
 */
async function EmptyFeed({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  const sources = (await getSources()).filter((s) => s.type !== "manual" && s.enabled);
  if (sources.length === 0) {
    return (
      <EmptyState icon={<Radar />} title={t("feed.noSourcesTitle")} body={t("feed.noSourcesBody")}>
        <Link href="/sources" className={buttonVariants()}>
          <Radar />
          {t("nav.sources")}
        </Link>
      </EmptyState>
    );
  }
  if (sources.every((s) => !s.last_run_at)) {
    return (
      <EmptyState
        icon={<CloudDownload />}
        title={t("feed.notFetchedTitle")}
        body={t("feed.notFetchedBody", { count: sources.length })}
      >
        <RunAllButton label={t("feed.fetchNow")} />
      </EmptyState>
    );
  }
  return children;
}

async function FeedContent({ searchParams }: PageProps<"/feed">) {
  const t = await getTranslations();
  const { prefs } = await getProfile();
  const filters = parseFilters(await searchParams, prefs.cities);
  const [{ jobs, savedByJob, today }, watchedIds] = await Promise.all([
    getFeed(filters, prefs.cities, prefs.industries),
    getWatchedCompanyIds(),
  ]);

  if (prefs.cities.length === 0) {
    return (
      <>
        <PageHeader eyebrow={t("feed.eyebrow")} title={t("feed.title")} />
        <EmptyState icon={<MapPin />} title={t("feed.noCitiesTitle")} body={t("feed.noCitiesBody")}>
          <Link href="/settings" className={buttonVariants()}>
            {t("nav.settings")}
          </Link>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={t("feed.eyebrow")}
        title={t("feed.title")}
        description={
          <>
            {t("feed.subtitle")}
            <span className="mt-3 flex flex-wrap items-center gap-1.5">
              {prefs.cities.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface py-1 pl-2 pr-3 text-xs font-medium text-foreground"
                >
                  <CityIcon city={c} className="text-gold" />
                  {t(`enums.city.${c}`)}
                </span>
              ))}
              <Link href="/settings" className="ml-1 text-xs font-medium text-accent hover:underline">
                {t("feed.editCities")}
              </Link>
            </span>
          </>
        }
        actions={
          // På mobil finnes +-knappen allerede i toppmenyen.
          <Link href="/jobs/new" className={cn(buttonVariants({ variant: "secondary" }), "max-sm:hidden")}>
            <Plus />
            {t("nav.addJob")}
          </Link>
        }
      />
      <FeedFilters
        cities={prefs.cities}
        hasPreferredIndustries={prefs.industries.length > 0}
        count={jobs.length}
        watchCount={watchedIds.size}
      />

      {jobs.length > 0 &&
        (() => {
          const profile = deadlineProfile(
            jobs.map((j) => j.deadline),
            today,
            10,
          );
          // Uten frister å vise er grafen bare tom.
          if (!profile.buckets.some((b) => b.count > 0)) return null;
          return (
            <Card className="mb-6">
              <CardHeader
                title={
                  <>
                    <ChartColumn />
                    {t("feed.profileTitle")}
                  </>
                }
                description={t("feed.profileHelp")}
                action={
                  <p className="num shrink-0 text-right text-[11px] leading-5 text-muted">
                    {t("feed.profileLater", { count: profile.later })}
                    <br />
                    {t("feed.profileNone", { count: profile.none })}
                  </p>
                }
              />
              <div className="px-2 pb-2 pt-1 sm:px-4">
                <DeadlineProfile buckets={profile.buckets} />
              </div>
            </Card>
          );
        })()}

      {jobs.length === 0 ? (
        <EmptyFeed>
          <EmptyState icon={<Inbox />} title={t("feed.emptyTitle")} body={t("feed.emptyBody")}>
            <Link href="/jobs/new" className={buttonVariants({ variant: "secondary" })}>
              <Plus />
              {t("nav.addJob")}
            </Link>
          </EmptyState>
        </EmptyFeed>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {jobs.map((job) => {
            const url = safeUrl(job.url);
            return (
              <li key={job.id}>
                <Card className="group relative flex h-full flex-col gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-md hover:shadow-black/5 sm:p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <CompanyMark name={job.company.name} />
                    <div className="min-w-0 flex-1">
                      <p className="eyebrow flex items-center gap-2 text-muted">
                        <span className="truncate">{job.company.name}</span>
                        {daysSince(job.first_seen, today) < 3 && (
                          <span className="rounded-sm bg-gold px-1.5 py-px text-[9px] tracking-wider text-sidebar">{t("feed.new")}</span>
                        )}
                      </p>
                      <h2 className="mt-1 font-serif text-[17px] font-semibold leading-snug">
                        {/* Hele kortet er klikkbart via lenken (after:inset-0); knappene ligger over. */}
                        <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0 hover:text-accent">
                          {job.title}
                        </Link>
                      </h2>
                    </div>
                    {!job.company.created_by && (
                      <WatchButton
                        companyId={job.company_id}
                        companyName={job.company.name}
                        watched={watchedIds.has(job.company_id)}
                        className="relative z-10 -mr-1.5 -mt-1"
                      />
                    )}
                  </div>
                  <JobMeta job={job} today={today} />
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <p className="text-xs text-muted">
                      {t("feed.lastSeen")} <SinceText timestamp={job.last_seen} today={today} />
                      {job.source !== "manual" && (
                        <>
                          {" · "}
                          {t("feed.source", {
                            source: t.has(`enums.source.${job.source}`) ? t(`enums.source.${job.source}`) : job.source,
                          })}
                        </>
                      )}
                    </p>
                    <div className="relative z-10 flex items-center gap-2">
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          title={t("common.openOriginal")}
                          aria-label={t("common.openOriginal")}
                        >
                          <ExternalLink />
                        </a>
                      )}
                      <SaveJobButton jobId={job.id} applicationId={savedByJob.get(job.id)} />
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** Egen Suspense-grense: skjelettet vises med en gang du navigerer hit. */
export default function FeedPage(props: PageProps<"/feed">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FeedContent {...props} />
    </Suspense>
  );
}
