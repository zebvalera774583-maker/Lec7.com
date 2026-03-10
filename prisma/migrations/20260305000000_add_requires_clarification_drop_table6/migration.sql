-- AlterTable: add requiresClarification and clarificationOptions to BotCatalogItem
ALTER TABLE "BotCatalogItem" ADD COLUMN "requiresClarification" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BotCatalogItem" ADD COLUMN "clarificationOptions" TEXT[] NOT NULL DEFAULT '{}';

-- DropTable: remove Table 6 (ClarificationQuestion)
DROP TABLE IF EXISTS "ClarificationQuestion";
