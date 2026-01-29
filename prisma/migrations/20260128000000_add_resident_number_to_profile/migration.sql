-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN "residentNumber" TEXT;

-- CreateIndex/Constraint
CREATE UNIQUE INDEX "BusinessProfile_residentNumber_key" ON "BusinessProfile"("residentNumber");

