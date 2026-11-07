import { io } from 'socket.io-client';
import { BACKEND_BASE } from './apiBase';

// Socket.io runs on port 9001 (separate from REST API on 8080/5000)
const SOCKET_URL = BACKEND_BASE.replace(/:(\d+)$/, ':9001');

const socket = io(SOCKET_URL, {
  transports: ['polling', 'websocket'],
  reconnectionAttempts: Infinity,
});

// Cache the last joined room parameters
let lastJoinedRoomParam = null;

const originalEmit = socket.emit;
socket.emit = function (event, ...args) {
  if (event === 'join-hotel-room') {
    lastJoinedRoomParam = args[0];
    console.log('[SOCKET] Joined room');
    console.log('[SOCKET] Room name:', args[0]);
  }
  return originalEmit.apply(this, [event, ...args]);
};

socket.on('connect', () => {
  console.log('[SOCKET] Connected');
  console.log('[SOCKET] Socket ID:', socket.id);
  console.log('[SOCKET] Connected URL:', BACKEND_BASE);

  // Auto-rejoin the hotel room on reconnect/connect
  if (lastJoinedRoomParam) {
    console.log('[SOCKET] Re-joining room on connect/reconnect:', lastJoinedRoomParam);
    originalEmit.call(socket, 'join-hotel-room', lastJoinedRoomParam);
  }
});

socket.on('connect_error', (error) => {
  console.log('[SOCKET] Connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('[SOCKET] Disconnected. Reason:', reason);
});

// Temporary debug logs for print acknowledgments
socket.on('kot_print_acknowledged', (data) => {
  console.log('[SOCKET] Received kot_print_acknowledged', data);
});

socket.on('bill_print_acknowledged', (data) => {
  console.log('[SOCKET] Received bill_print_acknowledged', data);
});

export default socket;
