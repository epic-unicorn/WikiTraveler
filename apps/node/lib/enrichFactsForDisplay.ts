import { formatFactValue, isProseField, type Locale } from "@wikitraveler/i18n";
import { getOrTranslateCachedText, getOrTranslateFactText } from "@/lib/translation";
import type { AuditNoteEntry } from "@/lib/auditEvidence";

export interface RawFactForDisplay {
  id: string;
  fieldName: string;
  scopeKey?: string;
  value: string;
  valueLocale?: string | null;
  tier: string;
  sourceType: string;
  sourceNodeId: string;
  submittedBy: string | null;
  timestamp: string;
  signatureHash?: string | null;
}

export interface EnrichedFact extends RawFactForDisplay {
  displayValue: string;
  displayMode: "original" | "translated";
  machineTranslated: boolean;
}

export async function enrichFactsForDisplay(
  facts: RawFactForDisplay[],
  viewerLocale: string
): Promise<EnrichedFact[]> {
  const locale = viewerLocale as Locale;

  return Promise.all(
    facts.map(async (fact) => {
      if (!isProseField(fact.fieldName)) {
        const formatted = formatFactValue(fact.fieldName, fact.value, {
          locale,
          valueLocale: fact.valueLocale,
        });
        return {
          ...fact,
          displayValue: formatted.displayValue,
          displayMode: formatted.displayMode,
          machineTranslated: false,
        };
      }

      const { text, machineTranslated } = await getOrTranslateFactText(
        fact.id,
        fact.value,
        fact.valueLocale ?? null,
        locale
      );

      const formatted = formatFactValue(fact.fieldName, fact.value, {
        locale,
        valueLocale: fact.valueLocale,
        translatedValue: text,
        machineTranslated,
      });

      return {
        ...fact,
        displayValue: formatted.displayValue,
        displayMode: formatted.displayMode,
        machineTranslated: formatted.machineTranslated,
      };
    })
  );
}

export async function enrichAuditNotesForDisplay(
  notes: AuditNoteEntry[],
  viewerLocale: string,
  fallbackSourceLocale?: string | null
): Promise<AuditNoteEntry[]> {
  const locale = viewerLocale as Locale;

  return Promise.all(
    notes.map(async (note) => {
      const sourceLocale = note.sourceLocale ?? fallbackSourceLocale ?? null;
      const { text, machineTranslated } = await getOrTranslateCachedText(
        `audit-note:${note.submissionId}`,
        note.text,
        sourceLocale,
        locale
      );

      return {
        ...note,
        displayText: text,
        machineTranslated,
        sourceLocale,
      };
    })
  );
}
