import { ROLES, ROLE_KEYS, ACTIONS, ACTION_KEYS, MAX_SEATS, COUP_COST, FORCED_COUP, copiesFor } from './shared/rules.js';
import { createNet } from './net.js';
import { injectDefs, portrait, cardBack, avatar, coinSvg, loadCardImages, hasImage } from './art.js';

injectDefs();
await loadCardImages();

// ---------------------------------------------------------------- utilidades
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('coup.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('coup.' + k, JSON.stringify(v)); } catch { /* ok */ } },
  del(k) { try { localStorage.removeItem('coup.' + k); } catch { /* ok */ } },
};
const HUES = [42, 350, 175, 215, 140, 280, 20, 195, 320];
const roleName = (r) => ROLES[r]?.name ?? r;

function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

// ---------------------------------------------------------------- som
const Sound = (() => {
  let ctx = null;
  let on = store.get('sound', true);
  const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  function tone(freq, dur = 0.12, type = 'sine', vol = 0.08, when = 0) {
    if (!on) return;
    try {
      const c = ac();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, c.currentTime + when);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
      o.connect(g).connect(c.destination);
      o.start(c.currentTime + when); o.stop(c.currentTime + when + dur + 0.02);
    } catch { /* sem áudio */ }
  }
  return {
    get on() { return on; },
    toggle() { on = !on; store.set('sound', on); return on; },
    coin() { tone(1320, 0.08, 'triangle', 0.05); tone(1760, 0.12, 'triangle', 0.04, 0.05); },
    flip() { tone(420, 0.07, 'square', 0.025); },
    turn() { tone(523, 0.15, 'sine', 0.07); tone(784, 0.25, 'sine', 0.07, 0.12); },
    alarm() { tone(220, 0.18, 'sawtooth', 0.05); tone(180, 0.25, 'sawtooth', 0.05, 0.14); },
    good() { tone(660, 0.12, 'sine', 0.06); tone(990, 0.2, 'sine', 0.06, 0.1); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.06, i * 0.12)); },
  };
})();

// ---------------------------------------------------------------- estado
const S = {
  room: null,
  me: null,
  clockOffset: 0,
  targeting: null,
  exchangeSel: [],
  seen: { log: 0, chat: 0 },
  lastPhaseKey: '',
};

const socket = createNet();
const PAGE = location.pathname;
window.addEventListener('beforeunload', (e) => {
  if (socket.isHost() && S.room) { e.preventDefault(); e.returnValue = ''; }
});

function emit(ev, data) {
  return new Promise((res) => socket.emit(ev, data, (r) => {
    if (r?.error) toast(r.error, 'error');
    res(r || {});
  }));
}

socket.on('connect', () => {
  const sess = store.get('session');
  if (sess?.code && sess?.playerId) {
    socket.emit('join', { code: sess.code, playerId: sess.playerId, name: store.get('name', '') }, (r) => {
      if (r?.error) { store.del('session'); S.room = null; showScreen('home'); if (sess.code) toast(r.error, 'error'); }
    });
  }
});
socket.on('disconnect', () => toast('Conexão perdida… tentando reconectar.', 'error'));
socket.on('kicked', () => { store.del('session'); S.room = null; showScreen('home'); toast('Você foi removido da sala.', 'error'); });
socket.on('state', (room) => {
  S.room = room;
  S.me = room.you;
  if (room.game) S.clockOffset = room.game.serverNow - Date.now();
  render();
});
socket.on('fx', (e) => handleFx(e));
socket.on('chat', (m) => {
  if (!S.room) return;
  S.room.chat.push(m);
  renderChat();
  if (m.playerId !== S.me) {
    showBubble(m.playerId, m.text, null, 'chat');
    if ($('#side-chat').classList.contains('hidden')) $('#chat-dot').classList.remove('hidden');
  }
});

// ---------------------------------------------------------------- telas
function showScreen(name) {
  for (const s of ['home', 'lobby', 'game']) $(`#screen-${s}`).classList.toggle('hidden', s !== name);
  document.body.dataset.screen = name;
}

function render() {
  const r = S.room;
  if (!r) return showScreen('home');
  if (r.game) { showScreen('game'); renderGame(); } else { showScreen('lobby'); renderLobby(); }
  renderChat();
}

// ---------------------------------------------------------------- início
(function initHome() {
  $('#in-name').value = store.get('name', '');
  const seg = $('#seg-humans');
  let humans = store.get('humans', 6);
  seg.innerHTML = Array.from({ length: MAX_SEATS }, (_, i) => `<button type="button" data-n="${i + 1}">${i + 1}</button>`).join('');
  const paint = () => $$('button', seg).forEach((b) => b.classList.toggle('active', +b.dataset.n === humans));
  seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; humans = +b.dataset.n; store.set('humans', humans); paint(); });
  paint();

  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
    $('#tab-create').classList.toggle('hidden', t.dataset.tab !== 'create');
    $('#tab-join').classList.toggle('hidden', t.dataset.tab !== 'join');
  }));

  const url = new URL(location.href);
  const code = url.searchParams.get('sala');
  if (code) { $('.tab[data-tab=join]').click(); $('#in-code').value = code.toUpperCase().slice(0, 4); }

  const name = () => {
    const n = $('#in-name').value.trim();
    if (!n) { toast('Digite seu nome primeiro.', 'error'); $('#in-name').focus(); return null; }
    store.set('name', n);
    return n;
  };

  $('#btn-create').addEventListener('click', async () => {
    const n = name(); if (!n) return;
    const r = await emit('create', { name: n, maxHumans: humans, responseSec: +$('#sel-time').value });
    if (r.ok) { store.set('session', { code: r.code, playerId: r.playerId }); history.replaceState(null, '', `${PAGE}?sala=${r.code}`); }
  });
  const join = async () => {
    const n = name(); if (!n) return;
    const c = $('#in-code').value.trim().toUpperCase();
    if (c.length !== 4) return toast('O código tem 4 letras.', 'error');
    const r = await emit('join', { code: c, name: n });
    if (r.ok) { store.set('session', { code: r.code, playerId: r.playerId }); history.replaceState(null, '', `${PAGE}?sala=${r.code}`); }
  };
  $('#btn-join').addEventListener('click', join);
  $('#in-code').addEventListener('keydown', (e) => e.key === 'Enter' && join());
  $('#in-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });

  // leque de cartas 3D
  $('#hero-fan').innerHTML = ROLE_KEYS.map((r, i) => `
    <div class="fan-card" style="--i:${i - 2}">${cardHTML(r, { big: true })}</div>`).join('');

})();

$('.coin-pile').innerHTML = [[6, 28], [24, 30], [42, 27], [14, 14], [32, 15], [23, 2]].map(([x, y]) => `<span style="left:${x}px;top:${y}px">${coinSvg()}</span>`).join('');

// ---------------------------------------------------------------- cartas
function cardHTML(role, { big = false, facedown = false } = {}) {
  const info = ROLES[role];
  const front = info ? `
      ${portrait(role)}
      <div class="card-ribbon" style="--rc:${info.color}"><span>${info.name}</span></div>
      ${big ? `<div class="card-text">${esc(info.text)}</div>` : ''}` : '';
  return `
  <div class="card ${big ? 'big' : ''} ${facedown || !info ? 'facedown' : ''} ${info && hasImage(role) ? 'img' : ''}" data-role="${role || ''}">
    <div class="card-inner">
      <div class="card-face card-front">${front}</div>
      <div class="card-face card-back">${cardBack()}</div>
    </div>
  </div>`;
}

/** Atualiza uma carta existente no lugar, animando o giro. */
function patchCard(el, role, revealed, { big = false, mine = false } = {}) {
  const prev = el.dataset.role || '';
  const want = role || '';
  if (prev !== want) {
    if (want) {
      const info = ROLES[want];
      $('.card-front', el).innerHTML = `${portrait(want)}<div class="card-ribbon" style="--rc:${info.color}"><span>${info.name}</span></div>${big ? `<div class="card-text">${esc(info.text)}</div>` : ''}`;
    }
    if (prev && want && mine) { el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); Sound.flip(); }
    else if (want && !prev) Sound.flip();
    el.dataset.role = want;
  }
  el.classList.toggle('facedown', !want);
  el.classList.toggle('img', !!want && hasImage(want));
  el.classList.toggle('dead', !!revealed);
}

// ---------------------------------------------------------------- lobby
function renderLobby() {
  const r = S.room;
  const isHost = r.hostId === S.me;
  $('#lobby-code').textContent = r.code;
  const humans = r.players.filter((p) => !p.isBot).length;
  const bots = r.players.length - humans;
  $('#lobby-count').textContent = `${r.players.length}/${MAX_SEATS} · ${humans}/${r.maxHumans} humanos${bots ? ` · ${bots} bot${bots > 1 ? 's' : ''}` : ''}`;

  const seats = [];
  r.players.forEach((p, i) => {
    seats.push(`
      <div class="lobby-seat ${p.connected ? '' : 'offline'} ${p.id === S.me ? 'me' : ''}">
        <div class="lobby-avatar">${avatar(p.name, HUES[i % HUES.length], p.isBot)}</div>
        <div class="lobby-name">${esc(p.name)}${p.id === S.me ? ' <small>(você)</small>' : ''}</div>
        <div class="lobby-tags">
          ${p.id === r.hostId ? '<span class="tag gold">anfitrião</span>' : ''}
          ${p.isBot ? '<span class="tag">bot</span>' : ''}
          ${!p.connected ? '<span class="tag red">offline</span>' : ''}
        </div>
        ${isHost && p.id !== S.me ? `<button class="kick" data-kick="${p.id}" title="Remover">✕</button>` : ''}
      </div>`);
  });
  for (let i = r.players.length; i < MAX_SEATS; i++) {
    const humanSlot = humans < r.maxHumans;
    seats.push(`
      <div class="lobby-seat empty">
        <div class="lobby-avatar ghost">?</div>
        <div class="lobby-name muted">${humanSlot ? 'Aguardando jogador…' : 'Lugar livre'}</div>
        ${isHost ? `<button class="btn small" data-addbot>+ Bot</button>` : ''}
      </div>`);
  }
  $('#lobby-seats').innerHTML = seats.join('');

  const n = r.players.length;
  const copies = copiesFor(Math.max(n, 2));
  $('#lobby-deck').innerHTML = `
    <div class="deck-mini">${ROLE_KEYS.map((k) => `<div class="deck-mini-card" title="${ROLES[k].name}">${portrait(k)}<b>×${copies}</b></div>`).join('')}</div>
    <p class="hint">${n} na mesa → ${copies * 5} cartas na Corte (${copies} de cada).${n === 2 ? ' Em duelo, cada um começa com 1 moeda.' : ''}</p>`;

  $('#lobby-settings').innerHTML = isHost ? `
    <div class="field"><span>Máximo de humanos</span>
      <div class="seg small" id="set-humans">${Array.from({ length: MAX_SEATS }, (_, i) => `<button data-n="${i + 1}" class="${r.maxHumans === i + 1 ? 'active' : ''}" ${i + 1 < humans ? 'disabled' : ''}>${i + 1}</button>`).join('')}</div>
    </div>
    <label class="field"><span>Tempo para reagir</span>
      <select id="set-time">${[8, 10, 15, 20, 30].map((s) => `<option value="${s}" ${r.responseSec === s ? 'selected' : ''}>${s} segundos</option>`).join('')}</select>
    </label>` : `
    <p class="muted">Até <b>${r.maxHumans}</b> humano${r.maxHumans > 1 ? 's' : ''} · <b>${r.responseSec}s</b> para reagir.</p>`;

  const startBtn = $('#btn-start');
  startBtn.classList.toggle('hidden', !isHost);
  startBtn.disabled = n < 2;
  $('#lobby-hint').textContent = isHost
    ? (n < 2 ? 'Adicione pelo menos um bot ou espere alguém entrar.' : 'Pronto para começar.')
    : 'Aguardando o anfitrião iniciar a partida…';
  if (socket.mode === 'p2p' && socket.isHost()) $('#lobby-hint').textContent += ' Você está hospedando a sala: não feche esta aba.';
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-addbot],[data-kick],#set-humans button,[data-open]');
  if (!t) return;
  if (t.matches('[data-addbot]')) emit('addBot');
  else if (t.matches('[data-kick]')) emit('kick', { playerId: t.dataset.kick });
  else if (t.matches('#set-humans button')) emit('settings', { maxHumans: +t.dataset.n });
  else if (t.matches('[data-open=guide]')) openGuide();
});
document.addEventListener('change', (e) => { if (e.target.id === 'set-time') emit('settings', { responseSec: +e.target.value }); });
$('#btn-start').addEventListener('click', () => emit('start'));
$('#btn-copy').addEventListener('click', async () => {
  const link = `${location.origin}${PAGE}?sala=${S.room.code}`;
  try { await navigator.clipboard.writeText(link); toast('Link da sala copiado.'); }
  catch { prompt('Copie o link:', link); }
});
const leave = async () => {
  const msg = socket.isHost() ? 'Você é o anfitrião: se sair, a sala fecha para todos. Sair mesmo?' : 'Sair da partida? Um bot assume o seu lugar.';
  if ((socket.isHost() || (S.room?.game && S.room.game.phase !== 'over')) && !confirm(msg)) return;
  await emit('leave');
  store.del('session');
  S.room = null;
  history.replaceState(null, '', PAGE);
  showScreen('home');
};
$('#btn-leave-lobby').addEventListener('click', leave);
$('#btn-leave').addEventListener('click', leave);

// ---------------------------------------------------------------- chat
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-chat]');
  if (!f) return;
  e.preventDefault();
  const i = $('input', f);
  if (i.value.trim()) socket.emit('chat', i.value);
  i.value = '';
});
function renderChat() {
  if (!S.room) return;
  const html = S.room.chat.map((m) => `<div class="chat-msg ${m.playerId === S.me ? 'mine' : ''}"><b>${esc(m.name)}</b> ${esc(m.text)}</div>`).join('') || '<p class="muted">Ninguém disse nada… ainda.</p>';
  for (const id of ['#lobby-chat', '#game-chat']) {
    const el = $(id);
    if (el.dataset.n === String(S.room.chat.length)) continue;
    el.innerHTML = html;
    el.dataset.n = S.room.chat.length;
    el.scrollTop = el.scrollHeight;
  }
}

$$('.side-tab').forEach((b) => b.addEventListener('click', () => {
  $$('.side-tab').forEach((x) => x.classList.toggle('active', x === b));
  $('#side-log').classList.toggle('hidden', b.dataset.side !== 'log');
  $('#side-chat').classList.toggle('hidden', b.dataset.side !== 'chat');
  if (b.dataset.side === 'chat') $('#chat-dot').classList.add('hidden');
}));
$('#btn-side').addEventListener('click', () => document.body.classList.toggle('side-open'));
$('#btn-sound').addEventListener('click', (e) => { e.currentTarget.classList.toggle('off', !Sound.toggle()); });
$('#btn-sound').classList.toggle('off', !Sound.on);

// ---------------------------------------------------------------- jogo
const G = () => S.room.game;
const P = (id) => G().players.find((p) => p.id === id);
const pIndex = (id) => S.room.players.findIndex((p) => p.id === id);
const hueOf = (id) => HUES[Math.max(0, pIndex(id)) % HUES.length];

function renderGame() {
  const g = G();
  const me = P(S.me);
  $('#game-code').textContent = S.room.code;
  $('#deck-count').textContent = g.deckCount;
  $('#deck-stack').innerHTML = Array.from({ length: Math.min(6, Math.ceil(g.deckCount / 2)) }, (_, i) => `<div class="deck-card" style="--z:${i}">${cardBack()}</div>`).join('');

  const turnP = P(g.turnId);
  $('#turn-info').innerHTML = g.phase === 'over'
    ? `<b>Fim de jogo</b>`
    : `Rodada ${g.turnNo} · vez de <b style="color:hsl(${hueOf(g.turnId)} 80% 70%)">${turnP.id === S.me ? 'você' : esc(turnP.name)}</b>`;

  if (g.phase !== 'action' || g.turnId !== S.me) S.targeting = null;

  renderSeats();
  renderMe(me);
  renderBanner();
  renderPrompt();
  renderActions(me);
  renderLog();
  renderModals();

  const key = `${g.phase}:${g.turnId}:${g.turnNo}:${g.lose?.playerId}`;
  if (key !== S.lastPhaseKey) {
    S.lastPhaseKey = key;
    if (g.phase === 'action' && g.turnId === S.me) { Sound.turn(); toast('Sua vez!', 'gold'); }
    if (g.phase === 'lose' && g.lose?.playerId === S.me) Sound.alarm();
  }
}

function seatOrder() {
  const g = G();
  const idx = g.players.findIndex((p) => p.id === S.me);
  const n = g.players.length;
  return Array.from({ length: n - 1 }, (_, k) => g.players[(idx + 1 + k) % n]);
}

function layoutSeats() {
  const wrap = $('#table-wrap');
  const W = wrap.clientWidth, H = wrap.clientHeight;
  const others = $$('#seats .seat');
  const n = others.length + 1;
  const sw = others[0]?.offsetWidth || 150;
  const sh = others[0]?.offsetHeight || 110;
  // elipse que mantém todos os lugares dentro da área da mesa
  const rx = Math.max(60, W / 2 - sw / 2 - 6);
  const ry = Math.max(40, H / 2 - sh / 2 - 22);
  const cy = H / 2 + 8;
  others.forEach((el, k) => {
    // eu fico embaixo (90°); demais em sentido horário
    const a = Math.PI / 2 + ((k + 1) * 2 * Math.PI) / n;
    // superelipse: espalha melhor os lugares quando a mesa é larga e baixa
    const se = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.6);
    el.style.left = `${W / 2 + se(Math.cos(a)) * rx}px`;
    el.style.top = `${cy + se(Math.sin(a)) * ry}px`;
  });
  const t = $('.table3d', wrap);
  const tw = Math.min(rx * 1.5, W - 40), th = Math.max(120, ry * 2.1);
  Object.assign(t.style, { width: `${tw}px`, height: `${th}px`, left: `${(W - tw) / 2}px`, top: `${cy - th / 2}px`, right: 'auto', bottom: 'auto' });
}
new ResizeObserver(() => { if (S.room?.game) layoutSeats(); }).observe($('#table-wrap'));

function renderSeats() {
  const g = G();
  const box = $('#seats');
  const order = seatOrder();
  const ids = order.map((p) => p.id).join(',');
  if (box.dataset.ids !== ids) {
    box.dataset.ids = ids;
    box.innerHTML = order.map((p) => `
      <div class="seat" data-id="${p.id}">
        <div class="bubble"></div>
        <div class="seat-cards">${p.cards.map(() => cardHTML(null)).join('')}</div>
        <div class="seat-plate">
          <div class="seat-avatar">${avatar(p.name, hueOf(p.id), p.isBot)}</div>
          <div class="seat-meta">
            <div class="seat-name"></div>
            <div class="seat-coins"><span class="coin-ico">${coinSvg()}</span><b>0</b></div>
          </div>
          <div class="seat-status"></div>
        </div>
      </div>`).join('');
    layoutSeats();
  }
  const pend = g.pending;
  for (const p of order) {
    const el = $(`.seat[data-id="${p.id}"]`, box);
    $('.seat-name', el).textContent = p.name;
    $('.seat-coins b', el).textContent = p.coins;
    const cards = $$('.card', el);
    p.cards.forEach((c, i) => patchCard(cards[i], c.role, c.revealed));
    el.classList.toggle('turn', g.turnId === p.id && g.phase !== 'over');
    el.classList.toggle('dead', !p.alive);
    el.classList.toggle('winner', g.winnerId === p.id);
    el.classList.toggle('targeted', !!pend && pend.targetId === p.id);
    el.classList.toggle('selectable', !!S.targeting && p.alive);
    const waiting = g.waiting.includes(p.id);
    el.classList.toggle('waiting', waiting);
    let st = '';
    if (!p.alive) st = '<span class="st dead">exilado</span>';
    else if (g.phase === 'respond' && pend.passed.includes(p.id)) st = '<span class="st ok">✓ passou</span>';
    else if (waiting && g.phase === 'respond') st = '<span class="st think">pensando…</span>';
    else if (waiting && g.phase === 'lose') st = '<span class="st bad">escolhendo perda…</span>';
    else if (waiting && g.phase === 'exchange') st = '<span class="st think">negociando…</span>';
    $('.seat-status', el).innerHTML = st;
  }
}

$('#seats').addEventListener('click', (e) => {
  const seat = e.target.closest('.seat.selectable');
  if (!seat || !S.targeting) return;
  const action = S.targeting;
  S.targeting = null;
  emit('act', { kind: 'declare', action, targetId: seat.dataset.id });
  renderGame();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.targeting) { S.targeting = null; renderGame(); } });

function renderMe(me) {
  const g = G();
  $('#my-plate').innerHTML = `
    <div class="seat-avatar">${avatar(me.name, hueOf(me.id), false)}</div>
    <div class="seat-meta"><div class="seat-name">${esc(me.name)} <small>(você)</small></div>
    <div class="seat-coins big"><span class="coin-ico">${coinSvg()}</span><b>${me.coins}</b> moeda${me.coins === 1 ? '' : 's'}</div></div>`;
  const hand = $('#hand');
  if (hand.children.length !== me.cards.length) hand.innerHTML = me.cards.map(() => cardHTML(null, { big: true })).join('');
  const losing = g.phase === 'lose' && g.lose?.playerId === S.me;
  $$('.card', hand).forEach((el, i) => {
    patchCard(el, me.cards[i].role, me.cards[i].revealed, { big: true, mine: true });
    el.dataset.idx = i;
    el.classList.toggle('pickable', losing && !me.cards[i].revealed);
  });
  $('#my-area').classList.toggle('turn', g.turnId === S.me && g.phase !== 'over');
  $('#my-area').classList.toggle('dead', !me.alive);
  $('#my-area').classList.toggle('targeted', g.pending?.targetId === S.me);
}

$('#hand').addEventListener('click', (e) => {
  const c = e.target.closest('.card.pickable');
  if (!c) return;
  emit('act', { kind: 'lose', index: +c.dataset.idx });
});
// inclinação 3D das cartas da mão
$('#hand').addEventListener('pointermove', (e) => {
  const c = e.target.closest('.card');
  if (!c) return;
  const r = c.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
  c.style.setProperty('--rx', `${(-y * 14).toFixed(1)}deg`);
  c.style.setProperty('--ry', `${(x * 18).toFixed(1)}deg`);
});
$('#hand').addEventListener('pointerleave', () => $$('#hand .card').forEach((c) => { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); }));

function describePending(pend, forMe) {
  const a = ACTIONS[pend.action];
  const actor = P(pend.actorId);
  const target = pend.targetId ? P(pend.targetId) : null;
  const who = (p) => (p.id === S.me ? (forMe ? 'você' : 'Você') : `<b>${esc(p.name)}</b>`);
  let s = `${who(actor)} declara <b class="act">${a.name}</b>`;
  if (target) s += ` contra ${target.id === S.me ? '<b class="you">você</b>' : `<b>${esc(target.name)}</b>`}`;
  if (a.claim) s += ` alegando ser o <b style="color:${ROLES[a.claim].color}">${roleName(a.claim)}</b>`;
  if (pend.block) {
    const b = P(pend.block.blockerId);
    s += `<br>${who(b)} bloqueia alegando o <b style="color:${ROLES[pend.block.role].color}">${roleName(pend.block.role)}</b>`;
  }
  return s;
}

function renderBanner() {
  const g = G();
  const el = $('#claim-banner');
  const pend = g.pending;
  if (!pend || g.phase === 'over' || g.phase === 'action') { el.classList.remove('show'); el.dataset.k = ''; return; }
  const a = ACTIONS[pend.action];
  const role = pend.block ? pend.block.role : a.claim;
  const k = `${pend.action}:${pend.actorId}:${pend.block?.blockerId || ''}`;
  if (el.dataset.k === k) return;
  el.dataset.k = k;
  const who = pend.block ? P(pend.block.blockerId) : P(pend.actorId);
  el.innerHTML = `
    ${role ? `<div class="banner-card">${cardHTML(role)}</div>` : `<div class="banner-icon">${coinSvg()}</div>`}
    <div class="banner-text">
      <div class="banner-who">${who.id === S.me ? 'Você' : esc(who.name)}</div>
      <div class="banner-act">${pend.block ? 'Bloqueio!' : a.name}</div>
      ${role ? `<div class="banner-role" style="color:${ROLES[role].color}">${roleName(role)}</div>` : ''}
    </div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

function timerBar() {
  return `<div class="timer"><div class="timer-fill"></div></div>`;
}

function renderPrompt() {
  const g = G();
  const el = $('#prompt');
  const me = P(S.me);
  const pend = g.pending;
  let html = '';
  let urgent = false;

  if (g.phase === 'over') {
    html = `<div class="prompt-text">A partida terminou.</div>`;
  } else if (!me.alive) {
    html = `<div class="prompt-text muted">Você foi exilado(a). Acompanhe o resto da partida.</div>${g.deadline ? timerBar() : ''}`;
  } else if (g.phase === 'action') {
    if (g.turnId === S.me) {
      if (S.targeting) html = `<div class="prompt-text">Escolha o alvo de <b class="act">${ACTIONS[S.targeting].name}</b> clicando em um jogador. <button class="btn small ghost" data-cancel>Cancelar</button></div>`;
      else if (me.coins >= FORCED_COUP) html = `<div class="prompt-text"><b>Sua vez!</b> Com ${me.coins} moedas você é obrigado a dar um <b class="act">Golpe</b>.</div>`;
      else html = `<div class="prompt-text"><b>Sua vez!</b> Escolha uma ação — você pode blefar à vontade.</div>`;
      html += timerBar();
    } else {
      html = `<div class="prompt-text muted"><b>${esc(P(g.turnId).name)}</b> está decidindo…</div>${timerBar()}`;
    }
  } else if (g.phase === 'respond') {
    const o = g.myOptions;
    html = `<div class="prompt-text">${describePending(pend, !!o)}</div>`;
    if (o) {
      urgent = true;
      const btns = [];
      if (o.challenge) btns.push(`<button class="btn red" data-respond="challenge">Contestar</button>`);
      for (const r of o.block) btns.push(`<button class="btn role" style="--rc:${ROLES[r].color}" data-respond="block" data-role="${r}"><span class="mini-por">${portrait(r)}</span>Bloquear como ${roleName(r)}</button>`);
      btns.push(`<button class="btn ghost" data-respond="pass">Deixar passar</button>`);
      html += `<div class="prompt-btns">${btns.join('')}</div>`;
    } else {
      const waitingN = pend.responders.length;
      html += `<div class="prompt-sub muted">Aguardando ${waitingN} reaç${waitingN === 1 ? 'ão' : 'ões'}…</div>`;
    }
    html += timerBar();
  } else if (g.phase === 'lose') {
    if (g.lose.playerId === S.me) {
      urgent = true;
      html = `<div class="prompt-text bad">Você ${esc(g.lose.reason)}! <b>Clique na carta</b> que deseja revelar.</div>${timerBar()}`;
    } else {
      html = `<div class="prompt-text muted"><b>${esc(P(g.lose.playerId).name)}</b> ${esc(g.lose.reason)} e escolhe qual influência perder…</div>${timerBar()}`;
    }
  } else if (g.phase === 'exchange') {
    html = g.exchange.playerId === S.me
      ? `<div class="prompt-text">Escolha as cartas que deseja manter.</div>${timerBar()}`
      : `<div class="prompt-text muted"><b>${esc(P(g.exchange.playerId).name)}</b> negocia com a Corte…</div>${timerBar()}`;
  }
  if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  el.classList.toggle('urgent', urgent);
}

$('#prompt').addEventListener('click', (e) => {
  const b = e.target.closest('[data-respond],[data-cancel]');
  if (!b) return;
  if (b.matches('[data-cancel]')) { S.targeting = null; return renderGame(); }
  emit('act', { kind: 'respond', type: b.dataset.respond, role: b.dataset.role });
});

function renderActions(me) {
  const g = G();
  const el = $('#actions');
  const myTurn = g.phase === 'action' && g.turnId === S.me && me.alive;
  const forced = me.coins >= FORCED_COUP;
  const html = ACTION_KEYS.map((k) => {
    const a = ACTIONS[k];
    const disabled = !myTurn || me.coins < a.cost || (forced && k !== 'golpe');
    const has = a.claim && me.cards.some((c) => !c.revealed && c.role === a.claim);
    const icon = a.claim ? `<span class="mini-por">${portrait(a.claim)}</span>` : `<span class="coin-ico">${coinSvg()}</span>`;
    return `<button class="action-btn ${a.claim ? 'claim' : 'general'} ${S.targeting === k ? 'active' : ''} ${has ? 'honest' : ''}" data-action="${k}" ${disabled ? 'disabled' : ''}
      style="--rc:${a.claim ? ROLES[a.claim].color : '#e3b53f'}" title="${esc(a.desc)}">
      ${icon}
      <span class="ab-name">${a.name}</span>
      <span class="ab-sub">${a.claim ? roleName(a.claim) + (has ? ' ✓' : ' · blefe?') : a.short}</span>
    </button>`;
  }).join('');
  if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  el.classList.toggle('live', myTurn);
}

$('#actions').addEventListener('click', (e) => {
  const b = e.target.closest('.action-btn');
  if (!b || b.disabled) return;
  const k = b.dataset.action;
  if (ACTIONS[k].target) {
    S.targeting = S.targeting === k ? null : k;
    renderGame();
    const alive = G().players.filter((p) => p.alive && p.id !== S.me);
    if (S.targeting && alive.length === 1) { S.targeting = null; emit('act', { kind: 'declare', action: k, targetId: alive[0].id }); }
  } else {
    emit('act', { kind: 'declare', action: k });
  }
});

function renderLog() {
  const g = G();
  const el = $('#log');
  const last = g.log[g.log.length - 1]?.id || 0;
  if (+el.dataset.last === last) return;
  el.dataset.last = last;
  el.innerHTML = g.log.map((l) => `<li class="log-${l.kind}">${esc(l.text)}</li>`).join('');
  el.parentElement.scrollTop = el.parentElement.scrollHeight;
}

// ---------------------------------------------------------------- modais
function openModal(html, cls = '', dismissable = true) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-back ${cls}" ${dismissable ? 'data-dismiss' : ''}><div class="modal">${dismissable ? '<button class="modal-x" data-dismiss>✕</button>' : ''}${html}</div></div>`;
  root.dataset.kind = cls;
}
function closeModal() { $('#modal-root').innerHTML = ''; $('#modal-root').dataset.kind = ''; }
$('#modal-root').addEventListener('click', (e) => {
  if (e.target.matches('[data-dismiss]')) closeModal();
});

function renderModals() {
  const g = G();
  const kind = $('#modal-root').dataset.kind || '';
  // troca
  if (g.phase === 'exchange' && g.exchange.playerId === S.me && g.exchange.options) {
    const ex = g.exchange;
    const sig = `exchange:${g.turnNo}`;
    if (kind !== 'm-exchange' || $('#modal-root').dataset.sig !== sig) {
      S.exchangeSel = [];
      openModal(`
        <h2>Negociar com a Corte</h2>
        <p class="muted">Mantenha <b>${ex.keep}</b> carta${ex.keep > 1 ? 's' : ''}. As outras voltam embaralhadas para a Corte.</p>
        <div class="ex-cards">${ex.options.map((r, i) => `<button class="ex-pick" data-ex="${i}">${cardHTML(r, { big: true })}<span class="ex-tag">${i < ex.keep ? 'sua' : 'nova'}</span></button>`).join('')}</div>
        <button class="btn gold big" id="ex-ok" disabled>Confirmar</button>`, 'm-exchange', false);
      $('#modal-root').dataset.sig = sig;
    }
    return;
  }
  if (kind === 'm-exchange') closeModal();

  if (g.phase === 'over') {
    const sig = `over:${g.winnerId}`;
    if (kind === 'm-over' && $('#modal-root').dataset.sig === sig) return;
    const w = P(g.winnerId);
    const isHost = S.room.hostId === S.me;
    openModal(`
      <h2>${w.id === S.me ? 'Você domina a cidade!' : `${esc(w.name)} domina a cidade!`}</h2>
      <p class="muted">${w.id === S.me ? 'Todas as outras famílias foram exiladas. Não existe segundo lugar.' : 'Sua família foi exilada.'}</p>
      <div class="over-grid">${g.players.map((p) => `
        <div class="over-p ${p.id === g.winnerId ? 'win' : ''}">
          <div class="over-name">${esc(p.name)}</div>
          <div class="over-cards">${p.cards.map((c) => `<div class="mini-card ${c.revealed ? 'dead' : ''}">${portrait(c.role)}</div>`).join('')}</div>
        </div>`).join('')}</div>
      ${isHost ? `<div class="row"><button class="btn gold big" id="btn-again">Jogar de novo</button><button class="btn" id="btn-lobby">Voltar à sala</button></div>` : '<p class="muted">Aguardando o anfitrião…</p>'}`, 'm-over', false);
    $('#modal-root').dataset.sig = sig;
    return;
  }
  if (kind === 'm-over') closeModal();
}

$('#modal-root').addEventListener('click', (e) => {
  const pick = e.target.closest('[data-ex]');
  if (pick) {
    const i = +pick.dataset.ex;
    const keep = G().exchange.keep;
    if (S.exchangeSel.includes(i)) S.exchangeSel = S.exchangeSel.filter((x) => x !== i);
    else { S.exchangeSel.push(i); if (S.exchangeSel.length > keep) S.exchangeSel.shift(); }
    $$('[data-ex]').forEach((b) => b.classList.toggle('sel', S.exchangeSel.includes(+b.dataset.ex)));
    $('#ex-ok').disabled = S.exchangeSel.length !== keep;
    return;
  }
  if (e.target.closest('#ex-ok')) { emit('act', { kind: 'exchange', keep: S.exchangeSel }); return; }
  if (e.target.closest('#btn-again')) { emit('start'); return; }
  if (e.target.closest('#btn-lobby')) { emit('backToLobby'); }
});

function openGuide() {
  openModal(`
    <h2>Como jogar</h2>
    <p class="lead">Cada jogador comanda uma família e começa com <b>2 cartas secretas</b> (suas influências) e <b>2 moedas</b>. Perdeu as duas cartas, foi exilado. O último com influência vence.</p>
    <div class="guide-roles">${ROLE_KEYS.map((k) => `
      <div class="guide-role">${cardHTML(k)}<div><h3 style="color:${ROLES[k].color}">${ROLES[k].name}</h3><p>${esc(ROLES[k].text)}</p></div></div>`).join('')}</div>
    <h3>Ações</h3>
    <table class="guide-table">${ACTION_KEYS.map((k) => `<tr><td><b>${ACTIONS[k].name}</b></td><td>${esc(ACTIONS[k].desc)}</td></tr>`).join('')}</table>
    <h3>Blefe e contestação</h3>
    <ul class="guide-list">
      <li>Você pode alegar <b>qualquer</b> personagem, tendo a carta ou não.</li>
      <li>Qualquer jogador pode <b>contestar</b> uma alegação. Se quem alegou tinha a carta, ela é mostrada, volta à Corte e é trocada por outra — e quem contestou perde uma influência. Se era blefe, o blefador perde uma influência e a ação falha (moedas pagas voltam).</li>
      <li>Bloqueios também são alegações e podem ser contestados.</li>
      <li>Com <b>${FORCED_COUP}+ moedas</b> você é obrigado a dar um Golpe (custa ${COUP_COST}).</li>
      <li>Em duelo (2 jogadores), cada um começa com 1 moeda. Com 7–8 jogadores há 4 cópias de cada personagem; com 9, 5 cópias.</li>
      <li>Dá para perder 2 influências num turno: conteste um Envenenador e erre, ou blefe a Alquimista e seja pego.</li>
    </ul>`, 'm-guide');
}

// ---------------------------------------------------------------- efeitos
function seatEl(pid) {
  if (pid === S.me) return $('#my-area');
  return $(`.seat[data-id="${pid}"]`);
}
function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function showBubble(pid, text, role, kind = '') {
  const s = seatEl(pid);
  if (!s || document.body.dataset.screen !== 'game') return;
  const b = $('.bubble', s);
  if (!b) return;
  b.className = `bubble show ${kind}`;
  b.innerHTML = `${role ? `<span class="mini-por">${portrait(role)}</span>` : ''}<span>${esc(text)}</span>`;
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.remove('show'), kind === 'chat' ? 4000 : 2600);
}

function flyCoins(from, to, n) {
  const a = from === 'bank' ? $('#treasury') : seatEl(from);
  const b = to === 'bank' ? $('#treasury') : seatEl(to);
  if (!a || !b || document.body.dataset.screen !== 'game') return;
  const p0 = centerOf(a), p1 = centerOf(b);
  for (let i = 0; i < Math.min(n, 6); i++) {
    const c = document.createElement('div');
    c.className = 'fly-coin';
    c.innerHTML = coinSvg();
    c.style.left = `${p0.x}px`; c.style.top = `${p0.y}px`;
    $('#fx-layer').append(c);
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const anim = c.animate([
      { transform: 'translate(-50%,-50%) scale(0.6)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 80}px)) scale(1.15) rotateY(540deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.8) rotateY(1080deg)`, opacity: 0.9 },
    ], { duration: 750, delay: i * 90, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
    anim.onfinish = () => c.remove();
    setTimeout(Sound.coin, i * 90 + 600);
  }
}

function pulse(pid, cls, ms = 900) {
  const s = seatEl(pid);
  if (!s) return;
  s.classList.remove(cls); void s.offsetWidth; s.classList.add(cls);
  setTimeout(() => s.classList.remove(cls), ms);
}

function confetti() {
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background = ['#e3b53f', '#fff1b8', '#b3263a', '#3fbf6f', '#4a7bd0'][i % 5];
    c.style.animationDelay = `${Math.random() * 0.8}s`;
    c.style.animationDuration = `${2.2 + Math.random() * 1.8}s`;
    $('#fx-layer').append(c);
    setTimeout(() => c.remove(), 4800);
  }
}

function handleFx(e) {
  // espera o DOM do estado novo existir
  requestAnimationFrame(() => {
    switch (e.type) {
      case 'say': showBubble(e.playerId, e.text, e.role, e.kind || ''); if (e.kind === 'challenge') Sound.alarm(); break;
      case 'coins': flyCoins(e.from, e.to, e.n); break;
      case 'prove': showBubble(e.playerId, `Era verdade! ${roleName(e.role)}`, e.role, 'good'); pulse(e.playerId, 'flash-good'); Sound.good(); break;
      case 'bluff': showBubble(e.playerId, 'Blefe descoberto!', null, 'bad'); pulse(e.playerId, 'shake'); break;
      case 'lose': pulse(e.playerId, 'shake'); break;
      case 'exile': pulse(e.playerId, 'flash-bad', 1400); break;
      case 'win': Sound.win(); confetti(); break;
    }
  });
}

// ---------------------------------------------------------------- relógio
function tick() {
  const g = S.room?.game;
  const fills = $$('.timer-fill');
  if (g && g.deadline && fills.length) {
    const now = Date.now() + S.clockOffset;
    const total = g.phase === 'respond' ? S.room.responseSec * 1000 : g.phase === 'lose' ? 20000 : 45000;
    const left = Math.max(0, g.deadline - now);
    const pct = Math.min(100, (left / total) * 100);
    for (const f of fills) { f.style.width = `${pct}%`; f.classList.toggle('low', pct < 30); }
  } else for (const f of fills) f.style.width = '0%';
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

if (!store.get('session')) showScreen('home');
