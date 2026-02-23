-- AlterTable
ALTER TABLE "IncomingRequest" ADD COLUMN "requestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "IncomingRequest_requestId_key" ON "IncomingRequest"("requestId");

-- AddForeignKey
ALTER TABLE "IncomingRequest" ADD CONSTRAINT "IncomingRequest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
