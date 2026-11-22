import type { Request, Response } from 'express'
import type { Prisma } from '@prisma/client'
import type { CrewCommand } from '../../shared/crew/index'
import { elevenLabsAnnouncement, getAnnouncementAudio, type AnnouncementSpeech } from './announcementAudio'
import { recordCommand, type RecordedCommand } from './commands'
import { bodyObject, CrewError, field, parseCommand, readEventId, required } from './input'
import { maritimePlanner, planRequest, type Planner } from './planning'
import { authorizeVoiceTool, getElevenLabsToken, recordVoiceTool, startVoiceSession, type ElevenLabsToken } from './voice'
import { crewTransaction, getFeed, getMember, joinCrew, type CrewActor, type CrewDatabase } from './store'

type Handler = (req: Request) => Promise<unknown>

function endpoint(handler: Handler) {
  return async (req: Request, res: Response, _context?: unknown) => {
    res.set('Cache-Control', 'no-store')
    try {
      res.json(await handler(req))
    } catch (error) {
      if (error instanceof CrewError) {
        res.status(error.status).json({ code: error.code, message: error.message })
        return
      }
      console.error('Crew endpoint failed', { method: req.method, path: req.path, name: (error as Error)?.name })
      res.status(500).json({ code: 'unavailable', message: 'Crew Radio could not finish that action. Try again.' })
    }
  }
}

export function createCrewHandlers(
  db: CrewDatabase,
  { planner = maritimePlanner, voiceToken = getElevenLabsToken, announcementSpeech = elevenLabsAnnouncement }: {
    planner?: Planner
    voiceToken?: ElevenLabsToken
    announcementSpeech?: AnnouncementSpeech
  } = {},
) {
  async function finish(actor: CrewActor, command: CrewCommand, recorded: RecordedCommand) {
    const newEvent = command.kind === 'availability_update'
      ? JSON.parse(JSON.stringify(command)) as Prisma.JsonValue
      : undefined
    await Promise.all(recorded.plan.map(async (requestId) => {
      try {
        await planRequest(db, actor, requestId, planner, newEvent)
      } catch {
        console.warn('Could not refresh crew planning', { requestId })
      }
    }))
    return recorded.response
  }

  return {
    join: endpoint((req) => {
      const body = bodyObject(req.body)
      return joinCrew(db, { crewCode: required(body, 'crewCode', 60), profileCode: required(body, 'profileCode', 60) })
    }),
    feed: endpoint(async (req) => {
      const member = await getMember(db, req.get('authorization'))
      const announcementId = field({ announcementId: req.query.announcementAudio }, 'announcementId')
      return announcementId ? getAnnouncementAudio(db, member, announcementId, announcementSpeech) : getFeed(db, member)
    }),
    events: endpoint(async (req) => {
      const actor = await getMember(db, req.get('authorization'))
      const body = bodyObject(req.body)
      const eventId = readEventId(body)
      const command = parseCommand(body)
      const recorded = await crewTransaction(db, actor.crewId, (tx) => recordCommand(tx, actor, eventId, command))
      return finish(actor, command, recorded)
    }),
    retryPlan: endpoint(async (req) => {
      const actor = await getMember(db, req.get('authorization'))
      const requestId = required(bodyObject(req.body), 'requestId')
      return planRequest(db, actor, requestId, planner, undefined, true)
    }),
    voiceSession: endpoint(async (req) => {
      const member = await getMember(db, req.get('authorization'))
      const body = bodyObject(req.body ?? {})
      return startVoiceSession(db, member, {
        requestId: field(body, 'requestId'), offerId: field(body, 'offerId'),
      }, voiceToken)
    }),
    voiceTool: endpoint(async (req) => {
      authorizeVoiceTool(req.get('x-crew-webhook-secret'))
      const { actor, command, recorded } = await recordVoiceTool(
        db, req.get('x-crew-ticket'), req.get('x-elevenlabs-conversation-id'), bodyObject(req.body),
      )
      return finish(actor, command, recorded)
    }),
  }
}
