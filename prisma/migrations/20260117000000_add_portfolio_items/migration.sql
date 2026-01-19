-- CreateTable
CREATE TABLE "BusinessPortfolioItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "coverUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPortfolioPhoto" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessPortfolioPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessPortfolioItem_businessId_idx" ON "BusinessPortfolioItem"("businessId");

-- CreateIndex
CREATE INDEX "BusinessPortfolioItem_sortOrder_idx" ON "BusinessPortfolioItem"("sortOrder");

-- CreateIndex
CREATE INDEX "BusinessPortfolioPhoto_itemId_idx" ON "BusinessPortfolioPhoto"("itemId");

-- CreateIndex
CREATE INDEX "BusinessPortfolioPhoto_sortOrder_idx" ON "BusinessPortfolioPhoto"("sortOrder");

-- AddForeignKey
ALTER TABLE "BusinessPortfolioItem" ADD CONSTRAINT "BusinessPortfolioItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPortfolioPhoto" ADD CONSTRAINT "BusinessPortfolioPhoto_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BusinessPortfolioItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
