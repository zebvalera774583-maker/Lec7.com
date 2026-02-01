-- CreateTable
CREATE TABLE "IncomingRequest" (
    "id" TEXT NOT NULL,
    "senderBusinessId" TEXT NOT NULL,
    "recipientBusinessId" TEXT NOT NULL,
    "category" TEXT,
    "total" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "sum" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IncomingRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncomingRequest_recipientBusinessId_idx" ON "IncomingRequest"("recipientBusinessId");

-- CreateIndex
CREATE INDEX "IncomingRequest_senderBusinessId_idx" ON "IncomingRequest"("senderBusinessId");

-- CreateIndex
CREATE INDEX "IncomingRequestItem_requestId_idx" ON "IncomingRequestItem"("requestId");

-- AddForeignKey
ALTER TABLE "IncomingRequest" ADD CONSTRAINT "IncomingRequest_senderBusinessId_fkey" FOREIGN KEY ("senderBusinessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingRequest" ADD CONSTRAINT "IncomingRequest_recipientBusinessId_fkey" FOREIGN KEY ("recipientBusinessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingRequestItem" ADD CONSTRAINT "IncomingRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "IncomingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
