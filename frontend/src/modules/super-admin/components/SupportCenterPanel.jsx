import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle, 
  FileText, 
  User, 
  Building2, 
  Phone, 
  Mail, 
  Tag, 
  SlidersHorizontal,
  ChevronRight,
  Eye,
  Check,
  Calendar,
  AlertCircle,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../../../shared/services/apiBase';
import { superAdminRequest } from '../services/superAdminApi';
import socket from '../../../shared/services/socketClient';

export default function SupportCenterPanel() {
  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 });
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [hotelFilter, setHotelFilter] = useState('');

  // Selected Ticket Drawer / Modal
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ticketDetails, setTicketDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const categories = [
    'Login Issue',
    'Billing',
    'Printer',
    'KOT',
    'QR Menu',
    'Staff',
    'Subscription',
    'Feature Request',
    'Technical Issue',
    'Other'
  ];

  useEffect(() => {
    socket.emit('join-super-admin-room');
  }, []);

  useEffect(() => {
    fetchTickets();
    fetchHotelsList();

    // Listen to real-time events
    socket.on('new-support-ticket', handleNewTicketRealtime);
    socket.on('ticket-status-updated', handleTicketStatusUpdatedRealtime);

    return () => {
      socket.off('new-support-ticket', handleNewTicketRealtime);
      socket.off('ticket-status-updated', handleTicketStatusUpdatedRealtime);
    };
  }, [search, statusFilter, categoryFilter, hotelFilter]);

  const handleNewTicketRealtime = (ticket) => {
    // Re-fetch to keep everything synced and refresh stats
    fetchTickets();
  };

  const handleTicketStatusUpdatedRealtime = () => {
    fetchTickets();
  };

  const fetchHotelsList = async () => {
    try {
      const hotelsData = await superAdminRequest('/hotels');
      setHotels(hotelsData || []);
    } catch (err) {
      console.error('Error fetching hotels:', err);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      let query = `/support/super/tickets?`;
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (statusFilter) query += `status=${statusFilter}&`;
      if (categoryFilter) query += `category=${categoryFilter}&`;
      if (hotelFilter) query += `hotelId=${hotelFilter}&`;

      const res = await superAdminRequest(query);
      if (res && res.tickets) {
        setTickets(res.tickets);
        setCounts(res.counts);
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
      toast.error('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (id) => {
    setDetailsLoading(true);
    try {
      const res = await superAdminRequest(`/support/super/tickets/${id}`);
      if (res && res.ticket) {
        setTicketDetails(res);
        setInternalNotes(res.ticket.internal_notes || '');
      }
    } catch (err) {
      console.error('Error fetching details:', err);
      toast.error('Failed to load ticket details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedTicketId) return;
    setStatusUpdating(true);
    try {
      const token = localStorage.getItem('mejwani_super_admin_jwt');
      const response = await fetch(`${API_BASE}/support/super/tickets/${selectedTicketId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      const resData = await response.json();
      if (response.ok && resData.success) {
        toast.success(`Status updated to ${newStatus}`);
        // Refresh detail view and summary list
        fetchTicketDetails(selectedTicketId);
        fetchTickets();
      } else {
        toast.error(resData.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Network error updating status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedTicketId) return;
    setNotesSaving(true);
    try {
      const token = localStorage.getItem('mejwani_super_admin_jwt');
      const response = await fetch(`${API_BASE}/support/super/tickets/${selectedTicketId}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes: internalNotes })
      });
      const resData = await response.json();
      if (response.ok && resData.success) {
        toast.success('Internal notes saved');
        fetchTicketDetails(selectedTicketId);
      } else {
        toast.error(resData.message || 'Failed to save notes');
      }
    } catch (err) {
      console.error('Error saving notes:', err);
      toast.error('Network error saving notes');
    } finally {
      setNotesSaving(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicketId || !replyMessage.trim()) return;
    setReplySending(true);
    try {
      const token = localStorage.getItem('mejwani_super_admin_jwt');
      const response = await fetch(`${API_BASE}/support/tickets/${selectedTicketId}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reply_message: replyMessage })
      });
      const resData = await response.json();
      if (response.ok && resData.success) {
        toast.success('Support reply sent successfully!');
        setReplyMessage('');
        fetchTicketDetails(selectedTicketId);
        fetchTickets();
      } else {
        toast.error(resData.message || 'Failed to send support reply');
      }
    } catch (err) {
      console.error('Error sending support reply:', err);
      toast.error('Network error sending support reply');
    } finally {
      setReplySending(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!selectedTicketId) return;
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem('mejwani_super_admin_jwt');
      const response = await fetch(`${API_BASE}/support/tickets/${selectedTicketId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const resData = await response.json();
      if (response.ok && resData.success) {
        toast.success('Support ticket deleted successfully.');
        setTickets((prev) => prev.filter((t) => t.id !== selectedTicketId));
        closeTicketDrawer();
        setShowDeleteModal(false);
        fetchTickets();
      } else {
        toast.error(resData.message || 'Failed to delete support ticket.');
      }
    } catch (err) {
      console.error('Error deleting support ticket:', err);
      toast.error('Network error deleting support ticket.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openTicketDrawer = (id) => {
    setSelectedTicketId(id);
    fetchTicketDetails(id);
  };

  const closeTicketDrawer = () => {
    setSelectedTicketId(null);
    setTicketDetails(null);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Open': return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      case 'In Progress': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'Resolved': return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
      case 'Closed': return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-400';
    }
  };

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'Critical': return 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
      case 'High': return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
      case 'Medium': return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      case 'Low': return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Support Ticket Center</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Manage and resolve customer support tickets in real-time</p>
        </div>
        
        {/* Real-time pulse indicator */}
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Real-Time Support Active
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total */}
        <div className="bg-slate-950/5 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-4 rounded-2xl">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Tickets</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{counts.total}</p>
        </div>
        {/* Open */}
        <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl">
          <div className="flex justify-between items-center text-amber-500">
            <span className="text-[10px] font-black uppercase tracking-wider">Open</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-amber-500 mt-1">{counts.open}</p>
        </div>
        {/* In Progress */}
        <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl">
          <div className="flex justify-between items-center text-blue-400">
            <span className="text-[10px] font-black uppercase tracking-wider">In Progress</span>
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-blue-400 mt-1">{counts.inProgress}</p>
        </div>
        {/* Resolved */}
        <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl">
          <div className="flex justify-between items-center text-emerald-500">
            <span className="text-[10px] font-black uppercase tracking-wider">Resolved</span>
            <CheckCircle className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-emerald-500 mt-1">{counts.resolved}</p>
        </div>
        {/* Closed */}
        <div className="bg-slate-500/5 border border-slate-200 dark:border-white/5 p-4 rounded-2xl">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Closed</span>
            <XCircle className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-slate-500 mt-1">{counts.closed}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col xl:flex-row gap-3 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 rounded-2xl shadow-sm">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ticket number, hotel name, owner, or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-xl pl-11 pr-4 py-2.5 font-medium text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#ff6b00]"
          />
        </div>
        {/* Filters Group */}
        <div className="grid grid-cols-3 gap-2 w-full xl:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:border-[#ff6b00] cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:border-[#ff6b00] cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {/* Hotel Filter */}
          <select
            value={hotelFilter}
            onChange={(e) => setHotelFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:border-[#ff6b00] cursor-pointer"
          >
            <option value="">All Hotels</option>
            {hotels.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/5 text-slate-500 bg-slate-50 dark:bg-white/[0.01]">
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider">Ticket No</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider">Hotel</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider">Owner / Admin</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider">Priority</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider">Created Date</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-500 font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-[#ff6b00]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading tickets...
                    </div>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-400 font-bold">
                    No support tickets found matching your filters.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4 font-black text-sm text-slate-900 dark:text-white">
                      {t.ticket_number || `SUP-${1000 + t.id}`}
                    </td>
                    <td className="px-6 py-4 font-bold text-sm text-slate-900 dark:text-slate-100">
                      {t.hotel_name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t.admin_name || t.owner_name}</div>
                      <div className="text-[10px] font-semibold text-slate-500">{t.admin_email || t.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <Tag className="w-3.5 h-3.5 text-[#ff6b00]" />
                        {t.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${getPriorityBadgeClass(t.priority)}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getStatusBadgeClass(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                      {new Date(t.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openTicketDrawer(t.id)}
                        className="px-3.5 py-1.5 bg-[#ff6b00]/10 hover:bg-[#ff6b00] text-[#ff6b00] hover:text-white text-xs font-bold rounded-xl flex items-center gap-1 ml-auto cursor-pointer transition-all active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Details Side-Drawer/Modal overlay */}
      <AnimatePresence>
        {selectedTicketId && ticketDetails && (
          <div className="fixed inset-0 z-[9999] flex justify-end bg-slate-950/60 backdrop-blur-sm select-none">
            {/* Backdrop click closer */}
            <div className="absolute inset-0" onClick={closeTicketDrawer} />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl h-screen bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col text-slate-200"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-950/40">
                <div>
                  <div className="text-xs font-black text-slate-500 uppercase tracking-widest">Support Ticket Details</div>
                  <h3 className="text-xl font-black text-white mt-1">
                    {ticketDetails.ticket.ticket_number || `SUP-${1000 + ticketDetails.ticket.id}`}
                  </h3>
                </div>
                <button
                  onClick={closeTicketDrawer}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body Scroll */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Subject & Description Card */}
                <div className="bg-slate-950/50 p-5 rounded-2xl border border-white/5 space-y-4">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Subject</span>
                    <h4 className="text-base font-bold text-white mt-0.5">{ticketDetails.ticket.subject}</h4>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Category</span>
                    <div className="mt-1">
                      <span className="text-xs font-bold text-[#ff6b00] bg-[#ff6b00]/10 border border-[#ff6b00]/20 px-2.5 py-1 rounded-lg">
                        {ticketDetails.ticket.category}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Message Description</span>
                    <p className="text-sm text-slate-300 leading-relaxed mt-1 whitespace-pre-wrap">{ticketDetails.ticket.message}</p>
                  </div>

                  {(ticketDetails.ticket.screenshot_url || ticketDetails.ticket.attachment_url) && (
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">Screenshot Attachment</span>
                      <a 
                        href={ticketDetails.ticket.screenshot_url || ticketDetails.ticket.attachment_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-block relative rounded-xl border border-white/10 overflow-hidden hover:border-[#ff6b00]/40 transition-colors"
                      >
                        <img 
                          src={ticketDetails.ticket.screenshot_url || ticketDetails.ticket.attachment_url} 
                          alt="Support Screenshot" 
                          className="max-h-48 object-cover rounded-xl"
                        />
                        <div className="absolute inset-0 bg-slate-950/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <span className="bg-[#ff6b00] text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase shadow-lg">View Full Image</span>
                        </div>
                      </a>
                    </div>
                  )}
                </div>

                {/* Status Dropdown & Actions */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Update Ticket Status</label>
                    <select
                      value={ticketDetails.ticket.status}
                      disabled={statusUpdating}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 font-bold text-sm text-slate-200 focus:outline-none focus:border-[#ff6b00] cursor-pointer"
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                  
                  {/* Delete Option */}
                  <div className="pt-2 border-t border-white/5 flex justify-end">
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="px-4 py-2 bg-red-600/10 hover:bg-red-600 border border-red-600/20 text-red-500 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Ticket
                    </button>
                  </div>
                </div>

                {/* Hotel Profile Card */}
                <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 space-y-4">
                  <h5 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#ff6b00]" />
                    Hotel Profile Info
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="w-4 h-4 text-slate-500" />
                      <div>
                        <span className="block text-[10px] font-black uppercase text-slate-600">Hotel Name</span>
                        <span className="text-slate-200">{ticketDetails.ticket.hotel_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-slate-500" />
                      <div>
                        <span className="block text-[10px] font-black uppercase text-slate-600">Owner Name</span>
                        <span className="text-slate-200">{ticketDetails.ticket.admin_name || ticketDetails.ticket.owner_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-slate-500" />
                      <div>
                        <span className="block text-[10px] font-black uppercase text-slate-600">Email Address</span>
                        <a href={`mailto:${ticketDetails.ticket.admin_email || ticketDetails.ticket.email}`} className="text-slate-200 hover:text-[#ff6b00] underline">{ticketDetails.ticket.admin_email || ticketDetails.ticket.email}</a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-slate-500" />
                      <div>
                        <span className="block text-[10px] font-black uppercase text-slate-600">Phone Number</span>
                        <span className="text-slate-200">{ticketDetails.ticket.phone}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Support Reply Section */}
                <div className="bg-slate-950/60 p-5 rounded-2xl border border-[#ff6b00]/20 space-y-4">
                  <h5 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-[#ff6b00]" />
                    Send Support Reply
                  </h5>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    This message will be sent directly to the hotel admin's email and saved in the history.
                  </p>
                  <textarea
                    id="reply_message"
                    name="reply_message"
                    rows={4}
                    placeholder="Write your response here... (e.g. Please restart the printer service and reconnect the USB cable.)"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-4 font-medium text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#ff6b00]"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSendReply}
                      disabled={replySending || !replyMessage.trim()}
                      className="px-5 py-2.5 bg-[#ff6b00] hover:bg-[#ff6b00]/90 text-white rounded-xl text-xs font-black uppercase transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-md shadow-orange-500/20 active:scale-95"
                    >
                      {replySending ? 'Sending Reply...' : (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          Send Reply
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setShowDeleteModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full text-slate-200 relative z-10 shadow-2xl"
            >
              <h3 className="text-lg font-black text-white mb-2">Delete Support Ticket?</h3>
              <p className="text-xs font-bold text-slate-400 leading-relaxed mb-6">
                This action cannot be undone.<br />
                All replies, notes and history related to this ticket will be permanently removed.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTicket}
                  disabled={deleteLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Ticket'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
