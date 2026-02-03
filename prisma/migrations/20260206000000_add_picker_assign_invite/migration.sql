-- CreateEnum
CREATE TYPE "PerformerRole" AS ENUM ('PICKER');

-- CreateTable
CREATE TABLE "PickerInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PickerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestAssignment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "role" "PerformerRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "inviteId" TEXT,

    CONSTRAINT "RequestAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PickerInvite_token_key" ON "PickerInvite"("token");

-- CreateIndex
CREATE INDEX "PickerInvite_requestId_idx" ON "PickerInvite"("requestId");

-- CreateIndex
CREATE INDEX "PickerInvite_token_idx" ON "PickerInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RequestAssignment_requestId_role_key" ON "RequestAssignment"("requestId", "role");

-- CreateIndex
CREATE INDEX "RequestAssignment_requestId_idx" ON "RequestAssignment"("requestId");

-- CreateIndex
CREATE INDEX "RequestAssignment_createdByUserId_idx" ON "RequestAssignment"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestAssignment_inviteId_key" ON "RequestAssignment"("inviteId");

-- AddForeignKey
ALTER TABLE "PickerInvite" ADD CONSTRAINT "PickerInvite_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickerInvite" ADD CONSTRAINT "PickerInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAssignment" ADD CONSTRAINT "RequestAssignment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAssignment" ADD CONSTRAINT "RequestAssignment_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "PickerInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAssignment" ADD CONSTRAINT "RequestAssignment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
