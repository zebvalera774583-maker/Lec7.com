-- CreateTable
CREATE TABLE "PlatformCounter" (
    "id" TEXT NOT NULL,
    "lastRequestNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCounter_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Request" ADD COLUMN "number" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Request_number_key" ON "Request"("number");

-- CreateIndex
CREATE INDEX "Request_number_idx" ON "Request"("number");
