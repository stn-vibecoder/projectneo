"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { updateProfile } from "@/lib/actions/preferences";
import type { ActionResult } from "@/lib/actions/result";

export function ProfileForm({ displayName, ghostingDays }: { displayName: string | null; ghostingDays: number }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateProfile, null);

  useEffect(() => {
    if (state?.ok) toast.success(t("settings.saved"));
    else if (state) toast.error(state.error);
  }, [state, t]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label={t("settings.displayName")} htmlFor="display_name">
        <Input id="display_name" name="display_name" defaultValue={displayName ?? ""} maxLength={80} />
      </Field>
      <Field label={t("settings.ghostingDays")} htmlFor="ghosting_days">
        <div className="flex items-center gap-2">
          <Input
            id="ghosting_days"
            name="ghosting_days"
            type="number"
            min={1}
            max={180}
            defaultValue={ghostingDays}
            className="w-24"
            required
          />
          <span className="text-sm text-muted">{t("settings.ghostingDaysSuffix")}</span>
        </div>
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
