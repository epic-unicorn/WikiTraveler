"use client";

import { useLocale } from "@wikitraveler/ui";
import {
  parseTaggedNotes,
  taggedNoteHeadingKey,
  type TaggedNoteSection,
} from "../lib/taggedNotes";

interface Props {
  text: string;
}

function headingLabel(
  heading: string,
  t: (key: string) => string
): string {
  const key = taggedNoteHeadingKey(heading);
  return key ? t(key) : heading;
}

function Section({ section, t }: { section: TaggedNoteSection; t: (key: string) => string }) {
  return (
    <div className="fk-tagged-notes__group">
      {section.heading && (
        <p className="fk-tagged-notes__heading">{headingLabel(section.heading, t)}</p>
      )}
      {section.items.length === 1 ? (
        <p className="fk-tagged-notes__text">{section.items[0]}</p>
      ) : (
        <ul className="fk-tagged-notes__list">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TaggedNotes({ text }: Props) {
  const { t } = useLocale();
  const sections = parseTaggedNotes(text);
  if (!sections) {
    return <span className="fk-property-fact-value">{text}</span>;
  }
  return (
    <div className="fk-tagged-notes">
      {sections.map((section, index) => (
        <Section key={`${section.heading ?? "preamble"}-${index}`} section={section} t={t} />
      ))}
    </div>
  );
}
