# Parrot demo: shot list

The target is a two-minute video in which one handoff survives a decline. Record three clips at the same time, drop them in `demo-footage/`, and the clips get stitched into one MP4 with the phones beside the board.

## Before you press record

These have to work first, or the demo stalls at "Couldn't plan a handoff":

- [ ] **The phones are on HTTPS.** Browsers only allow the microphone on a secure page. Use the deployed Wasp URL, or an HTTPS tunnel to `localhost:3000`. A LAN address like `http://10.x.x.x:3000` won't give you a mic.
- [ ] **The planner is set up.** Put `CREW_PLANNER_URL` and `CREW_PLANNER_TOKEN` in the Wasp server env. Check that a typed request turns into an offer.
- [ ] **Voice is set up.** Put `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` and `ELEVENLABS_WEBHOOK_SECRET` in the server env. Configure the agent's `submit_update` tool as described in `src/server/crew/README.md`, and rename the agent's prompt from "Crew Radio" to "Parrot".
- [ ] **The database is fresh.** Run `wasp db seed seedDemo` on an empty demo DB so nobody's profile is already claimed.
- [ ] **Everyone has joined.**
  - Laptop: `/board?crew=demo` as **jo**
  - Phone A: `/?crew=demo` as **alex**
  - Phone B: `/?crew=demo` as **maya**
- [ ] **Audio is under control.** Do Not Disturb is on, phones are at full brightness, and the phones are spaced apart (or the speakers wear headphones) so one mic doesn't pick up the other.
- [ ] **The prop is in place.** Put the adapter at a spot nobody has rehearsed. Let a judge choose it if you can.

## What to record

| File | Device | How |
|---|---|---|
| `phoneA-alex.mov` | Phone A, Alex | Built-in screen recording **with the microphone on**. iOS: long-press the Screen Recording control and turn on Microphone. |
| `phoneB-maya.mov` | Phone B, Maya | Same as Phone A. |
| `board.mov` | Laptop, Jo's board | macOS: Cmd-Shift-5, then Record Entire Screen. Use a full-screen browser window at 1280px wide or larger. |
| `room.mov` (optional) | Any camera | Wide shot of the three people, for the opening and closing seconds. |

**Sync cue:** start all recordings, then have someone clap once where every mic can hear it. Each clip gets lined up on that clap. Leave 3 seconds of quiet before speaking.

## Timeline

| Time | Who acts | Line or action | What has to be visible |
|---|---|---|---|
| 0:00–0:10 | Board | Hold on Jo's empty board. | The Parrot board, "No open requests". |
| 0:10–0:20 | **Jo**, laptop | Tap Talk: "We need a USB-C to HDMI adapter in Room B. Can someone get one here?" | The request appears on the board. Alex's phone shows the offer. |
| 0:20–0:40 | **Alex**, phone A | Tap "Answer by voice": "I can't leave the projector. The spare is in *[the spot the judge picked]*." | The decline lands once. The board shows "Pick up at *[spot]*" and "Looking for help". |
| 0:40–1:00 | **Maya**, phone B | The offer arrives. Read it out loud, then tap Talk: "I can take it." | Maya's offer shows **Pick up at *[spot]*** and **Bring to Room B**. The board shows Maya as responsible, "In progress". |
| 1:00–1:20 | **Maya** | Walk to the spot, bring the adapter to Jo, and tap **Report delivered**. | The board shows "Awaiting confirmation". |
| 1:20–1:40 | **Jo** | Tap **Confirm received**, or say "The adapter's here." | The board shows **Done**. The history lists the request, the decline, the re-offer, the acceptance, the delivery and the confirmation. |
| 1:40–2:00 | Board | Hold on the history. Point at the pickup spot in Maya's offer. | The audience can see the judge's location travel from Alex to Maya. |

**Backup take:** do a second run with different words and a different spot. If a voice turn fails, use the typed fallback: tap "Type instead", or use the decline field's pickup box. It's the same backend, so the take is still valid.

## Handing over the footage

Copy the files into `demo-footage/` in the repo folder (git ignores it). Keep the original files and don't trim them. A note with the clap timestamp in each file helps but isn't required.
