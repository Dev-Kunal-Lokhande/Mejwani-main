import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Printer, 
  CheckCircle, 
  X, 
  ChefHat, 
  Clock, 
  Table, 
  User, 
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../../../shared/services/apiBase';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../../utils/dateFormatter';
import { getCachedSystemSettings } from '../../../shared/services/systemSettings';

export default function KOTModal({
  isOpen,
  onClose,
  cart,
  activeTable,
  activeSection,
  orderNumber,
  captainName,
  activeTime
}) {
  if (!isOpen) return null;

  const handleBrowserPrint = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      toast.error("Please allow popups to print KOT slips!");
      return;
    }

    const dateStr = formatDateDDMMYYYY(new Date());
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    let itemsHtml = '';
    cart.forEach(item => {
      itemsHtml += `
        <tr>
          <td style="width: 75%; text-align: left; font-weight: bold; font-size: 12px; padding: 4px 0; word-wrap: break-word; vertical-align: top;">${item.name.toUpperCase()}</td>
          <td style="width: 25%; text-align: right; font-size: 14px; font-weight: 900; padding: 4px 0; vertical-align: top; padding-right: 5px;">${item.quantity}</td>
        </tr>
      `;
    });

    printWindow.document.write(`
<html>
<head>
  <title>KOT - Table ${activeTable ? (activeTable.table_code || activeTable.table_name) : ''}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    html, body {
      width: 80mm;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.4;
    }
    .receipt {
      padding: 4mm 4mm 8mm 4mm;
      box-sizing: border-box;
    }
    .center {
      text-align: center;
    }
    .bold {
      font-weight: bold;
    }
    .title {
      font-size: 16px;
      font-weight: 900;
      margin: 0 0 2px 0;
      letter-spacing: 1px;
    }
    .subtitle {
      font-size: 10px;
      margin: 0 0 2px 0;
      font-weight: bold;
    }
    .divider {
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
  </style>
</head>
<body onload="setTimeout(function(){ window.print(); window.close(); }, 300);">
  <div class="receipt">
    <!-- HEADER -->
    <div class="center">
      <div class="title" style="font-size: 18px;">${getCachedSystemSettings()?.printing?.kotTitle || 'KITCHEN ORDER TICKET'}</div>
    </div>
    
    <div class="divider"></div>

    <!-- META DETAILS -->
    <table style="width: 100%; font-size: 10px; font-weight: bold; margin-bottom: 2px; border-collapse: collapse;">
      <tr>
        <td style="text-align: left; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">Table: ${activeTable ? (activeTable.table_code || activeTable.table_name) : ''} (${activeSection || ''})</td>
        <td style="text-align: right; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">Capt: ${captainName || 'Captain'}</td>
      </tr>
      <tr>
        <td style="text-align: left; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">Date: ${dateStr}</td>
        <td style="text-align: right; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">Time: ${timeStr}</td>
      </tr>
      <tr>
        <td colspan="2" style="text-align: left; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">KOT: ${orderNumber || 'New Order'}</td>
      </tr>
    </table>

    <div class="divider"></div>

    <!-- ITEMS TABLE -->
    <table style="width: 100%; border-collapse: collapse; margin-top: 5px; table-layout: fixed;">
      <thead>
        <tr style="border-bottom: 1px dashed #000000;">
          <th style="width: 75%; text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; padding-bottom: 3px; font-family: 'Courier New', Courier, monospace;">Item Description</th>
          <th style="width: 25%; text-align: right; font-size: 10px; font-weight: 900; text-transform: uppercase; padding-bottom: 3px; font-family: 'Courier New', Courier, monospace; padding-right: 5px;">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    
    <div class="divider"></div>

    <!-- FOOTER -->

    <!-- FEED SPACING FOR AUTO-CUT -->
    <div style="height: 35px; clear: both;"></div>
    <div class="center" style="font-size: 8px; color: #888888; font-family: 'Courier New', Courier, monospace;">- End of Ticket -</div>
    <div style="height: 10px; clear: both;"></div>
  </div>
</body>
</html>
    `);

    printWindow.document.close();
  };

  const handlePrint = async () => {
    const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
    const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
    const tableName = activeTable ? (activeTable.table_code || activeTable.table_name) : 'COUNTER';

    const systemSettings = getCachedSystemSettings();
    const kotData = {
      title: systemSettings?.printing?.kotTitle || 'KITCHEN ORDER TICKET',
      hotelName: 'MEJWANI',
      tableName: tableName,
      sectionName: activeSection || '',
      captainName: captainName || 'Captain',
      orderId: orderNumber || 'New Order',
      dateTime: formatDateTimeDDMMYYYY(new Date()),
      items: cart.map(item => ({ name: item.name || item.itemName, quantity: item.quantity || item.qty || 1, note: item.note }))
    };

    window.mejwani_start_ack_timeout = window.mejwani_start_ack_timeout || ((jobId, jobType) => {
      window.mejwani_ack_timers = window.mejwani_ack_timers || {};
      if (window.mejwani_ack_timers[jobId]) {
        clearTimeout(window.mejwani_ack_timers[jobId]);
      }
      window.mejwani_ack_timers[jobId] = setTimeout(() => {
        console.warn(`[WARNING] Socket ACK not received within 5 seconds for ${jobType} jobId: ${jobId}`);
        delete window.mejwani_ack_timers[jobId];
      }, 5000);
    });

    window.mejwani_clear_ack_timeout = window.mejwani_clear_ack_timeout || ((jobId) => {
      window.mejwani_ack_timers = window.mejwani_ack_timers || {};
      if (window.mejwani_ack_timers[jobId]) {
        clearTimeout(window.mejwani_ack_timers[jobId]);
        delete window.mejwani_ack_timers[jobId];
      }
    });

    const onPrintJobAcknowledgedLocal = (jobId, tableName) => {
      console.log(`[DEBUG] onPrintJobAcknowledgedLocal called in KOTModal for jobId: ${jobId}, tableName: ${tableName}.`);
      const jobIdStr = String(jobId);
      window.mejwani_toasted_jobs = window.mejwani_toasted_jobs || new Set();
      if (!window.mejwani_toasted_jobs.has(jobIdStr)) {
        window.mejwani_toasted_jobs.add(jobIdStr);
        toast.success(`✅ KOT printed successfully for ${tableName || 'Table'}.`, {
          id: `kot-success-${jobId}`,
          style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });
      }
    };

    try {
      console.log('[KOT] User clicked Send KOT');
      // 1. Queue job on cloud first to get the unique Job ID (approx 50ms)
      const response = await fetch(`${API_BASE}/orders/print-kot?hotelId=${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kotData)
      });
      const data = await response.json();
      if (!data.success) {
        if (data.code === 'PRINTER_NOT_CONFIGURED' || data.code === 'PRINTER_OFFLINE') {
          toast.error(data.message);
          return;
        }
        throw new Error(data.message || 'Direct print failed');
      }

      const jobId = data.jobId;
      console.log('[DEBUG] Print job created:', jobId);
      console.log(`[KOT] Print Job ID: ${jobId}`);

      if (typeof window.mejwani_start_ack_timeout === 'function') {
        window.mejwani_start_ack_timeout(jobId, 'KOT');
      }

      // 2. Try direct local print next
      let localPrintSuccess = false;
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalHost) {
        try {
          console.log('[DEBUG] Local agent print started:', jobId);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000); // 1000ms timeout
          const localResponse = await fetch('http://127.0.0.1:9111/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: jobId, job_type: 'KOT', payload: kotData }),
            signal: controller.signal
          });
          const localData = await localResponse.json();
          clearTimeout(timeoutId);
          if (localData.success) {
            console.log('[DEBUG] Local print success:', jobId);
            localPrintSuccess = true;
            onPrintJobAcknowledgedLocal(jobId, tableName);
          }
        } catch (localErr) {
          console.log('[DEBUG] Local print failure:', jobId, '. Cloud fallback triggered.', localErr.message);
        }
      } else {
        console.log('[DEBUG] Remote device detected, skipping loopback print agent fetch.');
      }

      if (!localPrintSuccess) {
        console.log('[DEBUG] Cloud fallback triggered for job:', jobId);
        if (isLocalHost) {
          console.log('[KOT] Trigger poll called');
          fetch('http://127.0.0.1:9111/trigger-poll').catch(() => { });
        }
        onPrintJobAcknowledgedLocal(jobId, tableName);
      }

    } catch (err) {
      console.error('Direct print failed, falling back to window print', err);
      toast.error((t) => (
        <div className="flex flex-col gap-2">
          <span className="font-bold text-xs">Direct KOT print failed (Agent offline).</span>
          <button 
            onClick={() => {
              toast.dismiss(t.id);
              handleBrowserPrint();
            }}
            style={{
              background: '#ff6b00',
              color: '#fff',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: 'pointer',
              alignSelf: 'flex-start'
            }}
          >
            Print via Browser
          </button>
        </div>
      ), { duration: 8000 });
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:p-0 print:static print:block print:w-[80mm] print:mx-auto print:bg-white">
        
        {/* Backdrop glass blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-md no-print"
        />

        {/* Modal Sheet */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: 'spring', damping: 20, stiffness: 180 }}
          className="relative w-full max-w-lg bg-white dark:bg-[#0a0a0a] rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:w-full print:border-none print:shadow-none print:rounded-none print:p-0 print:m-0"
        >
          
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-white/2 no-print">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white leading-none">Order Placed Successfully!</h3>
                <span className="text-[10px] font-bold text-emerald-500 uppercase mt-1 block">Sent to Kitchen Display</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Ticket Body Container (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-8 print:p-0 space-y-6">
            
            {/* The KOT Receipt paper style element */}
            <div id="printable-bill" className="thermal-print bg-[#fcfcfa] text-black p-6 border-2 border-dashed border-slate-300 rounded-2xl shadow-inner font-mono relative overflow-hidden">
              
              {/* Jagged thermal receipt top cut simulation */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-200 via-transparent to-slate-200" />

              {/* Receipt Title */}
              <div className="text-center space-y-1 mb-6">
                <ChefHat className="w-8 h-8 mx-auto text-primary" />
                <h2 className="text-lg font-black tracking-tight uppercase">MEJWANI RESTAURANT</h2>
                <p className="text-[10px] font-bold text-slate-400">KITCHEN ORDER TICKET (KOT)</p>
                <div className="border-b border-dashed border-slate-300 my-3" />
              </div>

              {/* KOT Meta Info details */}
              <div className="grid grid-cols-2 gap-y-2 text-[10px] font-bold text-slate-700">
                <div className="flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-slate-400" />
                  <span>TABLE: {activeTable?.number}</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end text-right">
                  <span>ZONE: {activeSection}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>CAPT: {captainName}</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end text-right">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>TIME: {activeTime}</span>
                </div>
                <div className="col-span-2 flex items-center gap-1.5 mt-1 pt-1 border-t border-dashed border-slate-200">
                  <span>TICKET NO:</span>
                  <span className="font-black text-black text-xs">{orderNumber}</span>
                </div>
              </div>

              {/* Separator */}
              <div className="border-b-2 border-dashed border-slate-400 my-4" />

              {/* Items Table Headers */}
              <div className="grid grid-cols-12 text-[10px] font-black uppercase text-slate-500 pb-2 border-b border-slate-200">
                <div className="col-span-2">QTY</div>
                <div className="col-span-10">ITEM DISH</div>
              </div>

              {/* Items List */}
              <div className="divide-y divide-dashed divide-slate-200">
                {cart.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 py-3 text-xs font-bold items-start">
                    <div className="col-span-2 font-black text-sm text-primary">{item.qty} x</div>
                    <div className="col-span-10 space-y-1">
                      <div className="text-black font-black uppercase leading-tight">{item.name}</div>
                      {item.note && (
                        <div className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 flex items-center gap-1 italic">
                          <AlertCircle className="w-2.5 h-2.5" /> Note: {item.note}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Receipt separator */}
              <div className="border-b-2 border-dashed border-slate-400 my-4" />

              {/* Footer messages */}
              <div className="text-center text-[10px] text-slate-400 space-y-1">
                <p className="uppercase tracking-widest font-black text-black">Preparation Started</p>
                <p>Printed on Mejwani POS handheld</p>
              </div>

              {/* Thermal bottom cut wave styling details */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-200 via-transparent to-slate-200" />
            </div>
          </div>

          {/* Action Row */}
          <div className="p-6 border-t border-slate-100 dark:border-white/5 flex gap-4 bg-slate-50 dark:bg-white/2 no-print">
            <button
              onClick={handlePrint}
              className="flex-1 py-4 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all border border-slate-300 dark:border-white/10"
            >
              <Printer className="w-4 h-4" />
              Print KOT
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary/95 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-xl shadow-primary/25"
            >
              Next Order
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
