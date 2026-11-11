import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Smartphone, 
  ChevronLeft, 
  ChevronRight,
  ShoppingBag,
  LogOut, 
  Sun, 
  Moon, 
  Utensils, 
  Layers, 
  Table as TableIcon, 
  MenuSquare,
  BookOpen,
  Loader2,
  AlertTriangle,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useTheme } from '../../../shared/context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../../shared/services/apiBase';
import { cacheSystemSettings, formatCaptainDisplayName, getCachedSystemSettings } from '../../../shared/services/systemSettings';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../../utils/dateFormatter';
import socket from '../../../shared/services/socketClient';
import { getCachedMenu, setCachedMenu, getCachedCategories, setCachedCategories } from '../../../shared/services/menuCache';

// Helper: fetch with captain JWT Authorization header attached automatically
const captainFetch = (url, options = {}) => {
  const token = localStorage.getItem('mejwani_captain_jwt') || localStorage.getItem('mejwani_admin_jwt');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  });
};

// Decode JWT payload (base64) to get hotelId claim â€” no library needed
const decodeJwtHotelId = () => {
  try {
    const token = localStorage.getItem('mejwani_captain_jwt') || localStorage.getItem('mejwani_admin_jwt');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.hotelId ? String(payload.hotelId) : null;
  } catch { return null; }
};

// Get effective hotel ID: prefer localStorage, fallback to JWT claim
const getEffectiveHotelId = () => {
  const stored = localStorage.getItem('mejwani_hotel_id');
  if (stored && stored !== '0' && stored !== 'null') return stored;
  const fromJwt = decodeJwtHotelId();
  if (fromJwt) {
    // Persist for future calls
    localStorage.setItem('mejwani_hotel_id', fromJwt);
    return fromJwt;
  }
  return '0';
};


// Component Imports
import SectionSelector from '../components/SectionSelector';
import TableSelector from '../components/TableSelector';
import MenuSelector from '../components/MenuSelector';
import OrderSummaryPanel from '../components/OrderSummaryPanel';
import ShiftTableModal from '../components/ShiftTableModal';

const showPrinterErrorToast = (message, toastId) => {
  toast.error(
    (t) => (
      <div 
        className="flex flex-col gap-1 cursor-pointer"
        onClick={() => {
          toast.dismiss(t.id);
          window.location.href = '/admin/settings?tab=printer';
        }}
      >
        <span className="font-bold text-sm">âŒ {message}</span>
        <span className="text-[10px] underline opacity-90 font-medium">Click here to configure printer settings.</span>
      </div>
    ),
    { 
      id: toastId,
      duration: 8000,
      style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
    }
  );
};

// Enrichment helper for dynamic database sections to ensure premium luxury visual look
const enrichSections = (dbSections) => {
  const gradients = [
    { gradient: 'from-orange-500/10 to-amber-500/5 border-orange-500/30 text-orange-500', bgIcon: 'bg-orange-500/10 text-orange-500', icon: 'Snowflake', desc: 'Main floor air-conditioned zone' },
    { gradient: 'from-indigo-500/10 to-purple-500/5 border-indigo-500/30 text-indigo-500', bgIcon: 'bg-indigo-500/10 text-indigo-500', icon: 'CloudSun', desc: 'Cinematic rooftop sky dining' },
    { gradient: 'from-emerald-500/10 to-teal-500/5 border-emerald-500/30 text-emerald-500', bgIcon: 'bg-emerald-500/10 text-emerald-500', icon: 'Wind', desc: 'Premium luxury lounge & cocktails' },
    { gradient: 'from-pink-500/10 to-rose-500/5 border-pink-500/30 text-rose-500', bgIcon: 'bg-pink-500/10 text-rose-500', icon: 'Users', desc: 'Quiet dining hall for family get-togethers' },
  ];

  return dbSections.map((sec, idx) => {
    const style = gradients[idx % gradients.length];
    return {
      id: sec.id,
      name: sec.section_name,
      gradient: style.gradient,
      bgIcon: style.bgIcon,
      icon: style.icon,
      desc: style.desc
    };
  });
};



export default function CaptainPanel() {
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [voiceAnnouncementEnabled, setVoiceAnnouncementEnabled] = useState(
    () => localStorage.getItem('mejwani_voice_announcement_enabled') !== 'false'
  );

  const toggleVoiceAnnouncement = () => {
    const newVal = !voiceAnnouncementEnabled;
    setVoiceAnnouncementEnabled(newVal);
    localStorage.setItem('mejwani_voice_announcement_enabled', String(newVal));
    toast.success(`Voice Announcement ${newVal ? 'Enabled' : 'Disabled'}`, {
      id: 'voice-toggle-toast',
      style: {
        borderRadius: '12px',
        background: '#0f172a',
        color: '#ffffff',
      }
    });
  };

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'mejwani_voice_announcement_enabled') {
        setVoiceAnnouncementEnabled(e.newValue !== 'false');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Resolve hotel context â€” prefer localStorage (set at login or at RoleSelection slug load).
  // Also support ?slug=hotel-ghata as fallback for direct navigation.
  const resolveHotelId = () => {
    return getEffectiveHotelId();
  };

  // Re-read hotelId on every render so it picks up late-set values from RoleSelection.
  const hotelId = resolveHotelId();
  console.debug('[CaptainPanel] Using hotelId:', hotelId);

  // Dynamic Floorplan & Menu States
  const [sections, setSections] = useState([]);
  const [rawTables, setRawTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);

  // Active Captain Requests â€” fetched separately, displayed ONLY in Captain Panel
  const [captainRequests, setCaptainRequests] = useState([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Refs for concurrent fetch guards
  const isFetchingSectionsTablesRef = useRef(false);
  const isFetchingOrdersRef = useRef(false);
  const isFetchingMenuRef = useRef(false);
  const isFetchingSettingsRef = useRef(false);
  const isFetchingRequestsRef = useRef(false);

  // Derive tables using useMemo
  const tables = useMemo(() => {
    return rawTables.map(t => {
      const tableActiveOrder = orders.find(o => o.table_id === t.id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
      const hasActiveRequest = captainRequests.some(r => r.table_id === t.id && (r.status === 'CAPTAIN_REQUESTED' || r.status === 'PENDING'));
      
      let displayStatus = t.status;
      if (tableActiveOrder) {
        displayStatus = tableActiveOrder.status === 'BILL_PENDING' ? 'bill_pending' : 'occupied';
      } else if (hasActiveRequest && t.status === 'available') {
        displayStatus = 'customer_present';
      }

      return {
        id: t.id,
        number: t.table_number,
        name: t.table_name,
        capacity: t.seating_capacity,
        section: t.section_name,   // must match enriched section.name
        section_display_order: t.section_display_order,
        status: displayStatus,
        occupied_at: t.occupied_at || (tableActiveOrder ? tableActiveOrder.created_at : null),
        currentOrder: tableActiveOrder ? {
          id: tableActiveOrder.kot_number,
          dbId: tableActiveOrder.id,
          itemsCount: tableActiveOrder.items?.length || 0,
          total: parseFloat(tableActiveOrder.grand_total),
          time: new Date(tableActiveOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: tableActiveOrder.status,
          kotPrinted: tableActiveOrder.kotPrinted,
          kotPrintedAt: tableActiveOrder.kotPrintedAt,
          createdAt: tableActiveOrder.createdAt,
          created_at: tableActiveOrder.created_at,
          billCreatedAt: tableActiveOrder.billCreatedAt,
          updatedAt: tableActiveOrder.updatedAt,
          updated_at: tableActiveOrder.updated_at
        } : null,
        reserveTime: t.status === 'reserved' ? '08:45 PM' : null
      };
    });
  }, [rawTables, orders, captainRequests]);

  const [activeSection, setActiveSection] = useState(null); // null = Step 1
  const [activeTable, setActiveTable] = useState(null);   // null = Step 2 (if activeSection is set)
  
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);
  
  // Cart & Orders Management
  const [cart, setCart] = useState([]);
  const [printerConfig, setPrinterConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(`mejwani_printer_config_${resolveHotelId()}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [orderNumber, setOrderNumber] = useState(107);
  const [drafts, setDrafts] = useState([]);
  
  const getCaptainName = () => {
    try {
      const storedUser = localStorage.getItem('mejwani_captain_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && parsed.fullName) return parsed.fullName;
      }
    } catch (e) {
      console.error('Error parsing captain user:', e);
    }
    return getCachedSystemSettings().captain.name;
  };

  const [captainName, setCaptainName] = useState(getCaptainName);
  const captainDisplayName = formatCaptainDisplayName(captainName);
  const [currentTime, setCurrentTime] = useState('');

  // UI Control States
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [activeTime, setActiveTime] = useState('');
  const [toasts, setToasts] = useState([]);

  // Fetch sections and tables from database
  const fetchSectionsAndTables = useCallback(async (showLoadingSpinner = false) => {
    isFetchingSectionsTablesRef.current = true;
    if (showLoadingSpinner) setLoading(true);
    const startTime = performance.now();
    try {
      const currentHotelId = getEffectiveHotelId();
      const [secRes, tabRes] = await Promise.all([
        captainFetch(`${API_BASE}/sections?hotelId=${currentHotelId}&t=${Date.now()}`),
        captainFetch(`${API_BASE}/tables?hotelId=${currentHotelId}&t=${Date.now()}`)
      ]);
      const secData = await secRes.json();
      const tabData = await tabRes.json();
      if (secData.success && tabData.success) {
        const enriched = enrichSections(secData.data || []);
        setSections(enriched);
        setRawTables(tabData.data || []);
        setError(null);
      } else {
        throw new Error('API returned failure status for sections/tables.');
      }
    } catch (err) {
      console.error('[CaptainPanel] fetchSectionsAndTables error:', err);
      setError('Cannot establish database link. Ensure backend server is running.');
    } finally {
      isFetchingSectionsTablesRef.current = false;
      if (showLoadingSpinner) setLoading(false);
      if (import.meta.env.DEV) {
        console.log(`[Timing] Sections & Tables fetched in ${(performance.now() - startTime).toFixed(2)}ms`);
      }
    }
  }, []);

  // Fetch orders from database
  const fetchOrders = useCallback(async (showLoadingSpinner = false) => {
    isFetchingOrdersRef.current = true;
    if (showLoadingSpinner) setLoading(true);
    const startTime = performance.now();
    try {
      const currentHotelId = getEffectiveHotelId();
      const ordRes = await captainFetch(`${API_BASE}/orders?hotelId=${currentHotelId}&t=${Date.now()}`);
      const ordData = await ordRes.json();
      if (ordData.success) {
        setOrders(ordData.data || []);
      }
    } catch (err) {
      console.error('[CaptainPanel] fetchOrders error:', err);
    } finally {
      isFetchingOrdersRef.current = false;
      if (showLoadingSpinner) setLoading(false);
      if (import.meta.env.DEV) {
        console.log(`[Timing] Orders fetched in ${(performance.now() - startTime).toFixed(2)}ms`);
      }
    }
  }, []);

  // Fetch menu items and categories from database (utilizes caches)
  const fetchMenuAndCategories = useCallback(async (showLoadingSpinner = false) => {
    if (isFetchingMenuRef.current) return;
    isFetchingMenuRef.current = true;
    if (showLoadingSpinner) setLoading(true);
    const startTime = performance.now();
    try {
      const currentHotelId = getEffectiveHotelId();
      const menuPromise = getCachedMenu()
        ? Promise.resolve({ json: () => Promise.resolve({ success: true, data: getCachedMenu() }) })
        : captainFetch(`${API_BASE}/menu?hotelId=${currentHotelId}`).then(async r => {
            const clone = r.clone();
            const json = await clone.json();
            if (json.success) setCachedMenu(json.data);
            return r;
          });

      const catPromise = getCachedCategories()
        ? Promise.resolve({ json: () => Promise.resolve({ success: true, data: getCachedCategories() }) })
        : captainFetch(`${API_BASE}/menu-categories?hotelId=${currentHotelId}`).then(async r => {
            const clone = r.clone();
            const json = await clone.json();
            if (json.success) setCachedCategories(json.data);
            return r;
          });

      const [menuRes, catRes] = await Promise.all([menuPromise, catPromise]);
      const menuData = await menuRes.json();
      const catData = await catRes.json();
      if (menuData.success) {
        setMenuItems(menuData.data || []);
      }
      if (catData.success) {
        setCategories(catData.data.filter(c => c.is_active).map(c => c.name));
      }
    } catch (err) {
      console.error('[CaptainPanel] fetchMenuAndCategories error:', err);
    } finally {
      isFetchingMenuRef.current = false;
      if (showLoadingSpinner) setLoading(false);
      if (import.meta.env.DEV) {
        console.log(`[Timing] Menu & Categories fetched in ${(performance.now() - startTime).toFixed(2)}ms`);
      }
    }
  }, []);

  // Fetch public system settings
  const fetchSystemSettings = useCallback(async (showLoadingSpinner = false) => {
    if (isFetchingSettingsRef.current) return;
    isFetchingSettingsRef.current = true;
    if (showLoadingSpinner) setLoading(true);
    const startTime = performance.now();
    try {
      const currentHotelId = getEffectiveHotelId();
      const settingsRes = await captainFetch(`${API_BASE}/admin/system-settings/public?hotelId=${currentHotelId}`);
      const settingsData = await settingsRes.json();
      if (settingsRes.ok && settingsData.success && settingsData.data) {
        setCaptainName(cacheSystemSettings(settingsData.data).captain.name);
      }
    } catch (err) {
      console.error('[CaptainPanel] fetchSystemSettings error:', err);
    } finally {
      isFetchingSettingsRef.current = false;
      if (showLoadingSpinner) setLoading(false);
      if (import.meta.env.DEV) {
        console.log(`[Timing] Public system settings fetched in ${(performance.now() - startTime).toFixed(2)}ms`);
      }
    }
  }, []);

  // Fetch active captain requests
  const fetchCaptainRequests = useCallback(async (showLoadingSpinner = false) => {
    if (isFetchingRequestsRef.current) return;
    isFetchingRequestsRef.current = true;
    if (showLoadingSpinner) setLoading(true);
    const startTime = performance.now();
    try {
      const currentHotelId = getEffectiveHotelId();
      const captainReqRes = await captainFetch(`${API_BASE}/customer/active-captain-requests?hotelId=${currentHotelId}`);
      const captainReqData = await captainReqRes.json();
      if (captainReqData.success) {
        setCaptainRequests(captainReqData.data || []);
      }
    } catch (err) {
      console.error('[CaptainPanel] fetchCaptainRequests error:', err);
    } finally {
      isFetchingRequestsRef.current = false;
      if (showLoadingSpinner) setLoading(false);
      if (import.meta.env.DEV) {
        console.log(`[Timing] Active captain requests fetched in ${(performance.now() - startTime).toFixed(2)}ms`);
      }
    }
  }, []);

  // Main fetch floorplan function (Promise.all concurrent fetcher)
  const fetchFloorplan = useCallback(async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setLoading(true);
    setError(null);
    const startTime = performance.now();
    try {
      await Promise.all([
        fetchSectionsAndTables(false),
        fetchOrders(false),
        fetchMenuAndCategories(false),
        fetchSystemSettings(false),
        fetchCaptainRequests(false)
      ]);
    } catch (err) {
      console.error('[CaptainPanel] fetchFloorplan error:', err);
      setError('Cannot establish database link. Ensure backend server is running.');
    } finally {
      if (showLoadingSpinner) setLoading(false);
      if (import.meta.env.DEV) {
        console.log(`[Timing] fetchFloorplan (all) completed in ${(performance.now() - startTime).toFixed(2)}ms`);
      }
    }
  }, [fetchSectionsAndTables, fetchOrders, fetchMenuAndCategories, fetchSystemSettings, fetchCaptainRequests]);

  // fetchCaptainRequests and handleAcknowledge removed (handled by standard notifications workflow)

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      fetchFloorplan();
    }, 0);
    
    // Polling interval fallback changed to 30 seconds
    const interval = setInterval(() => {
      fetchFloorplan(false);
    }, 30000);
    
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [fetchFloorplan]);

  // Live Time Updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const joinRoom = () => {
      const storedHotelId = hotelId || localStorage.getItem('mejwani_hotel_id');
      if (storedHotelId && storedHotelId !== '0') {
        console.log(`[SOCKET] CaptainPanel emitting join-hotel-room: ${storedHotelId}:captain`);
        socket.emit('join-hotel-room', `${storedHotelId}:captain`);
      }
    };

    socket.on('connect', joinRoom);

    if (socket.connected) {
      joinRoom();
    }

    return () => {
      socket.off('connect', joinRoom);
    };
  }, [hotelId]);

  useEffect(() => {
    if (!hotelId || hotelId === '0') return;

    const fetchPrinterConfig = async () => {
      try {
        const token = localStorage.getItem('mejwani_captain_jwt') || localStorage.getItem('mejwani_admin_jwt');
        const resp = await captainFetch(`${API_BASE}/print-agent/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        if (resp.ok && data && data.success && data.agent) {
          const config = typeof data.agent.printer_config === 'string'
            ? JSON.parse(data.agent.printer_config)
            : data.agent.printer_config;
          const resolvedConfig = config || {};
          setPrinterConfig(resolvedConfig);
          localStorage.setItem(`mejwani_printer_config_${hotelId}`, JSON.stringify(resolvedConfig));
        } else {
          setPrinterConfig({});
          localStorage.setItem(`mejwani_printer_config_${hotelId}`, JSON.stringify({}));
        }
      } catch (err) {
        console.error('Failed to fetch printer configuration', err);
      }
    };
    fetchPrinterConfig();
  }, [hotelId]);

  useEffect(() => {
    const debounceTimers = {
      sync: null
    };

    const triggerDebounced = (key, fn) => {
      if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
      debounceTimers[key] = setTimeout(fn, 50);
    };

    const handleSync = () => {
      triggerDebounced('sync', () => {
        fetchSectionsAndTables();
        fetchOrders();
        fetchCaptainRequests();
      });
    };

    socket.on('new-order', handleSync);
    socket.on('table-released', handleSync);
    socket.on('visit-expired', handleSync);
    socket.on('table-activity', handleSync);
    socket.on('order-updated', handleSync);
    socket.on('table-updated', handleSync);
    socket.on('bill-created', handleSync);
    socket.on('order-cancelled', handleSync);

    // NOTE: customer_request and captain_only_request toast + voice alerts are handled
    // globally by NotificationContext (mounts once, survives navigation).
    // We listen to the window CustomEvent here ONLY to:
    //   1. Do the optimistic setCaptainRequests update (orange badge on table card)
    //   2. Trigger debounced fetchCaptainRequests() for DB sync
    const handleCustomerRequestData = (e) => {
      const request = e.detail;
      if (!request || !request.tableId) return;
      setCaptainRequests(prev => {
        const alreadyExists = prev.some(r => r.table_id === request.tableId);
        if (alreadyExists) return prev;
        return [...prev, {
          table_id: request.tableId,
          status: 'CAPTAIN_REQUESTED',
          created_at: request.timestamp || new Date().toISOString(),
          request_type: request.requestType
        }];
      });
      // Trigger debounced fetch of active requests to sync DB state
      handleSync();
    };
    window.addEventListener('mejwani:customer-request', handleCustomerRequestData);

    const handleFirstKotPrinted = (data) => {
      if (data && data.tableId) {
        setRawTables(prev => prev.map(t => 
          t.id === data.tableId ? { ...t, status: 'occupied' } : t
        ));
        setCaptainRequests(prev => prev.filter(r => r.table_id !== data.tableId));
      }
    };

    const handleBillCompleted = (data) => {
      if (data && data.tableId) {
        setRawTables(prev => prev.map(t => 
          t.id === data.tableId ? { ...t, status: 'available' } : t
        ));
        setCaptainRequests(prev => prev.filter(r => r.table_id !== data.tableId));
      }
    };

    const handleCaptainAcknowledged = (data) => {
      handleSync();
    };

    const handleKotPrintAcknowledged = (data) => {
      console.log('[TRACE] Frontend received kot_print_acknowledged');
      console.log('[DEBUG] Socket kot_print_acknowledged received:', data);
      if (!data || !data.jobId) return;
      const jobIdStr = String(data.jobId);
      if (typeof window.mejwani_clear_ack_timeout === 'function') {
        window.mejwani_clear_ack_timeout(data.jobId);
      }
      window.mejwani_toasted_jobs = window.mejwani_toasted_jobs || new Set();
      if (window.mejwani_toasted_jobs.has(jobIdStr)) {
        console.log('[DEBUG] KOT print already toasted, skipping duplicate:', jobIdStr);
        return;
      }
      console.log('[DEBUG ORDER] KOT Socket ACK received');
      console.log('[DEBUG ORDER] KOT Play notification sound');
      console.log('[DEBUG ORDER] KOT toast.success() called');
      toast.success(`âœ… KOT printed successfully for ${data.tableName}.`, {
        id: `kot-success-${data.jobId}`,
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
      console.log('[DEBUG ORDER] KOT window.mejwani_toasted_jobs.add(jobId) called');
      window.mejwani_toasted_jobs.add(jobIdStr);
      console.log('[DEBUG] Toast displayed: KOT for ' + data.tableName);
      console.log('[KOT] Toast displayed');
    };

    socket.on("first_kot_printed", handleFirstKotPrinted);
    socket.on("kot_print_acknowledged", handleKotPrintAcknowledged);
    socket.on("bill_completed", handleBillCompleted);
    socket.on("captain-acknowledged", handleCaptainAcknowledged);

    return () => {
      if (debounceTimers.sync) clearTimeout(debounceTimers.sync);
      socket.off('new-order', handleSync);
      socket.off('table-released', handleSync);
      socket.off('visit-expired', handleSync);
      socket.off('table-activity', handleSync);
      socket.off('order-updated', handleSync);
      socket.off('table-updated', handleSync);
      socket.off('bill-created', handleSync);
      socket.off('order-cancelled', handleSync);
      socket.off("first_kot_printed", handleFirstKotPrinted);
      socket.off("kot_print_acknowledged", handleKotPrintAcknowledged);
      socket.off("bill_completed", handleBillCompleted);
      socket.off("captain-acknowledged", handleCaptainAcknowledged);
      window.removeEventListener('mejwani:customer-request', handleCustomerRequestData);
    };
  }, [fetchSectionsAndTables, fetchOrders, fetchCaptainRequests, hotelId]);

  // Stepper helper to calculate active step
  const getActiveStep = () => {
    if (!activeSection) return 1;
    if (activeSection && !activeTable) return 2;
    return 3;
  };

  const handleRejectRequest = async (table) => {
    try {
      // 1. Instantly update the UI states in the local screen
      setCaptainRequests(prev => prev.filter(r => r.table_id !== table.id));
      setRawTables(prev => prev.map(t => {
        if (t.id === table.id) {
          return { ...t, status: 'available', occupied_at: null };
        }
        return t;
      }));

      // 2. Call the backend API to reject/clear the request
      const currentHotelId = hotelId || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = currentHotelId ? `?hotelId=${currentHotelId}` : '';
      const res = await captainFetch(`${API_BASE}/customer/reject-captain-request${hotelParam}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tableId: table.id })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to reject request on backend.');
      }
      addToast("Request rejected", "success");
    } catch (err) {
      console.error("Failed to reject captain request:", err);
      addToast(`Error: ${err.message}`, "error");
      // Re-fetch in case of failure to align state
      fetchCaptainRequests();
      fetchSectionsAndTables();
    }
  };

  // Toast notifier helper
  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Handle Cart Operations
  const handleAddToCart = (item, portion = null) => {
    let idKey = item.id;
    let displayName = item.name;
    let resolvedPrice = item.price;
    let portionType = item.portion_type || 'FULL';

    if (item.pricing_type === 'HALF_FULL') {
      const selectedPortion = portion || item.portion_type || 'FULL';
      portionType = selectedPortion === 'HALF' ? 'HALF' : 'FULL';
      idKey = `${item.id || item.menu_item_id}_${portionType}`;
      resolvedPrice = portionType === 'HALF' ? item.half_price : item.full_price;
      const baseName = item.name.replace(/\s*\(Half\)$|\s*\(Full\)$/, '');
      displayName = baseName + (portionType === 'HALF' ? ' (Half)' : ' (Full)');
    } else if (item.pricing_type !== undefined) {
      portionType = 'FULL';
      idKey = item.id || item.menu_item_id;
      resolvedPrice = item.price;
    } else {
      idKey = item.id;
      portionType = item.portion_type || 'FULL';
      resolvedPrice = item.price;
    }

    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.id === idKey);
      if (existing) {
        return prevCart.map((i) => (i.id === idKey ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prevCart, { 
        ...item, 
        id: idKey, 
        menu_item_id: item.menu_item_id || item.id, 
        name: displayName, 
        price: resolvedPrice, 
        portion_type: portionType, 
        qty: 1, 
        note: '' 
      }];
    });
  };

  const handleRemoveFromCart = (itemId) => {
    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.id === itemId);
      if (!existing) return prevCart;
      if (existing.qty === 1) {
        return prevCart.filter((i) => i.id !== itemId);
      }
      return prevCart.map((i) => (i.id === itemId ? { ...i, qty: i.qty - 1 } : i));
    });
  };

  const handleUpdateCartItemNote = (itemId, note) => {
    setCart((prevCart) =>
      prevCart.map((i) => (i.id === itemId ? { ...i, note } : i))
    );
  };

  const handleClearOrder = async () => {
    if (!activeTable) return;

    const activeOrder = activeTable.currentOrder;
    const isDbOccupied = activeTable.status === 'occupied' || activeTable.status === 'bill_pending';

    if (window.confirm('Clear running order and release Table back to Available? This will cancel the order in the kitchen.')) {
      setCart([]);
      
      if (isDbOccupied && activeOrder && activeOrder.dbId) {
        try {
          const response = await captainFetch(`${API_BASE}/bills/${activeOrder.dbId}/cancel?hotelId=${hotelId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hotelId: parseInt(hotelId) })
          });
          const data = await response.json();
          if (response.ok && data.success) {
            addToast(`Table ${activeTable.number} order cancelled and table released`, 'success');
            await fetchFloorplan(false);
            setActiveTable(null);
          } else {
            addToast(data.message || 'Failed to cancel order', 'warning');
          }
        } catch (err) {
          console.error('Error cancelling order:', err);
          addToast('Database connection error cancelling order', 'warning');
        }
      } else if (isDbOccupied) {
        try {
          await captainFetch(`${API_BASE}/tables/${activeTable.id}?hotelId=${hotelId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'available', hotelId: parseInt(hotelId) })
          });
          addToast(`Table ${activeTable.number} released to Available`, 'success');
          await fetchFloorplan(false);
          setActiveTable(null);
        } catch (err) {
          console.error('Error releasing table:', err);
          addToast('Database connection error releasing table', 'warning');
        }
      } else {
        addToast('Order cancelled and wiped clean.', 'warning');
        setActiveTable(null);
      }
    }
  };

  // Selectors Toggles
  const handleSelectSection = (secName) => {
    setActiveSection(secName);
    setActiveTable(null);
  };

  const handleSelectTable = (table) => {
    setActiveTable(table);
    
    // Find dynamic running order for this table from the live orders state
    const runningOrder = orders.find(o => o.table_id === table.id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
    if (runningOrder && runningOrder.items) {
      // Silently load the running order into cart â€” no toast needed
      setCart(runningOrder.items.map(item => {
        const pType = item.portion_type || 'FULL';
        const isHalf = pType === 'HALF';
        const suffix = isHalf ? '_HALF' : '_FULL';
        return {
          id: `${item.menu_item_id}${suffix}`,
          menu_item_id: item.menu_item_id,
          name: item.name,
          marathiName: item.marathiName,
          price: parseFloat(item.price),
          qty: item.quantity,
          portion_type: pType,
          note: item.note || ''
        };
      }));
    } else {
      setCart([]);
    }
  };

  // Actions
  const handleSaveDraft = () => {
    if (cart.length === 0) return;
    const draftId = `DRF-${Date.now().toString().slice(-4)}`;
    const newDraft = {
      id: draftId,
      tableNumber: activeTable?.number || 'N/A',
      section: activeSection,
      items: [...cart],
      time: currentTime,
      total: cart.reduce((sum, i) => sum + (i.price * i.qty), 0)
    };
    setDrafts((prev) => [newDraft, ...prev]);
    // Draft saved silently â€” no toast to avoid noise during order taking
  };

  const printKOT = async (orderNum, orderCart, tableObj, sectionName, captainName) => {
    const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
    const currentHotelId = adminUser.hotel_id || hotelId || localStorage.getItem('mejwani_hotel_id') || '';
    const tableName = tableObj ? (tableObj.table_code || tableObj.table_name || tableObj.number) : 'COUNTER';
    const systemSettings = getCachedSystemSettings();

    const kotData = {
      title: systemSettings?.printing?.kotTitle || 'KITCHEN ORDER TICKET',
      hotelName: 'MEJWANI',
      tableName: tableName,
      sectionName: sectionName || '',
      captainName: captainName || 'Captain',
      orderId: `ORD-${orderNum}`,
      dateTime: formatDateTimeDDMMYYYY(new Date()),
      items: orderCart.map(item => ({ name: item.name || item.itemName, quantity: item.qty || item.quantity || 1, note: item.note }))
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
      console.log(`[DEBUG] onPrintJobAcknowledgedLocal called in CaptainPanel for jobId: ${jobId}, tableName: ${tableName}.`);
      const jobIdStr = String(jobId);
      window.mejwani_toasted_jobs = window.mejwani_toasted_jobs || new Set();
      if (!window.mejwani_toasted_jobs.has(jobIdStr)) {
        window.mejwani_toasted_jobs.add(jobIdStr);
        toast.success(`âœ… KOT printed successfully for ${tableName || 'Table'}.`, {
          id: `kot-success-${jobId}`,
          style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });
      }
    };

    const handleBrowserPrint = () => {
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (!printWindow) {
        toast.error("Please allow popups to print KOT slips!");
        return;
      }

      const dateStr = formatDateDDMMYYYY(new Date());
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

      let itemsHtml = '';
      orderCart.forEach(item => {
        itemsHtml += `
          <tr>
            <td style="width: 75%; text-align: left; font-weight: bold; font-size: 12px; padding: 4px 0; word-wrap: break-word; vertical-align: top;">${(item.name || '').toUpperCase()}</td>
            <td style="width: 25%; text-align: right; font-size: 14px; font-weight: 900; padding: 4px 0; vertical-align: top; padding-right: 5px;">${item.qty || item.quantity}</td>
          </tr>
        `;
      });

      printWindow.document.write(`
<html>
<head>
  <title>KOT - Table ${tableName}</title>
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
        <td style="text-align: left; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">Table: ${tableName} (${sectionName || ''})</td>
        <td style="text-align: right; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">Capt: ${captainName || 'Captain'}</td>
      </tr>
      <tr>
        <td style="text-align: left; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">Date: ${dateStr}</td>
        <td style="text-align: right; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">Time: ${timeStr}</td>
      </tr>
      <tr>
        <td colspan="2" style="text-align: left; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">KOT: ORD-${orderNum}</td>
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

    try {
      console.log('[KOT] Auto printing started');
      // 1. Queue job on cloud first to get the unique Job ID (approx 50ms)
      const response = await captainFetch(`${API_BASE}/orders/print-kot?hotelId=${currentHotelId}`, {
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

      // Skip direct local agent printing on Captain mobile devices.
      // The KOT is printed by the Admin print agent in the kitchen or direct TCP print from server.
      onPrintJobAcknowledgedLocal(jobId, tableName);

    } catch (err) {
      console.error('Direct print failed', err);
      toast.error('KOT print request failed. Please check network connection.');
    }
  };

  const handleConfirmOrder = async (options = {}) => {
    const isSilent = !!options.silent;
    if (cart.length === 0 || !activeTable) return;
    if (isSubmittingOrder) return;


    if (!isSilent && printerConfig && !printerConfig.kot) {
      // Warn about printer but DON'T block — order still goes to kitchen
      showPrinterErrorToast('KOT Printer is not configured.', 'kot-print-error');
    }



    setIsSubmittingOrder(true);
    const now = new Date();
    setActiveTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    
    // Create live order payload matching dynamic orders structure
    const orderPayload = {
      tableId: activeTable.id,
      captainName: captainDisplayName,
      printKot: !isSilent,
      saveOnly: isSilent,
      items: cart.map(item => ({
        menu_item_id: item.menu_item_id || item.id,
        portion_type: item.portion_type || 'FULL',
        name: item.name,
        marathiName: item.marathiName,
        quantity: item.qty,
        price: item.price,
        note: item.note
      })),
      subtotal: cart.reduce((sum, item) => sum + (item.price * item.qty), 0)
    };

    try {
      const response = await captainFetch(`${API_BASE}/orders?hotelId=${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderPayload, hotelId: parseInt(hotelId) })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(isSilent ? 'Order Saved Successfully' : 'Order Sent to Kitchen', 'success');
        const orderData = data.data || data.order || {};
        const kotNum = orderData.kot_number || orderData.id || '';
        const cleanOrderNumber = kotNum ? parseInt(String(kotNum).replace(/\D/g, '') || '0') : 0;
        if (cleanOrderNumber) setOrderNumber(cleanOrderNumber);
        setCart([]);
        setActiveTable(null);

        // Fetch update in background without blocking UI transition
        fetchSectionsAndTables(false).catch(() => {});
        fetchOrders(false).catch(() => {});
      } else {
        if (!isSilent && data.code === 'PRINTER_NOT_CONFIGURED') {
          showPrinterErrorToast(data.message || 'KOT Printer is not configured.', 'kot-print-error');
        } else {
          addToast(data.message || 'Failed to initialize KOT order.', 'warning');
        }
      }
    } catch (err) {
      console.error('POST KOT error:', err);
      addToast('Cannot connect to server to post order.', 'warning');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleSaveAndSettle = async () => {
    if (cart.length === 0 || !activeTable) return;
    if (isSubmittingOrder) return;

    setIsSubmittingOrder(true);
    const now = new Date();
    setActiveTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    // Determine order type
    let orderType = 'DINING';
    if (activeTable.section && activeTable.section.toUpperCase() === 'PARCEL') {
      orderType = 'PARCEL';
    }

    const orderPayload = {
      tableId: activeTable.id,
      items: cart.map(item => ({
        menu_item_id: item.menu_item_id || item.id,
        portion_type: item.portion_type || 'FULL',
        name: item.name,
        marathiName: item.marathiName,
        quantity: item.qty,
        price: item.price,
        note: item.note
      })),
      orderType
    };

    try {
      // 1. Create order as direct-bill (places it in BILL_PENDING status without printing KOT)
      const response = await captainFetch(`${API_BASE}/orders/direct-bill?hotelId=${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderPayload, hotelId: parseInt(hotelId) })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        const orderId = data.data.id;
        
        // 2. Automatically complete payment and release the table/parcel slot
        const payResponse = await captainFetch(`${API_BASE}/orders/pay/${orderId}?hotelId=${hotelId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hotelId: parseInt(hotelId) })
        });
        const payData = await payResponse.json();
        
        if (payResponse.ok && payData.success) {
          addToast('Order Recorded & Settled Successfully!', 'success');
          setCart([]);
          setActiveTable(null);
          await fetchFloorplan(false);
        } else {
          addToast(payData.message || 'Failed to settle order payment.', 'warning');
        }
      } else {
        addToast(data.message || 'Failed to create order record.', 'warning');
      }
    } catch (err) {
      console.error('Save & Settle error:', err);
      addToast('Cannot connect to server to save & settle order.', 'warning');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Trigger when they click "Request Final Bill" from Captain order summary
  const handleRequestBill = async () => {
    if (!activeTable) return;
    try {
      const response = await captainFetch(`${API_BASE}/orders/request-bill/${activeTable.id}?hotelId=${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelId: parseInt(hotelId) })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        addToast(`Final bill requested for Table ${activeTable.number}! Cashier notified.`, 'success');
        setCart([]);
        setActiveTable(null);
        await fetchFloorplan(false);
      } else {
        addToast(data.message || 'Failed to request bill.', 'warning');
      }
    } catch (err) {
      console.error('Request bill error:', err);
      addToast('Cannot connect to server to request bill.', 'warning');
    }
  };

  const handleShiftTableConfirm = async (targetTable) => {
    if (!activeTable || !targetTable) return;
    try {
      const response = await captainFetch(`${API_BASE}/orders/transfer?hotelId=${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTableId: activeTable.id,
          targetTableId: targetTable.id,
          hotelId: parseInt(hotelId)
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(`Successfully shifted Table ${activeTable.number} to Table ${targetTable.number}`, {
          style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });
        
        setIsShiftModalOpen(false);
        setIsMobileCartOpen(false);
        setCart([]);
        setActiveTable(null);
        await fetchFloorplan(false);
      } else {
        toast.error(data.message || 'Failed to shift table');
      }
    } catch (err) {
      console.error('Shift table error:', err);
      toast.error('Network error. Failed to shift table.');
    }
  };

  // Premium loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] dark:bg-[#070707] flex flex-col items-center justify-center gap-4 transition-colors">
        <Loader2 className="w-12 h-12 animate-spin text-[#ff6b00]" />
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/20 animate-pulse">Syncing live restaurant floorplan...</p>
      </div>
    );
  }

  // Premium offline retry screen
  if (error) {
    return (
      <div className="min-h-screen bg-[#f6f8fb] dark:bg-[#070707] flex flex-col items-center justify-center p-8 transition-colors">
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-[2.5rem] p-8 text-center max-w-md w-full space-y-4">
          <AlertTriangle className="w-12 h-12 mx-auto text-red-500 animate-bounce" />
          <h4 className="text-sm font-black uppercase tracking-widest">POS Sync Offline</h4>
          <p className="text-[11px] font-bold leading-relaxed">{error}</p>
          <button onClick={() => fetchFloorplan(true)} className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer">Retry database link</button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#f6f8fb] dark:bg-[#070707] transition-colors duration-300 font-sans flex flex-col">
      
      <div className="fixed top-5 right-5 z-[200] flex flex-col gap-3 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className={`p-4 rounded-2xl shadow-xl flex items-center gap-3 border pointer-events-auto ${
                t.type === 'success' 
                  ? 'bg-emerald-500 text-white border-emerald-600' 
                  : t.type === 'warning' 
                  ? 'bg-rose-500 text-white border-rose-600'
                  : t.type === 'info' 
                  ? 'bg-[#ff6b00] text-white border-orange-600'
                  : 'bg-slate-800 text-white border-slate-700'
              }`}
            >
              <Smartphone className="w-5 h-5 flex-shrink-0" />
              <span className="text-xs font-black uppercase tracking-wider">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* TOP POS HEADER */}
      <header className="bg-white dark:bg-[#0c0c0c] border-b border-slate-200 dark:border-white/5 py-1.5 sm:py-2.5 px-3.5 sm:px-5 flex justify-between items-center sticky top-0 z-40 shadow-sm dark:shadow-none transition-colors">
        <div className="flex items-center gap-2 sm:gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-1.5 sm:gap-2 cursor-pointer" onClick={() => navigate('/admin')}>
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/10">
              <Utensils className="text-white w-4 sm:w-4.5 h-4 sm:h-4.5" />
            </div>
            <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-800 dark:text-white leading-none">
              Mejwani
            </h1>
          </div>

          <div className="hidden md:block w-px h-5 bg-slate-200 dark:bg-white/10" />

          {/* Captain Badging */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-white/40">
              Session: <span className="text-primary font-black">{captainDisplayName}</span>
            </span>
          </div>
        </div>

        {/* Live Stepper Tracker Navigation */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-50 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/5">
          <button
            onClick={() => { setActiveSection(null); setActiveTable(null); }}
            className={`px-3 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              getActiveStep() === 1
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-500 hover:text-primary'
            }`}
          >
            <Layers className="w-3 h-3" /> 1. Area
          </button>
          <span className="text-slate-300 dark:text-white/10 text-xs">/</span>
          <button
            disabled={!activeSection}
            onClick={() => setActiveTable(null)}
            className={`px-3 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              getActiveStep() === 2
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-500 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <TableIcon className="w-3 h-3" /> 2. Table
          </button>
          <span className="text-slate-300 dark:text-white/10 text-xs">/</span>
          <button
            disabled={!activeTable}
            className={`px-3 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-all ${
              getActiveStep() === 3
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-500 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <MenuSquare className="w-3 h-3" /> 3. Menu
          </button>
        </div>

        {/* Right Hand Meta Buttons */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          
          {/* Active Digital Clock */}
          <div className="text-right hidden sm:block mr-1 font-mono">
            <p className="text-xs font-black text-slate-800 dark:text-white">{currentTime || '00:00:00 AM'}</p>
          </div>

          {/* Real-time Sync Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider border transition-all select-none ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 animate-pulse'
            }`}
            title={isConnected ? 'Live Sync Active' : 'Live Sync Reconnecting...'}
          >
            <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full shrink-0 ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="hidden xs:inline">{isConnected ? 'Live' : 'Offline'}</span>
          </div>

          {/* Theme Toggler */}
          <button 
            onClick={toggleTheme}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/55 hover:text-primary transition-all"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {/* Voice Announcement Toggler */}
          <button 
            onClick={toggleVoiceAnnouncement}
            className={`p-1.5 sm:p-2 rounded-lg border transition-all ${
              voiceAnnouncementEnabled 
                ? 'bg-orange-500/10 border-orange-500/20 text-orange-500 hover:bg-orange-500/20' 
                : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-white/30 hover:text-primary'
            }`}
            title="Toggle Voice Announcements"
          >
            {voiceAnnouncementEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Logout/Back to Admin */}
          <button 
            onClick={() => {
              localStorage.removeItem('mejwani_captain_jwt');
              localStorage.removeItem('mejwani_captain_user');
              const isAdmin = localStorage.getItem('mejwani_admin_token') === 'true' && 
                              !!localStorage.getItem('mejwani_admin_jwt');
              if (isAdmin) {
                navigate('/admin');
              } else {
                const hotelSlug = localStorage.getItem('mejwani_hotel_slug');
                if (hotelSlug) {
                  navigate(`/${hotelSlug}/select-panel`);
                } else {
                  navigate('/select-panel');
                }
              }
            }}
            className="p-1.5 sm:p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center gap-1 font-black text-[9px] sm:text-[10px] uppercase tracking-wider"
          >
            <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>

        </div>
      </header>

      {/* SUBNAV / BACK WORKFLOW */}
      <div className="bg-white/50 dark:bg-white/1 border-b border-slate-200 dark:border-white/5 py-2 sm:py-3 px-3.5 sm:px-6 flex justify-between items-center transition-colors">
        <div className="flex items-center gap-2">
          {getActiveStep() > 1 && (
            <button
              onClick={() => {
                if (getActiveStep() === 3) {
                  setActiveTable(null);
                } else if (getActiveStep() === 2) {
                  setActiveSection(null);
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-black uppercase text-slate-600 dark:text-white/60 hover:text-primary transition-all active:scale-95"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}

          {/* Location breadcrumb */}
          <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-white/40">
            <span className="hidden xs:inline">Home</span>
            <span className="hidden xs:inline">/</span>
            <span className={activeSection ? '' : 'text-primary'}>POS</span>
            {activeSection && (
              <>
                <span>/</span>
                <span className={`truncate max-w-[80px] sm:max-w-none ${activeTable ? '' : 'text-primary'}`}>{activeSection}</span>
              </>
            )}
            {activeTable && (
              <>
                <span>/</span>
                <span className="text-primary font-black whitespace-nowrap">T-{activeTable.number}</span>
              </>
            )}
          </div>
        </div>

        {/* Drafts count badge */}
        {drafts.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-black uppercase text-amber-500">
            <BookOpen className="w-3.5 h-3.5" /> {drafts.length} Saved Drafts
          </div>
        )}
      </div>

      {/* CORE WORKSPACE VIEW */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-[1700px] xl:w-[94%] mx-auto w-full">
        {/* Active captain calls section removed (using standard notifications page only) */}

        <AnimatePresence mode="wait">
          
          {/* STEP 1: Area/Section selection */}
          {getActiveStep() === 1 && (
            <motion.div
              key="step-sections"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.25 }}
            >
              <SectionSelector
                sections={sections}
                activeSection={activeSection}
                onSelect={handleSelectSection}
                tables={tables}
              />
            </motion.div>
          )}

          {/* STEP 2: Table Selection */}
          {getActiveStep() === 2 && (
            <motion.div
              key="step-tables"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <TableSelector
                tables={tables}
                activeSection={activeSection}
                onSelectTable={handleSelectTable}
                activeTable={activeTable}
                captainRequests={captainRequests}
                onRejectRequest={handleRejectRequest}
              />
            </motion.div>
          )}

          {/* STEP 3: Taking Menu Order (Split layout) */}
          {getActiveStep() === 3 && (
            <motion.div
              key="step-menu"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"
            >
              {/* Menu food items section */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
                      <MenuSquare className="w-7 h-7 text-primary" /> Browse Menu
                    </h2>
                    <p className="text-sm text-slate-400 dark:text-white/20 font-bold mt-1.5">
                      Add delicious recipes to the running list for Table {activeTable?.number}
                    </p>
                  </div>
                </div>

                <MenuSelector
                  menuItems={menuItems}
                  categories={categories}
                  cart={cart}
                  onAddToCart={handleAddToCart}
                  onRemoveFromCart={handleRemoveFromCart}
                  onUpdateCartItemNote={handleUpdateCartItemNote}
                />
              </div>

              {/* Order checkout bill panel (Desktop) */}
              <div className="hidden lg:block lg:col-span-1 lg:sticky lg:top-24 h-[calc(100vh-8.5rem)]">
                <OrderSummaryPanel
                  cart={cart}
                  activeTable={activeTable}
                  activeSection={activeSection}
                  orderNumber={`ORD-${orderNumber}`}
                  captainName={captainDisplayName}
                  onAddToCart={handleAddToCart}
                  onRemoveFromCart={handleRemoveFromCart}
                  onClearOrder={handleClearOrder}
                  onSaveDraft={handleSaveDraft}
                  onConfirmOrder={handleConfirmOrder}
                  onRequestBill={handleRequestBill}
                  activeTime={currentTime}
                  onShiftTable={() => setIsShiftModalOpen(true)}
                />
              </div>

              {/* FLOATING MOBILE CART BAR */}
              {cart.length > 0 && (
                <div className="lg:hidden fixed bottom-6 left-4 right-4 z-40">
                  <button
                    onClick={() => setIsMobileCartOpen(true)}
                    className="w-full bg-gradient-to-r from-orange-500 to-[#ff6b00] active:scale-95 transition-all text-white py-4 px-6 rounded-2xl flex items-center justify-between shadow-xl shadow-orange-500/20 font-black text-sm uppercase tracking-wider"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/25 flex items-center justify-center">
                        <ShoppingBag className="w-4.5 h-4.5 text-white" />
                      </div>
                      <span>
                        {cart.reduce((sum, item) => sum + item.qty, 0)} Items | â‚¹
                        {cart.reduce((sum, item) => sum + (item.price * item.qty), 0).toFixed(0)}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 font-black text-xs">
                      View Order <ChevronRight className="w-4 h-4" />
                    </span>
                  </button>
                </div>
              )}

              {/* MOBILE ORDER SHEET DRAWER */}
              <AnimatePresence>
                {isMobileCartOpen && (
                  <>
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.5 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsMobileCartOpen(false)}
                      className="lg:hidden fixed inset-0 bg-black z-50"
                    />
                    {/* Drawer Sheet */}
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                      className="lg:hidden fixed bottom-0 left-0 right-0 h-[88vh] bg-white dark:bg-[#0c0c0c] rounded-t-[2.5rem] z-50 shadow-2xl flex flex-col overflow-hidden"
                    >
                      {/* Handle and Close header */}
                      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/2 relative">
                        <div className="w-12 h-1.5 bg-slate-300 dark:bg-white/10 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2.5" />
                        <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2 mt-2">
                          <ShoppingBag className="w-5 h-5 text-primary" /> Active Ticket
                        </h3>
                        <button
                          onClick={() => setIsMobileCartOpen(false)}
                          className="px-4 py-2 rounded-xl bg-slate-200/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-black uppercase text-slate-600 dark:text-white/60 hover:text-primary transition-all mt-2"
                        >
                          Close
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 pb-20">
                        <OrderSummaryPanel
                          cart={cart}
                          activeTable={activeTable}
                          activeSection={activeSection}
                          orderNumber={`ORD-${orderNumber}`}
                          captainName={captainDisplayName}
                          onAddToCart={handleAddToCart}
                          onRemoveFromCart={handleRemoveFromCart}
                          onClearOrder={() => {
                            handleClearOrder();
                            setIsMobileCartOpen(false);
                          }}
                          onSaveDraft={() => {
                            handleSaveDraft();
                            setIsMobileCartOpen(false);
                          }}
                          onConfirmOrder={(options) => {
                            handleConfirmOrder(options);
                            setIsMobileCartOpen(false);
                          }}
                          onRequestBill={() => {
                            handleRequestBill();
                            setIsMobileCartOpen(false);
                          }}
                          activeTime={currentTime}
                          onShiftTable={() => setIsShiftModalOpen(true)}
                        />
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Shift Table Modal */}
      <ShiftTableModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        sourceTable={activeTable}
        tables={tables}
        onConfirm={handleShiftTableConfirm}
      />

      {/* Simulated Footer */}
      <footer className="mt-auto py-2.5 sm:py-5 bg-white dark:bg-[#0c0c0c] border-t border-slate-200 dark:border-white/5 text-center text-[9px] sm:text-xs font-bold text-slate-400 dark:text-white/20 transition-colors">
        <p className="hidden xs:block">Â© 2026 Mejwani Hotel Systems Â· Captain Handheld POS v2.4.1</p>
        <p className="xs:hidden">Mejwani Handheld POS v2.4.1</p>
      </footer>
    </div>
  );
}
