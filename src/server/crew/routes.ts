import { prisma } from 'wasp/server'
import type { MiddlewareConfigFn } from 'wasp/server'
import { dialCrewOffers } from 'wasp/server/jobs'
import { createCrewHandlers } from './http'

const handlers = createCrewHandlers(prisma, {
  async wakePhoneWorker() {
    if (process.env.ELEVENLABS_PHONE_NUMBER_ID && process.env.CREW_PHONE_CONTACTS) await dialCrewOffers.submit({})
  },
})

export const crewJoin = handlers.join
export const crewFeed = handlers.feed
export const crewEvents = handlers.events
export const crewRetryPlan = handlers.retryPlan
export const crewVoiceSession = handlers.voiceSession
export const crewVoiceTool = handlers.voiceTool
export const crewApiMiddleware: MiddlewareConfigFn = (config) => config
