"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileUp, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { importSources, type ImportSummary } from "@/lib/actions/sources";

export function ImportSources() {
  const t = useTranslations("sources");
  const [text, setText] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        name="csv"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={t("import.placeholder")}
        aria-label={t("import.title")}
        className="font-mono text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) setText(await file.text());
            e.target.value = "";
          }}
        />
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <FileUp />
          {t("import.file")}
        </Button>
        <Button
          disabled={pending || !text.trim()}
          onClick={() =>
            start(async () => {
              setSummary(null);
              const res = await importSources(text);
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              setSummary(res.data);
              toast.success(t("import.result", { auto: res.data.auto.length, manual: res.data.manual.length }));
            })
          }
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Upload />}
          {pending ? t("import.running") : t("import.run")}
        </Button>
      </div>

      {summary && (
        <div className="grid gap-3 rounded-md border border-border bg-surface-muted/50 p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="eyebrow mb-1.5 text-positive">
              {t("import.autoList")} ({summary.auto.length})
            </p>
            <ul className="flex flex-col gap-0.5">
              {summary.auto.map((a) => (
                <li key={a.name}>
                  <span className="font-medium">{a.name}</span>{" "}
                  <span className="text-muted">
                    · {t(`types.${a.type}`)} · {a.error ? a.error : `${a.internships ?? 0} internships`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-1.5 text-muted">
              {t("import.manualList")} ({summary.manual.length})
            </p>
            <p className="text-xs text-muted">{summary.manual.map((m) => m.name).join(", ")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
