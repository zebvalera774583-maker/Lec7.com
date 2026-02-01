-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_type_key" ON "Category"("name", "type");

-- CreateIndex
CREATE INDEX "Category_type_idx" ON "Category"("type");

-- Seed default PRICE category
INSERT INTO "Category" ("id", "name", "type", "sortOrder", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Свежая плодоовощная продукция', 'PRICE', 0, NOW(), NOW());
