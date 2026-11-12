import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowLeft, BookmarkCheck, ExternalLink } from "lucide-react";
import { Badge, Card, CardHeader, CompanyMark, PageSkeleton } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { CityIcon } from "@/components/city-icon";
import { Deadline } from "@/components/dates";
import { WatchButton } from "@/components/watch-button";
import { getJob, todayInOslo } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { cn, safeUrl } from "@/lib/utils";
import { SaveJobButton } from "../../feed/save-job-button";

export const metadata = { title: "Stilling" };

async function JobContent({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await getTranslations();
  const format = await getFormatter();
  const [data, user] = await Promise.all([getJob(id), getCurrentUser()]);
  const signedIn = Boolean(user);
  if (!data) notFound();
  const { job, applicationId, watched, others, sources } = data;
  const today = todayInOslo();
  const url = safeUrl(job.apply_url ?? job.url);
  const day = (ts: string) => format.dateTime(new Date(ts), { day: "numeric", month: "short", year: "numeric" });

  const facts: [string, React.ReactNode][] = [
    [t("jobPage.deadline"), <Deadline key="d" value={job.deadline} today={today} />],
    [
      t("jobPage.city"),
      job.cities.length ? (
        <span key="c" className="flex flex-wrap gap-x-3 gap-y-1">
          {job.cities.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <CityIcon city={c} className="size-3.5 text-gold" />
              {t(`enums.city.${c}`)}
            </span>
          ))}
        </span>
      ) : (
        (job.location_raw ?? "–")
      ),
    ],
    [t("jobPage.period"), job.period === "unknown" ? "–" : t(`enums.period.${job.period}`)],
    [t("jobPage.industry"), job.industry ? t(`enums.industry.${job.industry}`) : "–"],
    [t("jobPage.firstSeen"), day(job.first_seen)],
    [t("jobPage.lastSeen"), day(job.last_seen)],
    [
      t("jobPage.sources"),
      sources.length ? sources.join(", ") : t.has(`enums.source.${job.source}`) ? t(`enums.source.${job.source}`) : job.source,
    ],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/feed" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="size-4" />
          {t("jobPage.back")}
        </Link>
        <div className="mt-3 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <CompanyMark name={job.company.name} className="h-11 w-13" />
            <div className="min-w-0">
              <p className="eyebrow flex items-center gap-1 text-gold">
                {job.company.name}
                {signedIn && !job.company.created_by && (
                  <WatchButton companyId={job.company_id} companyName={job.company.name} watched={watched} className="-my-1" />
                )}
              </p>
              <h1 className="mt-1 font-serif text-[26px] font-semibold leading-tight tracking-tight sm:text-[30px]">{job.title}</h1>
              {job.status === "closed" && <Badge className="mt-2">{t("job.closed")}</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary" })}>
                <ExternalLink />
                {t("jobPage.apply")}
              </a>
            )}
            {applicationId ? (
              <Link href={`/tracker/${applicationId}`} className={buttonVariants({ variant: "soft" })}>
                <BookmarkCheck />
                {t("jobPage.open")}
              </Link>
            ) : (
              <SaveJobButton jobId={job.id} signedIn={signedIn} />
            )}
          </div>
        </div>
      </div>

      {job.status === "closed" && (
        <p className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-muted">{t("jobPage.closedNote")}</p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title={t("jobPage.description")} />
          <div className="p-4 sm:p-6">
            {job.description ? (
              <p className="max-w-prose whitespace-pre-line text-[15px] leading-relaxed">{job.description.replace(/\n{2,}(?=•)/g, "\n")}</p>
            ) : (
              <p className="text-sm text-muted">{t("jobPage.noDescription")}</p>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={t("jobPage.facts")} />
            <dl className="divide-y divide-border text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5 sm:px-5">
                  <dt className="shrink-0 text-muted">{label}</dt>
                  <dd className="num min-w-0 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {others.length > 0 && (
            <Card>
              <CardHeader title={t("jobPage.others", { company: job.company.name })} />
              <ul className="divide-y divide-border">
                {others.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/jobs/${o.id}`}
                      className={cn("flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-muted/60 sm:px-5")}
                    >
                      <span className="min-w-0 truncate font-medium">{o.title}</span>
                      <span className="num shrink-0 text-xs text-muted">
                        <Deadline value={o.deadline} today={today} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JobPage(props: PageProps<"/jobs/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <JobContent {...props} />
    </Suspense>
  );
}
