"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Plus, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { addNote } from "@/lib/actions/applications";
import type { ApplicationEvent } from "@/lib/types";

export function History({ applicationId, events }: { applicationId: string; events: ApplicationEvent[] }) {
  const t = useTranslations("application");
  const format = useFormatter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!note.trim()) return;
          start(async () => {
            const res = await addNote(applicationId, note);
            if (res.ok) setNote("");
            else toast.error(res.error);
          });
        }}
      >
        <Textarea
          aria-label={t("addNote")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("notePlaceholder")}
          rows={2}
          maxLength={2000}
          className="min-h-16"
        />
        <div>
          <Button type="submit" size="sm" variant="secondary" disabled={pending || !note.trim()}>
            <Plus />
            {t("addNote")}
          </Button>
        </div>
      </form>

      <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
        {events.map((e) => (
          <li key={e.id} className="relative text-sm">
            <span className="absolute -left-[25px] top-1 flex size-2.5 rounded-full border-2 border-surface bg-accent" />
            <p className="text-xs text-muted">
              {format.dateTime(new Date(e.created_at), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
            {e.type === "created" && <p>{t("eventCreated", { status: e.to_label ?? "" })}</p>}
            {e.type === "status_changed" && (
              <p className="inline-flex flex-wrap items-center gap-1.5">
                <span className="text-muted">{e.from_label}</span>
                <ArrowRight className="size-3.5 text-muted" />
                <span className="font-medium">{e.to_label}</span>
              </p>
            )}
            {e.type === "note" && (
              <p className="flex gap-1.5 whitespace-pre-line">
                <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted" />
                {e.note}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
