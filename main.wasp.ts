import { api, apiNamespace, app, page, route } from '@wasp.sh/spec'
import { PhonePage } from './src/client/PhonePage' with { type: 'ref' }
import { BoardPage } from './src/client/BoardPage' with { type: 'ref' }
import { crewApiMiddleware, crewEvents, crewFeed, crewJoin, crewRetryPlan, crewVoiceSession, crewVoiceTool } from './src/server/crew/routes' with { type: 'ref' }
import { seedDemo } from './src/server/crew/seed' with { type: 'ref' }
import { crewRoutes } from './src/shared/crew/index'

export default app({
  name: 'crewRadio',
  title: 'Crew Radio',
  wasp: { version: '^0.26' },
  db: { seeds: [seedDemo] },
  spec: [
    route('PhoneRoute', '/', page(PhonePage)),
    route('BoardRoute', '/board', page(BoardPage)),
    apiNamespace('/crew', { middlewareConfigFn: crewApiMiddleware }),
    api('POST', crewRoutes.join, crewJoin, { auth: false }),
    api('GET', crewRoutes.feed, crewFeed, { auth: false }),
    api('POST', crewRoutes.events, crewEvents, { auth: false }),
    api('POST', crewRoutes.retryPlan, crewRetryPlan, { auth: false }),
    api('POST', crewRoutes.voiceSession, crewVoiceSession, { auth: false }),
    api('POST', crewRoutes.voiceTool, crewVoiceTool, { auth: false }),
  ],
})
