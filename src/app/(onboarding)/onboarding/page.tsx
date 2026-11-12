import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, PageSkeleton } from "@/components/ui/card";
import { PreferencesForm } from "@/components/preferences-form";
import { completeOnboarding } from "@/lib/actions/preferences";
import { getProfile } from "@/lib/data";
import { DEFAULT_INDUSTRIES } from "@/lib/domain";

export const metadata = { title: "Kom i gang" };

async function OnboardingContent() {
  const t = await getTranslations("onboarding");
  const { profile, prefs } = await getProfile();
  if (profile?.onboarded_at) redirect("/dashboard");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("intro")}</p>
      <Card className="mt-6 p-5 sm:p-6">
        <PreferencesForm
          action={completeOnboarding}
          // Første versjon retter seg mot økonomistudenter.
          initial={{ ...prefs, industries: prefs.industries.length ? prefs.industries : [...DEFAULT_INDUSTRIES] }}
          studyField={profile?.study_field ?? null}
          submitLabel={t("submit")}
        />
      </Card>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <Suspense fallback={<PageSkeleton />}>
        <OnboardingContent />
      </Suspense>
    </main>
  );
}
