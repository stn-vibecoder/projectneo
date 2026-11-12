import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { Card, CardHeader, PageHeader, PageSkeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PreferencesForm } from "@/components/preferences-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { getProfile, getStatuses } from "@/lib/data";
import { updatePreferences } from "@/lib/actions/preferences";
import { signOut } from "@/lib/actions/auth";
import { AUTH_MODE } from "@/lib/auth";
import { ProfileForm } from "./profile-form";
import { StatusEditor } from "./status-editor";

export const metadata = { title: "Innstillinger" };

async function SettingsContent() {
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");
  const tn = await getTranslations("nav");
  const [{ user, profile, prefs }, statuses] = await Promise.all([getProfile(), getStatuses()]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />

      <Card>
        <CardHeader title={t("preferences")} description={t("preferencesHelp")} />
        <div className="p-4 sm:p-5">
          <PreferencesForm
            action={updatePreferences}
            initial={prefs}
            studyField={profile?.study_field ?? null}
            submitLabel={tc("save")}
            successMessage={t("saved")}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title={t("profile")} />
        <div className="p-4 sm:p-5">
          <ProfileForm displayName={profile?.display_name ?? null} ghostingDays={profile?.ghosting_days ?? 14} />
        </div>
      </Card>

      <Card>
        <CardHeader title={t("statuses")} description={t("statusesHelp")} />
        <div className="px-4 pb-4 sm:px-5">
          <StatusEditor statuses={statuses} />
        </div>
      </Card>

      <Card>
        <CardHeader title={t("appearance")} />
        <div className="p-4 sm:p-5">
          <ThemeToggle />
        </div>
      </Card>

      <Card>
        <CardHeader title={t("account")} />
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          {AUTH_MODE === "local" ? (
            <p className="text-sm text-muted">{t("localMode")}</p>
          ) : (
            <>
              <p className="text-sm text-muted">{t("signedInAs", { email: user.email ?? "" })}</p>
              <form action={signOut}>
                <Button type="submit" variant="secondary">
                  <LogOut />
                  {tn("signOut")}
                </Button>
              </form>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

/** Egen Suspense-grense: skjelettet vises med en gang du navigerer hit. */
export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}
