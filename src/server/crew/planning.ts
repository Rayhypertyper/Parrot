import { randomUUID } from 'node:crypto'
import type { CrewRequest as RequestRow, Prisma } from '@prisma/client'
import type { CrewMember, CrewOffer, RetryPlanResult } from '../../shared/crew/index'
import { planningReset } from './commands'
import { conflict, notFound } from './input'
import { crewTransaction, planLeaseMs, type CrewActor, type CrewDatabase, type CrewTransaction } from './store'

interface PlanInput {
  request: Pick<RequestRow, 'id' | 'requesterId' | 'title' | 'latestFact' | 'pickupLocation' | 'destination'>
  revision: number
  newEvent: Prisma.JsonValue
  candidates: CrewMember[]
  priorOffers: Pick<CrewOffer, 'recipientId' | 'status' | 'message'>[]
}

type PlanProposal = { requestId: string; revision: number; message: string } & (
  | { action: 'wait' }
  | { action: 'offer'; memberId: string; pickupLocation?: string; destination?: string }
)

export type Planner = (input: PlanInput) => Promise<unknown>

const messages: Record<RetryPlanResult['result'], string> = {
  offered: 'The handoff was offered.',
  waiting: 'The request is open. No teammate was offered the handoff.',
  failed: 'The request is saved. Try planning again.',
  planning: 'Crew Radio is already looking for help.',
  superseded: 'The crew changed while planning. Refresh the feed.',
}

function result(requestId: string, status: RetryPlanResult['result']): RetryPlanResult {
  return { requestId, result: status, message: messages[status] }
}

function readProposal(value: unknown, input: PlanInput): PlanProposal {
  if (!value || typeof value !== 'object') throw new Error('Invalid planner response')
  const body = value as Record<string, unknown>
  const { message, action, memberId } = body
  const { id: requestId } = input.request
  const { revision } = input
  if (body.requestId !== requestId || body.revision !== revision ||
      typeof message !== 'string' || !message.trim() || message.length > 500 || message.includes('\0')) {
    throw new Error('Invalid planner response')
  }
  if (action === 'wait') return { action, requestId, revision, message }
  if (action !== 'offer' || typeof memberId !== 'string' || !input.candidates.some(({ id }) => id === memberId)) {
    throw new Error('Invalid planner decision')
  }
  return {
    action, requestId, revision, memberId, message: message.trim(),
    pickupLocation: exactQuote(body.pickupLocation, input.request.latestFact, input.request.pickupLocation),
    destination: exactQuote(body.destination, input.request.title, input.request.destination, input.request.latestFact),
  }
}

function exactQuote(value: unknown, ...sources: Array<string | null>): string | undefined {
  if (typeof value === 'string' && value.trim() && value.length <= 500 &&
      sources.some((source) => source?.includes(value))) return value
}

function offerWithFacts(request: RequestRow, proposal: Extract<PlanProposal, { action: 'offer' }>) {
  const pickupLocation = proposal.pickupLocation ?? request.pickupLocation
  const destination = request.destination ?? proposal.destination
  const parts = [proposal.message]
  if (pickupLocation && !proposal.message.includes(pickupLocation)) parts.push(`Pickup: ${pickupLocation}`)
  const note = request.latestFact
  if (note && !proposal.message.includes(note) && (!pickupLocation || !note.includes(pickupLocation))) {
    parts.push(`Latest handoff note: ${note}`)
  }
  if (!proposal.message.includes(destination ?? request.title)) {
    parts.push(destination ? `Destination: ${destination}` : `Request: ${request.title}`)
  }
  return { message: parts.join('\n'), pickupLocation, destination }
}

function eligibleMembers(tx: CrewTransaction, request: RequestRow, memberId?: string) {
  return tx.crewMember.findMany({
    where: {
      id: { equals: memberId, not: request.requesterId },
      crewId: request.crewId,
      availability: 'available',
      offers: { none: { OR: [
        { releasedAt: null, status: { in: ['pending', 'accepted'] } },
        { requestId: request.id, status: { in: ['declined', 'accepted'] } },
      ] } },
    },
    select: { id: true, name: true, location: true, availability: true, skills: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
}

export async function planRequest(
  db: CrewDatabase, actor: CrewActor, requestId: string, planner: Planner,
  newEvent?: Prisma.JsonValue, explicit = false,
): Promise<RetryPlanResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = await crewTransaction(db, actor.crewId, async (tx) => {
      const request = await tx.crewRequest.findFirst({ where: { id: requestId, crewId: actor.crewId } })
      if (!request) notFound('Request was not found.')
      if (request.status !== 'open') {
        if (explicit && attempt === 0) conflict('Only an open request can be planned.')
        return result(requestId, 'superseded')
      }
      if (request.planningStatus === 'planning' && request.planStartedAt &&
          Date.now() - +request.planStartedAt < planLeaseMs && newEvent === undefined) {
        return result(requestId, 'planning')
      }
      const candidates = await eligibleMembers(tx, request)
      if (!candidates.length) {
        await setPlanningStatus(tx, requestId, 'waiting')
        return result(requestId, 'waiting')
      }
      const priorOffers = await tx.crewOffer.findMany({
        where: { requestId }, orderBy: { createdAt: 'asc' },
        select: { recipientId: true, status: true, message: true },
      })
      const latest = newEvent ?? (await tx.crewEventRecord.findFirst({
        where: { requestId }, orderBy: { createdAt: 'desc' }, select: { command: true },
      }))?.command ?? null
      const planAttemptId = randomUUID()
      await tx.crewRequest.update({
        where: { id: requestId },
        data: { planAttemptId, planStartedAt: new Date(), planningStatus: 'planning' },
      })
      const { id, requesterId, title, latestFact, pickupLocation, destination, revision } = request
      const input: PlanInput = {
        request: { id, requesterId, title, latestFact, pickupLocation, destination },
        revision, newEvent: latest, candidates, priorOffers,
      }
      return { planAttemptId, input }
    })
    if (!('input' in started)) return started

    const { input, planAttemptId } = started
    let proposal: PlanProposal | undefined
    try {
      proposal = readProposal(await planner(input), input)
    } catch {
      console.warn('Crew planner failed', { requestId, revision: input.revision })
    }
    const outcome = await crewTransaction(db, actor.crewId, async (tx) => {
      const request = await tx.crewRequest.findFirst({ where: { id: requestId, crewId: actor.crewId } })
      if (!request || request.status !== 'open' || request.revision !== input.revision ||
          request.planAttemptId !== planAttemptId) return 'superseded'
      if (!proposal || proposal.action === 'wait') {
        const status = proposal ? 'waiting' : 'failed'
        await setPlanningStatus(tx, requestId, status)
        return status
      }
      const [member] = await eligibleMembers(tx, request, proposal.memberId)
      if (!member) {
        await setPlanningStatus(tx, requestId, 'waiting')
        return 'candidate_changed'
      }
      const { message, pickupLocation, destination } = offerWithFacts(request, proposal)
      await tx.crewOffer.create({ data: { requestId, recipientId: member.id, message } })
      await tx.crewRequest.update({
        where: { id: requestId },
        data: { ...planningReset, status: 'offered', revision: { increment: 1 }, pickupLocation, destination },
      })
      await tx.crewActivity.create({
        data: { crewId: actor.crewId, requestId, actorName: 'Crew Radio', summary: `Offered the handoff to ${member.name}.` },
      })
      return 'offered'
    })
    if (outcome !== 'candidate_changed') return result(requestId, outcome)
  }
  return result(requestId, 'waiting')
}

function setPlanningStatus(tx: CrewTransaction, id: string, planningStatus: 'waiting' | 'failed') {
  return tx.crewRequest.update({ where: { id }, data: { ...planningReset, planningStatus } })
}

export const maritimePlanner: Planner = async (input) => {
  const url = process.env.CREW_PLANNER_URL
  const token = process.env.CREW_PLANNER_TOKEN
  if (!url || !token) throw new Error('Planner is not configured')
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(22_000),
    redirect: 'error',
  })
  if (!response.ok) {
    console.warn('Crew planner returned an HTTP error', { status: response.status })
    throw new Error('Planner refused the request')
  }
  return response.json()
}
