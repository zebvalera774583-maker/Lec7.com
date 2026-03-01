-- AlterTable
ALTER TABLE "PriceListRow" ADD COLUMN "masterItemId" TEXT;

-- CreateIndex
CREATE INDEX "PriceListRow_masterItemId_idx" ON "PriceListRow"("masterItemId");

-- AddForeignKey
ALTER TABLE "PriceListRow" ADD CONSTRAINT "PriceListRow_masterItemId_fkey" FOREIGN KEY ("masterItemId") REFERENCES "BotCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
