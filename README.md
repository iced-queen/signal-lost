# Signal Lost

An original, two-player cooperative browser game for date nights. One player operates a malfunctioning radio workstation. The other works from a technical desk with repair procedures, a feed schematic, and private working notes. Talk to each other to restore the signal.

Works on desktop, laptop, and phone. No accounts, downloads, external assets, or paid APIs. Use your usual voice call; audio chat is not built in.

The interface is a fictional Northline night-shift radio station: a dark receiver for establishing private channels, inspectable equipment on a workbench, cable terminals, tactile memory keys, a rotary tuning knob, and a low-light technical library. Equipment responds to staged repairs, and downstream devices remain interlocked until their signal feeds are restored. All artwork and synthesized equipment audio ship with the app; nothing is fetched from a third party.

## Run locally

Requires Node.js 20 or later.

```powershell
npm ci
npm start
```

Open `http://localhost:3000`. Create a room, then open a **separate tab** to join with the room code for a quick two-player test. Each tab has its own session. The game needs both players connected and ready before the host can start.

On the receiver, **TX / HOST** opens a new channel. Enter your call sign and press **Open channel**. Your partner selects **RX / PARTNER**, enters their call sign and your six-character channel code, and presses **Connect to channel**. Invite links automatically select RX and fill the code.

To play on your home network, let Node through Windows Firewall on **private networks only**, and open `http://YOUR-PC-LAN-IP:3000` on both devices. Use that address when copying the invite; a localhost link only works on the computer that generated it. Do not forward ports on your router to expose the development server.

## Play from different homes

Deploy the app to a public HTTPS host that supports long-lived WebSocket connections. The static UI and multiplayer server run together on one port, so both players use the same URL.

### Render

1. Push this project to a GitHub repository you control.
2. In Render, create a **Blueprint** using that repository. [render.yaml](render.yaml) supplies the configuration. Alternatively create a Node web service with build command `npm ci`, start command `npm start`, and health check `/health`.
3. Wait for the deployment to complete. Open its public HTTPS URL.
4. Create a room and send your partner the invite link.

The free plan may sleep when idle and take a while to wake up. Provider availability and pricing can change. Restarting, sleeping, or redeploying the server clears rooms; start a new room if that happens. Use a paid always-on instance if you want to avoid cold starts.

### Other hosts / Docker

Any Node or Docker host with WebSocket support works. The server listens on `0.0.0.0` and honors `PORT` (default `3000`). A reverse proxy must pass WebSocket upgrades and keep the public page and socket on the same host.

```powershell
docker build -t signal-lost .
docker run --rm -p 3000:3000 signal-lost
```

Run **one server instance**. Rooms live in that instance's memory; horizontal scaling needs a shared room store and coordination, which this small private game does not use.

## A date-night session

1. Get on a voice call, or sit together without looking at each other's screens.
2. Create a private room and share the invite.
3. Choose a transmission, then both press **I'm ready**. The host launches.
4. The operator inspects a device on the workstation. The asset tag has the serial, battery cells, and LINK indicator; describe these to the analyst. The analyst sees which device is being inspected, but never its live clues.
5. Restore the power bus first, recover and calibrate the decoders, then transmit the final carrier. Incorrect repair actions cost one strike. Invalid, repeated, stale, and unpowered actions are rejected without a strike.
6. Return to the lobby, swap roles, and launch a fresh randomized mission.

| Transmission | Modules | Time | Strikes allowed |
| --- | --- | --- | --- |
| Quiet frequency | 3 | Untimed | 5 |
| Night shift | 4 | 10 minutes | 3 |
| Solar storm | 5 | 8 minutes | 3 |

The timed windows are longer than the original single-step edition to account for multi-stage repairs and equipment inspection. Quiet frequency always includes the power junction, one randomized decoder, and the final tuner. Night shift includes both decoder types. Solar storm adds an extra randomized decoder.

Reaching the strike limit ends the mission. The clock pauses and console controls lock if a player disconnects. Refreshing the same tab reconnects using its private session token. A replacement connection closes the old one. An explicit **Leave room** ends an active mission; if the host leaves, hosting passes to the remaining player.

Rooms with no connected players expire after 30 minutes. Successful transmission counts are saved locally in each browser; they are not an account or cross-device save. Analyst scratchpad notes are private to the browser tab, survive refreshes within the same mission, and clear when leaving the room.

## Modules

- **Wire junction:** isolate the faulty wire using ordered color/serial rules, then connect the bypass cable to terminal A, B, or C using the cell-count/parity table. Cut wires remain visibly disconnected and cannot be cut twice.
- **Glyph lock:** recover four memory contacts in reference-band order, then align a three-position coupler. A lit LINK indicator advances its base position, wrapping from III to I. A wrong memory press resets the sequence.
- **Pulse decoder:** latch a three-digit beacon code, then set LOCAL, CROSS, or REMOTE routing according to the number of different beacon colors.
- **Frequency tuner:** remains interlocked until all other devices are restored. Tune a corrected carrier frequency, set serial-dependent NARROW/WIDE bandwidth, then operate the transmit lever. Frequency and bandwidth are validated together.

**Operator controls:** click/tap equipment to inspect it; use **Step back** or Escape to return to the workbench. Drag the rotary knob vertically, or focus it and use arrow keys (`0.1 MHz`), Page Up/Down (`1.0 MHz`), and Home/End (range limits). The `±0.1` / `±1.0` buttons are available as touch and keyboard alternatives.

**Analyst controls:** choose reference sections from the schematic or library tabs. On phones, choosing a section brings the manual into view. The operator-line readout identifies the device and stage being inspected. Use the scratchpad for private calculations; its contents are never sent to the server or partner.

**Equipment audio:** off by default. Select **Audio off** to enable quiet room hum and mechanical/repair cues; select **Audio on** to mute. Audio starts only after an explicit user gesture and stops during disconnects or after a mission. It is not voice chat and is not required to solve any puzzle.

Controls use text labels as well as colors. Keyboard navigation and native form controls are supported. Animation respects reduced-motion preferences. There are no flashing sequences: burst marks are stationary and countable.

The rulebook is deliberately public, just like a physical game manual. Role-specific live puzzle data and solutions are never sent to the wrong player, but this is a cooperative game with an honor system, not an anti-cheat system.

## Code organization

- [lib/game.js](lib/game.js): mission generation, answer validation, progression, role-specific snapshots.
- [server.js](server.js): HTTP assets, authoritative room lifecycle, WebSocket transport, reconnects, heartbeat, timer.
- [public/rules.js](public/rules.js): shared reference tables and difficulty settings.
- [public/app.js](public/app.js): client connection, storage, UI events.
- [public/render.js](public/render.js): screen and console rendering; escapes player-provided text.
- [public/workstation.js](public/workstation.js): operator equipment overview/inspection and analyst technical desk.
- [public/ui.js](public/ui.js): shared escaping, timer, and role labels.
- [public/drafts.js](public/drafts.js): mission-scoped input resets and private-note restoration.
- [public/controls.js](public/controls.js): accessible pointer/keyboard tuning and exact-frequency display updates.
- [public/audio.js](public/audio.js): opt-in synthesized equipment audio and paused-room lifecycle.
- [public/manual.js](public/manual.js): field manual, using the same reference tables as the game engine.
- [public/style.css](public/style.css): responsive layout and visual design.
- [public/workstation.css](public/workstation.css): workbench, hardware, analyst desk, and reduced-motion scene styling.
- [test/](test/): Node's built-in test runner; no separate testing dependency.
- [test-support/repairs.js](test-support/repairs.js): server-side repair sequences shared by unit and integration tests.

## Validate

```powershell
npm test
npm run check
```

Tests cover every possible five-wire combination, generated missions, staged calibration, dependency interlocks, input and bandwidth validation, stale-command rejection, win/loss behavior, inspection privacy, reference rendering, tuning bounds, audio lifecycle, two-player sessions, reconnects, paused clocks, host transfer, room expiry, and HTTP behavior.

After deploying this edition, both players should refresh the game before creating a new channel. Older controls do not send the mission/stage identifiers required by the updated server; their repair commands are explicitly rejected rather than applied to the wrong stage. No Render configuration or dependency changes are needed.

## Operational notes

- HTTPS protects room/session traffic on public hosts. Share invite links only with your partner; anyone with the code can take the second seat if it is empty.
- Session tokens stay in tab-scoped browser storage and are never included in partner snapshots.
- Rooms are capped at 500 by default. Messages have a 4 KB limit and a per-connection action-rate limit. This is a small friends-and-family app, not a hardened large public service.
- No telemetry or third-party resources are loaded. The server logs transport/serving errors, not gameplay or session tokens.
