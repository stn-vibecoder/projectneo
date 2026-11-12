import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge, Card, CardHeader, CompanyMark, PageSkeleton } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { JobMeta } from "@/components/job-meta";
import { getApplication, getCalendarEvents, getStatuses, toCalendarApps, todayInOslo } from "@/lib/data";
import { buildCalendarItems } from "@/lib/tracker/calendar";
import { ApplicationDates } from "@/components/calendar/application-dates";
import { effectiveDeadline } from "@/lib/tracker/status-logic";
import { safeUrl } from "@/lib/utils";
import { RatingSelect } from "@/components/rating-select";
import { ApplicationForm } from "./application-form";
import { Contacts } from "./contacts";
import { History } from "./history";
import { HeaderActions, StatusControl } from "./header-actions";

export const metadata = { title: "Søknad" };

async function ApplicationContent({ params }: PageProps<"/tracker/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await getTranslations();
  const [result, statuses, calendarEvents] = await Promise.all([getApplication(id), getStatuses(), getCalendarEvents(id)]);
  if (!result) notFound();
  const { app, events, contacts } = result;
  const { job } = app;
  const today = todayInOslo();
  const dates = buildCalendarItems(calendarEvents, toCalendarApps([app]));
  const url = safeUrl(job.apply_url ?? job.url);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/tracker" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="size-4" />
          {t("nav.tracker")}
        </Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <CompanyMark name={job.company.name} className="h-10 w-12" />
              <div className="min-w-0">
                <p className="eyebrow text-gold">{job.company.name}</p>
                <h1 className="mt-1 font-serif text-[26px] font-semibold leading-tight tracking-tight">{job.title}</h1>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {app.archived && <Badge>{t("application.archived")}</Badge>}
              {job.status === "closed" && <Badge title={t("job.closedHelp")}>{t("job.closed")}</Badge>}
              {job.created_by && <Badge>{t("job.manual")}</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusControl applicationId={app.id} statusId={app.status_id} statuses={statuses} />
            <RatingSelect applicationId={app.id} value={app.rating} />
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                <ExternalLink />
                {t("common.openOriginal")}
              </a>
            )}
            <HeaderActions applicationId={app.id} archived={app.archived} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={t("calendar.sectionTitle")} description={t("calendar.sectionHelp")} />
            <div className="p-4 sm:p-5">
              <ApplicationDates applicationId={app.id} items={dates} today={today} />
            </div>
          </Card>
          <Card>
            <CardHeader title={t("application.details")} />
            <div className="p-4 sm:p-5">
              <ApplicationForm app={app} jobDeadline={job.deadline} />
            </div>
          </Card>
          <Card>
            <CardHeader title={t("application.contacts")} />
            <div className="p-4 sm:p-5">
              <Contacts applicationId={app.id} contacts={contacts} />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={t("application.job")} />
            <div className="flex flex-col gap-4 p-4 sm:p-5">
              <JobMeta job={job} today={today} deadline={effectiveDeadline(app, job)} />
              {job.description && (
                <details className="group text-sm">
                  <summary className="cursor-pointer select-none font-medium text-accent">{t("job.description")}</summary>
                  <p className="mt-2 max-h-96 overflow-y-auto whitespace-pre-line text-muted">{job.description}</p>
                </details>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title={t("application.history")} />
            <div className="p-4 sm:p-5">
              <History applicationId={app.id} events={events} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Egen Suspense-grense: skjelettet vises med en gang du navigerer hit. */
export default function ApplicationPage(props: PageProps<"/tracker/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ApplicationContent {...props} />
    </Suspense>
  );
}
