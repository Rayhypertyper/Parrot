-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CrewAvailability" AS ENUM ('available', 'busy', 'protected');

-- CreateEnum
CREATE TYPE "CrewRequestStatus" AS ENUM ('open', 'offered', 'in_progress', 'awaiting_confirmation', 'done');

-- CreateEnum
CREATE TYPE "CrewOfferStatus" AS ENUM ('pending', 'accepted', 'declined', 'withdrawn');

-- CreateEnum
CREATE TYPE "CrewPlanningStatus" AS ENUM ('idle', 'planning', 'waiting', 'failed');

-- CreateTable
CREATE TABLE "Crew" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewMember" (
    "id" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "profileCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "availability" "CrewAvailability" NOT NULL,
    "skills" TEXT[],
    "sessionHash" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrewMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewRequest" (
    "id" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "status" "CrewRequestStatus" NOT NULL DEFAULT 'open',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "latestFact" TEXT,
    "pickupLocation" TEXT,
    "destination" TEXT,
    "planningStatus" "CrewPlanningStatus" NOT NULL DEFAULT 'idle',
    "planAttemptId" TEXT,
    "planStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewOffer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "CrewOfferStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "CrewOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewEventRecord" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "requestId" TEXT,
    "command" JSONB NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrewEventRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewActivity" (
    "id" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "requestId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "CrewActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewVoiceTicket" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "requestId" TEXT,
    "offerId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrewVoiceTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Crew_code_key" ON "Crew"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CrewMember_sessionHash_key" ON "CrewMember"("sessionHash");

-- CreateIndex
CREATE UNIQUE INDEX "CrewMember_crewId_profileCode_key" ON "CrewMember"("crewId", "profileCode");

-- CreateIndex
CREATE INDEX "CrewRequest_crewId_updatedAt_idx" ON "CrewRequest"("crewId", "updatedAt");

-- CreateIndex
CREATE INDEX "CrewOffer_requestId_createdAt_idx" ON "CrewOffer"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "CrewOffer_recipientId_createdAt_idx" ON "CrewOffer"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "CrewEventRecord_requestId_createdAt_idx" ON "CrewEventRecord"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrewEventRecord_memberId_eventId_key" ON "CrewEventRecord"("memberId", "eventId");

-- CreateIndex
CREATE INDEX "CrewActivity_crewId_at_idx" ON "CrewActivity"("crewId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "CrewVoiceTicket_tokenHash_key" ON "CrewVoiceTicket"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "CrewVoiceTicket_conversationId_key" ON "CrewVoiceTicket"("conversationId");

-- CreateIndex
CREATE INDEX "CrewVoiceTicket_expiresAt_idx" ON "CrewVoiceTicket"("expiresAt");

-- AddForeignKey
ALTER TABLE "CrewMember" ADD CONSTRAINT "CrewMember_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewRequest" ADD CONSTRAINT "CrewRequest_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewRequest" ADD CONSTRAINT "CrewRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "CrewMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewRequest" ADD CONSTRAINT "CrewRequest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "CrewMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewOffer" ADD CONSTRAINT "CrewOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CrewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewOffer" ADD CONSTRAINT "CrewOffer_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "CrewMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewEventRecord" ADD CONSTRAINT "CrewEventRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewEventRecord" ADD CONSTRAINT "CrewEventRecord_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CrewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewActivity" ADD CONSTRAINT "CrewActivity_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewActivity" ADD CONSTRAINT "CrewActivity_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CrewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewVoiceTicket" ADD CONSTRAINT "CrewVoiceTicket_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewVoiceTicket" ADD CONSTRAINT "CrewVoiceTicket_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CrewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewVoiceTicket" ADD CONSTRAINT "CrewVoiceTicket_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "CrewOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep one active handoff per request and per recipient until the handoff is released.
CREATE UNIQUE INDEX "CrewOffer_active_request_key" ON "CrewOffer" ("requestId") WHERE "releasedAt" IS NULL AND "status" IN ('pending', 'accepted');
CREATE UNIQUE INDEX "CrewOffer_active_recipient_key" ON "CrewOffer" ("recipientId") WHERE "releasedAt" IS NULL AND "status" IN ('pending', 'accepted');
