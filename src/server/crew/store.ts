import { createHash, randomBytes } from 'node:crypto'
import type { CrewMember as MemberRow, Prisma, PrismaClient } from '@prisma/client'
import type {
  CrewFeed, CrewJoinInput, CrewMember, CrewSession,
} from '../../shared/crew/index'
import { CrewError, notFound } from './input'

export const planLeaseMs = 30_000

export type CrewDatabase = PrismaClient
export type CrewTransaction = Prisma.TransactionClient
export type CrewActor = Pick<MemberRow, 'id' | 'crewId'>

export function secretToken(): string {
  return randomBytes(32).toString('base64url')
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function crewTransaction<T>(db: CrewDatabase, crewId: string, run: (tx: CrewTransaction) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Crew" WHERE id = ${crewId} FOR UPDATE`
    return run(tx)
  }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 })
}

export async function joinCrew(db: CrewDatabase, input: CrewJoinInput): Promise<CrewSession> {
  const crew = await db.crew.findUnique({ where: { code: input.crewCode.toLowerCase() } })
  if (!crew) notFound('Crew code was not found.')
  return crewTransaction(db, crew.id, async (tx) => {
    const member = await tx.crewMember.findUnique({
      where: { crewId_profileCode: { crewId: crew.id, profileCode: input.profileCode.toLowerCase() } },
    })
    if (!member || member.archivedAt) notFound('Choose a profile in this crew.')
    if (member.sessionHash) throw new CrewError(409, 'profile_taken', 'That profile is already claimed. Choose another.')
    const memberToken = secretToken()
    await tx.crewMember.update({
      where: { id: member.id }, data: { sessionHash: tokenHash(memberToken), lastSeenAt: new Date() },
    })
    return { memberToken, memberId: member.id, crewId: crew.id }
  })
}

export async function getMember(db: CrewDatabase, header: string | undefined): Promise<MemberRow> {
  const token = /^Bearer ([\w-]{43})$/i.exec(header ?? '')?.[1]
  const member = token && await db.crewMember.findUnique({ where: { sessionHash: tokenHash(token) } })
  if (!member || member.archivedAt) throw new CrewError(401, 'unauthorized', 'Join the crew to continue.')
  return member
}

const memberFields = { id: true, name: true, location: true, availability: true, skills: true } as const

export async function getFeed(db: CrewDatabase, actor: CrewActor): Promise<CrewFeed> {
  const seenAt = new Date()
  // Track polling separately from the timestamp for member and activity changes.
  await db.$executeRaw`
    UPDATE "CrewMember" SET "lastSeenAt" = ${seenAt}
    WHERE "id" = ${actor.id}
      AND "archivedAt" IS NULL
      AND ("lastSeenAt" IS NULL OR "lastSeenAt" < ${new Date(+seenAt - 10_000)})
  `
  return db.$transaction(async (tx) => {
    const members = await tx.crewMember.findMany({
      where: { crewId: actor.crewId },
      select: { ...memberFields, updatedAt: true, archivedAt: true },
      orderBy: { name: 'asc' },
    })
    const requests = await tx.crewRequest.findMany({
      where: { crewId: actor.crewId, archivedAt: null },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    })
    const myOffers = await tx.crewOffer.findMany({
      where: { request: { crewId: actor.crewId, archivedAt: null }, recipientId: actor.id },
      select: { id: true, requestId: true, recipientId: true, status: true, message: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 30,
    })
    const activity = await tx.crewActivity.findMany({
      where: { crewId: actor.crewId },
      select: { id: true, requestId: true, at: true, actorName: true, summary: true },
      orderBy: [{ at: 'desc' }, { id: 'asc' }], take: 40,
    })
    const memberDtos: CrewMember[] = members.map(({ updatedAt: _updatedAt, archivedAt, ...member }) => ({
      ...member,
      ...(archivedAt ? { archived: true } : {}),
    }))
    const me = memberDtos.find(({ id }) => id === actor.id)
    if (!me || me.archived) throw new CrewError(401, 'unauthorized', 'Join the crew to continue.')
    const updatedAt = Math.max(
      ...members.map((member) => +member.updatedAt),
      +(requests[0]?.updatedAt ?? 0),
      +(activity[0]?.at ?? 0),
    )
    const now = Date.now()
    return {
      me,
      members: memberDtos,
      requests: requests.map((request) => ({
        id: request.id, title: request.title, requesterId: request.requesterId, status: request.status,
        ...(request.allHands ? { allHands: true as const } : {}),
        revision: request.revision, assigneeId: request.assigneeId, latestFact: request.latestFact,
        pickupLocation: request.pickupLocation, destination: request.destination,
        planningStatus: request.planningStatus === 'planning' && request.planStartedAt &&
          now - +request.planStartedAt >= planLeaseMs ? 'failed' : request.planningStatus,
        updatedAt: request.updatedAt.toISOString(),
      })),
      myOffers,
      activity: activity.map(({ at, ...item }) => ({ ...item, at: at.toISOString() })),
      updatedAt: new Date(updatedAt).toISOString(),
    }
  }, { isolationLevel: 'RepeatableRead' })
}
