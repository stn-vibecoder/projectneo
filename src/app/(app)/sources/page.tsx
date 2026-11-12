import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { BookMarked, CircleAlert, CircleCheck, ExternalLink, FileSpreadsheet, Library, Link2, Radar } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader, PageSkeleton } from "@/components/ui/card";
import { SinceText } from "@/components/dates";
import { getSources, todayInOslo } from "@/lib/data";
import { safeUrl, cn } from "@/lib/utils";
import { AddSource } from "./add-source";
import { ImportSources } from "./import-sources";
import { DeleteSourceButton, EnabledToggle, IndustrySelect, PresetButton, RunAllButton, RunNowButton } from "./source-controls";

export const metadata = { title: "Kilder" };

const PRESETS = [
  { type: "nhhs", url: "https://www.nu.nhhs.no/jobs/", badge: "personalUse" },
  { type: "bindeleddet", url: "https://bindeleddet.no/jobs/", badge: "personalUse" },
  { type: "nav", url: "https://arbeidsplassen.nav.no/stillinger", badge: null },
  { type: "jobtech", url: "https://arbetsformedlingen.se/platsbanken", badge: null },
  { type: "adzuna", url: "https://www.adzuna.co.uk", badge: "needsKey" },
] as const;

async function SourcesContent() {
  const t = await getTranslations();
  const all = await getSources();
  const sources = all.filter((s) => s.type !== "manual");
  const manual = all.filter((s) => s.type === "manual");
  const manualBySector = [...new Set(manual.map((m) => m.sector ?? ""))].map((sector) => ({
    sector,
    items: manual.filter((m) => (m.sector ?? "") === sector),
  }));
  const today = todayInOslo();
  const addedTypes = new Set(sources.filter((s) => s.identifier === "default").map((s) => s.type));
  const adzunaReady = Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t("sources.eyebrow")}
        title={t("sources.title")}
        description={t("sources.intro")}
        actions={<RunAllButton disabled={sources.length === 0} />}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader
            title={
              <>
                <Link2 />
                {t("sources.addTitle")}
              </>
            }
            description={t("sources.addHelp")}
          />
          <div className="p-4 sm:p-5">
            <AddSource />
          </div>
        </Card>

        <Card>
          <CardHeader
            title={
              <>
                <Library />
                {t("sources.presetsTitle")}
              </>
            }
            description={t("sources.presetsHelp")}
          />
          <ul className="divide-y divide-border">
            {PRESETS.map((p) => (
              <li key={p.type} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t(`sources.presets.${p.type}`)}</p>
                  {p.badge && (!(p.type === "adzuna") || !adzunaReady) && (
                    <Badge className="mt-1">{t(`sources.${p.badge}`)}</Badge>
                  )}
                </div>
                <PresetButton
                  type={p.type}
                  name={t(`sources.presets.${p.type}`)}
                  url={p.url}
                  added={addedTypes.has(p.type)}
                />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <>
              <FileSpreadsheet />
              {t("sources.import.title")}
            </>
          }
          description={t("sources.import.help")}
        />
        <div className="p-4 sm:p-5">
          <ImportSources />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={
            <>
              <Radar />
              {t("sources.listTitle")}
            </>
          }
        />
        {sources.length === 0 ? (
          <p className="p-4 text-sm text-muted sm:p-5">{t("sources.listEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr className="eyebrow bg-surface-muted text-[10px] text-muted">
                  {["colName", "colIndustry", "colLastRun", "colStatus", "colFound", "colInternships", "colOpen", "colActive", ""].map(
                    (k, i) => (
                      <th
                        key={k || i}
                        scope="col"
                        className={cn(
                          "h-9 border-b border-border px-3 text-left font-semibold",
                          ["colFound", "colInternships", "colOpen"].includes(k) && "text-right",
                        )}
                      >
                        {k ? t(`sources.${k}`) : ""}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => {
                  const link = safeUrl(s.url);
                  return (
                    <tr key={s.id} className={cn("hover:bg-accent-soft/30", !s.enabled && "opacity-55")}>
                      <td className="border-b border-border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Badge className="shrink-0">{t(`sources.types.${s.type}`)}</Badge>
                          {link ? (
                            <a href={link} target="_blank" rel="noopener noreferrer" className="truncate font-medium hover:underline">
                              {s.name}
                            </a>
                          ) : (
                            <span className="truncate font-medium">{s.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="w-44 border-b border-border px-2 py-1">
                        <IndustrySelect id={s.id} value={s.industry} />
                      </td>
                      <td className="num whitespace-nowrap border-b border-border px-3 text-muted">
                        {s.last_run_at ? <SinceText timestamp={s.last_run_at} today={today} /> : t("sources.never")}
                      </td>
                      <td className="border-b border-border px-3">
                        {s.last_status === "ok" && (
                          <span className="inline-flex items-center gap-1 text-positive">
                            <CircleCheck className="size-3.5" />
                            {t("sources.statusOk")}
                          </span>
                        )}
                        {s.last_status === "error" && (
                          <span className="inline-flex items-center gap-1 text-negative" title={s.last_error ?? ""}>
                            <CircleAlert className="size-3.5" />
                            <span className="max-w-56 truncate">{s.last_error ?? t("sources.statusError")}</span>
                          </span>
                        )}
                      </td>
                      <td className="num border-b border-border px-3 text-right text-muted">{s.last_found ?? "–"}</td>
                      <td className="num border-b border-border px-3 text-right">{s.last_internships ?? "–"}</td>
                      <td className="num border-b border-border px-3 text-right font-semibold">{s.open_jobs}</td>
                      <td className="border-b border-border px-3">
                        <EnabledToggle id={s.id} enabled={s.enabled} />
                      </td>
                      <td className="whitespace-nowrap border-b border-border px-2 text-right">
                        <RunNowButton id={s.id} />
                        <DeleteSourceButton id={s.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {manual.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader
            title={
              <>
                <BookMarked />
                {t("sources.manualTitle")} ({manual.length})
              </>
            }
            description={t("sources.manualHelp")}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13px]">
              {manualBySector.map((g) => (
                <tbody key={g.sector || "–"}>
                  <tr>
                    <td colSpan={4} className="eyebrow h-8 border-b border-border bg-surface-muted/60 px-3 text-[10px] text-muted">
                      {g.sector || "–"} ({g.items.length})
                    </td>
                  </tr>
                  {g.items.map((m) => {
                    const link = safeUrl(m.url);
                    return (
                      <tr key={m.id} className="hover:bg-accent-soft/30">
                        <td className="w-56 border-b border-border px-3 py-2 font-medium">
                          {link ? (
                            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                              {m.name}
                              <ExternalLink className="size-3 text-muted" />
                            </a>
                          ) : (
                            m.name
                          )}
                        </td>
                        <td className="w-48 border-b border-border px-3 text-muted">{m.cities}</td>
                        <td className="border-b border-border px-3 py-2 text-muted">
                          <Badge className="mr-2">
                            {m.system ?? (m.reason ? t(`sources.reasons.${m.reason}`) : t("sources.reasons.none"))}
                          </Badge>
                          {m.notes}
                        </td>
                        <td className="w-12 border-b border-border px-2 text-right">
                          <DeleteSourceButton id={m.id} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function SourcesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SourcesContent />
    </Suspense>
  );
}
