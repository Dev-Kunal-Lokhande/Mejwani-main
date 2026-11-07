import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  Flame, 
  ChefHat, 
  AlertCircle,
  Timer,
  ChevronRight,
  Printer,
  RefreshCw
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { API_BASE } from '../../../shared/services/apiBase';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function KitchenDisplay() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());

  const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
  const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';

  // Dynamic KDS polling loop to query live PostgreSQL KOT and parcel statuses
  const syncKitchenOrders = async (showSyncIndicator = false) => {
    if (showSyncIndicator) setIsSyncing(true);
    try {
      // Fetch table orders
      const ordersRes = await fetch(`${API_BASE}/orders?hotelId=${hotelId}`);
      const ordersData = await ordersRes.json();

      let kdsMapped = [];
      if (ordersData.success) {
        kdsMapped = ordersData.data
          .filter(o => ['SENT_TO_KITCHEN', 'PREPARING', 'READY'].includes(o.status))
          .map(order => {
            const timeDiffMin = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
            return {
              id: `order:${order.id}`,
              rawId: order.id,
              source: 'order',
              kot_number: order.kot_number,
              table: order.table_name || `Table ${order.table_id}`,
              time: new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              elapsed: timeDiffMin < 0 ? 0 : timeDiffMin,
              status: order.status === 'SENT_TO_KITCHEN' ? 'pending' :
                      order.status === 'PREPARING' ? 'cooking' : 'ready',
              items: order.items.map(item => ({
                name: item.name,
                qty: item.quantity,
                note: item.note || ''
              }))
            };
          });
      }

      // Fetch parcel orders and map to KDS shape
      const parcelsRes = await fetch(`${API_BASE}/parcels?hotelId=${hotelId}`);
      const parcelsData = await parcelsRes.json();
      if (parcelsData.success) {
        const parcelsMapped = parcelsData.data
          .filter(p => ['pending', 'pending_kitchen', 'preparing', 'ready'].includes(p.status))
          .map(parcel => {
            const timeDiffMin = Math.floor((Date.now() - new Date(parcel.created_at).getTime()) / 60000);
            return {
              id: `parcel:${parcel.id}`,
              rawId: parcel.id,
              source: 'parcel',
              kot_number: parcel.parcel_id || `PARCEL-${parcel.id}`,
              table: parcel.customer_name || 'Parcel',
              time: new Date(parcel.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              elapsed: timeDiffMin < 0 ? 0 : timeDiffMin,
              status: ['pending', 'pending_kitchen'].includes(parcel.status) ? 'pending' : (parcel.status === 'preparing' ? 'cooking' : 'ready'),
              items: (parcel.items || []).map(item => ({ name: item.name, qty: item.quantity, note: item.note || '' }))
            };
          });

        // Merge orders and parcels
        const merged = [...kdsMapped, ...parcelsMapped];
        merged.sort((a, b) => a.elapsed - b.elapsed);
        setOrders(merged);
      } else {
        setOrders(kdsMapped);
      }

      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('KDS sync error:', err);
    } finally {
      setLoading(false);
      if (showSyncIndicator) setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncKitchenOrders();
    
    // Poll for new tickets every 2000ms
    const timer = setInterval(() => {
      syncKitchenOrders(true);
    }, 2000);

    return () => clearInterval(timer);
  }, [hotelId]);

  // Update KOT elapsed cooking times locally every 30 seconds
  useEffect(() => {
    const elapsedTimer = setInterval(() => {
      setOrders(prev => prev.map(o => ({ ...o, elapsed: o.elapsed + 1 })));
    }, 30000);
    return () => clearInterval(elapsedTimer);
  }, []);

  // Update KOT workflow state in PostgreSQL database or parcel status
  const updateStatus = async (id, visualStatus) => {
    const isParcel = String(id).startsWith('parcel:');
    const rawId = String(id).includes(':') ? String(id).split(':')[1] : id;

    const orderBackendStatus = visualStatus === 'cooking' ? 'PREPARING' :
                                visualStatus === 'ready' ? 'READY' : 'SERVED';
    const parcelBackendStatus = visualStatus === 'cooking' ? 'preparing' :
                                visualStatus === 'ready' ? 'ready' : 'completed';

    // Optimistic UI updates
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: visualStatus } : o));

    try {
      if (isParcel) {
        const res = await fetch(`${API_BASE}/parcels/${rawId}?hotelId=${hotelId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: parcelBackendStatus, hotelId: parseInt(hotelId) })
        });
        const data = await res.json();
        if (data.success) syncKitchenOrders();
      } else {
        const res = await fetch(`${API_BASE}/orders/${rawId}/status?hotelId=${hotelId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: orderBackendStatus, hotelId: parseInt(hotelId) })
        });
        const data = await res.json();
        if (data.success) syncKitchenOrders();
      }
    } catch (err) {
      console.error('Failed to sync cooking status:', err);
    }
  };

  const stats = {
    pending: orders.filter(o => o.status === 'pending').length,
    cooking: orders.filter(o => o.status === 'cooking').length,
    ready: orders.filter(o => o.status === 'ready').length,
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 font-sans">
      
      {/* KDS Header */}
      <header className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#ff6b00] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <ChefHat className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">Kitchen Display System</h1>
            <p className="text-[#ff6b00] text-xs font-bold tracking-widest uppercase mt-1">Mejwani Real-time KDS</p>
          </div>
        </div>

        {/* Sync Indicator */}
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-bold text-white/40 flex items-center gap-2">
            <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
            <span>Sync: {lastSyncTime}</span>
          </div>

          <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4">
            <div className="text-center">
              <p className="text-[10px] font-black text-white/20 uppercase mb-0.5">Pending</p>
              <p className="text-xl font-black text-white">{stats.pending}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] font-black text-white/20 uppercase mb-0.5">Cooking</p>
              <p className="text-xl font-black text-[#ff6b00]">{stats.cooking}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] font-black text-white/20 uppercase mb-0.5">Ready</p>
              <p className="text-xl font-black text-emerald-500">{stats.ready}</p>
            </div>
          </div>
          <button onClick={() => syncKitchenOrders(true)} className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
            <Printer className="w-6 h-6 text-white/60" />
          </button>
        </div>
      </header>

      {/* Tickets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {orders.map((order) => (
          <div 
            key={order.id} 
            className={cn(
              "flex flex-col bg-[#0d0d0d] border rounded-[2rem] overflow-hidden transition-all duration-500",
              order.status === 'cooking' ? "border-[#ff6b00]/50 shadow-2xl shadow-orange-500/10" : 
              order.status === 'ready' ? "border-emerald-500/30" : "border-white/5"
            )}
          >
            {/* Ticket Header */}
            <div className={cn(
              "p-5 flex items-center justify-between",
              order.status === 'cooking' ? "bg-[#ff6b00]/10" : 
              order.status === 'ready' ? "bg-emerald-500/10" : "bg-white/2"
            )}>
              <div>
                <h2 className="text-2xl font-black text-white leading-none">{order.table}</h2>
                <p className="text-[10px] font-black text-white/40 mt-1 uppercase tracking-wider">{order.kot_number}</p>
              </div>
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black",
                order.elapsed > 10 ? "bg-red-500 text-white animate-pulse" : 
                order.elapsed > 5 ? "bg-amber-500 text-black" : "bg-white/5 text-white/60"
              )}>
                <Timer className="w-3.5 h-3.5" />
                {order.elapsed}m
              </div>
            </div>

            {/* Ticket Items */}
            <div className="flex-1 p-6 space-y-4">
              {order.items.map((item, idx) => (
                <div key={idx} className="group cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-sm font-black text-[#ff6b00]">
                      {item.qty}
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-bold text-white/90 leading-tight group-hover:text-white transition-colors">{item.name}</p>
                      {item.note && (
                        <p className="text-xs font-bold text-amber-500/80 mt-1 flex items-center gap-1 italic">
                          <AlertCircle className="w-3 h-3" /> {item.note}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Ticket Actions */}
            <div className="p-4 bg-white/2 border-t border-white/5 flex gap-2">
              {order.status === 'pending' && (
                <button 
                  onClick={() => updateStatus(order.id, 'cooking')}
                  className="w-full py-4 bg-[#ff6b00] text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#e05e00] transition-all shadow-lg shadow-orange-500/20"
                >
                  <Flame className="w-4 h-4" />
                  Start Cooking
                </button>
              )}
              {order.status === 'cooking' && (
                <button 
                  onClick={() => updateStatus(order.id, 'ready')}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark Ready
                </button>
              )}
              {order.status === 'ready' && (
                <button 
                  onClick={() => updateStatus(order.id, 'clear')}
                  className="w-full py-4 bg-white/5 text-white/40 rounded-2xl font-black text-sm uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all"
                >
                  Clear Ticket
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Empty Ticket Slot */}
        <div className="border-2 border-dashed border-white/5 rounded-[2rem] flex flex-col items-center justify-center p-8 opacity-20 group hover:opacity-40 transition-opacity min-h-[260px]">
          <ChefHat className="w-12 h-12 mb-4" />
          <p className="text-sm font-black uppercase tracking-widest text-center">Waiting for<br />New Orders...</p>
        </div>
      </div>
    </div>
  );
}
