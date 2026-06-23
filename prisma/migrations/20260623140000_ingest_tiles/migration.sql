-- AlterTable
ALTER TABLE "IngestJob" ADD COLUMN "tileCount" INTEGER;
ALTER TABLE "IngestJob" ADD COLUMN "tilesDone" INTEGER NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "IngestJobTileStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

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

-- CreateIndex
CREATE UNIQUE INDEX "IngestJobTile_jobId_index_key" ON "IngestJobTile"("jobId", "index");

-- AddForeignKey
ALTER TABLE "IngestJobTile" ADD CONSTRAINT "IngestJobTile_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
