"use client";

import { useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteApplication, moveApplication, setArchived } from "@/lib/actions/applications";
import type { ApplicationStatus } from "@/lib/types";
import { StatusSelect } from "../status-select";

export function StatusControl({
  applicationId,
  statusId,
  statuses,
}: {
  applicationId: string;
  statusId: string;
  statuses: ApplicationStatus[];
}) {
  const t = useTranslations("tracker");
  const [pending, start] = useTransition();
  return (
    <StatusSelect
      statuses={statuses}
      value={statusId}
      disabled={pending}
      className="h-9 px-2 text-sm text-foreground"
      onChange={(next) =>
        start(async () => {
          const res = await moveApplication({ applicationId, statusId: next });
          if (res.ok) toast.success(t("moved", { status: statuses.find((s) => s.id === next)?.label ?? "" }));
          else toast.error(res.error);
        })
      }
    />
  );
}

export function HeaderActions({ applicationId, archived }: { applicationId: string; archived: boolean }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const router = useRouter();
  const params = useSearchParams();

  // Bekreftelse etter manuell registrering (?created=1)
  useEffect(() => {
    if (params.get("created") === "1") {
      toast.success(t("job.created"));
      router.replace(`/tracker/${applicationId}`, { scroll: false });
    }
  }, [params, router, applicationId, t]);

  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setArchived(applicationId, !archived);
            if (!res.ok) toast.error(res.error);
          })
        }
      >
        {archived ? <ArchiveRestore /> : <Archive />}
        {archived ? t("application.unarchive") : t("application.archive")}
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm(t("common.confirmDelete"))) return;
          start(async () => {
            await deleteApplication(applicationId);
            toast.success(t("application.deleted"));
          });
        }}
      >
        <Trash2 />
        {t("application.deleteApp")}
      </Button>
    </div>
  );
}
