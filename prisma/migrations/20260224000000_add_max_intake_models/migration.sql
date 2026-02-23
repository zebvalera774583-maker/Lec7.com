-- CreateEnum
CREATE TYPE "MaxMessageDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "MaxRequestLinkStatus" AS ENUM ('DRAFT', 'NEED_DETAILS', 'READY');

-- CreateTable
CREATE TABLE "MaxIntegration" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaxIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaxConversation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "externalChatId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaxConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaxMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MaxMessageDirection" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaxRequestLink" (
    "id" TEXT NOT NULL,
    "maxConversationId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" "MaxRequestLinkStatus" NOT NULL DEFAULT 'DRAFT',
    "itemsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaxRequestLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaxIntegration_businessId_key" ON "MaxIntegration"("businessId");

-- CreateIndex
CREATE INDEX "MaxIntegration_businessId_idx" ON "MaxIntegration"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "MaxConversation_businessId_externalChatId_key" ON "MaxConversation"("businessId", "externalChatId");

-- CreateIndex
CREATE INDEX "MaxConversation_businessId_idx" ON "MaxConversation"("businessId");

-- CreateIndex
CREATE INDEX "MaxConversation_externalChatId_idx" ON "MaxConversation"("externalChatId");

-- CreateIndex
CREATE UNIQUE INDEX "MaxMessage_conversationId_idempotencyKey_key" ON "MaxMessage"("conversationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MaxMessage_conversationId_idx" ON "MaxMessage"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "MaxRequestLink_maxConversationId_key" ON "MaxRequestLink"("maxConversationId");

-- CreateIndex
CREATE INDEX "MaxRequestLink_requestId_idx" ON "MaxRequestLink"("requestId");

-- AddForeignKey
ALTER TABLE "MaxIntegration" ADD CONSTRAINT "MaxIntegration_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaxConversation" ADD CONSTRAINT "MaxConversation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaxMessage" ADD CONSTRAINT "MaxMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MaxConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaxRequestLink" ADD CONSTRAINT "MaxRequestLink_maxConversationId_fkey" FOREIGN KEY ("maxConversationId") REFERENCES "MaxConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
