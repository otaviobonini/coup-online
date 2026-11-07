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

## Artes das cartas

As cartas podem ser imagens: coloque os arquivos em `public/cartas/` com os nomes
`banqueiro`, `envenenador`, `contrabandista`, `emissario`, `alquimista` e `verso`
(`.png`, `.webp`, `.jpg` ou `.svg`, proporção 5 × 7). Cada imagem encontrada substitui
a ilustração desenhada; as que faltarem continuam com o desenho padrão.
Detalhes em [`public/cartas/LEIAME.md`](public/cartas/LEIAME.md).

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

## Jogar online

**GitHub Pages (sem servidor):** https://otaviobonini.github.io/coup-online/

No Pages não existe servidor, então quem cria a sala vira o anfitrião: a partida roda no
navegador dele e os outros se conectam direto por WebRTC (PeerJS). Por isso o anfitrião
não pode fechar a aba durante o jogo (e, tecnicamente, poderia espiar as cartas pelo console do navegador; para partidas sérias use o servidor Node). O deploy é automático a cada push no `main`
(`.github/workflows/pages.yml`, publica a pasta `public/`).

**Servidor Node (opcional):** rodando `npm start` em qualquer host com WebSocket
(Render, Railway, Fly…), as salas ficam no servidor e o anfitrião pode sair à vontade.
No Render: *New → Web Service* com este repositório (há um `render.yaml` pronto).
O mesmo front-end detecta sozinho qual modo usar.

## Estrutura

```
public/shared/game.js    motor do jogo (máquina de estados autoritativa)
public/shared/rooms.js   salas, jogadores e bots (independente de transporte)
public/shared/bot.js     IA dos bots
public/shared/rules.js   personagens e ações
public/net.js            rede: Socket.IO (com servidor) ou P2P/PeerJS (GitHub Pages)
public/                  interface: mesa 3D em CSS, cartas em SVG ou imagens em public/cartas
server/index.js          servidor Node opcional (Socket.IO)
```

O servidor é a única fonte da verdade: cada jogador só recebe as próprias cartas.
Quem cai da conexão pode voltar para o mesmo lugar; quem sai no meio da partida é substituído por um bot.
