// Teste ponta a ponta: sobe o servidor, conecta 9 clientes e joga uma partida inteira.
// Uso: node test/multiplayer.js   (usa a porta 3999)
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { ACTIONS } from '../public/shared/rules.js';

const PORT = 3999;
const URL = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res) => srv.stdout.on('data', (d) => String(d).includes('rodando') && res()));

const call = (s, ev, data) => new Promise((res) => s.emit(ev, data, res));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(name) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  s.state = null;
  s.on('state', (st) => { s.state = st; });
  s.nameTag = name;
  return s;
}

try {
  const host = client('Host');
  const r = await call(host, 'create', { name: 'Host', maxHumans: 9, responseSec: 8 });
  assert.ok(r.ok, 'criar sala');
  const code = r.code;
  const clients = [host];
  for (let i = 2; i <= 9; i++) {
    const c = client(`J${i}`);
    const j = await call(c, 'join', { code, name: `J${i}` });
    assert.ok(j.ok, `J${i} entrou`);
    c.playerId = j.playerId;
    clients.push(c);
  }
  const extra = client('Extra');
  const no = await call(extra, 'join', { code, name: 'Extra' });
  assert.ok(no.error, '10º jogador deve ser recusado');
  console.log('✔ 9 humanos na sala, 10º recusado:', no.error);
  extra.close();

  const bot = await call(host, 'addBot');
  assert.ok(bot.error, 'não cabe bot com 9 na mesa');

  assert.ok((await call(clients[1], 'start')).error, 'só o anfitrião inicia');
  assert.ok((await call(host, 'start')).ok, 'iniciar');
  await sleep(300);
  const g0 = host.state.game;
  assert.equal(g0.players.length, 9);
  assert.equal(g0.copies, 5, '9 jogadores = 5 cópias');
  assert.equal(g0.deckCount, 25 - 18);
  // cada um só vê as próprias cartas
  for (const c of clients) {
    const me = c.state.game.players.find((p) => p.id === c.state.you);
    assert.ok(me.cards.every((k) => k.role), 'vejo minhas cartas');
    const other = c.state.game.players.find((p) => p.id !== c.state.you);
    assert.ok(other.cards.every((k) => k.role === null), 'não vejo cartas alheias');
  }
  console.log('✔ partida com 9 jogadores iniciada, 5 cópias por personagem, cartas ocultas corretamente');

  // J9 sai no meio da partida -> vira bot
  const leaver = clients.pop();
  await call(leaver, 'leave');
  leaver.close();
  await sleep(200);
  const lp = host.state.game.players.find((p) => p.name.startsWith('J9'));
  assert.ok(lp.isBot && lp.name.endsWith('(bot)'), 'quem sai vira bot');
  console.log('✔ jogador que saiu foi substituído por bot');

  // Reconexão: J2 cai e volta com o mesmo id
  const j2 = clients[1];
  const j2id = j2.state.you;
  j2.close();
  const j2b = client('J2');
  const back = await call(j2b, 'join', { code, playerId: j2id });
  assert.equal(back.playerId, j2id, 'reconectou no mesmo lugar');
  clients[1] = j2b;
  console.log('✔ reconexão mantém o lugar');

  // Joga até o fim com decisões aleatórias legais
  let guard = 0;
  while (host.state.game.phase !== 'over' && guard++ < 4000) {
    for (const c of clients) {
      const g = c.state?.game;
      if (!g || g.phase === 'over') continue;
      const me = g.players.find((p) => p.id === c.state.you);
      if (g.phase === 'action' && g.turnId === me.id) {
        const others = g.players.filter((p) => p.alive && p.id !== me.id);
        let act;
        if (me.coins >= 10) act = 'golpe';
        else {
          const opts = Object.keys(ACTIONS).filter((k) => ACTIONS[k].cost <= me.coins);
          act = opts[Math.floor(Math.random() * opts.length)];
        }
        const t = others[Math.floor(Math.random() * others.length)];
        await call(c, 'act', { kind: 'declare', action: act, targetId: t.id });
      } else if (g.myOptions) {
        const o = g.myOptions;
        const roll = Math.random();
        if (o.challenge && roll < 0.2) await call(c, 'act', { kind: 'respond', type: 'challenge' });
        else if (o.block.length && roll < 0.4) await call(c, 'act', { kind: 'respond', type: 'block', role: o.block[0] });
        else await call(c, 'act', { kind: 'respond', type: 'pass' });
      } else if (g.phase === 'lose' && g.lose.playerId === me.id) {
        const i = me.cards.findIndex((k) => !k.revealed);
        await call(c, 'act', { kind: 'lose', index: i });
      } else if (g.phase === 'exchange' && g.exchange.playerId === me.id && g.exchange.options) {
        await call(c, 'act', { kind: 'exchange', keep: Array.from({ length: g.exchange.keep }, (_, i) => i + 2 >= g.exchange.options.length ? i : i + 2) });
      }
    }
    await sleep(25);
  }
  const final = host.state.game;
  assert.equal(final.phase, 'over', 'partida terminou');
  const w = final.players.find((p) => p.id === final.winnerId);
  assert.ok(final.players.every((p) => p.cards.every((k) => k.role)), 'no fim todas as cartas são reveladas');
  console.log(`✔ partida concluída — vencedor: ${w.name} (turnos: ${final.turnNo})`);

  assert.ok((await call(host, 'backToLobby')).ok);
  await sleep(200);
  assert.equal(host.state.game, null);
  assert.ok(!host.state.players.some((p) => p.name.endsWith('(bot)')), 'quem saiu não volta para o lobby');
  console.log('✔ voltou ao lobby');
  for (const c of clients) c.close();
  console.log('\nTodos os testes de multiplayer passaram.');
} finally {
  srv.kill();
}
process.exit(0);
