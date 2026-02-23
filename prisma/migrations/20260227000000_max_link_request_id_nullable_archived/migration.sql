-- Add ARCHIVED to MaxRequestLinkStatus enum
ALTER TYPE "MaxRequestLinkStatus" ADD VALUE 'ARCHIVED';

-- Make requestId nullable (NEED_DETAILS has no Request yet)
ALTER TABLE "MaxRequestLink" ALTER COLUMN "requestId" DROP NOT NULL;

-- Drop unique constraint on maxConversationId (allow multiple links per conversation)
DROP INDEX IF EXISTS "MaxRequestLink_maxConversationId_key";

-- Add non-unique index for querying by conversation
CREATE INDEX "MaxRequestLink_maxConversationId_idx" ON "MaxRequestLink"("maxConversationId");
