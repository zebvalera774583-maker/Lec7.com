-- CreateTable
CREATE TABLE "ReceiverInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "ReceiverInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceiverInvite_token_key" ON "ReceiverInvite"("token");

-- CreateIndex
CREATE INDEX "ReceiverInvite_token_idx" ON "ReceiverInvite"("token");
