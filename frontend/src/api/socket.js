import { io } from 'socket.io-client';

// One shared Socket.IO connection (through nginx at /socket.io/).
// `auth` is a function so every (re)connection sends the current token:
// logged-in users join their private room, guests only get public events.
export const socket = io({
  autoConnect: false,
  auth: (callback) => callback({ token: localStorage.getItem('token') || '' }),
});
