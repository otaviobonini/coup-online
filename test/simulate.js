// Simula milhares de partidas só com bots e verifica invariantes do motor.
import assert from 'node:assert/strict';
import { Game } from '../public/shared/game.js';
import { botAct } from '../public/shared/bot.js';
import { ROLE_KEYS } from '../public/shared/rules.js';

const GAMES = Number(process.argv[2] || 3000);
let totalTurns = 0;
const wins = {};

function check(g) {
  const cards = g.players.flatMap((p) => p.cards).length + g.deck.length + (g.exchange ? 2 : 0);
  assert.equal(cards, ROLE_KEYS.length * g.copies, 'número de cartas mudou');
  for (const p of g.players) {
    assert.ok(p.coins >= 0, `moedas negativas: ${p.name}`);
    assert.equal(p.alive, p.cards.some((c) => !c.revealed), `alive inconsistente: ${p.name}`);
    if (!p.alive) assert.equal(p.coins, 0);
  }
}

for (let i = 0; i < GAMES; i++) {
  const n = 2 + (i % 8); // 2..9
  const players = Array.from({ length: n }, (_, k) => ({ id: `b${k}`, name: `Bot${k}`, isBot: true }));
  const g = new Game(players, { responseMs: 60000, turnMs: 60000 });
  let steps = 0;
  while (g.phase !== 'over') {
    const w = g.waiting();
    assert.ok(w.length, `ninguém para agir na fase ${g.phase}`);
    // Ocasionalmente, deixa o tempo esgotar (simula timeout)
    const id = w[Math.floor(Math.random() * w.length)];
    if (g.phase === 'respond' && Math.random() < 0.05) g.allPassed();
    else botAct(g, id);
    check(g);
    if (++steps > 5000) throw new Error('partida não termina');
  }
  assert.ok(g.winnerId);
  assert.equal(g.alive().length, 1);
  totalTurns += g.turnNo;
  wins[n] = (wins[n] || 0) + 1;
  g.destroy();
}

console.log(`✔ ${GAMES} partidas simuladas sem erros. Média de ${(totalTurns / GAMES).toFixed(1)} turnos.`);
console.log('Partidas por número de jogadores:', wins);
