-- CreateEnum
CREATE TYPE "FieldScope" AS ENUM ('PROPERTY', 'ROOM');
CREATE TYPE "ValueType" AS ENUM ('BOOLEAN', 'NUMBER', 'TEXT', 'TIME', 'ENUM');

-- AlterTable: AccessibilityFact — add scopeKey, update unique constraint
ALTER TABLE "AccessibilityFact" ADD COLUMN "scopeKey" TEXT NOT NULL DEFAULT 'property';

DROP INDEX IF EXISTS "AccessibilityFact_propertyId_fieldName_sourceNodeId_key";
CREATE UNIQUE INDEX "AccessibilityFact_propertyId_fieldName_sourceNodeId_scopeKey_key" ON "AccessibilityFact"("propertyId", "fieldName", "sourceNodeId", "scopeKey");
CREATE INDEX "AccessibilityFact_scopeKey_idx" ON "AccessibilityFact"("scopeKey");

-- CreateTable: FieldDefinition
CREATE TABLE "FieldDefinition" (
    "id" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "scope" "FieldScope" NOT NULL DEFAULT 'PROPERTY',
    "valueType" "ValueType" NOT NULL DEFAULT 'BOOLEAN',
    "enumValues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "labels" JSONB NOT NULL,
    "unit" TEXT,
    "nodeId" TEXT,
    "searchFilter" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FieldDefinition_fieldName_key" ON "FieldDefinition"("fieldName");

-- AlterTable: AuditSubmission
ALTER TABLE "AuditSubmission" ADD COLUMN "locale" TEXT;

-- CreateTable: AuditPhoto
CREATE TABLE "AuditPhoto" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "fieldName" TEXT,
    "scopeKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditPhoto_submissionId_idx" ON "AuditPhoto"("submissionId");

ALTER TABLE "AuditPhoto" ADD CONSTRAINT "AuditPhoto_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AuditSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
