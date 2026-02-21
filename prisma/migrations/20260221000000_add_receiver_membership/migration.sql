-- CreateTable
CREATE TABLE "ReceiverMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiverMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceiverMembership_userId_businessId_key" ON "ReceiverMembership"("userId", "businessId");

-- CreateIndex
CREATE INDEX "ReceiverMembership_userId_idx" ON "ReceiverMembership"("userId");

-- CreateIndex
CREATE INDEX "ReceiverMembership_businessId_idx" ON "ReceiverMembership"("businessId");

-- AddForeignKey
ALTER TABLE "ReceiverMembership" ADD CONSTRAINT "ReceiverMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiverMembership" ADD CONSTRAINT "ReceiverMembership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiverMembership" ADD CONSTRAINT "ReceiverMembership_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: create ReceiverMembership for legacy users with role=RECEIVER and receiverBusinessId
INSERT INTO "ReceiverMembership" ("id", "userId", "businessId", "createdAt")
SELECT gen_random_uuid()::text, "id", "receiverBusinessId", NOW()
FROM "User"
WHERE "receiverBusinessId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ReceiverMembership" rm
    WHERE rm."userId" = "User"."id" AND rm."businessId" = "User"."receiverBusinessId"
  );
