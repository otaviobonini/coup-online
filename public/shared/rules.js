// Definições compartilhadas entre servidor e cliente.

export const ROLES = {
  banqueiro: {
    name: 'Duque',
    color: '#c9a227',
    action: 'juros',
    blocks: ['ajuda'],
    text: 'Cobrar Juros: pegue 3 moedas. Bloqueia Ajuda Externa.',
  },
  envenenador: {
    name: 'Assassino',
    color: '#b3263a',
    action: 'envenenar',
    blocks: [],
    text: 'Envenenar: pague 3 moedas; o alvo perde uma influência.',
  },
  contrabandista: {
    name: 'Capitão',
    color: '#2a9d8f',
    action: 'saquear',
    blocks: ['saquear'],
    text: 'Saquear: tome 2 moedas de outro jogador. Bloqueia Saque.',
  },
  emissario: {
    name: 'Embaixador',
    color: '#4a7bd0',
    action: 'negociar',
    blocks: ['saquear'],
    text: 'Negociar: compre 2 cartas da Corte e troque. Bloqueia Saque.',
  },
  alquimista: {
    name: 'Condessa',
    color: '#3fbf6f',
    action: null,
    blocks: ['envenenar'],
    text: 'Antídoto: bloqueia Envenenar contra você.',
  },
};

export const ROLE_KEYS = Object.keys(ROLES);

export const ACTIONS = {
  renda: { name: 'Renda', short: '+1', cost: 0, claim: null, target: false, blockers: [], anyoneBlocks: false, desc: 'Pegue 1 moeda. Não pode ser bloqueada.' },
  ajuda: { name: 'Ajuda Externa', short: '+2', cost: 0, claim: null, target: false, blockers: ['banqueiro'], anyoneBlocks: true, desc: 'Pegue 2 moedas. Qualquer um pode bloquear alegando o Banqueiro.' },
  golpe: { name: 'Golpe', short: '−7', cost: 7, claim: null, target: true, blockers: [], anyoneBlocks: false, desc: 'Pague 7: o alvo perde uma influência. Imbloqueável.' },
  juros: { name: 'Cobrar Juros', short: '+3', cost: 0, claim: 'banqueiro', target: false, blockers: [], anyoneBlocks: false, desc: 'Alegue o Banqueiro e pegue 3 moedas.' },
  envenenar: { name: 'Envenenar', short: '−3', cost: 3, claim: 'envenenador', target: true, blockers: ['alquimista'], anyoneBlocks: false, desc: 'Alegue o Envenenador, pague 3: o alvo perde uma influência.' },
  saquear: { name: 'Saquear', short: '⇄2', cost: 0, claim: 'contrabandista', target: true, blockers: ['contrabandista', 'emissario'], anyoneBlocks: false, desc: 'Alegue o Contrabandista e tome 2 moedas de alguém.' },
  negociar: { name: 'Negociar', short: '↻', cost: 0, claim: 'emissario', target: false, blockers: [], anyoneBlocks: false, desc: 'Alegue o Emissário: compre 2 cartas e devolva 2.' },
};

export const ACTION_KEYS = Object.keys(ACTIONS);

export const MAX_SEATS = 9;
export const COUP_COST = 7;
export const FORCED_COUP = 10;

/** Cópias de cada personagem conforme o número de jogadores. */
export function copiesFor(n) {
  if (n <= 6) return 3;
  if (n <= 8) return 4;
  return 5;
}
