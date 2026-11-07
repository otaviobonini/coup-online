// Salas, jogadores e bots — independente de transporte.
// Usado pelo servidor Node (Socket.IO) e pelo anfitrião no navegador (P2P / GitHub Pages).
import { Game } from './game.js';
import { botAct, BOT_NAMES } from './bot.js';
import { MAX_SEATS } from './rules.js';
import { randomInt, uuid } from './random.js';

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const TIMES = [8, 10, 15, 20, 30];
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function newCode() {
  return Array.from({ length: 4 }, () => CODE_ABC[randomInt(CODE_ABC.length)]).join('');
}
export const validCode = (c) => typeof c === 'string' && /^[A-Z]{4}$/.test(c);

export class RoomHub {
  /** @param {{ send: (clientId: string, ev: string, payload: any) => void }} opts */
  constructor({ send }) {
    this.send = send;
    this.rooms = new Map();
    this.clients = new Map(); // clientId -> { room, player }
  }

  // ------------------------------------------------ entrada
  handle(cid, ev, data) {
    const fn = this[`on_${ev}`];
    if (typeof fn !== 'function') return { error: 'Comando desconhecido.' };
    try {
      return fn.call(this, cid, data || {}) || { ok: true };
    } catch (e) {
      console.error(e);
      return { error: 'Erro interno.' };
    }
  }

  disconnect(cid) {
    const ctx = this.clients.get(cid);
    this.clients.delete(cid);
    if (!ctx) return;
    const { room, player } = ctx;
    if (player.clientId !== cid) return;
    player.connected = false;
    player.clientId = null;
    if (!room.game) {
      player.dropTimer = setTimeout(() => {
        if (!player.connected && this.rooms.get(room.code) === room) this.removePlayer(room, player.id);
      }, 45000);
    }
    if (room.hostId === player.id) {
      const other = this.humans(room).find((p) => p.connected);
      if (other) room.hostId = other.id;
    }
    this.checkIdle(room);
    if (this.rooms.has(room.code)) this.broadcast(room);
  }

  destroyAll() {
    for (const room of [...this.rooms.values()]) this.destroyRoom(room);
  }

  // ------------------------------------------------ utilidades
  humans(room) { return room.players.filter((p) => !p.isBot); }

  view(room, pid) {
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

  toRoom(room, ev, payload) {
    for (const p of room.players) if (!p.isBot && p.clientId) this.send(p.clientId, ev, payload);
  }

  broadcast(room) {
    for (const p of room.players) {
      if (!p.isBot && p.clientId) this.send(p.clientId, 'state', this.view(room, p.id));
    }
    this.scheduleBots(room);
  }

  scheduleBots(room) {
    for (const t of room.botTimers) clearTimeout(t);
    room.botTimers = [];
    const g = room.game;
    if (!g || g.phase === 'over') return;
    const v = g.version;
    for (const id of g.waiting()) {
      const p = g.get(id);
      if (!p?.isBot) continue;
      const delay = (g.phase === 'respond' ? 700 : 1100) + Math.random() * 1600;
      room.botTimers.push(setTimeout(() => {
        if (room.game !== g || g.version !== v) return;
        try { botAct(g, id); } catch (e) { console.error('bot', e); }
      }, delay));
    }
  }

  pickHost(room) {
    const h = this.humans(room);
    const next = h.find((p) => p.connected) || h[0];
    room.hostId = next ? next.id : null;
  }

  removePlayer(room, pid) {
    const idx = room.players.findIndex((p) => p.id === pid);
    if (idx < 0) return;
    const [p] = room.players.splice(idx, 1);
    if (room.game) {
      room.players.splice(idx, 0, { ...p, isBot: true, name: `${p.name} (bot)`, clientId: null, connected: true });
      room.game.setBot(pid, `${p.name} (bot)`);
    }
    if (room.hostId === pid) this.pickHost(room);
    if (!this.humans(room).length) return this.destroyRoom(room);
    this.broadcast(room);
  }

  destroyRoom(room) {
    room.game?.destroy();
    for (const t of room.botTimers) clearTimeout(t);
    clearTimeout(room.idleTimer);
    for (const p of room.players) clearTimeout(p.dropTimer);
    this.rooms.delete(room.code);
  }

  checkIdle(room) {
    clearTimeout(room.idleTimer);
    if (this.humans(room).some((p) => p.connected)) return;
    room.idleTimer = setTimeout(() => {
      if (!this.humans(room).some((p) => p.connected)) this.destroyRoom(room);
    }, 15 * 60 * 1000);
  }

  startGame(room, firstId) {
    room.game?.destroy();
    room.game = new Game(room.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot })), {
      responseMs: room.responseSec * 1000,
      firstId,
      onChange: () => this.broadcast(room),
      onFx: (fx) => this.toRoom(room, 'fx', fx),
    });
    this.broadcast(room);
  }

  bind(cid, room, player) {
    const prev = player.clientId;
    if (prev && prev !== cid) this.clients.delete(prev);
    this.clients.set(cid, { room, player });
    player.clientId = cid;
    player.connected = true;
    clearTimeout(player.dropTimer);
    clearTimeout(room.idleTimer);
  }

  ctx(cid) { return this.clients.get(cid); }
  isHost(cid) { const c = this.ctx(cid); return !!c && c.room.hostId === c.player.id; }

  // ------------------------------------------------ comandos
  on_create(cid, data) {
    const name = clean(data.name, 16) || 'Anônimo';
    const maxHumans = Math.min(MAX_SEATS, Math.max(1, Number(data.maxHumans) || 6));
    const responseSec = TIMES.includes(Number(data.responseSec)) ? Number(data.responseSec) : 15;
    let code = validCode(data.code) && !this.rooms.has(data.code) ? data.code : null;
    while (!code || this.rooms.has(code)) code = newCode();
    const room = { code, hostId: null, maxHumans, responseSec, players: [], game: null, botTimers: [], chat: [], idleTimer: null, lastWinner: null };
    const player = { id: uuid(), name, isBot: false, clientId: null, connected: true };
    room.players.push(player);
    room.hostId = player.id;
    this.rooms.set(code, room);
    this.bind(cid, room, player);
    this.broadcast(room);
    return { ok: true, code, playerId: player.id };
  }

  on_join(cid, data) {
    const code = clean(data.code, 4).toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { error: 'Sala não encontrada.' };
    const existing = data.playerId && room.players.find((p) => p.id === data.playerId && !p.isBot);
    if (existing) {
      this.bind(cid, room, existing);
      this.broadcast(room);
      return { ok: true, code, playerId: existing.id };
    }
    if (room.game) return { error: 'A partida já começou nessa sala.' };
    if (this.humans(room).length >= room.maxHumans) return { error: 'A sala está cheia.' };
    if (room.players.length >= MAX_SEATS) return { error: `A mesa já tem ${MAX_SEATS} lugares ocupados.` };
    let name = clean(data.name, 16) || 'Anônimo';
    while (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) name = `${name.slice(0, 13)} ${randomInt(10, 99)}`;
    const player = { id: uuid(), name, isBot: false, clientId: null, connected: true };
    room.players.push(player);
    if (!room.hostId) room.hostId = player.id;
    this.bind(cid, room, player);
    this.broadcast(room);
    return { ok: true, code, playerId: player.id };
  }

  on_addBot(cid) {
    if (!this.isHost(cid)) return { error: 'Só o anfitrião pode adicionar bots.' };
    const { room } = this.ctx(cid);
    if (room.game) return { error: 'A partida já começou.' };
    if (room.players.length >= MAX_SEATS) return { error: `Máximo de ${MAX_SEATS} lugares.` };
    const used = new Set(room.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || `Bot ${room.players.length + 1}`;
    room.players.push({ id: uuid(), name, isBot: true, connected: true });
    this.broadcast(room);
  }

  on_kick(cid, data) {
    if (!this.isHost(cid)) return { error: 'Só o anfitrião pode remover jogadores.' };
    const { room, player } = this.ctx(cid);
    if (room.game) return { error: 'Não dá para remover durante a partida.' };
    const target = room.players.find((p) => p.id === data.playerId);
    if (!target || target.id === player.id) return { error: 'Jogador inválido.' };
    if (target.clientId) { this.send(target.clientId, 'kicked', null); this.clients.delete(target.clientId); }
    clearTimeout(target.dropTimer);
    room.players = room.players.filter((p) => p.id !== target.id);
    this.broadcast(room);
  }

  on_settings(cid, data) {
    if (!this.isHost(cid)) return { error: 'Só o anfitrião muda as regras.' };
    const { room } = this.ctx(cid);
    if (room.game) return { error: 'A partida já começou.' };
    if (data.maxHumans) room.maxHumans = Math.min(MAX_SEATS, Math.max(this.humans(room).length, 1, Number(data.maxHumans)));
    if (TIMES.includes(Number(data.responseSec))) room.responseSec = Number(data.responseSec);
    this.broadcast(room);
  }

  on_start(cid) {
    if (!this.isHost(cid)) return { error: 'Só o anfitrião pode iniciar.' };
    const { room } = this.ctx(cid);
    if (room.game && room.game.phase !== 'over') return { error: 'A partida já está rolando.' };
    if (room.players.length < 2) return { error: 'Precisa de pelo menos 2 jogadores (adicione bots!).' };
    this.startGame(room, room.lastWinner);
  }

  on_backToLobby(cid) {
    if (!this.isHost(cid)) return { error: 'Só o anfitrião pode fazer isso.' };
    const { room } = this.ctx(cid);
    if (room.game && room.game.phase !== 'over') return { error: 'A partida ainda não acabou.' };
    room.lastWinner = room.game?.winnerId ?? null;
    room.game?.destroy();
    room.game = null;
    room.players = room.players.filter((p) => !(p.isBot && p.name.endsWith('(bot)')));
    this.broadcast(room);
  }

  on_act(cid, data) {
    const c = this.ctx(cid);
    if (!c?.room.game) return { error: 'Nenhuma partida em andamento.' };
    const g = c.room.game;
    const pid = c.player.id;
    switch (data.kind) {
      case 'declare': return g.declare(pid, data.action, data.targetId);
      case 'respond': return g.respond(pid, data.type, data.role);
      case 'lose': return g.chooseLose(pid, data.index);
      case 'exchange': return g.chooseExchange(pid, data.keep);
      default: return { error: 'Comando inválido.' };
    }
  }

  on_chat(cid, data) {
    const c = this.ctx(cid);
    if (!c) return;
    const t = clean(typeof data === 'string' ? data : data.text, 160);
    if (!t) return;
    const msg = { id: Date.now() + Math.random(), name: c.player.name, playerId: c.player.id, text: t };
    c.room.chat.push(msg);
    if (c.room.chat.length > 60) c.room.chat.shift();
    this.toRoom(c.room, 'chat', msg);
  }

  on_leave(cid) {
    const c = this.ctx(cid);
    if (!c) return;
    this.clients.delete(cid);
    this.removePlayer(c.room, c.player.id);
  }
}
