-- CreateTable
CREATE TABLE "BotLearnedAlias" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "aliasText" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotLearnedAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotLearnedAlias_businessId_aliasText_key" ON "BotLearnedAlias"("businessId", "aliasText");

-- CreateIndex
CREATE INDEX "BotLearnedAlias_businessId_idx" ON "BotLearnedAlias"("businessId");

-- CreateIndex
CREATE INDEX "BotLearnedAlias_businessId_canonicalName_idx" ON "BotLearnedAlias"("businessId", "canonicalName");
