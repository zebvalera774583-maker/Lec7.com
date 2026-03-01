-- Add commentsText to IncomingRequest for unmapped/non-item lines from bot
ALTER TABLE "IncomingRequest" ADD COLUMN "commentsText" TEXT;
