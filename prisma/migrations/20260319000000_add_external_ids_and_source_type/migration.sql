-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('AMADEUS', 'WHEELMAP', 'WHEEL_THE_WORLD', 'COMMUNITY');

-- AlterTable: Add external ID columns to Property
ALTER TABLE "Property"
  ADD COLUMN "osmId"      TEXT UNIQUE,
  ADD COLUMN "wheelmapId" TEXT UNIQUE;

-- AlterTable: Add sourceType column to AccessibilityFact with default
ALTER TABLE "AccessibilityFact"
  ADD COLUMN "sourceType" "SourceType" NOT NULL DEFAULT 'AMADEUS';
