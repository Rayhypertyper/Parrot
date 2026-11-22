import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import express from 'express'
import { crewRoutes, type CrewFeed, type CrewSession } from '../../shared/crew/index'
import { createCrewHandlers } from './http'

async function listen(server: Server): Promise<string> {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

const databaseUrl = process.env.CREW_TEST_DATABASE_URL

test('Crew Radio HTTP, PostgreSQL and the coordinator', { skip: !databaseUrl, timeout: 30_000 }, async (t) => {
  const db = new PrismaClient({ datasourceUrl: databaseUrl })
  t.after(() => db.$disconnect())
  const token = randomUUID()
  process.env.ELEVENLABS_WEBHOOK_SECRET = randomUUID()
  process.env.CREW_PLANNER_TOKEN = token
  let conversationId = ''
  let modelCalls = 0
  let stallNext = false
  let holdNext = false
  let held: (() => void) | undefined
  let planningInput: { candidates: Array<{ id: string; name: string }> } | undefined
  const upstream = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const { messages } = JSON.parse(Buffer.concat(chunks).toString())
    const input = JSON.parse(messages[1].content)
    planningInput = input
    modelCalls += 1
    if (stallNext) {
      stallNext = false
      return
    }
    const modelChoice = input.candidates[0]
    if (holdNext) {
      holdNext = false
      await new Promise<void>((resolve) => { held = resolve })
    }
    const proposal = {
      action: 'offer', memberId: modelChoice.id, requestId: input.request.id, revision: input.revision,
      message: 'Can you handle this handoff?',
    }
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(proposal) } }] }))
  })
  const upstreamUrl = await listen(upstream)
  t.after(() => { upstream.closeAllConnections(); upstream.close() })

  const probe = createServer()
  const plannerUrl = await listen(probe)
  await new Promise<void>((resolve) => probe.close(() => resolve()))
  const coordinator = spawn(process.execPath, ['services/planner/server.ts'], {
    env: {
      ...process.env, PORT: new URL(plannerUrl).port,
      OPENAI_API_KEY: 'local-test', OPENAI_BASE_URL: upstreamUrl, CREW_PLANNER_MODEL: 'local-test',
    },
    stdio: 'inherit',
  })
  t.after(() => { coordinator.kill() })
  let healthy = false
  for (let i = 0; i < 60 && !healthy; i += 1) {
    healthy = await fetch(`${plannerUrl}/health`).then((res) => res.ok, () => false)
    if (!healthy) await delay(25)
  }
  assert.ok(healthy, 'coordinator should start')
  process.env.CREW_PLANNER_URL = `${plannerUrl}/plan`
  assert.equal((await fetch(process.env.CREW_PLANNER_URL, { method: 'POST' })).status, 401)

  const handlers = createCrewHandlers(db, {
    voiceToken: async () => {
      conversationId = `conv_${randomUUID()}`
      return { token: 'local-elevenlabs-token', conversationId }
    },
  })
  const app = express()
  app.use(express.json())
  app.post(crewRoutes.join, handlers.join)
  app.get(crewRoutes.feed, handlers.feed)
  app.post(crewRoutes.events, handlers.events)
  app.post(crewRoutes.retryPlan, handlers.retryPlan)
  app.post(crewRoutes.voiceSession, handlers.voiceSession)
  app.post(crewRoutes.voiceTool, handlers.voiceTool)
  const server = createServer(app)
  const apiUrl = await listen(server)
  t.after(() => { server.closeAllConnections(); server.close() })

  async function call(path: string, body?: unknown, session?: CrewSession, headers = {}) {
    const res = await fetch(`${apiUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        ...(session && { authorization: `Bearer ${session.memberToken}` }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: res.status, data: await res.json() }
  }

  async function fixture() {
    const crewCode = randomUUID()
    await db.crew.create({
      data: {
        code: crewCode, name: 'QA Crew',
        members: { create: [
          { profileCode: 'jo', name: 'Jo', location: 'Room B', availability: 'busy', skills: [] },
          { profileCode: 'alex', name: 'Alex', location: 'Projector', availability: 'available', skills: ['AV'] },
          { profileCode: 'maya', name: 'Maya', location: 'Registration', availability: 'available', skills: ['Runner'] },
          { profileCode: 'jules', name: 'Jules', location: 'Entrance', availability: 'protected', skills: [] },
        ] },
      },
    })
    const joins = await Promise.all(['jo', 'alex', 'maya', 'jules'].map(async (profileCode) => {
      const joined = await call(crewRoutes.join, { crewCode, profileCode })
      assert.equal(joined.status, 200)
      return joined.data as CrewSession
    }))
    return { jo: joins[0], alex: joins[1], maya: joins[2], jules: joins[3], crewCode }
  }

  async function feed(session: CrewSession): Promise<CrewFeed> {
    const response = await call(crewRoutes.feed, undefined, session)
    assert.equal(response.status, 200)
    return response.data
  }

  function event(session: CrewSession, body: Record<string, unknown>) {
    return call(crewRoutes.events, { eventId: randomUUID(), ...body }, session)
  }

  async function waitFor(ready: () => boolean) {
    for (let i = 0; i < 120 && !ready(); i += 1) await delay(25)
    assert.ok(ready(), 'the planner should receive the request')
  }

  await t.test('replacement voice offer, duplicate retries and simultaneous accepts', async () => {
    const { jo, alex, maya, jules, crewCode } = await fixture()
    assert.equal((await event(maya, { kind: 'availability_update', availability: 'busy' })).status, 200)
    assert.equal((await call(crewRoutes.join, { crewCode, profileCode: 'jo' })).status, 409)
    assert.equal((await call(crewRoutes.feed)).status, 401)
    const requestEvent = { eventId: randomUUID(), kind: 'request_help', text: 'We need a USB-C adapter in Room B.', location: 'Room B' }
    const created = await event(jo, requestEvent)
    assert.equal(created.status, 200)
    assert.deepEqual(await event(jo, requestEvent), created)
    assert.equal((await event(jo, { ...requestEvent, text: 'Different request' })).status, 409)
    const { requestId } = created.data
    assert.equal((await feed(maya)).requests.find(({ id }) => id === requestId)?.status, 'offered')
    const [first] = (await feed(alex)).myOffers
    assert.ok(first)
    assert.equal((await call(crewRoutes.voiceSession, { offerId: first.id }, maya)).status, 404)
    const session = await call(crewRoutes.voiceSession, { offerId: first.id }, alex)
    assert.equal(session.status, 200)
    assert.equal(session.data.conversationToken, 'local-elevenlabs-token')
    assert.equal((await event(maya, { kind: 'availability_update', availability: 'available' })).status, 200)

    const pickup = `the silver case beside booth ${randomUUID().slice(0, 4)} — lower shelf`
    const note = `I need to stay with the projector. The spare is in ${pickup}.`
    const toolBody = { kind: 'decline', text: note }
    const toolHeaders = {
      'x-crew-webhook-secret': process.env.ELEVENLABS_WEBHOOK_SECRET,
      'x-crew-ticket': session.data.dynamicVariables.secret__crew_ticket,
      'x-elevenlabs-conversation-id': conversationId,
    }
    assert.equal((await call(crewRoutes.voiceTool, toolBody)).status, 401)
    assert.equal((await call(crewRoutes.voiceTool, toolBody, undefined, {
      ...toolHeaders, 'x-elevenlabs-conversation-id': 'different-conversation',
    })).status, 401)
    const voice = await call(crewRoutes.voiceTool, toolBody, undefined, toolHeaders)
    assert.equal(voice.status, 200)
    assert.deepEqual(await call(crewRoutes.voiceTool, toolBody, undefined, toolHeaders), voice)
    assert.equal((await call(crewRoutes.voiceTool, { kind: 'accept' }, undefined, toolHeaders)).status, 409)
    assert.equal((await event(alex, { kind: 'accept', offerId: first.id })).status, 409)
    assert.deepEqual(planningInput?.candidates.map(({ name }) => name), ['Maya'])

    const [replacement] = (await feed(maya)).myOffers
    assert.ok(replacement?.message.includes(pickup))
    assert.ok(replacement.message.includes('Room B'))
    assert.equal((await feed(jo)).requests[0].latestFact, note)
    assert.deepEqual((await feed(jules)).myOffers, [])
    assert.equal((await event(jules, { kind: 'availability_update', availability: 'available' })).status, 409)
    const reply = { kind: 'accept', offerId: replacement.id }
    const accepts = await Promise.all([event(maya, reply), event(maya, reply)])
    assert.deepEqual(accepts.map(({ status }) => status).sort(), [200, 409])
    assert.equal((await feed(jo)).requests[0].assigneeId, maya.memberId)
    assert.equal((await event(maya, { kind: 'confirm_receipt', requestId })).status, 409)
    assert.equal((await event(maya, { kind: 'report_delivery', requestId })).status, 200)
    assert.equal((await feed(jo)).requests[0].status, 'awaiting_confirmation')
    assert.equal((await event(jo, { kind: 'confirm_receipt', requestId })).status, 200)
    const final = await feed(alex)
    assert.equal(final.requests[0].status, 'done')
    assert.equal(final.activity.filter(({ summary }) => summary.includes(note)).length, 1)
    assert.equal(final.activity.filter(({ summary }) => summary === 'Accepted the handoff.').length, 1)
  })

  await t.test('independent voice offers stay live when one teammate declines', async () => {
    const { jo, alex, maya } = await fixture()
    const callsBefore = modelCalls
    const { status, data } = await event(jo, { kind: 'request_help', text: 'Bring a cable to Room B.' })
    assert.equal(status, 200)
    const [first] = (await feed(alex)).myOffers
    const [second] = (await feed(maya)).myOffers
    assert.equal(first.requestId, data.requestId)
    assert.equal(second.requestId, data.requestId)
    assert.equal(first.status, 'pending')
    assert.equal(second.status, 'pending')
    assert.equal(modelCalls, callsBefore + 1)

    async function open(offerId: string, member: CrewSession) {
      const session = await call(crewRoutes.voiceSession, { offerId }, member)
      assert.equal(session.status, 200)
      return {
        'x-crew-webhook-secret': process.env.ELEVENLABS_WEBHOOK_SECRET,
        'x-crew-ticket': session.data.dynamicVariables.secret__crew_ticket,
        'x-elevenlabs-conversation-id': conversationId,
      }
    }
    const firstVoice = await open(first.id, alex)
    const secondVoice = await open(second.id, maya)
    assert.notEqual(firstVoice['x-elevenlabs-conversation-id'], secondVoice['x-elevenlabs-conversation-id'])
    assert.equal((await call(crewRoutes.voiceTool, { kind: 'decline', location: 'Blue pouch' }, undefined, firstVoice)).status, 200)
    assert.equal((await feed(maya)).myOffers[0].status, 'pending')
    assert.equal((await feed(jo)).requests[0].status, 'offered')
    assert.equal((await call(crewRoutes.voiceTool, { kind: 'accept' }, undefined, secondVoice)).status, 200)
    const [assigned] = (await feed(jo)).requests
    assert.equal(assigned.assigneeId, maya.memberId)
    assert.equal(assigned.pickupLocation, 'Blue pouch')
    assert.equal(modelCalls, callsBefore + 1)
  })

  await t.test('expired browser activity is excluded and simultaneous accepts have one winner', async () => {
    const { jo, alex, maya, crewCode } = await fixture()
    const { id: crewId } = await db.crew.findUniqueOrThrow({ where: { code: crewCode } })
    await db.crewMember.create({ data: {
      crewId, profileCode: 'offline', name: 'Absent', location: 'Room B', availability: 'available', skills: [],
      lastSeenAt: new Date(Date.now() - 60_000),
    } })
    assert.equal((await event(jo, { kind: 'request_help', text: 'Need help with a table.' })).status, 200)
    assert.deepEqual(planningInput?.candidates.map(({ name }) => name), ['Alex', 'Maya'])
    const [first] = (await feed(alex)).myOffers
    const [second] = (await feed(maya)).myOffers
    const results = await Promise.all([
      event(alex, { kind: 'accept', offerId: first.id }),
      event(maya, { kind: 'accept', offerId: second.id }),
    ])
    assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409])
    const [request] = (await feed(jo)).requests
    const outcomes = await db.crewOffer.findMany({ where: { requestId: request.id } })
    assert.deepEqual(outcomes.map(({ status }) => status).sort(), ['accepted', 'withdrawn'])
    assert.equal(outcomes.find(({ status }) => status === 'accepted')?.recipientId, request.assigneeId)
  })

  await t.test('planner timeout preserves a warehouse request and supports retry', async () => {
    const { jo, alex, maya } = await fixture()
    stallNext = true
    const callsBefore = modelCalls
    const pending = event(jo, { kind: 'request_help', text: 'We need a cart at packing station 4.', location: 'packing station 4' })
    await waitFor(() => modelCalls > callsBefore)
    const during = await feed(maya)
    const requestId = during.requests[0].id
    assert.equal(during.requests[0].planningStatus, 'planning')
    assert.equal(during.activity[0].summary, 'We need a cart at packing station 4.')
    assert.equal((await pending).status, 200)
    assert.equal((await feed(jo)).requests[0].planningStatus, 'failed')
    const retry = await call(crewRoutes.retryPlan, { requestId }, jo)
    assert.equal(retry.data.result, 'offered')
    const [offer] = (await feed(alex)).myOffers
    assert.ok(offer.message.includes('packing station 4'))
    assert.equal((await event(alex, { kind: 'accept', offerId: offer.id })).status, 200)
    assert.equal((await event(jo, { kind: 'confirm_receipt', requestId })).status, 200)
    assert.equal((await feed(maya)).requests[0].status, 'done')
  })

  await t.test('a superseded planner reply cannot write an offer and double declines leave it open', async () => {
    const { jo, alex, maya, jules } = await fixture()
    holdNext = true
    const pending = event(jo, { kind: 'request_help', text: 'We need help moving a table.' })
    await waitFor(() => held !== undefined)
    const update = await event(maya, { kind: 'availability_update', availability: 'available', location: 'Side door' })
    assert.equal(update.status, 200)
    const [offer] = (await feed(alex)).myOffers
    assert.ok(offer)
    held?.()
    assert.equal((await pending).status, 200)
    assert.equal((await feed(alex)).myOffers.length, 1)
    assert.equal((await event(alex, { kind: 'decline', offerId: offer.id })).status, 200)
    const [next] = (await feed(maya)).myOffers
    assert.ok(next)
    const callsBefore = modelCalls
    assert.equal((await event(maya, { kind: 'decline', offerId: next.id })).status, 200)
    const [request] = (await feed(jo)).requests
    assert.equal(request.status, 'open')
    assert.equal(request.planningStatus, 'waiting')
    assert.equal(modelCalls, callsBefore)
    assert.deepEqual((await feed(jules)).myOffers, [])
  })
})
