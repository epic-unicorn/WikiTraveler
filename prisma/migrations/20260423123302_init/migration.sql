-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('OFFICIAL', 'AI_GUESS', 'VERIFIED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('WIKIDATA', 'WHEELMAP', 'OSM', 'WHEEL_THE_WORLD', 'AUDITOR');

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
    "value" TEXT NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'OFFICIAL',
    "sourceType" "SourceType" NOT NULL DEFAULT 'AUDITOR',
    "sourceNodeId" TEXT NOT NULL,
    "submittedBy" TEXT,
    "signatureHash" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessibilityFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditSubmission" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "auditorToken" TEXT,
    "facts" JSONB NOT NULL,
    "photoUrls" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditSubmission_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "AccessibilityFact_propertyId_fieldName_sourceNodeId_key" ON "AccessibilityFact"("propertyId", "fieldName", "sourceNodeId");

-- CreateIndex
CREATE INDEX "AuditSubmission_propertyId_idx" ON "AuditSubmission"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "OsmSyncState_bbox_key" ON "OsmSyncState"("bbox");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "NodePeer_url_key" ON "NodePeer"("url");

-- AddForeignKey
ALTER TABLE "AccessibilityFact" ADD CONSTRAINT "AccessibilityFact_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSubmission" ADD CONSTRAINT "AuditSubmission_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
