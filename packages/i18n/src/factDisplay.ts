import { getFieldLabel, getFieldEnumLabel, getRoomTypeLabel, isFieldEnumValue, LOCALE_LABELS, t, type Locale } from "./index";

export const PROSE_FIELD_NAMES = new Set([
  "notes",
  "accessible_room_description",
  "service_animal_policy",
]);

const CONFIDENCE_ONLY = new Set(["high", "medium", "low"]);

const FIELD_UNITS: Record<string, string> = {
  door_width_cm: "cm",
  bed_height_cm: "cm",
  turning_circle_cm: "cm",
};

export type FactDisplayMode = "original" | "translated";

export interface FormatFactValueOptions {
  locale?: Locale | string;
  valueLocale?: Locale | string | null;
  unit?: string | null;
  /** Server-provided translation for prose fields */
  translatedValue?: string | null;
  machineTranslated?: boolean;
}

export interface FormattedFactValue {
  displayValue: string;
  rawValue: string;
  isProse: boolean;
  machineTranslated: boolean;
  displayMode: FactDisplayMode;
  valueLocale?: Locale | null;
  submittedLanguageLabel?: string;
}

export function isProseField(fieldName: string): boolean {
  return PROSE_FIELD_NAMES.has(fieldName);
}

export function formatFactValue(
  fieldName: string,
  value: string,
  options: FormatFactValueOptions = {}
): FormattedFactValue {
  const locale = (options.locale ?? "en") as Locale;
  const rawValue = String(value ?? "").trim();
  const valueLocale = (options.valueLocale as Locale | null | undefined) ?? null;
  const isProse = isProseField(fieldName);

  if (isProse) {
    const localesDiffer =
      valueLocale != null && valueLocale !== locale && isSupportedLocalePair(valueLocale, locale);
    const useTranslation = Boolean(
      options.machineTranslated &&
        options.translatedValue &&
        options.translatedValue.trim() &&
        (localesDiffer || options.translatedValue.trim() !== rawValue)
    );

    return {
      displayValue: useTranslation ? options.translatedValue! : rawValue,
      rawValue,
      isProse: true,
      machineTranslated: Boolean(useTranslation),
      displayMode: useTranslation ? "translated" : "original",
      valueLocale,
      submittedLanguageLabel:
        valueLocale && valueLocale !== locale
          ? LOCALE_LABELS[valueLocale as Locale] ?? valueLocale
          : undefined,
    };
  }

  let displayValue = rawValue;
  if (rawValue === "yes" || rawValue === "true") displayValue = t("ui.yes", locale);
  else if (rawValue === "no" || rawValue === "false") displayValue = t("ui.no", locale);
  else if (rawValue === "partial") displayValue = t("ui.partial", locale);
  else if (rawValue === "n/a" || rawValue === "n.a." || rawValue === "na") {
    displayValue = t("ui.notApplicable", locale);
  }
  else if (fieldName === "room_types_available") {
    displayValue = rawValue
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((id) => getRoomTypeLabel(id, locale))
      .join(", ");
  } else if (isFieldEnumValue(fieldName, rawValue, locale)) {
    displayValue = rawValue
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((token) => getFieldEnumLabel(fieldName, token, locale))
      .join(", ");
  } else {
    const unit = options.unit ?? FIELD_UNITS[fieldName];
    if (unit && rawValue && !Number.isNaN(Number(rawValue))) {
      displayValue = `${rawValue} ${unit}`;
    }
  }

  return {
    displayValue,
    rawValue,
    isProse: false,
    machineTranslated: false,
    displayMode: "original",
    valueLocale,
  };
}

function isSupportedLocalePair(a: string, b: string): boolean {
  return a !== b;
}

export interface AiMeta {
  confidence?: string;
  evidence?: string;
}

export function parseAiMeta(signatureHash?: string | null): AiMeta | null {
  if (!signatureHash) return null;
  try {
    const parsed = JSON.parse(signatureHash) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as AiMeta;
  } catch {
    return null;
  }
}

export interface ResolveFactDisplayInput {
  fieldName?: string;
  value: string;
  tier: string;
  signatureHash?: string | null;
  valueLocale?: string | null;
  translatedValue?: string | null;
  machineTranslated?: boolean;
  unit?: string | null;
}

export function resolveFactDisplay(
  fact: ResolveFactDisplayInput,
  locale: string = "en"
): {
  label: string;
  displayValue: string;
  confidence: string | null;
  evidence: string;
  rawValue: string;
  formatted: FormattedFactValue;
} {
  const meta = fact.tier === "AI_GUESS" ? parseAiMeta(fact.signatureHash) : null;
  const rawValue = String(fact.value ?? "").trim();
  const confidence =
    typeof meta?.confidence === "string" ? meta.confidence.toLowerCase() : null;
  const evidence = typeof meta?.evidence === "string" ? meta.evidence.trim() : "";

  let displayValue = rawValue;
  if (
    fact.tier === "AI_GUESS" &&
    CONFIDENCE_ONLY.has(rawValue.toLowerCase()) &&
    evidence
  ) {
    displayValue = evidence;
  } else if (
    fact.tier === "AI_GUESS" &&
    CONFIDENCE_ONLY.has(rawValue.toLowerCase())
  ) {
    displayValue = t("ui.estimateUnavailable", locale);
  } else if (fact.fieldName) {
    const formatted = formatFactValue(fact.fieldName, rawValue, {
      locale,
      valueLocale: fact.valueLocale,
      unit: fact.unit,
      translatedValue: fact.translatedValue,
      machineTranslated: fact.machineTranslated,
    });
    displayValue = formatted.displayValue;
    const label = getFieldLabel(fact.fieldName, locale);
    return { label, displayValue, confidence, evidence, rawValue, formatted };
  }

  const formatted = formatFactValue(fact.fieldName ?? "", rawValue, { locale });
  const label = fact.fieldName ? getFieldLabel(fact.fieldName, locale) : "";
  return { label, displayValue, confidence, evidence, rawValue, formatted };
}
