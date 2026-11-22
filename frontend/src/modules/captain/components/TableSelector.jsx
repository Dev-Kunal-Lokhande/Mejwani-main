import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Clock, ShoppingBag, Check, CheckCircle2, AlertTriangle, Table } from 'lucide-react';
import DiningTimer from '../../../shared/components/DiningTimer';

function WaitingTimer({ createdAt }) {
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    const update = () => {
      const offset = (typeof window !== 'undefined' ? window.mejwani_server_time_offset : 0) || 0;
      const diffMs = (Date.now() + offset) - new Date(createdAt).getTime();
      const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
      const mins = Math.floor(diffSecs / 60);
      const secs = diffSecs % 60;
      setElapsed(`${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return <span className="font-mono font-black">{elapsed}</span>;
}

export default function TableSelector({ tables, activeSection, onSelectTable, activeTable, captainRequests = [], onRejectRequest }) {
  // Normalize both sides for a safe match: DB section_name vs enriched section.name
  const filteredTables = tables.filter(t => {
    const match = t.section === activeSection;
    // Case-insensitive fallback in case there's a subtle casing mismatch
    const matchCI = (t.section || '').trim().toUpperCase() === (activeSection || '').trim().toUpperCase();
    if (!match && matchCI) {
      console.warn(`[TableSelector] Case mismatch: table.section="${t.section}" vs activeSection="${activeSection}"`);
    }
    return match || matchCI;
  });

  console.debug('[TableSelector] activeSection:', activeSection,
    '| all table sections:', tables.map(t => t.section),
    '| filteredTables:', filteredTables.length);

  const stats = {
    total: filteredTables.length,
    available: filteredTables.filter(t => t.status === 'available').length,
    occupied: filteredTables.filter(t => t.status === 'occupied').length,
    reserved: filteredTables.filter(t => t.status === 'reserved').length,
    billPending: filteredTables.filter(t => t.status === 'bill_pending').length,
    customerPresent: filteredTables.filter(t => t.status === 'customer_present').length,
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'border-emerald-500/20 hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#0d0d0d]';
      case 'occupied':
        return 'border-rose-500/20 hover:border-rose-500/40 text-rose-600 dark:text-rose-400 bg-white dark:bg-[#0d0d0d]';
      case 'bill_pending':
        return 'border-amber-500/20 hover:border-amber-500/40 text-amber-600 dark:text-amber-400 bg-white dark:bg-[#0d0d0d]';
      case 'reserved':
        return 'border-amber-500/20 hover:border-amber-500/40 text-amber-600 dark:text-amber-400 bg-white dark:bg-[#0d0d0d]';
      case 'customer_present':
        return 'border-orange-500/30 hover:border-orange-500/50 text-orange-600 dark:text-orange-400 bg-white dark:bg-[#0d0d0d] shadow-lg shadow-orange-500/5';
      default:
        return 'border-slate-100 dark:border-white/5 text-slate-500 bg-white dark:bg-[#0d0d0d]';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Header and Stats */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2 sm:gap-3">
            <Table className="w-5 h-5 sm:w-7 sm:h-7 text-primary" /> Select Table
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 dark:text-white/20 font-bold mt-1">
            Zone: <span className="text-primary font-black">{activeSection}</span>
          </p>
        </div>

        {/* Status Count Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto font-black text-[10px] sm:text-xs uppercase tracking-wider">
          <div className="px-2 sm:px-3.5 py-2 sm:py-2.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/10 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 text-center h-14 sm:h-auto min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">{stats.available} Vacant</span>
          </div>
          <div className="px-2 sm:px-3.5 py-2 sm:py-2.5 bg-orange-500/10 text-orange-500 border border-orange-500/10 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 text-center h-14 sm:h-auto min-w-0 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
            <span className="truncate">{stats.customerPresent} Arrived</span>
          </div>
          <div className="px-2 sm:px-3.5 py-2 sm:py-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/10 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 text-center h-14 sm:h-auto min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span className="truncate">{stats.occupied} Occupied</span>
          </div>
          <div className="px-2 sm:px-3.5 py-2 sm:py-2.5 bg-amber-500/10 text-amber-500 border border-amber-500/10 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 text-center h-14 sm:h-auto min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="truncate">{stats.billPending + stats.reserved} Active</span>
          </div>
        </div>
      </div>

      {/* Grid of Tables */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-6">
        {filteredTables.map((table, index) => {
          const isSelected = activeTable?.id === table.id;
          const statusStyle = getStatusColor(table.status);
          const activeRequest = (captainRequests || []).find(r => r.table_id === table.id || r.table === table.number);

          return (
            <motion.div
              key={table.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.02, type: 'spring', stiffness: 120 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectTable(table)}
              className={`relative cursor-pointer p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border-2 transition-all duration-300 min-h-[140px] sm:min-h-[180px] flex flex-col justify-between ${statusStyle} ${
                isSelected
                  ? 'ring-2 ring-primary border-primary bg-primary/[0.02] scale-[1.02] shadow-lg sm:shadow-xl shadow-orange-500/10'
                  : 'shadow-sm hover:shadow-md'
              }`}
            >
              {/* Card Ring Highlight for Selected */}
              {isSelected && (
                <div className="absolute right-2.5 top-2.5 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-md z-10">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}

              {/* Table Number */}
              <div className="text-center py-1 sm:py-2">
                <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 dark:text-white/20 tracking-widest block mb-0.5 sm:mb-1">
                  Table
                </span>
                <span className="text-3xl sm:text-5xl font-black block tracking-tight text-slate-800 dark:text-white leading-none">
                  {table.number}
                </span>
              </div>

              {/* Separator */}
              <div className="my-2 sm:my-3 border-t border-dashed border-slate-200 dark:border-white/5" />

              {/* Table Info */}
              <div className="space-y-1.5 sm:space-y-2">
                {/* Seating Capacity */}
                <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-black uppercase text-slate-500 dark:text-white/45">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                  <span>{table.capacity} Pax</span>
                </div>

                {/* Dining Duration Timer */}
                {(table.occupied_at) && (
                  <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-black uppercase text-slate-500 dark:text-white/45">
                    <DiningTimer
                      occupiedAt={table.occupied_at}
                      isBillPending={table.status === 'bill_pending'}
                    />
                  </div>
                )}

                {/* Status displays */}
                <div className="flex items-center justify-center pt-1 sm:pt-2">
                  {table.status === 'occupied' && table.currentOrder ? (
                    <span className="text-[10px] sm:text-xs font-black uppercase text-rose-500 flex items-center justify-center gap-1 sm:gap-1.5 bg-rose-500/5 px-2 py-1 rounded-lg border border-rose-500/10 w-full min-h-[26px]">
                      <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> <span className="truncate">₹{parseFloat(table.currentOrder.total).toFixed(0)}</span>
                    </span>
                  ) : table.status === 'bill_pending' ? (
                    <span className="text-[10px] sm:text-xs font-black uppercase text-amber-500 animate-pulse flex items-center justify-center gap-1 sm:gap-1.5 bg-amber-500/5 px-2 py-1 rounded-lg border border-amber-500/10 w-full min-h-[26px]">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin shrink-0" /> <span className="truncate">Bill</span>
                    </span>
                  ) : table.status === 'reserved' ? (
                    <span className="text-[10px] sm:text-xs font-black uppercase text-amber-500 flex items-center justify-center gap-1 sm:gap-1.5 bg-amber-500/5 px-2 py-1 rounded-lg border border-amber-500/10 w-full min-h-[26px]">
                      <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> <span className="truncate">Booked</span>
                    </span>
                  ) : table.status === 'customer_present' ? (
                    <div className="flex flex-col gap-1.5 w-full">
                      <span className="text-[10px] sm:text-xs font-black uppercase text-orange-500 animate-pulse flex items-center justify-center gap-1 sm:gap-1.5 bg-orange-500/5 px-2 py-1 rounded-lg border border-orange-500/20 w-full min-h-[26px]">
                        <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 animate-bounce text-orange-500" /> 
                        <span className="truncate">
                          CUSTOMER REQUEST {activeRequest && <>(<WaitingTimer createdAt={activeRequest.created_at || activeRequest.createdAt} />)</>}
                        </span>
                      </span>
                      {onRejectRequest && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRejectRequest(table);
                          }}
                          className="mt-1 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-sm hover:shadow transition-all duration-200 cursor-pointer w-full text-center"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] sm:text-xs font-black uppercase text-emerald-500 flex items-center justify-center gap-1 sm:gap-1.5 bg-emerald-500/5 px-2 py-1 rounded-lg border border-emerald-500/10 w-full min-h-[26px]">
                      <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> <span className="truncate">Vacant</span>
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
