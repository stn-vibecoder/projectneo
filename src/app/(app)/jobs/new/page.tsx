import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Card, PageHeader, PageSkeleton } from "@/components/ui/card";
import { getProfile } from "@/lib/data";
import { ManualJobForm } from "./manual-job-form";

export const metadata = { title: "Legg til stilling" };

async function NewJobContent() {
  const t = await getTranslations("job");
  const { prefs } = await getProfile();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("newTitle")} description={t("newIntro")} />
      <Card className="p-5 sm:p-6">
        <ManualJobForm defaultCities={prefs.cities.length === 1 ? prefs.cities : []} />
      </Card>
    </div>
  );
}

/** Egen Suspense-grense: skjelettet vises med en gang du navigerer hit. */
export default function NewJobPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewJobContent />
    </Suspense>
  );
}
