import { releasePendingOffer } from './commands'
import { crewPhoneConfig } from './phoneConfig'
import { maritimePlanner, planRequest, type Planner } from './planning'
import { crewTransaction, secretToken, tokenHash, type CrewDatabase } from './store'
import { voiceTicketLifetimeMs, voiceVariables } from './voice'

const elevenLabs = 'https://api.elevenlabs.io/v1/convai'
type PhoneConfig = NonNullable<ReturnType<typeof crewPhoneConfig>>
type DialInput = {
  config: PhoneConfig
  number: string
  dynamicVariables: ReturnType<typeof voiceVariables>
}

export interface PhoneTransport {
  dial(input: DialInput): Promise<{ conversationId: string } | { rejected: true }>
  hasEnded(config: PhoneConfig, conversationId: string): Promise<boolean>
}

export const elevenLabsPhone: PhoneTransport = {
  async dial({ config, number, dynamicVariables }) {
    const response = await fetch(`${elevenLabs}/twilio/outbound-call`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { 'xi-api-key': config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: config.agentId, agent_phone_number_id: config.phoneNumberId, to_number: number,
        call_recording_enabled: false,
        conversation_initiation_client_data: { dynamic_variables: dynamicVariables },
      }),
    })
    if (!response.ok) {
      console.warn('Parrot phone provider returned an HTTP error', { status: response.status })
      if (response.status >= 400 && response.status < 500 && response.status !== 408) return { rejected: true }
      throw new Error('Unknown phone delivery status')
    }
    const body = await response.json() as { success?: boolean; conversation_id?: string | null }
    if (body.success === false) return { rejected: true }
    if (body.success !== true || typeof body.conversation_id !== 'string' || !body.conversation_id) {
      throw new Error('Unknown phone delivery status')
    }
    return { conversationId: body.conversation_id }
  },
  async hasEnded(config, conversationId) {
    const response = await fetch(`${elevenLabs}/conversations/${encodeURIComponent(conversationId)}`, {
      headers: { 'xi-api-key': config.apiKey }, redirect: 'error', signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return false
    const { status } = await response.json() as { status?: string }
    return status === 'done' || status === 'failed'
  },
}

const callInclude = {
  offer: { include: { recipient: true, request: { include: { crew: { select: { code: true } } } } } },
  ticket: true,
} as const

type PhoneCall = NonNullable<Awaited<ReturnType<typeof readCall>>>

function readCall(db: Pick<CrewDatabase, 'crewPhoneCall'>, offerId: string) {
  return db.crewPhoneCall.findUnique({ where: { offerId }, include: callInclude })
}

const pending = ({ offer }: PhoneCall) =>
  offer.status === 'pending' && !offer.releasedAt && offer.request.status === 'offered'

export async function processCrewPhoneCalls(
  db: CrewDatabase, { transport = elevenLabsPhone, planner = maritimePlanner }: { transport?: PhoneTransport; planner?: Planner } = {},
) {
  const active = await db.crewPhoneCall.findMany({
    where: { status: { in: ['dialing', 'submitted'] } }, include: callInclude, orderBy: { createdAt: 'asc' }, take: 20,
  })
  await Promise.all(active.map(async (call) => {
    try {
      const config = crewPhoneConfig(call.offer.request.crew.code)
      const ended = !pending(call) || (call.ticket && +call.ticket.expiresAt <= Date.now()) ||
        (config && call.ticket?.conversationId && await transport.hasEnded(config, call.ticket.conversationId))
      if (ended) await finishCall(db, call, planner, 'Phone offer closed without a reply.', call.status)
    } catch {
      console.warn('Parrot could not check a phone offer', { offerId: call.offerId })
    }
  }))

  const queued = await db.crewPhoneCall.findMany({
    where: { status: 'queued' }, include: callInclude, orderBy: { createdAt: 'asc' }, take: 20,
  })
  await Promise.all(queued.map(async (call) => {
    try {
      await dialOffer(db, call, transport, planner)
    } catch {
      // The provider may have dialed before its response was lost. A claimed call is never redialed.
      console.warn('Parrot could not confirm a dial attempt', { offerId: call.offerId })
    }
  }))
}

async function dialOffer(db: CrewDatabase, call: PhoneCall, transport: PhoneTransport, planner: Planner) {
  const { crewId } = call.offer.request
  const config = crewPhoneConfig(call.offer.request.crew.code)
  const number = config?.contacts.get(call.offer.recipient.profileCode)
  if (!config || !number || +call.createdAt + voiceTicketLifetimeMs <= Date.now()) {
    await finishCall(db, call, planner, 'Phone offer expired before dialing.', 'queued')
    return
  }
  const token = secretToken()
  const claimed = await crewTransaction(db, crewId, async (tx) => {
    const current = await readCall(tx, call.offerId)
    if (!current || current.status !== 'queued') return
    if (!pending(current)) {
      await tx.crewPhoneCall.update({ where: { offerId: call.offerId }, data: { status: 'ended' } })
      return
    }
    const ticket = await tx.crewVoiceTicket.create({ data: {
      tokenHash: tokenHash(token), memberId: current.offer.recipientId,
      requestId: current.offer.requestId, offerId: current.offerId,
      expiresAt: new Date(Date.now() + voiceTicketLifetimeMs),
    } })
    await tx.crewPhoneCall.update({ where: { offerId: call.offerId }, data: { status: 'dialing', ticketId: ticket.id } })
    return { ticketId: ticket.id, offer: current.offer }
  })
  if (!claimed) return

  const { offer, ticketId } = claimed
  const reply = await transport.dial({ config, number, dynamicVariables: voiceVariables(token, offer.recipient, offer.request, offer) })
  if ('rejected' in reply) {
    await finishCall(db, call, planner, 'Phone provider declined the dial request.', 'dialing')
    return
  }
  await crewTransaction(db, crewId, async (tx) => {
    const ticket = await tx.crewVoiceTicket.findUnique({ where: { id: ticketId } })
    if (!ticket || (ticket.conversationId && ticket.conversationId !== reply.conversationId)) return
    await tx.crewVoiceTicket.update({ where: { id: ticketId }, data: { conversationId: reply.conversationId } })
    const changed = await tx.crewPhoneCall.updateMany({ where: { offerId: call.offerId, status: 'dialing' }, data: { status: 'submitted' } })
    if (changed.count) await tx.crewActivity.create({ data: {
      crewId, requestId: offer.requestId, actorName: 'Parrot', summary: `Started a call to ${offer.recipient.name}.`,
    } })
  })
}

async function finishCall(db: CrewDatabase, call: PhoneCall, planner: Planner, summary: string, expectedStatus: PhoneCall['status']) {
  const actor = { crewId: call.offer.request.crewId, id: call.offer.request.requesterId }
  const needsPlan = await crewTransaction(db, actor.crewId, async (tx) => {
    const current = await readCall(tx, call.offerId)
    if (current?.status !== expectedStatus) return false
    await tx.crewPhoneCall.update({ where: { offerId: call.offerId }, data: { status: 'ended' } })
    if (!pending(current)) return false
    const needsPlan = await releasePendingOffer(tx, current.offer, 'withdrawn')
    await tx.crewActivity.create({ data: {
      crewId: actor.crewId, requestId: current.offer.requestId, actorName: 'Parrot',
      summary: `${current.offer.recipient.name}: ${summary}`,
    } })
    return needsPlan
  })
  if (needsPlan) await planRequest(db, actor, call.offer.requestId, planner)
}
