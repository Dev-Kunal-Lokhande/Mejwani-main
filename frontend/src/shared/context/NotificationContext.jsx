/**
 * NotificationContext.jsx
 *
 * Global notification provider — mounts ONCE after login and lives for the
 * entire user session.  This is the single authoritative place for:
 *   - customer_request  → toast + voice alert (admin + captain)
 *   - captain_only_request → toast + voice alert (captain only)
 *
 * All per-page duplicate listeners in Orders.jsx and CaptainPanel.jsx have
 * been removed.  Data-refresh listeners remain in their respective components.
 */

import { createContext, useContext, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import socket from '../services/socketClient';
import { playServiceRequestSound } from '../services/realtimeAlerts';
import { getAudioContext } from '../services/audioHelper';

// ─── Context (exported for optional future consumers) ─────────────────────────
const NotificationContext = createContext(null);
export const useNotifications = () => useContext(NotificationContext);

// ─── Deduplication — module-level set with TTL cleanup ───────────────────────
const processedRequests = new Set();
const REQUEST_TTL_MS = 30_000; // entries auto-expire after 30 s

const markProcessed = (requestId) => {
  processedRequests.add(requestId);
  setTimeout(() => processedRequests.delete(requestId), REQUEST_TTL_MS);
};

const isAlreadyProcessed = (requestId) => processedRequests.has(requestId);

const isAdmin = () => !!localStorage.getItem('mejwani_admin_jwt');
const isCaptain = () => !!localStorage.getItem('mejwani_captain_jwt') || !!localStorage.getItem('mejwani_captain_user');

// ─── Build toast message from request payload ─────────────────────────────────
const buildToastMessage = (tableLabel, requestLabel, request) => {
  if (requestLabel === 'MENU_REQUEST') {
    const count = request.itemCount || 0;
    const names = request.itemNames || [];
    if (count === 1) return `🔔 Table ${tableLabel} wants ${names[0] || '1 item'}`;
    return `🔔 Table ${tableLabel} wants ${count} items`;
  }
  if (
    requestLabel === 'CALL_CAPTAIN' ||
    requestLabel === 'Call Captain' ||
    requestLabel === 'Captain Requested' ||
    requestLabel === 'Captain'
  ) {
    return `🔔 Table ${tableLabel} requesting captain`;
  }
  if (requestLabel === 'WATER') return `🔔 Table ${tableLabel} needs Water`;
  if (requestLabel === 'TISSUE') return `🔔 Table ${tableLabel} needs Tissue`;
  if (requestLabel === 'BILL') return `🔔 Table ${tableLabel} needs Bill`;
  if (requestLabel === 'CLEAN_TABLE') return `🔔 Table ${tableLabel} needs Clean Table`;
  return `🔔 Table ${tableLabel} needs ${requestLabel}`;
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }) {
  const requestQueue = useRef([]);
  const isProcessingRequest = useRef(false);

  const playChime = () => {
    const soundEnabled = localStorage.getItem('mejwani_voice_announcement_enabled') !== 'false';
    if (!soundEnabled) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playNote = (freq, delay, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
      };

      playNote(523.25, 0, 0.4);   // C5 Harmonic Tone
      playNote(659.25, 0.15, 0.6); // E5 Harmonic Tone
    } catch (e) {
      console.warn('[Realtime Alert] Play chime failed:', e);
    }
  };

  // Sequential queue processor — toast first, then await voice, then next
  const processQueue = useRef(null);
  processQueue.current = async () => {
    if (isProcessingRequest.current || requestQueue.current.length === 0) return;

    isProcessingRequest.current = true;
    const item = requestQueue.current.shift();

    toast(item.message, {
      icon: '📢',
      position: 'top-right',
      duration: 6000,
      style: {
        borderRadius: '18px',
        background: '#0f172a',
        color: '#ffffff',
        boxShadow: '0 20px 45px rgba(15,23,42,0.18)',
      },
    });

    playChime();

    await playServiceRequestSound(item.cleanTableName, item.requestLabel, item.extra);

    isProcessingRequest.current = false;
    processQueue.current();
  };

  useEffect(() => {
    // ── customer_request — fires for BOTH admin and captain rooms ──────────
    const handleCustomerRequest = (request) => {
      if (!request || !request.requestId) return;
      if (isAlreadyProcessed(request.requestId)) return;

      // Only process if current user is admin or captain
      if (!isAdmin() && !isCaptain()) return;

      markProcessed(request.requestId);

      const tableLabel = request.tableName || String(request.tableId);
      const requestLabel = request.requestType || 'Service';
      const cleanTableName = tableLabel.replace(/^Table\s+/i, '');
      const message = buildToastMessage(tableLabel, requestLabel, request);

      requestQueue.current.push({
        requestId: request.requestId,
        tableName: tableLabel,
        message,
        cleanTableName,
        requestLabel,
        extra: {
          itemCount: request.itemCount,
          itemNames: request.itemNames,
        },
      });

      processQueue.current();

      // Signal CaptainPanel (if mounted) to refresh its captain-request data
      window.dispatchEvent(
        new CustomEvent('mejwani:customer-request', { detail: request })
      );
    };

    // ── captain_only_request — fires to captain room ONLY ─────────────────
    const handleCaptainOnlyRequest = (request) => {
      // If the logged-in user is not a captain, skip silently
      if (!isCaptain()) return;

      // Delegate to the same handler — deduplication handles the rest
      handleCustomerRequest(request);
    };

    socket.on('customer_request', handleCustomerRequest);
    socket.on('captain_only_request', handleCaptainOnlyRequest);

    console.log('[NotificationContext] Global socket listeners registered.');

    return () => {
      socket.off('customer_request', handleCustomerRequest);
      socket.off('captain_only_request', handleCaptainOnlyRequest);
      console.log('[NotificationContext] Global socket listeners removed.');
    };
  }, []);

  return (
    <NotificationContext.Provider value={null}>
      {children}
    </NotificationContext.Provider>
  );
}

export default NotificationContext;
