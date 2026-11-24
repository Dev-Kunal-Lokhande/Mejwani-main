import { io } from 'socket.io-client';
import { BACKEND_BASE } from './apiBase';

const isBrowser = typeof window !== 'undefined';
const isLocalHost =
  isBrowser && ['localhost', '127.0.0.1'].includes(window.location.hostname);

const hasExplicitSocketUrl = Boolean(import.meta.env?.VITE_SOCKET_URL);

// Local development uses port 9001 when BACKEND_BASE has a port;
// hosted URLs use VITE_SOCKET_URL if configured, otherwise BACKEND_BASE.
const SOCKET_URL =
  import.meta.env?.VITE_SOCKET_URL ||
  (isLocalHost ? BACKEND_BASE.replace(/:(\d+)$/, ':9001') : BACKEND_BASE);

const getAuthToken = () => {
  if (typeof localStorage === 'undefined') return '';
  return (
    localStorage.getItem('mejwani_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    ''
  );
};

const token = getAuthToken();

const shouldConnectSocket = isLocalHost || hasExplicitSocketUrl;

const socket = io(SOCKET_URL, {
  transports: ['polling', 'websocket'],
  autoConnect: shouldConnectSocket,
  reconnection: shouldConnectSocket,
  reconnectionAttempts: shouldConnectSocket ? Infinity : 0,
  reconnectionDelay: 3000,
  auth: token ? { token } : undefined,
});

// Cache the last joined room parameters
let lastJoinedRoomParam = null;

const originalEmit = socket.emit;
socket.emit = function (event, ...args) {
  if (event === 'join-hotel-room') {
    lastJoinedRoomParam = args[0];
    if (!shouldConnectSocket) {
      return this;
    }
    console.log('[SOCKET] Joined room');
    console.log('[SOCKET] Room name:', args[0]);
  }
  return originalEmit.apply(this, [event, ...args]);
};

socket.on('connect', () => {
  const latestToken = getAuthToken();
  if (latestToken) {
    socket.auth = { token: latestToken };
  }

  console.log('[SOCKET] Connected');
  console.log('[SOCKET] Socket ID:', socket.id);
  console.log('[SOCKET] Connected URL:', SOCKET_URL);

  // Auto-rejoin the hotel room on reconnect/connect
  if (lastJoinedRoomParam) {
    console.log('[SOCKET] Re-joining room on connect/reconnect:', lastJoinedRoomParam);
    originalEmit.call(socket, 'join-hotel-room', lastJoinedRoomParam);
  }
});

socket.on('connect_error', (error) => {
  const msg = String(error?.message || '');
  if (
    !shouldConnectSocket &&
    (msg.includes('403') || msg.includes('xhr poll error') || msg.includes('timeout'))
  ) {
    socket.io.opts.reconnection = false;
    socket.disconnect();
    return;
  }
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