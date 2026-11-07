# Mascarada — jogo de blefe online

Jogo de cartas de blefe e dedução para **2 a 9 jogadores**, no navegador, em tempo real.
Crie uma sala, mande o link e jogue. Lugares vazios podem ser preenchidos com bots, então dá para jogar sozinho.

Cada jogador começa com 2 cartas secretas (influências) e 2 moedas. Você pode alegar qualquer personagem, tendo a carta ou não; os outros podem contestar ou bloquear. Quem perde as duas influências sai do jogo. O último restante vence.

## Personagens

| Personagem | Ação | Bloqueia |
|---|---|---|
| Banqueiro | Cobrar Juros: +3 moedas | Ajuda Externa |
| Envenenador | Envenenar: paga 3, o alvo perde uma influência | — |
| Contrabandista | Saquear: toma 2 moedas de alguém | Saque |
| Emissário | Negociar: compra 2 cartas da Corte e troca | Saque |
| Alquimista | — | Envenenar |

Ações gerais: **Renda** (+1), **Ajuda Externa** (+2), **Golpe** (paga 7, imbloqueável; obrigatório com 10+ moedas).

- 2 jogadores: cada um começa com 1 moeda.
- 2–6 jogadores: 3 cópias de cada personagem; 7–8: 4 cópias; 9: 5 cópias.

## Rodando localmente

```bash
npm install
npm start
```

Abra http://localhost:3000. Para testar com amigos na mesma rede, use o IP da sua máquina.

## Testes

```bash
npm test                     # simula 3000 partidas só com bots (2 a 9 jogadores)
node test/multiplayer.js     # 9 clientes reais via socket: sala cheia, reconexão, saída, partida completa
```

## Publicando (Render, Railway, Fly…)

É um único servidor Node (Express + Socket.IO) que serve o front-end estático.
Qualquer host com suporte a WebSocket funciona:

- **Build:** `npm install`
- **Start:** `npm start`
- A porta vem da variável `PORT`.

No Render: *New → Web Service*, aponte para este repositório, e use os comandos acima (há um `render.yaml` pronto).

## Estrutura

```
server/index.js   salas, conexões e bots (Socket.IO)
server/game.js    motor do jogo (máquina de estados autoritativa)
server/bot.js     IA dos bots
shared/rules.js   personagens e ações (usado no servidor e no navegador)
public/           interface: mesa 3D em CSS, cartas ilustradas em SVG
```

O servidor é a única fonte da verdade: cada jogador só recebe as próprias cartas.
Quem cai da conexão pode voltar para o mesmo lugar; quem sai no meio da partida é substituído por um bot.
