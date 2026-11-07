import React, { useEffect, useState, useRef } from 'react';
import {
  Bell,
  ShoppingBag,
  Info,
  AlertTriangle,
  Search,
  Check,
  X
} from 'lucide-react';

import AdminLayout from '../../../shared/layouts/AdminLayout';
import socket from '../../../shared/services/socketClient';
import { getAudioContext } from '../../../shared/services/audioHelper';

const processedRequests = new Set();

const initialNotifications = [
  {
    id: 1,
    type: 'order',
    title: 'New Online Order',
    message: 'Order #4293 received for Table 05',
    time: '2 mins ago',
    unread: true,
  },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(initialNotifications);

  // =========================
  // SOUND EFFECT
  // =========================
  const playServiceChime = () => {
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
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + delay + duration
        );

        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration);
      };

      playNote(587.33, 0, 0.35);
      playNote(659.25, 0.1, 0.35);
      playNote(783.99, 0.2, 0.5);
    } catch (e) {
      console.warn('Audio blocked:', e);
    }
  };

  // =========================
  // GOOGLE VOICE SPEAK
  // =========================
  const speakNotification = (text) => {
    if (!window.speechSynthesis) return;

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = 'en-US';
    speech.rate = 0.9;
    speech.pitch = 1;
    speech.volume = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
  };

  useEffect(() => {

    // =========================
    // NEW ORDER
    // =========================
    const handleNewOrder = (payload) => {

      playServiceChime();

      const itemsText =
        payload?.items
          ?.map((item) => `${item.qty} ${item.name}`)
          .join(', ') || '';

      // GOOGLE VOICE
      speakNotification(
        `New order received from Table ${payload.tableCode}. ${itemsText}`
      );

      const notifId = `socket-order-${Date.now()}`;
      const notification = {
        id: notifId,
        type: 'order',
        title: `QR Order #${payload.orderId || 'NEW'}`,
        // Include Order Type explicitly and Table Number in the message
        message: `Order Type: QR Order • Table ${payload.tableCode} — ${itemsText}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        unread: true,
      };

      // Add notification (FIFO - added below existing ones)
      setNotifications((prev) => {
        const isDuplicate = prev.some(
          (n) => n.unread && n.message === notification.message && n.type === notification.type
        );
        if (isDuplicate) return prev;
        return [...prev, notification];
      });

      // Auto-expire notification after 60 seconds (60000 ms)
      // Track the timeout so it can be cleared if user clears all notifications
      const timeoutId = setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notifId));
        // remove from tracking
        try { delete timersRef.current[notifId]; } catch (e) {}
      }, 60000);

      // store timeout id for potential cleanup
      timersRef.current[notifId] = timeoutId;
    };

    // =========================
    // SERVICE REQUEST
    // =========================
    const handleServiceRequest = (payload) => {
      if (!payload || !payload.requestId) return;
      if (processedRequests.has(payload.requestId)) return;
      processedRequests.add(payload.requestId);

      const isCaptain = payload.requestType === 'Call Captain' || payload.requestType === 'Captain Requested';
      let notifTitle = '';
      let notifMessage = '';

      if (payload.requestType === 'MENU_REQUEST') {
        notifTitle = `Menu Sent — ${payload.areaName || 'Floor'}`;
        const count = payload.itemCount || 0;
        const names = payload.itemNames || [];
        if (count === 1) {
          notifMessage = `🔔 Table ${payload.tableName || 'N/A'} wants ${names[0] || '1 item'}`;
        } else {
          notifMessage = `🔔 Table ${payload.tableName || 'N/A'} wants ${count} items`;
        }
      } else {
        const label = payload.requestType || 'assistance';
        const isCap = label === 'CALL_CAPTAIN' || label === 'Call Captain' || label === 'Captain Requested' || label === 'Captain';
        
        notifTitle = isCap ? `Captain Call — ${payload.areaName || 'Floor'}` : `Service Request — ${payload.areaName || 'Floor'}`;
        
        if (isCap) {
          notifMessage = `🔔 Table ${payload.tableName || 'N/A'} requesting captain`;
        } else if (label === 'WATER') {
          notifMessage = `🔔 Table ${payload.tableName || 'N/A'} needs Water`;
        } else if (label === 'TISSUE') {
          notifMessage = `🔔 Table ${payload.tableName || 'N/A'} needs Tissue`;
        } else if (label === 'BILL') {
          notifMessage = `🔔 Table ${payload.tableName || 'N/A'} needs Bill`;
        } else if (label === 'CLEAN_TABLE') {
          notifMessage = `🔔 Table ${payload.tableName || 'N/A'} needs Clean Table`;
        } else {
          notifMessage = `Table ${payload.tableName || 'N/A'} requested ${label}`;
        }
      }

      const notification = {
        id: payload.requestId || `socket-service-${Date.now()}`,
        type: 'service',
        title: notifTitle,
        message: notifMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        unread: true,
      };

      // Service requests do NOT auto-expire — leave them until user clears or marks read (FIFO)
      setNotifications((prev) => {
        const isDuplicate = prev.some(
          (n) => n.unread && n.message === notification.message && n.type === notification.type
        );
        if (isDuplicate) return prev;
        return [...prev, notification];
      });
    };

    // SOCKET EVENTS
    socket.on('new-order', handleNewOrder);
    
    socket.off('customer_request');
    socket.on('customer_request', handleServiceRequest);

    return () => {
      socket.off('new-order', handleNewOrder);
      socket.off('customer_request', handleServiceRequest);
      // clear any pending timers
      try {
        Object.values(timersRef.current || {}).forEach((tid) => clearTimeout(tid));
      } catch (e) {}
      timersRef.current = {};
    };
  }, []);

  // =========================
  // STYLES
  // =========================
  const getTypeStyles = (type) => {
    switch (type) {
      case 'order':
        return 'bg-primary/10 text-primary';

      case 'system':
        return 'bg-blue-500/10 text-blue-500';

      case 'alert':
        return 'bg-red-500/10 text-red-500';

      case 'service':
        return 'bg-orange-500/10 text-orange-500';

      default:
        return 'bg-slate-100 text-slate-500';
    }
  };

  // =========================
  // ICONS
  // =========================
  const getTypeIcon = (type) => {
    switch (type) {
      case 'order':
        return <ShoppingBag className="w-4 h-4" />;

      case 'system':
        return <Info className="w-4 h-4" />;

      case 'alert':
        return <AlertTriangle className="w-4 h-4" />;

      case 'service':
        return <Bell className="w-4 h-4" />;

      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  // =========================
  // ACTIONS
  // =========================
  const markAllRead = () => {
    // use functional update to avoid stale state
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const clearAll = () => {
    if (window.confirm('Clear all notifications?')) {
      // clear UI notifications and cancel any pending auto-expire timers
      try {
        Object.values(timersRef.current || {}).forEach((tid) => clearTimeout(tid));
      } catch (e) {}
      timersRef.current = {};
      setNotifications([]);
    }
  };

  // track timeouts for auto-expiring notifications so we can cancel them
  const timersRef = useRef({});
  const lastReceivedRequests = useRef({});

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }
    } catch (e) {}
  };

  return (
    <AdminLayout>

      <div className="max-w-4xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              Notifications
            </h3>

            <p className="text-slate-500 dark:text-white/40 text-sm font-bold">
              Live Restaurant Alerts & Orders
            </p>
          </div>

          <div className="flex gap-3">

            <button
              onClick={markAllRead}
              className="px-5 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 rounded-xl text-xs font-black hover:bg-slate-200 transition-all uppercase tracking-wider"
            >
              Mark all as read
            </button>

            <button
              onClick={clearAll}
              className="px-5 py-2.5 bg-red-500/10 text-red-500 rounded-xl text-xs font-black hover:bg-red-500 hover:text-white transition-all uppercase tracking-wider"
            >
              Clear All
            </button>

          </div>
        </div>

        {/* NOTIFICATIONS */}
        {notifications.length > 0 ? (

          <div className="space-y-4">

            {notifications.map((note) => (

              <div
                key={note.id}
                className={`p-6 bg-white dark:bg-[#0d0d0d] border rounded-3xl transition-all duration-300 relative group
                ${
                  note.unread
                    ? 'border-primary/30 shadow-lg shadow-primary/5'
                    : 'border-slate-100 dark:border-white/5 opacity-80'
                }`}
              >

                {note.unread && (
                  <div className="absolute top-6 left-2 w-1.5 h-1.5 bg-primary rounded-full" />
                )}

                <div className="flex gap-5">

                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${getTypeStyles(
                      note.type
                    )}`}
                  >
                    {getTypeIcon(note.type)}
                  </div>

                  <div className="flex-1">

                    <div className="flex justify-between items-start mb-1">

                      <h4 className="text-lg font-black text-slate-900 dark:text-white">
                        {note.title}
                      </h4>

                      <span className="text-[10px] font-black text-slate-400 dark:text-white/20 uppercase tracking-widest">
                        {note.time}
                      </span>

                    </div>

                    <p className="text-sm font-bold text-slate-500 dark:text-white/40">
                      {note.message}
                    </p>

                  </div>

                  <div className="flex flex-col gap-2 justify-center items-end shrink-0">
                    {note.unread && (
                      <button
                        onClick={() => markAsRead(note.id)}
                        className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer border border-transparent"
                      >
                        <Check className="w-3 h-3" />
                        Mark Read
                      </button>
                    )}
                    <button
                      onClick={() => dismissNotification(note.id)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer border border-transparent"
                    >
                      <X className="w-3 h-3" />
                      Dismiss
                    </button>
                  </div>

                </div>

              </div>

            ))}

          </div>

        ) : (

          <div className="py-20 flex flex-col items-center justify-center text-center opacity-20">

            <Bell className="w-20 h-20 mb-6" />

            <h4 className="text-2xl font-black uppercase">
              All Caught Up!
            </h4>

            <p className="font-bold">
              No new notifications at the moment.
            </p>

          </div>

        )}

      </div>

    </AdminLayout>
  );
}