# Crew Radio | Two-agent build brief

**Product** · A voice-first teammate for people coordinating work across physical locations. Someone can ask for help, share a useful fact, offer time, decline a handoff, or confirm an outcome. Crew Radio remembers what the team said, connects the right people, and follows up through their own devices.

**Delivery target** · Two real phones on the same crew, a laptop showing a live board, a Maritime-hosted planner responding to real input, and one handoff that survives a decline. A person who accepts an offer has agreed to help. Only the requester can confirm the outcome in this version.

**How to use this file** · Give both agents the complete brief. On the shared starting commit, place it at `docs/crew-radio-plan.md`, or attach the same file in both sessions. Paste **Launch prompt A** in one session and **Launch prompt B** in the other. Use one repository, two feature branches, and two working directories. The people operating the sessions can also be the release lead and the device lead.

## 1. What the team is building

Any crew member can start a request. The app shows who needs help, the location, what has been offered, who has accepted, and whether the requester confirmed completion. People can give updates in their own words. They decide whether to accept an offer. A teammate covering a protected post can contribute information without being asked to leave.

One shared QR code opens a crew join page. Each participant chooses an unclaimed demo profile or joins under a new name if the team implements open joining. Give each device a member session; a page refresh should preserve it. The same member can open the board on a laptop. The sample crew, prop, and locations belong in seed data. Use generic domain names such as crew, member, request, offer, location, and activity throughout the product.

**Ship first:** join, talk, request, offer, decline with new information, re-offer, accept, confirm receipt, and synchronized screens. Provide tap controls for accept, decline, and confirmation. They help in a noisy room and exercise the same backend as voice.

**Only if the loop is stable:** let someone volunteer new availability after a request stalls, or demonstrate two overlapping voice sessions. Sequential conversations already prove cross-person coordination. Defer native apps, background phone ringing, cameras, voice biometrics, full transcript archives, and workforce analytics.

## 2. Who owns what

| Owner | Files and authority | Evidence they deliver |
|---|---|---|
| **Agent A — coordination and server** | Owns the Wasp manifest after the common scaffold, Prisma schema/migrations, server routes, demo seed, shared API types/fixtures, server-side ElevenLabs integration, and the Maritime planner service. Can read the entire repo and edit its own branch. | A real spoken or typed event persists, a planner selects or revises an offer, and retries or stale replies cannot create two assignments. |
| **Agent B — product and voice client** | Owns React pages/components, CSS, client-side API adapter, ElevenLabs browser SDK, and frontend-only fixtures derived from the contract. Can read the entire repo and edit its own branch. | A teammate can join on a phone, speak, receive or respond to an offer, and see the result on the desktop board. |
| **Human 1 — release/integration lead** | Owns the shared starting commit, app dependency manifest/lockfile, branch integration, Wasp deployment, DB credentials, migrations on the demo DB, and final submission. Can do this on a separate computer. | A public HTTPS app and API, the merged candidate, a working two-device run, and a project link. |
| **Human 2 — voice setup, devices, and demo** | Configures the ElevenLabs agent, webhook, first message, and tool header credentials with A. Opens the two real phones, checks microphones/connectivity, handles the prop, rehearses, and records. Can also configure Maritime with the release lead. | A successful real voice tool call into Wasp, two joined devices, a two-minute accessible video, and a fresh playback check. |

### Repository workflow and permissions

1. **Common starting commit, approximately 10 minutes.** The release lead checks existing repo instructions, scaffolds the simplest compatible Wasp app, and commits a runnable page. Use the generated layout for the installed Wasp version. Pin Wasp/Node and the package manager lockfile. Include the agreed client dependencies for `@elevenlabs/react` and the minimal UI stack. Configure the two page routes and export placeholders for Agent B to replace. Publish the baseline SHA and API base URL. With an existing repo, preserve its framework configuration and map the ownership below onto its current paths.
2. **Start simultaneously from that SHA.** Use branches `feat/coordination` and `feat/crew-ui`. On separate computers, each owner uses a clone and their branch. On one computer, use two Git worktrees off the same commit. Never point both sessions at one checkout. If scaffolding is still running, B can sketch the screens and fixture shapes while A writes planner examples.
3. **Path boundaries.** A owns the app's Wasp manifest, Prisma files, `src/server/**`, `src/shared/crew/**`, and `services/planner/**` including the planner's own manifest and lockfile. B owns `src/client/**`, app styles, and UI assets. The release lead owns app-level package files, deployment settings, and the demo environment. Generated Wasp outputs stay generated. For a dependency or route that crosses owners, send the owner the package/path and reason. For a contract change, A publishes the new sample and type, then B updates its adapter.
4. **Branches and secrets.** Agents may run local builds, tests, local migrations, and scoped fixture seeds. Their human operators may push their feature branches and open draft PRs. The release lead merges and deploys. Keep production data, account billing, provider dashboards, force-pushes, and history rewrites outside the coding agents' permissions. Use development credentials through ignored local env files or provider secret stores. Keep secrets out of chat, commits, logs, and client bundles.
5. **Two early merges.** Merge a small A slice for join/feed/events and a small B slice for join/board. Build the combined app before adding complex voice or planning. A can serve a hand-written HTTP example before B's UI exists. B can use a fixture adapter until A's URL is live. The release build uses the real adapter. Update branches from the merged baseline before the second pass.
6. **Handoff format.** Each owner posts the branch/SHA, what was tested, one reproducible input with expected output, any contract change, and the next dependency. Share logs containing request IDs and error codes. A short screen recording from an actual phone is worth more than several desktop screenshots when deciding whether voice is ready.

## 3. Integration design

| Layer | Implementation choice | Boundary |
|---|---|---|
| **Wasp** | React phone and dashboard pages, Node server, Prisma-backed database, and custom HTTP routes for join, feed, actions, and ElevenLabs webhooks. Use the Wasp deployment path appropriate for the generated version and ship both frontend and backend. | Wasp is the authority on membership, availability, request state, and valid transitions. The browser sends intents. The server decides what changed. |
| **ElevenLabs Agents** | Configure one conversational agent. Start separate WebRTC conversations from the phones via the React SDK. Wasp obtains a short-lived conversation token using its server-side ElevenLabs key. Give each conversation the relevant offer/request context and a limited-use credential for its tool calls. | ElevenLabs understands speech, asks for clarification, calls the Wasp webhook during the conversation, and speaks the outcome of that call. Team-level knowledge comes from Wasp. |
| **Maritime** | Deploy one small Node/TypeScript coordinator with a Dockerfile, a health endpoint, and a protected planning endpoint. Wasp sends the latest request and eligible people. The coordinator calls a model, checks its structured response, and returns a proposed action. | Maritime runs the code and can provide the model endpoint. The team supplies the matching instructions, valid output types, and application logic. The planner never directly edits crew records. |

**Network path.** The browser connects to Wasp to join and obtain a voice token, then streams audio to ElevenLabs. ElevenLabs calls Wasp's public HTTPS tool endpoint. Wasp records the input, calls Maritime server-to-server, checks its proposal against current DB state, and publishes the updated feed. Both phones and the laptop refresh that feed about every two seconds while open. One feed update should never interrupt or restart an active conversation.

**Deployment details to settle early.** Use a hosted PostgreSQL demo DB and a public HTTPS Wasp frontend/server. Set the correct production API base URL and allowed frontend origin. For Maritime's monorepo deployment, publish a container image built from `services/planner`, or upload a ZIP of that folder's contents with its Dockerfile at the archive root. Bind the service to `0.0.0.0` on the injected `PORT`. Protect the planning route with an app-level bearer secret and keep the health route free of crew data. Maritime's custom/Docker framework requires explicit setup to attach its model credentials. Choose an available model and confirm a real response on the deployed service before tuning prompts.

**Voice setup.** Use a quiet mobile-friendly first message, tap to begin, and a visible End control. Each session can include clarifying turns and commits one operational update for this MVP. Configure the agent with a single webhook tool, `submit_update`. Supply the static webhook credential from ElevenLabs' secret store and the Wasp-issued per-interaction ticket in the `secret__crew_ticket` dynamic variable used in a tool header. The backend resolves the participant and context from the ticket. Bind the ticket to the current member and optional request/offer, cache the committed result on retry, and expire unused tickets. The browser has only its own short-lived credentials. Use one agent ID and reuse it across people. Check the account's concurrency limit before rehearsing simultaneous speech.

## 4. Shared contract for both agents

The routes below are **proposed Crew Radio endpoints**. Register them in the installed Wasp version and use the actual external base URL. Use camelCase JSON, opaque string IDs, ISO timestamps, and one shared type definition. A owns changes. Put the examples in a small shared fixture so B can work immediately.

| Route | Request | Response and behavior |
|---|---|---|
| `POST /crew/join` | `{ crewCode, profileCode }` for the seeded demo | `{ memberToken, memberId, crewId }`. Atomically claim the profile. Retain the member token per browser session for refresh; a taken profile returns a clear choice to use another. |
| `GET /crew/feed` | Member bearer token | `{ me, members, requests, myOffers, activity, updatedAt }`. Scope all records to the member's crew. Return summaries ordered by relevance/time and a recent activity window. |
| `POST /crew/events` | Member bearer token plus `{ eventId, kind, requestId?, offerId?, text?, location?, availability? }` | `{ eventId, requestId?, result, message }`. Use for manual inputs. For new requests, put the goal and destination in text. Preserve the original wording of important location details. |
| `POST /crew/voice-session` | Member bearer token plus optional `{ requestId?, offerId? }` | `{ conversationToken, dynamicVariables }`. Include a readable member name and current offer context. Return a per-interaction ticket under the configured secret variable. Never expose provider API keys. |
| `POST /crew/voice-tool` | ElevenLabs webhook credential, ticket header, and `{ kind, text?, location?, availability? }` | Same command handler as manual inputs. Derive the actor, request, and offer from the ticket. Return a short, accurate message the agent may read aloud. |
| `POST /plan` on Maritime | Wasp-to-planner credential plus `{ request, revision, newEvent, candidates, priorOffers }` | `{ action: "offer", memberId, message }` or `{ action: "wait", message }`. Echo the request ID/revision for validation. Use natural words in the offer and carry newly learned facts. |

**Fields the UI relies on.** `me` and each member contain `id, name, location, availability, skills`. Availability is `available | busy | protected`. A request contains `id, title, requesterId, status, revision, assigneeId|null, latestFact|null, updatedAt`. An offer contains `id, requestId, recipientId, status, message`; status is `pending | accepted | declined | withdrawn`. The caller sees their own offers; the crew sees the current publicly relevant offer/assignee through request activity. An activity item contains `id, requestId|null, at, actorName, summary`. Session tokens, tickets, and raw audio stay outside the feed.

**Event kinds.** `request_help`, `availability_update`, `accept`, `decline`, `blocked`, `report_delivery`, and `confirm_receipt`. Use `decline` on a pending offer and `blocked` after acceptance. A spoken decline can include useful information in `text`. Both count as one event. Restrict protected-post edits to seed/setup in this version. When a device has several plausible requests, let the teammate select the request before starting the call.

**Request states.** `open → offered → in_progress → awaiting_confirmation → done`. A decline returns an offered request to open. A blocker releases its assignee and returns an in-progress request to open. The requester can confirm from either in-progress or awaiting-confirmation when they observe receipt. Accept, decline, and fulfillment apply only to the appropriate member. The recipient can report delivery. An empty eligible pool leaves the request visibly open. A new availability event can trigger a fresh attempt.

**Concrete examples for the shared fixture**

```jsonl
{"eventId":"e101","kind":"request_help","text":"We need a USB-C to HDMI adapter at Demo Room B."}
{"kind":"decline","text":"I have to stay with the projector. The spare is in the blue pouch by registration."}
{"requestId":"r7","revision":3,"action":"offer","memberId":"maya","message":"Can you grab the spare adapter from the blue pouch by registration and bring it to Demo Room B?"}
{"eventId":"e104","kind":"accept","requestId":"r7","offerId":"o2"}
```

The four lines represent independent messages: a browser request, a voice tool body with an offer-bound ticket, a planner response, and a browser acceptance. The chosen location must come from live input. Seed names, IDs, and objects are examples.

**Consistency and failure behavior.** A must reject unknown enums/IDs, skip the requester and protected or unavailable members, respect declined offers, and reject a duplicate active assignment. Enforce one pending offer per request and recheck availability when accepting. Use a transaction/conditional revision update when applying a proposal; a stale planner response must never overwrite a later acceptance. Browser retries reuse an event ID. Identical webhook retries reuse the ticket result. A second, different mutation on a consumed ticket requires a new interaction. Return 401 for an invalid session, 409 for a stale offer or changed assignment, and a concrete message B can display.

Commit the incoming human event before waiting on remote reasoning. Give the planner call a short deadline, keep its work outside DB transactions, and allow one bounded retry against the latest revision. If it times out, preserve the open request and expose a retry in context. For this, support a member-scoped `POST /crew/retry-plan` with `{requestId}`; allow it only for an open request. Reuse that flow when new availability arrives. Show “Looking for help” only during an actual attempt. Prefer a correct waiting state to a fabricated offer.

### Instructions for the two runtime AI roles

These are starting instructions for the app's models. The two coding-agent launch prompts are in sections 8 and 9.

**ElevenLabs voice instructions, for the device lead.** “You are Crew Radio, a colleague on the same crew. Keep radio turns short. Use the current offer or request supplied with this conversation. When someone declines, retain any useful new detail in the same update, especially exact locations, deadlines, or constraints. If their meaning is unclear, ask one focused question before submitting. Call submit_update when they make a commitment or report an operational change. Read its confirmed result accurately. A promise to help means accepted; delivery and requester confirmation are separate actions. After the update is recorded, acknowledge it in one sentence and end the turn.”

**Maritime planner instructions, for Agent A.** “Choose the next useful handoff for this request from the eligible people provided. Use current availability, skills, stated location, prior offers and the newest report. Choose one candidate or wait. Carry exact pickup and destination details into the message. Ask the recipient if they can help. Use only member IDs supplied in this input. If a fact is unknown, omit it or state what remains unknown. Return the agreed JSON shape with the request ID and revision.” Validate the response in code. Use model selection to rank eligible people; Wasp enforces eligibility and reservations before and after the call.

## 5. Product and visual direction

The main mobile user is walking between locations, often holding equipment. They should see who needs them, what is being asked, and how to answer with one thumb. The desktop board is a shared view of the same crew. Access to the board grants the same member permissions as the phone.

| Surface | Layout and interaction |
|---|---|
| **Join** | One compact screen with crew name and a profile choice. Keep one obvious Join action. On a returning device, restore the session directly. Ask for mic access when Talk is tapped. |
| **Phone home** | Top row with crew name and connection status; personal availability below. Put the pending offer at the top when one exists, showing requester, task, pickup detail and destination where known. Follow with two clear actions, Accept and Decline. Anchor the main Talk control in thumb reach above the device safe area. Put active work and recent activity beneath the offer. |
| **Phone voice** | Open a bottom sheet with an explicit subject, one large mic control, a short agent response or transcript excerpt, and End. Show actual SDK states such as connecting, listening, speaking, and ended. If permission is denied, provide a text update action. Keep the offer context when returning from settings or retrying. |
| **Phone active handoff** | Show the latest factual instructions, the responsible person, and the next role-appropriate action. The runner sees “Report delivered.” The requester sees “Confirm received.” An old notification should lead to the current request state. |
| **Desktop board** | Wide workspace with active requests and the current owner in a main list. Show an adjacent activity timeline with actor name, action, and time. A small crew availability list can sit below the timeline. Selecting a request reveals its facts and history. Keep the current handoff legible from across a judging table. |

**Original visual system.** Use warm off-white surfaces, dark ink, restrained teal for action and voice, and amber for genuine blockers. Use text plus an icon for each status. Use an available sans like Geist or Inter and tabular numerals for timestamps. Aim for a 16px mobile body, short descriptive labels, generous touch controls around 48px, a clear focus ring, and readable muted text. Give the active offer the strongest hierarchy. Use one modest voice animation tied to real SDK state and honor reduced motion. Keep summaries to a sensible length with the full location and instruction available on tap. Let long room names wrap.

**Design references reviewed.** Borrow interaction principles and build an original interface.

| Reference | How to apply it |
|---|---|
| Linear | Use its issue/activity relationship as a reference for a selected request beside its history. Use timestamped, scannable rows. [Linear](https://linear.app/) |
| Intercom | Study its shared inbox for ownership, context and handoff history. Show who is currently expected to act. [Intercom](https://www.intercom.com/) · [Inbox](https://www.intercom.com/helpdesk/inbox) |
| SaaSUI | Compare dashboard, navigation and empty-state patterns. The first empty state should let the user ask for help immediately. [SaaSUI](https://www.saasui.design/) |
| Dribbble | The radio mockup's large talk control is useful for thumb reach. Use tap-to-start/end labels that match our actual audio behavior. [Dribbble](https://dribbble.com/) · [Radio app study](https://dribbble.com/shots/2102669-Radio-App-UI-Mockup) |
| shadcn/ui | Use a Button, Sheet and Badge where compatible with the scaffold. Keep the component set small and theme it consistently. [shadcn/ui](https://ui.shadcn.com/) · [Sheet](https://ui.shadcn.com/docs/components/base/sheet) |
| 21st.dev | Study the voice indicator's change between idle and active states. A small CSS implementation bound to ElevenLabs callbacks is sufficient. [21st.dev](https://21st.dev/) · [Voice indicator study](https://dev.21st.dev/@starc007/components/voice-orb) |

**Visual acceptance.** Check 360px and 390px phone widths, landscape on the demo laptop, keyboard-only actions, reduced motion, and long offer text. Confirm the dock clears the last activity row and the mobile keyboard. At 1280px wide, a judge should be able to read the active request and newest change simultaneously. Use actual names, times, states, and offer copy. Decorative charts, invented metrics, and permanent bouncing waveforms consume room needed for the task.

## 6. Hypothetical live demo | The missing adapter

**Setup.** Laptop with the shared board open as Jo, the requester. Phone A belongs to Alex, an AV volunteer. Phone B belongs to Maya, a runner. Jules is a seeded member covering a protected entrance. Place one real adapter where the judge can choose between two plausible locations, or have the judge give Alex a location phrase to use. Both phones join via the same URL, use separate identities, and keep the app open. Space microphones apart or use headphones.

| Time in the two-minute video | Live action | What should appear |
|---|---|---|
| 0:00–0:15 | Start on the running board. Jo says, “We need a USB-C to HDMI adapter in Demo Room B. Can someone get one here?” | A request appears from Jo. Alex receives an offer because the roster shows AV skills and current availability. Jules stays at the entrance. |
| 0:15–0:40 | Alex taps the offer and says, “I can't leave the projector. The spare is in the blue pouch by registration.” Use the judge's location if they supplied one. | The decline lands once. The request retains the pickup detail. The planner reconsiders eligible people. |
| 0:40–1:05 | Maya opens the incoming offer on phone B. Crew Radio asks her to collect the adapter at the location Alex just mentioned and bring it to Room B. Maya says, “I can take it.” | The board shows Maya as responsible and the handoff in progress. |
| 1:05–1:30 | Maya brings the prop and taps or says “Delivered.” Pause on the board. | The request shows “Awaiting confirmation.” Jo can confirm. |
| 1:30–1:50 | Jo confirms, “The adapter's here.” | The board shows Done and the history connects the request, decline, replacement, delivery, and receipt. |
| 1:50–2:00 | Show the two phone views beside the board, or show the location the judge supplied in Maya's offer. | The audience can verify exactly which new fact traveled between devices. |

**Expo variation.** Let the judge replace the pickup location or speak Maya's reply in their own words. If Maya declines too, leave the request open and state who was already asked. If time allows, have Alex later report availability and verify whether the team deliberately makes an earlier decliner eligible again. For the MVP, an explicit new request or explicit opt-in is needed before asking a previous decliner again.

**Generality check.** Reset a separate fixture with a packing station, reserve shelf, and cart. Change the goal to “We need an empty cart at packing.” The same tool schema, planner prompt, buttons, and state transitions must work. Keep event-specific labels in crew/seed data.

## 7. Schedule and cut lines

The event packet gives a 3:00 p.m. Eastern submission deadline. This compressed schedule assumes launching the agents around 12:20 p.m. Adjust earlier checkpoints to the actual start and preserve the recording/submission buffer.

| By (Toronto time) | Agent A | Agent B | Other teammates / merge gate |
|---|---|---|---|
| **12:30** | Freeze types, examples, routes, and one test scenario. | Confirm page exports and begin phone shell against fixtures. | Release lead publishes baseline. Device lead configures one ElevenLabs agent and unblocks mic permissions. |
| **12:55** | Join, real feed and one typed request on the server. | Responsive join/home and one typed request visible. | First integration. Two independent devices see the same real request. Check the public Wasp URL. |
| **1:20** | Working voice token/tool, a deployed Maritime health check, and one real planner response. | Phone voice sheet starts/ends a real SDK session. Laptop shows request activity. | Demonstrate one spoken update landing in the DB. If it fails, isolate mic, token, tool, and API in that order. |
| **1:45** | Durable decline, fact preservation, replacement offer, acceptance and receipt. | Live offers, context-aware voice sessions, clear accepted/delivered/confirmed UI. | Merge candidate. Run the whole scenario on real phones with one unexpected pickup location. |
| **2:05** | Check duplicate replies, revision races, protected post, and no eligible teammate. | Fix phone layout, keyboard/safe-area bugs, mic denial and stale offer handling. | Run a second take with different words. Freeze feature scope. |
| **2:20** | Fix only demo-blocking issues. | Fix only demo-blocking issues. | Start recording from a known-good build; capture a clean backup take and screenshots for the pitch if useful. |
| **2:45** | Confirm the deployed commit and sponsor integrations actually exercised. | Check public landing/join on a fresh device. | Finalize the two-minute video and project URL. Verify playback and permissions in a signed-out browser. |
| **2:55** | Available for fixes. | Available for fixes. | Release lead submits with the five-minute buffer and confirms receipt. |

**If time slips.** Shrink the UI to one phone page and one responsive board. Use seeded profile selection, two-second polling and a single pending offer per request. Use tap controls after one genuine voice conversation if a second microphone is unreliable. Keep a visible text input for accessibility and noisy environments. A transient planner failure leaves the request open with Retry. Show and describe only the integrations that actually ran.

## 8. Launch prompt A | Backend and coordination

Paste this into agent A with this full brief attached or committed:

> You own the server and coordination work for Crew Radio. Read the entire shared brief at docs/crew-radio-plan.md or in the attached file, then read the repo instructions and inspect the generated Wasp version. Work only on feat/coordination using your own checkout. Agent B is implementing the phone and dashboard concurrently and needs a stable contract immediately.
>
> Your first handoff is the TypeScript contract, one realistic request/offer/feed fixture including the four sample messages, the real API base/path convention, the two component exports the Wasp routes expect, and a minimal join/feed/request endpoint. Publish these early. Own the Wasp manifest, Prisma schema and migrations, src/server, src/shared/crew, demo seed, and services/planner including its Dockerfile. Ask the release lead for app-level dependency changes. Treat the client directory as read-only.
>
> Implement member-scoped join, feed and events; short-lived ElevenLabs WebRTC token issuance; a webhook with an authenticated, context-bound interaction ticket; and the Maritime service that proposes an offer or waits. Use the same mutation path for voice and tap controls. Keep planning outside the database transaction. A human report must survive a planner timeout. Apply a proposal only after validating request revision, availability, protection and prior replies. Let a declined offer carry a fact into the next person's offer. Persist the distinction between acceptance, delivery and requester confirmation.
>
> Prefer the shortest working vertical slice. Prove the planner on Maritime with one real model call and a variable pickup location. Coordinate ElevenLabs tool fields and headers with the device lead. Give B sample success, empty, stale-offer and error responses. Add focused checks for duplicate webhook delivery, simultaneous accepts, protected coverage, two people declining, and a late planner result. Verify an alternate operational scenario runs with the same schema and prompt. Keep real secrets in developer/provider configuration. Use clear names, small functions and minimal comments.
>
> Send the human lead the branch/SHA, exact local verification commands, one request/response example, tested integration status, and any remaining blocker at each merge gate. Operate on your own branch and local database. The release lead owns main, public deploys, shared credentials and demo-DB resets.

## 9. Launch prompt B | Mobile, dashboard and browser voice

Paste this into agent B with this full brief attached or committed:

> You own the user experience for Crew Radio. Read the entire shared brief at docs/crew-radio-plan.md or in the attached file, then inspect repo instructions, the Wasp scaffold, and Agent A's contract. Work on feat/crew-ui using your own checkout. Build the generic operational coordination product described here. Use the hackathon story only for sample data and QA.
>
> Own src/client, UI assets, styles, the API adapter and the ElevenLabs React SDK integration. Treat the Wasp manifest, Prisma, shared DTOs, server and planner as read-only. Send route requests to A and dependency requests to the release lead. Start immediately with the agreed fixture behind a narrow adapter. Implement join, member session restoration, incoming offers, voice, active handoff, and requester confirmation. Replace fixtures with the real adapter at the first integration gate. Keep fixtures out of release data.
>
> Design for someone holding a phone in one hand. Follow the visual system and reference table in the brief. At phone width give the offer, its new location detail, and the Talk control priority. Build an original, professional desktop board with active requests and timestamped activity visible side by side. Keep the same identities, data and permissions across layouts. Use real state labels, accessible controls, one restrained voice animation, and a usable empty state. Build the compact version first. Check at 360px, 390px, and 1280px.
>
> On a user tap, request microphone access, fetch a member-scoped voice session from Wasp, and start ElevenLabs WebRTC with the returned conversation token and dynamic variables. Use the SDK API supported by the pinned version. End and clean up an audio session when dismissed, prevent overlapping local sessions, and distinguish connecting, listening and speaking. Preserve the error message and a textual/manual way to act when mic permission or connectivity fails. Voice tool calls commit on the server; refresh the feed on acknowledgement and poll while the page is open. Only show acceptance, delivery or completion after server confirmation. Resync on 409.
>
> Deliver an early phone UI that can submit a typed request, then the live voice/offer flow. Test with the human device lead on real phones over HTTPS, including a dynamically chosen location and a second person's response. Verify that phone B receives its own offer, the laptop shows it, and neither refresh nor an expired offer creates a second acceptance. Send screenshots at both breakpoints, the branch/SHA, reproducible steps, and real-device test results to the release lead. The human lead handles merges and public deployment.

## 10. Provider references for implementation

- **Wasp** · Check the installed Wasp version and follow its generated conventions for routes, environment, and deployment. Custom APIs suit ElevenLabs webhooks. [Overview](https://wasp.sh/docs) · [Quick start](https://wasp.sh/docs/quick-start) · [Custom HTTP API](https://wasp.sh/docs/api/%40wasp.sh/spec/functions/api) · [Deployment](https://wasp.sh/docs/deployment/methods/overview)
- **ElevenLabs** · Confirm the SDK path for starting/stopping the conversation, server-issued token shape, permitted dynamic variables, and webhook header setup. [React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react) · [Get WebRTC token](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-webrtc-token) · [Webhook tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools) · [Dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables) · [Concurrency](https://elevenlabs.io/docs/help-center/product/eleven-agents/how-many-eleven-agents-requests-can-i-make-and-can-i-increase-it)
- **Maritime** · Use its container deployment guide for the public HTTPS service and configure model credentials for the selected framework. [Web service deployment](https://maritime.sh/docs/web-apps) · [Model endpoint](https://maritime.sh/docs/llm)
