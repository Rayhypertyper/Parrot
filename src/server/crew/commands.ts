import type { CrewMember, CrewRequest, Prisma } from '@prisma/client'
import type { CrewCommand, CrewEventResult } from '../../shared/crew/index'
import { conflict, CrewError, notFound } from './input'
import type { CrewActor, CrewTransaction } from './store'

export const planningReset = { planningStatus: 'idle', planAttemptId: null, planStartedAt: null } as const

const staleOffer = 'This offer is no longer active. Refresh the feed.'
const staleRequest = 'This handoff has changed. Refresh the feed.'

interface Mutation {
  requestId?: string
  message: string
  summary: string
  plan: string[]
}

export interface RecordedCommand {
  response: CrewEventResult
  plan: string[]
}

function sameCommand(previous: Prisma.JsonValue, command: Prisma.InputJsonObject): boolean {
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) return false
  const keys = Object.keys(command)
  return keys.length === Object.keys(previous).length && keys.every((key) => previous[key] === command[key])
}

export async function recordCommand(
  tx: CrewTransaction, actor: CrewActor, eventId: string, command: CrewCommand,
): Promise<RecordedCommand> {
  const member = await tx.crewMember.findUniqueOrThrow({ where: { id: actor.id } })
  if (member.archivedAt) throw new CrewError(401, 'unauthorized', 'Join the crew to continue.')
  const previous = await tx.crewEventRecord.findUnique({
    where: { memberId_eventId: { memberId: actor.id, eventId } },
  })
  const serialized = JSON.parse(JSON.stringify(command)) as Prisma.InputJsonObject
  if (previous) {
    if (!sameCommand(previous.command, serialized)) conflict('This event ID has already been used for another update.')
    return {
      response: { eventId, requestId: previous.requestId ?? undefined, result: 'applied', message: previous.message },
      plan: [],
    }
  }

  const { requestId, message, summary, plan } = await applyCommand(tx, member, command)
  await tx.crewEventRecord.create({
    data: { eventId, memberId: member.id, requestId, command: serialized, message, createdAt: new Date() },
  })
  await tx.crewActivity.create({
    data: { crewId: member.crewId, requestId, actorName: member.name, summary },
  })
  return { response: { eventId, requestId, result: 'applied', message }, plan }
}

async function applyCommand(tx: CrewTransaction, member: CrewMember, command: CrewCommand): Promise<Mutation> {
  switch (command.kind) {
    case 'request_help': {
      const request = await tx.crewRequest.create({
        data: { crewId: member.crewId, requesterId: member.id, title: command.text, destination: command.location },
      })
      return { requestId: request.id, message: 'Request recorded.', summary: command.text, plan: [request.id] }
    }
    case 'availability_update':
      return changeAvailability(tx, member, command)
    case 'accept':
    case 'decline':
      return replyToOffer(tx, member, command)
    case 'blocked':
    case 'report_delivery':
    case 'confirm_receipt':
      return updateHandoff(tx, member, command)
  }
}

async function changeAvailability(
  tx: CrewTransaction, member: CrewMember, command: Extract<CrewCommand, { kind: 'availability_update' }>,
): Promise<Mutation> {
  if (member.availability === 'protected' && command.availability) {
    conflict('You are covering a protected post. A crew lead must change that assignment.')
  }
  await tx.crewMember.update({
    where: { id: member.id },
    data: { availability: command.availability, location: command.location },
  })
  const plan: string[] = []
  if (command.availability === 'busy') {
    const offer = await tx.crewOffer.findFirst({
      where: { recipientId: member.id, status: 'pending', releasedAt: null, request: { archivedAt: null } },
      include: { request: true },
    })
    if (offer && await releasePendingOffer(tx, offer, 'withdrawn')) plan.push(offer.requestId)
  }
  if (command.availability === 'available') {
    const open = await tx.crewRequest.findMany({
      where: { crewId: member.crewId, status: 'open', archivedAt: null }, select: { id: true },
    })
    plan.push(...open.map(({ id }) => id))
  }
  const details = [
    command.availability && `Availability: ${command.availability}`,
    command.location && `Location: ${command.location}`,
    command.text,
  ].filter(Boolean)
  return { message: 'Availability or location updated.', summary: details.join(' · '), plan }
}

async function replyToOffer(
  tx: CrewTransaction, member: CrewMember, command: Extract<CrewCommand, { kind: 'accept' | 'decline' }>,
): Promise<Mutation> {
  const offer = await tx.crewOffer.findFirst({
    where: { id: command.offerId, recipientId: member.id, request: { crewId: member.crewId } },
    include: { request: true },
  })
  if (!offer || (command.requestId && command.requestId !== offer.requestId)) notFound('Offer was not found.')
  const request = offer.request
  if (offer.status !== 'pending' || offer.releasedAt || request.archivedAt || request.status !== 'offered') conflict(staleOffer)

  if (command.kind === 'accept') {
    if (member.availability !== 'available' || member.id === request.requesterId) conflict(staleOffer)
    await tx.crewOffer.update({ where: { id: offer.id }, data: { status: 'accepted' } })
    await tx.crewOffer.updateMany({
      where: { requestId: request.id, status: 'pending', releasedAt: null },
      data: { status: 'withdrawn', releasedAt: new Date() },
    })
    await tx.crewRequest.update({
      where: { id: request.id },
      data: { status: 'in_progress', assigneeId: member.id, revision: { increment: 1 } },
    })
    return { requestId: request.id, message: 'Handoff accepted.', summary: 'Accepted the handoff.', plan: [] }
  }

  const needsPlan = await releasePendingOffer(tx, offer, 'declined', command.text, command.location)
  return {
    requestId: request.id,
    message: needsPlan ? 'Decline recorded. The request is open for another teammate.' : 'Decline recorded.',
    summary: reportSummary('Declined the handoff.', command.text, command.location),
    plan: needsPlan ? [request.id] : [],
  }
}

async function releasePendingOffer(
  tx: CrewTransaction, offer: { id: string; request: CrewRequest }, status: 'declined' | 'withdrawn',
  text?: string, location?: string,
) {
  const { request } = offer
  await tx.crewOffer.update({ where: { id: offer.id }, data: { status, releasedAt: new Date() } })
  const other = await tx.crewOffer.findFirst({
    where: { requestId: request.id, status: 'pending', releasedAt: null }, select: { id: true },
  })
  if (!other) {
    await reopen(tx, request, text, location)
    return true
  }
  if (text || location) {
    await tx.crewRequest.update({
      where: { id: request.id },
      data: { revision: { increment: 1 }, latestFact: text ?? location, pickupLocation: location },
    })
  }
  return false
}

function reopen(tx: CrewTransaction, request: CrewRequest, text?: string, location?: string) {
  return tx.crewRequest.update({
    where: { id: request.id },
    data: {
      ...planningReset, revision: { increment: 1 }, status: 'open', assigneeId: null,
      latestFact: text ?? location, pickupLocation: location,
    },
  })
}

function reportSummary(action: string, text?: string, location?: string): string {
  return [action, text, location && !text?.includes(location) ? `Pickup: ${location}` : undefined].filter(Boolean).join(' ')
}

async function updateHandoff(
  tx: CrewTransaction,
  member: CrewMember,
  command: Extract<CrewCommand, { kind: 'blocked' | 'report_delivery' | 'confirm_receipt' }>,
): Promise<Mutation> {
  const request = await tx.crewRequest.findFirst({
    where: { id: command.requestId, crewId: member.crewId, archivedAt: null },
  })
  if (!request) notFound('Request was not found.')
  const confirms = command.kind === 'confirm_receipt'
  if (member.id !== (confirms ? request.requesterId : request.assigneeId)) conflict(staleRequest)
  if (request.status !== 'in_progress' && !(confirms && request.status === 'awaiting_confirmation')) conflict(staleRequest)
  const offer = await tx.crewOffer.findFirst({
    where: { requestId: request.id, recipientId: request.assigneeId ?? '', status: 'accepted' },
  })
  if (!offer || (command.offerId && command.offerId !== offer.id)) conflict(staleRequest)

  if (!offer.releasedAt) {
    await tx.crewOffer.update({ where: { id: offer.id }, data: { releasedAt: new Date() } })
  }
  if (command.kind === 'blocked') {
    await reopen(tx, request, command.text, command.location)
    return {
      requestId: request.id, message: 'Blocker recorded. The request is open for another teammate.',
      summary: reportSummary('Reported a blocker.', command.text, command.location), plan: [request.id],
    }
  }

  await tx.crewRequest.update({
    where: { id: request.id },
    data: { status: confirms ? 'done' : 'awaiting_confirmation', revision: { increment: 1 } },
  })
  const message = confirms ? 'Receipt confirmed.' : 'Delivery recorded. The requester can confirm receipt.'
  const summary = [confirms ? 'Confirmed receipt.' : 'Reported delivery.', command.text].filter(Boolean).join(' ')
  return { requestId: request.id, message, summary, plan: [] }
}
