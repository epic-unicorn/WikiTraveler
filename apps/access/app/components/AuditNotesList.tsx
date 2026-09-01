"use client";

import { useState } from "react";
import { useLocale } from "@wikitraveler/ui";
import { TaggedNotes } from "./TaggedNotes";

export type AuditNoteItem = {
  submissionId: string;
  createdAt: string;
  auditorToken: string | null;
  text: string;
  sourceLocale?: string | null;
  displayText?: string;
  machineTranslated?: boolean;
};

const VISIBLE = 2;

function auditorLabel(token: string | null): string | null {
  if (!token) return null;
  const at = token.indexOf("@");
  return at > 0 ? token.slice(0, at) : token;
}

function NoteBody({ note }: { note: AuditNoteItem }) {
  const { t } = useLocale();
  const [showOriginal, setShowOriginal] = useState(false);
  const displayText = note.displayText ?? note.text;
  const body = showOriginal ? note.text : displayText;
  const showToggle = Boolean(note.machineTranslated && note.text.trim() !== displayText.trim());

  return (
    <>
      <TaggedNotes text={body} />
      {showToggle ? (
        <div className="wt-prose-fact fk-audit-note-translation">
          {!showOriginal ? (
            <span className="wt-prose-fact-badge">{t("ui.machineTranslation")}</span>
          ) : null}
          <button
            type="button"
            className="wt-prose-fact-toggle"
            onClick={() => setShowOriginal((open) => !open)}
          >
            {showOriginal ? t("ui.showTranslation") : t("ui.showOriginal")}
          </button>
        </div>
      ) : null}
    </>
  );
}

function NoteCard({
  note,
  locale,
}: {
  note: AuditNoteItem;
  locale: string;
}) {
  const who = auditorLabel(note.auditorToken);
  const when = new Date(note.createdAt).toLocaleString(locale);
  return (
    <article className="fk-audit-note">
      <p className="fk-audit-note-meta">
        {who ? `${who} · ${when}` : when}
      </p>
      <NoteBody note={note} />
    </article>
  );
}

export function AuditNotesList({ notes }: { notes: AuditNoteItem[] }) {
  const { locale, t } = useLocale();
  const [showOlder, setShowOlder] = useState(false);
  if (notes.length === 0) return null;

  const visible = notes.slice(0, VISIBLE);
  const older = notes.slice(VISIBLE);

  return (
    <section className="fk-property-section">
      <h2 className="fk-property-section-title">{t("ui.propertySectionNotes")}</h2>
      <div className="fk-audit-notes">
        {visible.map((note) => (
          <NoteCard key={note.submissionId} note={note} locale={locale} />
        ))}
        {older.length > 0 && (
          <>
            {showOlder
              ? older.map((note) => (
                  <NoteCard key={note.submissionId} note={note} locale={locale} />
                ))
              : null}
            <button
              type="button"
              className="fk-audit-notes-toggle"
              onClick={() => setShowOlder((open) => !open)}
            >
              {showOlder
                ? t("ui.propertyNotesHideOlder")
                : t("ui.propertyNotesShowOlder", { count: older.length })}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
