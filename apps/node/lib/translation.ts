import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { isProseField, isSupportedLocale, type Locale } from "@wikitraveler/i18n";

const DEEPL_LANG: Record<Locale, string> = {
  en: "EN",
  nl: "NL",
  de: "DE",
  fr: "FR",
};

export function isTranslationEnabled(): boolean {
  if (process.env.TRANSLATION_ENABLED === "false") return false;
  return Boolean(process.env.DEEPL_API_KEY?.trim());
}

export function toDeepLLang(locale: string): string | null {
  if (!isSupportedLocale(locale)) return null;
  return DEEPL_LANG[locale];
}

export function hashSourceText(text: string): string {
  return createHash("sha256").update(text.trim()).digest("hex");
}

export async function translateWithDeepL(
  text: string,
  targetLocale: string,
  sourceLocale?: string | null
): Promise<string | null> {
  const apiKey = process.env.DEEPL_API_KEY?.trim();
  if (!apiKey) return null;

  const targetLang = toDeepLLang(targetLocale);
  if (!targetLang) return null;

  const baseUrl =
    process.env.DEEPL_API_URL?.replace(/\/$/, "") ?? "https://api.deepl.com";

  const body: Record<string, unknown> = {
    text: [text],
    target_lang: targetLang,
  };
  if (sourceLocale) {
    const sourceLang = toDeepLLang(sourceLocale);
    if (sourceLang) body.source_lang = sourceLang;
  }

  try {
    const res = await fetch(`${baseUrl}/v2/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[translation] DeepL error", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as {
      translations?: Array<{ text?: string }>;
    };
    return data.translations?.[0]?.text ?? null;
  } catch (err) {
    console.error("[translation] DeepL request failed:", err);
    return null;
  }
}

export async function getOrTranslateFactText(
  factId: string,
  sourceText: string,
  sourceLocale: string | null,
  targetLocale: string
): Promise<{ text: string; machineTranslated: boolean }> {
  const trimmed = sourceText.trim();
  if (!trimmed || !isTranslationEnabled()) {
    return { text: trimmed, machineTranslated: false };
  }

  if (!sourceLocale || sourceLocale === targetLocale) {
    return { text: trimmed, machineTranslated: false };
  }

  if (!isSupportedLocale(targetLocale)) {
    return { text: trimmed, machineTranslated: false };
  }

  const sourceHash = hashSourceText(trimmed);
  const cached = await prisma.factTranslation.findUnique({
    where: {
      factId_targetLocale: { factId, targetLocale },
    },
  });

  if (cached && cached.sourceHash === sourceHash) {
    return { text: cached.translatedText, machineTranslated: true };
  }

  const translated = await translateWithDeepL(trimmed, targetLocale, sourceLocale);
  if (!translated) {
    return { text: trimmed, machineTranslated: false };
  }

  await prisma.factTranslation.upsert({
    where: {
      factId_targetLocale: { factId, targetLocale },
    },
    create: {
      factId,
      sourceLocale: sourceLocale ?? "auto",
      targetLocale,
      sourceHash,
      translatedText: translated,
      provider: "deepl",
    },
    update: {
      sourceLocale: sourceLocale ?? "auto",
      sourceHash,
      translatedText: translated,
      provider: "deepl",
    },
  });

  return { text: translated, machineTranslated: true };
}

export async function invalidateFactTranslations(factId: string): Promise<void> {
  await prisma.factTranslation.deleteMany({ where: { factId } });
}

export function shouldTranslateField(fieldName: string, value: string): boolean {
  return isProseField(fieldName) && value.trim().length > 0;
}
