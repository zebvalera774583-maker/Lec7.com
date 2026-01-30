-- CreateEnum
CREATE TYPE "PartnerLinkStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED');

-- AlterTable
ALTER TABLE "PriceAssignment" ADD COLUMN "status" "PartnerLinkStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "PriceAssignment" ADD COLUMN "respondedAt" TIMESTAMP(3);

-- Set existing records to ACTIVE (they are already working connections)
UPDATE "PriceAssignment" SET "status" = 'ACTIVE' WHERE "status" = 'PENDING';

-- CreateIndex
CREATE INDEX "PriceAssignment_status_idx" ON "PriceAssignment"("status");
