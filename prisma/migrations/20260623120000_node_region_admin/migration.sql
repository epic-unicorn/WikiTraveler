-- CreateEnum
CREATE TYPE "IngestJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestJobPhase" AS ENUM ('PURGING', 'FETCHING', 'INGESTING', 'DONE');

-- CreateTable
CREATE TABLE "NodeSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "bbox" TEXT,
    "region" TEXT,
    "presetId" TEXT,
    "configuredAt" TIMESTAMP(3),
    "lastIngestAt" TIMESTAMP(3),
    "lastIngestCount" INTEGER,
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
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "stats" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestJob_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row
INSERT INTO "NodeSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);
