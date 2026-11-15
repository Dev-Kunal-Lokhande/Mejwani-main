import { createContext, useContext, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import socket from '../services/socketClient';
import { playServiceRequestSound } from '../services/realtimeAlerts';
import { getAudioContext } from '../services/audioHelper';

const NotificationContext = createContext(null);
export const useNotifications = () => useContext(NotificationContext);

const processedRequests = new Set();
const REQUEST_TTL_MS = 30_000;

const markProcessed = (requestId) => {
  processedRequests.add(requestId);
  setTimeout(() => processedRequests.delete(requestId), REQUEST_TTL_MS);
};

const isAlreadyProcessed = (requestId) => processedRequests.has(requestId);

const isAdmin = () => !!localStorage.getItem('mejwani_admin_jwt');
const isCaptain = () =>
  !!localStorage.getItem('mejwani_captain_jwt') ||
  !!localStorage.getItem('mejwani_captain_user');

const STORAGE_KEY = 'mejwani_notifications_list';

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 30)));
    } catch {}
  }, [notifications]);

  const addNotificationItem = (item) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === item.id)) return prev;
      return [
        {
          ...item,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unread: true,
        },
        ...prev,
      ].slice(0, 30);
    });
  };

  const markAsRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const requestQueue = useRef([]);
  const isProcessingRequest = useRef(false);

  const playChime = () => {
    const soundEnabled = localStorage.getItem('mejwani_voice_announcement_enabled') !== 'false';
    if (!soundEnabled) return;

    try {
      const ctx = getAudioContext();
      if (!ctx) return;

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

      playNote(523.25, 0, 0.4);
      playNote(659.25, 0.15, 0.6);
    } catch (e) {
      console.warn('[Realtime Alert] Play chime failed:', e);
    }
  };

  const speakText = (text) => {
    const soundEnabled = localStorage.getItem('mejwani_voice_announcement_enabled') !== 'false';
    if (!soundEnabled || !window.speechSynthesis) return;

    try {
      const speech = new SpeechSynthesisUtterance(text);
      speech.lang = 'en-US';
      speech.rate = 0.95;
      speech.pitch = 1;
      speech.volume = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(speech);
    } catch (e) {
      console.warn('[Realtime Alert] Speech synthesis failed:', e);
    }
  };

  const processQueue = useRef(null);
  processQueue.current = async () => {
    if (isProcessingRequest.current || requestQueue.current.length === 0) return;

    isProcessingRequest.current = true;
    const item = requestQueue.current.shift();

    toast(item.message, {
      icon: item.icon || '📢',
      position: 'top-right',
      duration: 6000,
      style: {
        borderRadius: '18px',
        background: item.bgColor || '#0f172a',
        color: '#ffffff',
        fontWeight: '700',
        boxShadow: '0 20px 45px rgba(15,23,42,0.22)',
      },
    });

    playChime();

    if (item.customSpeech) {
      speakText(item.customSpeech);
    } else {
      await playServiceRequestSound(item.cleanTableName, item.requestLabel, item.extra);
    }

    isProcessingRequest.current = false;
    processQueue.current();
  };

  useEffect(() => {
    const handleCustomerRequest = (request) => {
      if (!request || !request.requestId) return;
      if (isAlreadyProcessed(request.requestId)) return;
      if (!isAdmin() && !isCaptain()) return;

      markProcessed(request.requestId);

      const tableLabel = request.tableName || String(request.tableId);
      const requestLabel = request.requestType || 'Service';
      const cleanTableName = tableLabel.replace(/^Table\s+/i, '');
      const message = `🔔 Table ${tableLabel} needs ${requestLabel}`;

      addNotificationItem({
        id: request.requestId,
        type: 'service',
        title: `Service Request — Table ${tableLabel}`,
        message,
        targetRoute: '/admin/orders',
      });

      requestQueue.current.push({
        requestId: request.requestId,
        tableName: tableLabel,
        message,
        cleanTableName,
        requestLabel,
        extra: { itemCount: request.itemCount, itemNames: request.itemNames },
      });

      processQueue.current();
    };

    const handleCaptainOnlyRequest = (request) => {
      if (!isCaptain()) return;
      handleCustomerRequest(request);
    };

    // ── ORDER READY (PARCEL vs TABLE LOGIC) ───────────────────────────────
    const handleOrderReady = (payload) => {
      if (!payload) return;
      if (payload.status && payload.status !== 'READY') return;
      if (!isAdmin() && !isCaptain()) return;

      const dedupKey = `order-ready-${payload.orderId || payload.kotNumber}`;
      if (isAlreadyProcessed(dedupKey)) return;
      markProcessed(dedupKey);

      const rawName = String(payload.tableName || payload.table_name || '').trim();
      const isParcelOrder =
        payload.isParcel === true ||
        rawName.toLowerCase().includes('parcel') ||
        String(payload.kotNumber || '').toUpperCase().startsWith('PARCEL');

      let toastMsg = '';
      let speechMsg = '';
      let titleText = '';

      if (isParcelOrder) {
        const parcelLabel = rawName || payload.kotNumber || `Parcel #${payload.orderId || ''}`;
        titleText = `Parcel Ready`;
        toastMsg = ` ${parcelLabel} is ready!`;
        speechMsg = `${parcelLabel} is ready.`;
      } else {
        const cleanTable = rawName.replace(/^Table\s+/i, '') || 'Table';
        titleText = `Table ${cleanTable} Order Ready`;
        toastMsg = ` Table ${cleanTable} order is ready!`;
        speechMsg = `Table ${cleanTable} order is ready.`;
      }

      addNotificationItem({
        id: dedupKey,
        type: 'ready',
        title: titleText,
        message: toastMsg,
        targetRoute: '/admin/orders',
      });

      requestQueue.current.push({
        requestId: dedupKey,
        tableName: rawName,
        icon: isParcelOrder ? '🛍️' : '🍽️',
        bgColor: '#065f46',
        message: toastMsg,
        customSpeech: speechMsg,
      });

      processQueue.current();
    };

    const handleNewOrder = (payload) => {
      if (!payload) return;
      if (!isAdmin() && !isCaptain()) return;

      const dedupKey = `new-order-${payload.orderId || Date.now()}`;
      if (isAlreadyProcessed(dedupKey)) return;
      markProcessed(dedupKey);

      const tName = payload.tableCode || payload.tableName || 'Table';

      addNotificationItem({
        id: dedupKey,
        type: 'order',
        title: `New Order — Table ${tName}`,
        message: `🛎️ New Order received from Table ${tName}!`,
        targetRoute: '/admin/orders',
      });

      requestQueue.current.push({
        requestId: dedupKey,
        tableName: tName,
        icon: '🛎️',
        bgColor: '#9a3412',
        message: `New Order received from Table ${tName}!`,
        customSpeech: `New order received from Table ${tName}.`,
      });

      processQueue.current();
    };

    let bc = null;
    try {
      bc = new BroadcastChannel('mejwani_realtime_alerts');
      bc.onmessage = (event) => {
        if (event.data?.type === 'ORDER_READY') {
          handleOrderReady(event.data.payload);
        }
      };
    } catch {}

    const handleAnySocketEvent = (eventName, payload) => {
      if (
        ['order-ready', 'order_ready', 'order-status-update', 'ORDER_STATUS_UPDATE'].includes(eventName) &&
        payload?.status === 'READY'
      ) {
        handleOrderReady(payload);
      }
    };

    socket.on('customer_request', handleCustomerRequest);
    socket.on('captain_only_request', handleCaptainOnlyRequest);
    socket.on('order-ready', handleOrderReady);
    socket.on('order-updated', handleOrderReady);
    socket.on('new-order', handleNewOrder);
    if (typeof socket.onAny === 'function') {
      socket.onAny(handleAnySocketEvent);
    }

    return () => {
      socket.off('customer_request', handleCustomerRequest);
      socket.off('captain_only_request', handleCaptainOnlyRequest);
      socket.off('order-ready', handleOrderReady);
      socket.off('order-updated', handleOrderReady);
      socket.off('new-order', handleNewOrder);
      if (typeof socket.offAny === 'function') {
        socket.offAny(handleAnySocketEvent);
      }
      if (bc) bc.close();
    };
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export default NotificationContext;