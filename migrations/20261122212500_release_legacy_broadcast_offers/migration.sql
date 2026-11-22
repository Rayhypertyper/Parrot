UPDATE "CrewOffer" AS offer
SET "releasedAt" = CURRENT_TIMESTAMP,
    "status" = CASE WHEN offer."status" = 'pending' THEN 'withdrawn'::"CrewOfferStatus" ELSE offer."status" END
FROM "CrewRequest" AS request
WHERE request.id = offer."requestId"
  AND request."allHands"
  AND request."archivedAt" IS NULL
  AND offer."releasedAt" IS NULL
  AND offer."status" IN ('pending', 'accepted');
