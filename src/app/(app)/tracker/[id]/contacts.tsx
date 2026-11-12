"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link2, Mail, Pencil, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { deleteContact, saveContact } from "@/lib/actions/contacts";
import type { ActionResult } from "@/lib/actions/result";
import type { Contact } from "@/lib/types";
import { safeUrl } from "@/lib/utils";

function ContactForm({
  applicationId,
  contact,
  onDone,
}: {
  applicationId: string;
  contact?: Contact;
  onDone: () => void;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveContact.bind(null, applicationId, contact?.id ?? null),
    null,
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("application.contactName")} htmlFor="c-name" error={errors.name}>
          <Input id="c-name" name="name" defaultValue={contact?.name ?? ""} required maxLength={200} />
        </Field>
        <Field label={t("application.contactRole")} htmlFor="c-role">
          <Input id="c-role" name="role" defaultValue={contact?.role ?? ""} maxLength={120} />
        </Field>
        <Field label={t("application.contactEmail")} htmlFor="c-email" error={errors.email}>
          <Input id="c-email" name="email" type="email" defaultValue={contact?.email ?? ""} />
        </Field>
        <Field label={t("application.contactPhone")} htmlFor="c-phone">
          <Input id="c-phone" name="phone" type="tel" defaultValue={contact?.phone ?? ""} />
        </Field>
        <Field label={t("application.contactLinkedin")} htmlFor="c-li" className="sm:col-span-2">
          <Input id="c-li" name="linkedin_url" type="url" defaultValue={contact?.linkedin_url ?? ""} />
        </Field>
      </div>
      <Field label={t("application.contactNotes")} htmlFor="c-notes">
        <Textarea id="c-notes" name="notes" defaultValue={contact?.notes ?? ""} rows={2} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {t("common.save")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

export function Contacts({ applicationId, contacts }: { applicationId: string; contacts: Contact[] }) {
  const t = useTranslations();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [pending, start] = useTransition();
  const close = () => setEditing(null);

  return (
    <div className="flex flex-col gap-3">
      {contacts.length === 0 && editing !== "new" && <p className="text-sm text-muted">{t("application.noContacts")}</p>}
      <ul className="flex flex-col gap-2">
        {contacts.map((c) =>
          editing === c.id ? (
            <li key={c.id}>
              <ContactForm applicationId={applicationId} contact={c} onDone={close} />
            </li>
          ) : (
            <li key={c.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted">
                <UserRound className="size-4" />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">
                  {c.name}
                  {c.role && <span className="font-normal text-muted"> · {c.role}</span>}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                      <Mail className="size-3" />
                      {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                      <Phone className="size-3" />
                      {c.phone}
                    </a>
                  )}
                  {safeUrl(c.linkedin_url) && (
                    <a
                      href={safeUrl(c.linkedin_url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <Link2 className="size-3" />
                      LinkedIn
                    </a>
                  )}
                </div>
                {c.notes && <p className="mt-1 whitespace-pre-line text-xs">{c.notes}</p>}
              </div>
              <div className="flex shrink-0">
                <Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} onClick={() => setEditing(c.id)}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("common.delete")}
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(t("common.confirmDelete"))) return;
                    start(async () => {
                      const res = await deleteContact(applicationId, c.id);
                      if (!res.ok) toast.error(res.error);
                    });
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <ContactForm applicationId={applicationId} onDone={close} />
      ) : (
        <div>
          <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
            <Plus />
            {t("application.addContact")}
          </Button>
        </div>
      )}
    </div>
  );
}
