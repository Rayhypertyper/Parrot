# Crew Radio API

Import paths and types from `src/shared/crew/index.ts`. Use the Wasp **server** origin for all paths, typically `http://localhost:3001` with Wasp's local defaults. Deployment supplies the HTTPS API origin. Send JSON and `Authorization: Bearer <memberToken>` after joining. Poll feed about every two seconds. Offer IDs and event IDs are opaque strings. Generate a fresh event ID per action and reuse it for transport retries.

| Path | Method | Input / response |
| --- | --- | --- |
| `/crew/join` | POST | `CrewJoinInput` → `CrewSession` |
| `/crew/feed` | GET | `CrewFeed` |
| `/crew/events` | POST | `CrewEvent` → `CrewEventResult` |
| `/crew/voice-session` | POST | `VoiceSessionInput` → `VoiceSessionResult` |
| `/crew/retry-plan` | POST | `RetryPlanInput` → `RetryPlanResult` |

Use `fixture.ts` for populated, empty, success, and error examples. Demo crew code is `demo`. Select profile codes `jo`, `alex`, `maya`, or `jules`. A claim returns 409 if that profile is already taken. Other errors use `{ code, message }`. Refresh feed after 409, keep the member token across refresh, and return to join after a feed 401.

For request creation, `location` is the exact destination if entered separately. On a decline or blocker it is the exact pickup location if one was shared. An event success means the action is committed. Feed shows the subsequent planner outcome separately. The voice tool is called by ElevenLabs, with its server-side credential and a scoped ticket.
