// Configuração de rede do jogo.

// Endereço de um servidor Node do jogo (o mesmo `npm start` deste repositório) hospedado
// fora do GitHub Pages, ex.: 'https://mascarada.onrender.com'.
// Preenchido, o site do Pages passa a usar esse servidor em vez do P2P — funciona em
// qualquer rede e o anfitrião pode sair sem derrubar a sala.
// Vazio, o Pages usa o modo P2P (anfitrião no navegador).
export const SERVER_URL = '';

// Servidores TURN extras para o modo P2P (opcional). Um TURN próprio é o que resolve de vez
// redes que bloqueiam conexão direta (4G, redes de faculdade/empresa). Ex.:
// { urls: 'turn:global.relay.metered.ca:443?transport=tcp', username: '...', credential: '...' }
export const EXTRA_ICE_SERVERS = [];
