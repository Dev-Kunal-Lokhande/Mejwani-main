import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  Flame,
  ChefHat,
  Timer,
  RefreshCw,
  Play,
  User,
  AlertCircle,
  Eye,
  EyeOff,
  ShoppingBag
} from 'lucide-react';
import axios from 'axios';
import AdminLayout from '../../../shared/layouts/AdminLayout';
import { API_BASE } from '../../../shared/services/apiBase';

export default function AdminKitchen() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [toast, setToast] = useState(null);

  // Show dynamic toast notifications
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch the active kitchen queue (pending & cooking orders)
  const fetchQueue = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [ordersRes, parcelsRes] = await Promise.all([
        axios.get(`${API_BASE}/orders/kitchen-queue`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_BASE}/parcels?date=today`).catch(() => ({ data: { success: false } }))
      ]);

      let allQueue = [];

      if (ordersRes.data && ordersRes.data.success) {
        const filteredOrders = ordersRes.data.data.filter((order) => {
          return (
            Array.isArray(order.items) &&
            order.items.length > 0 &&
            order.status &&
            ['pending', 'cooking'].includes(order.status.toLowerCase()) &&
            order.type !== 'service-request' &&
            order.category !== 'service-request' &&
            order.requestType !== 'service-request'
          );
        });
        allQueue = [...allQueue, ...filteredOrders];
      }

      if (parcelsRes.data && parcelsRes.data.success) {
        const parcelData = parcelsRes.data.data.filter(p => ['pending', 'pending_kitchen', 'preparing'].includes(p.status));
        const mappedParcels = parcelData.map(p => {
            let pItems = [];
            if (typeof p.items === 'string') {
                try { pItems = JSON.parse(p.items); } catch(e){}
            } else { pItems = p.items || []; }
            return {
                _id: p.id || p._id,
                id: p.id || p._id,
                tableNo: `PARCEL`,
                captain: p.customer_name || 'Walk-in',
                status: p.status === 'preparing' ? 'cooking' : 'pending',
                isParcel: true,
                parcel_id: p.parcel_id,
                items: pItems
            };
        });
        allQueue = [...allQueue, ...mappedParcels];
      }

      if (ordersRes.data && ordersRes.data.success) {
        setQueue(allQueue);
        setError(null);
      } else if (!ordersRes.data || !ordersRes.data.success) {
        setError('Failed to fetch the kitchen preparation queue.');
      }
    } catch (err) {
      console.error('Error fetching kitchen queue:', err);
      setError('Could not connect to the backend server. Make sure backend is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Set up live tracking polling
  useEffect(() => {
    fetchQueue();
    // Auto-poll the queue every 7 seconds for live synchronization
    const interval = setInterval(() => {
      fetchQueue();
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  // Update order preparation status
  const handleUpdateStatus = async (orderId, currentStatus, tableNo, isParcel = false) => {
    const nextStatus = currentStatus === 'pending' ? 'cooking' : 'ready';
    const apiNextStatus = isParcel ? (currentStatus === 'pending' ? 'preparing' : 'ready') : nextStatus;
    const url = isParcel ? `${API_BASE}/parcels/${orderId}` : `${API_BASE}/orders/${orderId}/status`;

    try {
      // Optimistic UI updates for high responsiveness
      setQueue(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus } : o));

      const response = isParcel 
        ? await axios.patch(url, { status: apiNextStatus }) 
        : await axios.put(url, { status: apiNextStatus });

      if (response.data && response.data.success) {
        if (nextStatus === 'ready') {
          showToast(`${isParcel ? 'Parcel' : 'Table ' + tableNo} order is marked READY and dispatched!`);
          // Automatically filter out the "ready" orders from the live kitchen queue
          setQueue(prev => prev.filter(o => o.id !== orderId));
        } else {
          showToast(`${isParcel ? 'Parcel' : 'Table ' + tableNo} order is now COOKING!`);
        }
      } else {
        showToast('Error updating food preparation status.', 'error');
        fetchQueue();
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      showToast('Action failed. Make sure backend is running.', 'error');
      fetchQueue();
    }
  };

  // Calculate stats
  const pendingCount = queue.filter(o => o.status === 'pending').length;
  const cookingCount = queue.filter(o => o.status === 'cooking').length;

  // Format date helper
  const formatTime = (isoString) => {
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
      return '';
    }
  };

  // Calculate elapsed minutes
  const getElapsedMins = (isoString) => {
    try {
      const diffMs = new Date() - new Date(isoString);
      return Math.max(0, Math.floor(diffMs / 60000));
    } catch (e) {
      return 0;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-[1600px] mx-auto pb-10">

        {/* Floating Toast Notification */}
        {toast && (
          <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-[1.5rem] shadow-xl text-white font-bold animate-in fade-in slide-in-from-top-4 duration-300
            ${toast.type === 'error' ? 'bg-red-500' : 'bg-slate-900'}
          `}>
            {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            <span className="text-xs">{toast.message}</span>
          </div>
        )}

        {/* Premium KDS Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-[#0a0a0a] p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                <ChefHat className="text-orange-500 w-5 h-5 animate-pulse" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Kitchen Queue</h3>
            </div>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider pl-13">Admin Live Preparation Tracking Console</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pl-13 md:pl-0">
            {/* Real-time counters */}
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-white/2 p-2 rounded-2xl border border-slate-200/50 dark:border-white/5">
              <div className="px-4 py-1 text-center">
                <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">PENDING</span>
                <span className="text-lg font-black text-slate-800 dark:text-white">{pendingCount}</span>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />
              <div className="px-4 py-1 text-center">
                <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">COOKING</span>
                <span className="text-lg font-black text-orange-500">{cookingCount}</span>
              </div>
            </div>

            {/* Manual refresh button */}
            <button
              onClick={() => fetchQueue(true)}
              disabled={refreshing || loading}
              className="p-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-orange-500 dark:hover:border-orange-500 rounded-2xl text-slate-600 dark:text-white/80 hover:text-orange-500 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-orange-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-[2rem] flex items-center gap-4 animate-in fade-in duration-300">
            <AlertCircle className="w-6 h-6 flex-shrink-0 animate-bounce" />
            <div className="text-xs font-bold">{error}</div>
            <button onClick={() => fetchQueue(true)} className="ml-auto px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-600 transition-colors">Retry</button>
          </div>
        )}

        {/* Loading Spinner state */}
        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-12 h-12 text-orange-500 animate-spin mb-4" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Retrieving Live Preparation Queue...</p>
          </div>
        ) : queue.length === 0 ? (
          /* Premium Empty Queue State */
          <div className="h-96 bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/5 rounded-[3rem] flex flex-col items-center justify-center text-center p-8 shadow-sm">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/5 rounded-[2rem] flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-bounce" />
            </div>
            <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2">Kitchen Queue Clear</h4>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest max-w-sm leading-relaxed">All active orders have been successfully prepared and dispatched! Watching for new captain tickets...</p>
          </div>
        ) : (
          /* Live Preparation Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {queue.map((order) => {
              const elapsed = getElapsedMins(order.createdAt);
              const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
              const isExpanded = expandedCard === order.id;

              return (
                <div
                  key={order.id}
                  className={`bg-white dark:bg-[#0d0d0d] border rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden
                    ${order.status === 'cooking' ? 'border-orange-500/30 dark:border-orange-500/20' : 'border-slate-200 dark:border-white/5'}
                  `}
                >
                  {/* Subtle Orange top bar for Cooking state */}
                  {order.status === 'cooking' && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-orange-500 animate-pulse" />
                  )}

                  <div>
                    {/* Card Header details */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase">{order.isParcel ? 'PARCEL' : `TABLE ${order.tableNo}`}</h4>
                        <span className="inline-block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                          {totalItems} {totalItems === 1 ? 'ITEM' : 'ITEMS'}
                        </span>
                      </div>

                      {/* Timer details */}
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider
                        ${elapsed >= 15 ? 'bg-red-500/10 text-red-500' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-white/40'}
                      `}>
                        <Timer className="w-3.5 h-3.5" />
                        <span>{elapsed}m ago</span>
                      </div>
                    </div>

                    {/* Captain & Time Metadata */}
                    <div className="space-y-2 mb-6">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-white/60">
                        <User className="w-3.5 h-3.5 text-orange-500" />
                        <span>{order.isParcel ? 'Customer' : 'Captain'}: <strong className="text-slate-900 dark:text-white font-black">{order.captain}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-white/60">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>KOT Time: <strong className="text-slate-800 dark:text-white/80 font-bold">{formatTime(order.createdAt)}</strong></span>
                      </div>
                    </div>

                    {/* Collapsible Food Items display */}
                    <div className="mb-6">
                      <button
                        onClick={() => setExpandedCard(isExpanded ? null : order.id)}
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
                                <p className="text-xs font-bold text-slate-800 dark:text-white/80 leading-tight truncate">{item.name}</p>
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

                  {/* Actions & Status Badge Footer */}
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5 mt-auto">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">KOT Preparation</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full 
                          ${order.status === 'cooking' ? 'bg-orange-500 animate-ping' : 'bg-slate-300 dark:bg-white/20'}
                        `} />
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                          order.isParcel 
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {order.tableNo} {order.parcel_id ? `(${order.parcel_id})` : ''}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider
                          ${order.status === 'cooking' ? 'text-orange-500' : 'text-slate-400 dark:text-slate-500'}
                        `}>
                          {order.status === 'cooking' ? 'Preparing' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleUpdateStatus(order.id, order.status, order.tableNo, order.isParcel)}
                      className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-extrabold text-xs uppercase tracking-widest transition-all ${
                        order.status === 'pending'
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                      }`}
                    >
                      {order.status === 'pending' ? (
                        <>
                          <Play className="w-3.5 h-3.5" /> Start Preparing
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Ready
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
