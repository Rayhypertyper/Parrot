# Crew Radio coordinator

Deploy this directory as the container build context on Maritime. For a ZIP deploy, put its contents at the archive root. Use Maritime's injected `PORT`. The public Web Agent URL needs to be reachable from Wasp. The planning route requires an application token. [Maritime custom containers](https://maritime.sh/docs/frameworks/custom) · [Maritime Web Agents](https://maritime.sh/docs/web-apps)

Set these in Maritime's secret and environment settings.

| Variable | Value |
| --- | --- |
| `CREW_PLANNER_TOKEN` | Random secret shared with the Wasp server |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL` | Provided by **Use Maritime LLM** or your OpenAI-compatible provider. Include its API version path in the base URL. |
| `CREW_PLANNER_MODEL` | A model offered by that endpoint that supports Chat Completions JSON mode |

Set Wasp's `CREW_PLANNER_URL` to the full HTTPS URL ending in `/plan`, and set the same `CREW_PLANNER_TOKEN` in Wasp's server environment. The public `GET /health` returns `{"ok":true}`. The protected `POST /plan` uses an Authorization bearer token. Maritime's `POST /chat` contract also works with the planning JSON as its `message` and the same secret in `context.crew_planner_token`.

Use Node 24 or later to run locally.

```sh
node services/planner/server.ts
curl -fsS http://127.0.0.1:8787/health
```

Example planning input:

```json
{
  "request": {
    "id": "r7",
    "requesterId": "jo",
    "title": "We need a USB-C to HDMI adapter in Room B.",
    "latestFact": "I have to stay with the projector. The spare is in the blue pouch by registration.",
    "pickupLocation": null,
    "destination": "Room B"
  },
  "revision": 3,
  "newEvent": {
    "kind": "decline",
    "text": "I have to stay with the projector. The spare is in the blue pouch by registration."
  },
  "candidates": [
    {"id":"maya","name":"Maya","location":"Volunteer desk","availability":"available","skills":["Runner"]}
  ],
  "priorOffers": [
    {"recipientId":"alex","status":"declined","message":"Can you bring an adapter to Room B?"}
  ]
}
```

An offer contains the echoed request ID and revision, `action: "offer"`, `memberId`, `message`, and any known verbatim `pickupLocation` and `destination`. A wait contains the echoed IDs, `action: "wait"`, and `message`.
