import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomInt } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { applyAction, createMission, DIFFICULTIES, inspectModule, missionForRole, tickMission } from './lib/game.js';

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
const send = (socket, message) => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};
const fail = (socket, text) => send(socket, { type: 'error', text });
const validName = (name) => {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 24) throw new Error('Enter a name between 1 and 24 characters.');
  return name.trim();
};

export function createGameServer({ maxRooms = 500, roomLifetime = 30 * 60 * 1000, tickInterval = 1000 } = {}) {
  const rooms = new Map();
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(req.method === 'HEAD' ? undefined : '{"status":"ok"}');
        return;
      }
      const pathname = decodeURIComponent(url.pathname);
      const file = resolve(publicDir, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(`${publicDir}${sep}`)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      const content = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EISDIR') res.writeHead(404).end('Not found');
      else if (error instanceof URIError || error instanceof TypeError) res.writeHead(400).end('Invalid request');
      else {
        console.error('Static request failed:', error);
        res.writeHead(500).end('Unable to serve this page');
      }
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on('upgrade', (req, socket, head) => {
    let valid = false;
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const origin = req.headers.origin;
      valid = pathname === '/socket' && (!origin || new URL(origin).host === req.headers.host);
    } catch {
      valid = false;
    }
    if (!valid) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (client) => wss.emit('connection', client, req));
  });

  function advanceClock(room) {
    const now = performance.now();
    if (room.mission?.phase === 'playing' && room.clockRunning) {
      tickMission(room.mission, (now - room.lastTick) / 1000);
    }
    room.lastTick = now;
    room.clockRunning = room.mission?.phase === 'playing' && room.players.length === 2
      && room.players.every((player) => player.socket?.readyState === WebSocket.OPEN);
  }
  function snapshot(room, player) {
    return {
      type: 'state', code: room.code, self: player.id, host: room.host,
      players: room.players.map(({ id, name, role, ready, socket }) => ({ id, name, role, ready, online: socket?.readyState === WebSocket.OPEN })),
      difficulty: room.difficulty, mission: missionForRole(room.mission, player.role),
      paused: room.players.length !== 2 || room.players.some((member) => member.socket?.readyState !== WebSocket.OPEN),
    };
  }
  function broadcast(room) {
    advanceClock(room);
    for (const player of room.players) if (player.socket) send(player.socket, snapshot(room, player));
  }
  function attach(socket, room, player) {
    if (player.socket && player.socket !== socket) {
      player.socket.close(4001, 'Reconnected from another tab');
    }
    player.socket = socket;
    socket.room = room;
    socket.player = player;
    room.lastSeen = Date.now();
    send(socket, { type: 'session', code: room.code, token: player.token });
    broadcast(room);
  }
  function requireLobby(room) {
    if (room.mission?.phase === 'playing') throw new Error('Finish this mission before changing the lobby.');
  }
  function leave(socket) {
    const room = socket.room;
    const player = socket.player;
    if (!room || !player) return;
    if (room.mission?.phase === 'playing') {
      room.mission.phase = 'lost';
      room.mission.feedback = { id: randomBytes(8).toString('hex'), kind: 'warning', text: 'A player left the mission.' };
    }
    room.players = room.players.filter((member) => member !== player);
    if (room.host === player.id) room.host = room.players[0]?.id;
    for (const member of room.players) member.ready = false;
    socket.room = null;
    socket.player = null;
    if (!room.players.length) rooms.delete(room.code);
    else broadcast(room);
    send(socket, { type: 'left' });
  }
  wss.on('connection', (socket) => {
    socket.alive = true;
    socket.bucket = { at: Date.now(), count: 0 };
    socket.on('pong', () => { socket.alive = true; });
    socket.on('error', (error) => console.error('WebSocket transport error:', error.message));
    socket.on('message', (buffer, isBinary) => {
      if (Date.now() - socket.bucket.at > 1000) socket.bucket = { at: Date.now(), count: 0 };
      if (++socket.bucket.count > 40) {
        fail(socket, 'Too many actions. Please slow down.');
        return;
      }
      let message;
      try {
        if (isBinary) throw new Error('Only text messages are supported.');
        try { message = JSON.parse(buffer.toString()); }
        catch { throw new Error('Invalid message format.'); }
        if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('Invalid message format.');
        if (message.type === 'create' || message.type === 'join' || message.type === 'resume') {
          if (socket.room) throw new Error('Leave your current room first.');
          if (message.type === 'create') {
            const name = validName(message.name);
            if (rooms.size >= maxRooms) throw new Error('The relay is full. Try again later.');
            let code;
            do { code = newCode(); } while (rooms.has(code));
            const player = { id: randomBytes(8).toString('hex'), token: randomBytes(24).toString('hex'), name, role: 'operator', ready: false };
            const room = {
              code, host: player.id, players: [player], difficulty: 'normal', mission: null,
              lastSeen: Date.now(), lastTick: performance.now(), clockRunning: false,
            };
            rooms.set(code, room);
            attach(socket, room, player);
            return;
          }
          if (typeof message.code !== 'string' || !/^[A-Z2-9]{6}$/.test(message.code)) throw new Error('Enter a six-character room code.');
          const room = rooms.get(message.code);
          if (!room) throw new Error('Room not found. It may have expired; create a new one.');
          if (message.type === 'resume') {
            const player = room.players.find((member) => member.token === message.token);
            if (!player) throw new Error('This session has expired. Join a new room.');
            attach(socket, room, player);
          } else {
            const name = validName(message.name);
            if (room.players.length >= 2) throw new Error('This room already has two players.');
            const role = room.players[0]?.role === 'operator' ? 'reader' : 'operator';
            const player = { id: randomBytes(8).toString('hex'), token: randomBytes(24).toString('hex'), name, role, ready: false };
            room.players.push(player);
            attach(socket, room, player);
          }
          return;
        }
        const { room, player } = socket;
        if (!room || !player || player.socket !== socket) throw new Error('Join a room first.');
        room.lastSeen = Date.now();
        if (message.type === 'leave') { leave(socket); return; }
        if (message.type === 'ready') {
          requireLobby(room);
          player.ready = !player.ready;
        } else if (message.type === 'difficulty') {
          requireLobby(room);
          if (player.id !== room.host) throw new Error('Only the room host can select a mission.');
          if (!Object.hasOwn(DIFFICULTIES, message.value)) throw new Error('Choose a valid mission.');
          room.difficulty = message.value;
          room.players.forEach((member) => { member.ready = false; });
        } else if (message.type === 'swap') {
          requireLobby(room);
          if (player.id !== room.host) throw new Error('Only the room host can swap roles.');
          room.players.forEach((member) => { member.role = member.role === 'operator' ? 'reader' : 'operator'; member.ready = false; });
        } else if (message.type === 'start') {
          requireLobby(room);
          if (player.id !== room.host) throw new Error('Only the room host can start a mission.');
          if (room.players.length !== 2 || room.players.some((member) => !member.ready || member.socket?.readyState !== WebSocket.OPEN)) throw new Error('Both players must be connected and ready.');
          room.mission = createMission(room.difficulty);
          room.players.forEach((member) => { member.ready = false; });
        } else if (message.type === 'inspect') {
          if (player.role !== 'operator') throw new Error('Only the operator can inspect the workstation.');
          if (!room.mission || message.missionId !== room.mission.id) throw new Error('The mission has changed. Reconnect to the current workstation.');
          advanceClock(room);
          if (room.mission.phase !== 'playing') { broadcast(room); throw new Error('This transmission has ended.'); }
          inspectModule(room.mission, message.moduleId);
        } else if (message.type === 'action') {
          if (player.role !== 'operator') throw new Error('Only the operator can use the console.');
          if (room.players.some((member) => member.socket?.readyState !== WebSocket.OPEN) || room.players.length !== 2) throw new Error('Wait for your partner to reconnect.');
          if (!room.mission) throw new Error('Start a mission first.');
          advanceClock(room);
          if (room.mission.phase !== 'playing') {
            broadcast(room);
            throw new Error('This transmission has ended. Start a new mission.');
          }
          if (message.missionId !== room.mission.id) throw new Error('The mission has changed. Reconnect to the current workstation.');
          if (typeof message.stage !== 'string') throw new Error('Your controls are out of date. Refresh to load the new workstation.');
          applyAction(room.mission, message.moduleId, message.value, message.stage);
        } else if (message.type === 'lobby') {
          requireLobby(room);
          if (player.id !== room.host) throw new Error('Only the host can return the room to the lobby.');
          room.mission = null;
          room.players.forEach((member) => { member.ready = false; });
        } else if (message.type === 'abort') {
          if (player.id !== room.host) throw new Error('Only the host can end the mission.');
          if (room.mission?.phase !== 'playing') throw new Error('No active mission to end.');
          room.mission.phase = 'lost';
          room.mission.feedback = { id: randomBytes(8).toString('hex'), kind: 'warning', text: 'Mission ended by the host.' };
        } else throw new Error('Unknown action.');
        broadcast(room);
      } catch (error) {
        if (error instanceof Error) fail(socket, error.message);
        else { console.error('Unexpected game error:', error); fail(socket, 'The relay encountered an error. Please retry.'); }
      }
    });
    socket.on('close', () => {
      const { room, player } = socket;
      if (room && player?.socket === socket) {
        player.socket = null;
        player.ready = false;
        room.lastSeen = Date.now();
        broadcast(room);
      }
    });
  });
  const ticker = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.players.some((member) => member.socket?.readyState === WebSocket.OPEN)) room.lastSeen = now;
      if (now - room.lastSeen > roomLifetime) { rooms.delete(room.code); continue; }
      if (room.mission?.phase === 'playing') {
        broadcast(room);
      }
    }
  }, tickInterval);
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.alive) { socket.terminate(); continue; }
      socket.alive = false;
      socket.ping();
    }
  }, 15000);
  server.on('close', () => { clearInterval(ticker); clearInterval(heartbeat); wss.close(); });
  return { server, rooms, wss };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const { server, wss } = createGameServer();
  server.listen(port, '0.0.0.0', () => console.log(`Signal Lost is listening on http://localhost:${port}`));
  const shutdown = () => { for (const socket of wss.clients) socket.close(1001, 'Server shutting down'); server.close(); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
