// IA simples para preencher lugares vazios. Só usa as próprias cartas + informação pública.
import { ACTIONS, ROLE_KEYS, COUP_COST, FORCED_COUP } from '../shared/rules.js';

export const BOT_NAMES = ['Lorenzo', 'Bianca', 'Marco', 'Giulia', 'Vittorio', 'Serafina', 'Matteo', 'Lucrezia', 'Dante', 'Isabella', 'Cosimo', 'Beatrice'];

const VALUE = { banqueiro: 5, envenenador: 4.5, alquimista: 4, contrabandista: 3.5, emissario: 2.5 };
const rnd = () => Math.random();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function myRoles(p) { return p.cards.filter((c) => !c.revealed).map((c) => c.role); }

/** Quantas cópias de um personagem o bot sabe que estão fora do alcance de quem alega. */
function knownCopies(game, me, role) {
  let n = myRoles(me).filter((r) => r === role).length;
  for (const p of game.players) for (const c of p.cards) if (c.revealed && c.role === role) n++;
  return n;
}

function threat(p) {
  return p.cards.filter((c) => !c.revealed).length * 10 + p.coins;
}

export function botAct(game, id) {
  const me = game.get(id);
  if (!me) return;
  switch (game.phase) {
    case 'action': if (game.current().id === id) return chooseAction(game, me); break;
    case 'respond': { const o = game.options(id); if (o) return respond(game, me, o); break; }
    case 'lose': if (game.lose?.playerId === id) return loseCard(game, me); break;
    case 'exchange': if (game.exchange?.playerId === id) return exchange(game, me); break;
  }
}

function chooseAction(game, me) {
  const roles = myRoles(me);
  const others = game.alive().filter((p) => p.id !== me.id);
  const strongest = [...others].sort((a, b) => threat(b) - threat(a))[0];
  const richest = [...others].sort((a, b) => b.coins - a.coins)[0];
  const has = (r) => roles.includes(r);
  const go = (a, t) => game.declare(me.id, a, t?.id ?? null);

  if (me.coins >= FORCED_COUP) return go('golpe', strongest);
  if (me.coins >= COUP_COST && rnd() < 0.85) return go('golpe', strongest);
  if (has('envenenador') && me.coins >= 3 && rnd() < 0.8) return go('envenenar', strongest);
  if (has('banqueiro')) return go('juros');
  if (has('contrabandista') && richest.coins >= 2) return go('saquear', richest);
  const r = rnd();
  if (r < 0.15) return go('juros');
  if (r < 0.22 && me.coins >= 3) return go('envenenar', strongest);
  if (r < 0.28 && richest.coins >= 2) return go('saquear', richest);
  if (has('emissario') && rnd() < 0.5) return go('negociar');
  return go(rnd() < 0.55 ? 'ajuda' : 'renda');
}

function respond(game, me, opts) {
  const pend = game.pending;
  const a = ACTIONS[pend.action];
  const roles = myRoles(me);
  const lives = roles.length;
  const targetedMe = pend.targetId === me.id;

  // Bloqueios
  if (opts.block.length) {
    const real = opts.block.find((r) => roles.includes(r));
    if (real && rnd() < 0.95) return game.respond(me.id, 'block', real);
    if (pend.action === 'envenenar' && targetedMe && rnd() < (lives === 1 ? 0.7 : 0.35)) return game.respond(me.id, 'block', 'alquimista');
    if (pend.action === 'saquear' && targetedMe && me.coins > 0 && rnd() < 0.2) return game.respond(me.id, 'block', pick(opts.block));
    if (pend.action === 'ajuda' && rnd() < 0.06) return game.respond(me.id, 'block', 'banqueiro');
  }

  // Contestações
  if (opts.challenge) {
    const claimant = pend.stage === 'block' ? pend.block.blockerId : pend.actorId;
    const role = pend.stage === 'block' ? pend.block.role : a.claim;
    const certainLie = knownCopies(game, me, role) >= game.copies;
    if (certainLie) return game.respond(me.id, 'challenge');
    let p = 0.08;
    if (targetedMe && pend.action === 'envenenar' && lives === 1 && !roles.includes('alquimista')) p = 0.45;
    if (pend.stage === 'block' && claimant !== me.id && pend.actorId === me.id) p = 0.18;
    if (lives === 1) p *= 0.6;
    if (rnd() < p) return game.respond(me.id, 'challenge');
  }

  return game.respond(me.id, 'pass');
}

function loseCard(game, me) {
  const hidden = game.hiddenIdx(me);
  hidden.sort((a, b) => VALUE[me.cards[a].role] - VALUE[me.cards[b].role]);
  return game.chooseLose(me.id, hidden[0]);
}

function exchange(game, me) {
  const ex = game.exchange;
  const idx = ex.options.map((r, i) => i);
  // Prefere personagens diferentes e valiosos.
  idx.sort((a, b) => VALUE[ex.options[b]] - VALUE[ex.options[a]]);
  const keep = [];
  for (const i of idx) {
    if (keep.length >= ex.keep) break;
    if (!keep.some((k) => ex.options[k] === ex.options[i])) keep.push(i);
  }
  for (const i of idx) { if (keep.length >= ex.keep) break; if (!keep.includes(i)) keep.push(i); }
  return game.chooseExchange(me.id, keep);
}

export { ROLE_KEYS };
