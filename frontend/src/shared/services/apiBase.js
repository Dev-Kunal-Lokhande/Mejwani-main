const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const normalizeBase = (value) => (value || '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
const getPreferredBackendBase = () => {
  const rawEnvBase = typeof import.meta !== 'undefined' ? (import.meta.env.VITE_API_BASE || '') : '';
  const envBase = normalizeBase(rawEnvBase);
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';

  const candidateBases = [
    'http://localhost:8080',
    'http://localhost:5000',
    `http://${hostname}:8080`,
    `http://${hostname}:5000`,
    envBase,
  ];

  const uniqueBases = [...new Set(candidateBases.filter(Boolean))];

  const isLikelyFrontendDevPort = (port) => !!port && ['3000', '4173', '5173', '8000'].includes(port);
  if (isLikelyFrontendDevPort(currentPort)) {
    return uniqueBases.find((base) => base && !base.endsWith(`:${currentPort}`)) || 'http://localhost:8080';
  }

  return uniqueBases[0] || 'http://localhost:8080';
};

const BACKEND_BASE = getPreferredBackendBase();
const API_BASE = `${BACKEND_BASE}/api`;

const authorizedFetch = async (url, options = {}) => {
  const token = localStorage.getItem('mejwani_admin_jwt');
  const headers = {
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const startTime = Date.now();
  const res = await fetch(url, { ...options, headers });
  
  const serverDateStr = res.headers.get('Date');
  if (serverDateStr && typeof window !== 'undefined') {
    const serverTime = new Date(serverDateStr).getTime();
    if (!isNaN(serverTime)) {
      const rtt = Date.now() - startTime;
      window.mejwani_server_time_offset = (serverTime + rtt / 2) - Date.now();
    }
  }
  
  return res;
};

// Periodic background clock synchronization
if (typeof window !== 'undefined') {
  window.mejwani_server_time_offset = 0;
  const syncClock = async () => {
    try {
      const start = Date.now();
      const res = await fetch(`${API_BASE}/today/sales?limit=1&t=${Date.now()}`);
      const serverDateStr = res.headers.get('Date');
      if (serverDateStr) {
        const serverTime = new Date(serverDateStr).getTime();
        if (!isNaN(serverTime)) {
          const rtt = Date.now() - start;
          window.mejwani_server_time_offset = (serverTime + rtt / 2) - Date.now();
          console.log(`[Clock Sync] Server-client offset calibrated: ${window.mejwani_server_time_offset}ms`);
        }
      }
    } catch (e) {
      console.warn('[Clock Sync] Failed to synchronize clock with server:', e);
    }
  };
  syncClock();
  // Keep it calibrated every 2 minutes
  setInterval(syncClock, 120000);
}

export { BACKEND_BASE, API_BASE, authorizedFetch };
