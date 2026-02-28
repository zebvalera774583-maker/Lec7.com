-- MAX/Telegram request diagnostic: request + incomingRequestId + items_cnt
SELECT r.id, r.number, r.title, ir.id AS incoming_id, COUNT(iri.id) AS items_cnt
FROM "Request" r
LEFT JOIN "IncomingRequest" ir ON ir."requestId" = r.id
LEFT JOIN "IncomingRequestItem" iri ON iri."requestId" = ir.id
WHERE r.source = 'max_integration'
GROUP BY r.id, ir.id;
