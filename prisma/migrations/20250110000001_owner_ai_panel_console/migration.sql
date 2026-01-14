-- CreateTable
CREATE TABLE "OwnerConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnerConversation_userId_idx" ON "OwnerConversation"("userId");

-- CreateIndex
CREATE INDEX "OwnerMessage_conversationId_idx" ON "OwnerMessage"("conversationId");

-- AddForeignKey
ALTER TABLE "OwnerConversation" ADD CONSTRAINT "OwnerConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerMessage" ADD CONSTRAINT "OwnerMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "OwnerConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
