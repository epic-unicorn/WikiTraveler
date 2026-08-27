-- AlterTable
ALTER TABLE "Property" ADD COLUMN "claimedByUserId" TEXT;
ALTER TABLE "Property" ADD COLUMN "claimedAt" TIMESTAMP(3);
