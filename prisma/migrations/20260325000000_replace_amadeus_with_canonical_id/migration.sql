-- Migration: replace amadeusId with canonicalId (Wikidata Q-identifier)
-- and replace AMADEUS SourceType with WIKIDATA.
-- Backwards compatibility is not required — the system has not been in production.

-- ---------------------------------------------------------------------------
-- 1. Update SourceType enum
-- ---------------------------------------------------------------------------

-- Rename the old enum type
ALTER TYPE "SourceType" RENAME TO "SourceType_old";

-- Create the new enum without AMADEUS, with WIKIDATA instead
CREATE TYPE "SourceType" AS ENUM ('WIKIDATA', 'WHEELMAP', 'WHEEL_THE_WORLD', 'AUDITOR');

-- Migrate the AccessibilityFact column to the new enum
-- Any old AMADEUS values become WIKIDATA; all others cast directly
ALTER TABLE "AccessibilityFact"
  ALTER COLUMN "sourceType" DROP DEFAULT;

ALTER TABLE "AccessibilityFact"
  ALTER COLUMN "sourceType" TYPE "SourceType"
  USING (
    CASE "sourceType"::text
      WHEN 'AMADEUS' THEN 'WIKIDATA'::"SourceType"
      ELSE "sourceType"::text::"SourceType"
    END
  );

ALTER TABLE "AccessibilityFact"
  ALTER COLUMN "sourceType" SET DEFAULT 'AUDITOR'::"SourceType";

DROP TYPE "SourceType_old";

-- ---------------------------------------------------------------------------
-- 2. Swap amadeusId → canonicalId on Property
-- ---------------------------------------------------------------------------

-- Drop the unique constraint on the old column name
ALTER TABLE "Property" DROP CONSTRAINT "Property_amadeusId_key";

-- Rename the column (existing test values become the initial canonicalId values)
ALTER TABLE "Property" RENAME COLUMN "amadeusId" TO "canonicalId";

-- Restore the unique constraint under the new name
ALTER TABLE "Property" ADD CONSTRAINT "Property_canonicalId_key" UNIQUE ("canonicalId");
