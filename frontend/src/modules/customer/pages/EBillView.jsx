import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, CheckCircle2, Receipt } from 'lucide-react';

export default function EBillView() {
  const [searchParams] = useSearchParams();

  const bill = useMemo(() => {
    try {
      const encoded = searchParams.get('data');
      if (!encoded) return null;
      const jsonStr = decodeURIComponent(escape(window.atob(encoded)));
      return JSON.parse(jsonStr);
    } catch (err) {
      console.error('Failed to decode E-Bill data:', err);
      return null;
    }
  }, [searchParams]);

  const handlePrintEBill = () => {
    if (!bill) return;
    const printWindow = window.open('', '_blank', 'width=400,height=650');
    if (!printWindow) {
      window.print();
      return;
    }

    const itemsRows = (bill.items || [])
      .map(
        (item) => `
        <tr>
          <td style="padding: 4px 0; text-align: left;">${item.name}</td>
          <td style="padding: 4px 0; text-align: center;">${item.quantity}</td>
          <td style="padding: 4px 0; text-align: right;">${Number(item.price).toFixed(2)}</td>
          <td style="padding: 4px 0; text-align: right;">${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>E-Bill - ${bill.invoiceId}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              width: 300px;
              margin: 0 auto;
              padding: 15px;
              color: #000;
              font-size: 12px;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { border-bottom: 1px dashed #000; padding-bottom: 4px; }
            .totals td { padding: 3px 0; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 16px;">${bill.hotelName || 'MEJWANI'}</div>
          ${bill.address ? `<div class="center" style="font-size: 11px;">${bill.address}</div>` : ''}
          ${bill.phone ? `<div class="center" style="font-size: 11px;">Ph: ${bill.phone}</div>` : ''}
          ${bill.gstNumber ? `<div class="center" style="font-size: 11px;">GSTIN: ${bill.gstNumber}</div>` : ''}
          
          <div class="divider"></div>
          <div><strong>Invoice:</strong> ${bill.invoiceId}</div>
          <div><strong>Table:</strong> ${bill.tableName}</div>
          <div><strong>Date:</strong> ${bill.dateTime}</div>
          <div><strong>Payment:</strong> ${bill.paymentMode || 'CASH'} (PAID)</div>
          <div class="divider"></div>

          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Rate</th>
                <th style="text-align: right;">Amt</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="divider"></div>
          <table class="totals">
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right;">₹${Number(bill.subtotal || 0).toFixed(2)}</td>
            </tr>
            ${Number(bill.cgst) > 0 ? `<tr><td>CGST:</td><td style="text-align: right;">₹${Number(bill.cgst).toFixed(2)}</td></tr>` : ''}
            ${Number(bill.sgst) > 0 ? `<tr><td>SGST:</td><td style="text-align: right;">₹${Number(bill.sgst).toFixed(2)}</td></tr>` : ''}
            ${Number(bill.serviceCharge) > 0 ? `<tr><td>Service Charge:</td><td style="text-align: right;">₹${Number(bill.serviceCharge).toFixed(2)}</td></tr>` : ''}
            <tr class="bold" style="font-size: 14px; border-top: 1px dashed #000;">
              <td style="padding-top: 6px;">GRAND TOTAL:</td>
              <td style="padding-top: 6px; text-align: right;">₹${Number(bill.grandTotal || 0).toFixed(2)}</td>
            </tr>
          </table>

          <div class="divider"></div>
          <div class="center" style="margin-top: 10px;">Thank You! Visit Again!</div>

          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!bill) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4 text-center">
        <Receipt className="w-12 h-12 text-slate-400 mb-3" />
        <h2 className="text-lg font-black text-slate-800">Invalid or Expired E-Bill Link</h2>
        <p className="text-xs text-slate-500 mt-1">Please ask the restaurant counter to resend your digital receipt.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 flex justify-center items-start">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
        {/* Green Paid Header */}
        <div className="bg-emerald-600 text-white p-6 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-95" />
          <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
            Paid · {bill.paymentMode || 'CASH'}
          </span>
          <h2 className="text-2xl font-black mt-2 tracking-tight">{bill.hotelName || 'MEJWANI'}</h2>
          {bill.address && <p className="text-xs opacity-90 mt-1">{bill.address}</p>}
          {bill.phone && <p className="text-[11px] opacity-85 mt-0.5">Ph: {bill.phone}</p>}
          {bill.gstNumber && <p className="text-[10px] font-mono opacity-80 mt-0.5">GSTIN: {bill.gstNumber}</p>}
        </div>

        {/* Receipt Details */}
        <div className="p-6 space-y-4 text-xs">
          <div className="flex justify-between border-b border-dashed border-slate-200 pb-3 text-slate-500 font-bold">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Invoice</span>
              <span className="text-slate-900 font-black">{bill.invoiceId}</span>
            </div>
            <div className="text-center">
              <span className="text-[10px] text-slate-400 block uppercase">Table</span>
              <span className="text-slate-900 font-black">{bill.tableName}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase">Date & Time</span>
              <span className="text-slate-900 font-black">{bill.dateTime}</span>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2.5">
            <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 pb-1.5">
              <span>Item</span>
              <span>Amount</span>
            </div>
            {(bill.items || []).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center font-bold text-slate-700">
                <div>
                  <span>{item.name}</span>
                  <span className="text-slate-400 text-[11px] ml-1.5">x{item.quantity}</span>
                </div>
                <span>₹{(Number(item.price) * Number(item.quantity)).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-dashed border-slate-200 pt-3 space-y-1.5 font-bold text-slate-500">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>₹{Number(bill.subtotal || 0).toFixed(2)}</span>
            </div>
            {Number(bill.cgst) > 0 && (
              <div className="flex justify-between">
                <span>CGST</span>
                <span>₹{Number(bill.cgst).toFixed(2)}</span>
              </div>
            )}
            {Number(bill.sgst) > 0 && (
              <div className="flex justify-between">
                <span>SGST</span>
                <span>₹{Number(bill.sgst).toFixed(2)}</span>
              </div>
            )}
            {Number(bill.serviceCharge) > 0 && (
              <div className="flex justify-between">
                <span>Service Charge</span>
                <span>₹{Number(bill.serviceCharge).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
              <span>Grand Total</span>
              <span className="text-orange-600">₹{Number(bill.grandTotal || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Print / Save PDF Button */}
          <button
            type="button"
            onClick={handlePrintEBill}
            className="w-full mt-4 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg"
          >
            <Printer className="w-4 h-4" /> Download / Print PDF
          </button>

          <p className="text-center text-[11px] text-slate-400 font-semibold pt-2">
            Thank you for dining with us! Visit again!
          </p>
        </div>
      </div>
    </div>
  );
}