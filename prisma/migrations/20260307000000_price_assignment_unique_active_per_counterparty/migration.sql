-- Partial unique index: at most one ACTIVE PriceAssignment per counterparty.
-- Fails to create if duplicates already exist (same counterpartyBusinessId, multiple ACTIVE).

CREATE UNIQUE INDEX "PriceAssignment_counterpartyBusinessId_active_key"
ON "PriceAssignment" ("counterpartyBusinessId")
WHERE "status" = 'ACTIVE'::"PartnerLinkStatus";
