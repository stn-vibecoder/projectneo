"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { saveJobToTracker } from "@/lib/actions/applications";

export function SaveJobButton({
  jobId,
  applicationId,
  signedIn = true,
}: {
  jobId: string;
  applicationId?: string;
  /** Besøkende sendes til innlogging, og kommer tilbake til stillingen etterpå. */
  signedIn?: boolean;
}) {
  const t = useTranslations("feed");
  const [savedId, setSavedId] = useState(applicationId);
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/jobs/${jobId}`)}`}
        className={buttonVariants({ size: "sm" })}
        title={t("signInToSave")}
      >
        <Bookmark />
        {t("saveToTracker")}
      </Link>
    );
  }

  if (savedId) {
    return (
      <Link href={`/tracker/${savedId}`} className={buttonVariants({ variant: "soft", size: "sm" })} title={t("openInTracker")}>
        <BookmarkCheck />
        {t("savedToTracker")}
      </Link>
    );
  }

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await saveJobToTracker(jobId);
          if (res.ok) {
            setSavedId(res.data.applicationId);
            toast.success(t("savedToast"));
          } else {
            toast.error(res.error);
          }
        })
      }
    >
      <Bookmark />
      {t("saveToTracker")}
    </Button>
  );
}
