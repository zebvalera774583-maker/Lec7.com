-- CreateTable
CREATE TABLE "BotCatalogItem" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultUnit" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotCatalogItem_scope_canonicalName_key" ON "BotCatalogItem"("scope", "canonicalName");

-- CreateIndex
CREATE INDEX "BotCatalogItem_scope_idx" ON "BotCatalogItem"("scope");
