# Parrot · Crew Radio

Run the phone and board against the same PostgreSQL database from a clean checkout. Use Node.js 24.22.1 or newer, npm 11.11.0 or newer, and a running local PostgreSQL server. The commands below assume a local database role matching your OS username with permission to create databases.

```sh
npm install --global @wasp.sh/wasp-cli@0.26.1
wasp install
createdb parrot_demo
# Add DATABASE_URL=postgresql://<local-user>@localhost:5432/parrot_demo to .env.server.
wasp db migrate-dev
wasp db seed seedDemo
wasp start
```

If you already have a local demo database, use its connection URL in `.env.server` and skip `createdb`. Run the seed before starting the dev server. For later sessions, run `wasp start`.

Open the [phone](http://localhost:3000/?crew=demo) or the [board](http://localhost:3000/board?crew=demo). Join with crew code `demo` and a profile code of `jo`, `alex`, `maya`, or `jules`. The server runs at `http://localhost:3001`.

## Live demo

1. Seed a dedicated demo database. Serve the compiled Wasp frontend and the required Crew Radio API routes over HTTPS. For a temporary tunnel, require a demo sign-in before serving the pages or user APIs and authenticate the ElevenLabs webhook with its headers. Set `REACT_APP_API_URL` to the public API origin when building the client. For hosted Wasp, set `WASP_WEB_CLIENT_URL` and `WASP_SERVER_URL` on the server. [Wasp environment configuration](https://wasp.sh/docs/deployment/env-vars)
2. Deploy the [Maritime planner](services/planner/README.md), verify its authenticated `/plan` with candidates, and set `CREW_PLANNER_URL` and `CREW_PLANNER_TOKEN` on Wasp.
3. Follow the [ElevenLabs agent and webhook setup](src/server/crew/README.md#elevenlabs). Set its three server variables, restart Wasp, and open the HTTPS client URL directly in each phone's browser. For a local run, leave `REACT_APP_CREW_ADAPTER` unset in `.env.client` so the phones use the HTTP adapter.
4. Open `/board?crew=demo` as `jo` on a laptop and `/?crew=demo` as `alex` and `maya` on two phones. Enter the profile codes directly if prompted. Keep both phone screens on Crew Radio. On the board, tap **Talk**, choose **Something new**, and ask for a USB-C to HDMI adapter in Room B. Wait for the agent to confirm the update and for an offer to appear on a phone and the board.
5. On the phone with the offer, tap its voice reply and start the conversation. After Crew Radio reads the offer, say, “I can't leave my station. The spare is in the blue pouch by registration.” The board should show one decline and a new offer to the other phone with that pickup location. On the second phone, open its offer, say “I can take it,” and check that the board shows the new assignee. Use a fresh voice session to report delivery and another as Jo to confirm receipt.

The teammate receives the offer inside Crew Radio. ElevenLabs reads the offer and takes the reply when the teammate opens the voice session. The board follows the persisted request, offer, and activity records.
