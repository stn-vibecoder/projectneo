"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { STATUS_CATEGORIES, STATUS_COLOR_NAMES, statusColor, type StatusCategory } from "@/lib/domain";
import { addStatus, deleteStatus, moveStatus, updateStatus } from "@/lib/actions/statuses";
import type { ApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = { label: string; category: StatusCategory; color: string };

function StatusFields({
  draft,
  onChange,
  idPrefix,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  idPrefix: string;
}) {
  const t = useTranslations();
  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className={cn("size-2.5 shrink-0 rounded-full", statusColor(draft.color).dot)} />
        <Input
          aria-label={t("settings.statusLabel")}
          id={`${idPrefix}-label`}
          value={draft.label}
          maxLength={40}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          className="h-9"
        />
      </div>
      <Select
        aria-label={t("settings.statusCategory")}
        value={draft.category}
        onChange={(e) => onChange({ ...draft, category: e.target.value as StatusCategory })}
        className="h-9 sm:w-48"
      >
        {STATUS_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {t(`enums.category.${c}`)}
          </option>
        ))}
      </Select>
      <Select
        aria-label={t("settings.statusColor")}
        value={draft.color}
        onChange={(e) => onChange({ ...draft, color: e.target.value })}
        className="h-9 sm:w-32"
      >
        {STATUS_COLOR_NAMES.map((c) => (
          <option key={c} value={c}>
            {t(`enums.color.${c}`)}
          </option>
        ))}
      </Select>
    </>
  );
}

function StatusRow({ status, first, last }: { status: ApplicationStatus; first: boolean; last: boolean }) {
  const t = useTranslations();
  const initial: Draft = { label: status.label, category: status.category, color: status.color };
  const [draft, setDraft] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = draft.label !== status.label || draft.category !== status.category || draft.color !== status.color;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (success) toast.success(success);
      } else toast.error(res.error);
    });

  return (
    <li className={cn("flex flex-col gap-2 py-3 sm:flex-row sm:items-center", pending && "opacity-60")}>
      <StatusFields draft={draft} onChange={setDraft} idPrefix={status.id} />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("common.moveUp")}
          disabled={first || pending}
          onClick={() => run(() => moveStatus(status.id, "up"))}
        >
          <ChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("common.moveDown")}
          disabled={last || pending}
          onClick={() => run(() => moveStatus(status.id, "down"))}
        >
          <ChevronDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("common.delete")}
          disabled={pending}
          onClick={() => {
            if (confirm(t("common.confirmDelete"))) run(() => deleteStatus(status.id));
          }}
        >
          <Trash2 />
        </Button>
        {dirty && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setDraft(initial)} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={pending || !draft.label.trim()}
              onClick={() => run(() => updateStatus(status.id, draft), t("settings.saved"))}
            >
              {t("common.save")}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function StatusEditor({ statuses }: { statuses: ApplicationStatus[] }) {
  const t = useTranslations();
  const empty: Draft = { label: "", category: "applied", color: "pink" };
  const [draft, setDraft] = useState<Draft>(empty);
  const [pending, start] = useTransition();

  return (
    <div>
      <ul className="divide-y divide-border">
        {statuses.map((s, i) => (
          // key med posisjon og innhold: raden nullstilles når serveren sender nye verdier
          <StatusRow
            key={`${s.id}-${s.label}-${s.category}-${s.color}`}
            status={s}
            first={i === 0}
            last={i === statuses.length - 1}
          />
        ))}
      </ul>
      <form
        className={cn("mt-3 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center", pending && "opacity-60")}
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.label.trim()) return;
          start(async () => {
            const res = await addStatus(draft);
            if (res.ok) setDraft(empty);
            else toast.error(res.error);
          });
        }}
      >
        <StatusFields draft={draft} onChange={setDraft} idPrefix="new" />
        <Button type="submit" size="sm" variant="secondary" disabled={pending || !draft.label.trim()}>
          <Plus />
          {t("settings.addStatus")}
        </Button>
      </form>
    </div>
  );
}
