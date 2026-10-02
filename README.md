# Signal Lost

An original, two-player cooperative browser game for date nights. One player sees a malfunctioning communications console. The other sees a field manual. Talk to each other to restore the signal.

Works on desktop, laptop, and phone. No accounts, downloads, external assets, or paid APIs. Use your usual voice call; audio chat is not built in.

The interface is a fictional Northline night-shift radio station: a dark, interactive receiver for establishing private channels, metal service panels, tactile symbol keys, phosphor readouts, and a low-light reference terminal. All artwork and styling ship with the app.

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
4. The operator describes modules and the serial number, battery cells, and LINK indicator. The analyst chooses the relevant manual section and guides the repairs.
5. Restore every module to win. Incorrect submissions cost one strike. Invalid/malformed inputs are rejected rather than penalized.
6. Return to the lobby, swap roles, and launch a fresh randomized mission.

| Transmission | Modules | Time | Strikes allowed |
| --- | --- | --- | --- |
| Quiet frequency | 3 | Untimed | 5 |
| Night shift | 4 | 8 minutes | 3 |
| Solar storm | 5 | 6 minutes | 3 |

Reaching the strike limit ends the mission. The clock pauses and console controls lock if a player disconnects. Refreshing the same tab reconnects using its private session token. A replacement connection closes the old one. An explicit **Leave room** ends an active mission; if the host leaves, hosting passes to the remaining player.

Rooms with no connected players expire after 30 minutes. Successful transmission counts are saved locally in each browser; they are not an account or cross-device save.

## Modules

- **Wire junction:** choose a wire using ordered color/serial rules.
- **Glyph lock:** describe four symbols and press them in the reference band's order. A wrong press resets that module's sequence.
- **Pulse decoder:** decode three colored burst readouts into a three-digit code; serial parity determines reading direction.
- **Frequency tuner:** calculate a base frequency plus battery/indicator corrections. Use the slider or `±0.1` / `±1.0` buttons and transmit.

Controls use text labels as well as colors. Keyboard navigation and native form controls are supported. Animation respects reduced-motion preferences. There are no flashing sequences: burst marks are stationary and countable.

The rulebook is deliberately public, just like a physical game manual. Role-specific live puzzle data and solutions are never sent to the wrong player, but this is a cooperative game with an honor system, not an anti-cheat system.

## Code organization

- [lib/game.js](lib/game.js): mission generation, answer validation, progression, role-specific snapshots.
- [server.js](server.js): HTTP assets, authoritative room lifecycle, WebSocket transport, reconnects, heartbeat, timer.
- [public/rules.js](public/rules.js): shared reference tables and difficulty settings.
- [public/app.js](public/app.js): client connection, storage, UI events.
- [public/render.js](public/render.js): screen and console rendering; escapes player-provided text.
- [public/manual.js](public/manual.js): field manual, using the same reference tables as the game engine.
- [public/style.css](public/style.css): responsive layout and visual design.
- [test/](test/): Node's built-in test runner; no separate testing dependency.

## Validate

```powershell
npm test
npm run check
```

Tests cover every possible five-wire combination, generated missions, input validation, win/loss behavior, manual reference rendering, two-player sessions, role isolation, reconnects, paused clocks, host transfer, room expiry, and HTTP behavior.

## Operational notes

- HTTPS protects room/session traffic on public hosts. Share invite links only with your partner; anyone with the code can take the second seat if it is empty.
- Session tokens stay in tab-scoped browser storage and are never included in partner snapshots.
- Rooms are capped at 500 by default. Messages have a 4 KB limit and a per-connection action-rate limit. This is a small friends-and-family app, not a hardened large public service.
- No telemetry or third-party resources are loaded. The server logs transport/serving errors, not gameplay or session tokens.
