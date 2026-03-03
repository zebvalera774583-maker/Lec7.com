-- Add department to IncomingRequest (bot requests from MAX/Telegram)
ALTER TABLE "IncomingRequest" ADD COLUMN "department" TEXT;

-- Add department to MaxRequestLink
ALTER TABLE "MaxRequestLink" ADD COLUMN "department" TEXT;
