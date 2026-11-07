import { useState, useEffect, useCallback } from 'react';
import { 
  Printer, 
  Search, 
  Receipt, 
  Clock, 
  User, 
  Check, 
  X, 
  RefreshCw, 
  AlertCircle,
  Eye,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_BASE } from '../../../shared/services/apiBase';
import { getCachedSystemSettings } from '../../../shared/services/systemSettings';
import socket from '../../../shared/services/socketClient';
import AdminLayout from '../../../shared/layouts/AdminLayout';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../../utils/dateFormatter';

export default function IssuedBills() {
  const [issuedBills, setIssuedBills] = useState([]);
  const [reprintRequests, setReprintRequests] = useState([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBill, setSelectedBill] = useState(null);

  const systemSettings = getCachedSystemSettings();
  const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
  const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '1';

  // Fetch all orders/bills
  const fetchIssuedBills = useCallback(async () => {
    try {
      setLoadingBills(true);
      const res = await axios.get(`${API_BASE}/orders?hotelId=${hotelId}`);
      if (res.data?.success) {
        // Filter completed bills and cancelled completed bills (deleted)
        const bills = (res.data.data || []).filter(o => o.status === 'COMPLETED' || (o.status === 'CANCELLED' && o.completed_at));
        setIssuedBills(bills);
      }
    } catch (err) {
      console.error('Failed to fetch issued bills:', err);
      toast.error('Failed to load issued bills.');
    } finally {
      setLoadingBills(false);
    }
  }, [hotelId]);

  // Fetch reprint requests
  const fetchReprintRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      const res = await axios.get(`${API_BASE}/bills/reprint-requests?hotelId=${hotelId}`);
      if (res.data?.success) {
        // Filter only pending requests
        const pending = (res.data.data || []).filter(r => r.status === 'PENDING');
        setReprintRequests(pending);
      }
    } catch (err) {
      console.error('Failed to fetch reprint requests:', err);
      toast.error('Failed to load reprint requests.');
    } finally {
      setLoadingRequests(false);
    }
  }, [hotelId]);

  // Handle reprint (sends printed command to printer and resolves request if applicable)
  const handleReprintBill = async (order, requestResolveId = null) => {
    const dateStr = formatDateDDMMYYYY(new Date());
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const subtotalValue = Number(order.subtotal) || 0;
    const cgstValue = Number(order.cgst) || 0;
    const sgstValue = Number(order.sgst) || 0;
    const grandTotalValue = Number(order.grand_total) || 0;
    const serviceChargeValue = Math.max(0, grandTotalValue - subtotalValue - cgstValue - sgstValue);

    const billData = {
      hotelName: systemSettings.branding?.name || 'MEJWANI',
      address: systemSettings.branding?.address || '',
      phone: systemSettings.branding?.phone || '',
      gstNumber: systemSettings.billing?.gstNumber || '',
      tableNumber: order.table_name || `Table ${order.table_id}`,
      cashierName: "Counter",
      captainName: order.captain_name || 'ADMIN',
      orderId: `ORD-${order.id}`,
      dateTime: `${dateStr} ${timeStr}`,
      items: order.items || [],
      subtotal: subtotalValue,
      cgst: cgstValue,
      sgst: sgstValue,
      serviceCharge: serviceChargeValue,
      grandTotal: grandTotalValue,
      cgstRate: Number(systemSettings.billing?.cgst) || 0,
      sgstRate: Number(systemSettings.billing?.sgst) || 0,
      serviceChargeRate: Number(systemSettings.billing?.serviceCharge) || 0,
      currencySymbol: systemSettings.billing?.currencySymbol || 'Rs.',
      isDuplicate: true // Trigger duplicate copy header print
    };

    try {
      const response = await fetch(`${API_BASE}/bills/print?hotelId=${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData)
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`✅ Duplicate bill printing dispatched successfully.`);

        // Call print agent direct fallback if on local network
        const isLocalHost = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' || 
                            window.location.hostname.startsWith('192.168.') || 
                            window.location.hostname.startsWith('10.') || 
                            window.location.hostname.startsWith('172.') || 
                            window.location.hostname.endsWith('.local');
        if (isLocalHost) {
          try {
            await fetch('http://127.0.0.1:9111/print', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: data.jobId, job_type: 'BILL', payload: billData })
            });
            fetch('http://127.0.0.1:9111/trigger-poll').catch(() => { });
          } catch (e) {
            // silent local fallback error
          }
        }

        // If resolving a captain request
        if (requestResolveId) {
          await axios.post(`${API_BASE}/bills/reprint-requests/${requestResolveId}/resolve`, {
            status: 'PRINTED'
          });
          fetchReprintRequests();
        }
      } else {
        toast.error(`❌ Printing failed: ${data.message}`);
      }
    } catch (err) {
      console.error('Failed to print duplicate bill:', err);
      toast.error('❌ Network error during printing dispatch.');
    }
  };

  // Reject reprint request
  const handleRejectRequest = async (requestId) => {
    try {
      const res = await axios.post(`${API_BASE}/bills/reprint-requests/${requestId}/resolve`, {
        status: 'REJECTED'
      });
      if (res.data?.success) {
        toast.success('Reprint request rejected.');
        fetchReprintRequests();
      }
    } catch (err) {
      console.error('Failed to reject reprint request:', err);
      toast.error('Failed to reject request.');
    }
  };

  // Handle deleting a completed bill
  const handleDeleteBill = async (billId) => {
    if (!window.confirm(`Are you sure you want to delete completed Bill #${billId}? This action will remove the bill amount from all sales records and cannot be undone.`)) {
      return;
    }

    try {
      const res = await axios.delete(`${API_BASE}/bills/${billId}`);
      if (res.data?.success) {
        toast.success(`✅ Bill #${billId} deleted successfully.`);
        fetchIssuedBills();
      } else {
        toast.error(`❌ Delete failed: ${res.data.message}`);
      }
    } catch (err) {
      console.error('Failed to delete completed bill:', err);
      toast.error('❌ Failed to delete bill.');
    }
  };

  // Real-time listener registration
  useEffect(() => {
    fetchIssuedBills();
    fetchReprintRequests();

    const handleNewReprintRequest = (newRequest) => {
      toast('🔔 New bill reprint request received!', { icon: '📄' });
      setReprintRequests(prev => {
        // Avoid duplicate additions
        if (prev.some(r => r.id === newRequest.id)) return prev;
        return [newRequest, ...prev];
      });
    };

    const handleReprintResolved = (resolvedRequest) => {
      setReprintRequests(prev => prev.filter(r => r.id !== resolvedRequest.id));
    };

    const handleBillDeleted = () => {
      fetchIssuedBills();
    };

    socket.on('bill-reprint-requested', handleNewReprintRequest);
    socket.on('bill-reprint-resolved', handleReprintResolved);
    socket.on('bill-deleted', handleBillDeleted);

    return () => {
      socket.off('bill-reprint-requested', handleNewReprintRequest);
      socket.off('bill-reprint-resolved', handleReprintResolved);
      socket.off('bill-deleted', handleBillDeleted);
    };
  }, [fetchIssuedBills, fetchReprintRequests]);

  // Search filtering
  const filteredBills = issuedBills.filter(bill => {
    const search = searchQuery.toLowerCase().trim();
    if (!search) return true;

    return (
      (bill.kot_number || '').toLowerCase().includes(search) ||
      (bill.table_name || `Table ${bill.table_id}`).toLowerCase().includes(search) ||
      (bill.captain_name || '').toLowerCase().includes(search) ||
      String(bill.id).includes(search)
    );
  });

  return (
    <AdminLayout>
      <div className="flex flex-col gap-8">
        {/* Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#0c0c0c] p-6 rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Issued Bills & Reprint Queue
            </h1>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">
              Reprint completed bills and manage captain reprint requests in real time.
            </p>
          </div>
          <button
            onClick={() => {
              fetchIssuedBills();
              fetchReprintRequests();
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {/* Core Layout Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Bills List (2/3 width) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            
            {/* Search and Filters */}
            <div className="flex items-center gap-3 bg-white dark:bg-[#0c0c0c] px-4 py-3 rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-sm">
              <Search className="text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search bills by table, KOT #, captain name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none text-slate-900 dark:text-white text-sm focus:outline-none placeholder-slate-400"
              />
            </div>

            {/* Bills Table Card */}
            <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-orange-500" />
                  Today's Completed Bills ({filteredBills.length})
                </h2>
              </div>

              {loadingBills ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Loading bills history...</span>
                </div>
              ) : filteredBills.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-xs font-bold uppercase tracking-wider">No completed bills found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200/60 dark:border-white/5">
                        <th className="px-6 py-4">Bill ID</th>
                        <th className="px-6 py-4">Table</th>
                        <th className="px-6 py-4">KOT Number</th>
                        <th className="px-6 py-4">Captain</th>
                        <th className="px-6 py-4">Grand Total</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {filteredBills.map(bill => {
                        const isDeleted = bill.status === 'CANCELLED';
                        return (
                          <tr key={bill.id} className={`text-slate-700 dark:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all ${isDeleted ? 'opacity-60 bg-red-500/[0.02]' : ''}`}>
                            <td className="px-6 py-4.5 font-mono text-xs font-bold text-slate-900 dark:text-white">#{bill.id}</td>
                            <td className="px-6 py-4.5 text-sm font-semibold">{bill.table_name || `Table ${bill.table_id}`}</td>
                            <td className="px-6 py-4.5 text-xs font-bold text-slate-400">{bill.kot_number}</td>
                            <td className="px-6 py-4.5 text-sm font-semibold flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {bill.captain_name}
                            </td>
                            <td className="px-6 py-4.5 text-sm font-black">
                              {isDeleted ? (
                                <span className="line-through text-slate-400">₹{parseFloat(bill.grand_total).toFixed(0)}</span>
                              ) : (
                                <span className="text-orange-500">₹{parseFloat(bill.grand_total).toFixed(0)}</span>
                              )}
                            </td>
                            <td className="px-6 py-4.5 text-right flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedBill(bill)}
                                className="p-2 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-500 rounded-lg transition-all cursor-pointer"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              
                              {isDeleted ? (
                                <span className="px-3.5 py-2 text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-500 rounded-lg">
                                  DELETED
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleReprintBill(bill)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-orange-500/10 cursor-pointer"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    Reprint
                                  </button>
                                  <button
                                    onClick={() => handleDeleteBill(bill.id)}
                                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all cursor-pointer"
                                    title="Delete Bill"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Reprint Requests Sidebar (1/3 width) */}
          <div className="flex flex-col gap-4">
            <div className="bg-white dark:bg-[#0c0c0c] rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between bg-orange-500/5">
                <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  Reprint Requests ({reprintRequests.length})
                </h2>
                {reprintRequests.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                )}
              </div>

              {loadingRequests ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Checking requests...</span>
                </div>
              ) : reprintRequests.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Check className="w-10 h-10 text-emerald-500/20 dark:text-emerald-500/10 mx-auto mb-3" />
                  <p className="text-xs font-bold uppercase tracking-wider">All caught up! No reprint requests.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5 p-4 flex flex-col gap-3.5">
                  {reprintRequests.map(req => (
                    <div key={req.id} className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200/40 dark:border-white/5 rounded-xl flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            {req.table_name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                            KOT: {req.kot_number} • Capt: {req.captain_name}
                          </span>
                        </div>
                        <span className="text-sm font-black text-orange-500">
                          ₹{parseFloat(req.grand_total).toFixed(0)}
                        </span>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReprintBill(req, req.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-emerald-500/10"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req.id)}
                          className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Bill Details Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200/80 dark:border-white/5 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-white/5">
              <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wide">
                Bill Receipt Copy
              </h3>
              <button 
                onClick={() => setSelectedBill(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Copy Viewer */}
            <div className="py-6 flex flex-col gap-4 font-mono text-xs max-h-[60vh] overflow-y-auto pr-1">
              <div className="text-center flex flex-col gap-1">
                <span className="text-base font-bold tracking-wider text-slate-900 dark:text-white">
                  {systemSettings.branding?.name || 'MEJWANI'}
                </span>
                {systemSettings.branding?.address && (
                  <span className="text-[10px] text-slate-400">{systemSettings.branding.address}</span>
                )}
                {systemSettings.branding?.phone && (
                  <span className="text-[10px] text-slate-400">Phone: {systemSettings.branding.phone}</span>
                )}
                <span className="text-[10px] text-orange-500 font-extrabold uppercase mt-1">*** COPY OF BILL ***</span>
              </div>

              <div className="border-t border-dashed border-slate-200 dark:border-white/10 my-2" />

              <div className="flex justify-between">
                <span>Invoice: ORD-{selectedBill.id}</span>
                <span>Table: {selectedBill.table_name || `Table ${selectedBill.table_id}`}</span>
              </div>
              <div className="flex justify-between">
                <span>Date: {formatDateDDMMYYYY(selectedBill.created_at)}</span>
                <span>Time: {new Date(selectedBill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between">
                <span>KOT: {selectedBill.kot_number}</span>
                <span>Capt: {selectedBill.captain_name}</span>
              </div>

              <div className="border-t border-dashed border-slate-200 dark:border-white/10 my-2" />

              {/* Items List */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between font-bold text-slate-800 dark:text-white">
                  <span className="w-3/5">Description</span>
                  <span className="w-1/5 text-center">Qty</span>
                  <span className="w-1/5 text-right">Amt</span>
                </div>
                <div className="border-t border-slate-100 dark:border-white/5 my-1" />
                {selectedBill.items?.map((item, index) => {
                  const qty = item.quantity || item.qty || 1;
                  const price = item.price || 0;
                  return (
                    <div key={index} className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span className="w-3/5 uppercase truncate">{item.name}</span>
                      <span className="w-1/5 text-center">{qty}</span>
                      <span className="w-1/5 text-right">₹{(qty * price).toFixed(0)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-dashed border-slate-200 dark:border-white/10 my-2" />

              {/* Financials */}
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>₹{parseFloat(selectedBill.subtotal || '0').toFixed(2)}</span>
              </div>
              {parseFloat(selectedBill.cgst || '0') > 0 && (
                <div className="flex justify-between">
                  <span>CGST</span>
                  <span>₹{parseFloat(selectedBill.cgst || '0').toFixed(2)}</span>
                </div>
              )}
              {parseFloat(selectedBill.sgst || '0') > 0 && (
                <div className="flex justify-between">
                  <span>SGST</span>
                  <span>₹{parseFloat(selectedBill.sgst || '0').toFixed(2)}</span>
                </div>
              )}
              
              <div className="border-t border-dashed border-slate-200 dark:border-white/10 my-2" />

              <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white">
                <span>GRAND TOTAL</span>
                <span className="text-orange-500">₹{parseFloat(selectedBill.grand_total || '0').toFixed(0)}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex gap-3">
              <button
                onClick={() => {
                  handleReprintBill(selectedBill);
                  setSelectedBill(null);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-orange-500/10"
              >
                <Printer className="w-4 h-4" />
                Print Duplicate
              </button>
              <button
                onClick={() => setSelectedBill(null)}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
