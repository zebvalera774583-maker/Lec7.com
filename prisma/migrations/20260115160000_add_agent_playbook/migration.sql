-- CreateTable
CREATE TABLE "AgentPlaybookItem" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "businessId" TEXT,
    "title" TEXT NOT NULL,
    "move" TEXT NOT NULL,
    "context" TEXT,
    "outcome" TEXT,
    "confidence" TEXT NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPlaybookItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentPlaybookItem_scope_idx" ON "AgentPlaybookItem"("scope");

-- CreateIndex
CREATE INDEX "AgentPlaybookItem_businessId_idx" ON "AgentPlaybookItem"("businessId");

-- CreateIndex
CREATE INDEX "AgentPlaybookItem_confidence_idx" ON "AgentPlaybookItem"("confidence");
