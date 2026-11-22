import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { setTimeout as pause } from 'node:timers/promises'
import { test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import express from 'express'
import type { CrewFeed, CrewSession } from '../../shared/crew/index'
import { createCrewHandlers } from './http'
import { processCrewPhoneCalls, type PhoneTransport } from './phoneCalls'
import type { Planner } from './planning'

const databaseUrl = process.env.CREW_TEST_DATABASE_URL

test('phone offers use independent calls and the first acceptance wins', { skip: !databaseUrl, timeout: 30_000 }, async (t) => {
  const db = new PrismaClient({ datasourceUrl: databaseUrl })
  let testCrewId: string | undefined
  t.after(async () => {
    try {
      if (testCrewId) await db.$transaction([
        db.crewRequest.deleteMany({ where: { crewId: testCrewId } }),
        db.crew.delete({ where: { id: testCrewId } }),
      ])
    } finally {
      await db.$disconnect()
    }
  })
  const crewCode = randomUUID()
  const webhookSecret = randomUUID()
  process.env.ELEVENLABS_WEBHOOK_SECRET = webhookSecret
  process.env.ELEVENLABS_API_KEY = 'test-key'
  process.env.ELEVENLABS_AGENT_ID = 'test-agent'
  process.env.ELEVENLABS_PHONE_NUMBER_ID = 'test-number-id'
  process.env.CREW_PHONE_CONTACTS = JSON.stringify({
    [crewCode]: { alex: '+12025550101', maya: '+12025550102', zoe: '+12025550103', zuri: '+12025550104' },
  })
  const crew = await db.crew.create({ data: { code: crewCode, name: 'Phone Test Crew', members: { create: [
    { profileCode: 'jo', name: 'Jo', location: 'Room B', availability: 'busy', skills: [] },
    { profileCode: 'alex', name: 'Alex', location: 'Room A', availability: 'available', skills: [] },
    { profileCode: 'maya', name: 'Maya', location: 'Room C', availability: 'available', skills: [] },
    { profileCode: 'zoe', name: 'Zoe', location: 'Room D', availability: 'available', skills: [] },
    { profileCode: 'zuri', name: 'Zuri', location: 'Room E', availability: 'available', skills: [] },
  ] } } })
  testCrewId = crew.id
  const planner: Planner = async ({ request, revision, candidates, maxOffers }) => {
    const offers = candidates.slice(0, maxOffers ?? 1).map(({ id }) => ({ memberId: id, message: 'Can you bring an adapter to Room B?' }))
    return { requestId: request.id, revision, action: 'offer', ...(maxOffers === 2 ? { offers } : offers[0]) }
  }
  const handlers = createCrewHandlers(db, { planner })
  const app = express()
  app.use(express.json())
  app.post('/join', handlers.join)
  app.post('/events', handlers.events)
  app.get('/feed', handlers.feed)
  app.post('/tool', handlers.voiceTool)
  const server = app.listen(0, '127.0.0.1')
  t.after(() => { server.closeAllConnections(); server.close() })
  await once(server, 'listening')
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const post = (path: string, body: object, headers: Record<string, string> = {}) => fetch(`${url}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  })
  const joined = await post('/join', { crewCode, profileCode: 'jo' })
  assert.equal(joined.status, 200)
  const { memberToken } = await joined.json() as CrewSession
  const auth = { authorization: `Bearer ${memberToken}` }
  const requested = await post('/events', { eventId: 'request', kind: 'request_help', text: 'Bring an adapter to Room B' }, auth)
  assert.equal(requested.status, 200)
  const { requestId } = await requested.json() as { requestId: string }

  const numbers: string[] = []
  const sessions: Array<{ number: string; token: string; conversationId: string }> = []
  const ended = new Set<string>()
  let inFlight = 0
  let mostInFlight = 0
  const transport: PhoneTransport = {
    async dial({ number, dynamicVariables }) {
      numbers.push(number)
      const conversationId = `conv_${randomUUID()}`
      sessions.push({ number, token: dynamicVariables.secret__crew_ticket, conversationId })
      mostInFlight = Math.max(mostInFlight, ++inFlight)
      assert.match(dynamicVariables.opening_message, /Room B/)
      await pause(50)
      inFlight--
      return { conversationId }
    },
    async hasEnded(_config, conversationId) { return ended.has(conversationId) },
  }
  const work = () => processCrewPhoneCalls(db, { transport, planner })
  await Promise.all([work(), work()])
  assert.deepEqual(numbers.toSorted(), ['+12025550101', '+12025550102'])
  assert.equal(mostInFlight, 2)
  assert.equal(await db.crewMember.count({ where: { crewId: crew.id, sessionHash: null } }), 4)

  const respond = ({ token, conversationId }: typeof sessions[number], kind: string, detail: object = {}) => post('/tool', { kind, ...detail }, {
    'x-crew-webhook-secret': webhookSecret, 'x-crew-ticket': token, 'x-elevenlabs-conversation-id': conversationId,
  })
  assert.equal((await respond({ ...sessions[0], conversationId: sessions[1].conversationId }, 'accept')).status, 401)
  const responses = await Promise.all(sessions.map(session => respond(session, 'accept')))
  assert.deepEqual(responses.map(({ status }) => status).toSorted(), [200, 409])
  const board = await fetch(`${url}/feed`, { headers: auth }).then(response => response.json()) as CrewFeed
  assert.equal(board.requests[0].status, 'in_progress')
  const offers = await db.crewOffer.findMany({ where: { requestId }, include: { recipient: true } })
  assert.deepEqual(offers.map(({ status }) => status).toSorted(), ['accepted', 'withdrawn'])
  assert.equal(offers.find(({ status }) => status === 'accepted')?.recipientId, board.requests[0].assigneeId)
  await work()
  assert.equal(numbers.length, 2, 'a later worker pass must not redial either recipient')

  const another = await post('/events', { eventId: 'second', kind: 'request_help', text: 'Bring a cable to Room B' }, auth)
  assert.equal(another.status, 200)
  const { requestId: secondId } = await another.json() as { requestId: string }
  await work()
  assert.equal(sessions.length, 4)
  assert.equal((await respond(sessions[2], 'decline', { text: 'I am busy.', location: 'Blue pouch' })).status, 200)
  const inProgress = await db.crewRequest.findUniqueOrThrow({ where: { id: secondId } })
  assert.equal(inProgress.status, 'offered', 'a peer can still accept while their call is active')
  assert.equal(inProgress.pickupLocation, 'Blue pouch')
  ended.add(sessions[3].conversationId)
  await work()
  const replanned = await db.crewRequest.findUniqueOrThrow({ where: { id: secondId } })
  assert.equal(replanned.status, 'offered')
  assert.equal(replanned.pickupLocation, 'Blue pouch')
  assert.equal(sessions.length, 5)
  assert.equal(sessions[4].number, '+12025550104', 'replanning must dial a new teammate')
  const replacement = await db.crewOffer.findFirstOrThrow({ where: { requestId: secondId, status: 'pending' } })
  assert.match(replacement.message, /Blue pouch/)
  assert.equal((await respond(sessions[4], 'accept')).status, 200)
  await work()
  assert.equal(sessions.length, 5, 'an ended call must not redial the same task')
})
