// Camada de rede com a mesma API do Socket.IO (on / emit com ack).
// - Servido pelo Node: usa Socket.IO no mesmo endereço.
// - GitHub Pages com SERVER_URL (config.js): usa Socket.IO nesse servidor.
// - GitHub Pages sem servidor: quem cria a sala vira o anfitrião e roda as salas no
//   próprio navegador; os outros se conectam a ele via WebRTC (PeerJS).
import { RoomHub, newCode } from './shared/rooms.js';
import { SERVER_URL, EXTRA_ICE_SERVERS } from './config.js';

const LOCAL = 'local';
const PREFIX = 'mascarada-sala-v1-';
const SOCKET_IO_CDN = 'https://cdn.jsdelivr.net/npm/socket.io-client@4.8.1/dist/socket.io.min.js';

// STUN descobre o endereço público; TURN retransmite quando a conexão direta é bloqueada.
const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
  {
    urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  ...EXTRA_ICE_SERVERS,
];
const PEER_OPTS = { debug: 0, config: { iceServers: ICE_SERVERS } };

const JOIN_TRIES = 3;
const JOIN_TIMEOUT = 15000;
const PING_MS = 10000;

const NET_BLOCKED = 'Não foi possível conectar ao anfitrião. A rede de um de vocês pode estar bloqueando a conexão direta '
  + '(comum em 4G e Wi-Fi de faculdade/empresa). Tente outra rede, ou peça para outra pessoa criar a sala.';

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error(`falha ao carregar ${src}`));
    document.head.append(s);
  });
}

export async function createNet() {
  if (typeof window.io === 'function') return socketNet(window.io({ transports: ['websocket', 'polling'] }));
  if (SERVER_URL) {
    try {
      await loadScript(SOCKET_IO_CDN);
      return socketNet(window.io(SERVER_URL, { transports: ['websocket', 'polling'] }));
    } catch (e) {
      console.error(e);
    }
  }
  return p2pNet();
}

function socketNet(s) {
  const handlers = [];
  let warned = false;
  s.on('connect_error', () => {
    if (warned) return;
    warned = true;
    handlers.forEach((f) => f({ text: 'Não foi possível falar com o servidor do jogo. Tentando de novo…', kind: 'error' }));
  });
  s.on('connect', () => { warned = false; });
  return {
    mode: 'server',
    isHost: () => false,
    on: (e, f) => (e === 'netstatus' ? handlers.push(f) : s.on(e, f)),
    emit: (e, d, ack) => s.emit(e, d, typeof ack === 'function' ? ack : () => {}),
  };
}

function p2pNet() {
  const handlers = {};
  const fire = (e, p) => (handlers[e] || []).forEach((f) => { try { f(p); } catch (err) { console.error(err); } });
  const status = (text, kind = '') => fire('netstatus', { text, kind });

  // anfitrião
  let hub = null;
  let hostPeer = null;
  let hostCode = null;
  const conns = new Map();
  let hostPing = null;

  // convidado
  let peer = null;
  let conn = null;
  let seq = 0;
  const pending = new Map();
  let stayConnected = false;
  let joinGen = 0;
  let guestPing = null;

  const once = (fn) => { let done = false; return (v) => { if (!done) { done = true; fn(v); } }; };

  /** Chama onFail se a negociação WebRTC (ICE) falhar — sinal de rede bloqueando. */
  function watchIce(c, onFail) {
    let tries = 0;
    const attach = () => {
      const pc = c.peerConnection;
      if (!pc) { if (++tries < 100) setTimeout(attach, 100); return; }
      pc.addEventListener('iceconnectionstatechange', () => {
        if (pc.iceConnectionState === 'failed') onFail();
      });
    };
    attach();
  }

  function hostSend(cid, ev, payload) {
    if (cid === LOCAL) queueMicrotask(() => fire(ev, payload));
    else { const c = conns.get(cid); if (c?.open) c.send({ t: 'evt', ev, payload }); }
  }

  function teardownHost() {
    clearInterval(hostPing);
    hostPing = null;
    hub?.destroyAll();
    hub = null;
    for (const c of conns.values()) c.close();
    conns.clear();
    hostPeer?.destroy();
    hostPeer = null;
    hostCode = null;
  }

  function closeRemote() {
    stayConnected = false;
    clearInterval(guestPing);
    guestPing = null;
    conn?.close();
    peer?.destroy();
    conn = null;
    peer = null;
    for (const a of pending.values()) a({ error: 'Conexão encerrada.' });
    pending.clear();
  }

  /** Mantém o anfitrião registrado no servidor de salas: sem isso, quem chega depois não acha a sala. */
  function keepHostRegistered(p, n = 0) {
    setTimeout(() => {
      if (hostPeer !== p || p.destroyed || !p.disconnected) return;
      try { p.reconnect(); } catch { /* tenta de novo */ }
      keepHostRegistered(p, n + 1);
    }, Math.min(1000 * 2 ** n, 15000));
  }

  function createRoom(data, ack, tries = 0) {
    closeRemote();
    teardownHost();
    const code = newCode();
    hub = new RoomHub({ send: hostSend });
    const p = new window.Peer(PREFIX + code, PEER_OPTS);
    hostPeer = p;
    p.on('open', () => {
      if (hostCode) { status('Sala online de novo — novos jogadores já podem entrar.'); return; }
      hostCode = code;
      ack(hub.handle(LOCAL, 'create', { ...data, code }));
      hostPing = setInterval(() => { for (const c of conns.values()) if (c.open) c.send({ t: 'ping' }); }, PING_MS);
    });
    p.on('connection', (c) => {
      c.on('open', () => conns.set(c.peer, c));
      c.on('data', (m) => {
        if (!m || m.t !== 'req' || !hub) return;
        const res = hub.handle(c.peer, m.ev, m.data);
        if (c.open) c.send({ t: 'ack', id: m.id, res });
      });
      c.on('close', () => { conns.delete(c.peer); hub?.disconnect(c.peer); });
      c.on('error', () => { conns.delete(c.peer); hub?.disconnect(c.peer); });
    });
    p.on('disconnected', () => {
      if (hostPeer !== p || p.destroyed) return;
      status('A sala perdeu contato com o servidor de salas; reconectando… (quem já está na mesa continua jogando)', 'error');
      keepHostRegistered(p);
    });
    p.on('error', (err) => {
      if (hostCode) { console.warn('peer', err.type); return; }
      teardownHost();
      if (err.type === 'unavailable-id' && tries < 5) return createRoom(data, ack, tries + 1);
      ack({ error: `Não foi possível abrir a sala online (${err.type}). Verifique sua internet.` });
    });
  }

  function joinRemote(code, data, ackRaw, attempt = 1, gen = ++joinGen) {
    if (gen !== joinGen) return;
    const ack = once(ackRaw);
    closeRemote();
    if (attempt > 1) status(`Conectando à sala ${code}… (tentando de novo)`);
    const p = new window.Peer(PEER_OPTS);
    peer = p;
    let settled = false;
    const fail = (kind, msg) => {
      if (settled || gen !== joinGen) return;
      settled = true;
      clearTimeout(timer);
      if (peer === p) closeRemote();
      const maxTries = kind === 'notfound' ? 2 : JOIN_TRIES;
      if (attempt < maxTries) return setTimeout(() => joinRemote(code, data, ackRaw, attempt + 1, gen), 1000);
      ack({ error: msg });
    };
    const timer = setTimeout(() => fail('timeout', NET_BLOCKED), JOIN_TIMEOUT);

    p.on('open', () => {
      const c = p.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      conn = c;
      watchIce(c, () => fail('ice', NET_BLOCKED));
      c.on('open', () => {
        if (settled || gen !== joinGen) return c.close();
        settled = true;
        clearTimeout(timer);
        stayConnected = true;
        const id = ++seq;
        pending.set(id, ack);
        c.send({ t: 'req', id, ev: 'join', data });
        guestPing = setInterval(() => { if (c.open) c.send({ t: 'ping' }); }, PING_MS);
      });
      c.on('data', (m) => {
        if (m?.t === 'evt') fire(m.ev, m.payload);
        else if (m?.t === 'ack') { const a = pending.get(m.id); pending.delete(m.id); a?.(m.res); }
      });
      c.on('close', () => {
        if (conn !== c) return;
        const reconnect = stayConnected;
        closeRemote();
        if (reconnect) { fire('disconnect'); setTimeout(() => fire('connect'), 2500); }
      });
    });
    p.on('error', (err) => {
      if (err.type === 'peer-unavailable') fail('notfound', 'Sala não encontrada. Confira o código — ou o anfitrião fechou a aba.');
      else fail('net', `Falha de conexão (${err.type}). Verifique sua internet.`);
    });
  }

  setTimeout(() => fire('connect'), 0);

  return {
    mode: 'p2p',
    isHost: () => !!hub && hub.rooms.size > 0,
    on(e, f) { (handlers[e] ||= []).push(f); },
    emit(e, d, ack) {
      ack = typeof ack === 'function' ? ack : () => {};
      if (!window.Peer) return ack({ error: 'Não foi possível carregar o módulo de conexão. Recarregue a página.' });
      if (e === 'create') return createRoom(d || {}, ack);
      if (e === 'join') {
        const code = String(d?.code || '').toUpperCase();
        if (hub && code === hostCode) return ack(hub.handle(LOCAL, 'join', d));
        return joinRemote(code, d, ack);
      }
      if (hub) {
        const r = hub.handle(LOCAL, e, d);
        if (e === 'leave') teardownHost();
        return ack(r);
      }
      if (conn?.open) {
        const id = ++seq;
        pending.set(id, ack);
        conn.send({ t: 'req', id, ev: e, data: d });
        if (e === 'leave') setTimeout(closeRemote, 300);
        return;
      }
      ack({ error: 'Sem conexão com o anfitrião.' });
    },
  };
}
