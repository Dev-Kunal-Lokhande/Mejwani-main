import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Building2,
  ChevronRight,
  CloudDownload,
  CreditCard,
  DatabaseBackup,
  FileText,
  Hotel,
  LockKeyhole,
  LogOut,
  Moon,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  UserCog,
  Utensils,
  WalletCards,
  Plus,
  Eye,
  Trash,
  Mail,
  Sliders,
  AlertCircle,
  Database,
  Globe,
  CheckCircle,
  AlertTriangle,
  Printer,
  Copy,
  Check,
  Edit,
  X,
  Upload,
  Bell
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import toast from 'react-hot-toast';
import { useTheme } from '../../../shared/context/ThemeContext';
import { clearSuperAdminSession, superAdminRequest } from '../services/superAdminApi';
import { BACKEND_BASE } from '../../../shared/services/apiBase';
import CreateHotelModal from '../components/CreateHotelModal';
import SupportCenterPanel from '../components/SupportCenterPanel';
import socket from '../../../shared/services/socketClient';
import { LifeBuoy } from 'lucide-react';

const fallbackDashboard = {
  metrics: { totalHotels: 0, activeHotels: 0, totalRevenue: 0, monthlyRevenue: 0, totalOrders: 0, liveActiveTables: 0, totalStaff: 0, totalCaptains: 0, customersServed: 0, systemStatus: 'Loading...' },
  revenueSeries: [],
  monthlyGrowth: [],
  aiInsights: [],
  system: { activeUsers: 0, server: 'Loading', api: 'Loading', database: 'Loading', sockets: 'Loading' }
};

const sections = [
  { id: 'overview', label: 'Dashboard', icon: Activity },
  { id: 'hotels', label: 'Hotels', icon: Hotel },
  { id: 'admins', label: 'Admins', icon: UserCog },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'support', label: 'Support Center', icon: LifeBuoy },
  { id: 'settings', label: 'Settings & Backups', icon: Settings },
];

const sectionPathById = {
  overview: '',
  hotels: 'hotels',
  admins: 'admins',
  billing: 'billing',
  support: 'support',
  settings: 'settings'
};

const sectionIdByPath = Object.entries(sectionPathById).reduce((acc, [id, path]) => {
  if (path) acc[path] = id;
  return acc;
}, { dashboard: 'overview' });

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

const statusClass = (status) => {
  if (['active', 'paid', 'Healthy', 'Connected', 'Operational'].includes(status)) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  if (['suspended', 'inactive', 'failed', 'critical'].includes(status)) return 'bg-rose-500/10 text-rose-600 dark:text-rose-300';
  return 'bg-amber-500/10 text-amber-600 dark:text-amber-300';
};

function Panel({ children, className = '' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04] ${className}`}
    >
      {children}
    </motion.section>
  );
}

function MetricCard({ title, value, icon: Icon, tone = 'orange', detail }) {
  const tones = {
    orange: 'bg-orange-500/10 text-orange-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    blue: 'bg-blue-500/10 text-blue-500',
    violet: 'bg-violet-500/10 text-violet-500',
    rose: 'bg-rose-500/10 text-rose-500',
  };

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">{title}</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</h3>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {detail && <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">{detail}</p>}
    </Panel>
  );
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const activeSection = useMemo(() => {
    const normalizedPath = location.pathname.replace(/\/+$/, '');
    const sectionPath = normalizedPath.split('/')[2] || '';
    return sectionIdByPath[sectionPath] || 'overview';
  }, [location.pathname]);
  const setActiveSection = (sectionId) => {
    const sectionPath = sectionPathById[sectionId] || '';
    navigate(sectionPath ? `/super-admin/${sectionPath}` : '/super-admin');
  };
  const [query, setQuery] = useState('');
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [dashboard, setDashboard] = useState(fallbackDashboard);
  const [hotels, setHotels] = useState([]);
  const [admins, setAdmins] = useState([]);

  const getAdminCreatedDate = (adm) => {
    if (adm.hotel_id) {
      const hotel = hotels.find((h) => h.id === adm.hotel_id);
      if (hotel && hotel.created_at) {
        const d = new Date(hotel.created_at);
        if (!isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, '0');
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = months[d.getMonth()];
          const year = d.getFullYear();
          return `${day} ${month} ${year}`;
        }
      }
    }
    return '04 Jun 2026';
  };
  const [billing, setBilling] = useState({ plans: [], payments: [], activeHotels: [], analytics: { totalBilled: 0, pendingBilled: 0, totalInvoices: 0 } });
  const [isCreateHotelModalOpen, setIsCreateHotelModalOpen] = useState(false);

  // Selected Hotel details drawer
  const [selectedHotel, setSelectedHotel] = useState(null);
  // Edit Hotel modal states
  const [editingHotel, setEditingHotel] = useState(null);
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [qrPamphletFile, setQrPamphletFile] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState(null);
  const [qrPamphletPreview, setQrPamphletPreview] = useState(null);

  const startEditingHotel = (hotel) => {
    setEditingHotel(hotel);
    setCoverImageFile(null);
    setQrPamphletFile(null);
    setCoverImagePreview(hotel.cover_image || null);
    setQrPamphletPreview(hotel.qr_pamphlet || null);
  };

  const closeEditing = () => {
    setEditingHotel(null);
    setCoverImageFile(null);
    setQrPamphletFile(null);
    setCoverImagePreview(null);
    setQrPamphletPreview(null);
  };

  const handleEditFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (fieldName === 'cover_image') {
        setCoverImagePreview(reader.result);
        setCoverImageFile(file);
      } else {
        setQrPamphletPreview(reader.result);
        setQrPamphletFile(file);
      }
    };
  };

  // SMTP & Platform settings
  const [settings, setSettings] = useState({
    brandingLogo: '',
    platformName: '',
    supportEmail: '',
    supportPhone: '',
    smtpSettings: {
      host: '',
      port: '',
      user: '',
      pass: '',
      sender_email: '',
      secure: false
    }
  });

  // Backups list
  const [backups, setBackups] = useState([]);
  const [backupLoading, setBackupLoading] = useState(false);

  // Invoice display modal
  const [activeInvoice, setActiveInvoice] = useState(null);

  const loadSupportCount = async () => {
    try {
      const res = await superAdminRequest('/support/super/tickets?status=Open');
      if (res && res.tickets) {
        setOpenTicketsCount(res.tickets.length);
        setNotifications(res.tickets);
      }
    } catch (err) {
      console.error('Failed to load open tickets count:', err);
    }
  };

  const loadData = async () => {
    try {
      const dashboardRes = await superAdminRequest('/dashboard');

// Support direct API response and { data: ... } response
const dashboardData = dashboardRes?.data ?? dashboardRes ?? {};

setDashboard({
  ...fallbackDashboard,
  ...dashboardData,

  metrics: {
    ...fallbackDashboard.metrics,
    ...(dashboardData.metrics ?? {}),
  },

  system: {
    ...fallbackDashboard.system,
    ...(dashboardData.system ?? {}),
  },

  revenueSeries: Array.isArray(dashboardData.revenueSeries)
    ? dashboardData.revenueSeries
    : [],

  monthlyGrowth: Array.isArray(dashboardData.monthlyGrowth)
    ? dashboardData.monthlyGrowth
    : [],

  aiInsights: Array.isArray(dashboardData.aiInsights)
    ? dashboardData.aiInsights
    : [],
});

      const hotelsRes = await superAdminRequest('/hotels');
      setHotels(hotelsRes);

      const adminsRes = await superAdminRequest('/admins');
      setAdmins(adminsRes);

      const billingRes = await superAdminRequest('/billing');
      setBilling(billingRes);

      const settingsRes = await superAdminRequest('/settings');
      setSettings(settingsRes);

      const backupsRes = await superAdminRequest('/backups');
      setBackups(backupsRes);

      loadSupportCount();
    } catch (error) {
      console.error("Failed to load dashboard data", error);
      toast.error("Error communicating with Super Admin API");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    socket.emit('join-super-admin-room');

    socket.on('new-support-ticket', (ticket) => {
      setOpenTicketsCount(prev => prev + 1);
      setNotifications(prev => [ticket, ...prev]);

      // Sound notification
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const playNote = (freq, delay, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
            gain.gain.setValueAtTime(0.08, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + duration);
          };
          playNote(523.25, 0, 0.4);   // C5 Harmonic Tone
          playNote(659.25, 0.15, 0.6); // E5 Harmonic Tone
        }
      } catch (soundErr) {}

      // Custom toast
      toast.custom((t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-slate-900 border border-red-500/30 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-4`}
        >
          <div className="flex-1 w-0">
            <div className="flex items-start">
              <span className="text-xl mr-3">🔴</span>
              <div className="flex-1">
                <p className="text-xs font-black uppercase text-red-500 tracking-wider">New Support Ticket</p>
                <p className="text-sm font-black text-white mt-1">{ticket.hotel_name}</p>
                <p className="text-xs font-bold text-slate-400 mt-0.5">{ticket.ticket_number || `SUP-${1000 + ticket.id}`}</p>
                <p className="text-xs text-slate-300 mt-1.5 line-clamp-2 italic">"{ticket.subject}"</p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-white/10 ml-4 pl-4 items-center">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                setActiveSection('support');
              }}
              className="text-xs font-black text-[#ff6b00] hover:text-[#ff6b00]/80 uppercase cursor-pointer"
            >
              View
            </button>
          </div>
        </div>
      ), { duration: 6000 });
    });

    socket.on('ticket-status-updated', () => {
      loadSupportCount();
    });

    return () => {
      socket.off('new-support-ticket');
      socket.off('ticket-status-updated');
    };
  }, []);

  const filteredHotels = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return hotels.filter((h) =>
      [h.name, h.owner_name, h.plan, h.status, h.email, h.phone].join(' ').toLowerCase().includes(normalizedQuery)
    );
  }, [hotels, query]);

  const handleLogout = () => {
    clearSuperAdminSession();
    navigate('/super-admin/login', { replace: true });
  };

  // Hotel Status Actions
  const toggleHotelStatus = async (hotel) => {
    const nextStatus = hotel.status === 'active' ? 'suspended' : 'active';
    try {
      await superAdminRequest(`/hotels/${hotel.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus })
      });
      toast.success(`Hotel status updated to ${nextStatus}`);
      loadData();
    } catch (err) {
      toast.error('Failed to change status');
    }
  };

  const deleteHotel = async (hotelId) => {
    if (!window.confirm("Are you sure you want to delete this hotel tenant? This actions destroys all tenant data CASCADE!")) return;
    try {
      await superAdminRequest(`/hotels/${hotelId}`, {
        method: 'DELETE'
      });
      toast.success('Hotel tenant removed successfully');
      loadData();
    } catch (err) {
      toast.error('Failed to delete hotel');
    }
  };

  // Save Settings / SMTP
  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      await superAdminRequest('/system-settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      toast.success('System parameters saved successfully!');
      loadData();
    } catch (err) {
      toast.error('Failed to update system settings');
    }
  };

  // Backups
  const handleCreateBackup = async () => {
    setBackupLoading(true);
    try {
      await superAdminRequest('/backups', { method: 'POST' });
      toast.success('JSON database snapshot saved successfully!');
      loadData();
    } catch (err) {
      toast.error('Backup creation failed');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (filename) => {
    if (!window.confirm("WARNING: Restoring will overwrite ALL tables and replace them with this backup snapshot. Continue?")) return;
    setBackupLoading(true);
    try {
      await superAdminRequest(`/backups/${filename}/restore`, { method: 'POST' });
      toast.success('Database content restored successfully!');
      loadData();
    } catch (err) {
      toast.error('Failed to restore database');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDeleteBackup = async (filename) => {
    if (!window.confirm("Delete this backup snapshot?")) return;
    try {
      await superAdminRequest(`/backups/${filename}`, { method: 'DELETE' });
      toast.success('Backup file removed');
      loadData();
    } catch (err) {
      toast.error('Failed to remove backup');
    }
  };

  // Billing Renewals
  const handleRenewSubscription = async (hotelId) => {
    try {
      const res = await superAdminRequest(`/billing/renew/${hotelId}`, { method: 'POST' });
      toast.success('Subscription renewed for 1 Year!');
      loadData();
      if (res.invoiceNumber) {
        // Automatically fetch and show the invoice
        const invoiceRes = await superAdminRequest(`/billing/invoice/${res.invoiceNumber}`);
        setActiveInvoice(invoiceRes);
      }
    } catch (err) {
      toast.error('Failed to renew subscription');
    }
  };

  const handleViewInvoice = async (invoiceNumber) => {
    try {
      const res = await superAdminRequest(`/billing/invoice/${invoiceNumber}`);
      setActiveInvoice(res);
    } catch (err) {
      toast.error('Failed to load invoice details');
    }
  };

  // Payment Status Update
  const handleUpdatePaymentStatus = async (paymentId, status, amount) => {
    try {
      const body = { status };
      if (amount && amount !== '0') {
        body.amount = parseFloat(amount);
      }
      await superAdminRequest(`/billing/payments/${paymentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      toast.success(`Invoice marked as ${status}`);
      loadData();
    } catch (err) {
      toast.error('Failed to update payment status');
    }
  };

  // Payment Amount Update
  const handleUpdatePaymentAmount = async (paymentId, amount) => {
    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        toast.error('Amount must be a valid positive number');
        return;
      }
      await superAdminRequest(`/billing/payments/${paymentId}/amount`, {
        method: 'PATCH',
        body: JSON.stringify({ amount: parsedAmount })
      });
      toast.success(`Invoice amount updated to ₹${parsedAmount}`);
      loadData();
    } catch (err) {
      toast.error('Failed to update payment amount');
    }
  };

  // Delete Payment Record (for deleted hotels)
  const handleDeletePaymentRecord = async (paymentId) => {
    try {
      await superAdminRequest(`/billing/payments/${paymentId}`, {
        method: 'DELETE'
      });
      toast.success('Invoice record permanently deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete invoice record');
    }
  };

  const handleCleanupDeletedHistory = async () => {
    if (!window.confirm("Are you sure you want to permanently delete all billing history, invoices, and payment records for deleted hotels? This action cannot be undone.")) {
      return;
    }
    try {
      await superAdminRequest('/billing/cleanup-deleted', {
        method: 'DELETE'
      });
      toast.success('All deleted hotel billing records permanently removed!');
      loadData();
    } catch (err) {
      toast.error('Failed to clean up deleted hotel history');
    }
  };

  const handleCleanupOrphanAdmins = async () => {
    console.log('[handleCleanupOrphanAdmins] Button clicked');
    if (!window.confirm('Permanently remove all orphan admin accounts linked to deleted or non-existent hotels? This cannot be undone.')) return;
    try {
      console.log('[handleCleanupOrphanAdmins] Sending DELETE /admins/cleanup-orphans...');
      const res = await superAdminRequest('/admins/cleanup-orphans', { method: 'DELETE' });
      console.log('[handleCleanupOrphanAdmins] Response:', res);
      const count = res.removed?.length ?? 0;
      toast.success(res.message || `${count} orphan admin${count !== 1 ? 's' : ''} removed`);
      loadData();
    } catch (err) {
      console.error('[handleCleanupOrphanAdmins] Error:', err);
      toast.error('Failed to clean up orphan admins');
    }
  };

  const chartStroke = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.10)';
  const tickColor = isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 transition-colors duration-200 dark:bg-[#050505] dark:text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#080808]/85">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-4 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/25">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">{settings.platformName || 'Mejwani Command Center'}</h1>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Enterprise Super Admin Panel</p>
            </div>
          </div>

          <div className="hidden md:flex flex-1 max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hotels, owners, plans..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* NOTIFICATIONS BELL */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5 relative hover:bg-slate-50 dark:hover:bg-white/10 transition cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                {openTicketsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white animate-pulse">
                    {openTicketsCount}
                  </span>
                )}
              </button>

              {/* Dropdown Overlay */}
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden text-slate-900 dark:text-white animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400">Unread Tickets ({openTicketsCount})</span>
                      {openTicketsCount > 0 && (
                        <button 
                          onClick={() => {
                            setOpenTicketsCount(0);
                            setNotifications([]);
                          }}
                          className="text-[10px] font-black text-rose-500 hover:underline uppercase cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 font-semibold">
                          No new unread support tickets.
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id}
                            onClick={() => {
                              setActiveSection('support');
                              setShowNotifications(false);
                            }}
                            className="p-3.5 hover:bg-slate-50 dark:hover:bg-white/5 transition cursor-pointer text-left"
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-black text-[#ff6b00]">{notif.ticket_number || `SUP-${1000 + notif.id}`}</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase">
                                {new Date(notif.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 mt-1 truncate">{notif.hotel_name}</p>
                            <p className="text-[11px] font-semibold text-slate-500 truncate mt-0.5">{notif.subject}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-2 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/20 text-center">
                      <button 
                        onClick={() => {
                          setActiveSection('support');
                          setShowNotifications(false);
                        }}
                        className="text-[10px] font-black text-slate-500 hover:text-[#ff6b00] uppercase cursor-pointer"
                      >
                        Go to Support Center
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button onClick={toggleTheme} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5" aria-label="Toggle theme">
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={handleLogout} className="rounded-xl bg-red-500/10 p-3 text-red-500 hover:bg-red-500 hover:text-white" aria-label="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* BODY GRID */}
      <div className="mx-auto grid max-w-[1800px] gap-6 px-4 py-6 lg:grid-cols-[260px_1fr] lg:px-6">
        {/* SIDE NAV */}
        <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
          <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:grid-cols-3 lg:grid-cols-1">
            {sections.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${
                    active ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1">{item.label}</span>
                  {item.id === 'support' && openTicketsCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 animate-pulse">
                      {openTicketsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* MAIN PANEL CONTENT */}
        <main className="space-y-6">
          {/* Welcome Banner */}
          <section className="rounded-2xl bg-slate-950 px-5 py-6 text-white shadow-xl dark:bg-white/[0.06] relative overflow-hidden">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between relative z-10">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-300">SaaS Platform Operator</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Platform Operations Hub</h2>
                <p className="mt-2 max-w-2xl text-sm text-white/60">
                  Manage multiple hotel organizations, billing lifecycles, global configurations, database disaster recovery snapshot backups, and system security controls.
                </p>
              </div>
              <button
                onClick={() => setIsCreateHotelModalOpen(true)}
                className="flex w-fit items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-black uppercase tracking-wider hover:bg-orange-400 transition"
              >
                <Plus className="w-4 h-4" />
                Create Hotel
              </button>
            </div>
          </section>

          {/* SECTION 1: OVERVIEW */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Metrics */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard title="Total Tenants" value={dashboard.metrics.totalHotels} icon={Building2} detail={`${dashboard.metrics.activeHotels} Active / ${dashboard.metrics.suspendedHotels} Suspended`} />
                <MetricCard title="Total Revenue" value={formatCurrency(dashboard.metrics.totalRevenue)} icon={WalletCards} tone="emerald" detail="Total earnings from paid invoices" />
                <MetricCard title="Monthly Revenue" value={formatCurrency(dashboard.metrics.monthlyRevenue)} icon={CreditCard} tone="blue" detail="Subscription earnings billed" />
                <MetricCard title="Tenant Orders" value={dashboard.metrics.totalOrders.toLocaleString('en-IN')} icon={Utensils} tone="violet" detail={`${dashboard.metrics.customersServed.toLocaleString('en-IN')} plates served`} />
                <MetricCard title="Live Tables" value={dashboard.metrics.liveActiveTables} icon={Activity} tone="rose" detail="Tables occupied across tenants" />
              </div>

              {/* Chart & AI Insights */}
              <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
                <Panel className="p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black">Revenue Performance</h3>
                      <p className="text-sm text-slate-500">Consolidated platform cashflow yield chart</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-500 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span> Live feed
                    </span>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dashboard.revenueSeries}>
                        <CartesianGrid stroke={chartStroke} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" stroke={tickColor} tickLine={false} axisLine={false} />
                        <YAxis stroke={tickColor} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                        <Tooltip />
                        <Area type="monotone" dataKey="revenue" stroke="#ff6b00" fill="#ff6b0015" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel className="p-5">
                  <h3 className="mb-5 text-lg font-black flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-orange-500" />
                    AI Platform Insights
                  </h3>
                  <div className="space-y-3">
                    {dashboard.aiInsights.map((insight) => (
                      <div key={insight.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                        <p className="text-xs font-black uppercase text-slate-400">{insight.title}</p>
                        <p className="mt-1.5 text-lg font-black text-orange-500">{insight.value}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{insight.detail}</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              {/* Tenant Growth */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Panel className="p-5">
                  <h3 className="mb-5 text-lg font-black">Tenant Expansion Rates</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboard.monthlyGrowth}>
                        <CartesianGrid stroke={chartStroke} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" stroke={tickColor} tickLine={false} axisLine={false} />
                        <YAxis stroke={tickColor} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="hotels" fill="#ff6b00" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel className="p-5">
                  <h3 className="mb-5 text-lg font-black">Platform Infrastructure Status</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(dashboard.system).map(([key, val]) => (
                      <div key={key} className="rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50 dark:bg-white/[0.02]">
                        <p className="text-xs font-black uppercase text-slate-400">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${['Healthy', 'Connected', 'Operational'].includes(val) ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{val}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* SECTION 2: HOTELS */}
          {activeSection === 'hotels' && (
            <Panel className="p-5">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-black">Tenant Registries</h3>
                  <p className="text-sm text-slate-500">Monitor active subscription statuses, cover photography, and QR setups.</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredHotels.map((hotel) => (
                  <div key={hotel.id} className="relative flex flex-col rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden bg-slate-50 dark:bg-white/[0.02] hover:shadow-md transition">
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 relative">
                      {hotel.cover_image ? (
                        <img src={hotel.cover_image} alt={hotel.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-black text-lg">
                          {hotel.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className={`absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-black capitalize ${statusClass(hotel.status)}`}>
                        {hotel.status}
                      </span>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <h4 className="text-lg font-black text-slate-900 dark:text-white truncate">{hotel.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-semibold">Owner: {hotel.owner_name}</p>
                        <p className="text-xs text-slate-400 mt-2 truncate">{hotel.address}</p>
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Active Plan</p>
                          <p className="font-black text-orange-500">{hotel.plan}</p>
                        </div>
                        <div>
                          <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px] text-right">Mobile</p>
                          <p className="font-black text-slate-700 dark:text-slate-300">{hotel.phone}</p>
                        </div>
                      </div>

                      {/* Print Agent Status */}
                      <div className="border-t border-slate-200 dark:border-slate-800 pt-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Print Agent</p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black capitalize ${
                            hotel.agent_status === 'ONLINE' && (new Date() - new Date(hotel.agent_last_seen)) <= 60000
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                              : 'bg-slate-500/10 text-slate-500'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              hotel.agent_status === 'ONLINE' && (new Date() - new Date(hotel.agent_last_seen)) <= 60000
                                ? 'bg-emerald-500 animate-pulse'
                                : 'bg-slate-400'
                            }`}></span>
                            {hotel.agent_status === 'ONLINE' && (new Date() - new Date(hotel.agent_last_seen)) <= 60000
                              ? `ONLINE (v${hotel.agent_version || '1.0.0'})`
                              : 'OFFLINE'}
                          </span>
                        </div>
                        {hotel.agent_printer_status && (
                          <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                            <span>Printers:</span>
                            <span className="font-bold">
                              KOT: {hotel.agent_printer_status.kot || 'OFFLINE'} | Bill: {hotel.agent_printer_status.bill || 'OFFLINE'}
                            </span>
                          </div>
                        )}
                        {hotel.agent_last_seen && (
                          <div className="text-[10px] text-slate-400 text-right">
                            Last seen: {new Date(hotel.agent_last_seen).toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                        <button
                          onClick={() => setSelectedHotel(hotel)}
                          className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 flex justify-center items-center gap-1.5 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </button>
                        <button
                          onClick={() => startEditingHotel(hotel)}
                          className="rounded-xl border border-slate-200 dark:border-white/10 p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition"
                          title="Edit tenant settings"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleHotelStatus(hotel)}
                          className={`rounded-xl px-3 text-xs font-black transition ${
                            hotel.status === 'active' 
                              ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white' 
                              : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                          }`}
                        >
                          {hotel.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          onClick={() => deleteHotel(hotel.id)}
                          className="rounded-xl bg-red-500/15 p-2.5 text-red-500 hover:bg-red-500 hover:text-white transition"
                          title="Decommission tenant"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* SECTION 3: ADMINS */}
          {activeSection === 'admins' && (
            <Panel className="p-5">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-black">Platform &amp; Tenant Administrator Logins</h3>
                  <p className="text-sm text-slate-500 mt-1">View platform administrator logins and status.</p>
                </div>
                <button
                  onClick={handleCleanupOrphanAdmins}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-red-500 hover:bg-red-600 px-4 py-2.5 text-xs font-black uppercase text-white transition shadow-lg shadow-red-500/15"
                >
                  <Trash className="w-4 h-4" />
                  Remove Orphan Admins
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400 dark:border-white/10">
                      <th className="px-4 py-3 font-black">Username</th>
                      <th className="px-4 py-3 font-black">Role</th>
                      <th className="px-4 py-3 font-black">Hotel</th>
                      <th className="px-4 py-3 font-black">Status</th>
                      <th className="px-4 py-3 font-black">Created Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {admins.map((adm) => (
                      <tr key={adm.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-4 text-sm font-bold text-slate-900 dark:text-white">{adm.username}</td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300 font-semibold uppercase">{adm.role}</td>
                        <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{adm.hotel_name || 'N/A (System Super Admin)'}</td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-black capitalize ${statusClass(adm.is_active ? 'active' : 'suspended')}`}>
                            {adm.is_active ? 'active' : 'suspended'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{getAdminCreatedDate(adm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {/* SECTION 4: BILLING */}
          {activeSection === 'billing' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard title="Total Billed Revenue" value={formatCurrency(billing.analytics.totalBilled)} icon={WalletCards} detail="Sum of all paid invoices" tone="emerald" />
                <MetricCard title="Pending Collections" value={formatCurrency(billing.analytics.pendingBilled)} icon={Activity} detail="Sum of all pending invoices" tone="rose" />
                <MetricCard title="Total Invoices" value={billing.analytics.totalInvoices} icon={FileText} detail="Count of all generated invoices" tone="blue" />
              </div>

              {/* Renewal Section */}
              <Panel className="p-5">
                <h3 className="mb-4 text-lg font-black">Active Tenant Renewals</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {billing.activeHotels && billing.activeHotels.map((h) => (
                    <div key={h.id} className="flex items-center justify-between p-4 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/20 rounded-xl">
                      <div>
                        <p className="font-black text-sm">{h.name}</p>
                        <p className="text-xs text-slate-500 font-semibold">Active Plan: {h.plan} (Yearly)</p>
                      </div>
                      <button
                        onClick={() => handleRenewSubscription(h.id)}
                        className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-black uppercase text-white hover:bg-orange-600 transition"
                      >
                        Renew Subscription (+1 Yr)
                      </button>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Payments History */}
              <Panel className="p-5">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-black">Payments Audit Ledger</h3>
                  {billing.payments && billing.payments.some(p => p.hotelDeleted) && (
                    <button
                      onClick={handleCleanupDeletedHistory}
                      className="flex items-center gap-2 rounded-xl bg-red-500 hover:bg-red-600 px-4 py-2.5 text-xs font-black uppercase text-white transition shadow-lg shadow-red-500/15"
                    >
                      <Trash className="w-4 h-4" />
                      Delete All Deleted Hotel History
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {billing.payments && billing.payments.length > 0 ? (
                    billing.payments.map((pay) => (
                      <div key={pay.paymentId} className="border border-slate-200 dark:border-white/10 rounded-xl p-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-mono font-black text-slate-900 dark:text-white">{pay.id}</span>
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-black capitalize ${statusClass(pay.status)}`}>
                                {pay.status}
                              </span>
                              {pay.hotelDeleted && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-xs font-black text-slate-600 dark:text-slate-300">
                                  🗑 Deleted
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                              {pay.hotel || '(Hotel Deleted)'}
                            </p>
                            <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 dark:text-slate-400">
                              <div>
                                <span className="font-semibold">Plan:</span> {pay.hotelPlan || 'N/A'}
                              </div>
                              <div>
                                <span className="font-semibold">Owner:</span> {pay.ownerName || 'N/A'}
                              </div>
                              <div>
                                <span className="font-semibold">Created:</span> {new Date(pay.createdAt).toLocaleDateString('en-IN')}
                              </div>
                              <div>
                                <span className="font-semibold">Due:</span> {pay.dueDate ? new Date(pay.dueDate).toLocaleDateString('en-IN') : 'N/A'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-lg font-black text-orange-500">{formatCurrency(pay.amount)}</p>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">
                              {pay.paidDate ? `Paid: ${new Date(pay.paidDate).toLocaleDateString('en-IN')}` : 'Unpaid'}
                            </p>
                          </div>
                        </div>
                        
                        {/* Payment Controls */}
                        <div className="border-t border-slate-100 dark:border-white/5 pt-3 mt-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            <div className="flex flex-col gap-2">
                              <label className="text-xs font-black uppercase text-slate-400">Amount</label>
                              <input
                                type="number"
                                defaultValue={pay.amount}
                                onBlur={(e) => {
                                  const newAmount = e.target.value;
                                  if (newAmount && newAmount !== pay.amount.toString()) {
                                    handleUpdatePaymentAmount(pay.paymentId, newAmount);
                                  }
                                }}
                                className="text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 outline-none focus:border-orange-500"
                                placeholder="0"
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <label className="text-xs font-black uppercase text-slate-400">Status</label>
                              <select
                                defaultValue={pay.status}
                                onChange={(e) => handleUpdatePaymentStatus(pay.paymentId, e.target.value, pay.amount)}
                                className="text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 outline-none focus:border-orange-500"
                              >
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                              </select>
                            </div>
                            <button
                              onClick={() => handleViewInvoice(pay.id)}
                              className="px-4 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-orange-500 font-black text-xs uppercase hover:bg-orange-50 dark:hover:bg-orange-500/10 transition flex items-center justify-center gap-2"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Invoice
                            </button>
                            {pay.hotelDeleted && (
                              <button
                                onClick={() => {
                                  if (window.confirm('Permanently delete this invoice record? This action cannot be undone.')) {
                                    handleDeletePaymentRecord(pay.paymentId);
                                  }
                                }}
                                className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 font-black text-xs uppercase hover:bg-red-100 dark:hover:bg-red-500/20 transition"
                              >
                                🗑 Delete History
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <p className="text-sm font-semibold">No invoices found</p>
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          )}

          {/* SECTION 5: SETTINGS & BACKUPS */}
          {activeSection === 'settings' && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* SMTP Settings */}
              <Panel className="p-5">
                <h3 className="mb-4 text-lg font-black flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-orange-500" />
                  Branding & SMTP credentials
                </h3>
                <form onSubmit={saveSettings} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-black uppercase text-slate-400">Platform Branding Name</label>
                    <input
                      required
                      value={settings.platformName}
                      onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-black uppercase text-slate-400">Support Email</label>
                      <input
                        required
                        value={settings.supportEmail}
                        onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-black uppercase text-slate-400">Support Contact Number</label>
                      <input
                        required
                        value={settings.supportPhone}
                        onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800 my-4" />
                  <h4 className="text-sm font-black text-orange-500">SMTP Credentials Configuration</h4>

                  <div>
                    <label className="mb-1 block text-xs font-black uppercase text-slate-400">SMTP Mail Server Host</label>
                    <input
                      required
                      value={settings.smtpSettings.host}
                      onChange={(e) => setSettings({ ...settings, smtpSettings: { ...settings.smtpSettings, host: e.target.value } })}
                      className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-800 dark:text-white"
                      placeholder="smtp.mailtrap.io"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-black uppercase text-slate-400">SMTP Port</label>
                      <input
                        required
                        value={settings.smtpSettings.port}
                        onChange={(e) => setSettings({ ...settings, smtpSettings: { ...settings.smtpSettings, port: e.target.value } })}
                        className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-800 dark:text-white"
                        placeholder="2525"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-black uppercase text-slate-400">Secure Protocol</label>
                      <select
                        value={settings.smtpSettings.secure}
                        onChange={(e) => setSettings({ ...settings, smtpSettings: { ...settings.smtpSettings, secure: e.target.value === 'true' } })}
                        className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-800 dark:text-white"
                      >
                        <option value="false">FALSE (TLS/None)</option>
                        <option value="true">TRUE (SSL)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-black uppercase text-slate-400">SMTP User Auth</label>
                      <input
                        required
                        value={settings.smtpSettings.user}
                        onChange={(e) => setSettings({ ...settings, smtpSettings: { ...settings.smtpSettings, user: e.target.value } })}
                        className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-black uppercase text-slate-400">SMTP Password Auth</label>
                      <input
                        type="password"
                        required
                        value={settings.smtpSettings.pass}
                        onChange={(e) => setSettings({ ...settings, smtpSettings: { ...settings.smtpSettings, pass: e.target.value } })}
                        className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-black uppercase text-slate-400">Sender Email Envelope</label>
                    <input
                      required
                      value={settings.smtpSettings.sender_email}
                      onChange={(e) => setSettings({ ...settings, smtpSettings: { ...settings.smtpSettings, sender_email: e.target.value } })}
                      className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-800 dark:text-white"
                      placeholder="noreply@mejwani.com"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-orange-500 py-3 text-sm font-black uppercase text-white hover:bg-orange-600 transition"
                  >
                    Save Platform Parameters
                  </button>
                </form>
              </Panel>

              {/* Backup & Disaster Recovery */}
              <Panel className="p-5">
                <h3 className="mb-3 text-lg font-black flex items-center gap-2">
                  <DatabaseBackup className="w-5 h-5 text-orange-500" />
                  Database Snapshot Backups
                </h3>
                <p className="text-sm text-slate-500 mb-5">
                  Produce JSON physical database dump schemas to back up multi-tenant tables. Store or restore snapshots securely.
                </p>

                <div className="flex gap-3 mb-6">
                  <button
                    disabled={backupLoading}
                    onClick={handleCreateBackup}
                    className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black py-3 text-xs uppercase tracking-wider flex justify-center items-center gap-1.5 transition"
                  >
                    {backupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Generate New DB Backup
                  </button>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-400">Available Database Snapshots</h4>
                  {backups.length === 0 ? (
                    <div className="text-center py-8 border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-white/[0.01]">
                      <Database className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-400 font-semibold">No backup snapshots present in storage directory.</p>
                    </div>
                  ) : (
                    backups.map((bk) => (
                      <div key={bk.id} className="flex items-center justify-between p-3 border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-slate-900/20">
                        <div>
                          <p className="font-mono text-xs font-bold text-slate-900 dark:text-slate-200 truncate max-w-[200px]" title={bk.filename}>
                            {bk.filename}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            Size: {(bk.size / 1024).toFixed(2)} KB | Date: {new Date(bk.createdAt).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRestoreBackup(bk.id)}
                            className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
                          >
                            Restore
                          </button>
                          <a
                            href={`${BACKEND_BASE}/api/super-admin/backups/${bk.id}/download`}
                            download
                            className="bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1"
                          >
                            Get
                          </a>
                          <button
                            onClick={() => handleDeleteBackup(bk.id)}
                            className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </div>
          )}

          {/* SECTION 6: SUPPORT CENTER */}
          {activeSection === 'support' && (
            <SupportCenterPanel />
          )}
        </main>
      </div>

      {/* CREATE HOTEL MODAL */}
      <CreateHotelModal
        isOpen={isCreateHotelModalOpen}
        onClose={() => setIsCreateHotelModalOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* EDIT HOTEL MODAL */}
      {editingHotel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 overflow-y-auto max-h-[90vh]"
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Edit Tenant Information</h2>
              <button onClick={closeEditing} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const formData = new FormData();
                  formData.append('name', editingHotel.name || '');
                  formData.append('owner_name', editingHotel.owner_name || '');
                  formData.append('phone', editingHotel.phone || '');
                  formData.append('address', editingHotel.address || '');
                  formData.append('plan', editingHotel.plan || 'Enterprise');
                  formData.append('status', editingHotel.status || 'active');

                  if (coverImageFile) {
                    formData.append('cover_image', coverImageFile);
                  }
                  if (qrPamphletFile) {
                    formData.append('qr_pamphlet', qrPamphletFile);
                  }

                  await superAdminRequest(`/hotels/${editingHotel.id}`, {
                    method: 'PUT',
                    body: formData
                  });
                  toast.success('Tenant settings saved successfully!');
                  closeEditing();
                  loadData();
                } catch (err) {
                  toast.error(err.message || 'Failed to update tenant');
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Hotel Name</label>
                <input
                  required
                  value={editingHotel.name}
                  onChange={(e) => setEditingHotel({ ...editingHotel, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Owner Name</label>
                  <input
                    required
                    value={editingHotel.owner_name}
                    onChange={(e) => setEditingHotel({ ...editingHotel, owner_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Mobile Number</label>
                  <input
                    required
                    value={editingHotel.phone}
                    onChange={(e) => setEditingHotel({ ...editingHotel, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Address</label>
                <input
                  required
                  value={editingHotel.address}
                  onChange={(e) => setEditingHotel({ ...editingHotel, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300">Status</label>
                <select
                  value={editingHotel.status}
                  onChange={(e) => setEditingHotel({ ...editingHotel, status: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-orange-500 dark:border-slate-700 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Cover Image</label>
                  <div className="relative flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-orange-500">
                    {coverImagePreview ? (
                      <div className="relative w-full h-28">
                        <img src={coverImagePreview} alt="Cover Preview" className="h-full w-full object-cover rounded-lg" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition duration-200 flex items-center justify-center rounded-lg">
                          <span className="text-white text-xs font-bold">Change Image</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-slate-400 mb-1" />
                        <span className="text-xs text-slate-500 font-semibold">Upload Cover JPG/PNG</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => handleEditFileChange(e, 'cover_image')}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">QR Template Background</label>
                  <div className="relative flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-orange-500">
                    {qrPamphletPreview ? (
                      <div className="relative w-full h-28">
                        <img src={qrPamphletPreview} alt="QR Preview" className="h-full w-full object-cover rounded-lg" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition duration-200 flex items-center justify-center rounded-lg">
                          <span className="text-white text-xs font-bold">Change Template</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-slate-400 mb-1" />
                        <span className="text-xs text-slate-500 font-semibold">Upload QR Template</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => handleEditFileChange(e, 'qr_pamphlet')}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeEditing}
                  className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-xl bg-orange-500 px-6 py-2 text-sm font-bold text-white hover:bg-orange-600">
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* SELECTED HOTEL DETAIL DRAWER */}
      {selectedHotel && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            className="w-full max-w-lg bg-white dark:bg-slate-900 h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto"
          >
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                <h3 className="text-xl font-black text-slate-950 dark:text-white">{selectedHotel.name} Registry</h3>
                <button onClick={() => setSelectedHotel(null)} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Cover Image</h4>
                  {selectedHotel.cover_image ? (
                    <img src={selectedHotel.cover_image} alt="Cover Preview" className="h-40 w-full object-cover rounded-xl mt-2 border border-slate-200 dark:border-slate-800" />
                  ) : (
                    <div className="h-40 w-full bg-slate-100 dark:bg-slate-800 rounded-xl mt-2 flex items-center justify-center text-xs text-slate-400 font-bold">
                      No cover image uploaded
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">QR Code Pamphlet</h4>
                  {selectedHotel.qr_pamphlet ? (
                    <img src={selectedHotel.qr_pamphlet} alt="QR Preview" className="h-40 w-full object-contain rounded-xl mt-2 border border-slate-200 dark:border-slate-800 bg-slate-50" />
                  ) : (
                    <div className="h-40 w-full bg-slate-100 dark:bg-slate-800 rounded-xl mt-2 flex items-center justify-center text-xs text-slate-400 font-bold">
                      No QR pamphlet uploaded
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/30">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">Profile Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider">Owner</p>
                      <p className="font-bold text-slate-900 dark:text-white mt-0.5">{selectedHotel.owner_name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider">Subscription Plan</p>
                      <p className="font-bold text-orange-500 mt-0.5">{selectedHotel.plan}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider">Email Address</p>
                      <p className="font-bold text-slate-950 dark:text-white mt-0.5 truncate">{selectedHotel.email}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider">Mobile Contact</p>
                      <p className="font-bold text-slate-950 dark:text-white mt-0.5">{selectedHotel.phone}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400 font-bold uppercase tracking-wider">Mailing Address</p>
                      <p className="font-bold text-slate-950 dark:text-white mt-0.5">{selectedHotel.address}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedHotel(null)}
              className="mt-8 w-full rounded-xl bg-orange-500 py-3 text-sm font-black uppercase text-white hover:bg-orange-600 transition"
            >
              Close Registry Info
            </button>
          </motion.div>
        </div>
      )}

      {/* INVOICE DISPLAY MODAL */}
      {activeInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 overflow-y-auto max-h-[95vh]"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-lg font-black text-slate-950 dark:text-white flex items-center gap-1.5">
                <Printer className="w-5 h-5 text-orange-500" /> Print invoice
              </h3>
              <button onClick={() => setActiveInvoice(null)} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div id="print-area" className="p-6 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 text-slate-950 dark:text-white space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-orange-500">MEJWANI</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase mt-1">Multi-Hotel POS Inc.</p>
                </div>
                <div className="text-right">
                  <h3 className="text-base font-black">INVOICE</h3>
                  <p className="text-xs font-mono font-bold text-slate-500 mt-1">{activeInvoice.invoice_number}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 text-xs border-t border-slate-100 dark:border-slate-800 pt-4">
                <div>
                  <p className="font-bold text-slate-400 uppercase tracking-wider">Billed To:</p>
                  <p className="font-black text-slate-900 dark:text-white mt-1 text-sm">{activeInvoice.hotel_name}</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">{activeInvoice.address}</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">Phone: {activeInvoice.phone}</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">Email: {activeInvoice.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-400 uppercase tracking-wider">Details:</p>
                  <p className="font-bold mt-1 text-slate-700 dark:text-slate-300">Date Paid: {activeInvoice.paid_at ? new Date(activeInvoice.paid_at).toLocaleDateString('en-IN') : 'N/A'}</p>
                  <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">Subscription Plan: {activeInvoice.plan}</p>
                  <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">Cycle: 1 Year Yearly</p>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 uppercase font-black tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="py-2">Item Description</th>
                      <th className="py-2 text-right">Term</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100 dark:border-slate-900 font-bold text-slate-700 dark:text-slate-300">
                      <td className="py-3">Mejwani Restaurant SaaS platform Subscription ({activeInvoice.plan} plan)</td>
                      <td className="py-3 text-right">12 Months</td>
                      <td className="py-3 text-right">{formatCurrency(activeInvoice.amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="w-48 text-right space-y-1.5 font-bold">
                  <div className="flex justify-between">
                    <span className="text-slate-400 uppercase">Subtotal</span>
                    <span className="text-slate-900 dark:text-white">{formatCurrency(activeInvoice.amount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1.5 text-sm font-black text-orange-500">
                    <span className="uppercase">Grand Total</span>
                    <span>{formatCurrency(activeInvoice.amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  const printContents = document.getElementById('print-area').innerHTML;
                  const originalContents = document.body.innerHTML;
                  document.body.innerHTML = printContents;
                  window.print();
                  document.body.innerHTML = originalContents;
                  window.location.reload();
                }}
                className="flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-6 py-2.5 text-sm font-bold text-white transition"
              >
                <Printer className="w-4 h-4" />
                Print Invoice
              </button>
              <button
                onClick={() => setActiveInvoice(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-6 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
