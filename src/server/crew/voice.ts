import { timingSafeEqual } from 'node:crypto'
import type { CrewMember } from '@prisma/client'
import type { VoiceSessionInput, VoiceSessionResult } from '../../shared/crew/index'
import { recordCommand } from './commands'
import { conflict, CrewError, invalid, notFound, parseCommand } from './input'
import { crewTransaction, secretToken, tokenHash, type CrewDatabase, type CrewTransaction } from './store'

export type ElevenLabsToken = () => Promise<{ token: string; conversationId: string }>

export const getElevenLabsToken: ElevenLabsToken = async () => {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID
  if (!apiKey || !agentId) throw new CrewError(503, 'unavailable', 'Voice is unavailable. You can still send a typed update.')

  try {
    const url = new URL('https://api.elevenlabs.io/v1/convai/conversation/token')
    url.searchParams.set('agent_id', agentId)
    const res = await fetch(url, {
      headers: { 'xi-api-key': apiKey },
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    })
    if (!res.ok) {
      console.warn('ElevenLabs refused a Crew Radio token', { status: res.status })
      throw new Error('Voice token was refused')
    }
    const data = await res.json() as Record<string, unknown>
    if (typeof data.token !== 'string' || !data.token ||
        typeof data.conversation_id !== 'string' || !data.conversation_id) {
      throw new Error('Invalid voice token')
    }
    return { token: data.token, conversationId: data.conversation_id }
  } catch {
    throw new CrewError(503, 'unavailable', 'Voice could not connect. Try again or send a typed update.')
  }
}

async function voiceContext(db: Pick<CrewTransaction, 'crewRequest'>, member: CrewMember, input: VoiceSessionInput) {
  if (!input.requestId && !input.offerId) return {}
  const request = await db.crewRequest.findFirst({
    where: {
      id: input.requestId,
      crewId: member.crewId,
      ...(input.offerId && { offers: { some: { id: input.offerId, recipientId: member.id } } }),
    },
    include: { offers: {
      where: { id: input.offerId, recipientId: member.id, releasedAt: null, status: { in: ['pending', 'accepted'] } },
    } },
  })
  if (!request) notFound('Handoff was not found.')
  const offer = request.offers[0]
  if (input.offerId && (!offer || !['offered', 'in_progress'].includes(request.status))) {
    conflict('This offer is no longer active. Refresh the feed.')
  }
  if (!offer && request.requesterId !== member.id) notFound('Handoff was not found.')
  if (request.status === 'done') conflict('This request is complete. Start a new conversation for another update.')
  return { request, offer }
}

export async function startVoiceSession(
  db: CrewDatabase, member: CrewMember, input: VoiceSessionInput, getToken: ElevenLabsToken,
): Promise<VoiceSessionResult> {
  await voiceContext(db, member, input)
  if (!process.env.ELEVENLABS_WEBHOOK_SECRET) {
    throw new CrewError(503, 'unavailable', 'Voice is unavailable. You can still send a typed update.')
  }
  const { token, conversationId } = await getToken()
  const ticket = secretToken()
  const { request, offer } = await crewTransaction(db, member.crewId, async (tx) => {
    const context = await voiceContext(tx, member, input)
    await tx.crewVoiceTicket.create({
      data: {
        tokenHash: tokenHash(ticket), conversationId, memberId: member.id, requestId: context.request?.id,
        offerId: context.offer?.id, expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    })
    return context
  })
  return {
    conversationToken: token,
    dynamicVariables: {
      secret__crew_ticket: ticket,
      member_name: member.name,
      opening_message: offer?.status === 'pending'
        ? `Hi ${member.name}. ${offer.message}`
        : `Hi ${member.name}. What would you like to tell the crew?`,
      offer_context: offer?.message ?? '',
      request_context: request ? [
        request.title, request.destination && `Destination: ${request.destination}`,
        request.pickupLocation && `Pickup: ${request.pickupLocation}`, request.latestFact,
        `Status: ${request.status}`,
        request.requesterId === member.id ? 'You are speaking with the requester.' : 'You are speaking with the offer recipient.',
      ].filter(Boolean).join('\n') : '',
    },
  }
}

export function authorizeVoiceTool(header: string | undefined) {
  const expected = process.env.ELEVENLABS_WEBHOOK_SECRET
  if (!expected || !header || !timingSafeEqual(Buffer.from(tokenHash(expected)), Buffer.from(tokenHash(header)))) {
    throw new CrewError(401, 'unauthorized', 'Voice tool authentication failed.')
  }
}

export async function recordVoiceTool(
  db: CrewDatabase, token: string | undefined, conversationId: string | undefined, body: Record<string, unknown>,
) {
  const ticket = token && /^[\w-]{43}$/.test(token) && await db.crewVoiceTicket.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { member: { select: { crewId: true, sessionHash: true } } },
  })
  if (!ticket || ticket.conversationId !== conversationId || !ticket.member.sessionHash ||
      +ticket.expiresAt <= Date.now()) {
    throw new CrewError(401, 'unauthorized', 'This voice session is invalid or has expired.')
  }
  if ('requestId' in body || 'offerId' in body || 'memberId' in body || 'eventId' in body) {
    invalid('The voice session supplies the action scope.')
  }
  const globalCommand = body.kind === 'request_help' || body.kind === 'availability_update'
  if (globalCommand === Boolean(ticket.requestId)) conflict('Start a voice session for the action you want to take.')
  const command = parseCommand({ ...body, requestId: ticket.requestId ?? undefined, offerId: ticket.offerId ?? undefined })
  const actor = { id: ticket.memberId, crewId: ticket.member.crewId }
  const recorded = await crewTransaction(db, actor.crewId, (tx) => recordCommand(tx, actor, `voice:${ticket.id}`, command))
  return { actor, command, recorded }
}
