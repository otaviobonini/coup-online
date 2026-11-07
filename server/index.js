// Servidor Node opcional: hospeda as salas e repassa mensagens via Socket.IO.
// (No GitHub Pages o jogo roda sem servidor, com o anfitrião no navegador via P2P.)
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomHub } from '../public/shared/rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', (_req, res) => res.send('ok'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

const hub = new RoomHub({ send: (cid, ev, payload) => io.to(cid).emit(ev, payload) });

io.on('connection', (socket) => {
  socket.onAny((ev, data, ack) => {
    if (typeof data === 'function') { ack = data; data = undefined; }
    const res = hub.handle(socket.id, ev, data);
    if (typeof ack === 'function') ack(res);
  });
  socket.on('disconnect', () => hub.disconnect(socket.id));
});

server.listen(PORT, () => console.log(`Mascarada rodando em http://localhost:${PORT}`));
