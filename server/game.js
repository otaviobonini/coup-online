// Motor do jogo: máquina de estados autoritativa (roda só no servidor).
import { randomInt } from 'node:crypto';
import { ROLES, ROLE_KEYS, ACTIONS, COUP_COST, FORCED_COUP, copiesFor } from '../shared/rules.js';

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const roleName = (r) => ROLES[r]?.name ?? r;

/**
 * Fases:
 *  action   – jogador da vez escolhe uma ação
 *  respond  – outros podem contestar / bloquear / passar (pending.stage = action | blockOnly | block)
 *  lose     – um jogador escolhe qual influência revelar
 *  exchange – jogador escolhe quais cartas manter (Negociar)
 *  over     – fim de jogo
 */
export class Game {
  constructor(players, opts = {}) {
    this.opts = { responseMs: 15000, turnMs: 45000, loseMs: 20000, ...opts };
    this.onChange = opts.onChange || (() => {});
    this.onFx = opts.onFx || (() => {});

    const n = players.length;
    if (n < 2) throw new Error('São necessários pelo menos 2 jogadores');
    this.copies = copiesFor(n);
    this.deck = shuffle(ROLE_KEYS.flatMap((r) => Array(this.copies).fill(r)));
    this.players = players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: !!p.isBot,
      coins: n === 2 ? 1 : 2,
      cards: [
        { role: this.deck.pop(), revealed: false },
        { role: this.deck.pop(), revealed: false },
      ],
      alive: true,
    }));

    const first = this.players.findIndex((p) => p.id === opts.firstId);
    this.turn = first >= 0 ? first : randomInt(n);
    this.phase = 'action';
    this.pending = null;
    this.lose = null;
    this.loseThen = null;
    this.exchange = null;
    this.log = [];
    this.version = 0;
    this.winnerId = null;
    this.deadline = null;
    this.timer = null;
    this.turnNo = 1;

    this.addLog(`A partida começa! ${this.players.length} famílias à mesa, ${this.copies} cópias de cada personagem.`, 'system');
    this.startTurn();
  }

  // ---------- utilidades ----------
  get(id) { return this.players.find((p) => p.id === id); }
  current() { return this.players[this.turn]; }
  alive() { return this.players.filter((p) => p.alive); }
  hiddenIdx(p) { return p.cards.map((c, i) => (c.revealed ? -1 : i)).filter((i) => i >= 0); }

  addLog(text, kind = 'info', actorId = null) {
    this.log.push({ id: this.log.length + 1, text, kind, actorId, t: Date.now() });
    if (this.log.length > 120) this.log.splice(0, this.log.length - 120);
  }
  fx(e) { try { this.onFx(e); } catch { /* ignore */ } }
  touch() { this.version++; try { this.onChange(); } catch (e) { console.error(e); } }

  setTimer(ms, fn) {
    this.clearTimer();
    this.deadline = Date.now() + ms;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.deadline = null;
      try { fn(); } catch (e) { console.error(e); }
      this.touch();
    }, ms);
  }
  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.deadline = null;
  }
  destroy() { this.clearTimer(); this.onChange = () => {}; this.onFx = () => {}; }

  moveCoins(from, to, n) {
    if (n <= 0) return;
    if (from) from.coins -= n;
    if (to) to.coins += n;
    this.fx({ type: 'coins', from: from ? from.id : 'bank', to: to ? to.id : 'bank', n });
  }

  // ---------- turnos ----------
  startTurn() {
    this.phase = 'action';
    this.pending = null;
    this.exchange = null;
    const p = this.current();
    this.fx({ type: 'turn', playerId: p.id });
    this.setTimer(this.opts.turnMs, () => this.autoAction(p.id));
  }

  autoAction(pid) {
    if (this.phase !== 'action' || this.current().id !== pid) return;
    const p = this.current();
    this.addLog(`${p.name} demorou demais…`, 'system');
    if (p.coins >= FORCED_COUP) {
      const others = this.alive().filter((o) => o.id !== pid);
      this.declare(pid, 'golpe', others[randomInt(others.length)].id, true);
    } else {
      this.declare(pid, 'renda', null, true);
    }
  }

  nextTurn() {
    if (this.checkWin()) return;
    this.pending = null;
    this.exchange = null;
    let i = this.turn;
    do { i = (i + 1) % this.players.length; } while (!this.players[i].alive);
    this.turn = i;
    this.turnNo++;
    this.startTurn();
  }

  checkWin() {
    if (this.phase === 'over') return true;
    const alive = this.alive();
    if (alive.length > 1) return false;
    this.phase = 'over';
    this.clearTimer();
    this.pending = null;
    this.lose = null;
    this.loseThen = null;
    this.exchange = null;
    this.winnerId = alive[0]?.id ?? null;
    if (alive[0]) {
      this.addLog(`${alive[0].name} venceu a partida.`, 'win', alive[0].id);
      this.fx({ type: 'win', playerId: alive[0].id });
    }
    return true;
  }

  // ---------- ações ----------
  declare(pid, action, targetId, internal = false) {
    if (this.phase !== 'action') return { error: 'Não é hora de declarar uma ação.' };
    const p = this.current();
    if (p.id !== pid) return { error: 'Não é a sua vez.' };
    const a = ACTIONS[action];
    if (!a) return { error: 'Ação inválida.' };
    if (p.coins >= FORCED_COUP && action !== 'golpe') return { error: `Com ${FORCED_COUP}+ moedas você é obrigado a dar um Golpe.` };
    if (p.coins < a.cost) return { error: 'Moedas insuficientes.' };
    let target = null;
    if (a.target) {
      target = this.get(targetId);
      if (!target || !target.alive || target.id === pid) return { error: 'Escolha um alvo válido.' };
    }

    this.clearTimer();
    this.pending = { actorId: pid, action, targetId: target ? target.id : null, block: null, stage: null, responders: [], passed: [] };
    if (a.cost) this.moveCoins(p, null, a.cost);

    const tgt = target ? ` contra ${target.name}` : '';
    const claim = a.claim ? ` alegando o ${roleName(a.claim)}` : '';
    this.addLog(`${p.name} declara ${a.name}${tgt}${claim}.`, 'action', pid);
    this.fx({ type: 'say', playerId: pid, text: `${a.name}${target ? ' → ' + target.name : ''}`, role: a.claim });

    if (action === 'renda') {
      this.moveCoins(null, p, 1);
      this.nextTurn();
    } else if (action === 'golpe') {
      this.requireLose(target.id, `sofreu um Golpe de ${p.name}`, () => this.nextTurn());
    } else {
      this.openResponses('action');
    }
    if (!internal) this.touch();
    return { ok: true };
  }

  openResponses(stage) {
    const pend = this.pending;
    let ids = [];
    if (stage === 'action') ids = this.alive().filter((p) => p.id !== pend.actorId).map((p) => p.id);
    else if (stage === 'blockOnly') { const t = this.get(pend.targetId); ids = t && t.alive ? [t.id] : []; }
    else if (stage === 'block') ids = this.alive().filter((p) => p.id !== pend.block.blockerId).map((p) => p.id);
    pend.stage = stage;
    pend.responders = ids;
    pend.passed = [];
    this.phase = 'respond';
    if (!ids.length) return this.allPassed();
    this.setTimer(this.opts.responseMs, () => this.allPassed());
  }

  /** O que um jogador pode fazer agora na janela de resposta. */
  options(pid) {
    if (this.phase !== 'respond') return null;
    const pend = this.pending;
    if (!pend || !pend.responders.includes(pid)) return null;
    const a = ACTIONS[pend.action];
    if (pend.stage === 'action') {
      const canBlock = a.blockers.length > 0 && (a.anyoneBlocks || pend.targetId === pid);
      return { challenge: !!a.claim, block: canBlock ? a.blockers : [] };
    }
    if (pend.stage === 'blockOnly') return { challenge: false, block: a.blockers };
    if (pend.stage === 'block') return { challenge: true, block: [] };
    return null;
  }

  respond(pid, type, role) {
    const opts = this.options(pid);
    if (!opts) return { error: 'Você não pode responder agora.' };
    const pend = this.pending;
    const me = this.get(pid);
    const a = ACTIONS[pend.action];

    if (type === 'pass') {
      pend.responders = pend.responders.filter((id) => id !== pid);
      pend.passed.push(pid);
      if (!pend.responders.length) { this.clearTimer(); this.allPassed(); }
      this.touch();
      return { ok: true };
    }

    if (type === 'challenge') {
      if (!opts.challenge) return { error: 'Não dá para contestar isso.' };
      this.clearTimer();
      if (pend.stage === 'action') {
        const actor = this.get(pend.actorId);
        this.resolveChallenge(actor.id, a.claim, pid,
          () => this.afterActionProven(),
          () => {
            if (a.cost && actor.alive) this.moveCoins(null, actor, a.cost);
            this.addLog(`A ação de ${actor.name} falha.`, 'fail', actor.id);
            this.nextTurn();
          });
      } else {
        const blocker = this.get(pend.block.blockerId);
        this.resolveChallenge(blocker.id, pend.block.role, pid,
          () => { this.addLog(`O bloqueio de ${blocker.name} se mantém. ${a.name} falha.`, 'fail'); this.nextTurn(); },
          () => { this.addLog(`O bloqueio caiu! ${a.name} prossegue.`, 'info'); this.resolveAction(); });
      }
      this.touch();
      return { ok: true };
    }

    if (type === 'block') {
      if (!opts.block.includes(role)) return { error: 'Bloqueio inválido.' };
      this.clearTimer();
      pend.block = { blockerId: pid, role };
      this.addLog(`${me.name} bloqueia ${a.name} alegando o ${roleName(role)}.`, 'block', pid);
      this.fx({ type: 'say', playerId: pid, text: `Bloqueio!`, role });
      this.openResponses('block');
      this.touch();
      return { ok: true };
    }
    return { error: 'Resposta inválida.' };
  }

  allPassed() {
    const pend = this.pending;
    if (!pend || this.phase !== 'respond') return;
    this.clearTimer();
    if (pend.stage === 'block') {
      const a = ACTIONS[pend.action];
      this.addLog(`Ninguém contesta: ${a.name} foi bloqueada.`, 'fail');
      this.nextTurn();
    } else {
      this.resolveAction();
    }
  }

  afterActionProven() {
    const pend = this.pending;
    const a = ACTIONS[pend.action];
    const target = pend.targetId ? this.get(pend.targetId) : null;
    if (a.blockers.length && !a.anyoneBlocks && target && target.alive) this.openResponses('blockOnly');
    else this.resolveAction();
  }

  resolveChallenge(claimantId, role, challengerId, onTrue, onFalse) {
    const c = this.get(claimantId);
    const ch = this.get(challengerId);
    this.addLog(`${ch.name} contesta o ${roleName(role)} de ${c.name}!`, 'challenge', ch.id);
    this.fx({ type: 'say', playerId: ch.id, text: 'Contesto!', kind: 'challenge' });
    const idx = c.cards.findIndex((k) => !k.revealed && k.role === role);
    if (idx >= 0) {
      this.addLog(`${c.name} mostra o ${roleName(role)} — era verdade! A carta volta à Corte e ${c.name} compra outra.`, 'prove', c.id);
      this.fx({ type: 'prove', playerId: c.id, role });
      this.deck.push(role);
      shuffle(this.deck);
      c.cards[idx] = { role: this.deck.pop(), revealed: false };
      this.requireLose(ch.id, 'perdeu a contestação', onTrue);
    } else {
      this.addLog(`${c.name} estava blefando!`, 'bluff', c.id);
      this.fx({ type: 'bluff', playerId: c.id });
      this.requireLose(c.id, 'foi pego(a) no blefe', onFalse);
    }
  }

  resolveAction() {
    const pend = this.pending;
    const actor = this.get(pend.actorId);
    const target = pend.targetId ? this.get(pend.targetId) : null;
    switch (pend.action) {
      case 'ajuda': this.moveCoins(null, actor, 2); return this.nextTurn();
      case 'juros': this.moveCoins(null, actor, 3); return this.nextTurn();
      case 'envenenar':
        return this.requireLose(target.id, `foi envenenado(a) por ${actor.name}`, () => this.nextTurn());
      case 'saquear': {
        const n = Math.min(2, target.coins);
        this.moveCoins(target, actor, n);
        this.addLog(`${actor.name} saqueia ${n} moeda${n === 1 ? '' : 's'} de ${target.name}.`, 'info', actor.id);
        return this.nextTurn();
      }
      case 'negociar': {
        const hidden = this.hiddenIdx(actor);
        const drawn = [this.deck.pop(), this.deck.pop()].filter(Boolean);
        this.phase = 'exchange';
        this.exchange = { playerId: actor.id, options: [...hidden.map((i) => actor.cards[i].role), ...drawn], keep: hidden.length };
        this.setTimer(this.opts.turnMs, () => this.chooseExchange(actor.id, hidden.map((_, i) => i), true));
        return;
      }
      default: return this.nextTurn();
    }
  }

  chooseExchange(pid, keepIdx, internal = false) {
    if (this.phase !== 'exchange' || this.exchange.playerId !== pid) return { error: 'Não há troca em andamento.' };
    const ex = this.exchange;
    const keep = [...new Set((keepIdx || []).map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < ex.options.length);
    if (keep.length !== ex.keep) return { error: `Escolha exatamente ${ex.keep} carta${ex.keep > 1 ? 's' : ''}.` };
    this.clearTimer();
    const p = this.get(pid);
    const hidden = this.hiddenIdx(p);
    hidden.forEach((ci, k) => { p.cards[ci] = { role: ex.options[keep[k]], revealed: false }; });
    ex.options.forEach((r, i) => { if (!keep.includes(i)) this.deck.push(r); });
    shuffle(this.deck);
    this.addLog(`${p.name} negociou com a Corte e trocou suas cartas em segredo.`, 'info', pid);
    this.fx({ type: 'say', playerId: pid, text: 'Negócio fechado.' });
    this.exchange = null;
    this.nextTurn();
    if (!internal) this.touch();
    return { ok: true };
  }

  // ---------- perda de influência ----------
  requireLose(pid, reason, then) {
    const p = this.get(pid);
    const wrapped = () => { if (this.checkWin()) return; then(); };
    if (!p || !p.alive) return wrapped();
    const hidden = this.hiddenIdx(p);
    if (hidden.length === 1) {
      this.reveal(p, hidden[0], reason);
      return wrapped();
    }
    this.phase = 'lose';
    this.lose = { playerId: pid, reason };
    this.loseThen = wrapped;
    this.setTimer(this.opts.loseMs, () => this.chooseLose(pid, hidden[randomInt(hidden.length)], true));
  }

  chooseLose(pid, idx, internal = false) {
    if (this.phase !== 'lose' || this.lose?.playerId !== pid) return { error: 'Você não precisa perder influência agora.' };
    const p = this.get(pid);
    idx = Number(idx);
    if (!p.cards[idx] || p.cards[idx].revealed) return { error: 'Carta inválida.' };
    this.clearTimer();
    this.reveal(p, idx, this.lose.reason);
    const then = this.loseThen;
    this.lose = null;
    this.loseThen = null;
    then();
    if (!internal) this.touch();
    return { ok: true };
  }

  reveal(p, idx, reason) {
    p.cards[idx].revealed = true;
    this.addLog(`${p.name} ${reason} e revela o ${roleName(p.cards[idx].role)}.`, 'lose', p.id);
    this.fx({ type: 'lose', playerId: p.id, role: p.cards[idx].role });
    if (!this.hiddenIdx(p).length) {
      p.alive = false;
      if (p.coins) this.moveCoins(p, null, p.coins);
      this.addLog(`${p.name} foi exilado(a) da cidade.`, 'exile', p.id);
      this.fx({ type: 'exile', playerId: p.id });
    }
  }

  /** Jogador saiu no meio da partida: vira bot. */
  setBot(pid, name) {
    const p = this.get(pid);
    if (!p) return;
    p.isBot = true;
    if (name) p.name = name;
  }

  /** Quem precisa agir agora. */
  waiting() {
    switch (this.phase) {
      case 'action': return [this.current().id];
      case 'respond': return [...this.pending.responders];
      case 'lose': return [this.lose.playerId];
      case 'exchange': return [this.exchange.playerId];
      default: return [];
    }
  }

  // ---------- visão personalizada ----------
  view(pid) {
    const over = this.phase === 'over';
    const pend = this.pending;
    return {
      phase: this.phase,
      turnId: this.current().id,
      turnNo: this.turnNo,
      copies: this.copies,
      deckCount: this.deck.length,
      winnerId: this.winnerId,
      deadline: this.deadline,
      serverNow: Date.now(),
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        coins: p.coins,
        alive: p.alive,
        cards: p.cards.map((c) => ({ revealed: c.revealed, role: c.revealed || p.id === pid || over ? c.role : null })),
      })),
      pending: pend && {
        action: pend.action,
        actorId: pend.actorId,
        targetId: pend.targetId,
        block: pend.block,
        stage: pend.stage,
        responders: pend.responders,
        passed: pend.passed,
      },
      lose: this.lose,
      exchange: this.exchange && (this.exchange.playerId === pid ? this.exchange : { playerId: this.exchange.playerId }),
      myOptions: this.options(pid),
      waiting: this.waiting(),
      log: this.log.slice(-60),
    };
  }
}
