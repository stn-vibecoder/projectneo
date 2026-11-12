import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Briefcase } from "lucide-react";
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
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Briefcase className="size-5" />
        </div>
        <h1 className="text-xl font-semibold">{t("name")}</h1>
        <p className="mt-1 text-sm text-muted">{t("tagline")}</p>
      </div>
      <Card className="p-5 sm:p-6">
        <Suspense fallback={<Skeleton className="h-72" />}>
          <LoginContent searchParams={props.searchParams} />
        </Suspense>
      </Card>
    </main>
  );
}
