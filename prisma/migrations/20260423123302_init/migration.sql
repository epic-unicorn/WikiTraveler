-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('OFFICIAL', 'AI_GUESS', 'VERIFIED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('WIKIDATA', 'WHEELMAP', 'OSM', 'WHEEL_THE_WORLD', 'AUDITOR');

-- CreateEnum
CREATE TYPE "FieldScope" AS ENUM ('PROPERTY', 'ROOM');

-- CreateEnum
CREATE TYPE "ValueType" AS ENUM ('BOOLEAN', 'NUMBER', 'TEXT', 'TIME', 'ENUM');

-- CreateEnum
CREATE TYPE "IngestJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestJobPhase" AS ENUM ('PURGING', 'FETCHING', 'INGESTING', 'DONE');

-- CreateEnum
CREATE TYPE "IngestJobTileStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('MISSING', 'INCORRECT', 'OUTDATED', 'LOCATION', 'DEMAND');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'AUDITOR', 'ADMIN');

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "dataSource" TEXT NOT NULL DEFAULT 'NODE_ORIGINAL',
    "osmId" TEXT,
    "wheelmapId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessibilityFact" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL DEFAULT 'property',
    "value" TEXT NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'OFFICIAL',
    "sourceType" "SourceType" NOT NULL DEFAULT 'AUDITOR',
    "sourceNodeId" TEXT NOT NULL,
    "submittedBy" TEXT,
    "signatureHash" TEXT,
    "valueLocale" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessibilityFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "AuditSubmission" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "auditorToken" TEXT,
    "locale" TEXT,
    "facts" JSONB NOT NULL,
    "photoUrls" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "OsmSyncState" (
    "id" TEXT NOT NULL,
    "bbox" TEXT NOT NULL,
    "lastSync" TIMESTAMP(3),
    "itemCount" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OsmSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "bbox" TEXT,
    "region" TEXT,
    "presetId" TEXT,
    "configuredAt" TIMESTAMP(3),
    "lastIngestAt" TIMESTAMP(3),
    "lastIngestCount" INTEGER,
    "openRegistration" BOOLEAN NOT NULL DEFAULT true,
    "auditedReimportPending" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestJob" (
    "id" TEXT NOT NULL,
    "status" "IngestJobStatus" NOT NULL DEFAULT 'PENDING',
    "phase" "IngestJobPhase",
    "bbox" TEXT NOT NULL,
    "changeType" TEXT,
    "tileCount" INTEGER,
    "tilesDone" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "stats" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestJobTile" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "bbox" TEXT NOT NULL,
    "status" "IngestJobTileStatus" NOT NULL DEFAULT 'PENDING',
    "elementCount" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "IngestJobTile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunitySignal" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "SignalType" NOT NULL,
    "status" "SignalStatus" NOT NULL DEFAULT 'OPEN',
    "fieldName" TEXT,
    "scopeKey" TEXT DEFAULT 'property',
    "currentValue" TEXT,
    "currentTier" "Tier",
    "suggestedValue" TEXT,
    "note" TEXT,
    "visitDate" TIMESTAMP(3),
    "photos" JSONB NOT NULL DEFAULT '[]',
    "reporterId" TEXT NOT NULL,
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunitySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodePeer" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "nodeId" TEXT,
    "region" TEXT,
    "bbox" TEXT,
    "publicKey" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NodePeer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GossipSnapshot" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "factCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GossipSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_canonicalId_key" ON "Property"("canonicalId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_osmId_key" ON "Property"("osmId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_wheelmapId_key" ON "Property"("wheelmapId");

-- CreateIndex
CREATE INDEX "AccessibilityFact_propertyId_idx" ON "AccessibilityFact"("propertyId");

-- CreateIndex
CREATE INDEX "AccessibilityFact_tier_idx" ON "AccessibilityFact"("tier");

-- CreateIndex
CREATE INDEX "AccessibilityFact_scopeKey_idx" ON "AccessibilityFact"("scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "AccessibilityFact_propertyId_fieldName_sourceNodeId_scopeKe_key" ON "AccessibilityFact"("propertyId", "fieldName", "sourceNodeId", "scopeKey");

-- CreateIndex
CREATE INDEX "FactTranslation_factId_idx" ON "FactTranslation"("factId");

-- CreateIndex
CREATE UNIQUE INDEX "FactTranslation_factId_targetLocale_key" ON "FactTranslation"("factId", "targetLocale");

-- CreateIndex
CREATE UNIQUE INDEX "FieldDefinition_fieldName_key" ON "FieldDefinition"("fieldName");

-- CreateIndex
CREATE INDEX "AuditSubmission_propertyId_idx" ON "AuditSubmission"("propertyId");

-- CreateIndex
CREATE INDEX "AuditPhoto_submissionId_idx" ON "AuditPhoto"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "OsmSyncState_bbox_key" ON "OsmSyncState"("bbox");

-- CreateIndex
CREATE UNIQUE INDEX "IngestJobTile_jobId_index_key" ON "IngestJobTile"("jobId", "index");

-- CreateIndex
CREATE INDEX "CommunitySignal_propertyId_status_idx" ON "CommunitySignal"("propertyId", "status");

-- CreateIndex
CREATE INDEX "CommunitySignal_status_priorityScore_idx" ON "CommunitySignal"("status", "priorityScore");

-- CreateIndex
CREATE INDEX "CommunitySignal_reporterId_idx" ON "CommunitySignal"("reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "NodePeer_url_key" ON "NodePeer"("url");

-- AddForeignKey
ALTER TABLE "AccessibilityFact" ADD CONSTRAINT "AccessibilityFact_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactTranslation" ADD CONSTRAINT "FactTranslation_factId_fkey" FOREIGN KEY ("factId") REFERENCES "AccessibilityFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSubmission" ADD CONSTRAINT "AuditSubmission_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPhoto" ADD CONSTRAINT "AuditPhoto_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AuditSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestJobTile" ADD CONSTRAINT "IngestJobTile_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunitySignal" ADD CONSTRAINT "CommunitySignal_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Seed singleton NodeSettings row
INSERT INTO "NodeSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);

