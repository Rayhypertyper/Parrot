# Parrot client (Agent B, `feat/crew-ui`)

Phone view, desktop board, and browser voice for the brief in
`docs/crew-radio-plan.md`. Everything here lives in `src/client/**`.

## Wasp wiring (for A / release lead)

Both pages export named and default components. Suggested manifest entries:

```wasp
route PhoneRoute { path: "/", to: PhonePage }
page PhonePage { component: import { PhonePage } from "@src/client/PhonePage" }

route BoardRoute { path: "/board", to: BoardPage }
page BoardPage { component: import { BoardPage } from "@src/client/BoardPage" }
```

The QR code should open `/?crew=<crewCode>`. Join is part of both pages: with
no stored member session they show the join screen, and with one they restore
it directly.

The HTTP adapter calls custom routes at `config.apiUrl` from `wasp/client`, with
`Authorization: Bearer <memberToken>`.

## Requests

**Route request to A: `GET /crew/profiles?crewCode=…`**
→ `{ crewName, profiles: [{ profileCode, name, skills, claimed }] }`.
The join screen needs this to list unclaimed profiles. If it returns 404, the
UI falls back to a typed profile code.

**Contract**
- Types and paths come from A's `src/shared/crew` via `crew/contract.ts`.
- The offer, handoff card and board show `pickupLocation` ("Pick up at") and
  `destination` ("Bring to", falling back to the requester's location), plus
  `latestFact` as the crew's own words.
- `planningStatus` drives the open-request line: planning → "Looking for help",
  waiting → "No one available to ask yet", failed → "Couldn't plan a handoff".
  The requester's "Ask the crew again" is hidden while planning.
- Decline and "I'm blocked" have an optional pickup field sent as `location`.
- Errors show the `message` from `{ code, message }`. 401 returns to join; 409
  shows the message and refetches the feed.
- Optional ask: `crewName` on the feed. The header shows "Your crew" without it.

**Dependency request to the release lead**
- `@elevenlabs/react@1.23.1` (pins `@elevenlabs/client@1.37.1`). The code uses
  `ConversationProvider`, `useConversationControls`, `useConversationStatus`
  and `useConversationMode` from this version.
- React 18 or 19. No other UI packages. Geist loads through a Google Fonts
  `@import` in `crew-radio.css`.

## Fixture mode (development only)

Put `REACT_APP_CREW_ADAPTER=fixture` in a local `.env.client`. Do not commit
it. Sample data then lives in `localStorage` and is shared across tabs, so a
phone tab and a board tab see the same crew. The crew code is `demo`. Production
always uses the HTTP adapter. Fixture voice sessions fail on purpose, which
exercises the typed fallback.

## Behaviour notes

- **Server-confirmed state only.** Accept, decline, delivered and confirmed
  update the UI from the next feed, never optimistically.
- **Retries reuse event IDs.** An action keeps one `eventId` per
  `kind:offerId|requestId` in `sessionStorage` until the server answers, so a
  dropped response plus a refresh resends the same event.
- **Polling.** The feed refreshes every 2 s while the page is visible, every
  10 s in the background, and immediately on focus or reconnect. A feed update
  never touches an active voice session.
- **Voice.** Tapping Talk shows a subject choice (pending offer, your handoff,
  your request, or something new), then:
  1. `getUserMedia`, to surface permission errors.
  2. `POST /crew/voice-session` with `{requestId, offerId}`.
  3. `startSession({ conversationToken, connectionType: "webrtc", dynamicVariables })`.

  States shown: waiting for microphone, preparing, connecting, listening,
  speaking, ended. Only one local session runs at a time. Close and End both
  end the session, and the provider ends it on unmount. `onAgentToolResponse`
  refreshes the feed.
- **Fallbacks.** Mic denial, insecure context, a token error and a dropped
  connection all keep their message on screen and show "Type instead" with the
  same subject's tap actions.
