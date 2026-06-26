-- CreateTable
CREATE TABLE "PropertyMetadataOverride" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL DEFAULT 'AUDITOR',
    "sourceNodeId" TEXT NOT NULL,
    "submittedBy" TEXT,
    "signatureHash" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "PropertyMetadataOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyMetadataOverride_canonicalId_idx" ON "PropertyMetadataOverride"("canonicalId");

-- CreateIndex
CREATE INDEX "PropertyMetadataOverride_propertyId_idx" ON "PropertyMetadataOverride"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyMetadataOverride_timestamp_idx" ON "PropertyMetadataOverride"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyMetadataOverride_canonicalId_fieldName_sourceNodeId_key" ON "PropertyMetadataOverride"("canonicalId", "fieldName", "sourceNodeId");

-- AddForeignKey
ALTER TABLE "PropertyMetadataOverride" ADD CONSTRAINT "PropertyMetadataOverride_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
