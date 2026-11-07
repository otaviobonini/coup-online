import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomInt } from 'node:crypto';
import { Server } from 'socket.io';
import { Game } from './game.js';
import { botAct, BOT_NAMES } from './bot.js';
import { MAX_SEATS } from '../shared/rules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(root, 'public')));
app.use('/shared', express.static(path.join(root, 'shared')));
app.get('/health', (_req, res) => res.send('ok'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

/** @type {Map<string, any>} */
const rooms = new Map();

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => A[randomInt(A.length)]).join(''); } while (rooms.has(c));
  return c;
}

function roomView(room, pid) {
  return {
    code: room.code,
    hostId: room.hostId,
    maxHumans: room.maxHumans,
    responseSec: room.responseSec,
    you: pid,
    players: room.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, connected: p.isBot || p.connected })),
    game: room.game ? room.game.view(pid) : null,
    chat: room.chat.slice(-40),
  };
}

function broadcast(room) {
  for (const p of room.players) {
    if (!p.isBot && p.socketId) io.to(p.socketId).emit('state', roomView(room, p.id));
  }
  scheduleBots(room);
}

function scheduleBots(room) {
  for (const t of room.botTimers) clearTimeout(t);
  room.botTimers = [];
  const g = room.game;
  if (!g || g.phase === 'over') return;
  const v = g.version;
  for (const id of g.waiting()) {
    const p = g.get(id);
    if (!p?.isBot) continue;
    const base = g.phase === 'respond' ? 700 : 1100;
    const delay = base + Math.random() * 1600;
    room.botTimers.push(setTimeout(() => {
      if (room.game !== g || g.version !== v) return;
      try { botAct(g, id); } catch (e) { console.error('bot', e); }
    }, delay));
  }
}

function humans(room) { return room.players.filter((p) => !p.isBot); }

function pickHost(room) {
  const h = humans(room);
  const next = h.find((p) => p.connected) || h[0];
  room.hostId = next ? next.id : null;
}

function removePlayer(room, pid) {
  const idx = room.players.findIndex((p) => p.id === pid);
  if (idx < 0) return;
  const [p] = room.players.splice(idx, 1);
  if (room.game) {
    // Em jogo: o lugar continua, controlado por um bot.
    room.players.splice(idx, 0, { ...p, isBot: true, name: `${p.name} (bot)`, socketId: null, connected: true });
    room.game.setBot(pid, `${p.name} (bot)`);
  }
  if (room.hostId === pid) pickHost(room);
  if (!humans(room).length) return destroyRoom(room);
  broadcast(room);
}

function destroyRoom(room) {
  room.game?.destroy();
  for (const t of room.botTimers) clearTimeout(t);
  clearTimeout(room.idleTimer);
  rooms.delete(room.code);
}

function checkIdle(room) {
  clearTimeout(room.idleTimer);
  if (humans(room).some((p) => p.connected)) return;
  room.idleTimer = setTimeout(() => {
    if (!humans(room).some((p) => p.connected)) destroyRoom(room);
  }, 15 * 60 * 1000);
}

function startGame(room, firstId) {
  room.game?.destroy();
  const g = new Game(room.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot })), {
    responseMs: room.responseSec * 1000,
    firstId,
    onChange: () => broadcast(room),
    onFx: (fx) => io.to(room.code).emit('fx', fx),
  });
  room.game = g;
  broadcast(room);
}

io.on('connection', (socket) => {
  let ctx = null; // { room, player }

  const bind = (room, player) => {
    ctx = { room, player };
    player.socketId = socket.id;
    player.connected = true;
    clearTimeout(player.dropTimer);
    socket.join(room.code);
    clearTimeout(room.idleTimer);
  };
  const ok = (ack, data = {}) => typeof ack === 'function' && ack({ ok: true, ...data });
  const fail = (ack, error) => typeof ack === 'function' && ack({ error });
  const isHost = () => ctx && ctx.room.hostId === ctx.player.id;

  socket.on('create', (data = {}, ack) => {
    const name = clean(data.name, 16) || 'Anônimo';
    const maxHumans = Math.min(MAX_SEATS, Math.max(1, Number(data.maxHumans) || 6));
    const responseSec = [8, 10, 15, 20, 30].includes(Number(data.responseSec)) ? Number(data.responseSec) : 15;
    const room = {
      code: newCode(), hostId: null, maxHumans, responseSec,
      players: [], game: null, botTimers: [], chat: [], idleTimer: null, lastWinner: null,
    };
    const player = { id: randomUUID(), name, isBot: false, socketId: null, connected: true };
    room.players.push(player);
    room.hostId = player.id;
    rooms.set(room.code, room);
    bind(room, player);
    ok(ack, { code: room.code, playerId: player.id });
    broadcast(room);
  });

  socket.on('join', (data = {}, ack) => {
    const code = clean(data.code, 4).toUpperCase();
    const room = rooms.get(code);
    if (!room) return fail(ack, 'Sala não encontrada.');
    // Reconexão
    const existing = data.playerId && room.players.find((p) => p.id === data.playerId && !p.isBot);
    if (existing) {
      if (existing.socketId && existing.socketId !== socket.id) io.sockets.sockets.get(existing.socketId)?.leave(room.code);
      bind(room, existing);
      ok(ack, { code, playerId: existing.id });
      return broadcast(room);
    }
    if (room.game) return fail(ack, 'A partida já começou nessa sala.');
    if (humans(room).length >= room.maxHumans) return fail(ack, 'A sala está cheia.');
    if (room.players.length >= MAX_SEATS) return fail(ack, `A mesa já tem ${MAX_SEATS} lugares ocupados.`);
    let name = clean(data.name, 16) || 'Anônimo';
    while (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) name = `${name.slice(0, 13)} ${randomInt(10, 99)}`;
    const player = { id: randomUUID(), name, isBot: false, socketId: null, connected: true };
    room.players.push(player);
    if (!room.hostId) room.hostId = player.id;
    bind(room, player);
    ok(ack, { code, playerId: player.id });
    broadcast(room);
  });

  socket.on('addBot', (_d, ack) => {
    if (!isHost()) return fail(ack, 'Só o anfitrião pode adicionar bots.');
    const room = ctx.room;
    if (room.game) return fail(ack, 'A partida já começou.');
    if (room.players.length >= MAX_SEATS) return fail(ack, `Máximo de ${MAX_SEATS} lugares.`);
    const used = new Set(room.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || `Bot ${room.players.length + 1}`;
    room.players.push({ id: randomUUID(), name, isBot: true, connected: true });
    ok(ack);
    broadcast(room);
  });

  socket.on('kick', (data = {}, ack) => {
    if (!isHost()) return fail(ack, 'Só o anfitrião pode remover jogadores.');
    const room = ctx.room;
    if (room.game) return fail(ack, 'Não dá para remover durante a partida.');
    const target = room.players.find((p) => p.id === data.playerId);
    if (!target || target.id === ctx.player.id) return fail(ack, 'Jogador inválido.');
    if (target.socketId) io.to(target.socketId).emit('kicked');
    room.players = room.players.filter((p) => p.id !== target.id);
    ok(ack);
    broadcast(room);
  });

  socket.on('settings', (data = {}, ack) => {
    if (!isHost()) return fail(ack, 'Só o anfitrião muda as regras.');
    const room = ctx.room;
    if (room.game) return fail(ack, 'A partida já começou.');
    if (data.maxHumans) room.maxHumans = Math.min(MAX_SEATS, Math.max(humans(room).length, 1, Number(data.maxHumans)));
    if ([8, 10, 15, 20, 30].includes(Number(data.responseSec))) room.responseSec = Number(data.responseSec);
    ok(ack);
    broadcast(room);
  });

  socket.on('start', (_d, ack) => {
    if (!isHost()) return fail(ack, 'Só o anfitrião pode iniciar.');
    const room = ctx.room;
    if (room.game && room.game.phase !== 'over') return fail(ack, 'A partida já está rolando.');
    if (room.players.length < 2) return fail(ack, 'Precisa de pelo menos 2 jogadores (adicione bots!).');
    startGame(room, room.lastWinner);
    ok(ack);
  });

  socket.on('backToLobby', (_d, ack) => {
    if (!isHost()) return fail(ack, 'Só o anfitrião pode fazer isso.');
    const room = ctx.room;
    if (room.game && room.game.phase !== 'over') return fail(ack, 'A partida ainda não acabou.');
    room.lastWinner = room.game?.winnerId ?? null;
    room.game?.destroy();
    room.game = null;
    // Quem saiu durante o jogo (virou bot) deixa a sala; mantém os bots normais.
    room.players = room.players.filter((p) => !(p.isBot && p.name.endsWith('(bot)')));
    ok(ack);
    broadcast(room);
  });

  socket.on('act', (data = {}, ack) => {
    if (!ctx?.room.game) return fail(ack, 'Nenhuma partida em andamento.');
    const g = ctx.room.game;
    const pid = ctx.player.id;
    let r;
    switch (data.kind) {
      case 'declare': r = g.declare(pid, data.action, data.targetId); break;
      case 'respond': r = g.respond(pid, data.type, data.role); break;
      case 'lose': r = g.chooseLose(pid, data.index); break;
      case 'exchange': r = g.chooseExchange(pid, data.keep); break;
      default: r = { error: 'Comando inválido.' };
    }
    if (r?.error) fail(ack, r.error); else ok(ack);
  });

  socket.on('chat', (text) => {
    if (!ctx) return;
    const t = clean(text, 160);
    if (!t) return;
    const room = ctx.room;
    room.chat.push({ id: Date.now() + Math.random(), name: ctx.player.name, playerId: ctx.player.id, text: t });
    if (room.chat.length > 60) room.chat.shift();
    io.to(room.code).emit('chat', room.chat[room.chat.length - 1]);
  });

  socket.on('leave', (_d, ack) => {
    if (!ctx) return ok(ack);
    const { room, player } = ctx;
    socket.leave(room.code);
    ctx = null;
    removePlayer(room, player.id);
    ok(ack);
  });

  socket.on('disconnect', () => {
    if (!ctx) return;
    const { room, player } = ctx;
    if (player.socketId !== socket.id) return;
    player.connected = false;
    player.socketId = null;
    if (!room.game) {
      // No lobby, libera o lugar se não voltar em 45s.
      player.dropTimer = setTimeout(() => {
        if (!player.connected && rooms.get(room.code) === room) removePlayer(room, player.id);
      }, 45000);
    }
    if (room.hostId === player.id) {
      const other = humans(room).find((p) => p.connected);
      if (other) room.hostId = other.id;
    }
    checkIdle(room);
    if (rooms.has(room.code)) broadcast(room);
  });
});

server.listen(PORT, () => console.log(`🎭 Mascarada rodando em http://localhost:${PORT}`));
