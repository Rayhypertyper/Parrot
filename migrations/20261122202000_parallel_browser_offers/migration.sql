ALTER TABLE "CrewMember" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "CrewOffer_active_assignment_key" ON "CrewOffer" ("requestId")
  WHERE "releasedAt" IS NULL AND "status" = 'accepted';
DROP INDEX IF EXISTS "CrewOffer_active_request_key";
