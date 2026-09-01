-- Cache DeepL translations for audit-note history and other free text blobs.
CREATE TABLE "TextTranslationCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "targetLocale" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceLocale" TEXT,
    "translatedText" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'deepl',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TextTranslationCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TextTranslationCache_cacheKey_targetLocale_key" ON "TextTranslationCache"("cacheKey", "targetLocale");
CREATE INDEX "TextTranslationCache_cacheKey_idx" ON "TextTranslationCache"("cacheKey");
