// Camada de rede com a mesma API do Socket.IO (on / emit com ack).
// - Servido pelo Node: usa Socket.IO.
// - Sem servidor (GitHub Pages): quem cria a sala vira o anfitrião e roda as salas no
//   próprio navegador; os outros se conectam a ele via WebRTC (PeerJS).
import { RoomHub, newCode } from './shared/rooms.js';

const LOCAL = 'local';
const PREFIX = 'coup-sala-v1-';

export function createNet() {
  if (typeof window.io === 'function') return socketNet();
  return p2pNet();
}

function socketNet() {
  const s = window.io({ transports: ['websocket', 'polling'] });
  return {
    mode: 'server',
    isHost: () => false,
    on: (e, f) => s.on(e, f),
    emit: (e, d, ack) => s.emit(e, d, typeof ack === 'function' ? ack : () => {}),
  };
}

function p2pNet() {
  const handlers = {};
  const fire = (e, p) => (handlers[e] || []).forEach((f) => { try { f(p); } catch (err) { console.error(err); } });

  // anfitrião
  let hub = null;
  let hostPeer = null;
  let hostCode = null;
  const conns = new Map();

  // convidado
  let peer = null;
  let conn = null;
  let seq = 0;
  const pending = new Map();
  let stayConnected = false;

  const once = (fn) => { let done = false; return (v) => { if (!done) { done = true; fn(v); } }; };

  function hostSend(cid, ev, payload) {
    if (cid === LOCAL) queueMicrotask(() => fire(ev, payload));
    else { const c = conns.get(cid); if (c?.open) c.send({ t: 'evt', ev, payload }); }
  }

  function teardownHost() {
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
    conn?.close();
    peer?.destroy();
    conn = null;
    peer = null;
    for (const a of pending.values()) a({ error: 'Conexão encerrada.' });
    pending.clear();
  }

  function createRoom(data, ack, tries = 0) {
    closeRemote();
    teardownHost();
    const code = newCode();
    hub = new RoomHub({ send: hostSend });
    const p = new window.Peer(PREFIX + code, { debug: 0 });
    hostPeer = p;
    p.on('open', () => {
      hostCode = code;
      ack(hub.handle(LOCAL, 'create', { ...data, code }));
    });
    p.on('connection', (c) => {
      c.on('open', () => conns.set(c.peer, c));
      c.on('data', (m) => {
        if (!m || m.t !== 'req' || !hub) return;
        const res = hub.handle(c.peer, m.ev, m.data);
        if (c.open) c.send({ t: 'ack', id: m.id, res });
      });
      c.on('close', () => { conns.delete(c.peer); hub?.disconnect(c.peer); });
    });
    p.on('disconnected', () => { if (hostPeer === p && !p.destroyed) p.reconnect(); });
    p.on('error', (err) => {
      if (hostCode) { console.warn('peer', err.type); return; }
      teardownHost();
      if (err.type === 'unavailable-id' && tries < 5) return createRoom(data, ack, tries + 1);
      ack({ error: `Não foi possível abrir a sala online (${err.type}). Verifique sua internet.` });
    });
  }

  function joinRemote(code, data, ackRaw) {
    const ack = once(ackRaw);
    closeRemote();
    const p = new window.Peer({ debug: 0 });
    peer = p;
    const timer = setTimeout(() => { ack({ error: 'Sala não encontrada (o anfitrião pode ter saído).' }); if (peer === p) closeRemote(); }, 12000);
    p.on('open', () => {
      const c = p.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      conn = c;
      c.on('open', () => {
        clearTimeout(timer);
        stayConnected = true;
        const id = ++seq;
        pending.set(id, ack);
        c.send({ t: 'req', id, ev: 'join', data });
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
      clearTimeout(timer);
      if (err.type === 'peer-unavailable') ack({ error: 'Sala não encontrada (o anfitrião pode ter saído).' });
      else ack({ error: `Falha de conexão (${err.type}).` });
      if (peer === p) closeRemote();
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
