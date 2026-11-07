import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
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
  Save,
  Receipt
} from 'lucide-react';
import AdminLayout from '../../../shared/layouts/AdminLayout';
import socket from '../../../shared/services/socketClient';
import { getAudioContext } from '../../../shared/services/audioHelper';
import { API_BASE, authorizedFetch } from '../../../shared/services/apiBase';
import { formatCurrencyWithSettings, getCachedSystemSettings } from '../../../shared/services/systemSettings';
import { getCachedMenu, setCachedMenu } from '../../../shared/services/menuCache';
import axios from 'axios';
import DiningTimer from '../../../shared/components/DiningTimer';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../../utils/dateFormatter';

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

export default function OrdersPage() {
  // Sync state
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
  const [error, setError] = useState(null);
  const printingKotIds = useRef(new Set());
  const menuSearchInputRef = useRef(null);
  const [captainRequests, setCaptainRequests] = useState([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [completedBills, setCompletedBills] = useState(0);
  const [parcels, setParcels] = useState([]);
  const [systemSettings, setSystemSettings] = useState(getCachedSystemSettings());
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('CASH');
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
    console.log(`[DEBUG] onPrintJobAcknowledgedLocal called for jobId: ${jobId}, tableName: ${tableName}, jobType: ${jobType}.`);
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

  // Refs for concurrent fetch guards
  const isFetchingTablesRef = useRef(false);
  const isFetchingOrdersRef = useRef(false);
  const isFetchingSalesRef = useRef(false);
  const isFetchingParcelsRef = useRef(false);

  // Navigation & filter tab state
  // sections is derived dynamically from the tables API response (unique section_names)
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null); // null until first API load
  const [selectedTable, setSelectedTable] = useState(null);

  // Add More Items state (for existing orders)
  const [isAddingItems, setIsAddingItems] = useState(false);
  // Direct billing state (for available tables with no active order)
  const [isCreatingDirectOrder, setIsCreatingDirectOrder] = useState(false);

  // Auto-focus the menu search input whenever the menu panel becomes visible
  useEffect(() => {
    if (isAddingItems || isCreatingDirectOrder) {
      // Small delay to allow modal animation to complete before focusing
      const timer = setTimeout(() => {
        menuSearchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAddingItems, isCreatingDirectOrder]);

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

  const [isSubmittingDirectOrder, setIsSubmittingDirectOrder] = useState(false);

  // Shared menu selector state (used by both isAddingItems and isCreatingDirectOrder)
  const [additionalItems, setAdditionalItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuSearchTerm, setMenuSearchTerm] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState('All');
  const [menuTypeFilter, setMenuTypeFilter] = useState('All');
  const [isSubmittingAdditional, setIsSubmittingAdditional] = useState(false);
  const [menuSearchHighlightedIndex, setMenuSearchHighlightedIndex] = useState(0);

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());
  const [connectionStatus, setConnectionStatus] = useState(socket.connected ? 'connected' : 'disconnected');

  const playAlertChime = () => {
    const soundEnabled = localStorage.getItem('mejwani_voice_announcement_enabled') !== 'false';
    if (!soundEnabled) return;

    try {
      const ctx = getAudioContext();
      if (!ctx) return;

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
      console.warn('Audio Context blocked by client policies:', e);
    }
  };

  const formatServiceTime = (createdAt) => {
    try {
      return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'N/A';
    }
  };



  // Load menu items for Add More Items flow
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
      console.error('[Orders] Failed to load menu items:', err);
    }
  };

  // Derived menu helpers
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
      const matchesSearch = [item.name, item.marathiName, item.category, item.code, item.shortcode]
        .filter(Boolean).join(' ').toLowerCase().includes(menuSearchTerm.toLowerCase());
      const matchesCategory = menuCategoryFilter === 'All' || item.category === menuCategoryFilter;
      const matchesType = menuTypeFilter === 'All' || item.type === menuTypeFilter;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [expandedMenuItems, menuSearchTerm, menuCategoryFilter, menuTypeFilter]);

  useEffect(() => {
    setMenuSearchHighlightedIndex(0);
  }, [menuSearchTerm, filteredMenuItems.length]);

  const additionalSubtotal = useMemo(() =>
    additionalItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [additionalItems]);

  // Add item to the additional items cart
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

  // Submit additional items — calls PUT /orders/:id/append-items
  // Silent append: no KOT, no kitchen notification, no table status change.
  // Backend upserts items and recalculates totals. Response includes full updated items list.
  const handleSubmitAdditionalItems = async (options = {}) => {
    if (!activeOrderForSelectedTable || !selectedTableLive) return;

    if (additionalItems.length === 0) {
      toast.error('Cart cannot be empty. Please keep at least one item or cancel the bill.', {
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
      return;
    }

    // Calculate deltas between cart and original items
    const itemsToSubmit = [];
    const originalItems = activeOrderForSelectedTable.items || [];

    // 1. Calculate deltas for existing items
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
        // Removed entirely
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

    // 2. Add completely new items
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
        printKot: !!options.printKot
      };

      const orderId = activeOrderForSelectedTable.id;
      const res = await axios.put(
        `${API_BASE}/orders/${orderId}/append-items${hotelParam}`,
        payload
      );

      if (res.data.success) {
        // Optimistically update the local orders state with returned data
        // so the billing modal refreshes instantly without waiting for the poll cycle
        const updatedOrderData = res.data.data;
        setOrders(prev => prev.map(o =>
          o.id === orderId
            ? {
              ...o,
              subtotal: updatedOrderData.subtotal,
              cgst: updatedOrderData.cgst,
              sgst: updatedOrderData.sgst,
              grand_total: updatedOrderData.grand_total,
              items: updatedOrderData.items
            }
            : o
        ));

        toast.success(`✅ Bill updated successfully.`, {
          style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });

        // Trigger manual KOT printing if requested
        if (options.printKot && updatedOrderData) {
          const deltaItems = updatedOrderData.deltaItems || [];
          triggerManualKOTPrint(updatedOrderData, deltaItems);
        }

        // Reset add-more mode and return to billing modal
        setIsAddingItems(false);
        setAdditionalItems([]);
        setMenuSearchTerm('');
        setMenuCategoryFilter('All');
        setMenuTypeFilter('All');
      } else {
        throw new Error(res.data.message || 'Failed to update bill');
      }
    } catch (err) {
      console.error('[Orders] handleSubmitAdditionalItems failed:', err);
      toast.error(`❌ Failed to update bill: ${err.message}`, {
        style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
      });
    } finally {
      setIsSubmittingAdditional(false);
    }
  };

  // Open Add More Items mode
  const openAddMoreItems = () => {
    if (activeOrderForSelectedTable && activeOrderForSelectedTable.items) {
      setAdditionalItems(activeOrderForSelectedTable.items.map(item => ({
        cartId: `${item.menu_item_id}_${item.portion_type || 'FULL'}`,
        menuItemId: item.menu_item_id,
        portionType: item.portion_type || 'FULL',
        name: item.name,
        marathiName: item.marathiName || '',
        quantity: item.quantity,
        price: parseFloat(item.price || 0),
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

  // Close Add More Items mode
  const closeAddMoreItems = () => {
    setIsAddingItems(false);
    setAdditionalItems([]);
    setMenuSearchTerm('');
  };

  // Open direct order creation mode for available tables
  const openDirectOrder = () => {
    setAdditionalItems([]); // shared cart
    setMenuSearchTerm('');
    setMenuCategoryFilter('All');
    setMenuTypeFilter('All');
    loadMenuItems();
    setIsCreatingDirectOrder(true);
  };

  const closeDirectOrder = () => {
    setIsCreatingDirectOrder(false);
    setAdditionalItems([]); // shared cart
    setMenuSearchTerm('');
  };

  // Auto-open direct order mode whenever a table with no active order is selected.
  // Decision is based purely on whether an active order exists — table status is irrelevant.
  // CAPTAIN_REQUESTED / customer_present must NOT block the admin from creating a new bill.
  const prevSelectedTableIdRef = React.useRef(null);
  useEffect(() => {
    if (!selectedTable) {
      prevSelectedTableIdRef.current = null;
      return;
    }
    // Only trigger when the selected table changes (not on every poll cycle)
    if (selectedTable.id === prevSelectedTableIdRef.current) return;
    prevSelectedTableIdRef.current = selectedTable.id;

    const hasActiveOrder = orders.some(
      o => o.table_id === selectedTable.id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
    );
    if (!hasActiveOrder) {
      // No active order on this table → open New Bill menu directly
      openDirectOrder();
    } else {
      // Table has an active order → show Order Details / billing modal
      setIsCreatingDirectOrder(false);
    }
  }, [selectedTable?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Triggers manual KOT printing (with browser fallback if local agent is offline/fails)
  const triggerManualKOTPrint = async (order, deltaItems) => {
    if (!deltaItems || deltaItems.length === 0) return;
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';

      // Prepare KOT data format expected by /print-kot
      const kotData = {
        title: systemSettings?.printing?.kotTitle || 'KITCHEN ORDER TICKET',
        hotelName: systemSettings?.branding?.name || 'MEJWANI',
        tableName: order.table_name || order.table_number || 'COUNTER',
        sectionName: order.section_name || 'MAIN',
        captainName: order.captain_name || 'ADMIN',
        orderId: order.kot_number || order.id,
        dateTime: formatDateTimeDDMMYYYY(new Date()),
        items: deltaItems.map(item => ({
          name: item.name || item.itemName,
          quantity: item.quantity || item.qty || 1,
          note: item.note
        }))
      };

      // Call background direct network print endpoint
      const printRes = await fetch(`${API_BASE}/orders/print-kot?hotelId=${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kotData)
      });

      const printData = await printRes.json();
      if (!printData.success) {
        if (printData.code === 'PRINTER_NOT_CONFIGURED' || printData.code === 'PRINTER_OFFLINE') {
          showPrinterErrorToast(printData.message, `kot-manual-fail-${order.id}`);
          return;
        }
        throw new Error(printData.message || 'Direct print request failed');
      }

      const jobId = printData.jobId;
      console.log('[DEBUG] Print job created (Manual-KOT):', jobId);

      if (typeof window.mejwani_start_ack_timeout === 'function') {
        window.mejwani_start_ack_timeout(jobId, 'KOT');
      }

      // Try local print first
      let localPrintSuccess = false;
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalHost) {
        try {
          console.log('[DEBUG] Local agent print started (Manual-KOT):', jobId);
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
            console.log('[DEBUG] Local print success (Manual-KOT):', jobId);
            localPrintSuccess = true;
            onPrintJobAcknowledgedLocal(jobId, kotData.tableName, 'KOT');
          }
        } catch (localErr) {
          console.log('[DEBUG] Local print failure (Manual-KOT):', jobId, '. Cloud fallback triggered.', localErr.message);
        }
      }

      if (!localPrintSuccess) {
        console.log('[DEBUG] Cloud fallback triggered for Manual-KOT job:', jobId);
        if (isLocalHost) {
          fetch('http://127.0.0.1:9111/trigger-poll').catch(() => { });
        }
        onPrintJobAcknowledgedLocal(jobId, kotData.tableName, 'KOT');
      }

      // Sync state to get latest database fields
      syncOperationalState();
    } catch (err) {
      console.error(`[Manual-KOT] Failed to print KOT manually:`, err);
      toast.error(`❌ KOT printing failed: ${err.message}`, {
        style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
      });
    }
  };

  // Submit direct bill order — calls POST /orders/direct-bill
  // Creates a new order in BILL_PENDING state immediately, no KOT, no kitchen
  const handleCreateDirectOrder = async (options = {}) => {
    if (additionalItems.length === 0) {
      toast.error('Add at least one item to create a bill.', { style: { borderRadius: '10px', background: '#333', color: '#fff' } });
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
        printKot: !!options.printKot,
        items: additionalItems.map(item => ({
          menu_item_id: item.menuItemId,
          portion_type: item.portionType || 'FULL',
          name: item.name,
          marathiName: item.marathiName || '',
          quantity: item.quantity,
          price: item.price,
          note: item.note || ''
        }))
      };

      const res = await axios.post(`${API_BASE}/orders/direct-bill${hotelParam}`, payload);

      if (res.data.success) {
        const newOrder = res.data.data;
        // Inject the new order into local state immediately — billing modal opens
        setOrders(prev => [
          ...prev,
          {
            ...newOrder,
            status: 'BILL_PENDING',
            kotPrinted: true
          }
        ]);
        // Mark the table as bill_pending in local state
        setTables(prev => prev.map(t =>
          t.id === selectedTable.id ? { ...t, status: 'bill_pending' } : t
        ));

        // Exit direct order mode — billing modal will now show the active order
        setIsCreatingDirectOrder(false);
        setAdditionalItems([]);
        setMenuSearchTerm('');
        setMenuCategoryFilter('All');
        setMenuTypeFilter('All');

        toast.success(`✅ Bill created for ${selectedTable.table_name}.`, {
          style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });

        // Trigger manual KOT printing if requested
        if (options.printKot && newOrder) {
          const deltaItems = newOrder.deltaItems || newOrder.items || [];
          triggerManualKOTPrint(newOrder, deltaItems);
        }
      } else {
        throw new Error(res.data.message || 'Failed to create bill');
      }
    } catch (err) {
      console.error('[Orders] handleCreateDirectOrder failed:', err);
      toast.error(`❌ ${err.response?.data?.message || err.message}`, {
        style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
      });
    } finally {
      setIsSubmittingDirectOrder(false);
    }
  };

  // Memoized individual fetchers
  const fetchTables = useCallback(async (showSyncIndicator = false) => {
    isFetchingTablesRef.current = true;
    if (showSyncIndicator) setIsSyncing(true);
    const startTime = performance.now();
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
     const tablesRes = await authorizedFetch(
  `${API_BASE}/tables${hotelParam}${hotelParam ? '&' : '?'}t=${Date.now()}`
);

      const tablesData = await tablesRes.json();
      if (tablesData.success) {
        const fetchedTables = (tablesData.data || []).filter(t => t.section_name?.toUpperCase() !== 'PARCEL');
        setTables(fetchedTables);
        const uniqueSections = [...new Set(fetchedTables.map(t => t.section_name).filter(Boolean))];
        setSections(uniqueSections);
        setActiveSection(prev => prev === null ? 'ALL' : prev);
      }
    } catch (err) {
      console.error('[Orders] Fetch tables issue:', err);
    } finally {
      isFetchingTablesRef.current = false;
      if (showSyncIndicator) setIsSyncing(false);
      if (import.meta.env.DEV) {
        console.log(`[Timing] /tables fetched in ${(performance.now() - startTime).toFixed(2)}ms`);
      }
    }
  }, []);

  const fetchOrders = useCallback(async (showSyncIndicator = false) => {
    isFetchingOrdersRef.current = true;
    if (showSyncIndicator) setIsSyncing(true);
    const startTime = performance.now();
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
      const ordersRes = await fetch(`${API_BASE}/orders${hotelParam}${hotelParam ? '&' : '?'}t=${Date.now()}`);
      const ordersData = await ordersRes.json();
      if (ordersData.success) {
        const fetchedOrders = ordersData.data || [];
        setOrders(fetchedOrders);
      }
    } catch (err) {
      console.error('[Orders] Fetch orders issue:', err);
    } finally {
      isFetchingOrdersRef.current = false;
      if (showSyncIndicator) setIsSyncing(false);
      if (import.meta.env.DEV) {
        console.log(`[Timing] /orders fetched in ${(performance.now() - startTime).toFixed(2)}ms`);
      }
    }
  }, []);

  const fetchSales = useCallback(async (showSyncIndicator = false) => {
    isFetchingSalesRef.current = true;
    if (showSyncIndicator) setIsSyncing(true);
    const startTime = performance.now();
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
      const salesRes = await fetch(`${API_BASE}/orders/today/sales${hotelParam}${hotelParam ? '&' : '?'}t=${Date.now()}`);
      const salesData = await salesRes.json();
      if (salesData.success) {
        setTodayRevenue(salesData.data.totalRevenue);
        setCompletedBills(salesData.data.completedOrders);
      }
    } catch (err) {
      console.error('[Orders] Fetch sales issue:', err);
    } finally {
      isFetchingSalesRef.current = false;
      if (showSyncIndicator) setIsSyncing(false);
      if (import.meta.env.DEV) {
        console.log(`[Timing] /orders/today/sales fetched in ${(performance.now() - startTime).toFixed(2)}ms`);
      }
    }
  }, []);

  const fetchParcels = useCallback(async (showSyncIndicator = false) => {
    isFetchingParcelsRef.current = true;
    if (showSyncIndicator) setIsSyncing(true);
    const startTime = performance.now();
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const todayKey = new Date().toISOString().split('T')[0];
      const parcelsRes = await fetch(`${API_BASE}/parcels?date=${todayKey}${hotelId ? '&hotelId=' + hotelId : ''}&t=${Date.now()}`);
      const parcelsData = await parcelsRes.json();
      if (parcelsData.success) {
        setParcels(parcelsData.data || []);
      }
    } catch (err) {
      console.error('[Orders] Fetch parcels issue:', err);
    } finally {
      isFetchingParcelsRef.current = false;
      if (showSyncIndicator) setIsSyncing(false);
      if (import.meta.env.DEV) {
        console.log(`[Timing] /parcels fetched in ${(performance.now() - startTime).toFixed(2)}ms`);
      }
    }
  }, []);

  const fetchCaptainRequests = useCallback(async () => {
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
      const res = await fetch(`${API_BASE}/customer/active-captain-requests${hotelParam}${hotelParam ? '&' : '?'}t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setCaptainRequests(data.data || []);
      }
    } catch (err) {
      console.error('[Orders] Fetch captain requests issue:', err);
    }
  }, []);

  // Sync state from server concurrently
  const syncOperationalState = useCallback(async (showSyncIndicator = false) => {
    if (showSyncIndicator) setIsSyncing(true);
    const startTime = performance.now();
    try {
      await Promise.all([
        fetchTables(false),
        fetchOrders(false),
        fetchSales(false),
        fetchParcels(false),
        fetchCaptainRequests()
      ]);
      setLastSyncTime(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      console.error('[Orders] Real-time sync issue:', err);
      setError('Synchronizer received failure status.');
    } finally {
      setLoading(false);
      if (showSyncIndicator) setIsSyncing(false);
      if (import.meta.env.DEV) {
        console.log(`[Timing] syncOperationalState (all) completed in ${(performance.now() - startTime).toFixed(2)}ms`);
      }
    }
  }, [fetchTables, fetchOrders, fetchSales, fetchParcels, fetchCaptainRequests]);

  const syncTableState = useCallback(async () => {
    try {
      await Promise.all([
        fetchTables(false),
        fetchOrders(false)
      ]);
      setError(null);
    } catch (err) {
      console.error('[Orders] Real-time table status sync issue:', err);
    }
  }, [fetchTables, fetchOrders]);

  useEffect(() => {
    const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
    const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';

    syncOperationalState();

    const handleSettingsUpdated = () => setSystemSettings(getCachedSystemSettings());
    window.addEventListener('mejwani-settings-updated', handleSettingsUpdated);

    // Fallback sync every 30 seconds
    const timer = setInterval(() => {
      syncOperationalState(true);
    }, 30000);

    // Debounce timers using simple dictionary
    const debounceTimers = {
      sync: null,
      syncTable: null
    };

    const triggerDebounced = (key, fn) => {
      if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
      debounceTimers[key] = setTimeout(fn, 50);
    };

    const handleNewOrder = (payload) => {
      playAlertChime();
      triggerDebounced('sync', () => {
        syncOperationalState();
      });
    };

    const handleTableReleased = (payload) => {
      triggerDebounced('syncTable', () => {
        syncTableState();
      });
    };

    const handleVisitExpired = (payload) => {
      triggerDebounced('syncTable', () => {
        syncTableState();
      });
    };

    const handleTableActivity = (payload) => {
      triggerDebounced('syncTable', () => {
        syncTableState();
      });
    };

    // NOTE: customer_request toast + voice alerts are handled globally by
    // NotificationContext (mounts once, survives navigation).
    // We listen to the window CustomEvent here ONLY to do the optimistic
    // setCaptainRequests update that keeps the Orders UI in sync.
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
    };
    window.addEventListener('mejwani:customer-request', handleCustomerRequestData);

    // Ensure we join the hotel room for real-time dashboard sync immediately
    if (socket.connected && hotelId) {
      console.log('[SOCKET] Joining room on mount:', hotelId);
      socket.emit('join-hotel-room', `${hotelId}:admin`);
    }

    const onConnect = () => {
      setConnectionStatus('connected');
      if (hotelId) {
        console.log('[SOCKET] Joining room on connect:', hotelId);
        socket.emit('join-hotel-room', `${hotelId}:admin`);
      }
    };
    const onDisconnect = () => setConnectionStatus('disconnected');
    const onConnectError = () => setConnectionStatus('reconnecting');
    const onReconnectAttempt = () => setConnectionStatus('reconnecting');

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
      toast.success(`✅ KOT printed successfully for ${data.tableName}.`, {
        id: `kot-success-${data.jobId}`,
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
      console.log('[DEBUG ORDER] KOT window.mejwani_toasted_jobs.add(jobId) called');
      window.mejwani_toasted_jobs.add(jobIdStr);
      console.log('[DEBUG] Toast displayed: KOT for ' + data.tableName);
      console.log('[KOT] Toast displayed');
    };

    const handleKotPrintFailed = (data) => {
      console.log('[DEBUG] Socket kot_print_failed received:', data);
      if (!data || !data.jobId) return;
      if (typeof window.mejwani_clear_ack_timeout === 'function') {
        window.mejwani_clear_ack_timeout(data.jobId);
      }
      toast.error(`❌ KOT printing failed for ${data.tableName || 'Table'}: ${data.message || 'Printer offline'}`, {
        id: `kot-fail-${data.jobId}`,
        style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
      });
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

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('new-order', handleNewOrder);
    socket.on('table-released', handleTableReleased);
    socket.on('visit-expired', handleVisitExpired);
    socket.on('table-activity', handleTableActivity);
    socket.on('captain-acknowledged', handleTableActivity);
    socket.on('first_kot_printed', handleTableActivity);
    socket.on('bill_completed', handleTableReleased);
    socket.on('order-cancelled', handleTableReleased);
    socket.on('order-updated', handleTableActivity);
    socket.on('table-updated', handleTableActivity);
    socket.on('bill-created', handleTableActivity);
    socket.on('kot_print_acknowledged', handleKotPrintAcknowledged);
    socket.on('kot_print_failed', handleKotPrintFailed);
    socket.on('bill_print_acknowledged', handleBillPrintAcknowledged);

    // Initial check
    setConnectionStatus(socket.connected ? 'connected' : 'disconnected');

    return () => {
      clearInterval(timer);
      if (debounceTimers.sync) clearTimeout(debounceTimers.sync);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off('new-order', handleNewOrder);
      socket.off('table-released', handleTableReleased);
      socket.off('visit-expired', handleVisitExpired);
      socket.off('table-activity', handleTableActivity);
      socket.off('captain-acknowledged', handleTableActivity);
      socket.off('first_kot_printed', handleTableActivity);
      socket.off('bill_completed', handleTableReleased);
      socket.off('order-cancelled', handleTableReleased);
      socket.off('order-updated', handleTableActivity);
      socket.off('table-updated', handleTableActivity);
      socket.off('bill-created', handleTableActivity);
      socket.off('kot_print_acknowledged', handleKotPrintAcknowledged);
      socket.off('kot_print_failed', handleKotPrintFailed);
      socket.off('bill_print_acknowledged', handleBillPrintAcknowledged);
      window.removeEventListener('mejwani:customer-request', handleCustomerRequestData);
      window.removeEventListener('mejwani-settings-updated', handleSettingsUpdated);
    };
  }, [syncOperationalState, fetchTables, fetchOrders, fetchSales]);

  // Automatic Thermal Printer KOT Printing Listener
  useEffect(() => {
    if (!orders || orders.length === 0) return;

    // Filter unprinted orders
    const unprintedOrders = orders.filter(order => order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && order.kotPrinted === false);

    if (unprintedOrders.length === 0) return;

    unprintedOrders.forEach(async (order) => {
      if (printingKotIds.current.has(order.id)) {
        return; // Already in progress
      }

      // Add to tracking set to prevent concurrent duplicate printing
      printingKotIds.current.add(order.id);
      console.log(`[Auto-KOT] Found unprinted order ${order.id}. Starting print...`);

      try {
        const hotelId = order.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';

        // Prepare KOT data format expected by /print-kot
        const kotData = {
          title: systemSettings?.printing?.kotTitle || 'KITCHEN ORDER TICKET',
          hotelName: systemSettings?.branding?.name || 'MEJWANI',
          tableName: order.table_name || order.table_number || 'COUNTER',
          sectionName: order.section_name || 'MAIN',
          captainName: order.captain_name || 'ADMIN',
          orderId: order.kot_number || order.id,
          dateTime: order.created_at ? formatDateTimeDDMMYYYY(order.created_at) : formatDateTimeDDMMYYYY(new Date()),
          items: order.items.map(item => ({
            name: item.name || item.itemName,
            quantity: item.quantity || item.qty || 1,
            note: item.note
          }))
        };

        // Call background direct network print endpoint
        const printRes = await fetch(`${API_BASE}/orders/print-kot?hotelId=${hotelId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(kotData)
        });

        const printData = await printRes.json();
        if (!printData.success) {
          if (printData.code === 'PRINTER_NOT_CONFIGURED' || printData.code === 'PRINTER_OFFLINE') {
            showPrinterErrorToast(printData.message, `kot-auto-fail-${order.id}`);
            printingKotIds.current.delete(order.id);
            return;
          }
          throw new Error(printData.message || 'Direct print request failed');
        }

        const jobId = printData.jobId;
        console.log('[DEBUG] Print job created (Auto-KOT):', jobId);
        console.log(`[KOT] Print Job ID: ${jobId}`);

        if (typeof window.mejwani_start_ack_timeout === 'function') {
          window.mejwani_start_ack_timeout(jobId, 'KOT');
        }

        // Try local print first
        let localPrintSuccess = false;
        const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalHost) {
          try {
            console.log('[DEBUG] Local agent print started (Auto-KOT):', jobId);
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
              console.log('[DEBUG] Local print success (Auto-KOT):', jobId);
              localPrintSuccess = true;
              onPrintJobAcknowledgedLocal(jobId, kotData.tableName, 'KOT');
            }
          } catch (localErr) {
            console.log('[DEBUG] Local print failure (Auto-KOT):', jobId, '. Cloud fallback triggered.', localErr.message);
          }
        }

        if (!localPrintSuccess) {
          console.log('[DEBUG] Cloud fallback triggered for Auto-KOT job:', jobId);
          if (isLocalHost) {
            console.log('[KOT] Trigger poll called');
            fetch('http://127.0.0.1:9111/trigger-poll').catch(() => { });
          }
          onPrintJobAcknowledgedLocal(jobId, kotData.tableName, 'KOT');
        }

        console.log(`[Auto-KOT] Order ${order.id} queued successfully. Triggering state sync...`);

        // Trigger manual refresh to get the updated status immediately (updated status already set by print-kot endpoint)
        syncOperationalState();

      } catch (err) {
        console.error(`[Auto-KOT] Failed to auto-print order ${order.id}:`, err);

        // Remove from tracking set so it can be retried on next operational state sync
        printingKotIds.current.delete(order.id);

        toast.error(`❌ Auto-print failed for ${order.table_name || 'order'}: ${err.message}`, {
          id: `kot-auto-fail-${order.id}`,
          style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
        });
      }
    });
  }, [orders, systemSettings]);


  // Monitor incoming orders to detect newly arrived bill requests
  // Update selected table reference when database table list refreshes
  const selectedTableLive = useMemo(() => {
    if (!selectedTable) return null;
    return tables.find(t => t.id === selectedTable.id) || null;
  }, [tables, selectedTable]);

  // Find active orders belonging to this table
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

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isAddingItems) {
          closeAddMoreItems(); // First Escape: exit add-more mode, stay on billing modal
        } else if (isCreatingDirectOrder) {
          closeDirectOrder(); // First Escape: exit new-order mode, close modal (no active order)
          setSelectedTable(null);
        } else {
          setSelectedTable(null);
        }
      }
    };
    if (selectedTable) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTable, isAddingItems, isCreatingDirectOrder]);

  // Filter tables by operational area section
  const sectionTables = useMemo(() => {
    if (activeSection === 'ALL' || !activeSection) {
      return tables;
    }
    return tables.filter(t => t.section_name === activeSection);
  }, [tables, activeSection]);

  const tablesByArea = useMemo(() => {
    return tables.reduce((acc, table) => {
      const area = table.section_name || 'GENERAL';
      if (!acc[area]) acc[area] = [];
      acc[area].push(table);
      return acc;
    }, {});
  }, [tables]);

  const sortedAreas = useMemo(() => {
    return Object.keys(tablesByArea).sort((a, b) => {
      const orderA = tablesByArea[a]?.[0]?.section_display_order ?? 999;
      const orderB = tablesByArea[b]?.[0]?.section_display_order ?? 999;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.localeCompare(b);
    });
  }, [tablesByArea]);

  // ── Dining timer lifecycle \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Watches the orders state and manages purely in-memory start/freeze/clear.
  // No DB timestamps are used. Every new OCCUPIED session starts from 00:00.

  // Handle billing payment checkout complete
  const handleCompletePayment = async (orderId, shouldClose = true) => {
    if (!orderId) return;
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      console.log('[Orders] handleCompletePayment — orderId:', orderId, '| hotelId:', hotelId);

      // Optimistic state update — mark table available + order completed immediately
      setTables(prev => prev.map(t => {
        const o = orders.find(ord => ord.id === orderId);
        if (o && t.id === o.table_id) {
          return { ...t, status: 'available' };
        }
        return t;
      }));
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'COMPLETED' } : o));
      
      if (shouldClose) {
        // Clear selected table panel so the UI reflects the freed table
        setSelectedTable(null);
        setIsAddingItems(false);
        setIsCreatingDirectOrder(false);
        setAdditionalItems([]);
      }

      // Use authorizedFetch so JWT token is sent — backend resolves hotel_id from it
      // Also pass hotelId as query param as explicit fallback for non-JWT paths
      const res = await authorizedFetch(
        `${API_BASE}/orders/pay/${orderId}?hotelId=${hotelId}`,
        { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMode: selectedPaymentMode || 'CASH' })
        }
      );
      const data = await res.json();
      console.log('[Orders] completePayment API response:', data);
      if (data.success) {
        // Confirmed — refresh live state from server in background
        fetchTables();
        fetchOrders();
        fetchSales();
      } else {
        console.error('[Orders] completePayment failed:', data.message);
        toast.error(data.message || 'Failed to complete payment.');
        // Revert optimistic update on failure
        fetchTables();
        fetchOrders();
        fetchSales();
      }
    } catch (err) {
      console.error('Failed to checkout:', err);
      toast.error('Failed to connect to server to complete payment.');
      fetchTables();
      fetchOrders();
      fetchSales();
    }
  };

  const handleCancelBill = async (orderId) => {
    if (!orderId) return;

    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';

      const res = await authorizedFetch(
        `${API_BASE}/bills/${orderId}/cancel?hotelId=${hotelId}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      const data = await res.json();
      if (data.success) {
        toast.success("✅ Bill cancelled successfully.", {
          style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });
        setSelectedTable(null);
        fetchTables();
        fetchOrders();
        fetchSales();
      } else {
        throw new Error(data.message || "Failed to cancel bill");
      }
    } catch (err) {
      console.error('[Orders] handleCancelBill failed:', err);
      toast.error(`❌ ${err.message}`, {
        style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
      });
    }
  };

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
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    body {
      width: 80mm;
      margin: 0;
      padding: 8px;
      box-sizing: border-box;
    }
    
    .receipt {
      width: 100%;
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
      width: 100%;
      height: 1px;
    }
    
    .double-divider {
      border-top: 3px double #000000;
      margin: 6px 0;
      width: 100%;
      height: 3px;
    }
    
    .footer {
      margin-top: 15px;
      font-size: 10px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- HEADER -->
    <div class="center">
      <div class="title">${hotelName}</div>
      ${address ? `<div class="subtitle">${address}</div>` : ""}
      ${phone ? `<div class="subtitle">Phone: ${phone}</div>` : ""}
      ${gstNumber ? `<div class="subtitle">GSTIN: ${gstNumber}</div>` : ""}
    </div>
    
    <div class="divider"></div>

    <!-- META DETAILS -->
    <table style="width: 100%; font-size: 10px; font-weight: bold; margin-bottom: 2px; border-collapse: collapse;">
      <tr>
        <td style="text-align: left; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">Table: ${tableNumber}</td>
        <td style="text-align: right; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">Capt: ${captainName || 'ADMIN'}</td>
      </tr>
      <tr>
        <td colspan="2" style="text-align: left; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">Date & Time: ${dateTime}</td>
      </tr>
      <tr>
        <td colspan="2" style="text-align: left; padding: 1px 0; font-family: 'Courier New', Courier, monospace;">Order ID: ${orderId}</td>
      </tr>
    </table>

    <div class="divider"></div>

    <!-- ITEMS TABLE -->
    <table style="width: 100%; border-collapse: collapse; margin-top: 5px; table-layout: fixed;">
      <thead>
        <tr style="border-bottom: 1px dashed #000000;">
          <th style="width: 55%; text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; padding-bottom: 3px; font-family: 'Courier New', Courier, monospace;">Item Description</th>
          <th style="width: 15%; text-align: right; font-size: 10px; font-weight: 900; text-transform: uppercase; padding-bottom: 3px; font-family: 'Courier New', Courier, monospace; padding-right: 5px;">Qty</th>
          <th style="width: 30%; text-align: right; font-size: 10px; font-weight: 900; text-transform: uppercase; padding-bottom: 3px; font-family: 'Courier New', Courier, monospace;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="divider"></div>

    <!-- FINANCIALS -->
    <table style="width: 100%; font-size: 11px; font-weight: bold; margin-top: 5px; border-collapse: collapse; font-family: 'Courier New', Courier, monospace;">
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

    <table style="width: 100%; font-size: 14px; font-weight: 900; border-collapse: collapse; font-family: 'Courier New', Courier, monospace;">
      <tr>
        <td style="text-align: left;">GRAND TOTAL</td>
        <td style="text-align: right;">${printCurrency}${parseFloat(grandTotal).toFixed(0)}</td>
      </tr>
    </table>

    <!-- FOOTER -->
    <div class="divider"></div>
    <div class="center footer">
      <div class="bold">THANK YOU VISIT AGAIN</div>
    </div>

    <!-- FEED SPACING FOR AUTO-CUT -->
    <div style="height: 35px; clear: both;"></div>
    <div class="center" style="font-size: 8px; color: #888888; font-family: 'Courier New', Courier, monospace;">- End of Receipt -</div>
    <div style="height: 10px; clear: both;"></div>
  </div>
</body>
</html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Set the onload hook on the new window
    printWindow.onload = function () {
      setTimeout(function () {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    };

    // Fallback if readyState is already complete
    if (printWindow.document.readyState === 'complete') {
      setTimeout(function () {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const handleThermalPrintDirect = async (billData, suppressToast = false) => {
    if (printerConfig && !printerConfig.bill) {
      showPrinterErrorToast('Bill Printer is not configured.', 'bill-print-error');
      return;
    }
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
      const tableName = billData.tableNumber ? billData.tableNumber.split(' (')[0] : 'Table';

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

  const printThermalBill = (table, order, suppressToast = false) => {
    if (!table || !order) {
      return;
    }

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

    handleThermalPrintDirect(billData, suppressToast);
  };

  const handlePrintAndCompleteBill = (orderId) => {
    // Validate printer configuration immediately client-side
    if (printerConfig && !printerConfig.bill) {
      showPrinterErrorToast('Bill Printer is not configured.', 'bill-print-error');
      return;
    }

    // Generate final invoice thermal print
    if (selectedTableLive && activeOrderForSelectedTable) {
      printThermalBill(selectedTableLive, activeOrderForSelectedTable, false);
    }
    // Complete payment in background
    handleCompletePayment(orderId);
  };

  const handleRejectRequest = async (table) => {
    try {
      // 1. Instantly update the UI states in the local screen
      setCaptainRequests(prev => prev.filter(r => r.table_id !== table.id));
      setTables(prev => prev.map(t => {
        if (t.id === table.id) {
          return { ...t, status: 'available', occupied_at: null };
        }
        return t;
      }));

      // 2. Call the backend API to reject/clear the request
      const hotelId = localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
      const res = await fetch(`${API_BASE}/customer/reject-captain-request${hotelParam}`, {
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
      toast.success("Request rejected");
    } catch (err) {
      console.error("Failed to reject captain request:", err);
      toast.error(`Error: ${err.message}`);
      // Re-fetch in case of failure to align state
      fetchCaptainRequests();
      fetchTables();
    }
  };

  const getTableDisplayStatus = (table) => {
    const order = orders.find(o => o.table_id === table.id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
    if (order) {
      return order.status === 'BILL_PENDING' ? 'bill_pending' : 'occupied';
    }
    const hasActiveRequest = captainRequests.some(r => r.table_id === table.id && (r.status === 'CAPTAIN_REQUESTED' || r.status === 'PENDING'));
    if (hasActiveRequest && table.status === 'available') {
      return 'customer_present';
    }
    return table.status;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'occupied':
        return (
          <span className="inline-flex items-center gap-1 py-0.5 px-2.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[8px] font-black uppercase text-rose-500 tracking-wider">
            <span className="w-1 h-1 bg-rose-500 rounded-full animate-ping" />
            OCCUPIED
          </span>
        );
      case 'bill_pending':
        return (
          <span className="inline-flex items-center gap-1 py-0.5 px-2.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[8px] font-black uppercase text-amber-500 tracking-wider">
            <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
            BILL PENDING
          </span>
        );
      case 'customer_present':
        return (
          <span className="inline-flex items-center gap-1 py-0.5 px-2.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[8px] font-black uppercase text-orange-500 tracking-wider animate-pulse">
            <span className="w-1 h-1 bg-orange-500 rounded-full animate-bounce" />
            CUSTOMER REQUEST
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 py-0.5 px-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black uppercase text-emerald-500 tracking-wider">
            <span className="w-1 h-1 bg-emerald-500 rounded-full" />
            AVAILABLE
          </span>
        );
    }
  };

  const getTableColorClass = (table) => {
    const isSelected = selectedTableLive?.id === table.id;
    const displayStatus = getTableDisplayStatus(table);

    if (displayStatus === 'occupied') {
      return isSelected
        ? 'bg-rose-100 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-200 shadow-md ring-2 ring-rose-500/30'
        : 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-500/30 dark:border-rose-500/10 text-rose-800 dark:text-rose-400 hover:border-rose-500/60 shadow-sm';
    } else if (displayStatus === 'bill_pending') {
      return isSelected
        ? 'bg-amber-100 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-200 shadow-md ring-2 ring-amber-500/30'
        : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-500/30 dark:border-amber-500/10 text-amber-800 dark:text-amber-400 hover:border-amber-500/60 shadow-sm';
    } else if (displayStatus === 'customer_present') {
      return isSelected
        ? 'bg-orange-100 dark:bg-orange-950/40 border-orange-500 text-orange-900 dark:text-orange-200 shadow-md ring-2 ring-orange-500/30 animate-pulse'
        : 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-500/30 dark:border-orange-500/10 text-orange-800 dark:text-orange-400 hover:border-orange-500/60 shadow-sm animate-pulse';
    } else {
      // Available / Ready (Green)
      return isSelected
        ? 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-md ring-2 ring-emerald-500/30'
        : 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-500/20 dark:border-emerald-500/5 text-emerald-800 dark:text-emerald-400 hover:border-emerald-500/50 shadow-sm';
    }
  };

  return (
    <AdminLayout>
      <div className="-mt-6 space-y-4 w-full max-w-full overflow-visible">
        
        {/* Issued Bills Option */}
        <div className="flex justify-end items-center mb-1">
          <a
            href="/admin/bills"
            className="flex items-center gap-2 px-4.5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-orange-500/10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            Issued Bills
          </a>
        </div>

        {/* Dashboard layout */}
        <div className="flex flex-col lg:flex-row gap-6 h-auto w-full overflow-visible">

          {/* Left: Interactive Section Layout & Tables Grid */}
          <div className="w-full flex flex-col pr-2 overflow-visible">

            {loading ? (
              <div className="space-y-6 max-w-full">
                <div className="h-6 w-48 bg-slate-200 dark:bg-white/5 rounded-md animate-pulse pl-3 border-l-4 border-primary/20" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="p-3 rounded-xl border-2 border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] min-h-[120px] animate-pulse flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center w-full mb-3">
                          <div className="h-4 w-12 bg-slate-200 dark:bg-white/10 rounded" />
                          <div className="h-3 w-8 bg-slate-200 dark:bg-white/10 rounded" />
                        </div>
                        <div className="h-6 w-20 bg-slate-200 dark:bg-white/10 rounded mt-2" />
                      </div>
                      <div className="h-3 w-16 bg-slate-200 dark:bg-white/10 rounded mt-4" />
                    </div>
                  ))}
                </div>
              </div>
            ) : sortedAreas.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 py-16 bg-white dark:bg-[#0d0d0d] border-2 border-dashed border-slate-200 dark:border-white/5 rounded-3xl max-w-2xl mx-auto shadow-sm my-6 transition-all duration-300">
                <div className="w-20 h-20 bg-[#ff6b00]/10 rounded-full flex items-center justify-center text-[#ff6b00] mb-6">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                  Welcome to Your Restaurant Panel!
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md leading-relaxed">
                  It looks like you've just onboarded this hotel. To start taking captain orders and managing bills, you need to set up your restaurant tables first.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <a
                    href="/admin/tables"
                    className="px-6 py-3 bg-[#ff6b00] hover:bg-[#e66000] text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Configure Tables <Plus className="w-4 h-4" />
                  </a>
                  <a
                    href="/admin/hotel-menu"
                    className="px-6 py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-xl font-black text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Set Up Hotel Menu
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                {sortedAreas.map(area => (
                  <section key={area} className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-wider pl-3 border-l-4 border-primary">
                      {area}
                    </h2>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {tablesByArea[area]?.map((table) => {
                        const displayStatus = getTableDisplayStatus(table);
                        const order = orders.find(o => o.table_id === table.id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
                        const isOccupied = displayStatus === 'occupied' || displayStatus === 'bill_pending' || !!order;
                        const isCustomerPresent = displayStatus === 'customer_present';

                        return (
                          <div
                            key={table.id}
                            onClick={() => setSelectedTable(table)}
                            className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between items-center text-center min-h-[110px] cursor-pointer ${getTableColorClass(table)}`}
                          >
                            {/* Top part: Elapsed Time or Reject button */}
                            <div className="text-[10px] font-black uppercase tracking-wider min-h-[16px] w-full flex justify-center">
                              {isCustomerPresent ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectRequest(table);
                                  }}
                                  className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded shadow-sm transition-all cursor-pointer"
                                >
                                  Reject
                                </button>
                              ) : isOccupied ? (
                                <DiningTimer
                                  occupiedAt={table.occupied_at || (order ? order.created_at : null)}
                                  isBillPending={displayStatus === 'bill_pending'}
                                />
                              ) : null}
                            </div>

                            {/* Middle part: Table Name (Centered, large) */}
                            <div className="text-2xl font-black tracking-tight mt-1">
                              {table.table_name}
                            </div>

                            {/* Status Badge */}
                            <div className="my-1.5">
                              {getStatusBadge(displayStatus)}
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
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>


          {/* Centered Modal: Live checkout invoice panel */}
          {selectedTableLive && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="absolute inset-0" onClick={() => { setSelectedTable(null); closeAddMoreItems(); closeDirectOrder(); }} />
              <div
                className={`relative flex flex-col bg-white dark:bg-[#0d0d0d] border-2 border-slate-100 dark:border-white/5 rounded-3xl shadow-2xl z-10 ${(isAddingItems || isCreatingDirectOrder)
                  ? 'w-[95vw] h-[90vh] overflow-hidden'
                  : 'w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden'
                  }`}
              >

                {/* ════════════════════════════════════════════════════════════════════ */}
                {/* MENU SELECTOR PANEL  (shared by Add-More-Items AND New-Direct-Order) */}
                {/* ════════════════════════════════════════════════════════════════════ */}
                {(isAddingItems || isCreatingDirectOrder) ? (
                  <>
                    {/* Header — adapts title/subtitle based on current mode */}
                    <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center gap-3 bg-slate-50/50 dark:bg-white/2">
                      <button
                        onClick={isCreatingDirectOrder ? () => { closeDirectOrder(); setSelectedTable(null); } : closeAddMoreItems}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-600 transition-all flex-shrink-0"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                          <PackagePlus className="w-5 h-5 text-[#ff6b00]" />
                          {isCreatingDirectOrder ? 'New Bill' : 'Add More Items'}
                        </h3>
                        <p className="text-[9px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mt-0.5">
                          {isCreatingDirectOrder
                            ? `${selectedTableLive.table_name} · ${selectedTableLive.section_name} · Direct Billing`
                            : `INV-${activeOrderForSelectedTable?.id} · ${selectedTableLive.table_name} · Same Session`
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

                    {/* Add More Items Body */}
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" style={{ minHeight: 0 }}>

                      {/* Left: Menu Grid */}
                      <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-100 dark:border-white/5">
                        {/* Search & Filters */}
                        <div className="p-4 space-y-2 border-b border-slate-100 dark:border-white/5 flex-shrink-0">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                              <input
                                ref={menuSearchInputRef}
                                value={menuSearchTerm}
                                onChange={e => setMenuSearchTerm(e.target.value)}
                                onKeyDown={handleMenuSearchKeyDown}
                                placeholder="Search menu..."
                                className="w-full rounded-xl border-2 py-2 pl-9 pr-3 text-xs font-bold outline-none transition-all border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d0d0d] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#ff6b00] focus:ring-2 focus:ring-orange-500/10"
                              />
                            </div>
                            <select
                              value={menuTypeFilter}
                              onChange={e => setMenuTypeFilter(e.target.value)}
                              className="rounded-xl border-2 py-2 px-3 text-xs font-bold outline-none border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d0d0d] text-slate-900 dark:text-white focus:border-[#ff6b00]"
                            >
                              <option value="All">ALL</option>
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
                          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 scrollbar-thin">
                            {menuCategories.map(cat => (
                              <button
                                key={cat}
                                onClick={() => setMenuCategoryFilter(cat)}
                                className={`min-w-max px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${menuCategoryFilter === cat
                                  ? 'bg-[#ff6b00] text-white shadow-md shadow-orange-500/20'
                                  : 'bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5'
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
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[8px] font-black uppercase mb-1.5 ${item.type === 'VEG' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                                      }`}>
                                      <span className={`w-1 h-1 rounded-full ${item.type === 'VEG' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                      {item.type === 'VEG' ? 'VEG' : 'NON-VEG'}
                                    </span>
                                    <p className="text-xs font-black text-slate-800 dark:text-white leading-tight group-hover:text-[#ff6b00] transition-colors flex items-center gap-2">
                                      <span>{item.name}</span>
                                      {(item.shortcode || item.code) && (
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
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
                                          onClick={() => handleAddAdditionalItem(item, 'HALF')}
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
                                          onClick={() => handleAddAdditionalItem(item, 'FULL')}
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

                      {/* Right: Selected Items Cart */}
                      <div className="w-full lg:w-96 flex flex-col flex-shrink-0 border-t lg:border-t-0 border-slate-100 dark:border-white/5">
                        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest">NEW ITEMS</span>
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
                            <div className="text-center py-8 text-slate-400 text-xs font-bold">
                              <Plus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              Tap items to add
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
                                            className="w-full px-2 py-1 bg-slate-50 dark:bg-white/5 border border-slate-205 dark:border-white/10 rounded-lg text-[9px] text-slate-800 dark:text-white placeholder-slate-400/60 font-bold focus:outline-none focus:border-[#ff6b00] transition-all"
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

                        {/* Cart footer — adapts hint and submit button to current mode */}
                        {additionalItems.length > 0 && (
                          <div className="p-4 border-t border-slate-100 dark:border-white/5 space-y-3">
                            <div className="flex justify-between text-xs font-black text-slate-800 dark:text-white">
                              <span className="text-slate-500 dark:text-white/40 font-bold">
                                {isCreatingDirectOrder ? 'Bill subtotal' : 'New items subtotal'}
                              </span>
                              <span className="text-[#ff6b00]">{formatCurrency(additionalSubtotal)}</span>
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-2 text-center">
                              {isCreatingDirectOrder
                                ? 'Save creates bill silently. Save & KOT creates bill and prints kitchen ticket.'
                                : 'Save adds items silently. Save & KOT adds items and prints kitchen ticket.'}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (isCreatingDirectOrder) {
                                    handleCreateDirectOrder({ printKot: false });
                                  } else {
                                    handleSubmitAdditionalItems({ printKot: false });
                                  }
                                }}
                                disabled={isCreatingDirectOrder ? isSubmittingDirectOrder : isSubmittingAdditional}
                                className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-60"
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
                              <button
                                onClick={() => {
                                  if (isCreatingDirectOrder) {
                                    handleCreateDirectOrder({ printKot: true });
                                  } else {
                                    handleSubmitAdditionalItems({ printKot: true });
                                  }
                                }}
                                disabled={isCreatingDirectOrder ? isSubmittingDirectOrder : isSubmittingAdditional}
                                className="flex-1 py-3 bg-[#ff6b00] hover:bg-[#e66000] text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                              >
                                {(isCreatingDirectOrder ? isSubmittingDirectOrder : isSubmittingAdditional) ? (
                                  <span className="animate-pulse">KOT...</span>
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
                  </>
                ) : (
                  <>
                    {/* ═══════════════════════════════════════════════════════════ */}
                    {/* DEFAULT BILLING MODAL VIEW                                 */}
                    {/* ═══════════════════════════════════════════════════════════ */}

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
                          {checkoutOrder ? (
                            <div className="flex flex-col space-y-4 h-full">
                              {/* Bill Info Grid */}
                              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-white/5 rounded-xl p-4">
                                <div className="space-y-1">
                                  <span className="text-slate-400 dark:text-white/30 uppercase text-[9px] font-black tracking-wider block">Invoice ID</span>
                                  <span className="font-extrabold text-slate-800 dark:text-white text-sm">INV-{checkoutOrder.id}</span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-slate-400 dark:text-white/30 uppercase text-[9px] font-black tracking-wider block">Dining Table</span>
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
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-16 bg-white dark:bg-[#0d0d0d]">
                              <ShoppingBag className="w-12 h-12 text-slate-400 mb-4 animate-bounce" />
                              <p className="text-sm font-black uppercase tracking-wider text-slate-500">No active orders</p>
                              <p className="text-[11px] text-slate-400 dark:text-white/20 mt-1 font-semibold">Select a table and add menu items for direct billing at the counter.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Column: Checkout Controls & Action Buttons */}
                      <div className="flex-1 flex flex-col h-full justify-between border border-slate-200/60 dark:border-white/5 rounded-2xl p-5 bg-white dark:bg-white/[0.01]">
                        
                        {/* Top: Payment Mode and Configuration */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-white/30">Checkout Settings</h3>
                          
                          {checkoutOrder && (
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
                          )}
                        </div>

                        {/* Bottom: Action Buttons */}
                        {checkoutOrder ? (
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
                                onClick={() => printThermalBill(selectedTableLive, checkoutOrder, false)}
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
                        ) : (
                          <div className="space-y-3">
                            <div className="flex justify-center flex-col sm:flex-row gap-3">
                              <button
                                disabled={true}
                                className="flex-1 px-4 py-3 bg-emerald-600/50 text-white rounded-2xl text-xs font-black uppercase tracking-wider opacity-50 cursor-not-allowed"
                              >
                                SAVE & SETTLE
                              </button>
                              <button
                                disabled={true}
                                className="flex-1 px-4 py-3 bg-[#ff6b00]/50 text-white rounded-2xl text-xs font-black opacity-50 cursor-not-allowed"
                              >
                                PRINT & COMPLETE BILL
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>


    </AdminLayout>
  );
}
