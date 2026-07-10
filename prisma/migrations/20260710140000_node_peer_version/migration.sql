-- AlterTable
ALTER TABLE "NodePeer" ADD COLUMN "lastKnownVersion" TEXT;
ALTER TABLE "NodePeer" ADD COLUMN "gossipProtocol" INTEGER;
