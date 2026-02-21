-- CreateTable
CREATE TABLE "MaxChatContext" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaxChatContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaxChatContext_chatId_key" ON "MaxChatContext"("chatId");

-- CreateIndex
CREATE INDEX "MaxChatContext_chatId_idx" ON "MaxChatContext"("chatId");

-- CreateIndex
CREATE INDEX "MaxChatContext_businessId_idx" ON "MaxChatContext"("businessId");

-- AddForeignKey
ALTER TABLE "MaxChatContext" ADD CONSTRAINT "MaxChatContext_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
