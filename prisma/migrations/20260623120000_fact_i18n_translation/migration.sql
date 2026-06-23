-- Fact value locale + DeepL translation cache
ALTER TABLE "AccessibilityFact" ADD COLUMN "valueLocale" TEXT;

CREATE TABLE "FactTranslation" (
    "id" TEXT NOT NULL,
    "factId" TEXT NOT NULL,
    "sourceLocale" TEXT NOT NULL,
    "targetLocale" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'deepl',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FactTranslation_factId_targetLocale_key" ON "FactTranslation"("factId", "targetLocale");
CREATE INDEX "FactTranslation_factId_idx" ON "FactTranslation"("factId");

ALTER TABLE "FactTranslation" ADD CONSTRAINT "FactTranslation_factId_fkey" FOREIGN KEY ("factId") REFERENCES "AccessibilityFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
