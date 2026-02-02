-- AlterTable: extend TelegramConnectToken with mode and label
ALTER TABLE "TelegramConnectToken" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'set_primary';
ALTER TABLE "TelegramConnectToken" ADD COLUMN "label" TEXT;

-- CreateTable: BusinessTelegramRecipient
CREATE TABLE "BusinessTelegramRecipient" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "chatId" VARCHAR(32) NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessTelegramRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessTelegramRecipient_businessId_chatId_key" ON "BusinessTelegramRecipient"("businessId", "chatId");

-- CreateIndex
CREATE INDEX "BusinessTelegramRecipient_businessId_idx" ON "BusinessTelegramRecipient"("businessId");

-- AddForeignKey
ALTER TABLE "BusinessTelegramRecipient" ADD CONSTRAINT "BusinessTelegramRecipient_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
