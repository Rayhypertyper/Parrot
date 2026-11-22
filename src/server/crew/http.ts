import type { Request, Response } from 'express'
import { bodyObject, CrewError, parseCommand, readEventId, required } from './input'
import { crewTransaction, getFeed, getMember, joinCrew, recordCommand, type CrewDatabase } from './store'

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

export function createCrewHandlers(db: CrewDatabase) {
  return {
    join: endpoint((req) => {
      const body = bodyObject(req.body)
      return joinCrew(db, { crewCode: required(body, 'crewCode', 60), profileCode: required(body, 'profileCode', 60) })
    }),
    feed: endpoint(async (req) => getFeed(db, await getMember(db, req.get('authorization')))),
    events: endpoint(async (req) => {
      const actor = await getMember(db, req.get('authorization'))
      const body = bodyObject(req.body)
      const eventId = readEventId(body)
      const command = parseCommand(body)
      return crewTransaction(db, actor.crewId, (tx) => recordCommand(tx, actor, eventId, command))
    }),
  }
}
