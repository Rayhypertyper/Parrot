import { api, apiNamespace, app } from '@wasp.sh/spec'
import { crewApiMiddleware, crewEvents, crewFeed, crewJoin } from './src/server/crew/routes' with { type: 'ref' }
import { seedDemo } from './src/server/crew/seed' with { type: 'ref' }
import { crewRoutes } from './src/shared/crew/index'

export default app({
  name: 'crewRadio',
  title: 'Crew Radio',
  wasp: { version: '^0.26' },
  db: { seeds: [seedDemo] },
  spec: [
    apiNamespace('/crew', { middlewareConfigFn: crewApiMiddleware }),
    api('POST', crewRoutes.join, crewJoin, { auth: false }),
    api('GET', crewRoutes.feed, crewFeed, { auth: false }),
    api('POST', crewRoutes.events, crewEvents, { auth: false }),
  ],
})
