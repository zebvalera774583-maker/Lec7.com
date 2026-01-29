-- CreateEnum
CREATE TYPE "PriceListKind" AS ENUM ('BASE', 'DERIVED');

-- CreateEnum
CREATE TYPE "PriceModifierType" AS ENUM ('MARKUP', 'DISCOUNT');

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PriceListKind" NOT NULL DEFAULT 'BASE',
    "derivedFromId" TEXT,
    "modifierType" "PriceModifierType",
    "percent" INTEGER,
    "columns" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListRow" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "priceWithVat" DECIMAL(12,2),
    "priceWithoutVat" DECIMAL(12,2),
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAssignment" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "counterpartyBusinessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceList_businessId_idx" ON "PriceList"("businessId");

-- CreateIndex
CREATE INDEX "PriceList_derivedFromId_idx" ON "PriceList"("derivedFromId");

-- CreateIndex
CREATE INDEX "PriceListRow_priceListId_idx" ON "PriceListRow"("priceListId");

-- CreateIndex
CREATE INDEX "PriceAssignment_priceListId_idx" ON "PriceAssignment"("priceListId");

-- CreateIndex
CREATE INDEX "PriceAssignment_counterpartyBusinessId_idx" ON "PriceAssignment"("counterpartyBusinessId");

-- CreateUniqueConstraint
CREATE UNIQUE INDEX "PriceListRow_priceListId_order_key" ON "PriceListRow"("priceListId", "order");

-- CreateUniqueConstraint
CREATE UNIQUE INDEX "PriceAssignment_priceListId_counterpartyBusinessId_key" ON "PriceAssignment"("priceListId", "counterpartyBusinessId");

-- AddForeignKey
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_derivedFromId_fkey" FOREIGN KEY ("derivedFromId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListRow" ADD CONSTRAINT "PriceListRow_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAssignment" ADD CONSTRAINT "PriceAssignment_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAssignment" ADD CONSTRAINT "PriceAssignment_counterpartyBusinessId_fkey" FOREIGN KEY ("counterpartyBusinessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
