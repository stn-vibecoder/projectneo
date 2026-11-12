"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { signInWithGoogle, signInWithPassword, signUp, type AuthState } from "@/lib/actions/auth";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.97 10.97 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-base font-semibold">{mode === "signin" ? t("signInTitle") : t("signUpTitle")}</h2>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" className="w-full">
          <GoogleIcon />
          {t("google")}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <CredentialsForm key={mode} mode={mode} next={next} initialError={mode === "signin" ? initialError : undefined} />

      <p className="text-center text-sm text-muted">
        {mode === "signin" ? t("noAccount") : t("haveAccount")}{" "}
        <button
          type="button"
          className="font-medium text-accent hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? t("signUp") : t("signIn")}
        </button>
      </p>
    </div>
  );
}

function CredentialsForm({
  mode,
  next,
  initialError,
}: {
  mode: "signin" | "signup";
  next: string;
  initialError?: string;
}) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "signin" ? signInWithPassword : signUp,
    initialError ? { error: initialError } : null,
  );

  return (
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label={t("email")} htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label={t("password")} htmlFor="password" hint={mode === "signup" ? t("passwordHint") : undefined}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </Field>

        {state?.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {mode === "signin" ? t("signIn") : t("signUp")}
        </Button>
      </form>
  );
}
