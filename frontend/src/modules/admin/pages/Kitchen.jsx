import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  ChefHat,
  Timer,
  RefreshCw,
  Play,
  User,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import axios from 'axios';
import AdminLayout from '../../../shared/layouts/AdminLayout';
import { API_BASE } from '../../../shared/services/apiBase';
import socket from '../../../shared/services/socketClient';

const parseTimestampToDate = (rawValue) => {
  if (!rawValue) return null;
  if (rawValue instanceof Date) {
    return Number.isNaN(rawValue.getTime()) ? null : rawValue;
  }
  if (typeof rawValue === 'number') {
    const ms = rawValue < 1e12 ? rawValue * 1000 : rawValue;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const str = String(rawValue).trim();
  if (!str) return null;

  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(str)) {
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const normalized = str.includes(' ') ? str.replace(' ', 'T') : str;
  const utcCandidate = new Date(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized) ? `${normalized}Z` : normalized
  );
  if (!Number.isNaN(utcCandidate.getTime())) {
    return utcCandidate;
  }

  const fallback = new Date(str);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const getOrderTimestamp = (order) => {
  if (!order) return null;
  return (
    order.createdAt ||
    order.created_at ||
    order.kotTime ||
    order.kot_time ||
    order.updatedAt ||
    order.updated_at ||
    null
  );
};

const formatTableLabel = (tableNo) => {
  const clean = String(tableNo || '').replace(/^table\s*/i, '').trim();
  return clean || 'N/A';
};

const normalizeQueueStatus = (rawStatus) => {
  const st = String(rawStatus || '').toLowerCase().trim();
  if (['cooking', 'preparing'].includes(st)) return 'cooking';
  if (['ready', 'completed', 'dispatched', 'served'].includes(st)) return 'ready';
  return 'pending';
};

export default function AdminKitchen() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [toast, setToast] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const optimisticOverridesRef = useRef({});
  const updatingKeysRef = useRef({});
  const fetchSeqRef = useRef(0);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const tickInterval = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(tickInterval);
  }, []);

  const fetchQueue = useCallback(async (isManual = false) => {
    // Skip background polling while a click update is in flight so UI feels instant & never lags
    if (!isManual && Object.keys(updatingKeysRef.current).length > 0) {
      return;
    }

    const reqSeq = ++fetchSeqRef.current;
    if (isManual) setRefreshing(true);

    try {
      const token = localStorage.getItem('mejwani_admin_jwt');
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      const hParam = hotelId ? `?hotelId=${hotelId}` : '';

      const [ordersRes, parcelsRes] = await Promise.all([
        axios
          .get(`${API_BASE}/orders/kitchen-queue${hParam}`, { headers: authHeader })
          .catch(() => ({ data: { success: false } })),
        axios
          .get(`${API_BASE}/parcels?date=today${hotelId ? `&hotelId=${hotelId}` : ''}`, {
            headers: authHeader
          })
          .catch(() => ({ data: { success: false } }))
      ]);

      if (reqSeq !== fetchSeqRef.current) return;

      let allQueue = [];
      const seenParcelRefs = new Set();

      if (ordersRes.data && ordersRes.data.success) {
        const filteredOrders = (ordersRes.data.data || [])
          .filter((order) => {
            return (
              Array.isArray(order.items) &&
              order.items.length > 0 &&
              order.status &&
              ['pending', 'cooking', 'preparing', 'new', 'sent_to_kitchen'].includes(
                order.status.toLowerCase()
              ) &&
              order.type !== 'service-request' &&
              order.category !== 'service-request' &&
              order.requestType !== 'service-request'
            );
          })
          .map((order) => {
            const rawTable = String(order.tableNo || order.table_name || '').trim();
            const isOrderParcel =
              Boolean(order.isParcel || order.is_parcel) || /^parcel/i.test(rawTable);
            if (isOrderParcel) {
              seenParcelRefs.add(String(order.id));
              if (order.parcel_id) seenParcelRefs.add(String(order.parcel_id));
              seenParcelRefs.add(rawTable.toLowerCase());
            }
            return {
              ...order,
              queueKey: `order-${order.id}`,
              status: normalizeQueueStatus(order.status),
              isParcelOrderTable: isOrderParcel
            };
          });

        allQueue = [...allQueue, ...filteredOrders];
      }

      if (parcelsRes.data && parcelsRes.data.success) {
        const parcelData = (parcelsRes.data.data || []).filter((p) => {
          const st = String(p.status || '').toLowerCase();
          if (!['pending', 'pending_kitchen', 'preparing', 'cooking'].includes(st)) return false;

          const pIdStr = String(p.id || p._id || '');
          const pCodeStr = String(p.parcel_id || '');
          const pLabel = `parcel ${pCodeStr || pIdStr}`.toLowerCase();
          if (
            seenParcelRefs.has(pIdStr) ||
            (pCodeStr && seenParcelRefs.has(pCodeStr)) ||
            seenParcelRefs.has(pLabel)
          ) {
            return false;
          }
          return true;
        });

        const mappedParcels = parcelData.map((p) => {
          let pItems = [];
          if (typeof p.items === 'string') {
            try {
              pItems = JSON.parse(p.items);
            } catch (e) {}
          } else {
            pItems = p.items || [];
          }
          const rawId = p.id || p._id;
          return {
            _id: rawId,
            id: rawId,
            queueKey: `parcel-${rawId}`,
            tableNo: p.parcel_id ? `PARCEL ${p.parcel_id}` : 'PARCEL',
            captain: p.customer_name || 'Walk-in',
            status: normalizeQueueStatus(p.status),
            isParcel: true,
            parcel_id: p.parcel_id,
            createdAt: p.created_at || p.createdAt || new Date().toISOString(),
            items: pItems
          };
        });

        allQueue = [...allQueue, ...mappedParcels];
      }

      if (ordersRes.data && ordersRes.data.success) {
        const now = Date.now();
        const reconciledQueue = allQueue
          .map((item) => {
            const override = optimisticOverridesRef.current[item.queueKey];
            if (override && override.expiresAt > now) {
              return { ...item, status: override.status };
            }
            if (override && override.expiresAt <= now) {
              delete optimisticOverridesRef.current[item.queueKey];
            }
            return item;
          })
          .filter((item) => item.status !== 'ready');

        setQueue(reconciledQueue);
        setError(null);
      } else {
        setError('Failed to fetch the kitchen preparation queue.');
      }
    } catch (err) {
      console.error('Error fetching kitchen queue:', err);
      setError('Could not connect to the backend server. Make sure backend is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(() => {
      fetchQueue();
    }, 7000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Instant click processing: UI & events run immediately; API sync happens in background
  const handleUpdateStatus = (order) => {
    const {
      id: orderId,
      queueKey,
      status: currentStatus,
      tableNo,
      isParcel = false,
      isParcelOrderTable = false
    } = order;

    if (updatingKeysRef.current[queueKey]) return;
    updatingKeysRef.current[queueKey] = true;

    const normalizedCurrent = normalizeQueueStatus(currentStatus);
    const isPending = normalizedCurrent === 'pending';
    const uiNextStatus = isPending ? 'cooking' : 'ready';
    const apiNextStatus = isParcel
      ? isPending
        ? 'preparing'
        : 'ready'
      : isPending
      ? 'PREPARING'
      : 'READY';

    const token = localStorage.getItem('mejwani_admin_jwt');
    const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
    const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
    const hParam = hotelId ? `?hotelId=${hotelId}` : '';

    const url = isParcel
      ? `${API_BASE}/parcels/${orderId}${hParam}`
      : `${API_BASE}/orders/${orderId}/status${hParam}`;
    const cleanTable = formatTableLabel(tableNo);
    const parcelMode = Boolean(isParcel || isParcelOrderTable);

    // 1. Lock & update UI immediately on click
    optimisticOverridesRef.current[queueKey] = {
      status: uiNextStatus,
      expiresAt: Date.now() + 15000
    };

    if (uiNextStatus === 'ready') {
      setQueue((prev) => prev.filter((o) => o.queueKey !== queueKey));
      const displayTable = parcelMode
        ? order?.captain && order.captain !== 'Walk-in'
          ? order.captain
          : order?.parcel_id
          ? `Parcel ${order.parcel_id}`
          : cleanTable
        : cleanTable;

      const readyPayload = {
        hotelId,
        orderId,
        isParcel: parcelMode,
        tableName: displayTable,
        kotNumber: order?.kot_number || order?.parcel_id || `ORD-${orderId}`,
        status: 'READY'
      };

      socket.emit('order-ready', readyPayload);
      try {
        const bc = new BroadcastChannel('mejwani_realtime_alerts');
        bc.postMessage({ type: 'ORDER_READY', payload: readyPayload });
        bc.close();
      } catch (e) {}

      showToast(`${parcelMode ? displayTable : 'Table ' + displayTable} order marked READY!`);
    } else {
      setQueue((prev) =>
        prev.map((o) => (o.queueKey === queueKey ? { ...o, status: uiNextStatus } : o))
      );
      showToast(`${parcelMode ? cleanTable : 'Table ' + cleanTable} order is now COOKING!`);
    }

    // 2. Sync with backend immediately in background
    const requestPromise = isParcel
      ? axios.patch(url, { status: apiNextStatus }, { headers: authHeader })
      : axios.put(url, { status: apiNextStatus }, { headers: authHeader });

    requestPromise
      .then((response) => {
        if (!response.data || !response.data.success) {
          delete optimisticOverridesRef.current[queueKey];
          showToast('Error updating food preparation status.', 'error');
          fetchQueue(true);
        }
      })
      .catch((err) => {
        console.error('Error updating order status:', err);
        delete optimisticOverridesRef.current[queueKey];
        showToast('Action failed. Make sure backend is running.', 'error');
        fetchQueue(true);
      })
      .finally(() => {
        delete updatingKeysRef.current[queueKey];
      });
  };

  const pendingCount = queue.filter((o) => normalizeQueueStatus(o.status) === 'pending').length;
  const cookingCount = queue.filter((o) => normalizeQueueStatus(o.status) === 'cooking').length;

  const formatTime = (rawDate) => {
    const parsed = parseTimestampToDate(rawDate);
    if (!parsed) return '--:--';
    try {
      return parsed.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return '--:--';
    }
  };

  const getElapsedMins = (rawDate) => {
    const parsed = parseTimestampToDate(rawDate);
    if (!parsed) return 0;
    const diffMs = nowTick - parsed.getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
    return Math.floor(diffMs / 60000);
  };

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
        {toast && (
          <div
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-[1.5rem] shadow-xl text-white font-bold animate-in fade-in slide-in-from-top-4 duration-300
            ${toast.type === 'error' ? 'bg-red-500' : 'bg-slate-900'}
          `}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            )}
            <span className="text-xs">{toast.message}</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-[#0a0a0a] p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                <ChefHat className="text-orange-500 w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Kitchen Queue</h3>
            </div>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider pl-13">
              Admin Live Preparation Tracking Console
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pl-13 md:pl-0">
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-white/2 p-2 rounded-2xl border border-slate-200/50 dark:border-white/5">
              <div className="px-4 py-1 text-center">
                <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  PENDING
                </span>
                <span className="text-lg font-black text-slate-800 dark:text-white">{pendingCount}</span>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />
              <div className="px-4 py-1 text-center">
                <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  COOKING
                </span>
                <span className="text-lg font-black text-orange-500">{cookingCount}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchQueue(true)}
              disabled={refreshing || loading}
              className="p-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-orange-500 dark:hover:border-orange-500 rounded-2xl text-slate-600 dark:text-white/80 hover:text-orange-500 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-orange-500' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-[2rem] flex items-center gap-4 animate-in fade-in duration-300">
            <AlertCircle className="w-6 h-6 flex-shrink-0 animate-bounce" />
            <div className="text-xs font-bold">{error}</div>
            <button
              type="button"
              onClick={() => fetchQueue(true)}
              className="ml-auto px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-12 h-12 text-orange-500 animate-spin mb-4" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Retrieving Live Preparation Queue...
            </p>
          </div>
        ) : queue.length === 0 ? (
          <div className="h-96 bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/5 rounded-[3rem] flex flex-col items-center justify-center text-center p-8 shadow-sm">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/5 rounded-[2rem] flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-bounce" />
            </div>
            <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2">Kitchen Queue Clear</h4>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest max-w-sm leading-relaxed">
              All active orders have been successfully prepared and dispatched! Watching for new captain tickets...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {queue.map((order) => {
              const rawTimestamp = getOrderTimestamp(order);
              const elapsed = getElapsedMins(rawTimestamp);
              const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
              const isExpanded = expandedCard === order.queueKey;
              const isCooking = normalizeQueueStatus(order.status) === 'cooking';
              const cleanTable = formatTableLabel(order.tableNo);
              const parcelBadge = Boolean(order.isParcel || order.isParcelOrderTable);

              return (
                <div
                  key={order.queueKey}
                  className={`bg-white dark:bg-[#0d0d0d] border rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl transition-all duration-150 flex flex-col justify-between group relative overflow-hidden
                    ${isCooking ? 'border-orange-500/30 dark:border-orange-500/20' : 'border-slate-200 dark:border-white/5'}
                  `}
                >
                  {isCooking && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-orange-500 animate-pulse" />
                  )}

                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase">
                          {parcelBadge ? cleanTable : `TABLE ${cleanTable}`}
                        </h4>
                        <span className="inline-block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                          {totalItems} {totalItems === 1 ? 'ITEM' : 'ITEMS'}
                        </span>
                      </div>

                      <div
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider
                        ${elapsed >= 15 ? 'bg-red-500/10 text-red-500' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-white/40'}
                      `}
                      >
                        <Timer className="w-3.5 h-3.5" />
                        <span>{elapsed}m ago</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-white/60">
                        <User className="w-3.5 h-3.5 text-orange-500" />
                        <span>
                          {parcelBadge ? 'Customer' : 'Captain'}:{' '}
                          <strong className="text-slate-900 dark:text-white font-black">{order.captain}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-white/60">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          KOT Time:{' '}
                          <strong className="text-slate-800 dark:text-white/80 font-bold">
                            {formatTime(rawTimestamp)}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="mb-6">
                      <button
                        type="button"
                        onClick={() => setExpandedCard(isExpanded ? null : order.queueKey)}
                        className="w-full py-2 bg-slate-50 dark:bg-white/2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-orange-500 transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-100 dark:border-white/5"
                      >
                        {isExpanded ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" /> Hide Items List
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" /> View Items List
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 p-4 bg-slate-50 dark:bg-white/2 border border-slate-100 dark:border-white/5 rounded-2xl space-y-3 animate-in slide-in-from-top-2 duration-200">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2.5">
                              <div className="w-5 h-5 bg-orange-500/10 rounded-md flex items-center justify-center text-[10px] font-black text-orange-500 flex-shrink-0 mt-0.5">
                                {item.quantity}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 dark:text-white/80 leading-tight truncate">
                                  {item.name}
                                </p>
                                {item.note && (
                                  <p className="text-[10px] text-amber-600 italic font-bold mt-0.5 leading-none flex items-center gap-1">
                                    <AlertCircle className="w-2.5 h-2.5 flex-shrink-0" /> {item.note}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5 mt-auto">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        KOT Preparation
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full 
                          ${isCooking ? 'bg-orange-500 animate-ping' : 'bg-slate-300 dark:bg-white/20'}
                        `}
                        />
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                            parcelBadge
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {cleanTable} {order.parcel_id ? `(${order.parcel_id})` : ''}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider
                          ${isCooking ? 'text-orange-500' : 'text-slate-400 dark:text-slate-500'}
                        `}
                        >
                          {isCooking ? 'Preparing' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(order)}
                      className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-extrabold text-xs uppercase tracking-widest transition-all active:scale-[0.98] cursor-pointer ${
                        isCooking
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                          : 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25'
                      }`}
                    >
                      {isCooking ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Ready
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" /> Start Preparing
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}