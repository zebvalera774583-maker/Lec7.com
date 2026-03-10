-- AlterTable: add needQtyUnit to ClarificationSession (ask for qty+unit before department)
ALTER TABLE "ClarificationSession" ADD COLUMN IF NOT EXISTS "needQtyUnit" BOOLEAN NOT NULL DEFAULT false;
