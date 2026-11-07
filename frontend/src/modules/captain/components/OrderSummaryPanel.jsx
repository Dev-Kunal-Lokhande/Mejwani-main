import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, 
  User, 
  Hash, 
  Clock, 
  Trash2, 
  Plus, 
  Minus, 
  FileText, 
  Save, 
  AlertCircle,
  ChefHat,
  X,
  ArrowRightLeft
} from 'lucide-react';
import { formatCurrencyWithSettings, getCachedSystemSettings } from '../../../shared/services/systemSettings';

export default function OrderSummaryPanel({
  cart,
  activeTable,
  activeSection,
  orderNumber,
  captainName,
  onAddToCart,
  onRemoveFromCart,
  onClearOrder,
  onSaveDraft,
  onConfirmOrder,
  onRequestBill,
  onCancelOrder,
  activeTime,
  activeOrder,
  onShiftTable
}) {
  const settings = getCachedSystemSettings();
  const cgstRate = Number(settings.billing.cgst) || 0;
  const sgstRate = Number(settings.billing.sgst) || 0;
  const serviceChargeRate = Number(settings.billing.serviceCharge) || 0;
  const formatCurrency = (value = 0, decimals = 2) => formatCurrencyWithSettings(value, settings, decimals);
  
  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cgst = subtotal * (cgstRate / 100);
  const sgst = subtotal * (sgstRate / 100);
  const serviceCharge = subtotal * (serviceChargeRate / 100);
  const grandTotal = subtotal + cgst + sgst + serviceCharge;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0d0d0d] border border-slate-100 dark:border-white/5 rounded-[2rem] p-6 shadow-lg relative overflow-hidden">
      
      {/* Panel Top Meta Details */}
      <div className="hidden lg:block space-y-4 mb-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-white leading-none">Running Order</h2>
              <span className="text-xs font-bold text-slate-400 dark:text-white/20 uppercase mt-1 block">Live Calculation</span>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-xs font-black uppercase rounded-lg">
              <Hash className="w-3 h-3" /> {orderNumber}
            </span>
          </div>
        </div>

        {/* Active Dining Position & Captain Details */}
        <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-white/2 p-4 rounded-[1.5rem] border border-slate-100 dark:border-white/5">
          <div className="space-y-0.5">
            <span className="text-[9px] font-black uppercase text-slate-400 dark:text-white/20 tracking-wider">Position</span>
            <p className="text-sm font-black text-slate-800 dark:text-white">
              {activeTable ? `Table ${activeTable.number}` : 'No Table'}
            </p>
            <span className="text-xs font-bold text-slate-400 dark:text-white/30 block truncate">
              {activeSection || 'No Zone'}
            </span>
          </div>

          <div className="space-y-0.5 border-l border-slate-200 dark:border-white/10 pl-3">
            <span className="text-[9px] font-black uppercase text-slate-400 dark:text-white/20 tracking-wider">Captain</span>
            <p className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1 truncate">
              <User className="w-3.5 h-3.5 text-primary" /> {captainName.split(' ')[1] || captainName}
            </p>
            <span className="text-xs font-bold text-slate-400 dark:text-white/30 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" /> {activeTime}
            </span>
          </div>
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-3 scrollbar-none pr-1">
        <AnimatePresence mode="popLayout">
          {cart.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ type: 'spring', stiffness: 150, damping: 18 }}
              className="flex gap-3 justify-between items-center bg-slate-50/50 dark:bg-white/1 border border-slate-100 dark:border-white/3 p-4 rounded-[1.25rem] group hover:border-primary/25 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.type === 'VEG' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className="text-sm font-black text-slate-800 dark:text-white leading-snug truncate">
                    {item.name}
                  </span>
                </div>
                {item.note && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded-md italic mt-1">
                    <FileText className="w-2.5 h-2.5" /> {item.note}
                  </span>
                )}
                <div className="text-xs font-bold text-slate-400 mt-1">
                  {formatCurrency(item.price, 0)} each
                </div>
              </div>

              {/* Adjust Quantity Controls */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center bg-white dark:bg-[#151515] border border-slate-200 dark:border-white/10 rounded-xl p-1">
                  <button
                    onClick={() => onRemoveFromCart(item.id)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-white/60 transition-all active:scale-90"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2.5 text-sm font-black min-w-6 text-center select-none text-slate-800 dark:text-white">
                    {item.qty}
                  </span>
                  <button
                    onClick={() => onAddToCart(item)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-white/60 transition-all active:scale-90"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <span className="text-sm font-black text-slate-800 dark:text-white min-w-12 text-right">
                  {formatCurrency(item.price * item.qty, 0)}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {cart.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-16">
            <ShoppingBag className="w-10 h-10 text-slate-400 mb-3 animate-bounce duration-1000" />
            <p className="text-sm font-black uppercase tracking-wider text-slate-500">Order is empty</p>
            <p className="text-xs text-slate-400 dark:text-white/20 mt-1.5 font-semibold max-w-xs">Select dishes from the menu to build the ticket.</p>
          </div>
        )}
      </div>

      {/* Bill Breakdowns and Actions Dock */}
      <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/5 space-y-4 bg-white dark:bg-[#0d0d0d] z-10">
        
        {/* Cost Summary Box */}
        <div className="space-y-2 text-xs sm:text-sm font-bold text-slate-500 dark:text-white/40">
          <div className="flex justify-between items-center">
            <span>Subtotal</span>
            <span className="font-black text-slate-700 dark:text-white/80">{formatCurrency(subtotal)}</span>
          </div>
          {cgstRate > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span>CGST ({cgstRate}%)</span>
              <span>{formatCurrency(cgst)}</span>
            </div>
          )}
          {sgstRate > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span>SGST ({sgstRate}%)</span>
              <span>{formatCurrency(sgst)}</span>
            </div>
          )}
          {serviceCharge > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span>Service Charge ({serviceChargeRate}%)</span>
              <span>{formatCurrency(serviceCharge)}</span>
            </div>
          )}
          
          <div className="my-2 border-t border-dashed border-slate-100 dark:border-white/5" />
          
          <div className="flex justify-between items-center text-sm sm:text-base">
            <span className="font-black text-slate-800 dark:text-white uppercase tracking-wider">Grand Total</span>
            <span className="text-2xl font-black text-[#ff6b00]">{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* Buttons dock */}
        <div className="space-y-3 pt-1">
          <div className="flex gap-2 lg:flex-col lg:space-y-3">
            
            {/* Action buttons: Send to KOT & Save */}
            <div className="flex gap-2 w-full">
              <button
                disabled={cart.length === 0 || !activeTable}
                onClick={() => onConfirmOrder({ silent: false })}
                className="flex-1 h-11 lg:py-3.5 bg-gradient-to-r from-orange-500 to-[#ff6b00] hover:from-orange-600 hover:to-[#e05e00] text-white rounded-xl font-black text-[11px] lg:text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] transition-all shadow-md shadow-orange-500/15 cursor-pointer animate-pulse"
              >
                <ChefHat className="w-4 h-4" />
                <span>SEND TO KOT</span>
              </button>

              <button
                disabled={cart.length === 0 || !activeTable}
                onClick={() => onConfirmOrder({ silent: true })}
                className="flex-1 h-11 lg:py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white rounded-xl font-black text-[11px] lg:text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer border border-slate-200 dark:border-white/10"
              >
                <Save className="w-4 h-4" />
                <span>SAVE</span>
              </button>
            </div>


            {/* Secondary billing notification button when occupied */}
            {activeTable && (activeTable.status === 'occupied' || activeTable.status === 'bill_pending') && (
              <>
                <button
                  onClick={onRequestBill}
                  disabled={activeTable.status === 'bill_pending'}
                  className="flex-1 lg:w-full h-11 lg:h-auto lg:py-3.5 bg-amber-500 text-white rounded-xl lg:rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-600 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-sm shadow-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Clock className="w-5 h-5 animate-pulse" />
                  <span className="hidden lg:inline">{activeTable.status === 'bill_pending' ? 'BILL REQUESTED' : 'REQUEST FINAL BILL'}</span>
                </button>

                <button
                  onClick={onShiftTable}
                  className="flex-1 lg:w-full h-11 lg:h-auto lg:py-3.5 bg-slate-800 text-white dark:bg-white dark:text-black rounded-xl lg:rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-700 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-sm shadow-slate-900/20"
                >
                  <ArrowRightLeft className="w-5 h-5" />
                  <span className="hidden lg:inline">SHIFT TABLE</span>
                </button>
              </>
            )}

            {/* Secondary Actions */}
            <button
              disabled={cart.length === 0}
              onClick={onClearOrder}
              className="flex-1 lg:w-full h-11 lg:h-auto lg:py-3 bg-slate-50 hover:bg-rose-600 hover:text-white dark:bg-white/3 dark:hover:bg-rose-950/10 text-slate-600 dark:text-white/60 border border-slate-200 dark:border-white/10 hover:border-rose-500/20 rounded-xl lg:rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-5 h-5" />
              <span className="hidden lg:inline">Delete</span>
            </button>

          </div>

          {/* Alert Tip */}
          {!activeTable && cart.length > 0 && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-bold text-amber-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Please select a Table before sending order.
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
