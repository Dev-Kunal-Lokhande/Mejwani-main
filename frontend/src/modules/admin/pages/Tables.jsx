import React, { useState, useEffect, useDeferredValue, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  AlertTriangle,
  Loader2,
  Copy,
  Download
} from 'lucide-react';
import AdminLayout from '../../../shared/layouts/AdminLayout';
import { API_BASE, authorizedFetch } from '../../../shared/services/apiBase';
import QRCode from "qrcode";

// Lightweight elegant Skeleton Card for background loading
const TableSkeleton = () => (
  <div className="group relative bg-white dark:bg-black/25 border border-slate-200 dark:border-white/5 rounded-[28px] p-6 space-y-6 animate-pulse">
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <div className="h-3 w-8 bg-slate-200 dark:bg-white/10 rounded-full" />
        <div className="w-11 h-11 bg-slate-100 dark:bg-white/[0.03] rounded-2xl" />
      </div>
      <div className="flex gap-2">
        <div className="w-8 h-8 bg-slate-100 dark:bg-white/[0.03] rounded-xl" />
        <div className="w-8 h-8 bg-slate-100 dark:bg-white/[0.03] rounded-xl" />
      </div>
    </div>
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-4 w-32 bg-slate-200 dark:bg-white/10 rounded-full" />
        <div className="h-3 w-24 bg-slate-100 dark:bg-white/[0.03] rounded-full" />
      </div>
      <div className="pt-4 border-t border-slate-100 dark:border-white/[0.04] flex justify-between items-center">
        <div className="h-3 w-16 bg-slate-100 dark:bg-white/[0.03] rounded-full" />
        <div className="h-3 w-12 bg-slate-200 dark:bg-white/10 rounded-full" />
      </div>
    </div>
  </div>
);

export default function TablesManagement() {
  // Stale-While-Revalidate: Seed initial state from local cache for instant 0ms mount render
  const [tables, setTables] = useState(() => {
    const cached = localStorage.getItem('mejwani_cached_tables');
    return cached ? JSON.parse(cached) : [];
  });
  const [sections, setSections] = useState(() => {
    const cached = localStorage.getItem('mejwani_cached_sections');
    return cached ? JSON.parse(cached) : [];
  });

  const [activeSectionId, setActiveSectionId] = useState('all');
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'section' | 'table', id: number, name: string }

  // Loading & error feedback
  const [loading, setLoading] = useState(() => {
    // If we have cached data, don't show first-fetch skeletons
    const hasCachedTables = localStorage.getItem('mejwani_cached_tables');
    return !hasCachedTables;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }

  // Form states
  const [editingTable, setEditingTable] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionDisplayOrder, setNewSectionDisplayOrder] = useState(1);

  // Table form states
  const [tableNumber, setTableNumber] = useState("");
  const [tableName, setTableName] = useState("");
  const [tableCapacity, setTableCapacity] = useState(4);
  const [tableSectionId, setTableSectionId] = useState("");
  const [tableStatus, setTableStatus] = useState("available");

  // Fetch sections and tables from backend with SWR caching
const readApiResponse = async (response, endpoint) => {
  const body = await response.text();

  let data;
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    throw new Error(`${endpoint}: invalid response (HTTP ${response.status})`);
  }

  if (!response.ok) {
    throw new Error(`${endpoint}: HTTP ${response.status} ${response.statusText}`);
  }

  return data;
};

const fetchData = async (showLoadingSpinner = false) => {
  if (showLoadingSpinner) setLoading(true);

  setIsSyncing(true);
  setErrorMsg('');

  try {
    const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
    const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id');
    const hotelParam = hotelId ? `?hotelId=${encodeURIComponent(hotelId)}` : '';

    const sectionsRes = await authorizedFetch(`${API_BASE}/sections${hotelParam}`);
    const sectionsData = await readApiResponse(sectionsRes, '/api/sections');

    if (sectionsData.success) {
      const filteredSec = (sectionsData.data || []).filter(
        s => s.section_name?.toUpperCase() !== 'PARCEL'
      );
      setSections(filteredSec);
      localStorage.setItem('mejwani_cached_sections', JSON.stringify(filteredSec));
    }

    const tablesRes = await authorizedFetch(`${API_BASE}/tables${hotelParam}`);
    const tablesData = await readApiResponse(tablesRes, '/api/tables');

    if (tablesData.success) {
      const filteredTab = (tablesData.data || []).filter(
        t => t.section_name?.toUpperCase() !== 'PARCEL'
      );
      setTables(filteredTab);
      localStorage.setItem('mejwani_cached_tables', JSON.stringify(filteredTab));
    }
  } catch (err) {
    console.error('Error fetching data:', err);
    setErrorMsg(err.message || 'Failed to sync with the restaurant database.');
  } finally {
    setIsSyncing(false);
    setLoading(false);
  }
};
  useEffect(() => {
    fetchData(true);
  }, []);

  // Show dynamic toast notifications
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const getFrontendOrigin = () => {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.origin;
    }
    return '';
  };

  const normalizeTableLink = (table) => {
    const formattedArea = (table.section_name || '').trim().replace(/\s+/g, '-').toUpperCase();
    const tableCode = (table.table_number || table.table_name || '').trim();
    // Read hotel context from admin user stored at login
    const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
    const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
    const hotelSlug = adminUser.hotel_slug || localStorage.getItem('mejwani_hotel_slug') || '';
    const hotelParams = [
      hotelId ? `hotelId=${encodeURIComponent(hotelId)}` : '',
      hotelSlug ? `hotelSlug=${encodeURIComponent(hotelSlug)}` : ''
    ].filter(Boolean).join('&');
    const basePath = `/menu?area=${encodeURIComponent(formattedArea)}&table=${encodeURIComponent(tableCode)}${hotelParams ? '&' + hotelParams : ''}`;
    const path = table.menu_path || basePath;
    return path.startsWith('http') ? path : `${getFrontendOrigin()}${path}`;
  };

  const handleCopyLink = async (table) => {
    console.log("Copy action triggered");
    const qrUrl = normalizeTableLink(table);
    console.log("Generated QR URL:", qrUrl);

    // Verify URL generation logic
    const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
    const hotelId = adminUser.hotel_id || localStorage.getItem('mejwani_hotel_id') || '';
    const tableCode = (table.table_number || table.table_name || '').trim();

    if (!hotelId) {
      console.warn("Copy link verification: hotelId is missing in admin user context");
    }
    if (!tableCode) {
      console.warn("Copy link verification: tableId/code is missing for table", table);
    }
    if (!qrUrl) {
      console.error("Copy link verification failed: Generated QR URL is null/undefined");
      showToast('error', 'Unable to copy link. URL is invalid.');
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(qrUrl);
      } else {
        // Fallback support for non-secure origins (HTTP, LAN IP) and mobile browsers
        const textArea = document.createElement("textarea");
        textArea.value = qrUrl;
        textArea.style.position = "fixed";
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!successful) {
          throw new Error("document.execCommand('copy') failed");
        }
      }
      showToast('success', 'Link copied successfully');
    } catch (err) {
      // If clipboard permission is blocked, show exact error in console instead of generic toast
      console.error('Clipboard copy action failed with error:', err);
      showToast('error', 'Unable to copy link. Please try again');
    }
  };

  const downloadTableQR = async (table) => {
    try {
      // 1. Get the hotel's QR pamphlet template URL from the logged-in admin's data
      const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
      const qrTemplateUrl = adminUser.qr_pamphlet;

      if (!qrTemplateUrl) {
        showToast("error", "No QR template configured for this hotel. Please ask Super Admin to upload a QR pamphlet template.");
        return;
      }

      const link = normalizeTableLink(table);

      // 2. Generate QR code data URL
      const qrDataUrl = await QRCode.toDataURL(link, {
        width: 500,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      // 3. Load hotel's QR pamphlet template from Cloudinary
      const template = new Image();
      template.crossOrigin = "anonymous"; // Required for cross-origin Cloudinary images on canvas
      template.src = qrTemplateUrl;

      template.onload = () => {
        // Final canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = template.width;
        canvas.height = template.height;

        // Draw template background
        ctx.drawImage(template, 0, 0);

        // Load QR image
        const qrImage = new Image();
        qrImage.src = qrDataUrl;

        qrImage.onload = () => {

          // =========================
          // QR POSITION — Proportional, fully centered, never clipped
          // =========================
          // The QR template poster has a blank center section between the
          // "हा QR स्कॅन करा" banner (~56% from top) and the footer text (~82% from top).
          // We place the QR fully within this zone, centered both horizontally and vertically.
          const W = canvas.width;
          const H = canvas.height;

          const zoneTop = Math.round(H * 0.56);  // top of blank scan area
          const zoneBottom = Math.round(H * 0.82);  // bottom before footer text
          const zoneHeight = zoneBottom - zoneTop;

          // QR size = min(55% of width, 80% of zone height) — keeps equal margins
          const maxQrFromWidth = Math.round(W * 0.60);
          const maxQrFromHeight = Math.round(zoneHeight * 0.70);
          const qrSize = Math.min(maxQrFromWidth, maxQrFromHeight);
          const qrPadding = Math.round(qrSize * 0.15);  // 12% padding around QR

          // Center QR horizontally; center within zone vertically
          const qrX = Math.round((W - qrSize) / 2);
          const qrY = Math.round(zoneTop + (zoneHeight - qrSize) / 2);

          // White rounded background pad for maximum scannability
          const bgX = qrX - qrPadding;
          const bgY = qrY - qrPadding;
          const bgSize = qrSize + qrPadding * 2;
          const radius = Math.round(bgSize * 0.06);  // subtle rounding

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.moveTo(bgX + radius, bgY);
          ctx.lineTo(bgX + bgSize - radius, bgY);
          ctx.quadraticCurveTo(bgX + bgSize, bgY, bgX + bgSize, bgY + radius);
          ctx.lineTo(bgX + bgSize, bgY + bgSize - radius);
          ctx.quadraticCurveTo(bgX + bgSize, bgY + bgSize, bgX + bgSize - radius, bgY + bgSize);
          ctx.lineTo(bgX + radius, bgY + bgSize);
          ctx.quadraticCurveTo(bgX, bgY + bgSize, bgX, bgY + bgSize - radius);
          ctx.lineTo(bgX, bgY + radius);
          ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY);
          ctx.closePath();
          ctx.fill();

          // Draw the QR code
          ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

          // =========================
          // TABLE CODE — centered just below the white pad, within zone
          // =========================
          const textY = bgY + bgSize + Math.round(H * 0.000);
          const fontSize = Math.round(H * 0.025);
          ctx.fillStyle = "#4b2e1e";
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.textAlign = "center";
          ctx.fillText(`TABLE ${table.table_number}`, W / 2, textY);

          // Download
          const downloadLink = document.createElement("a");
          downloadLink.download = `table-${table.table_number}-qr.png`;
          downloadLink.href = canvas.toDataURL("image/png");

          downloadLink.click();

          showToast("success", "QR downloaded successfully");
        };
      };

      template.onerror = () => {
        console.error("[downloadTableQR] Failed to load QR template from:", qrTemplateUrl);
        showToast("error", "Failed to load QR template image. The template URL may be invalid or expired.");
      };
    } catch (error) {
      console.error(error);
      showToast("error", "Failed to generate QR");
    }
  };

  // 1. SECTION CRUD OPERATIONS
  const handleSaveSection = async (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;

    setActionLoading(true);
    const token = localStorage.getItem('mejwani_admin_jwt');

    try {
      const url = editingSection
        ? `${API_BASE}/sections/${editingSection.id}`
        : `${API_BASE}/sections`;

      const method = editingSection ? 'PUT' : 'POST';

      const hotelId = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}').hotel_id || localStorage.getItem('mejwani_hotel_id');

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          hotelId,
          section_name: newSectionName.trim(),
          display_order: newSectionDisplayOrder
        })
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        showToast('success', editingSection ? 'Section renamed successfully' : 'New floor section created');
        setNewSectionName("");
        setEditingSection(null);
        setIsSectionModalOpen(false);
        fetchData();
      } else {
        showToast('error', resData.message || 'Operation failed');
      }
    } catch (err) {
      console.error('Section save error:', err);
      showToast('error', 'Network failure during action');
    } finally {
      setActionLoading(false);
    }
  };

  const executeDeleteSection = async (id) => {
    setActionLoading(true);
    const token = localStorage.getItem('mejwani_admin_jwt');

    try {
      const response = await fetch(`${API_BASE}/sections/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        showToast('success', 'Section and nested tables successfully removed');
        setDeleteTarget(null);
        if (activeSectionId === id) setActiveSectionId('all');
        fetchData();
      } else {
        showToast('error', resData.message || 'Failed to delete section');
      }
    } catch (err) {
      console.error('Delete section error:', err);
      showToast('error', 'Database synchronization error');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. TABLE CRUD OPERATIONS
  const handleSaveTable = async (e) => {
    e.preventDefault();
    if (!tableNumber.trim() || !tableName.trim() || !tableSectionId) {
      showToast('error', 'All fields are required');
      return;
    }

    setActionLoading(true);
    const token = localStorage.getItem('mejwani_admin_jwt');

    try {
      const url = editingTable
        ? `${API_BASE}/tables/${editingTable.id}`
        : `${API_BASE}/tables`;

      const method = editingTable ? 'PUT' : 'POST';

      const hotelId = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}').hotel_id || localStorage.getItem('mejwani_hotel_id');

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hotelId,
          table_number: tableNumber.trim(),
          table_name: tableName.trim(),
          seating_capacity: parseInt(tableCapacity),
          section_id: parseInt(tableSectionId),
          status: tableStatus
        })
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        showToast('success', editingTable ? 'Table details updated' : 'Table successfully introduced');
        setIsModalOpen(false);
        setEditingTable(null);
        fetchData();
      } else {
        showToast('error', resData.message || 'Failed to update table details');
      }
    } catch (err) {
      console.error('Table save error:', err);
      showToast('error', 'Server authentication failure');
    } finally {
      setActionLoading(false);
    }
  };

  const executeDeleteTable = async (id) => {
    setActionLoading(true);
    const token = localStorage.getItem('mejwani_admin_jwt');

    // Optimistic UI state removal
    const originalTables = tables;
    setTables(prev => prev.filter(t => t.id !== id));

    try {
      const response = await fetch(`${API_BASE}/tables/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        showToast('success', 'Table removed from layout');
        setDeleteTarget(null);
        fetchData();
      } else {
        // Rollback state
        setTables(originalTables);
        showToast('error', resData.message || 'Failed to delete table');
      }
    } catch (err) {
      console.error('Delete table error:', err);
      // Rollback state
      setTables(originalTables);
      showToast('error', 'Database pool access error');
    } finally {
      setActionLoading(false);
    }
  };

  // Live status patch directly from card
  const handleQuickStatusChange = async (tableId, newStatus) => {
    const token = localStorage.getItem('mejwani_admin_jwt');
    try {
      // Optimistic update
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));

      const response = await fetch(`${API_BASE}/tables/${tableId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        showToast('error', resData.message || 'Failed to save live status change');
        fetchData();
      } else {
        showToast('success', `Table status updated to ${newStatus}`);
      }
    } catch (err) {
      console.error('Quick status error:', err);
      showToast('error', 'Offline status sync failure');
      fetchData();
    }
  };

  // Memoized Search & Section filtering using deferred React 18 scheduler value
  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      const matchesSection = activeSectionId === 'all' || t.section_id === parseInt(activeSectionId);
      const matchesSearch = t.table_number.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        t.table_name.toLowerCase().includes(deferredSearchQuery.toLowerCase());
      return matchesSection && matchesSearch;
    });
  }, [tables, activeSectionId, deferredSearchQuery]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'available': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'occupied': return <XCircle className="w-4 h-4 text-rose-500" />;
      case 'cleaning': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'reserved': return <Clock className="w-4 h-4 text-indigo-500" />;
      default: return null;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 select-none">

        {/* TOAST PANEL */}
        {toast && (
          <div className="fixed top-5 right-5 z-[200] animate-in fade-in slide-in-from-top-5 duration-300">
            <div className={`px-6 py-4 rounded-2xl shadow-2xl border text-sm font-bold flex items-center gap-3 backdrop-blur-xl ${toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
              <span className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {toast.message}
            </div>
          </div>
        )}

        {/* Header Actions */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">

            {/* Search Input */}
            <div className="relative min-w-[260px] md:max-w-xs flex items-center">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search table or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3.5 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:border-[#ff6b00] focus:ring-1 focus:ring-[#ff6b00]/30 transition-all font-bold"
              />
              {isSyncing && (
                <Loader2 className="absolute right-4 w-4 h-4 animate-spin text-[#ff6b00]" />
              )}
            </div>

            {/* Layout Floor Sections Selection */}
            <div className="flex flex-wrap items-center bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl p-1 gap-1.5 max-w-full overflow-x-auto">
              <button
                onClick={() => setActiveSectionId('all')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all uppercase tracking-wider ${activeSectionId === 'all'
                  ? 'bg-gradient-to-br from-[#ff6b00] to-[#ff8c3a] text-white shadow-md shadow-orange-500/20'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
              >
                All Areas
              </button>

              {sections.map((s) => (
                <div key={s.id} className="flex items-center bg-slate-100/50 dark:bg-white/[0.03] rounded-xl pr-1 border border-transparent dark:border-white/[0.02]">
                  <button
                    onClick={() => setActiveSectionId(s.id)}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all uppercase tracking-wider flex items-center gap-2 ${activeSectionId === s.id
                      ? 'bg-gradient-to-br from-[#ff6b00] to-[#ff8c3a] text-white shadow-md shadow-orange-500/20'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                  >
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${activeSectionId === s.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'}`}>
                      {s.display_order}
                    </span>
                    <span>{s.section_name}</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingSection(s);
                      setNewSectionName(s.section_name);
                      setNewSectionDisplayOrder(s.display_order || 1);
                      setIsSectionModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-[#ff6b00] hover:bg-white/10 rounded-lg transition-colors"
                    title="Rename Floor Section"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => setDeleteTarget({ type: 'section', id: s.id, name: s.section_name })}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white/10 rounded-lg transition-colors"
                    title="Delete Floor Section"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setEditingSection(null);
                setNewSectionName("");
                const nextOrder = sections.length > 0 ? Math.max(...sections.map(s => s.display_order || 0)) + 1 : 1;
                setNewSectionDisplayOrder(nextOrder);
                setIsSectionModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-5 py-3.5 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 hover:border-[#ff6b00]/30 hover:bg-[#ff6b00]/5 text-slate-800 dark:text-white rounded-2xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
            >
              <Layers className="w-4 h-4 text-[#ff6b00]" />
              Manage Areas
            </button>

            <button
              onClick={() => {
                if (sections.length === 0) {
                  showToast('error', 'Create a layout section/area first!');
                  return;
                }
                setEditingTable(null);
                setTableNumber("");
                setTableName("");
                setTableCapacity(4);
                setTableSectionId(sections[0].id.toString());
                setTableStatus("available");
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#ff6b00] to-[#ff8524] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Table
            </button>
          </div>
        </div>

        {/* Live Loading screen */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
            {[1, 2, 3, 4].map((n) => (
              <TableSkeleton key={n} />
            ))}
          </div>
        ) : errorMsg ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-3xl p-8 text-center max-w-lg mx-auto space-y-4">
            <AlertTriangle className="w-10 h-10 mx-auto text-red-500" />
            <h4 className="text-lg font-black uppercase tracking-wide">Sync Offline</h4>
            <p className="text-xs font-bold leading-relaxed">{errorMsg}</p>
            <button onClick={fetchData} className="px-6 py-2.5 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider">Retry connection</button>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="border border-dashed border-slate-200 dark:border-white/10 rounded-3xl p-16 text-center max-w-md mx-auto space-y-3">
            <Layers className="w-10 h-10 mx-auto text-[#ff6b00]/40" />
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">No active tables found</h4>
            <p className="text-[11px] font-bold text-slate-400 dark:text-white/25">Begin creating sections or adding tables to build your restaurant map layout</p>
          </div>
        ) : (
          /* Dynamic Tables Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
            {filteredTables.map((table) => {
              const displayStatus = table.status;
              let cardBgBorderClasses = 'bg-white dark:bg-black/45 border-slate-200 dark:border-white/5 hover:border-[#ff6b00]/40';
              if (displayStatus === 'occupied') {
                cardBgBorderClasses = 'bg-rose-50/30 dark:bg-rose-950/10 border-rose-500/30 dark:border-rose-500/10 hover:border-rose-500/60';
              } else if (displayStatus === 'bill_pending' || displayStatus === 'cleaning') {
                cardBgBorderClasses = 'bg-amber-50/30 dark:bg-amber-950/10 border-amber-500/30 dark:border-amber-500/10 hover:border-amber-500/60';
              } else if (displayStatus === 'available') {
                cardBgBorderClasses = 'bg-emerald-50/10 dark:bg-emerald-950/5 border-emerald-500/20 dark:border-emerald-500/5 hover:border-emerald-500/50';
              }

              return (
                <div
                  key={table.id}
                  className={`group relative border-2 rounded-[28px] p-6 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(255,107,0,0.06)] shadow-sm ${cardBgBorderClasses}`}
                >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 block mb-1">Code</span>
                    <div className="w-11 h-11 bg-slate-50 dark:bg-white/[0.04] rounded-2xl flex items-center justify-center text-lg font-black text-slate-800 dark:text-white group-hover:scale-105 transition-transform">
                      {table.table_number}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        setEditingTable(table);
                        setTableNumber(table.table_number);
                        setTableName(table.table_name);
                        setTableCapacity(table.seating_capacity);
                        setTableSectionId(table.section_id.toString());
                        setTableStatus(table.status);
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-[#ff6b00] hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                      title="Edit Table Layout"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopyLink(table)}
                      className="p-2 text-slate-400 hover:text-[#ff6b00] hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                      title="Copy Table Link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => downloadTableQR(table)}
                      className="p-2 text-slate-400 hover:text-[#ff6b00] hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                      title="Download QR"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ type: 'table', id: table.id, name: table.table_name })}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                      title="Remove Table"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">{table.table_name}</h4>
                      {getStatusIcon(table.status)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-bold text-slate-500 dark:text-white/45">{table.seating_capacity} Seater Capacity</span>
                    </div>
                  </div>

                  {/* Floor Area Placement details directly on card */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/[0.04]">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-white/30">Layout Area</span>
                    <span className="text-xs font-black uppercase tracking-widest text-[#d6b36a]/85">{table.section_name}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* SECTION MODAL */}
        {isSectionModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
              onClick={() => setIsSectionModalOpen(false)}
            />

            <div className="relative w-full max-w-md bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-100 dark:border-white/5">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {editingSection ? "Rename Layout Area" : "Add Layout Area"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/40 font-bold mt-1.5 uppercase tracking-wide">
                  Create hotel floors, cabins, or banquet areas
                </p>
              </div>

              <form onSubmit={handleSaveSection} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#d6b36a]/85 block pl-0.5">
                    Section / Area Name *
                  </label>
                  <input
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="e.g. AC Hall, Rooftop, Banquet"
                    required
                    disabled={actionLoading}
                    className="w-full px-4 py-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm focus:outline-none focus:border-[#ff6b00] focus:ring-1 focus:ring-[#ff6b00]/25 transition-all text-slate-800 dark:text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#d6b36a]/85 block pl-0.5">
                    Display Order *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={newSectionDisplayOrder}
                    onChange={(e) => setNewSectionDisplayOrder(parseInt(e.target.value) || 1)}
                    placeholder="e.g. 1, 2, 3"
                    required
                    disabled={actionLoading}
                    className="w-full px-4 py-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm focus:outline-none focus:border-[#ff6b00] focus:ring-1 focus:ring-[#ff6b00]/25 transition-all text-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSectionModalOpen(false)}
                    disabled={actionLoading}
                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={actionLoading || !newSectionName.trim()}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-[#ff6b00] to-[#ff8524] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                  >
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                    <span>{editingSection ? 'Save Changes' : 'Create Section'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TABLE MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />

            <div className="relative w-full max-w-md bg-white dark:bg-[#0d0d0d] border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-100 dark:border-white/5">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {editingTable ? 'Edit Table Settings' : 'Introduce New Table'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/40 font-bold mt-1.5 uppercase tracking-wide">
                  Configure dining capacity and layout coordinates
                </p>
              </div>

              <form onSubmit={handleSaveTable} className="p-8 space-y-5">

                {/* Table Code */}
                <div className="space-y-2">
                  <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#d6b36a]/85 block pl-0.5">Table Code / Number</label>
                  <input
                    type="text"
                    required
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="e.g. T1, T15, BAR-3"
                    disabled={actionLoading}
                    className="w-full px-4 py-3.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm focus:outline-none focus:border-[#ff6b00] focus:ring-1 focus:ring-[#ff6b00]/25 transition-all text-slate-800 dark:text-white"
                  />
                </div>

                {/* Table Name */}
                <div className="space-y-2">
                  <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#d6b36a]/85 block pl-0.5">Table Display Name</label>
                  <input
                    type="text"
                    required
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="e.g. Table 1, Executive Table"
                    disabled={actionLoading}
                    className="w-full px-4 py-3.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm focus:outline-none focus:border-[#ff6b00] focus:ring-1 focus:ring-[#ff6b00]/25 transition-all text-slate-800 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Seating capacity */}
                  <div className="space-y-2">
                    <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#d6b36a]/85 block pl-0.5">Seating Capacity</label>
                    <select
                      value={tableCapacity}
                      onChange={(e) => setTableCapacity(parseInt(e.target.value))}
                      disabled={actionLoading}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-xs uppercase tracking-wider focus:outline-none focus:border-[#ff6b00] transition-all text-slate-800 dark:text-white"
                    >
                      {[2, 4, 6, 8, 10, 12].map(n => <option key={n} value={n} className="dark:bg-[#0c0c0c]">{n} Persons</option>)}
                    </select>
                  </div>

                  {/* Section Selector */}
                  <div className="space-y-2">
                    <label className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#d6b36a]/85 block pl-0.5">Layout Area</label>
                    <select
                      value={tableSectionId}
                      onChange={(e) => setTableSectionId(e.target.value)}
                      disabled={actionLoading}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-xs uppercase tracking-wider focus:outline-none focus:border-[#ff6b00] transition-all text-slate-800 dark:text-white"
                    >
                      {sections.map(s => <option key={s.id} value={s.id} className="dark:bg-[#0c0c0c]">{s.section_name}</option>)}
                    </select>
                  </div>
                </div>


                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={actionLoading}
                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-[#ff6b00] to-[#ff8524] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                  >
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                    <span>{editingTable ? 'Save Changes' : 'Create Table'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


        {/* PREMIUM GLASS Delete Confirmation Modal (Requirement 9) */}
        {deleteTarget && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />

            <div className="relative w-full max-w-md bg-white dark:bg-[#0c0c0c]/90 border border-red-500/20 dark:border-red-500/10 rounded-[2.5rem] shadow-[0_0_50px_rgba(239,68,68,0.15)] p-8 text-center space-y-6 overflow-hidden animate-in scale-in-95 duration-200">
              <div className="w-14 h-14 bg-red-500/10 dark:bg-red-500/5 rounded-full flex items-center justify-center mx-auto text-red-500 shadow-inner">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">Destructive Action</h3>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-red-500 pl-0.5">Warning Required</p>

                <p className="text-xs text-slate-500 dark:text-white/40 leading-relaxed font-bold max-w-xs mx-auto pt-2">
                  Are you absolutely certain you want to delete the {deleteTarget.type} <strong className="text-slate-800 dark:text-white">"{deleteTarget.name}"</strong>?
                  {deleteTarget.type === 'section' && (
                    <span className="block mt-2 text-red-500/80 font-extrabold">Warning: Removing this section will also permanently delete all associated tables!</span>
                  )}
                </p>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer"
                >
                  Keep It
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => {
                    if (deleteTarget.type === 'section') {
                      executeDeleteSection(deleteTarget.id);
                    } else {
                      executeDeleteTable(deleteTarget.id);
                    }
                  }}
                  className="flex-1 px-6 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-500/25 hover:bg-red-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  <span>Delete Permanently</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
