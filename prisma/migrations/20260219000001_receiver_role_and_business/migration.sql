-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BUSINESS_OWNER', 'LEC7_ADMIN', 'RECEIVER');

-- AlterTable User: add receiverBusinessId
ALTER TABLE "User" ADD COLUMN "receiverBusinessId" TEXT;

-- AlterTable User: change role from TEXT to UserRole
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::"UserRole");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'BUSINESS_OWNER'::"UserRole";

-- CreateIndex User
CREATE INDEX "User_receiverBusinessId_idx" ON "User"("receiverBusinessId");

-- AlterTable ReceiverInvite: add businessId and createdById
ALTER TABLE "ReceiverInvite" ADD COLUMN "businessId" TEXT;
ALTER TABLE "ReceiverInvite" ADD COLUMN "createdById" TEXT;

-- Backfill businessId for existing rows (use first business if any)
UPDATE "ReceiverInvite" SET "businessId" = (SELECT id FROM "Business" LIMIT 1) WHERE "businessId" IS NULL;

-- Make businessId NOT NULL (fails if any row still has NULL)
ALTER TABLE "ReceiverInvite" ALTER COLUMN "businessId" SET NOT NULL;

-- CreateIndex ReceiverInvite
CREATE INDEX "ReceiverInvite_businessId_idx" ON "ReceiverInvite"("businessId");

-- AddForeignKey ReceiverInvite -> Business
ALTER TABLE "ReceiverInvite" ADD CONSTRAINT "ReceiverInvite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey ReceiverInvite -> User (createdBy)
ALTER TABLE "ReceiverInvite" ADD CONSTRAINT "ReceiverInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey User -> Business (receiverBusiness)
ALTER TABLE "User" ADD CONSTRAINT "User_receiverBusinessId_fkey" FOREIGN KEY ("receiverBusinessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
