import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MobileHeader, MobileTabs, Sidebar, type Account } from "@/components/app-nav";
import { CommandPalette } from "@/components/command-palette";
import { PageSkeleton } from "@/components/ui/card";
import { getProfile } from "@/lib/data";
import { AUTH_MODE, getCurrentUser, isAdmin } from "@/lib/auth";

/** Sender nye brukere til onboarding før de slipper inn. Besøkende slipper rett gjennom. */
async function OnboardingGate({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) {
    const { profile } = await getProfile();
    if (!profile?.onboarded_at) redirect("/onboarding");
  }
  return children;
}

/** Mens innloggingen sjekkes: vis menyen som for en besøkende. */
const GUEST: Account = { mode: AUTH_MODE, signedIn: AUTH_MODE === "local", email: null, admin: AUTH_MODE === "local" };

async function account(): Promise<Account> {
  const user = await getCurrentUser();
  return { mode: AUTH_MODE, signedIn: Boolean(user), email: user?.email ?? null, admin: isAdmin(user) };
}

async function SidebarForUser() {
  return <Sidebar account={await account()} />;
}
async function MobileHeaderForUser() {
  return <MobileHeader account={await account()} />;
}
async function MobileTabsForUser() {
  return <MobileTabs account={await account()} />;
}

/**
 * Henting av kilder («Oppdater alle», «Hent stillinger nå», nye kilder) kan ta
 * et halvt minutt eller mer. Gir alle sider og server actions i appen opptil
 * 5 minutter på Vercel, i stedet for standardgrensen.
 */
export const maxDuration = 300;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:flex">
      <Suspense fallback={<Sidebar account={GUEST} />}>
        <SidebarForUser />
      </Suspense>
      <div className="min-w-0 flex-1">
        <Suspense fallback={<MobileHeader account={GUEST} />}>
          <MobileHeaderForUser />
        </Suspense>
        <main className="page-enter mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <Suspense fallback={<PageSkeleton />}>
            <OnboardingGate>{children}</OnboardingGate>
          </Suspense>
        </main>
      </div>
      <Suspense fallback={<MobileTabs account={GUEST} />}>
        <MobileTabsForUser />
      </Suspense>
      <CommandPalette />
    </div>
  );
}
