-- CreateTable
CREATE TABLE "BotChatState" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "stateJson" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotChatState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotChatState_channel_chatId_key" ON "BotChatState"("channel", "chatId");

-- CreateIndex
CREATE INDEX "BotChatState_channel_chatId_idx" ON "BotChatState"("channel", "chatId");
