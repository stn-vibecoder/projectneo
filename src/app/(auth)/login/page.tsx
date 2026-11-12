import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowRight, Landmark } from "lucide-react";
import { authMode } from "@/lib/env";
import { Card, Skeleton } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata = { title: "Logg inn" };

async function LoginContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const t = await getTranslations("auth");
  const next = typeof sp.next === "string" ? sp.next : "/dashboard";
  const error =
    sp.error === "callback"
      ? t("callbackError")
      : sp.error === "forbidden"
        ? t("forbidden")
        : sp.error
          ? t("genericError")
          : undefined;
  return <LoginForm next={next} initialError={error} />;
}

export default async function LoginPage(props: PageProps<"/login">) {
  const t = await getTranslations("app");
  const ta = await getTranslations("auth");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl border border-gold/40 bg-sidebar text-gold">
          <Landmark className="size-5" />
        </div>
        <h1 className="font-serif text-2xl font-semibold">{t("name")}</h1>
        <p className="mt-1 text-sm text-muted">{ta("why")}</p>
      </div>
      <Card className="p-5 sm:p-6">
        <Suspense fallback={<Skeleton className="h-72" />}>
          <LoginContent searchParams={props.searchParams} />
        </Suspense>
      </Card>
      {authMode() === "optional" && (
        <Link
          href="/feed"
          className="mt-5 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
        >
          {ta("continueAsGuest")}
          <ArrowRight className="size-4" />
        </Link>
      )}
    </main>
  );
}
