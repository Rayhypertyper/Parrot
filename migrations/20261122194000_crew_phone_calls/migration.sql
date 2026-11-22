CREATE TYPE "CrewPhoneCallStatus" AS ENUM ('queued', 'dialing', 'submitted', 'ended');

DROP INDEX "CrewOffer_active_request_key";
CREATE UNIQUE INDEX "CrewOffer_active_assignment_key" ON "CrewOffer" ("requestId")
  WHERE "releasedAt" IS NULL AND "status" = 'accepted';

ALTER TABLE "CrewVoiceTicket" ALTER COLUMN "conversationId" DROP NOT NULL;

CREATE TABLE "CrewPhoneCall" (
    "offerId" TEXT NOT NULL,
    "status" "CrewPhoneCallStatus" NOT NULL DEFAULT 'queued',
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrewPhoneCall_pkey" PRIMARY KEY ("offerId")
);

CREATE UNIQUE INDEX "CrewPhoneCall_ticketId_key" ON "CrewPhoneCall"("ticketId");
CREATE INDEX "CrewPhoneCall_status_createdAt_idx" ON "CrewPhoneCall"("status", "createdAt");
ALTER TABLE "CrewPhoneCall" ADD CONSTRAINT "CrewPhoneCall_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "CrewOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrewPhoneCall" ADD CONSTRAINT "CrewPhoneCall_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "CrewVoiceTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
