import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Printer,
  X,
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

const isLocalNetworkHost = () => {
  const host = window.location.hostname;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.startsWith('172.') ||
    host.endsWith('.local')
  );
};

const showPrinterErrorToast = (message, toastId, navigate) => {
  toast.error(
    (t) => (
      <div
        className="flex flex-col gap-1 cursor-pointer"
        onClick={() => {
          toast.dismiss(t.id);
          if (navigate) {
            navigate('/admin/settings?tab=printer');
          } else {
            window.location.hash = '#/admin/settings?tab=printer';
          }
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

const getOrderTableId = (order) =>
  order?.table_id ?? order?.tableId ?? order?.table?.id ?? order?.table?.table_id ?? null;

const isActiveOrder = (order) => {
  if (!order) return false;
  const st = String(order.status || '').toUpperCase().trim();
  return !['COMPLETED', 'PAID', 'SETTLED', 'CANCELLED', 'CLOSED'].includes(st);
};

const normalizeTableLabel = (val) =>
  String(val || '')
    .trim()
    .toLowerCase()
    .replace(/^table\s*/i, '')
    .replace(/^t(?=\d)/i, '')
    .trim();

export default function OrdersPage() {
  const navigate = useNavigate();

  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [printerConfig, setPrinterConfig] = useState(() => {
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';
      const saved = localStorage.getItem(`mejwani_printer_config_${hotelId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const printingKotIds = useRef(new Set());
  const menuSearchInputRef = useRef(null);
  const ackTimersRef = useRef({});
  const toastedJobsRef = useRef(new Set());

  const [captainRequests, setCaptainRequests] = useState([]);
  const [systemSettings, setSystemSettings] = useState(getCachedSystemSettings());
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('CASH');

  const formatCurrency = (value = 0, decimals = 2) => formatCurrencyWithSettings(value, systemSettings, decimals);
  const cgstRate = Number(systemSettings.billing.cgst) || 0;
  const sgstRate = Number(systemSettings.billing.sgst) || 0;
  const serviceChargeRate = Number(systemSettings.billing.serviceCharge) || 0;

  const findActiveOrderForTable = useCallback(
    (table) => {
      if (!table) return null;
      const tId = table.id ?? table.table_id ?? null;
      const tLabels = new Set(
        [
          table.table_name,
          table.tableName,
          table.table_number,
          table.tableNumber,
          table.number,
          normalizeTableLabel(table.table_name),
          normalizeTableLabel(table.table_number || table.number)
        ]
          .map((v) => String(v || '').trim().toLowerCase())
          .filter(Boolean)
      );

      return (
        orders.find((o) => {
          if (!isActiveOrder(o)) return false;
          const oTableId = getOrderTableId(o);
          if (tId != null && oTableId != null && String(oTableId) === String(tId)) return true;

          const oLabels = [
            o.table_name,
            o.tableName,
            o.table_number,
            o.tableNumber,
            o.table?.table_name,
            o.table?.number,
            normalizeTableLabel(o.table_name || o.table_number)
          ]
            .map((v) => String(v || '').trim().toLowerCase())
            .filter(Boolean);

          return oLabels.some((lbl) => tLabels.has(lbl));
        }) || null
      );
    },
    [orders]
  );

  const isTableOccupiedOrBusy = useCallback(
    (table) => {
      if (!table) return false;
      const st = String(table.status || '').toLowerCase().trim();
      if (['occupied', 'busy', 'bill_pending', 'running', 'active'].includes(st)) {
        return true;
      }
      return Boolean(findActiveOrderForTable(table));
    },
    [findActiveOrderForTable]
  );

  const getTableFallbackOrder = useCallback(
    (table) => {
      if (!table) return null;
      const fromOrders = findActiveOrderForTable(table);
      if (fromOrders) return fromOrders;

      const embeddedOrder =
        table.currentOrder ||
        table.current_order ||
        table.activeOrder ||
        table.active_order ||
        table.order ||
        null;

      if (embeddedOrder && isActiveOrder(embeddedOrder)) {
        const amount = Number(
          embeddedOrder.grand_total ??
            embeddedOrder.total ??
            embeddedOrder.subtotal ??
            table.current_amount ??
            table.order_total ??
            0
        );
        return {
          ...embeddedOrder,
          id: embeddedOrder.id ?? embeddedOrder.order_id ?? embeddedOrder._id ?? `TBL-${table.id}`,
          table_id: getOrderTableId(embeddedOrder) ?? table.id,
          table_name: embeddedOrder.table_name || table.table_name,
          items: Array.isArray(embeddedOrder.items) ? embeddedOrder.items : [],
          subtotal: Number(embeddedOrder.subtotal) > 0 ? Number(embeddedOrder.subtotal) : amount,
          grand_total: Number(embeddedOrder.grand_total) > 0 ? Number(embeddedOrder.grand_total) : amount
        };
      }

      const statusLower = String(table.status || '').toLowerCase().trim();
      if (['occupied', 'busy', 'bill_pending', 'running', 'active'].includes(statusLower)) {
        const amount = Number(
          table.current_amount ??
            table.order_total ??
            table.grand_total ??
            table.total ??
            0
        );
        return {
          id: table.current_order_id ?? table.order_id ?? `TBL-${table.id}`,
          table_id: table.id,
          table_name: table.table_name,
          status: statusLower === 'bill_pending' ? 'BILL_PENDING' : 'OCCUPIED',
          created_at: table.occupied_at || new Date().toISOString(),
          items: Array.isArray(table.items) ? table.items : [],
          subtotal: amount,
          cgst: 0,
          sgst: 0,
          grand_total: amount
        };
      }

      return null;
    },
    [findActiveOrderForTable]
  );

  const startAckTimeout = useCallback((jobId, jobType) => {
    if (ackTimersRef.current[jobId]) {
      clearTimeout(ackTimersRef.current[jobId]);
    }
    ackTimersRef.current[jobId] = setTimeout(() => {
      console.warn(`[WARNING] Socket ACK not received within 5 seconds for ${jobType} jobId: ${jobId}`);
      delete ackTimersRef.current[jobId];
    }, 5000);
  }, []);

  const clearAckTimeout = useCallback((jobId) => {
    if (ackTimersRef.current[jobId]) {
      clearTimeout(ackTimersRef.current[jobId]);
      delete ackTimersRef.current[jobId];
    }
  }, []);

  const onPrintJobAcknowledgedLocal = useCallback((jobId, tableName, jobType) => {
    const jobIdStr = String(jobId);
    if (!toastedJobsRef.current.has(jobIdStr)) {
      toastedJobsRef.current.add(jobIdStr);
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
  }, []);

  const isFetchingTablesRef = useRef(false);
  const isFetchingOrdersRef = useRef(false);
  const isFetchingSalesRef = useRef(false);
  const isFetchingParcelsRef = useRef(false);

  const [selectedTable, setSelectedTable] = useState(null);
  const [isAddingItems, setIsAddingItems] = useState(false);
  const [isCreatingDirectOrder, setIsCreatingDirectOrder] = useState(false);

  useEffect(() => {
    if (isAddingItems || isCreatingDirectOrder) {
      const timer = setTimeout(() => {
        menuSearchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAddingItems, isCreatingDirectOrder]);

  useEffect(() => {
    const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
    const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';
    if (!hotelId || hotelId === '0') return;

    const fetchPrinterConfig = async () => {
      try {
        const resp = await authorizedFetch(`${API_BASE}/print-agent/status`);
        const data = await resp.json();
        if (resp.ok && data && data.success && data.agent) {
          const config =
            typeof data.agent.printer_config === 'string'
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

  const [additionalItems, setAdditionalItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuSearchTerm, setMenuSearchTerm] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState('All');
  const [menuTypeFilter, setMenuTypeFilter] = useState('All');
  const [isSubmittingAdditional, setIsSubmittingAdditional] = useState(false);
  const [menuSearchHighlightedIndex, setMenuSearchHighlightedIndex] = useState(0);

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

      playNote(523.25, 0, 0.4);
      playNote(659.25, 0.15, 0.6);
    } catch (e) {
      console.warn('Audio Context blocked by client policies:', e);
    }
  };

  const loadMenuItems = async () => {
    const cached = getCachedMenu();
    if (cached && cached.length > 0) {
      setMenuItems(cached);
      return;
    }
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
      const res = await authorizedFetch(`${API_BASE}/menu${hotelParam}`);
      const data = await res.json();
      if (data.success) {
        setCachedMenu(data.data);
        setMenuItems(data.data || []);
      }
    } catch (err) {
      console.error('[Orders] Failed to load menu items:', err);
    }
  };

  const menuCategories = useMemo(() => {
    const unique = new Set(menuItems.map((item) => item.category || 'Uncategorized'));
    return ['All', ...Array.from(unique)];
  }, [menuItems]);

  const expandedMenuItems = useMemo(() => {
    const list = [];
    menuItems.forEach((item) => {
      const baseId = item._id || item.id;
      if (item.pricing_type === 'HALF_FULL') {
        list.push({
          ...item,
          _id: `${baseId}_HALF`,
          id: `${baseId}_HALF`,
          originalId: baseId,
          name: `${item.name} (Half)`,
          marathiName: item.marathiName ? `${item.marathiName} (हाफ)` : null,
          price: item.half_price,
          shortcode: item.shortcode ? `${item.shortcode}H` : null,
          code: item.code ? `${item.code}H` : null,
          pricing_type: 'SINGLE',
          portion_type: 'HALF'
        });
        list.push({
          ...item,
          _id: `${baseId}_FULL`,
          id: `${baseId}_FULL`,
          originalId: baseId,
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
          originalId: baseId,
          portion_type: 'FULL'
        });
      }
    });
    return list;
  }, [menuItems]);

  const filteredMenuItems = useMemo(() => {
    return expandedMenuItems.filter((item) => {
      const matchesSearch = [item.name, item.marathiName, item.category, item.code, item.shortcode]
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

  const additionalSubtotal = useMemo(
    () => additionalItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [additionalItems]
  );

  const handleAddAdditionalItem = (menuItem, portion = null) => {
    const isHalfFull = menuItem.pricing_type === 'HALF_FULL';
    const portionType = isHalfFull
      ? portion === 'HALF'
        ? 'HALF'
        : 'FULL'
      : menuItem.portion_type || menuItem.portionType || 'FULL';
    const baseId = menuItem.originalId || menuItem._id || menuItem.id;
    const cartId = `${baseId}_${portionType}`;

    let resolvedPrice = parseFloat(menuItem.price || 0);
    let displayName = menuItem.name;
    if (isHalfFull) {
      resolvedPrice = portionType === 'HALF' ? parseFloat(menuItem.half_price) : parseFloat(menuItem.full_price);
      displayName = menuItem.name + (portionType === 'HALF' ? ' (Half)' : ' (Full)');
    }

    setAdditionalItems((prev) => {
      const existing = prev.find((i) => i.cartId === cartId);
      if (existing) {
        return prev.map((i) => (i.cartId === cartId ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          cartId,
          menuItemId: baseId,
          portionType,
          name: displayName,
          marathiName: menuItem.marathiName || '',
          quantity: 1,
          price: resolvedPrice
        }
      ];
    });

    setTimeout(() => {
      menuSearchInputRef.current?.focus();
    }, 10);
  };

  const handleMenuSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMenuSearchHighlightedIndex((prev) =>
        filteredMenuItems.length > 0 ? (prev + 1) % filteredMenuItems.length : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMenuSearchHighlightedIndex((prev) =>
        filteredMenuItems.length > 0 ? (prev - 1 + filteredMenuItems.length) % filteredMenuItems.length : 0
      );
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
    setAdditionalItems((prev) =>
      prev
        .map((i) => (i.cartId === cartId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const handleSubmitAdditionalItems = async (options = {}) => {
    if (!activeOrderForSelectedTable || !selectedTableLive) return;

    if (additionalItems.length === 0) {
      toast.error('Cart cannot be empty. Please keep at least one item or cancel the bill.', {
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
      return;
    }

    const itemsToSubmit = [];
    const originalItems = activeOrderForSelectedTable.items || [];

    originalItems.forEach((orig) => {
      const origPortion = orig.portion_type || 'FULL';
      const cartItem = additionalItems.find(
        (i) => i.menuItemId === orig.menu_item_id && i.portionType === origPortion
      );
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

    additionalItems.forEach((cartItem) => {
      const isNew = !originalItems.some(
        (orig) =>
          orig.menu_item_id === cartItem.menuItemId && (orig.portion_type || 'FULL') === cartItem.portionType
      );
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
      toast.error('No changes made to the bill.', {
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
      return;
    }

    setIsSubmittingAdditional(true);
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';

      const payload = {
        items: itemsToSubmit,
        printKot: !!options.printKot
      };

      const orderId = activeOrderForSelectedTable.id;
      const res = await axios.put(`${API_BASE}/orders/${orderId}/append-items${hotelParam}`, payload);

      if (res.data.success) {
        const updatedOrderData = res.data.data;
        setOrders((prev) =>
          prev.map((o) =>
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
          )
        );

        toast.success(`✅ Bill updated successfully.`, {
          style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });

        if (options.printKot && updatedOrderData) {
          const deltaItems = updatedOrderData.deltaItems || [];
          triggerManualKOTPrint(updatedOrderData, deltaItems);
        }

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

  const openAddMoreItems = () => {
    if (activeOrderForSelectedTable && activeOrderForSelectedTable.items) {
      const mergedMap = new Map();
      activeOrderForSelectedTable.items.forEach((item) => {
        const portion = item.portion_type || 'FULL';
        const cId = `${item.menu_item_id}_${portion}`;
        if (mergedMap.has(cId)) {
          const existing = mergedMap.get(cId);
          existing.quantity += Number(item.quantity || 0);
        } else {
          mergedMap.set(cId, {
            cartId: cId,
            menuItemId: item.menu_item_id,
            portionType: portion,
            name: item.name,
            marathiName: item.marathiName || '',
            quantity: Number(item.quantity || 0),
            price: parseFloat(item.price || 0),
            note: item.note || ''
          });
        }
      });
      setAdditionalItems(Array.from(mergedMap.values()).filter((i) => i.quantity > 0));
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

  const handleSelectTableCard = async (table) => {
    setSelectedTable(table);
    setIsAddingItems(false);

    if (isTableOccupiedOrBusy(table)) {
      setIsCreatingDirectOrder(false);
      setAdditionalItems([]);
      const existingOrder = getTableFallbackOrder(table);
      setCheckoutOrder(
        existingOrder || {
          id: `TBL-${table.id}`,
          table_id: table.id,
          table_name: table.table_name,
          status: 'OCCUPIED',
          created_at: table.occupied_at || new Date().toISOString(),
          items: [],
          subtotal: 0,
          cgst: 0,
          sgst: 0,
          grand_total: 0
        }
      );
      await fetchOrders();
    } else {
      setCheckoutOrder(null);
      openDirectOrder();
    }
  };

  const triggerManualKOTPrint = async (order, deltaItems) => {
    if (!deltaItems || deltaItems.length === 0) return;
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';

      const kotData = {
        title: systemSettings?.printing?.kotTitle || 'KITCHEN ORDER TICKET',
        hotelName: systemSettings?.branding?.name || 'MEJWANI',
        tableName: order.table_name || order.table_number || 'COUNTER',
        sectionName: order.section_name || 'MAIN',
        captainName: order.captain_name || 'ADMIN',
        orderId: order.kot_number || order.id,
        dateTime: formatDateTimeDDMMYYYY(new Date()),
        items: deltaItems.map((item) => ({
          name: item.name || item.itemName,
          quantity: item.quantity || item.qty || 1,
          note: item.note
        }))
      };

      const printRes = await fetch(`${API_BASE}/orders/print-kot?hotelId=${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kotData)
      });

      const printData = await printRes.json();
      if (!printData.success) {
        if (printData.code === 'PRINTER_NOT_CONFIGURED' || printData.code === 'PRINTER_OFFLINE') {
          showPrinterErrorToast(printData.message, `kot-manual-fail-${order.id}`, navigate);
          return;
        }
        throw new Error(printData.message || 'Direct print request failed');
      }

      const jobId = printData.jobId;
      startAckTimeout(jobId, 'KOT');

      let localPrintSuccess = false;
      if (isLocalNetworkHost()) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000);
          const localResponse = await fetch('http://127.0.0.1:9111/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: jobId, job_type: 'KOT', payload: kotData }),
            signal: controller.signal
          });
          const localData = await localResponse.json();
          clearTimeout(timeoutId);
          if (localData.success) {
            localPrintSuccess = true;
            onPrintJobAcknowledgedLocal(jobId, kotData.tableName, 'KOT');
          }
        } catch (localErr) {
          console.log('[DEBUG] Local print failure (Manual-KOT):', jobId, localErr.message);
        }
      }

      if (!localPrintSuccess && isLocalNetworkHost()) {
        fetch('http://127.0.0.1:9111/trigger-poll').catch(() => {});
      }

      syncOperationalState();
    } catch (err) {
      console.error(`[Manual-KOT] Failed to print KOT manually:`, err);
      toast.error(`❌ KOT printing failed: ${err.message}`, {
        style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
      });
    }
  };

  const handleCreateDirectOrder = async (options = {}) => {
    if (additionalItems.length === 0) {
      toast.error('Add at least one item to create a bill.', {
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
      return;
    }
    if (!selectedTable) return;

    setIsSubmittingDirectOrder(true);
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';

      const payload = {
        tableId: selectedTable.id,
        printKot: !!options.printKot,
        items: additionalItems.map((item) => ({
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
        setOrders((prev) => [
          ...prev,
          {
            ...newOrder,
            table_id: getOrderTableId(newOrder) ?? selectedTable.id,
            status: 'BILL_PENDING',
            kotPrinted: true
          }
        ]);
        setTables((prev) =>
          prev.map((t) => (t.id === selectedTable.id ? { ...t, status: 'bill_pending' } : t))
        );

        setIsCreatingDirectOrder(false);
        setAdditionalItems([]);
        setMenuSearchTerm('');
        setMenuCategoryFilter('All');
        setMenuTypeFilter('All');

        toast.success(`✅ Bill created for ${selectedTable.table_name}.`, {
          style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });

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

  const fetchTables = useCallback(async () => {
    isFetchingTablesRef.current = true;
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
      const tablesRes = await authorizedFetch(
        `${API_BASE}/tables${hotelParam}${hotelParam ? '&' : '?'}t=${Date.now()}`
      );

      const tablesData = await tablesRes.json();
      if (tablesData.success) {
        const fetchedTables = (tablesData.data || []).filter(
          (t) => String(t.section_name ?? t.sectionName ?? '').toUpperCase() !== 'PARCEL'
        );
        setTables(fetchedTables);
      }
    } catch (err) {
      console.error('[Orders] Fetch tables issue:', err);
    } finally {
      isFetchingTablesRef.current = false;
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    isFetchingOrdersRef.current = true;
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
      const ordersRes = await authorizedFetch(
        `${API_BASE}/orders${hotelParam}${hotelParam ? '&' : '?'}t=${Date.now()}`
      );
      const ordersData = await ordersRes.json();
      if (ordersData.success) {
        const rawList = Array.isArray(ordersData.data)
          ? ordersData.data
          : Array.isArray(ordersData.data?.orders)
          ? ordersData.data.orders
          : [];
        setOrders(rawList);
      }
    } catch (err) {
      console.error('[Orders] Fetch orders issue:', err);
    } finally {
      isFetchingOrdersRef.current = false;
    }
  }, []);

  const fetchSales = useCallback(async () => {
    isFetchingSalesRef.current = true;
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
      await authorizedFetch(`${API_BASE}/orders/today/sales${hotelParam}${hotelParam ? '&' : '?'}t=${Date.now()}`);
    } catch (err) {
      console.error('[Orders] Fetch sales issue:', err);
    } finally {
      isFetchingSalesRef.current = false;
    }
  }, []);

  const fetchParcels = useCallback(async () => {
    isFetchingParcelsRef.current = true;
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';
      const todayKey = new Date().toISOString().split('T')[0];
      await authorizedFetch(
        `${API_BASE}/parcels?date=${todayKey}${hotelId ? '&hotelId=' + hotelId : ''}&t=${Date.now()}`
      );
    } catch (err) {
      console.error('[Orders] Fetch parcels issue:', err);
    } finally {
      isFetchingParcelsRef.current = false;
    }
  }, []);

  const fetchCaptainRequests = useCallback(async () => {
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
      const res = await authorizedFetch(
        `${API_BASE}/customer/active-captain-requests${hotelParam}${hotelParam ? '&' : '?'}t=${Date.now()}`
      );
      const data = await res.json();
      if (data.success) {
        setCaptainRequests(data.data || []);
      }
    } catch (err) {
      console.error('[Orders] Fetch captain requests issue:', err);
    }
  }, []);

  const syncOperationalState = useCallback(async () => {
    try {
      await Promise.all([
        fetchTables(),
        fetchOrders(),
        fetchSales(),
        fetchParcels(),
        fetchCaptainRequests()
      ]);
    } catch (err) {
      console.error('[Orders] Real-time sync issue:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchTables, fetchOrders, fetchSales, fetchParcels, fetchCaptainRequests]);

  const syncTableState = useCallback(async () => {
    try {
      await Promise.all([fetchTables(), fetchOrders()]);
    } catch (err) {
      console.error('[Orders] Real-time table status sync issue:', err);
    }
  }, [fetchTables, fetchOrders]);

  useEffect(() => {
    const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
    const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';

    syncOperationalState();

    const handleSettingsUpdated = () => setSystemSettings(getCachedSystemSettings());
    window.addEventListener('mejwani-settings-updated', handleSettingsUpdated);

    const timer = setInterval(() => {
      syncTableState();
    }, 4000);

    const debounceTimers = {
      sync: null,
      syncTable: null
    };

    const triggerDebounced = (key, fn) => {
      if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
      debounceTimers[key] = setTimeout(fn, 50);
    };

    const handleNewOrder = () => {
      playAlertChime();
      triggerDebounced('sync', () => {
        syncOperationalState();
      });
    };

    const handleTableReleased = () => {
      triggerDebounced('syncTable', () => {
        syncTableState();
      });
    };

    const handleTableActivity = () => {
      triggerDebounced('syncTable', () => {
        syncTableState();
      });
    };

    const handleCustomerRequestData = (e) => {
      const request = e.detail;
      if (!request || !request.tableId) return;
      setCaptainRequests((prev) => {
        const alreadyExists = prev.some((r) => r.table_id === request.tableId);
        if (alreadyExists) return prev;
        return [
          ...prev,
          {
            table_id: request.tableId,
            status: 'CAPTAIN_REQUESTED',
            created_at: request.timestamp || new Date().toISOString(),
            request_type: request.requestType
          }
        ];
      });
    };
    window.addEventListener('mejwani:customer-request', handleCustomerRequestData);

    if (socket.connected && hotelId) {
      socket.emit('join-hotel-room', `${hotelId}:admin`);
    }

    const onConnect = () => {
      if (hotelId) {
        socket.emit('join-hotel-room', `${hotelId}:admin`);
      }
      syncTableState();
    };

    const handleKotPrintAcknowledged = (data) => {
      if (!data || !data.jobId) return;
      clearAckTimeout(data.jobId);
      onPrintJobAcknowledgedLocal(data.jobId, data.tableName, 'KOT');
    };

    const handleKotPrintFailed = (data) => {
      if (!data || !data.jobId) return;
      clearAckTimeout(data.jobId);
      toast.error(
        `❌ KOT printing failed for ${data.tableName || 'Table'}: ${data.message || 'Printer offline'}`,
        {
          id: `kot-fail-${data.jobId}`,
          style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
        }
      );
    };

    const handleBillPrintAcknowledged = (data) => {
      if (!data || !data.jobId) return;
      clearAckTimeout(data.jobId);
      onPrintJobAcknowledgedLocal(data.jobId, data.tableName, 'BILL');
    };

    socket.on('connect', onConnect);
    socket.on('new-order', handleNewOrder);
    socket.on('table-released', handleTableReleased);
    socket.on('visit-expired', handleTableReleased);
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

    return () => {
      clearInterval(timer);
      if (debounceTimers.sync) clearTimeout(debounceTimers.sync);
      if (debounceTimers.syncTable) clearTimeout(debounceTimers.syncTable);
      socket.off('connect', onConnect);
      socket.off('new-order', handleNewOrder);
      socket.off('table-released', handleTableReleased);
      socket.off('visit-expired', handleTableReleased);
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
  }, [syncOperationalState, syncTableState, clearAckTimeout, onPrintJobAcknowledgedLocal]);

  useEffect(() => {
    if (!orders || orders.length === 0) return;

    const unprintedOrders = orders.filter(
      (order) => isActiveOrder(order) && order.kotPrinted === false
    );

    if (unprintedOrders.length === 0) return;

    unprintedOrders.forEach(async (order) => {
      if (printingKotIds.current.has(order.id)) return;

      printingKotIds.current.add(order.id);

      try {
        const hotelId = order.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';

        const kotData = {
          title: systemSettings?.printing?.kotTitle || 'KITCHEN ORDER TICKET',
          hotelName: systemSettings?.branding?.name || 'MEJWANI',
          tableName: order.table_name || order.table_number || 'COUNTER',
          sectionName: order.section_name || 'MAIN',
          captainName: order.captain_name || 'ADMIN',
          orderId: order.kot_number || order.id,
          dateTime: order.created_at
            ? formatDateTimeDDMMYYYY(order.created_at)
            : formatDateTimeDDMMYYYY(new Date()),
          items: (order.items || []).map((item) => ({
            name: item.name || item.itemName,
            quantity: item.quantity || item.qty || 1,
            note: item.note
          }))
        };

        const printRes = await fetch(`${API_BASE}/orders/print-kot?hotelId=${hotelId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(kotData)
        });

        const printData = await printRes.json();
        if (!printData.success) {
          if (printData.code === 'PRINTER_NOT_CONFIGURED' || printData.code === 'PRINTER_OFFLINE') {
            showPrinterErrorToast(printData.message, `kot-auto-fail-${order.id}`, navigate);
            printingKotIds.current.delete(order.id);
            return;
          }
          throw new Error(printData.message || 'Direct print request failed');
        }

        const jobId = printData.jobId;
        startAckTimeout(jobId, 'KOT');

        let localPrintSuccess = false;
        if (isLocalNetworkHost()) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);
            const localResponse = await fetch('http://127.0.0.1:9111/print', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: jobId, job_type: 'KOT', payload: kotData }),
              signal: controller.signal
            });
            const localData = await localResponse.json();
            clearTimeout(timeoutId);
            if (localData.success) {
              localPrintSuccess = true;
              onPrintJobAcknowledgedLocal(jobId, kotData.tableName, 'KOT');
            }
          } catch (localErr) {
            console.log('[DEBUG] Local print failure (Auto-KOT):', jobId, localErr.message);
          }
        }

        if (!localPrintSuccess && isLocalNetworkHost()) {
          fetch('http://127.0.0.1:9111/trigger-poll').catch(() => {});
        }

        syncOperationalState();
      } catch (err) {
        console.error(`[Auto-KOT] Failed to auto-print order ${order.id}:`, err);
        printingKotIds.current.delete(order.id);
        toast.error(`❌ Auto-print failed for ${order.table_name || 'order'}: ${err.message}`, {
          id: `kot-auto-fail-${order.id}`,
          style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
        });
      }
    });
  }, [orders, systemSettings, startAckTimeout, onPrintJobAcknowledgedLocal, syncOperationalState, navigate]);

  const selectedTableLive = useMemo(() => {
    if (!selectedTable) return null;
    return tables.find((t) => String(t.id) === String(selectedTable.id)) || selectedTable;
  }, [tables, selectedTable]);

  const activeOrderForSelectedTable = useMemo(() => {
    if (!selectedTableLive) return null;
    return getTableFallbackOrder(selectedTableLive);
  }, [selectedTableLive, getTableFallbackOrder]);

  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [eBillModalData, setEBillModalData] = useState(null);
  const [menuViewMode, setMenuViewMode] = useState('table');

  const billingTotals = useMemo(() => {
    if (!checkoutOrder) {
      return { subtotal: 0, cgst: 0, sgst: 0, serviceCharge: 0, grandTotal: 0 };
    }

    const itemsTotal = (checkoutOrder.items || []).reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
      0
    );

    const subtotal = Number(checkoutOrder.subtotal) > 0 ? Number(checkoutOrder.subtotal) : itemsTotal;
    const cgst = Number(checkoutOrder.cgst) > 0 ? Number(checkoutOrder.cgst) : (subtotal * cgstRate) / 100;
    const sgst = Number(checkoutOrder.sgst) > 0 ? Number(checkoutOrder.sgst) : (subtotal * sgstRate) / 100;
    const serviceCharge = (subtotal * serviceChargeRate) / 100;

    const calculatedGrandTotal = subtotal + cgst + sgst + serviceCharge;
    const grandTotal =
      Number(checkoutOrder.grand_total) > 0 && Number(checkoutOrder.cgst) > 0
        ? Number(checkoutOrder.grand_total)
        : calculatedGrandTotal;

    return { subtotal, cgst, sgst, serviceCharge, grandTotal };
  }, [checkoutOrder, cgstRate, sgstRate, serviceChargeRate]);

  useEffect(() => {
    if (!selectedTableLive) {
      setCheckoutOrder(null);
      return;
    }

    if (isTableOccupiedOrBusy(selectedTableLive)) {
      setIsCreatingDirectOrder(false);
      setCheckoutOrder(getTableFallbackOrder(selectedTableLive));
    } else {
      setCheckoutOrder((prev) => {
        if (prev && String(getOrderTableId(prev)) === String(selectedTableLive.id)) {
          const latestVersion = orders.find((o) => String(o.id) === String(prev.id));
          if (latestVersion) return latestVersion;
        }
        return null;
      });
    }
  }, [selectedTableLive, orders, isTableOccupiedOrBusy, getTableFallbackOrder]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (eBillModalData) {
          setEBillModalData(null);
        } else if (isAddingItems) {
          closeAddMoreItems();
        } else if (isCreatingDirectOrder) {
          closeDirectOrder();
          setSelectedTable(null);
        } else {
          setSelectedTable(null);
        }
      }
    };
    if (selectedTable || eBillModalData) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTable, eBillModalData, isAddingItems, isCreatingDirectOrder]);

  const tablesByArea = useMemo(() => {
    return tables.reduce((acc, table) => {
      const area = table.section_name || table.sectionName || 'GENERAL';
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

  const handleCompletePayment = async (orderId, shouldClose = true) => {
    if (!orderId) return;
    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';

      const targetOrder = orders.find((ord) => String(ord.id) === String(orderId)) || checkoutOrder;
      const targetTableId = getOrderTableId(targetOrder) ?? selectedTableLive?.id ?? null;

      setTables((prev) =>
        prev.map((t) => {
          const matchesId = targetTableId != null && String(t.id) === String(targetTableId);
          const matchesName =
            targetOrder?.table_name &&
            normalizeTableLabel(t.table_name) === normalizeTableLabel(targetOrder.table_name);
          if (matchesId || matchesName) {
            return {
              ...t,
              status: 'available',
              occupied_at: null,
              currentOrder: null,
              current_order: null,
              current_amount: 0,
              order_total: 0
            };
          }
          return t;
        })
      );
      setOrders((prev) =>
        prev.map((o) => (String(o.id) === String(orderId) ? { ...o, status: 'COMPLETED' } : o))
      );

      if (shouldClose) {
        setSelectedTable(null);
        setIsAddingItems(false);
        setIsCreatingDirectOrder(false);
        setAdditionalItems([]);
      }

      if (String(orderId).startsWith('TBL-')) {
        if (targetTableId != null) {
          await authorizedFetch(`${API_BASE}/tables/${targetTableId}/release?hotelId=${hotelId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }).catch(() => {});
        }
        if (socket && hotelId) {
          socket.emit('table-released', { hotelId, tableId: targetTableId });
          socket.emit('table-updated', { hotelId, tableId: targetTableId, status: 'available' });
        }
        toast.success('✅ Table settled & marked AVAILABLE.');
        await fetchOrders();
        await fetchTables();
        fetchSales();
        return;
      }

      const res = await authorizedFetch(`${API_BASE}/orders/pay/${orderId}?hotelId=${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMode: selectedPaymentMode || 'CASH' })
      });
      const data = await res.json();
      if (data.success) {
        if (targetTableId != null) {
          await authorizedFetch(`${API_BASE}/tables/${targetTableId}/release?hotelId=${hotelId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }).catch(() => {});
        }
        if (socket && hotelId) {
          socket.emit('table-released', { hotelId, tableId: targetTableId, orderId });
          socket.emit('table-updated', { hotelId, tableId: targetTableId, status: 'available' });
        }
        toast.success('✅ Bill settled & table is now AVAILABLE.');
        await fetchOrders();
        await fetchTables();
        fetchSales();
      } else {
        toast.error(data.message || 'Failed to complete payment.');
        await fetchOrders();
        await fetchTables();
        fetchSales();
      }
    } catch (err) {
      console.error('Failed to checkout:', err);
      toast.error('Failed to connect to server to complete payment.');
      await fetchOrders();
      await fetchTables();
      fetchSales();
    }
  };

  const handleSaveAndEBill = async (table, order) => {
    if (!table || !order) return;

    const dateStr = formatDateDDMMYYYY(new Date());
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const itemsTotal = (order.items || []).reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
      0
    );
    const subtotalValue = Number(order.subtotal) > 0 ? Number(order.subtotal) : itemsTotal;
    const cgstValue = Number(order.cgst) > 0 ? Number(order.cgst) : (subtotalValue * cgstRate) / 100;
    const sgstValue = Number(order.sgst) > 0 ? Number(order.sgst) : (subtotalValue * sgstRate) / 100;
    const serviceChargeValue = (subtotalValue * serviceChargeRate) / 100;
    const grandTotalValue = subtotalValue + cgstValue + sgstValue + serviceChargeValue;

    const billSnapshot = {
      hotelName: systemSettings?.branding?.name || 'MEJWANI',
      address: systemSettings?.branding?.address || '',
      phone: systemSettings?.branding?.phone || '',
      gstNumber: systemSettings?.billing?.gstNumber || '',
      tableName: table.table_name,
      invoiceId: `INV-${order.id}`,
      dateTime: `${dateStr} ${timeStr}`,
      paymentMode: selectedPaymentMode || 'CASH',
      items: order.items || [],
      subtotal: subtotalValue,
      cgst: cgstValue,
      sgst: sgstValue,
      serviceCharge: serviceChargeValue,
      grandTotal: grandTotalValue
    };

    if (String(order.status || '').toUpperCase() !== 'COMPLETED') {
      await handleCompletePayment(order.id, false);
    }

    setSelectedTable(null);
    setEBillModalData(billSnapshot);
    toast.success('✅ Payment settled & E-Bill generated!');
  };

  const handleCancelBill = async (orderId) => {
    if (!orderId) return;

    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';

      const res = await authorizedFetch(`${API_BASE}/orders/${orderId}?hotelId=${hotelId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (res.ok && (data.success || data.message === 'Order cancelled')) {
        toast.success('✅ Order cancelled successfully.', {
          style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });
        setSelectedTable(null);
        await fetchOrders();
        await fetchTables();
        fetchSales();
      } else {
        throw new Error(data.message || `Server returned ${res.status} (${res.statusText})`);
      }
    } catch (err) {
      console.error('[Orders] handleCancelBill failed:', err);
      toast.error(`❌ ${err.message}`, {
        style: { borderRadius: '10px', background: '#e11d48', color: '#fff' }
      });
    }
  };

  const openBrowserPrintReceipt = (billData) => {
    const printWindow = window.open('', '_blank', 'width=400,height=650');
    if (!printWindow) {
      window.print();
      return;
    }

    const itemsRows = (billData.items || [])
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
          <title>Bill Receipt - ${billData.orderId}</title>
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
          <div class="center bold" style="font-size: 16px;">${billData.hotelName || 'MEJWANI'}</div>
          ${billData.address ? `<div class="center" style="font-size: 11px;">${billData.address}</div>` : ''}
          ${billData.phone ? `<div class="center" style="font-size: 11px;">Ph: ${billData.phone}</div>` : ''}
          ${billData.gstNumber ? `<div class="center" style="font-size: 11px;">GSTIN: ${billData.gstNumber}</div>` : ''}
          
          <div class="divider"></div>
          <div><strong>Bill No:</strong> ${billData.orderId}</div>
          <div><strong>Table:</strong> ${billData.tableNumber}</div>
          <div><strong>Date:</strong> ${billData.dateTime}</div>
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
              <td style="text-align: right;">${billData.currencySymbol || '₹'}${Number(billData.subtotal).toFixed(2)}</td>
            </tr>
            ${billData.cgst > 0 ? `<tr><td>CGST (${billData.cgstRate}%):</td><td style="text-align: right;">${billData.currencySymbol || '₹'}${Number(billData.cgst).toFixed(2)}</td></tr>` : ''}
            ${billData.sgst > 0 ? `<tr><td>SGST (${billData.sgstRate}%):</td><td style="text-align: right;">${billData.currencySymbol || '₹'}${Number(billData.sgst).toFixed(2)}</td></tr>` : ''}
            ${billData.serviceCharge > 0 ? `<tr><td>Service Charge (${billData.serviceChargeRate}%):</td><td style="text-align: right;">${billData.currencySymbol || '₹'}${Number(billData.serviceCharge).toFixed(2)}</td></tr>` : ''}
            <tr class="bold" style="font-size: 14px; border-top: 1px dashed #000;">
              <td style="padding-top: 6px;">GRAND TOTAL:</td>
              <td style="padding-top: 6px; text-align: right;">${billData.currencySymbol || '₹'}${Number(billData.grandTotal).toFixed(2)}</td>
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

  const handleThermalPrintDirect = async (billData) => {
    if (!printerConfig || !printerConfig.bill) {
      openBrowserPrintReceipt(billData);
      return;
    }

    try {
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const hotelId = adminUser.hotel_id || adminUser.hotelId || localStorage.getItem('mejwani_hotel_id') || '';
      const tableName = billData.tableNumber ? billData.tableNumber.split(' (')[0] : 'Table';

      const response = await fetch(`${API_BASE}/bills/print?hotelId=${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData)
      });
      const data = await response.json();
      if (!data.success) {
        if (data.code === 'PRINTER_NOT_CONFIGURED' || data.code === 'PRINTER_OFFLINE') {
          openBrowserPrintReceipt(billData);
          return;
        }
        throw new Error(data.message || 'Direct print failed');
      }

      const jobId = data.jobId;
      startAckTimeout(jobId, 'BILL');

      if (isLocalNetworkHost()) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000);
          const localResponse = await fetch('http://127.0.0.1:9111/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: jobId, job_type: 'BILL', payload: billData }),
            signal: controller.signal
          });
          const localData = await localResponse.json();
          clearTimeout(timeoutId);
          if (localData.success) {
            onPrintJobAcknowledgedLocal(jobId, tableName, 'BILL');
            return;
          }
        } catch (localErr) {
          console.log('[DEBUG] Local print failure, falling back to browser print:', jobId, localErr.message);
          openBrowserPrintReceipt(billData);
          return;
        }

        fetch('http://127.0.0.1:9111/trigger-poll').catch(() => {});
      }
    } catch (err) {
      console.error('Direct print error, opening browser print fallback:', err);
      openBrowserPrintReceipt(billData);
    }
  };

  const printThermalBill = (table, order) => {
    if (!table || !order) return;

    const dateStr = formatDateDDMMYYYY(new Date());
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const itemsTotal = (order.items || []).reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
      0
    );
    const subtotalValue = Number(order.subtotal) > 0 ? Number(order.subtotal) : itemsTotal;
    const cgstValue = Number(order.cgst) > 0 ? Number(order.cgst) : (subtotalValue * cgstRate) / 100;
    const sgstValue = Number(order.sgst) > 0 ? Number(order.sgst) : (subtotalValue * sgstRate) / 100;
    const serviceChargeValue = (subtotalValue * serviceChargeRate) / 100;
    const grandTotalValue = subtotalValue + cgstValue + sgstValue + serviceChargeValue;

    const billData = {
      hotelName: systemSettings.branding.name,
      address: systemSettings.branding.address,
      phone: systemSettings.branding.phone,
      gstNumber: systemSettings.billing.gstNumber,
      tableNumber: `${table.table_code || table.table_name} (${table.section_name || 'MAIN'})`,
      cashierName: 'Counter',
      captainName: order.captain_name || 'ADMIN',
      orderId: `ORD-${order.id}`,
      dateTime: `${dateStr} ${timeStr}`,
      items: order.items || [],
      subtotal: subtotalValue,
      cgst: cgstValue,
      sgst: sgstValue,
      serviceCharge: serviceChargeValue,
      grandTotal: grandTotalValue,
      cgstRate,
      sgstRate,
      serviceChargeRate,
      currencySymbol: systemSettings.billing.currencySymbol
    };

    handleThermalPrintDirect(billData);
  };

  const handleRejectRequest = async (table) => {
    try {
      setCaptainRequests((prev) => prev.filter((r) => String(r.table_id) !== String(table.id)));
      setTables((prev) =>
        prev.map((t) => (String(t.id) === String(table.id) ? { ...t, status: 'available', occupied_at: null } : t))
      );

      const hotelId = localStorage.getItem('mejwani_hotel_id') || '';
      const hotelParam = hotelId ? `?hotelId=${hotelId}` : '';
      const res = await authorizedFetch(`${API_BASE}/customer/reject-captain-request${hotelParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: table.id })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to reject request on backend.');
      }
      toast.success('Request rejected');
    } catch (err) {
      console.error('Failed to reject captain request:', err);
      toast.error(`Error: ${err.message}`);
      fetchCaptainRequests();
      fetchTables();
    }
  };

  const getTableDisplayStatus = (table) => {
    const order = findActiveOrderForTable(table);
    if (order) {
      const oStatus = String(order.status || '').toUpperCase();
      return oStatus === 'BILL_PENDING' ? 'bill_pending' : 'occupied';
    }
    const rawTableStatus = String(table.status || '').toLowerCase();
    if (rawTableStatus === 'bill_pending') return 'bill_pending';
    if (['occupied', 'busy', 'running', 'active'].includes(rawTableStatus)) {
      return 'occupied';
    }

    const hasActiveRequest = captainRequests.some(
      (r) => String(r.table_id) === String(table.id) && (r.status === 'CAPTAIN_REQUESTED' || r.status === 'PENDING')
    );
    if (hasActiveRequest && rawTableStatus === 'available') {
      return 'customer_present';
    }
    return rawTableStatus || 'available';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'occupied':
        return (
          <span className="inline-flex items-center gap-1 py-0.5 px-2.5 rounded-full bg-rose-600/15 border border-rose-600/35 text-[8px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider">
            <span className="w-1.5 h-1.5 bg-rose-600 rounded-full animate-ping" />
            OCCUPIED · BUSY
          </span>
        );
      case 'bill_pending':
        return (
          <span className="inline-flex items-center gap-1 py-0.5 px-2.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[8px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
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
    const isSelected = selectedTableLive && String(selectedTableLive.id) === String(table.id);
    const displayStatus = getTableDisplayStatus(table);

    if (displayStatus === 'occupied') {
      return isSelected
        ? 'bg-rose-200 dark:bg-rose-900/60 border-2 border-rose-600 text-rose-950 dark:text-rose-100 shadow-lg ring-2 ring-rose-600/40'
        : 'bg-rose-100 dark:bg-rose-950/45 border-2 border-rose-500 text-rose-900 dark:text-rose-200 hover:bg-rose-200/80 dark:hover:bg-rose-900/50 hover:border-rose-600 shadow-md';
    } else if (displayStatus === 'bill_pending') {
      return isSelected
        ? 'bg-amber-100 dark:bg-amber-950/40 border-2 border-amber-500 text-amber-900 dark:text-amber-200 shadow-md ring-2 ring-amber-500/30'
        : 'bg-amber-50/90 dark:bg-amber-950/25 border-2 border-amber-500/50 text-amber-800 dark:text-amber-300 hover:border-amber-500 shadow-sm';
    } else if (displayStatus === 'customer_present') {
      return isSelected
        ? 'bg-orange-100 dark:bg-orange-950/40 border-orange-500 text-orange-900 dark:text-orange-200 shadow-md ring-2 ring-orange-500/30 animate-pulse'
        : 'bg-orange-50/70 dark:bg-orange-950/20 border-orange-500/30 dark:border-orange-500/10 text-orange-800 dark:text-orange-400 hover:border-orange-500/60 shadow-sm animate-pulse';
    } else {
      return isSelected
        ? 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-md ring-2 ring-emerald-500/30'
        : 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-500/20 dark:border-emerald-500/5 text-emerald-800 dark:text-emerald-400 hover:border-emerald-500/50 shadow-sm';
    }
  };

  return (
    <AdminLayout>
      <div className="-mt-6 space-y-4 w-full max-w-full overflow-visible">
        <div className="flex justify-end items-center mb-1">
          <button
            type="button"
            onClick={() => navigate('/admin/bills')}
            className="flex items-center gap-2 px-4.5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-orange-500/10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            Issued Bills
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 h-auto w-full overflow-visible">
          <div className="w-full flex flex-col pr-2 overflow-visible">
            {loading ? (
              <div className="space-y-6 max-w-full">
                <div className="h-6 w-48 bg-slate-200 dark:bg-white/5 rounded-md animate-pulse pl-3 border-l-4 border-primary/20" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl border-2 border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] min-h-[120px] animate-pulse flex flex-col justify-between"
                    >
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
                  It looks like you've just onboarded this hotel. To start taking captain orders and managing bills,
                  you need to set up your restaurant tables first.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => navigate('/admin/tables')}
                    className="px-6 py-3 bg-[#ff6b00] hover:bg-[#e66000] text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Configure Tables <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/hotel-menu')}
                    className="px-6 py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-xl font-black text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Set Up Hotel Menu
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-10">
                {sortedAreas.map((area) => (
                  <section key={area} className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-wider pl-3 border-l-4 border-primary">
                      {area}
                    </h2>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {tablesByArea[area]?.map((table) => {
                        const displayStatus = getTableDisplayStatus(table);
                        const order = getTableFallbackOrder(table);
                        const isOccupied =
                          displayStatus === 'occupied' || displayStatus === 'bill_pending' || !!order;
                        const isCustomerPresent = displayStatus === 'customer_present';

                        const cardItemsTotal = order
                          ? (order.items || []).reduce(
                              (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
                              0
                            )
                          : 0;
                        const cardSub =
                          order && Number(order.subtotal) > 0 ? Number(order.subtotal) : cardItemsTotal;
                        const cardTax =
                          order && Number(order.cgst) > 0
                            ? Number(order.cgst) + Number(order.sgst)
                            : (cardSub * (cgstRate + sgstRate + serviceChargeRate)) / 100;
                        const cardGrandTotal =
                          order && Number(order.grand_total) > 0 && Number(order.cgst) > 0
                            ? Number(order.grand_total)
                            : cardSub + cardTax;

                        return (
                          <div
                            key={table.id}
                            onClick={() => handleSelectTableCard(table)}
                            className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between items-center text-center min-h-[110px] cursor-pointer ${getTableColorClass(
                              table
                            )}`}
                          >
                            <div className="text-[10px] font-black uppercase tracking-wider min-h-[16px] w-full flex justify-center">
                              {isCustomerPresent ? (
                                <button
                                  type="button"
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

                            <div className="text-2xl font-black tracking-tight mt-1">{table.table_name}</div>

                            <div className="my-1.5">{getStatusBadge(displayStatus)}</div>

                            <div className="w-full flex items-center justify-between h-5 text-xs font-black">
                              {isOccupied && order ? (
                                <>
                                  <span className="text-rose-700 dark:text-rose-300">
                                    {formatCurrency(cardGrandTotal, 0)}
                                  </span>
                                  <span className="text-[9px] uppercase tracking-wider text-rose-700 dark:text-rose-300 underline">
                                    BILL
                                  </span>
                                </>
                              ) : isOccupied ? (
                                <span className="text-[9px] uppercase tracking-wider text-rose-700 dark:text-rose-300 mx-auto">
                                  TAP FOR BILL
                                </span>
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

          {selectedTableLive && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div
                className="absolute inset-0"
                onClick={() => {
                  setSelectedTable(null);
                  closeAddMoreItems();
                  closeDirectOrder();
                }}
              />
              <div
                className={`relative flex flex-col bg-white dark:bg-[#0d0d0d] border-2 border-slate-100 dark:border-white/5 rounded-3xl shadow-2xl z-10 ${
                  isAddingItems || isCreatingDirectOrder
                    ? 'w-[95vw] h-[90vh] overflow-hidden'
                    : 'w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden'
                }`}
              >
                {isAddingItems || isCreatingDirectOrder ? (
                  <>
                    <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center gap-3 bg-slate-50/50 dark:bg-white/2">
                      <button
                        type="button"
                        onClick={
                          isCreatingDirectOrder
                            ? () => {
                                closeDirectOrder();
                                setSelectedTable(null);
                              }
                            : closeAddMoreItems
                        }
                        className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-600 transition-all flex-shrink-0 cursor-pointer"
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
                            ? `${selectedTableLive.table_name} · ${selectedTableLive.section_name || 'MAIN'} · Direct Billing`
                            : `INV-${activeOrderForSelectedTable?.id} · ${selectedTableLive.table_name} · Same Session`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={
                          isCreatingDirectOrder
                            ? () => {
                                closeDirectOrder();
                                setSelectedTable(null);
                              }
                            : () => {
                                setSelectedTable(null);
                                closeAddMoreItems();
                              }
                        }
                        className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" style={{ minHeight: 0 }}>
                      <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-100 dark:border-white/5">
                        <div className="p-4 space-y-2 border-b border-slate-100 dark:border-white/5 flex-shrink-0">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                              <input
                                ref={menuSearchInputRef}
                                value={menuSearchTerm}
                                onChange={(e) => setMenuSearchTerm(e.target.value)}
                                onKeyDown={handleMenuSearchKeyDown}
                                placeholder="Search menu..."
                                className="w-full rounded-xl border-2 py-2 pl-9 pr-3 text-xs font-bold outline-none transition-all border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d0d0d] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#ff6b00] focus:ring-2 focus:ring-orange-500/10"
                              />
                            </div>
                            <select
                              value={menuTypeFilter}
                              onChange={(e) => setMenuTypeFilter(e.target.value)}
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
                            {menuCategories.map((cat) => (
                              <button
                                type="button"
                                key={cat}
                                onClick={() => setMenuCategoryFilter(cat)}
                                className={`min-w-max px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                                  menuCategoryFilter === cat
                                    ? 'bg-[#ff6b00] text-white shadow-md shadow-orange-500/20'
                                    : 'bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5'
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>

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
                                      const baseId = item.originalId || item._id || item.id;
                                      const portionType = item.portion_type || item.portionType || 'FULL';
                                      const targetCartId = `${baseId}_${portionType}`;
                                      const qtyInCart = additionalItems
                                        .filter((c) => c.cartId === targetCartId)
                                        .reduce((sum, c) => sum + c.quantity, 0);

                                      return (
                                        <tr
                                          key={item._id || item.id}
                                          style={
                                            !item.isAvailable ? { filter: 'grayscale(60%)', opacity: 0.6 } : undefined
                                          }
                                          onClick={(e) => {
                                            if (
                                              e.target.closest('button') ||
                                              e.target.closest('input') ||
                                              e.target.closest('select')
                                            ) {
                                              return;
                                            }
                                            if (item.isAvailable) {
                                              handleAddAdditionalItem(item);
                                            }
                                          }}
                                          className={`hover:bg-slate-50/50 dark:hover:bg-white/[0.01] cursor-pointer transition-all ${
                                            idx === menuSearchHighlightedIndex
                                              ? 'bg-orange-500/15 dark:bg-orange-500/30 text-orange-600 dark:text-orange-400 font-extrabold shadow-sm'
                                              : ''
                                          }`}
                                        >
                                          <td className="p-3">
                                            <div className="flex items-center gap-2">
                                              <span
                                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                  item.type === 'VEG' ? 'bg-emerald-500' : 'bg-rose-500'
                                                }`}
                                              />
                                              <div>
                                                <span className="font-extrabold text-slate-800 dark:text-white">
                                                  {item.name}
                                                </span>
                                                {(item.shortcode || item.code) && (
                                                  <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400">
                                                    {item.shortcode || item.code}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="p-3 text-[10px] text-slate-400 uppercase tracking-wider">
                                            {item.category || 'ITEM'}
                                          </td>
                                          <td className="p-3 text-right font-black text-slate-800 dark:text-white">
                                            {formatCurrency(item.price)}
                                          </td>
                                          <td className="p-3 text-right">
                                            {!item.isAvailable ? (
                                              <span className="text-[10px] uppercase font-bold text-rose-500 bg-rose-500/10 px-2 py-1 rounded-lg">
                                                Unavailable
                                              </span>
                                            ) : qtyInCart > 0 ? (
                                              <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-lg border border-slate-200 dark:border-white/10 select-none">
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAdditionalQuantity(targetCartId, -1);
                                                  }}
                                                  className="p-1 rounded bg-white dark:bg-white/10 text-slate-500 hover:text-[#ff6b00] cursor-pointer"
                                                >
                                                  <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="px-2 text-xs font-black text-slate-800 dark:text-white min-w-[16px] text-center">
                                                  {qtyInCart}
                                                </span>
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
                                const baseId = item.originalId || item._id || item.id;
                                const portionType = item.portion_type || item.portionType || 'FULL';
                                const targetCartId = `${baseId}_${portionType}`;
                                const qtyInCart = additionalItems
                                  .filter((c) => c.cartId === targetCartId)
                                  .reduce((sum, c) => sum + c.quantity, 0);
                                const isAlreadyAdded = qtyInCart > 0;

                                return (
                                  <div
                                    key={item._id || item.id}
                                    style={!item.isAvailable ? { filter: 'grayscale(60%)' } : undefined}
                                    onClick={() => {
                                      if (item.isAvailable) {
                                        handleAddAdditionalItem(item);
                                      }
                                    }}
                                    className={`relative p-3 rounded-xl border text-left bg-white dark:bg-[#0a0a0a] transition-all group ${
                                      idx === menuSearchHighlightedIndex
                                        ? 'ring-2 ring-orange-500 border-orange-500 shadow-md scale-[1.01]'
                                        : !item.isAvailable
                                        ? 'opacity-50 cursor-not-allowed'
                                        : isAlreadyAdded
                                        ? 'border-orange-500 shadow-sm hover:shadow-md'
                                        : 'border-slate-200 dark:border-white/10 hover:border-orange-400 hover:shadow-md'
                                    } ${item.isAvailable ? 'cursor-pointer active:scale-[0.98]' : ''}`}
                                  >
                                    {isAlreadyAdded && (
                                      <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-orange-500/10 dark:bg-orange-500/20 text-[#ff6b00] text-[8px] font-black uppercase tracking-wider">
                                        Qty: {qtyInCart}
                                      </span>
                                    )}
                                    <span
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[8px] font-black uppercase mb-1.5 ${
                                        item.type === 'VEG'
                                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                          : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                                      }`}
                                    >
                                      <span
                                        className={`w-1 h-1 rounded-full ${
                                          item.type === 'VEG' ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`}
                                      />
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
                                    <p className="text-[9px] text-slate-400 dark:text-white/30 font-bold uppercase tracking-wider mt-0.5 truncate">
                                      {item.category || 'ITEM'}
                                    </p>

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
                                      <span className="text-[#ff6b00]">
                                        ₹{parseFloat(item.price || 0).toFixed(0)}
                                      </span>
                                      {qtyInCart > 0 && (
                                        <span className="px-1 py-0.5 rounded bg-orange-500 text-white text-[8px] font-bold">
                                          {qtyInCart}
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="w-full lg:w-96 flex flex-col flex-shrink-0 border-t lg:border-t-0 border-slate-100 dark:border-white/5">
                        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest">
                            NEW ITEMS
                          </span>
                          {additionalItems.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setAdditionalItems([])}
                              className="text-[9px] font-bold text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
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
                                  {additionalItems.map((item) => (
                                    <tr key={item.cartId}>
                                      <td className="py-2.5">
                                        <span className="font-extrabold text-slate-800 dark:text-white block leading-tight">
                                          {item.name}
                                        </span>
                                        <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                                          {formatCurrency(item.price)}
                                        </span>
                                        <div className="mt-1.5 space-y-1 max-w-[200px]">
                                          <div className="flex gap-1 flex-wrap">
                                            {['Roti', 'Chapati', 'Bhakari'].map((opt) => (
                                              <button
                                                key={opt}
                                                type="button"
                                                onClick={() => {
                                                  setAdditionalItems((prev) =>
                                                    prev.map((i) => {
                                                      if (i.cartId === item.cartId) {
                                                        const current = i.note || '';
                                                        const prefix = current ? `${current}, ` : '';
                                                        return { ...i, note: `${prefix}${opt}` };
                                                      }
                                                      return i;
                                                    })
                                                  );
                                                }}
                                                className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[8px] text-slate-500 dark:text-white/60 rounded-md font-extrabold cursor-pointer border border-slate-200/50 dark:border-white/5 transition-all"
                                              >
                                                +{opt}
                                              </button>
                                            ))}
                                            {item.note && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setAdditionalItems((prev) =>
                                                    prev.map((i) =>
                                                      i.cartId === item.cartId ? { ...i, note: '' } : i
                                                    )
                                                  );
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
                                              setAdditionalItems((prev) =>
                                                prev.map((i) =>
                                                  i.cartId === item.cartId ? { ...i, note: val } : i
                                                )
                                              );
                                            }}
                                            placeholder="Add prep note (e.g. 2 Roti, 2 Bhakari)..."
                                            className="w-full px-2 py-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-[9px] text-slate-800 dark:text-white placeholder-slate-400/60 font-bold focus:outline-none focus:border-[#ff6b00] transition-all"
                                          />
                                        </div>
                                      </td>
                                      <td className="py-2.5 text-center">
                                        <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-white/5 p-0.5 rounded-lg border border-slate-200 dark:border-white/5">
                                          <button
                                            type="button"
                                            onClick={() => handleAdditionalQuantity(item.cartId, -1)}
                                            className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                                          >
                                            <Minus className="w-3 h-3" />
                                          </button>
                                          <span className="text-[10px] font-black w-4 text-center text-slate-900 dark:text-white">
                                            {item.quantity}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleAdditionalQuantity(item.cartId, 1)}
                                            className="p-0.5 rounded text-[#ff6b00] hover:bg-orange-500/10 cursor-pointer"
                                          >
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
                                type="button"
                                onClick={() => {
                                  if (isCreatingDirectOrder) {
                                    handleCreateDirectOrder({ printKot: false });
                                  } else {
                                    handleSubmitAdditionalItems({ printKot: false });
                                  }
                                }}
                                disabled={
                                  isCreatingDirectOrder ? isSubmittingDirectOrder : isSubmittingAdditional
                                }
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
                              <button
                                type="button"
                                onClick={() => {
                                  if (isCreatingDirectOrder) {
                                    handleCreateDirectOrder({ printKot: true });
                                  } else {
                                    handleSubmitAdditionalItems({ printKot: true });
                                  }
                                }}
                                disabled={
                                  isCreatingDirectOrder ? isSubmittingDirectOrder : isSubmittingAdditional
                                }
                                className="flex-1 py-3 bg-[#ff6b00] hover:bg-[#e66000] text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
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
                    <div className="flex justify-end p-4 pb-0 bg-white dark:bg-[#0d0d0d]">
                      <button
                        type="button"
                        onClick={() => setSelectedTable(null)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    <div
                      className="flex-1 flex flex-col md:flex-row overflow-hidden bg-white dark:bg-[#0d0d0d] p-6 gap-6"
                      style={{ minHeight: 0 }}
                    >
                      <div className="md:w-[45%] flex flex-col h-full border border-slate-200/60 dark:border-white/5 rounded-2xl bg-slate-50 dark:bg-white/2 p-5 overflow-hidden">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-white/30 mb-3">
                          Bill Receipt
                        </h3>
                        <div className="flex-1 overflow-y-auto pr-1">
                          {checkoutOrder ? (
                            <div className="flex flex-col space-y-4 h-full">
                              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-white/5 rounded-xl p-4">
                                <div className="space-y-1">
                                  <span className="text-slate-400 dark:text-white/30 uppercase text-[9px] font-black tracking-wider block">
                                    Invoice ID
                                  </span>
                                  <span className="font-extrabold text-slate-800 dark:text-white text-sm">
                                    INV-{checkoutOrder.id}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-slate-400 dark:text-white/30 uppercase text-[9px] font-black tracking-wider block">
                                    Dining Table
                                  </span>
                                  <span className="font-extrabold text-slate-800 dark:text-white text-sm">
                                    {selectedTableLive.table_name}
                                  </span>
                                </div>
                                <div className="col-span-2 space-y-1">
                                  <span className="text-slate-400 dark:text-white/30 uppercase text-[9px] font-black tracking-wider block">
                                    Date & Time
                                  </span>
                                  <span className="font-bold text-slate-600 dark:text-slate-300 text-xs">
                                    {checkoutOrder.created_at
                                      ? formatDateTimeDDMMYYYY(checkoutOrder.created_at)
                                      : formatDateTimeDDMMYYYY(new Date())}
                                  </span>
                                </div>
                              </div>

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
                                      {checkoutOrder.items &&
                                        checkoutOrder.items.map((item, idx) => (
                                          <tr
                                            key={idx}
                                            className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]"
                                          >
                                            <td className="p-3">
                                              <span className="font-extrabold text-slate-800 dark:text-white block">
                                                {item.name}
                                              </span>
                                              {item.note && (
                                                <span className="text-[9px] text-amber-500 italic block mt-0.5">
                                                  * Note: {item.note}
                                                </span>
                                              )}
                                            </td>
                                            <td className="p-3 text-center font-extrabold text-slate-900 dark:text-white">
                                              {item.quantity}
                                            </td>
                                            <td className="p-3 text-right text-slate-500 dark:text-white/40 font-bold">
                                              {formatCurrency(item.price)}
                                            </td>
                                            <td className="p-3 text-right font-black text-slate-900 dark:text-white">
                                              {formatCurrency(item.price * item.quantity)}
                                            </td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              <div className="space-y-2.5 bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-white/5 rounded-xl p-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                                <div className="flex justify-between">
                                  <span className="text-slate-400 uppercase tracking-wider text-[10px]">
                                    Subtotal:
                                  </span>
                                  <span className="text-slate-900 dark:text-white font-extrabold">
                                    {formatCurrency(billingTotals.subtotal)}
                                  </span>
                                </div>

                                {cgstRate > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 uppercase tracking-wider text-[10px]">
                                      CGST ({cgstRate}%):
                                    </span>
                                    <span className="text-slate-900 dark:text-white font-extrabold">
                                      {formatCurrency(billingTotals.cgst)}
                                    </span>
                                  </div>
                                )}

                                {sgstRate > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 uppercase tracking-wider text-[10px]">
                                      SGST ({sgstRate}%):
                                    </span>
                                    <span className="text-slate-900 dark:text-white font-extrabold">
                                      {formatCurrency(billingTotals.sgst)}
                                    </span>
                                  </div>
                                )}

                                {billingTotals.serviceCharge > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-400 uppercase tracking-wider text-[10px]">
                                      Service Charge ({serviceChargeRate}%):
                                    </span>
                                    <span className="text-slate-900 dark:text-white font-extrabold">
                                      {formatCurrency(billingTotals.serviceCharge)}
                                    </span>
                                  </div>
                                )}

                                <div className="border-t border-slate-200 dark:border-white/5 pt-2 flex justify-between items-center text-sm font-black text-slate-800 dark:text-white">
                                  <span className="uppercase tracking-wider text-xs">Grand Total:</span>
                                  <span className="text-lg text-[#ff6b00]">
                                    {formatCurrency(billingTotals.grandTotal)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-16 bg-white dark:bg-[#0d0d0d]">
                              <ShoppingBag className="w-12 h-12 text-slate-400 mb-4 animate-bounce" />
                              <p className="text-sm font-black uppercase tracking-wider text-slate-500">
                                No active orders
                              </p>
                              <p className="text-[11px] text-slate-400 dark:text-white/20 mt-1 font-semibold">
                                Select a table and add menu items for direct billing at the counter.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col h-full justify-between border border-slate-200/60 dark:border-white/5 rounded-2xl p-5 bg-white dark:bg-white/[0.01]">
                        <div className="space-y-4">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-white/30">
                            Checkout Settings
                          </h3>

                          {checkoutOrder && (
                            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-white/2 border border-slate-100 dark:border-white/5 rounded-xl">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                Payment Mode
                              </span>
                              <div className="flex gap-1.5">
                                {['CASH', 'UPI', 'CARD'].map((mode) => (
                                  <button
                                    type="button"
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

                        {checkoutOrder ? (
                          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                            <div className="flex flex-col sm:flex-row gap-3">
                              <button
                                type="button"
                                onClick={() => setSelectedTable(null)}
                                className="flex-1 px-4 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => printThermalBill(selectedTableLive, checkoutOrder)}
                                className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                              >
                                Save & Print
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveAndEBill(selectedTableLive, checkoutOrder)}
                                className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                              >
                                Save & EBill
                              </button>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                              <button
                                type="button"
                                disabled={String(checkoutOrder.status || '').toUpperCase() === 'COMPLETED'}
                                onClick={() => handleCancelBill(checkoutOrder.id)}
                                className="flex-1 px-4 py-3 bg-slate-500 hover:bg-slate-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Cancel Order
                              </button>
                              <button
                                type="button"
                                disabled={String(checkoutOrder.status || '').toUpperCase() === 'COMPLETED'}
                                onClick={openAddMoreItems}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                New Order
                              </button>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 dark:text-white/40 uppercase">
                                  Settlement Amount:
                                </span>
                                <span className="text-sm font-black text-slate-800 dark:text-white">
                                  {formatCurrency(billingTotals.grandTotal)}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (String(checkoutOrder.status || '').toUpperCase() === 'COMPLETED') {
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
                                {String(checkoutOrder.status || '').toUpperCase() === 'COMPLETED' ? 'Close' : 'Settle & Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex justify-center flex-col sm:flex-row gap-3">
                              <button
                                type="button"
                                disabled={true}
                                className="flex-1 px-4 py-3 bg-emerald-600/50 text-white rounded-2xl text-xs font-black uppercase tracking-wider opacity-50 cursor-not-allowed"
                              >
                                SAVE & SETTLE
                              </button>
                              <button
                                type="button"
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

      {eBillModalData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-600 text-white p-5 text-center relative">
              <button
                type="button"
                onClick={() => setEBillModalData(null)}
                className="absolute right-4 top-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest mb-1">
                Paid · {eBillModalData.paymentMode}
              </span>
              <h3 className="text-xl font-black tracking-tight">{eBillModalData.hotelName}</h3>
              {eBillModalData.address && (
                <p className="text-[11px] opacity-90 mt-0.5">{eBillModalData.address}</p>
              )}
              {eBillModalData.gstNumber && (
                <p className="text-[10px] font-mono opacity-80 mt-0.5">GSTIN: {eBillModalData.gstNumber}</p>
              )}
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex justify-between border-b border-dashed border-slate-200 dark:border-white/10 pb-3 text-slate-600 dark:text-slate-300 font-bold">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Invoice</span>
                  <span className="text-slate-900 dark:text-white font-black">{eBillModalData.invoiceId}</span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 block uppercase">Table</span>
                  <span className="text-slate-900 dark:text-white font-black">{eBillModalData.tableName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Date</span>
                  <span className="text-slate-900 dark:text-white font-black">{eBillModalData.dateTime}</span>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {eBillModalData.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center font-bold text-slate-700 dark:text-slate-200">
                    <div>
                      <span>{item.name}</span>
                      <span className="text-slate-400 text-[11px] ml-1.5">x{item.quantity}</span>
                    </div>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-200 dark:border-white/10 pt-3 space-y-1.5 font-bold text-slate-500 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(eBillModalData.subtotal)}</span>
                </div>
                {eBillModalData.cgst > 0 && (
                  <div className="flex justify-between">
                    <span>CGST ({cgstRate}%)</span>
                    <span>{formatCurrency(eBillModalData.cgst)}</span>
                  </div>
                )}
                {eBillModalData.sgst > 0 && (
                  <div className="flex justify-between">
                    <span>SGST ({sgstRate}%)</span>
                    <span>{formatCurrency(eBillModalData.sgst)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-white/10">
                  <span>Grand Total</span>
                  <span className="text-[#ff6b00]">{formatCurrency(eBillModalData.grandTotal)}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const encodedData = window.btoa(unescape(encodeURIComponent(JSON.stringify(eBillModalData))));
                    const eBillUrl = `${window.location.origin}/#/ebill?data=${encodedData}`;
                    const msg = `*${eBillModalData.hotelName} - Digital E-Bill* 🧾\n\nInvoice: ${eBillModalData.invoiceId}\nTable: ${eBillModalData.tableName}\nTotal Paid: *₹${eBillModalData.grandTotal.toFixed(2)}*\n\n👇 View & Download your E-Bill:\n${eBillUrl}\n\nThank you for dining with us!`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Share on WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openBrowserPrintReceipt({
                      ...eBillModalData,
                      orderId: eBillModalData.invoiceId,
                      tableNumber: eBillModalData.tableName,
                      cgstRate,
                      sgstRate,
                      serviceChargeRate,
                      currencySymbol: systemSettings.billing.currencySymbol
                    })
                  }
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Print / PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}