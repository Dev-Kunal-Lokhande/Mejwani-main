import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRightLeft, Check, AlertCircle } from 'lucide-react';

export default function ShiftTableModal({
  isOpen,
  onClose,
  sourceTable,
  tables = [],
  onConfirm
}) {
  const [selectedTable, setSelectedTable] = useState(null);

  if (!isOpen || !sourceTable) return null;

  // Filter for vacant/available tables only (and exclude the source table just in case)
  const vacantTables = tables.filter(
    (t) => t.status === 'available' && t.id !== sourceTable.id
  );

  // Group vacant tables by section/zone
  const groupedTables = vacantTables.reduce((acc, table) => {
    const section = table.section_name || table.section || 'General';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(table);
    return acc;
  }, {});

  const sortedSections = Object.keys(groupedTables).sort((a, b) => {
    const orderA = groupedTables[a]?.[0]?.section_display_order ?? 999;
    const orderB = groupedTables[b]?.[0]?.section_display_order ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  const handleConfirmClick = () => {
    if (!selectedTable) return;
    onConfirm(selectedTable);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="relative w-full max-w-lg bg-white dark:bg-[#0c0c0c] border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-6 shadow-2xl z-10 max-h-[85vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">
                  Shift Table Order
                </h3>
                <p className="text-xs text-slate-400 dark:text-white/20 font-bold mt-0.5">
                  Transfer live order to a vacant table
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Table summary flow */}
          <div className="my-5 p-4 bg-slate-50 dark:bg-white/2 border border-slate-100 dark:border-white/5 rounded-2xl flex items-center justify-around text-center">
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 dark:text-white/20 tracking-wider">
                Source Table
              </span>
              <p className="text-lg font-black text-rose-500 mt-0.5">
                Table {sourceTable.number || sourceTable.table_number}
              </p>
              <span className="text-2xs font-bold text-slate-400">
                {sourceTable.section_name || sourceTable.section || 'General'}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-white/40">
              <ArrowRightLeft className="w-4 h-4 animate-pulse" />
            </div>

            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 dark:text-white/20 tracking-wider">
                Target Table
              </span>
              <p className={`text-lg font-black mt-0.5 ${selectedTable ? 'text-emerald-500' : 'text-slate-400'}`}>
                {selectedTable ? `Table ${selectedTable.number || selectedTable.table_number}` : 'Select...'}
              </p>
              <span className="text-2xs font-bold text-slate-400">
                {selectedTable ? (selectedTable.section_name || selectedTable.section || 'General') : '---'}
              </span>
            </div>
          </div>

          {/* Available tables scrollable body */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-5 my-2 scrollbar-none">
            {vacantTables.length === 0 ? (
              <div className="py-12 text-center opacity-50 flex flex-col items-center">
                <AlertCircle className="w-10 h-10 text-slate-400 mb-2" />
                <p className="text-sm font-black uppercase tracking-wider text-slate-500">
                  No Vacant Tables
                </p>
                <p className="text-xs text-slate-400 mt-1 font-semibold max-w-xs">
                  All other dining tables in the restaurant are currently occupied.
                </p>
              </div>
            ) : (
              sortedSections.map((section) => (
                <div key={section} className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 dark:text-white/30 tracking-widest pl-1">
                    {section}
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {groupedTables[section].map((table) => {
                      const isSelected = selectedTable?.id === table.id;
                      return (
                        <button
                          key={table.id}
                          onClick={() => setSelectedTable(table)}
                          className={`relative py-3.5 px-4 rounded-xl border-2 transition-all font-black text-sm flex flex-col items-center justify-center gap-1 ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-500/5 text-emerald-500 shadow-md shadow-emerald-500/5 scale-[1.02]'
                              : 'border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10 text-slate-700 dark:text-white/60 bg-slate-50/50 dark:bg-white/1'
                          }`}
                        >
                          <span className="text-[9px] font-bold text-slate-400 block -mb-0.5">Table</span>
                          <span className="text-base font-black leading-none">{table.number || table.table_number}</span>
                          <span className="text-[9px] font-semibold text-slate-400 block mt-0.5">{table.capacity} Pax</span>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex gap-3 mt-4">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-white/70 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmClick}
              disabled={!selectedTable}
              className="flex-1 py-3.5 bg-gradient-to-r from-orange-500 to-[#ff6b00] hover:from-orange-600 hover:to-[#e05e00] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/10"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Confirm Shift
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
