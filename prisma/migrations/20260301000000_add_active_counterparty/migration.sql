-- CreateTable
CREATE TABLE "ActiveCounterparty" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "counterpartyBusinessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveCounterparty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActiveCounterparty_businessId_counterpartyBusinessId_key" ON "ActiveCounterparty"("businessId", "counterpartyBusinessId");

-- CreateIndex
CREATE INDEX "ActiveCounterparty_businessId_idx" ON "ActiveCounterparty"("businessId");

-- CreateIndex
CREATE INDEX "ActiveCounterparty_counterpartyBusinessId_idx" ON "ActiveCounterparty"("counterpartyBusinessId");

-- AddForeignKey
ALTER TABLE "ActiveCounterparty" ADD CONSTRAINT "ActiveCounterparty_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveCounterparty" ADD CONSTRAINT "ActiveCounterparty_counterpartyBusinessId_fkey" FOREIGN KEY ("counterpartyBusinessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: создать записи из существующих ACTIVE PriceAssignment
INSERT INTO "ActiveCounterparty" ("id", "businessId", "counterpartyBusinessId", "createdAt")
SELECT encode(gen_random_bytes(12), 'hex'), pl."businessId", pa."counterpartyBusinessId", COALESCE(pa."respondedAt", pa."createdAt")
FROM "PriceAssignment" pa
JOIN "PriceList" pl ON pl.id = pa."priceListId"
WHERE pa.status = 'ACTIVE'
ON CONFLICT ("businessId", "counterpartyBusinessId") DO NOTHING;
