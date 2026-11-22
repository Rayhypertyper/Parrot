# Crew Radio backend

The API manifest targets Wasp 0.26. The release scaffold supplies its package files and client page routes. Keep those page declarations when integrating `main.wasp.ts`. Register the crew APIs and PostgreSQL seed from this branch alongside them. The local client and server defaults are `http://localhost:3000` and `http://localhost:3001`. Use the deployed Wasp server URL as the API origin and set Wasp's `WASP_WEB_CLIENT_URL` to the frontend origin.

After integrating the scaffold, point `.env.server` at a local PostgreSQL database and run:

```sh
wasp install
wasp db migrate-dev
wasp db seed seedDemo
wasp start
```

The seed makes the `demo` crew with `jo`, `alex`, `maya`, and `jules`. Claims are exclusive and seeding again preserves claims and updates. Join once per device and retain the bearer token for later requests. To smoke-test the first slice, use Jo's token to POST this to `/crew/events`, then GET `/crew/feed` with Maya's token.

```json
{"eventId":"demo-adapter-1","kind":"request_help","text":"We need a USB-C adapter in Room B.","location":"Room B"}
```

The event reply is `{"eventId":"demo-adapter-1","requestId":"<generated-id>","result":"applied","message":"Request recorded."}`. A subsequent feed shows that request for both members. Repeat the same POST to verify the same response and a single request.

For the integration suite, point `CREW_TEST_DATABASE_URL` at a separate migrated PostgreSQL database and run `npx --yes tsx --test src/server/crew/crew.integration.test.ts` under Node 24 or later after generating the Prisma client. It acts through HTTP using independent member sessions, starts the real coordinator process, and simulates the provider responses.

## Planner

Set `CREW_PLANNER_URL` to the Maritime service's full HTTPS `/plan` URL and set `CREW_PLANNER_TOKEN` to the corresponding secret. See [coordinator setup](../../../services/planner/README.md). With candidates and no configured planner, the request remains open and the feed marks planning failed. With no eligible candidates the request stays open and the feed reports waiting.

## ElevenLabs

Set `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, and a separate random `ELEVENLABS_WEBHOOK_SECRET` in the Wasp server environment. Use a private ElevenLabs agent with WebRTC enabled, and allow the frontend origin in its security configuration. Pass the voice-session response's `conversationToken` and `dynamicVariables` to the browser SDK. Use `member_name`, `request_context` and `offer_context` in the agent prompt or first message. Keep the ticket out of the prompt.

Configure a `submit_update` webhook tool to POST JSON to your Wasp HTTPS `/crew/voice-tool` URL. Give the tool at least 20 seconds to reply.

| Header | ElevenLabs header value |
| --- | --- |
| `X-Crew-Webhook-Secret` | A workspace secret with the value of `ELEVENLABS_WEBHOOK_SECRET` |
| `X-Crew-Ticket` | Dynamic variable `secret__crew_ticket` |
| `X-ElevenLabs-Conversation-Id` | Dynamic variable `system__conversation_id` |

Send the required string `kind` and optional `text`, `location`, and `availability` strings. Kinds are `request_help`, `availability_update`, `accept`, `decline`, `blocked`, `report_delivery`, and `confirm_receipt`. For help, `text` is required and `location` is the destination. On a decline or blocker, preserve the person's words in `text` and send their exact pickup phrase as `location` if known. Availability accepts `available` or `busy`. The ticket supplies all IDs. The agent reads the returned `message` after a committed update.

Request-help and availability calls use an unscoped session. Handoff calls use a current request or offer session. A ticket binds to the issued ElevenLabs conversation and expires after 15 minutes. Repeating its committed update returns the original response. A different update needs a fresh interaction.

[ElevenLabs WebRTC tokens](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-webrtc-token) · [Webhook tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools) · [Secret dynamic variables](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables)
