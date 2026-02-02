-- AlterTable
ALTER TABLE "Business" ADD COLUMN "telegramChatId" VARCHAR(32),
ADD COLUMN "telegramConnectedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TelegramConnectToken" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "TelegramConnectToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramConnectToken_token_key" ON "TelegramConnectToken"("token");

-- CreateIndex
CREATE INDEX "TelegramConnectToken_businessId_idx" ON "TelegramConnectToken"("businessId");

-- CreateIndex
CREATE INDEX "TelegramConnectToken_token_idx" ON "TelegramConnectToken"("token");

-- CreateIndex
CREATE INDEX "TelegramConnectToken_expiresAt_idx" ON "TelegramConnectToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "TelegramConnectToken" ADD CONSTRAINT "TelegramConnectToken_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
