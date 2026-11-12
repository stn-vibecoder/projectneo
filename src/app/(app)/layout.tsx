import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MobileHeader, MobileTabs, Sidebar } from "@/components/app-nav";
import { CommandPalette } from "@/components/command-palette";
import { PageSkeleton } from "@/components/ui/card";
import { getProfile } from "@/lib/data";
import { AUTH_MODE } from "@/lib/auth";

/** Sender nye brukere til onboarding før de slipper inn i appen. */
async function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { profile } = await getProfile();
  if (!profile?.onboarded_at) redirect("/onboarding");
  return children;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar showSignOut={AUTH_MODE === "supabase"} />
      <div className="min-w-0 flex-1">
        <MobileHeader />
        <main className="page-enter mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <Suspense fallback={<PageSkeleton />}>
            <OnboardingGate>{children}</OnboardingGate>
          </Suspense>
        </main>
      </div>
      <MobileTabs />
      <CommandPalette />
    </div>
  );
}
