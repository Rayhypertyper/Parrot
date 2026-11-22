import { prisma } from 'wasp/server'
import type { MiddlewareConfigFn } from 'wasp/server'
import { createCrewHandlers } from './http'

const handlers = createCrewHandlers(prisma)

export const crewJoin = handlers.join
export const crewFeed = handlers.feed
export const crewEvents = handlers.events
export const crewApiMiddleware: MiddlewareConfigFn = (config) => config
