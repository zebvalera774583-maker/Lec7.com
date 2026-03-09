-- CreateTable
CREATE TABLE "ClarificationSession" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT,
    "department" TEXT,
    "itemsJson" JSONB NOT NULL,
    "pendingItemIndex" INTEGER,
    "needDepartment" BOOLEAN NOT NULL DEFAULT false,
    "needText" TEXT,
    "commentsText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClarificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClarificationSession_chatId_key" ON "ClarificationSession"("chatId");

-- CreateIndex
CREATE INDEX "ClarificationSession_chatId_idx" ON "ClarificationSession"("chatId");
