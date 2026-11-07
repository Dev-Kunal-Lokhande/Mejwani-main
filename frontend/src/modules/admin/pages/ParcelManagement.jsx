import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Save,
  Printer,
  X,
  Clock,
  ShoppingBag,
  Plus,
  Minus,
  Search,
  ChevronLeft,
  PackagePlus,
  Trash2,
  Edit2,
  Layers,
  CheckCircle2,
  XCircle,
  Package
} from 'lucide-react';
import AdminLayout from '../../../shared/layouts/AdminLayout';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../../utils/dateFormatter';
import socket from '../../../shared/services/socketClient';
import { getAudioContext } from '../../../shared/services/audioHelper';
import { API_BASE, authorizedFetch } from '../../../shared/services/apiBase';
import { formatCurrencyWithSettings, getCachedSystemSettings } from '../../../shared/services/systemSettings';
import { getCachedMenu, setCachedMenu } from '../../../shared/services/menuCache';
import axios from 'axios';
import DiningTimer from '../../../shared/components/DiningTimer';

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
        <span className="font-bold text-sm">❌ {message}</span>
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

export default function ParcelManagement() {
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [printerConfig, setPrinterConfig] = useState(() => {
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const saved = localStorage.getItem(`mejwani_printer_config_${hotelId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('CASH');
  const [error, setError] = useState(null);
  const menuSearchInputRef = useRef(null);
  const [systemSettings, setSystemSettings] = useState(getCachedSystemSettings());
  const formatCurrency = (value = 0, decimals = 2) => formatCurrencyWithSettings(value, systemSettings, decimals);
  
  const cgstRate = Number(systemSettings.billing.cgst) || 0;
  const sgstRate = Number(systemSettings.billing.sgst) || 0;
  const serviceChargeRate = Number(systemSettings.billing.serviceCharge) || 0;

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

  const onPrintJobAcknowledgedLocal = (jobId, tableName, jobType) => {
    console.log(`[DEBUG] onPrintJobAcknowledgedLocal called in ParcelManagement for jobId: ${jobId}, tableName: ${tableName}, jobType: ${jobType}.`);
    const jobIdStr = String(jobId);
    window.mejwani_toasted_jobs = window.mejwani_toasted_jobs || new Set();
    if (!window.mejwani_toasted_jobs.has(jobIdStr)) {
      window.mejwani_toasted_jobs.add(jobIdStr);
      if (jobType === 'KOT') {
        toast.success(`✅ KOT printed successfully for ${tableName || 'Table'}.`, {
          id: `kot-success-${jobId}`,
          style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });
      } else {
        const tName = tableName || 'Table';
        const message = tName.startsWith('Parcel')
          ? `✅ Bill printed successfully for ${tName}.`
          : `✅ Bill printed successfully for Table ${tName}.`;
        toast.success(message, {
          id: `bill-success-${jobId}`,
          style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });
      }
    }
  };

  const isFetchingTablesRef = useRef(false);
  const isFetchingOrdersRef = useRef(false);

  const [selectedTable, setSelectedTable] = useState(null);
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [isCreatingDirectOrder, setIsCreatingDirectOrder] = useState(false);
  const [isSubmittingDirectOrder, setIsSubmittingDirectOrder] = useState(false);

  // Cart / Menu Selector States
  const [additionalItems, setAdditionalItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuSearchTerm, setMenuSearchTerm] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState('All');
  const [menuTypeFilter, setMenuTypeFilter] = useState('All');
  const [isSubmittingAdditional, setIsSubmittingAdditional] = useState(false);
  const [menuSearchHighlightedIndex, setMenuSearchHighlightedIndex] = useState(0);

  // Table Management States
  const [isManageTablesOpen, setIsManageTablesOpen] = useState(false);
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states for adding/editing tables
  const [formTableNumber, setFormTableNumber] = useState('');
  const [formTableName, setFormTableName] = useState('');
  const [formDisplayOrder, setFormDisplayOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);

  // Filter only PARCEL tables and active orders
  const parcelTables = useMemo(() => {
    return tables
      .filter(t => t.section_name?.toUpperCase() === 'PARCEL')
      .sort((a, b) => {
        const orderA = a.display_order !== undefined ? Number(a.display_order) : 0;
        const orderB = b.display_order !== undefined ? Number(b.display_order) : 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.table_number.localeCompare(b.table_number, undefined, { numeric: true });
      });
  }, [tables]);

  const selectedTableLive = useMemo(() => {
    if (!selectedTable) return null;
    return tables.find(t => t.id === selectedTable.id) || null;
  }, [tables, selectedTable]);

  const activeOrderForSelectedTable = useMemo(() => {
    if (!selectedTableLive) return null;
    return orders.find(o => o.table_id === selectedTableLive.id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED') || null;
  }, [orders, selectedTableLive]);
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [menuViewMode, setMenuViewMode] = useState('table');

  useEffect(() => {
    if (!selectedTableLive) {
      setCheckoutOrder(null);
      return;
    }

    if (activeOrderForSelectedTable) {
      setCheckoutOrder(activeOrderForSelectedTable);
    } else {
      if (checkoutOrder && checkoutOrder.table_id === selectedTableLive.id) {
        const latestVersion = orders.find(o => o.id === checkoutOrder.id);
        if (latestVersion) {
          setCheckoutOrder(latestVersion);
          return;
        }
      }
      setCheckoutOrder(null);
    }
  }, [selectedTableLive, orders, activeOrderForSelectedTable]);

  const fetchTables = useCallback(async () => {
    if (isFetchingTablesRef.current) return;
    isFetchingTablesRef.current = true;
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
      const tablesRes = await fetch(`${API_BASE}/tables${hotelParam}`);
      const tablesData = await tablesRes.json();
      if (tablesData.success) {
        setTables(tablesData.data || []);
      }
    } catch (err) {
      console.error('[Parcel] Fetch tables issue:', err);
    } finally {
      isFetchingTablesRef.current = false;
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    if (isFetchingOrdersRef.current) return;
    isFetchingOrdersRef.current = true;
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
      const ordersRes = await fetch(`${API_BASE}/orders${hotelParam}`);
      const ordersData = await ordersRes.json();
      if (ordersData.success) {
        const parcelOrders = (ordersData.data || []).filter(o => o.order_type === 'PARCEL');
        setOrders(parcelOrders);
      }
    } catch (err) {
      console.error('[Parcel] Fetch orders issue:', err);
    } finally {
      isFetchingOrdersRef.current = false;
      setLoading(false);
    }
  }, []);

  const syncOperationalState = useCallback(() => {
    fetchTables();
    fetchOrders();
  }, [fetchTables, fetchOrders]);

  const playAlertChime = () => {
    const soundEnabled = localStorage.getItem('mejwani_voice_announcement_enabled') !== 'false';
    if (!soundEnabled) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
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
    } catch (e) {
      console.warn('Play chime failed:', e);
    }
  };

  useEffect(() => {
    const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
    const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
    if (!hotelId || hotelId === '0') return;

    const fetchPrinterConfig = async () => {
      try {
        const token = localStorage.getItem('mejwani_admin_jwt');
        const resp = await fetch(`${API_BASE}/print-agent/status`, {
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
  }, []);

  useEffect(() => {
    const handleSettingsUpdated = () => setSystemSettings(getCachedSystemSettings());
    window.addEventListener('mejwani-settings-updated', handleSettingsUpdated);
    return () => window.removeEventListener('mejwani-settings-updated', handleSettingsUpdated);
  }, []);

  useEffect(() => {
    syncOperationalState();

    const joinRoom = () => {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      if (hotelId) {
        console.log(`[SOCKET] ParcelManagement emitting join-hotel-room: ${hotelId}:admin`);
        socket.emit('join-hotel-room', `${hotelId}:admin`);
      }
    };

    socket.on('connect', joinRoom);

    if (socket.connected) {
      joinRoom();
    }

    const onTableUpdated = () => fetchTables();
    const onOrderUpdated = () => fetchOrders();
    const onTableReleased = () => { fetchTables(); fetchOrders(); };
    const onBillCompleted = () => { fetchTables(); fetchOrders(); };
    const onNewOrder = () => { fetchOrders(); playAlertChime(); };

    socket.on('table-updated', onTableUpdated);
    socket.on('order-updated', onOrderUpdated);
    socket.on('table-released', onTableReleased);
    socket.on('bill_completed', onBillCompleted);
    socket.on('new-order', onNewOrder);

    const handleKotPrintAcknowledged = (data) => {
      console.log('[TRACE] Frontend received kot_print_acknowledged');
      console.log('[DEBUG] Socket kot_print_acknowledged received in ParcelManagement:', data);
      if (!data || !data.jobId) {
        console.log('[DEBUG] handleKotPrintAcknowledged failed: missing data or jobId:', data);
        return;
      }
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
      toast.success(`✅ KOT printed successfully for ${data.tableName}.`, {
        id: `kot-success-${data.jobId}`,
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
      console.log('[DEBUG ORDER] KOT window.mejwani_toasted_jobs.add(jobId) called');
      window.mejwani_toasted_jobs.add(jobIdStr);
      console.log('[DEBUG] Toast displayed: KOT for ' + data.tableName);
      console.log('[KOT] Toast displayed');
    };

    const handleBillPrintAcknowledged = (data) => {
      console.log('[TRACE] Frontend received bill_print_acknowledged');
      console.log('[DEBUG] Socket bill_print_acknowledged received:', data);
      if (!data || !data.jobId) return;
      const jobIdStr = String(data.jobId);
      if (typeof window.mejwani_clear_ack_timeout === 'function') {
        window.mejwani_clear_ack_timeout(data.jobId);
      }
      window.mejwani_toasted_jobs = window.mejwani_toasted_jobs || new Set();
      if (window.mejwani_toasted_jobs.has(jobIdStr)) {
        console.log('[DEBUG] Bill print already toasted, skipping duplicate:', jobIdStr);
        return;
      }
      console.log('[DEBUG ORDER] Bill Socket ACK received');
      console.log('[DEBUG ORDER] Bill Play notification sound');
      console.log('[DEBUG ORDER] Bill toast.success() called');
      const tableName = data.tableName || 'Table';
      const message = tableName.startsWith('Parcel')
        ? `✅ Bill printed successfully for ${tableName}.`
        : `✅ Bill printed successfully for Table ${tableName}.`;
      toast.success(message, {
        id: `bill-success-${data.jobId}`,
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
      console.log('[DEBUG ORDER] Bill window.mejwani_toasted_jobs.add(jobId) called');
      window.mejwani_toasted_jobs.add(jobIdStr);
      console.log('[DEBUG] Toast displayed: Bill for Table ' + tableName);
    };

    socket.on('kot_print_acknowledged', handleKotPrintAcknowledged);
    socket.on('bill_print_acknowledged', handleBillPrintAcknowledged);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('table-updated', onTableUpdated);
      socket.off('order-updated', onOrderUpdated);
      socket.off('table-released', onTableReleased);
      socket.off('bill_completed', onBillCompleted);
      socket.off('new-order', onNewOrder);
      socket.off('kot_print_acknowledged', handleKotPrintAcknowledged);
      socket.off('bill_print_acknowledged', handleBillPrintAcknowledged);
    };
  }, [syncOperationalState, fetchTables, fetchOrders]);

  // Load menu items
  const loadMenuItems = async () => {
    const cached = getCachedMenu();
    if (cached && cached.length > 0) {
      setMenuItems(cached);
      return;
    }
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
      const res = await axios.get(`${API_BASE}/menu${hotelParam}`);
      if (res.data.success) {
        setCachedMenu(res.data.data);
        setMenuItems(res.data.data || []);
      }
    } catch (err) {
      console.error('[Parcel] Failed to load menu items:', err);
    }
  };

  const menuCategories = useMemo(() => {
    const unique = new Set(menuItems.map(item => item.category || 'Uncategorized'));
    return ['All', ...Array.from(unique)];
  }, [menuItems]);

  const expandedMenuItems = useMemo(() => {
    const list = [];
    menuItems.forEach((item) => {
      if (item.pricing_type === 'HALF_FULL') {
        // Half
        list.push({
          ...item,
          _id: `${item._id || item.id}_HALF`,
          id: `${item._id || item.id}_HALF`,
          originalId: item._id || item.id,
          name: `${item.name} (Half)`,
          marathiName: item.marathiName ? `${item.marathiName} (हाफ)` : null,
          price: item.half_price,
          shortcode: item.shortcode ? `${item.shortcode}H` : null,
          code: item.code ? `${item.code}H` : null,
          pricing_type: 'SINGLE',
          portion_type: 'HALF'
        });
        // Full
        list.push({
          ...item,
          _id: `${item._id || item.id}_FULL`,
          id: `${item._id || item.id}_FULL`,
          originalId: item._id || item.id,
          name: `${item.name} (Full)`,
          marathiName: item.marathiName ? `${item.marathiName} (फुल)` : null,
          price: item.full_price,
          shortcode: item.shortcode ? `${item.shortcode}F` : null,
          code: item.code ? `${item.code}F` : null,
          pricing_type: 'SINGLE',
          portion_type: 'FULL'
        });
      } else {
        list.push({
          ...item,
          originalId: item._id || item.id,
          portion_type: 'FULL'
        });
      }
    });
    return list;
  }, [menuItems]);

  const filteredMenuItems = useMemo(() => {
    return expandedMenuItems.filter(item => {
      const matchesSearch = [item.name, item.marathiName, item.code, item.shortcode, item.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(menuSearchTerm.toLowerCase());
      const matchesCategory = menuCategoryFilter === 'All' || item.category === menuCategoryFilter;
      const matchesType = menuTypeFilter === 'All' || item.type === menuTypeFilter;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [expandedMenuItems, menuSearchTerm, menuCategoryFilter, menuTypeFilter]);

  useEffect(() => {
    setMenuSearchHighlightedIndex(0);
  }, [menuSearchTerm, filteredMenuItems.length]);

  const openDirectOrder = () => {
    setAdditionalItems([]);
    setMenuSearchTerm('');
    setMenuCategoryFilter('All');
    setMenuTypeFilter('All');
    loadMenuItems();
    setIsCreatingDirectOrder(true);
  };

  const closeDirectOrder = () => {
    setIsCreatingDirectOrder(false);
    setAdditionalItems([]);
    setMenuSearchTerm('');
  };

  const openAddMoreItems = () => {
    if (activeOrderForSelectedTable && activeOrderForSelectedTable.items) {
      setAdditionalItems(activeOrderForSelectedTable.items.map(item => ({
        cartId: `${item.menu_item_id}_${item.portion_type || 'FULL'}`,
        menuItemId: item.menu_item_id,
        portionType: item.portion_type || 'FULL',
        name: item.name,
        marathiName: item.marathiName || '',
        quantity: item.quantity,
        price: parseFloat(item.price),
        note: item.note || ''
      })));
    } else {
      setAdditionalItems([]);
    }
    setMenuSearchTerm('');
    setMenuCategoryFilter('All');
    setMenuTypeFilter('All');
    loadMenuItems();
    setIsAddingItems(true);
  };

  const closeAddMoreItems = () => {
    setIsAddingItems(false);
    setAdditionalItems([]);
    setMenuSearchTerm('');
  };

  const prevSelectedTableIdRef = useRef(null);
  useEffect(() => {
    if (!selectedTable) {
      prevSelectedTableIdRef.current = null;
      return;
    }
    if (selectedTable.id === prevSelectedTableIdRef.current) return;
    prevSelectedTableIdRef.current = selectedTable.id;

    const hasActiveOrder = orders.some(
      o => o.table_id === selectedTable.id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
    );
    if (!hasActiveOrder) {
      openDirectOrder();
    } else {
      setIsCreatingDirectOrder(false);
    }
  }, [selectedTable?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isAddingItems || isCreatingDirectOrder) {
      const timer = setTimeout(() => {
        menuSearchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAddingItems, isCreatingDirectOrder]);

  const handleAddAdditionalItem = (menuItem, portion = null) => {
    const isHalfFull = menuItem.pricing_type === 'HALF_FULL';
    const portionType = isHalfFull 
      ? (portion === 'HALF' ? 'HALF' : 'FULL') 
      : (menuItem.portion_type || menuItem.portionType || 'FULL');
    const baseId = menuItem.originalId || menuItem._id || menuItem.id;
    const cartId = `${baseId}_${portionType}`;
    
    let resolvedPrice = parseFloat(menuItem.price || 0);
    let displayName = menuItem.name;
    if (isHalfFull) {
      resolvedPrice = portionType === 'HALF' ? parseFloat(menuItem.half_price) : parseFloat(menuItem.full_price);
      displayName = menuItem.name + (portionType === 'HALF' ? ' (Half)' : ' (Full)');
    }

    setAdditionalItems(prev => {
      const existing = prev.find(i => i.cartId === cartId);
      if (existing) {
        return prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        cartId,
        menuItemId: baseId,
        portionType,
        name: displayName,
        marathiName: menuItem.marathiName || '',
        quantity: 1,
        price: resolvedPrice
      }];
    });

    // Keep search focused for fast POS style typing
    setTimeout(() => {
      menuSearchInputRef.current?.focus();
    }, 10);
  };

  const handleMenuSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMenuSearchHighlightedIndex((prev) => (filteredMenuItems.length > 0 ? (prev + 1) % filteredMenuItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMenuSearchHighlightedIndex((prev) => (filteredMenuItems.length > 0 ? (prev - 1 + filteredMenuItems.length) % filteredMenuItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredMenuItems.length > 0) {
        const itemToSelect = filteredMenuItems[menuSearchHighlightedIndex] || filteredMenuItems[0];
        if (itemToSelect && itemToSelect.isAvailable) {
          handleAddAdditionalItem(itemToSelect);
          setMenuSearchTerm('');
          setTimeout(() => {
            menuSearchInputRef.current?.focus();
          }, 10);
        }
      }
    }
  };

  const handleAdditionalQuantity = (cartId, delta) => {
    setAdditionalItems(prev =>
      prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity + delta } : i)
        .filter(i => i.quantity > 0)
    );
  };

  const additionalSubtotal = useMemo(() =>
    additionalItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [additionalItems]);

  const handleSendToKot = async ({ printKot = true } = {}) => {
    console.log('[PARCEL] Generate KOT clicked (Create Order)');
    if (printKot && printerConfig && !printerConfig.kot) {
      showPrinterErrorToast('KOT Printer is not configured.', 'kot-print-error');
      return;
    }
    if (additionalItems.length === 0) {
      toast.error('Add at least one item to send to KOT.', { style: { borderRadius: '10px', background: '#333', color: '#fff' } });
      return;
    }
    if (!selectedTable) return;

    setIsSubmittingDirectOrder(true);
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';

      const payload = {
        tableId: selectedTable.id,
        printKot: !!printKot,
        saveOnly: !printKot,
        items: additionalItems.map(item => ({
          menu_item_id: item.menuItemId,
          portion_type: item.portionType || 'FULL',
          name: item.name,
          marathiName: item.marathiName || '',
          quantity: item.quantity,
          price: item.price,
          note: item.note || ''
        })),
        orderType: 'PARCEL'
      };

      const res = await axios.post(`${API_BASE}/orders${hotelParam}`, payload);
      if (res.data.success) {
        const createdOrder = res.data.data;
        console.log('[PARCEL] API success. ORDER_ID:', createdOrder.id);
        if (printKot) {
          printKOT(createdOrder).catch(err => console.error('[Background Print] Failed:', err));
        }

        setIsCreatingDirectOrder(false);
        setAdditionalItems([]);
        setCheckoutOrder(createdOrder);
        fetchTables();
        fetchOrders();
      } else {
        if (res.data.code === 'PRINTER_NOT_CONFIGURED') {
          showPrinterErrorToast(res.data.message || 'KOT Printer is not configured.', 'kot-print-error');
          return;
        }
        throw new Error(res.data.message || 'Failed to send KOT');
      }
    } catch (err) {
      console.error('[Parcel] handleSendToKot failed:', err);
      const errMsg = err.response?.data?.message || err.message;
      const errCode = err.response?.data?.code;
      if (errCode === 'PRINTER_NOT_CONFIGURED') {
        showPrinterErrorToast(errMsg, 'kot-print-error');
      } else {
        toast.error(`❌ ${errMsg}`, {
          style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
        });
      }
    } finally {
      setIsSubmittingDirectOrder(false);
    }
  };

  const handleSubmitAdditionalItems = async ({ printKot = true } = {}) => {
    console.log('[PARCEL] Generate KOT clicked (Append Items)');
    if (printKot && printerConfig && !printerConfig.kot) {
      showPrinterErrorToast('KOT Printer is not configured.', 'kot-print-error');
      return;
    }
    if (!activeOrderForSelectedTable || !selectedTableLive) return;

    if (additionalItems.length === 0) {
      toast.error('Cart cannot be empty. Please keep at least one item or cancel the bill.', {
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
      return;
    }

    const itemsToSubmit = [];
    const originalItems = activeOrderForSelectedTable.items || [];

    originalItems.forEach(orig => {
      const origPortion = orig.portion_type || 'FULL';
      const cartItem = additionalItems.find(i => i.menuItemId === orig.menu_item_id && i.portionType === origPortion);
      if (cartItem) {
        const delta = cartItem.quantity - orig.quantity;
        const noteChanged = (cartItem.note || '') !== (orig.note || '');
        if (delta !== 0 || noteChanged) {
          itemsToSubmit.push({
            menu_item_id: orig.menu_item_id,
            portion_type: origPortion,
            name: orig.name,
            marathiName: orig.marathiName || '',
            quantity: delta,
            price: orig.price,
            note: cartItem.note || ''
          });
        }
      } else {
        itemsToSubmit.push({
          menu_item_id: orig.menu_item_id,
          portion_type: origPortion,
          name: orig.name,
          marathiName: orig.marathiName || '',
          quantity: -orig.quantity,
          price: orig.price,
          note: orig.note
        });
      }
    });

    additionalItems.forEach(cartItem => {
      const isNew = !originalItems.some(orig => orig.menu_item_id === cartItem.menuItemId && (orig.portion_type || 'FULL') === cartItem.portionType);
      if (isNew) {
        itemsToSubmit.push({
          menu_item_id: cartItem.menuItemId,
          portion_type: cartItem.portionType || 'FULL',
          name: cartItem.name,
          marathiName: cartItem.marathiName || '',
          quantity: cartItem.quantity,
          price: cartItem.price,
          note: cartItem.note || ''
        });
      }
    });

    if (itemsToSubmit.length === 0) {
      toast.error('No changes made to the bill.', { style: { borderRadius: '10px', background: '#333', color: '#fff' } });
      return;
    }

    setIsSubmittingAdditional(true);
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';

      const payload = {
        items: itemsToSubmit,
        printKot: !!printKot
      };

      const orderId = activeOrderForSelectedTable.id;
      console.log('Parcel Send to KOT clicked (Append Items)');
      const res = await axios.put(
        `${API_BASE}/orders/${orderId}/append-items${hotelParam}`,
        payload
      );

      if (res.data.success) {
        const updatedOrderData = res.data.data;
        const deltaItems = itemsToSubmit
          .filter(item => item.quantity > 0)
          .map(item => ({
            name: item.name,
            marathiName: item.marathiName,
            quantity: item.quantity,
            note: item.note
          }));

        if (deltaItems.length > 0) {
          const orderToPrint = {
            ...updatedOrderData,
            table_name: selectedTableLive.table_name || selectedTableLive.table_number || 'COUNTER',
            section_name: selectedTableLive.section_name || 'PARCEL',
            captain_name: updatedOrderData?.captain_name || activeOrderForSelectedTable?.captain_name || 'ADMIN',
            items: deltaItems
          };
          if (printKot) {
            console.log('[PARCEL] Calling printKOT for updated order (delta only):', orderToPrint);
            await printKOT(orderToPrint);
          } else {
            console.log('[PARCEL] printKot is false, skipping print.');
          }
        } else {
          console.log('[PARCEL] No new items with positive delta, skipping KOT print.');
        }

        setIsAddingItems(false);
        setAdditionalItems([]);
        setCheckoutOrder(updatedOrderData);
        fetchTables();
        fetchOrders();
      } else {
        throw new Error(res.data.message || 'Failed to update KOT');
      }
    } catch (err) {
      console.error('[Parcel] handleSubmitAdditionalItems failed:', err);
      toast.error(`❌ Failed to update KOT: ${err.message}`, {
        style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
      });
    } finally {
      setIsSubmittingAdditional(false);
    }
  };

  const handleCompletePayment = async (orderId, shouldClose = true) => {
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';

      if (shouldClose) {
        setSelectedTable(null);
        setIsAddingItems(false);
        setIsCreatingDirectOrder(false);
        setAdditionalItems([]);
      }

      const res = await authorizedFetch(
        `${API_BASE}/orders/pay/${orderId}?hotelId=${hotelId}`,
        { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMode: selectedPaymentMode || 'CASH' })
        }
      );
      const data = await res.json();
      if (data.success) {
        fetchTables();
        fetchOrders();
      } else {
        throw new Error(data.message || 'Failed to complete payment');
      }
    } catch (err) {
      console.error('[Parcel] handleCompletePayment failed:', err);
      toast.error(`❌ ${err.message}`);
    }
  };

  const handleCancelBill = async (orderId) => {
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      
      const res = await authorizedFetch(
        `${API_BASE}/bills/${orderId}/cancel?hotelId=${hotelId}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      const data = await res.json();
      if (data.success) {
        toast.success("Parcel order cancelled");
        setSelectedTable(null);
        setIsAddingItems(false);
        setIsCreatingDirectOrder(false);
        setAdditionalItems([]);
        fetchTables();
        fetchOrders();
      } else {
        throw new Error(data.message || 'Failed to cancel bill');
      }
    } catch (err) {
      console.error('[Parcel] handleCancelBill failed:', err);
      toast.error(`❌ ${err.message}`);
    }
  };

  // Table Management Actions
  const handleAddTable = async (e) => {
    e.preventDefault();
    if (!formTableNumber.trim()) {
      toast.error('Parcel Code is required.');
      return;
    }
    const match = formTableNumber.trim().match(/^P(\d+)$/);
    if (!match) {
      toast.error('Invalid Parcel Code format. Use P<number> (e.g. P1, P2, P10)');
      return;
    }

    // Duplicate check on frontend
    const isDuplicate = tables.some(t => 
      t.section_name?.toUpperCase() === 'PARCEL' && 
      t.table_number.toUpperCase() === formTableNumber.trim().toUpperCase()
    );
    if (isDuplicate) {
      toast.error('A parcel table with this code already exists.');
      return;
    }

    const numericPart = parseInt(match[1], 10);
    const tableName = `Parcel ${numericPart}`;
    const displayOrder = numericPart;

    setActionLoading(true);
    try {
      const res = await authorizedFetch(`${API_BASE}/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: formTableNumber.trim(),
          table_name: tableName,
          display_order: displayOrder,
          is_active: true,
          is_parcel: true
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Parcel table added successfully!');
        setIsAddTableOpen(false);
        setFormTableNumber('');
        setFormTableName('');
        setFormDisplayOrder(0);
        setFormIsActive(true);
        fetchTables();
      } else {
        throw new Error(data.message || 'Failed to add table');
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditTable = async (e) => {
    e.preventDefault();
    if (!editingTable) return;
    if (!formTableNumber.trim()) {
      toast.error('Parcel Code is required.');
      return;
    }
    const match = formTableNumber.trim().match(/^P(\d+)$/);
    if (!match) {
      toast.error('Invalid Parcel Code format. Use P<number> (e.g. P1, P2, P10)');
      return;
    }

    // Duplicate check on frontend
    const isDuplicate = tables.some(t => 
      t.section_name?.toUpperCase() === 'PARCEL' && 
      t.table_number.toUpperCase() === formTableNumber.trim().toUpperCase() &&
      t.id !== editingTable.id
    );
    if (isDuplicate) {
      toast.error('A parcel table with this code already exists.');
      return;
    }

    const numericPart = parseInt(match[1], 10);
    const tableName = `Parcel ${numericPart}`;
    const displayOrder = numericPart;

    setActionLoading(true);
    try {
      const res = await authorizedFetch(`${API_BASE}/tables/${editingTable.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: formTableNumber.trim(),
          table_name: tableName,
          display_order: displayOrder,
          is_active: editingTable.is_active !== undefined ? editingTable.is_active : true
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Parcel table updated successfully!');
        setEditingTable(null);
        setFormTableNumber('');
        setFormTableName('');
        setFormDisplayOrder(0);
        setFormIsActive(true);
        fetchTables();
      } else {
        throw new Error(data.message || 'Failed to update table');
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (!window.confirm('Are you sure you want to delete this parcel table?')) return;
    try {
      const res = await authorizedFetch(`${API_BASE}/tables/${tableId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Parcel table deleted successfully!');
        fetchTables();
      } else {
        throw new Error(data.message || 'Failed to delete table');
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const startEditing = (table) => {
    setEditingTable(table);
    setFormTableNumber(table.table_number);
    setFormTableName(table.table_name);
    setFormDisplayOrder(table.display_order || 0);
    setFormIsActive(table.is_active);
  };

  // Printing logic
  const handleThermalPrint = (billData, existingPrintWindow = null) => {
    const printWindow = existingPrintWindow || window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
    if (!printWindow) {
      console.error('Failed to open print window. Please allow popups.');
      return;
    }
    const {
      hotelName,
      address,
      gstNumber,
      tableNumber,
      cashierName,
      captainName,
      orderId,
      dateTime,
      items,
      subtotal,
      cgst,
      sgst,
      grandTotal,
      serviceCharge = 0,
      cgstRate,
      sgstRate,
      serviceChargeRate,
      currencySymbol,
      phone
    } = billData;

    const printCurrency = 'Rs. ';
    let itemsHtml = '';
    if (items) {
      items.forEach(item => {
        itemsHtml += `
          <tr>
            <td style="width: 55%; text-align: left; font-weight: bold; font-size: 11px; padding: 4px 0 2px 0; word-wrap: break-word; vertical-align: top;">${item.name.toUpperCase()}</td>
            <td style="width: 15%; text-align: right; font-weight: bold; font-size: 11px; padding: 4px 0 2px 0; vertical-align: top; padding-right: 5px;">${item.quantity}</td>
            <td style="width: 30%; text-align: right; font-weight: bold; font-size: 11px; padding: 4px 0 2px 0; vertical-align: top;">${printCurrency}${parseFloat(item.price * item.quantity).toFixed(0)}</td>
          </tr>
          <tr>
            <td colspan="3" style="font-size: 9px; color: #555555; padding-bottom: 4px; padding-left: 2px;">${item.quantity} x ${printCurrency}${parseFloat(item.price).toFixed(0)}</td>
          </tr>
        `;
      });
    }

    const htmlContent = `
<html>
<head>
  <title>Thermal Bill - ${tableNumber}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    html, body {
      width: 80mm; margin: 0; padding: 0; background: #ffffff; color: #000000;
      font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 1.4;
    }
    body { width: 80mm; margin: 0; padding: 8px; box-sizing: border-box; }
    .receipt { width: 100%; box-sizing: border-box; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .title { font-size: 16px; font-weight: 900; margin: 0 0 2px 0; letter-spacing: 1px; }
    .subtitle { font-size: 10px; margin: 0 0 2px 0; font-weight: bold; }
    .divider { border-top: 1px dashed #000000; margin: 6px 0; width: 100%; height: 1px; }
    .double-divider { border-top: 3px double #000000; margin: 6px 0; width: 100%; height: 3px; }
    .footer { margin-top: 15px; font-size: 10px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      <div class="title">${hotelName}</div>
      ${address ? `<div class="subtitle">${address}</div>` : ""}
      ${phone ? `<div class="subtitle">Phone: ${phone}</div>` : ""}
      ${gstNumber ? `<div class="subtitle">GSTIN: ${gstNumber}</div>` : ""}
    </div>
    <div class="divider"></div>
    <table style="width: 100%; font-size: 10px; font-weight: bold; margin-bottom: 2px; border-collapse: collapse;">
      <tr>
        <td style="text-align: left; padding: 1px 0;">Table: ${tableNumber}</td>
        <td style="text-align: right; padding: 1px 0;">Capt: ${captainName || 'ADMIN'}</td>
      </tr>
      <tr><td colspan="2" style="text-align: left; padding: 1px 0;">Date: ${dateTime}</td></tr>
      <tr><td colspan="2" style="text-align: left; padding: 1px 0;">Order ID: ${orderId}</td></tr>
    </table>
    <div class="divider"></div>
    <table style="width: 100%; border-collapse: collapse; margin-top: 5px; table-layout: fixed;">
      <thead>
        <tr style="border-bottom: 1px dashed #000000;">
          <th style="width: 55%; text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; padding-bottom: 3px;">Item Description</th>
          <th style="width: 15%; text-align: right; font-size: 10px; font-weight: 900; text-transform: uppercase; padding-bottom: 3px; padding-right: 5px;">Qty</th>
          <th style="width: 30%; text-align: right; font-size: 10px; font-weight: 900; text-transform: uppercase; padding-bottom: 3px;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="divider"></div>
    <table style="width: 100%; font-size: 11px; font-weight: bold; margin-top: 5px; border-collapse: collapse;">
      <tr>
        <td style="text-align: left; padding: 2px 0;">Subtotal</td>
        <td style="text-align: right; padding: 2px 0;">${printCurrency}${parseFloat(subtotal).toFixed(2)}</td>
      </tr>
      ${cgstRate > 0 ? `
      <tr>
        <td style="text-align: left; padding: 2px 0; font-size: 10px;">CGST (${cgstRate}%)</td>
        <td style="text-align: right; padding: 2px 0; font-size: 10px;">${printCurrency}${parseFloat(cgst).toFixed(2)}</td>
      </tr>
      ` : ""}
      ${sgstRate > 0 ? `
      <tr>
        <td style="text-align: left; padding: 2px 0; font-size: 10px;">SGST (${sgstRate}%)</td>
        <td style="text-align: right; padding: 2px 0; font-size: 10px;">${printCurrency}${parseFloat(sgst).toFixed(2)}</td>
      </tr>
      ` : ""}
      ${Number(serviceCharge) > 0 ? `
      <tr>
        <td style="text-align: left; padding: 2px 0; font-size: 10px;">Service Charge (${serviceChargeRate}%)</td>
        <td style="text-align: right; padding: 2px 0; font-size: 10px;">${printCurrency}${parseFloat(serviceCharge).toFixed(2)}</td>
      </tr>
      ` : ""}
    </table>
    <div class="double-divider"></div>
    <table style="width: 100%; font-size: 14px; font-weight: 900; border-collapse: collapse;">
      <tr>
        <td style="text-align: left;">GRAND TOTAL</td>
        <td style="text-align: right;">${printCurrency}${parseFloat(grandTotal).toFixed(0)}</td>
      </tr>
    </table>
    <div class="divider"></div>
    <div class="center footer"><div class="bold">THANK YOU VISIT AGAIN</div></div>
    <div style="height: 35px; clear: both;"></div>
    <div class="center" style="font-size: 8px; color: #888888;">- End of Receipt -</div>
  </div>
</body>
</html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    printWindow.onload = function () {
      setTimeout(function () {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    };

    if (printWindow.document.readyState === 'complete') {
      setTimeout(function () {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const handleThermalPrintDirect = async (table, order, suppressToast = false) => {
    if (printerConfig && !printerConfig.bill) {
      showPrinterErrorToast('Bill Printer is not configured.', 'bill-print-error');
      return;
    }
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const tableName = table.table_code || table.table_name || 'Table';

      const dateStr = formatDateDDMMYYYY(new Date());
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

      const subtotalValue = Number(order.subtotal) || 0;
      const cgstValue = Number(order.cgst) || 0;
      const sgstValue = Number(order.sgst) || 0;
      const grandTotalValue = Number(order.grand_total) || 0;
      const serviceChargeValue = Math.max(0, grandTotalValue - subtotalValue - cgstValue - sgstValue);

      const billData = {
        hotelName: systemSettings.branding.name,
        address: systemSettings.branding.address,
        phone: systemSettings.branding.phone,
        gstNumber: systemSettings.billing.gstNumber,
        tableNumber: `${table.table_code || table.table_name} (${table.section_name})`,
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
        cgstRate: Number(systemSettings.billing.cgst) || 0,
        sgstRate: Number(systemSettings.billing.sgst) || 0,
        serviceChargeRate: Number(systemSettings.billing.serviceCharge) || 0,
        currencySymbol: systemSettings.billing.currencySymbol
      };

      // 1. Queue job on cloud first to get the unique Job ID (approx 50ms)
      const response = await fetch(`${API_BASE}/bills/print?hotelId=${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData)
      });
      const data = await response.json();
      if (!data.success) {
        if (data.code === 'PRINTER_NOT_CONFIGURED' || data.code === 'PRINTER_OFFLINE') {
          showPrinterErrorToast(data.message, 'bill-print-error');
          return;
        }
        throw new Error(data.message || 'Direct print failed');
      }

      const jobId = data.jobId;
      console.log('[DEBUG] Print job created:', jobId);

      if (typeof window.mejwani_start_ack_timeout === 'function') {
        window.mejwani_start_ack_timeout(jobId, 'BILL');
      }

      // 2. Try direct local print next
      const isLocalHost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1' || 
                          window.location.hostname.startsWith('192.168.') || 
                          window.location.hostname.startsWith('10.') || 
                          window.location.hostname.startsWith('172.') || 
                          window.location.hostname.endsWith('.local');
      if (isLocalHost) {
        try {
          console.log('[DEBUG] Local agent print started:', jobId);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000); // 1000ms local agent timeout
          const localResponse = await fetch('http://127.0.0.1:9111/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: jobId, job_type: 'BILL', payload: billData }),
            signal: controller.signal
          });
          const localData = await localResponse.json();
          clearTimeout(timeoutId);
          if (localData.success) {
            console.log('[DEBUG] Local print success:', jobId);
            onPrintJobAcknowledgedLocal(jobId, tableName, 'BILL');
            return;
          }
        } catch (localErr) {
          console.log('[DEBUG] Local print failure:', jobId, '. Cloud fallback triggered.', localErr.message);
        }
      }

      // 3. Fallback: Trigger print agent to poll the queued job immediately
      console.log('[DEBUG] Cloud fallback triggered for job:', jobId);
      if (isLocalHost) {
        fetch('http://127.0.0.1:9111/trigger-poll').catch(() => { });
      }
      onPrintJobAcknowledgedLocal(jobId, tableName, 'BILL');

    } catch (err) {
      console.error('Direct print error', err);
      toast.error('❌ Failed to process printing request.');
    }
  };

  const printKOT = async (order) => {
    console.log('[DEBUG] printKOT called for order:', order.id);
    if (printerConfig && !printerConfig.kot) {
      showPrinterErrorToast('KOT Printer is not configured.', `kot-fail-${order.id}`);
      return;
    }
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const tableName = order.table_name || order.table_number || 'COUNTER';

       const kotData = {
        title: systemSettings?.printing?.kotTitle || 'KITCHEN ORDER TICKET',
        hotelName: systemSettings?.branding?.name || 'MEJWANI',
        tableName: tableName,
        sectionName: order.section_name || 'PARCEL',
        captainName: order.captain_name || 'ADMIN',
        orderId: order.kot_number || order.id,
        dateTime: order.created_at ? formatDateTimeDDMMYYYY(order.created_at) : formatDateTimeDDMMYYYY(new Date()),
        items: (order.items || []).map(item => ({
          name: item.name || item.itemName,
          quantity: item.quantity || item.qty || 1,
          note: item.note
        }))
      };

      console.log('[KOT] User clicked Send KOT');
      console.log('[DEBUG] printKOT sending API request to print-kot. Payload:', kotData);
      const printRes = await fetch(`${API_BASE}/orders/print-kot?hotelId=${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kotData)
      });
      const printData = await printRes.json();
      console.log('[DEBUG] printKOT print-kot API response:', printData);
      if (!printData.success) {
        if (printData.code === 'PRINTER_NOT_CONFIGURED' || printData.code === 'PRINTER_OFFLINE') {
          showPrinterErrorToast(printData.message, `kot-fail-${order.id}`);
          return;
        }
        throw new Error(printData.message || 'Direct print failed');
      }

      const jobId = printData.jobId;
      console.log('[DEBUG] Print job created:', jobId);
      console.log(`[KOT] Print Job ID: ${jobId}`);

      if (typeof window.mejwani_start_ack_timeout === 'function') {
        window.mejwani_start_ack_timeout(jobId, 'KOT');
      }

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
            onPrintJobAcknowledgedLocal(jobId, tableName, 'KOT');
          }
        } catch (localErr) {
          console.log('[DEBUG] Local print failure:', jobId, '. Cloud fallback triggered.', localErr.message);
        }
      }

      if (!localPrintSuccess) {
        console.log('[DEBUG] Cloud fallback triggered for job:', jobId);
        if (isLocalHost) {
          console.log('[KOT] Trigger poll called');
          fetch('http://127.0.0.1:9111/trigger-poll').catch(() => { });
        }
        onPrintJobAcknowledgedLocal(jobId, tableName, 'KOT');
      }

    } catch (err) {
      console.error('[KOT Print] Direct KOT print error:', err);
      toast.error(`❌ KOT print failed: ${err.message}`, {
        style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
      });
    }
  };

  const handlePrintAndCompleteBill = (orderId) => {
    if (printerConfig && !printerConfig.bill) {
      showPrinterErrorToast('Bill Printer is not configured.', 'bill-print-error');
      return;
    }
    if (selectedTableLive && activeOrderForSelectedTable) {
      handleThermalPrintDirect(selectedTableLive, activeOrderForSelectedTable, false);
    }
    handleCompletePayment(orderId);
  };

  return (
    <AdminLayout>
      <div className="-mt-6 space-y-6 w-full max-w-full overflow-visible">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Package className="text-[#ff6b00] w-6 h-6" />
              Parcel Counter
            </h2>
            <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mt-1">
              Dedicated parcel tables with real-time status and timers
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setIsManageTablesOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl font-bold text-xs uppercase tracking-wide transition-all hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-[#ff6b00]" />
              Manage Parcel Tables
            </button>
            <button
              onClick={() => {
                setEditingTable(null);
                setFormTableNumber('');
                setFormTableName('');
                setFormDisplayOrder(0);
                setFormIsActive(true);
                setIsAddTableOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#ff6b00] to-[#ff8524] text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Parcel Table
            </button>
          </div>
        </div>

        {/* LOADING & EMPTY STATES */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="h-32 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/5" />
            ))}
          </div>
        ) : parcelTables.length === 0 ? (
          <div className="border border-dashed border-slate-200 dark:border-white/10 rounded-3xl p-16 text-center max-w-md mx-auto space-y-4">
            <Package className="w-12 h-12 mx-auto text-[#ff6b00]/40" />
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">No parcel tables found</h4>
            <p className="text-[11px] font-bold text-slate-400 dark:text-white/20">Click "+ Add Parcel Table" to populate your parcel tables board.</p>
          </div>
        ) : (
          /* RESPONSIVE PARCEL TABLES GRID */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-in fade-in duration-300">
            {parcelTables.map((table) => {
              const isSelected = selectedTableLive?.id === table.id;
              const order = orders.find(o => o.table_id === table.id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
              const itemsCount = order?.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;

              // Color mappings
              let cardStyle = 'border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d0d0d] hover:border-emerald-500/20 shadow-sm';
              let badge = (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black uppercase text-emerald-500 tracking-wider">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> VACANT
                </span>
              );

              if (table.status === 'occupied') {
                cardStyle = isSelected ? 'border-rose-500 bg-rose-500/5 shadow-lg shadow-rose-500/5' : 'border-rose-500/30 dark:border-rose-500/10 bg-white dark:bg-[#0d0d0d] hover:border-rose-500/50 shadow-sm';
                badge = (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[8px] font-black uppercase text-rose-500 tracking-wider">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" /> OCCUPIED
                  </span>
                );
              } else if (table.status === 'bill_pending') {
                cardStyle = isSelected ? 'border-amber-500 bg-amber-500/5 shadow-lg shadow-amber-500/5' : 'border-amber-500/30 dark:border-amber-500/10 bg-white dark:bg-[#0d0d0d] hover:border-amber-500/50 shadow-sm';
                badge = (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[8px] font-black uppercase text-amber-500 tracking-wider">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" /> BILL PENDING
                  </span>
                );
              }

              if (!table.is_active) {
                cardStyle += ' opacity-40 cursor-not-allowed';
              }

              const isOccupied = table.status === 'occupied' || table.status === 'bill_pending' || !!order;

              return (
                <button
                  key={table.id}
                  disabled={!table.is_active}
                  onClick={() => setSelectedTable(table)}
                  className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between items-center text-center min-h-[110px] cursor-pointer ${
                    !table.is_active
                      ? 'opacity-40 cursor-not-allowed border-slate-200 dark:border-white/5'
                      : isOccupied
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/40 text-emerald-800 dark:text-emerald-400 hover:border-emerald-500 shadow-sm'
                      : 'bg-slate-50/50 dark:bg-white/2 border-slate-200 dark:border-white/5 text-slate-800 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/10 hover:bg-slate-100/50'
                  }`}
                >
                  {/* Top part: Elapsed Time */}
                  <div className="text-[10px] font-black uppercase tracking-wider h-4">
                    {isOccupied && (
                      <DiningTimer
                        occupiedAt={table.occupied_at}
                        isBillPending={table.status === 'bill_pending'}
                      />
                    )}
                  </div>

                  {/* Middle part: Table Name */}
                  <div className="text-2xl font-black tracking-tight my-1">
                    {table.table_name}
                  </div>

                  {/* Bottom part: Amount & Save Icon */}
                  <div className="w-full flex items-center justify-between h-5 text-xs font-black">
                    {isOccupied && order ? (
                      <>
                        <span className="text-emerald-700 dark:text-emerald-300">
                          {formatCurrency(order.grand_total, 0)}
                        </span>
                        <Save className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 opacity-80" />
                      </>
                    ) : (
                      <div />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* NEW BILL / ORDER SELECTOR MODAL (Vacant/Add More Flow) */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {selectedTableLive && (isCreatingDirectOrder || isAddingItems) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => { setSelectedTable(null); closeAddMoreItems(); closeDirectOrder(); }} />
            <div className="relative flex flex-col bg-white dark:bg-[#0d0d0d] border-2 border-slate-100 dark:border-white/5 rounded-3xl shadow-2xl z-10 w-[95vw] h-[90vh] overflow-hidden">
              
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-3 bg-slate-50/50 dark:bg-white/2">
                <button
                  onClick={isCreatingDirectOrder ? () => { closeDirectOrder(); setSelectedTable(null); } : closeAddMoreItems}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-600 transition-all flex-shrink-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                    <PackagePlus className="w-5 h-5 text-[#ff6b00]" />
                    {isCreatingDirectOrder ? 'New Parcel Order' : 'Add Items to Parcel KOT'}
                  </h3>
                  <p className="text-[9px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mt-0.5">
                    {isCreatingDirectOrder
                      ? `${selectedTableLive.table_name} · Vacant Session`
                      : `KOT-${activeOrderForSelectedTable?.kot_number || activeOrderForSelectedTable?.id} · ${selectedTableLive.table_name}`
                    }
                  </p>
                </div>
                <button
                  onClick={isCreatingDirectOrder ? () => { closeDirectOrder(); setSelectedTable(null); } : () => { setSelectedTable(null); closeAddMoreItems(); }}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" style={{ minHeight: 0 }}>
                {/* Left side: Menu items and searches */}
                <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-100 dark:border-white/5">
                  
                  {/* Search and Filters */}
                  <div className="p-4 space-y-2 border-b border-slate-100 dark:border-white/5 flex-shrink-0">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          ref={menuSearchInputRef}
                          value={menuSearchTerm}
                          onChange={e => setMenuSearchTerm(e.target.value)}
                          onKeyDown={handleMenuSearchKeyDown}
                          placeholder="Search item name or shortcode..."
                          className="w-full rounded-xl border-2 py-2 pl-9 pr-3 text-xs font-bold outline-none transition-all border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d0d0d] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#ff6b00] focus:ring-2 focus:ring-orange-500/10"
                        />
                      </div>
                      <select
                        value={menuTypeFilter}
                        onChange={e => setMenuTypeFilter(e.target.value)}
                        className="rounded-xl border-2 py-2 px-3 text-xs font-bold outline-none transition-all border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d0d0d] text-slate-900 dark:text-white focus:border-[#ff6b00]"
                      >
                        <option value="All">All Types</option>
                        <option value="VEG">VEG</option>
                        <option value="NON_VEG">NON-VEG</option>
                      </select>
                      
                      <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => setMenuViewMode('table')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            menuViewMode === 'table'
                              ? 'bg-white dark:bg-white/10 text-[#ff6b00] shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                          }`}
                        >
                          Table
                        </button>
                        <button
                          type="button"
                          onClick={() => setMenuViewMode('grid')}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            menuViewMode === 'grid'
                              ? 'bg-white dark:bg-white/10 text-[#ff6b00] shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                          }`}
                        >
                          Grid
                        </button>
                      </div>
                    </div>
                    
                    {/* Categories selector */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                      {menuCategories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setMenuCategoryFilter(cat)}
                          className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            menuCategoryFilter === cat
                              ? 'bg-[#ff6b00] text-white'
                              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-[#ff6b00]'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Menu Items Grid */}
                  <div className="flex-1 overflow-y-auto p-4 min-h-0 flex flex-col">
                    {menuItems.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 font-bold text-xs">Loading menu...</div>
                    ) : filteredMenuItems.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 font-bold text-xs">No items found.</div>
                    ) : menuViewMode === 'table' ? (
                      <div className="bg-white dark:bg-white/2 border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden min-h-0 flex flex-col">
                        <div className="overflow-y-auto flex-1">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#1a1a1a]">
                              <tr className="border-b border-slate-200 dark:border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-white/40">
                                <th className="p-3">Dish Info</th>
                                <th className="p-3">Category</th>
                                <th className="p-3 text-right">Price</th>
                                <th className="p-3 text-right">Cart Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs text-slate-700 dark:text-slate-200 font-bold">
                              {filteredMenuItems.map((item, idx) => {
                                const hasHalfFull = item.pricing_type === 'HALF_FULL';
                                const qtySingle = additionalItems.filter(c => c.cartId === `${item.originalId || item._id || item.id}_FULL`).reduce((sum, c) => sum + c.quantity, 0);
                                const qtyHalf = additionalItems.filter(c => c.cartId === `${item.originalId || item._id || item.id}_HALF`).reduce((sum, c) => sum + c.quantity, 0);
                                const qtyFull = additionalItems.filter(c => c.cartId === `${item.originalId || item._id || item.id}_FULL`).reduce((sum, c) => sum + c.quantity, 0);

                                return (
                                  <tr 
                                    key={item._id || item.id} 
                                    style={!item.isAvailable ? { filter: 'grayscale(60%)', opacity: 0.6 } : undefined}
                                    onClick={(e) => {
                                      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
                                        return;
                                      }
                                      if (item.isAvailable) {
                                        if (hasHalfFull) {
                                          handleAddAdditionalItem(item, 'FULL');
                                        } else {
                                          handleAddAdditionalItem(item);
                                        }
                                      }
                                    }}
                                    className={`hover:bg-slate-50/50 dark:hover:bg-white/[0.01] cursor-pointer transition-all ${
                                      idx === menuSearchHighlightedIndex ? 'bg-orange-500/15 dark:bg-orange-500/30 text-orange-600 dark:text-orange-400 font-extrabold shadow-sm' : ''
                                    }`}
                                  >
                                    <td className="p-3">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.type === 'VEG' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                        <div>
                                          <span className="font-extrabold text-slate-800 dark:text-white">{item.name}</span>
                                          {(item.shortcode || item.code) && (
                                            <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400">
                                              {item.shortcode || item.code}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-3 text-[10px] text-slate-400 uppercase tracking-wider">{item.category || 'ITEM'}</td>
                                    <td className="p-3 text-right font-black text-slate-800 dark:text-white">
                                      {hasHalfFull ? (
                                        <div className="flex flex-col text-[10px] text-slate-500 font-bold">
                                          <span>Half: {formatCurrency(item.half_price)}</span>
                                          <span>Full: {formatCurrency(item.full_price)}</span>
                                        </div>
                                      ) : (
                                        formatCurrency(item.price)
                                      )}
                                    </td>
                                    <td className="p-3 text-right">
                                      {!item.isAvailable ? (
                                        <span className="text-[10px] uppercase font-bold text-rose-500 bg-rose-500/10 px-2 py-1 rounded-lg">Unavailable</span>
                                      ) : hasHalfFull ? (
                                        <div className="inline-flex gap-1.5">
                                          {qtyHalf > 0 ? (
                                            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg border border-slate-200 dark:border-white/10">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleAdditionalQuantity(`${item.originalId || item._id || item.id}_HALF`, -1);
                                                }}
                                                className="p-0.5 rounded bg-white dark:bg-white/10 text-slate-500 hover:text-[#ff6b00] cursor-pointer"
                                              >
                                                <Minus className="w-2.5 h-2.5" />
                                              </button>
                                              <span className="px-1 text-[10px] font-black text-slate-800 dark:text-white">Half: {qtyHalf}</span>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleAddAdditionalItem(item, 'HALF');
                                                }}
                                                className="p-0.5 rounded bg-white dark:bg-white/10 text-[#ff6b00] hover:bg-orange-500/10 cursor-pointer"
                                              >
                                                <Plus className="w-2.5 h-2.5" />
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddAdditionalItem(item, 'HALF');
                                              }}
                                              className="px-2.5 py-1 bg-orange-500/10 hover:bg-[#ff6b00] hover:text-white border border-orange-500/20 text-[9px] font-black uppercase rounded-lg transition-all cursor-pointer"
                                            >
                                              Half
                                            </button>
                                          )}

                                          {qtyFull > 0 ? (
                                            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg border border-slate-200 dark:border-white/10">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleAdditionalQuantity(`${item.originalId || item._id || item.id}_FULL`, -1);
                                                }}
                                                className="p-0.5 rounded bg-white dark:bg-white/10 text-slate-500 hover:text-[#ff6b00] cursor-pointer"
                                              >
                                                <Minus className="w-2.5 h-2.5" />
                                              </button>
                                              <span className="px-1 text-[10px] font-black text-slate-800 dark:text-white">Full: {qtyFull}</span>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleAddAdditionalItem(item, 'FULL');
                                                }}
                                                className="p-0.5 rounded bg-white dark:bg-white/10 text-[#ff6b00] hover:bg-orange-500/10 cursor-pointer"
                                              >
                                                <Plus className="w-2.5 h-2.5" />
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddAdditionalItem(item, 'FULL');
                                              }}
                                              className="px-2.5 py-1 bg-orange-500/10 hover:bg-[#ff6b00] hover:text-white border border-orange-500/20 text-[9px] font-black uppercase rounded-lg transition-all cursor-pointer"
                                            >
                                              Full
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        qtySingle > 0 ? (
                                          <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-lg border border-slate-200 dark:border-white/10 select-none">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAdditionalQuantity(`${item.originalId || item._id || item.id}_FULL`, -1);
                                              }}
                                              className="p-1 rounded bg-white dark:bg-white/10 text-slate-500 hover:text-[#ff6b00] cursor-pointer"
                                            >
                                              <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="px-2 text-xs font-black text-slate-800 dark:text-white min-w-[16px] text-center">{qtySingle}</span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddAdditionalItem(item);
                                              }}
                                              className="p-1 rounded bg-white dark:bg-white/10 text-[#ff6b00] hover:bg-orange-500/10 cursor-pointer"
                                            >
                                              <Plus className="w-3 h-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleAddAdditionalItem(item);
                                            }}
                                            className="px-3.5 py-1.5 bg-orange-500 hover:bg-[#e66000] text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow transition-all cursor-pointer inline-flex items-center gap-1.5"
                                          >
                                            <Plus className="w-3 h-3" />
                                            Add
                                          </button>
                                        )
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {filteredMenuItems.map((item, idx) => {
                          const targetCartId = `${item.originalId || item._id || item.id}_\${item.portion_type || item.portionType || 'FULL'}`;
                          const qtyInCart = additionalItems.filter(c => c.cartId === targetCartId).reduce((sum, c) => sum + c.quantity, 0);
                          const isAlreadyAdded = qtyInCart > 0;
                          return (
                            <div
                              key={item._id || item.id}
                              style={!item.isAvailable ? { filter: 'grayscale(60%)' } : undefined}
                              onClick={() => {
                                if (item.isAvailable && item.pricing_type !== 'HALF_FULL') {
                                  handleAddAdditionalItem(item);
                                }
                              }}
                              className={`relative p-3 rounded-xl border text-left bg-white dark:bg-[#0a0a0a] transition-all group ${
                                idx === menuSearchHighlightedIndex
                                  ? 'ring-2 ring-orange-500 border-orange-500 shadow-md scale-[1.01]'
                                  : (!item.isAvailable 
                                    ? 'opacity-50 cursor-not-allowed' 
                                    : isAlreadyAdded 
                                      ? 'border-orange-500 shadow-sm hover:shadow-md' 
                                      : 'border-slate-200 dark:border-white/10 hover:border-orange-400 hover:shadow-md')
                              } ${item.isAvailable && item.pricing_type !== 'HALF_FULL' ? 'cursor-pointer active:scale-[0.98]' : ''}`}
                            >
                              {isAlreadyAdded && (
                                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-orange-500/10 dark:bg-orange-500/20 text-[#ff6b00] text-[8px] font-black uppercase tracking-wider">
                                  Qty: {qtyInCart}
                                </span>
                              )}
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[8px] font-black uppercase mb-1.5 ${item.type === 'VEG' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                                <span className={`w-1 h-1 rounded-full ${item.type === 'VEG' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                {item.type === 'VEG' ? 'VEG' : 'NON-VEG'}
                              </span>
                              <p className="text-xs font-black text-slate-800 dark:text-white leading-tight group-hover:text-[#ff6b00] transition-colors flex items-center gap-2">
                                <span>{item.name}</span>
                                {(item.shortcode || item.code) && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-[9px] font-black text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 uppercase">
                                    {item.shortcode || item.code}
                                  </span>
                                )}
                              </p>
                              <p className="text-[9px] text-slate-400 dark:text-white/30 font-bold uppercase tracking-wider mt-0.5 truncate">{item.category || 'ITEM'}</p>
                              
                              {item.pricing_type === 'HALF_FULL' ? (
                                <div className="flex flex-col gap-1.5 mt-2">
                                  <button
                                    type="button"
                                    disabled={!item.isAvailable}
                                    onClick={(e) => { e.stopPropagation(); handleAddAdditionalItem(item, 'HALF'); }}
                                    className="w-full py-1 px-2 rounded-lg bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/20 text-[10px] font-black text-slate-800 dark:text-white flex justify-between items-center cursor-pointer"
                                  >
                                    <span>Half</span>
                                    <span className="text-[#ff6b00]">₹{parseFloat(item.half_price || 0).toFixed(0)}</span>
                                    {(additionalItems.find(c => c.cartId === `${item._id || item.id}_HALF`)?.quantity || 0) > 0 && (
                                      <span className="px-1 py-0.5 rounded bg-orange-500 text-white text-[8px] font-bold">
                                        {additionalItems.find(c => c.cartId === `${item._id || item.id}_HALF`).quantity}
                                      </span>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!item.isAvailable}
                                    onClick={(e) => { e.stopPropagation(); handleAddAdditionalItem(item, 'FULL'); }}
                                    className="w-full py-1 px-2 rounded-lg bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/20 text-[10px] font-black text-slate-800 dark:text-white flex justify-between items-center cursor-pointer"
                                  >
                                    <span>Full</span>
                                    <span className="text-[#ff6b00]">₹{parseFloat(item.full_price || 0).toFixed(0)}</span>
                                    {(additionalItems.find(c => c.cartId === `${item._id || item.id}_FULL`)?.quantity || 0) > 0 && (
                                      <span className="px-1 py-0.5 rounded bg-orange-500 text-white text-[8px] font-bold">
                                        {additionalItems.find(c => c.cartId === `${item._id || item.id}_FULL`).quantity}
                                      </span>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!item.isAvailable}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddAdditionalItem(item);
                                  }}
                                  className="w-full mt-2 py-1 px-2 bg-slate-50 hover:bg-orange-500/10 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-black text-slate-800 dark:text-white flex justify-between items-center cursor-pointer"
                                >
                                  <span>Price</span>
                                  <span className="text-[#ff6b00]">₹{parseFloat(item.price || 0).toFixed(0)}</span>
                                  {(additionalItems.find(c => c.cartId === `${item._id || item.id}_FULL`)?.quantity || 0) > 0 && (
                                    <span className="px-1 py-0.5 rounded bg-orange-500 text-white text-[8px] font-bold">
                                      {additionalItems.find(c => c.cartId === `${item._id || item.id}_FULL`).quantity}
                                    </span>
                                  )}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Selected Items Cart */}
                <div className="w-full lg:w-96 flex flex-col flex-shrink-0 border-t lg:border-t-0 border-slate-100 dark:border-white/5 bg-slate-50/20 dark:bg-black/10">
                  <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest">Selected Items</span>
                    {additionalItems.length > 0 && (
                      <button
                        onClick={() => setAdditionalItems([])}
                        className="text-[9px] font-bold text-rose-500 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {additionalItems.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 text-xs font-bold">
                        <Plus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        Tap menu items to add to cart
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-white/2 border border-slate-100 dark:border-white/5 rounded-xl p-3">
                        <table className="w-full text-left border-collapse text-xs font-bold">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-white/5 text-[9px] uppercase tracking-wider text-slate-400">
                              <th className="pb-2">Item</th>
                              <th className="pb-2 text-center">Qty</th>
                              <th className="pb-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                            {additionalItems.map(item => (
                              <tr key={item.cartId}>
                                <td className="py-2.5">
                                  <span className="font-extrabold text-slate-800 dark:text-white block leading-tight">{item.name}</span>
                                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5">{formatCurrency(item.price)}</span>
                                  <div className="mt-1.5 space-y-1 max-w-[200px]">
                                    <div className="flex gap-1 flex-wrap">
                                      {['Roti', 'Chapati', 'Bhakari'].map(opt => (
                                        <button
                                          key={opt}
                                          type="button"
                                          onClick={() => {
                                            setAdditionalItems(prev => prev.map(i => {
                                              if (i.cartId === item.cartId) {
                                                const current = i.note || '';
                                                const prefix = current ? `${current}, ` : '';
                                                return { ...i, note: `${prefix}${opt}` };
                                              }
                                              return i;
                                            }));
                                          }}
                                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[8px] text-slate-500 dark:text-white/60 rounded-md font-extrabold cursor-pointer border border-slate-200/50 dark:border-white/5 transition-all"
                                        >
                                          +{opt}
                                        </button>
                                      ))}
                                      {(item.note) && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAdditionalItems(prev => prev.map(i => i.cartId === item.cartId ? { ...i, note: '' } : i));
                                          }}
                                          className="px-1.5 py-0.5 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-[8px] text-red-500 rounded-md font-extrabold cursor-pointer transition-all"
                                        >
                                          Clear
                                        </button>
                                      )}
                                    </div>
                                    <input
                                      type="text"
                                      value={item.note || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setAdditionalItems(prev => prev.map(i => i.cartId === item.cartId ? { ...i, note: val } : i));
                                      }}
                                      placeholder="Add prep note (e.g. 2 Roti, 2 Bhakari)..."
                                      className="w-full px-2 py-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[9px] text-slate-800 dark:text-white placeholder-slate-400/60 font-bold focus:outline-none focus:border-[#ff6b00] transition-all"
                                    />
                                  </div>
                                </td>
                                <td className="py-2.5 text-center">
                                  <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-white/5 p-0.5 rounded-lg border border-slate-200 dark:border-white/5">
                                    <button onClick={() => handleAdditionalQuantity(item.cartId, -1)} className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="text-[10px] font-black w-4 text-center text-slate-900 dark:text-white">{item.quantity}</span>
                                    <button onClick={() => handleAdditionalQuantity(item.cartId, 1)} className="p-0.5 rounded text-[#ff6b00] hover:bg-orange-500/10 cursor-pointer">
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2.5 text-right font-black text-slate-800 dark:text-white">
                                  {formatCurrency(item.price * item.quantity, 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Cart Footer Checkout Actions */}
                  {additionalItems.length > 0 && (
                    <div className="p-4 border-t border-slate-100 dark:border-white/5 space-y-3 bg-white dark:bg-[#0d0d0d]">
                      <div className="flex justify-between text-xs font-black text-slate-800 dark:text-white">
                        <span className="text-slate-500 dark:text-white/40 font-bold">Subtotal</span>
                        <span className="text-[#ff6b00]">{formatCurrency(additionalSubtotal)}</span>
                      </div>
                      <div className="text-[8px] text-slate-400 font-bold bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-2 text-center">
                        {isCreatingDirectOrder
                          ? 'This will place order, print KOT, and mark table OCCUPIED.'
                          : 'This will modify active order items in the KOT session.'
                        }
                      </div>
                      <div className="flex gap-2">
                        {/* Save (silently without KOT print) */}
                        <button
                          onClick={() => {
                            if (isCreatingDirectOrder) {
                              handleSendToKot({ printKot: false });
                            } else {
                              handleSubmitAdditionalItems({ printKot: false });
                            }
                          }}
                          disabled={isCreatingDirectOrder ? isSubmittingDirectOrder : isSubmittingAdditional}
                          className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                        >
                          {(isCreatingDirectOrder ? isSubmittingDirectOrder : isSubmittingAdditional) ? (
                            <span className="animate-pulse">Saving...</span>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              Save
                            </>
                          )}
                        </button>

                        {/* Save & KOT (saves and prints KOT) */}
                        <button
                          onClick={() => {
                            if (isCreatingDirectOrder) {
                              handleSendToKot({ printKot: true });
                            } else {
                              handleSubmitAdditionalItems({ printKot: true });
                            }
                          }}
                          disabled={isCreatingDirectOrder ? isSubmittingDirectOrder : isSubmittingAdditional}
                          className="flex-1 py-3 bg-[#ff6b00] hover:bg-[#e66000] text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                        >
                          {(isCreatingDirectOrder ? isSubmittingDirectOrder : isSubmittingAdditional) ? (
                            <span className="animate-pulse">Saving...</span>
                          ) : (
                            <>
                              <Printer className="w-4 h-4" />
                              Save & KOT
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* BILL PREVIEW / PAYMENT modal (Occupied Flow) */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {selectedTableLive && !isCreatingDirectOrder && !isAddingItems && checkoutOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="absolute inset-0" onClick={() => setSelectedTable(null)} />
            <div className="relative flex flex-col bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-2xl z-10 w-full max-w-5xl h-[85vh] overflow-hidden">
              
              {/* Header bar with close button only */}
              <div className="flex justify-end p-4 pb-0 bg-white dark:bg-[#0d0d0d]">
                <button
                  onClick={() => setSelectedTable(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* TWO-COLUMN CHECKOUT PANEL */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white dark:bg-[#0d0d0d] p-6 gap-6" style={{ minHeight: 0 }}>
                
                {/* Left Column: Bill Receipt Summary */}
                <div className="md:w-[45%] flex flex-col h-full border border-slate-200/60 dark:border-white/5 rounded-2xl bg-slate-50 dark:bg-white/2 p-5 overflow-hidden">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-white/30 mb-3">Bill Receipt</h3>
                  <div className="flex-1 overflow-y-auto pr-1">
                    <div className="flex flex-col space-y-4 h-full">
                      {/* Bill Info Grid */}
                      <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-white/5 rounded-xl p-4">
                        <div className="space-y-1">
                          <span className="text-slate-400 dark:text-white/30 uppercase text-[9px] font-black tracking-wider block">Invoice ID</span>
                          <span className="font-extrabold text-slate-800 dark:text-white text-sm">INV-{checkoutOrder.id}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-400 dark:text-white/30 uppercase text-[9px] font-black tracking-wider block">Parcel Counter</span>
                          <span className="font-extrabold text-slate-800 dark:text-white text-sm">{selectedTableLive.table_name}</span>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <span className="text-slate-400 dark:text-white/30 uppercase text-[9px] font-black tracking-wider block">Date & Time</span>
                          <span className="font-bold text-slate-600 dark:text-slate-300 text-xs">
                            {checkoutOrder.created_at
                              ? formatDateTimeDDMMYYYY(checkoutOrder.created_at)
                              : formatDateTimeDDMMYYYY(new Date())}
                          </span>
                        </div>
                      </div>

                      {/* Ordered Items Table */}
                      <div className="flex-1 bg-white dark:bg-white/2 border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden min-h-0 flex flex-col">
                        <div className="overflow-y-auto flex-1">
                          <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#1a1a1a]">
                              <tr className="border-b border-slate-200 dark:border-white/5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-white/40">
                                        <th className="p-3">Item</th>
                                        <th className="p-3 text-center">Qty</th>
                                        <th className="p-3 text-right">Price</th>
                                        <th className="p-3 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs text-slate-700 dark:text-slate-200 font-semibold">
                              {checkoutOrder.items && checkoutOrder.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                                  <td className="p-3">
                                    <span className="font-extrabold text-slate-800 dark:text-white block">{item.name}</span>
                                    {item.note && (
                                      <span className="text-[9px] text-amber-500 italic block mt-0.5">* Note: {item.note}</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center font-extrabold text-slate-900 dark:text-white">{item.quantity}</td>
                                  <td className="p-3 text-right text-slate-500 dark:text-white/40 font-bold">{formatCurrency(item.price)}</td>
                                  <td className="p-3 text-right font-black text-slate-900 dark:text-white">{formatCurrency(item.price * item.quantity)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Calculations Breakdown */}
                      <div className="space-y-2.5 bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-white/5 rounded-xl p-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400 uppercase tracking-wider text-[10px]">Subtotal:</span>
                          <span className="text-slate-900 dark:text-white font-extrabold">{formatCurrency(checkoutOrder.subtotal)}</span>
                        </div>

                        {cgstRate > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-400 uppercase tracking-wider text-[10px]">CGST ({cgstRate}%):</span>
                            <span className="text-slate-900 dark:text-white font-extrabold">{formatCurrency(checkoutOrder.cgst)}</span>
                          </div>
                        )}

                        {sgstRate > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-400 uppercase tracking-wider text-[10px]">SGST ({sgstRate}%):</span>
                            <span className="text-slate-900 dark:text-white font-extrabold">{formatCurrency(checkoutOrder.sgst)}</span>
                          </div>
                        )}

                        {Math.max(
                          0,
                          Number(checkoutOrder.grand_total) -
                            Number(checkoutOrder.subtotal) -
                            Number(checkoutOrder.cgst) -
                            Number(checkoutOrder.sgst)
                        ) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-400 uppercase tracking-wider text-[10px]">Service Charge ({serviceChargeRate}%):</span>
                            <span className="text-slate-900 dark:text-white font-extrabold">
                              {formatCurrency(
                                Math.max(
                                  0,
                                  Number(checkoutOrder.grand_total) -
                                    Number(checkoutOrder.subtotal) -
                                    Number(checkoutOrder.cgst) -
                                    Number(checkoutOrder.sgst)
                                )
                              )}
                            </span>
                          </div>
                        )}

                        <div className="border-t border-slate-200 dark:border-white/5 pt-2 flex justify-between items-center text-sm font-black text-slate-800 dark:text-white">
                          <span className="uppercase tracking-wider text-xs">Grand Total:</span>
                          <span className="text-lg text-[#ff6b00]">{formatCurrency(checkoutOrder.grand_total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Checkout Controls & Action Buttons */}
                <div className="flex-1 flex flex-col h-full justify-between border border-slate-200/60 dark:border-white/5 rounded-2xl p-5 bg-white dark:bg-white/[0.01]">
                  
                  {/* Top: Payment Mode and Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-white/30">Checkout Settings</h3>
                    
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-white/2 border border-slate-100 dark:border-white/5 rounded-xl">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Payment Mode</span>
                      <div className="flex gap-1.5">
                        {['CASH', 'UPI', 'CARD'].map(mode => (
                          <button
                            key={mode}
                            onClick={() => setSelectedPaymentMode(mode)}
                            className={`px-4 py-2 text-[10px] font-black rounded-lg cursor-pointer transition-all ${
                              selectedPaymentMode === mode
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-white/5 hover:bg-slate-100'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Action Buttons */}
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                    {/* Row 1: Save, Save & Print, Save & EBill */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => setSelectedTable(null)}
                        className="flex-1 px-4 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => handleThermalPrintDirect(selectedTableLive, checkoutOrder, false)}
                        className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                      >
                        Save & Print
                      </button>
                      <button
                        disabled={checkoutOrder.status === 'COMPLETED'}
                        onClick={() => handleCompletePayment(checkoutOrder.id, false)}
                        className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save & EBill
                      </button>
                    </div>

                    {/* Row 2: Cancel Order, New Order */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        disabled={checkoutOrder.status === 'COMPLETED'}
                        onClick={() => handleCancelBill(checkoutOrder.id)}
                        className="flex-1 px-4 py-3 bg-slate-500 hover:bg-slate-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel Order
                      </button>
                      <button
                        disabled={checkoutOrder.status === 'COMPLETED'}
                        onClick={openAddMoreItems}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        New Order
                      </button>
                    </div>

                    {/* Row 3: Settle & Save (stands out) */}
                    <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-white/40 uppercase">Settlement Amount:</span>
                        <span className="text-sm font-black text-slate-800 dark:text-white">
                          {formatCurrency(checkoutOrder.grand_total)}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (checkoutOrder.status === 'COMPLETED') {
                            setSelectedTable(null);
                            setIsAddingItems(false);
                            setIsCreatingDirectOrder(false);
                            setAdditionalItems([]);
                          } else {
                            handleCompletePayment(checkoutOrder.id, true);
                          }
                        }}
                        className="w-full sm:w-auto px-8 py-3.5 bg-rose-800 hover:bg-rose-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-800/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                      >
                        {checkoutOrder.status === 'COMPLETED' ? 'Close' : 'Settle & Save'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ADD / EDIT TABLE MODAL */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {(isAddTableOpen || editingTable) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => { setIsAddTableOpen(false); setEditingTable(null); }} />
            <div className="relative w-full max-w-md bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 dark:border-white/5">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {editingTable ? 'Edit Parcel Table' : 'Add Parcel Table'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/40 font-bold mt-1.5 uppercase tracking-wide">
                  Configure parcel counter table variables
                </p>
              </div>
              <form onSubmit={editingTable ? handleEditTable : handleAddTable} className="p-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#d6b36a]/85 block pl-0.5">Parcel Code</label>
                  <input
                    type="text"
                    required
                    value={formTableNumber}
                    onChange={e => setFormTableNumber(e.target.value)}
                    placeholder="e.g. P1, P2, P10..."
                    disabled={actionLoading}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm focus:outline-none focus:border-[#ff6b00]"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => { setIsAddTableOpen(false); setEditingTable(null); }}
                    disabled={actionLoading}
                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 rounded-2xl font-black text-xs uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-[#ff6b00] to-[#ff8524] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20"
                  >
                    {actionLoading ? 'Saving...' : (editingTable ? 'Save Changes' : 'Create Table')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* MANAGE TABLES LIST MODAL */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {isManageTablesOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setIsManageTablesOpen(false)} />
            <div className="relative w-full max-w-2xl bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
              <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Manage Parcel Tables
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-white/40 font-bold mt-1 uppercase tracking-wide">
                    Delete or update active parcel tables layout
                  </p>
                </div>
                <button
                  onClick={() => setIsManageTablesOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {parcelTables.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 font-bold text-xs">No parcel tables created yet.</div>
                ) : (
                  parcelTables.map((table) => (
                    <div key={table.id} className="flex items-center justify-between bg-slate-50 dark:bg-white/2 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                      <div>
                        <span className="text-base font-black text-slate-900 dark:text-white">{table.table_name}</span>
                        <span className="text-xs text-slate-400 font-bold ml-2">({table.table_number})</span>
                        <div className="flex gap-2.5 mt-1">
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Sort Order: {table.display_order || 0}</span>
                          <span className={`text-[9px] font-black uppercase tracking-wider ${table.is_active ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {table.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            startEditing(table);
                            setIsManageTablesOpen(false);
                          }}
                          className="p-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 text-slate-700 dark:text-white rounded-xl transition-all cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTable(table.id)}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
