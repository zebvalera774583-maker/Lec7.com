-- Backfill PriceListRow.masterItemId for rows where name matches canonicalName or synonym
-- (same logic as rematch, but runs once for all rows)
WITH cat AS (
  SELECT id, lower(regexp_replace(regexp_replace(trim("canonicalName"), E'[.,;:()\\[\\]{}"''`]', '', 'g'), E'\\s+', ' ', 'g')) AS norm
  FROM "BotCatalogItem"
  WHERE scope = 'GLOBAL'
  UNION ALL
  SELECT b.id, lower(regexp_replace(regexp_replace(trim(s), E'[.,;:()\\[\\]{}"''`]', '', 'g'), E'\\s+', ' ', 'g')) AS norm
  FROM "BotCatalogItem" b, unnest(b.synonyms) AS s
  WHERE b.scope = 'GLOBAL'
),
map AS (
  SELECT norm, max(id) AS id
  FROM cat
  WHERE norm IS NOT NULL AND norm <> ''
  GROUP BY norm
  HAVING count(DISTINCT id) = 1
),
candidate_rows AS (
  SELECT r.id, lower(regexp_replace(regexp_replace(trim(r.name), E'[.,;:()\\[\\]{}"''`]', '', 'g'), E'\\s+', ' ', 'g')) AS norm
  FROM "PriceListRow" r
  WHERE r."masterItemId" IS NULL
    AND trim(r.name) <> ''
)
UPDATE "PriceListRow" r
SET "masterItemId" = m.id
FROM candidate_rows cr
JOIN map m ON m.norm = cr.norm
WHERE r.id = cr.id;
