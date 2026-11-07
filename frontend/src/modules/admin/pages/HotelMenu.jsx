import React, { useState, useEffect, useDeferredValue, useMemo, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Loader2, 
  AlertTriangle, 
  X, 
  IndianRupee, 
  Layers, 
  Soup, 
  Leaf, 
  Flame, 
  Coffee, 
  IceCream, 
  CircleDot,
  Sparkles
} from 'lucide-react';
import AdminLayout from '../../../shared/layouts/AdminLayout';
import { invalidateMenuCache } from '../../../shared/services/menuCache';
import { API_BASE, authorizedFetch } from '../../../shared/services/apiBase';
import { getTranslationCacheKey, transliterateMenuName as sharedTransliterateMenuName } from '../../../shared/services/menuTranslation';
import IndicTransliterate from 'indic-transliterate';

import { useNavigate } from 'react-router-dom';

const getCategoryStyling = (cat) => {
  switch (cat) {
    case 'SOUP':
      return { icon: Soup, color: 'text-amber-500 bg-amber-500/10 border-amber-500/10' };
    case 'VEG STARTER':
      return { icon: Leaf, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/10' };
    case 'NON-VEG STARTER':
      return { icon: Flame, color: 'text-rose-500 bg-rose-500/10 border-rose-500/10' };
    case 'CHINESE STARTER':
      return { icon: Sparkles, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/10' };
    case 'VEG MAIN COURSE':
      return { icon: Layers, color: 'text-green-500 bg-green-500/10 border-green-500/10' };
    case 'NON-VEG MAIN COURSE':
      return { icon: Flame, color: 'text-red-500 bg-red-500/10 border-red-500/10' };
    case 'BEVERAGES':
      return { icon: Coffee, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/10' };
    case 'DESSERTS':
      return { icon: IceCream, color: 'text-pink-500 bg-pink-500/10 border-pink-500/10' };
    default:
      return { icon: Layers, color: 'text-slate-500 bg-slate-50/10 border-slate-100' };
  }
};

const MenuItemSkeleton = () => (
  <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 space-y-4 animate-pulse">
    <div className="space-y-2">
      <div className="h-5 bg-slate-200 dark:bg-white/10 rounded-full w-2/3" />
      <div className="h-4 bg-slate-100 dark:bg-white/5 rounded-full w-1/2" />
    </div>
    <div className="h-4 bg-slate-100 dark:bg-white/5 rounded-full w-1/3" />
    <div className="h-6 bg-slate-200 dark:bg-white/10 rounded-full w-1/4" />
    <div className="flex justify-between items-center pt-2">
      <div className="h-6 bg-slate-200 dark:bg-white/10 rounded-full w-1/2" />
      <div className="flex gap-2">
        <div className="w-8 h-8 bg-slate-100 dark:bg-white/5 rounded-lg" />
        <div className="w-8 h-8 bg-slate-100 dark:bg-white/5 rounded-lg" />
      </div>
    </div>
  </div>
);

export default function HotelMenu() {
  // SWR local storage cache initialization
  const [menuItems, setMenuItems] = useState(() => {
    const cached = localStorage.getItem('mejwani_cached_menu');
    return cached ? JSON.parse(cached) : [];
  });
  
  const [categories, setCategories] = useState(() => {
    const cached = localStorage.getItem('mejwani_cached_categories');
    return cached ? JSON.parse(cached) : [];
  });

  const navigate = useNavigate();

  const [loading, setLoading] = useState(() => {
    const hasCache = localStorage.getItem('mejwani_cached_menu');
    return !hasCache;
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState(null);

  // Search, Filters & Tab selections
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL"); // ALL, VEG, NON_VEG

  // Modals controller states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id: number, name: string }

  // Item Form States
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    marathiName: "",
    hindiName: "",
    code: "",
    price: "",
    pricing_type: "SINGLE",
    half_price: "",
    full_price: "",
    category: "SOUP",
    type: "VEG",
    isAvailable: true
  });
  const [manualOverride, setManualOverride] = useState({ marathiName: false, hindiName: false });
  const [nameTouched, setNameTouched] = useState(false);
  const [translationStatus, setTranslationStatus] = useState('idle');
  const [translationError, setTranslationError] = useState('');
  const translationCache = useRef({});

  // Pull dynamic list from database
  const fetchMenu = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setIsSyncing(true);f
    setErrorMsg("");
    try {
      const [menuRes, categoriesRes] = await Promise.all([
        authorizedFetch(`${API_BASE}/menu`),
        authorizedFetch(`${API_BASE}/menu-categories`)
      ]);
      const resData = await menuRes.json();
      const catData = await categoriesRes.json();
      
      if (resData.success) {
        setMenuItems(resData.data);
        localStorage.setItem('mejwani_cached_menu', JSON.stringify(resData.data));
      } else {
        if (showLoader) setErrorMsg(resData.message || 'Failed to query menu card');
      }
      
      if (catData.success) {
        setCategories(catData.data);
        localStorage.setItem('mejwani_cached_categories', JSON.stringify(catData.data));
      }
    } catch (err) {
      console.error('Menu pull error:', err);
      if (showLoader) setErrorMsg('Database access error. Ensure backend is running.');
    } finally {
      setIsSyncing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu(menuItems.length === 0);
  }, []);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const getCacheKey = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase();

  const foodTransliterationDictionary = {
    butter: 'बटर',
    paneer: 'पनीर',
    masala: 'मसाला',
    soup: 'सूप',
    veg: 'वेज',
    chicken: 'चिकन',
    biryani: 'बिर्याणी',
    tikka: 'टिक्का',
    manchow: 'मंचाव',
    noodles: 'नूडल्स',
    fried: 'फ्राईड',
    rice: 'राईस',
    gravy: 'ग्रेवी',
    naan: 'नान',
    paratha: 'पराठा',
    dosa: 'डोसा',
    momo: 'मोमो',
    momos: 'मोमोज़',
    kebab: 'कबाब',
    roll: 'रोल',
    paneer: 'पनीर',
    tikka: 'टिक्का',
    burger: 'बर्गर',
    sandwich: 'सॅन्डविच',
    fries: 'फ्रायस',
    salad: 'सॅलड',
    chicken: 'चिकन',
    chilli: 'चिली',
    chilli: 'चिली',
    chilli: 'चिली',
    chop: 'चॉप',
    roast: 'रोस्ट',
    curry: 'करी',
    biryani: 'बिर्याणी',
    manchurian: 'मंचुरियन',
    kebab: 'कबाब',
    hash: 'हॅश',
    dosa: 'डोसा',
    idli: 'इडली',
    sambar: 'सांबार',
    chutney: 'चटणी'
  };

  const phraseDictionary = {
    'butter paneer masala': 'बटर पनीर मसाला',
    'paneer tikka': 'पनीर टिक्का',
    'chicken biryani': 'चिकन बिर्याणी',
    'veg manchurian': 'वेज मंचुरियन',
    'manchow soup': 'मंचाव सूप',
    'chicken fried rice': 'चिकन फ्राईड राईस',
    'veg noodles': 'वेज नूडल्स',
    'chicken tikka': 'चिकन टिक्का',
    'butter chicken': 'बटर चिकन'
  };

  const transliterateMenuName = (rawName) => {
    const input = rawName.trim();
    if (!input) return '';

    const normalized = input.toLowerCase().replace(/\s+/g, ' ').trim();
    let result = normalized;

    // Apply whole-phrase mappings first for best menu-style accuracy.
    Object.keys(phraseDictionary).sort((a, b) => b.length - a.length).forEach((phrase) => {
      const phraseRegex = new RegExp(`\\b${phrase.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
      result = result.replace(phraseRegex, phraseDictionary[phrase]);
    });

    const tokens = result.split(/(\s+|[^A-Za-z0-9]+)/g).filter(Boolean);
    const transformed = tokens.map((token) => {
      if (/^[A-Za-z0-9]+$/.test(token)) {
        const key = token.toLowerCase();
        if (foodTransliterationDictionary[key]) {
          return foodTransliterationDictionary[key];
        }
        return IndicTransliterate.transliterate(token, 'devanagari');
      }
      return token;
    });

    return transformed.join('').trim();
  };

  useEffect(() => {
    const rawName = formData.name || '';
    const cacheKey = getTranslationCacheKey(rawName);
    const shouldTranslate = rawName.trim() && nameTouched && (!manualOverride.marathiName || !manualOverride.hindiName);

    if (!shouldTranslate) {
      if (!rawName.trim()) {
        setTranslationStatus('idle');
        setTranslationError('');
      }
      return;
    }

    const cached = translationCache.current[cacheKey];
    if (cached) {
      setTranslationStatus('success');
      setTranslationError('');
      setFormData((prev) => ({
        ...prev,
        marathiName: manualOverride.marathiName ? prev.marathiName : cached.marathi,
        hindiName: manualOverride.hindiName ? prev.hindiName : cached.hindi
      }));
      return;
    }

    setTranslationStatus('loading');
    const timer = setTimeout(() => {
      try {
        const { marathi, hindi } = sharedTransliterateMenuName(rawName);
        translationCache.current[cacheKey] = { marathi, hindi };
        setFormData((prev) => ({
          ...prev,
          marathiName: manualOverride.marathiName ? prev.marathiName : marathi,
          hindiName: manualOverride.hindiName ? prev.hindiName : hindi
        }));
        setTranslationStatus('success');
        setTranslationError('');
      } catch (err) {
        console.error('Auto-translation failed:', err);
        setTranslationStatus('error');
        setTranslationError('Auto-translation failed. You can type Marathi/Hindi manually.');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.name, manualOverride, nameTouched]);

  // Memoized & deferred filtering logic for butter-smooth listing
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(deferredSearchQuery.toLowerCase()) || 
        (item.marathiName && item.marathiName.toLowerCase().includes(deferredSearchQuery.toLowerCase())) ||
        (item.code && item.code.toLowerCase().includes(deferredSearchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
      const matchesType = selectedType === "ALL" || item.type === selectedType;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [menuItems, deferredSearchQuery, selectedCategory, selectedType]);

  // Form submission handler (Insert / Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    const isHalfFull = formData.pricing_type === 'HALF_FULL';
    const isNameValid = !!formData.name.trim();
    const isCategoryValid = !!formData.category;
    const isTypeValid = !!formData.type;
    const isPriceValid = isHalfFull 
      ? (!!formData.half_price && !!formData.full_price) 
      : !!formData.price;

    if (!isNameValid || !isCategoryValid || !isTypeValid || !isPriceValid) {
      showToast('error', 'All highlighted fields are required');
      return;
    }

    setActionLoading(true);
    const token = localStorage.getItem('mejwani_admin_jwt');
    const method = editingItem ? 'PUT' : 'POST';
    const endpoint = editingItem 
      ? `${API_BASE}/menu/${editingItem.id}` 
      : `${API_BASE}/menu`;
    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          marathiName: formData.marathiName.trim() || null,
          hindiName: formData.hindiName.trim() || null,
          code: formData.code.trim().toUpperCase(),
          price: isHalfFull ? parseFloat(formData.full_price) : parseFloat(formData.price),
          pricing_type: formData.pricing_type || 'SINGLE',
          half_price: isHalfFull ? parseFloat(formData.half_price) : null,
          full_price: isHalfFull ? parseFloat(formData.full_price) : null,
          category: formData.category,
          type: formData.type,
          isAvailable: formData.isAvailable
        })
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        invalidateMenuCache();
        showToast('success', editingItem ? 'Menu item details modified' : 'Menu item added to catalog');
        setIsModalOpen(false);
        setEditingItem(null);
        fetchMenu();
      } else {
        showToast('error', resData.message || 'Operation failed');
      }
    } catch (err) {
      console.error('Menu save error:', err);
      showToast('error', 'Authentication or database pool failure');
    } finally {
      setActionLoading(false);
    }
  };

  // Dynamic quick-toggle for items availability (iOS Switch)
  const handleAvailabilityToggle = async (item) => {
    const updatedStatus = !item.isAvailable;
    const token = localStorage.getItem('mejwani_admin_jwt');

    const originalItems = menuItems;
    setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, isAvailable: updatedStatus } : m));

    try {
      const response = await fetch(`${API_BASE}/menu/${item.id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isAvailable: updatedStatus })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        setMenuItems(originalItems); // Rollback
        showToast('error', resData.message || 'Failed to sync availability');
      } else {
        invalidateMenuCache();
        showToast('success', `${item.name} set to ${updatedStatus ? 'Available' : 'Unavailable'}`);
      }
    } catch (err) {
      console.error('Toggle error:', err);
      setMenuItems(originalItems); // Rollback
      showToast('error', 'Offline database sync failure');
    }
  };

  // Delete MenuItem handler
  const executeDelete = async (id) => {
    setActionLoading(true);
    const token = localStorage.getItem('mejwani_admin_jwt');

    const originalItems = menuItems;
    setMenuItems(prev => prev.filter(m => m.id !== id));

    try {
      const response = await fetch(`${API_BASE}/menu/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        invalidateMenuCache();
        showToast('success', 'Item removed from menu card');
        setDeleteTarget(null);
        fetchMenu();
      } else {
        setMenuItems(originalItems); // Rollback
        showToast('error', resData.message || 'Failed to remove menu item');
      }
    } catch (err) {
      console.error('Delete item error:', err);
      setMenuItems(originalItems); // Rollback
      showToast('error', 'Database pool access error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 select-none">
        
        {/* TOAST DISPLAY */}
        {toast && (
          <div className="fixed top-24 right-6 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className={`px-6 py-4 rounded-[1.5rem] shadow-2xl text-xs font-black uppercase tracking-wider flex items-center gap-3 border backdrop-blur-xl ${
              toast.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-ping'}`} />
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        {/* 5. HEADER SECTION (MINIMALIST) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-[#0c0c0c] p-6 md:p-8 rounded-[2rem] border border-slate-200/60 dark:border-white/5 shadow-sm">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Menu Management</h2>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Configure your food categories, prices, and instant availability</p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            {/* Minimal Search Bar */}
            <div className="relative min-w-[280px] flex-1 md:flex-initial">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search food name or translation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3.5 bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 rounded-2xl text-xs focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all font-bold text-slate-900 dark:text-white"
              />
              {isSyncing && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-orange-500" />
              )}
            </div>

            {/* Diet Filter Selector */}
            <div className="flex bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 rounded-2xl p-1 gap-1">
              {['ALL', 'VEG', 'NON_VEG'].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                    selectedType === type
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {type === 'NON_VEG' ? 'Non-Veg' : type === 'VEG' ? 'Veg' : 'All'}
                </button>
              ))}
            </div>

            {/* Manage Categories Button */}
            <button
              onClick={() => navigate('/admin/categories')}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-800 hover:bg-slate-900 dark:bg-white/10 dark:hover:bg-white/20 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Categories</span>
            </button>

            {/* Add Menu Item Button */}
            <button
              onClick={() => {
                setEditingItem(null);
                setFormData({
                  name: "",
                  marathiName: "",
                  hindiName: "",
                  code: "",
                  price: "",
                  pricing_type: "SINGLE",
                  half_price: "",
                  full_price: "",
                  category: categories.length > 0 ? categories[0].name : "SOUP",
                  type: "VEG",
                  isAvailable: true
                });
                setManualOverride({ marathiName: false, hindiName: false });
                setNameTouched(false);
                setTranslationStatus('idle');
                setTranslationError('');
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/15 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Dish</span>
            </button>
          </div>
        </div>

        {/* 4. CATEGORY HORIZONTAL FILTER PILLS */}
        <div className="flex items-center gap-2.5 pb-2 overflow-x-auto whitespace-nowrap scroll-smooth" style={{scrollbarWidth: 'auto'}}>
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`flex-shrink-0 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border cursor-pointer ${
              selectedCategory === "ALL"
                ? 'bg-orange-500 text-white border-transparent shadow-lg shadow-orange-500/15'
                : 'bg-white dark:bg-[#0c0c0c] border-slate-200/60 dark:border-white/5 text-slate-500 hover:text-slate-800 dark:hover:text-white shadow-sm'
            }`}
          >
            All Categories
          </button>
          {categories.filter(c => c.is_active).map((cat) => {
            const styling = getCategoryStyling(cat.name);
            const CatIcon = styling.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`flex-shrink-0 flex items-center gap-2.5 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border cursor-pointer ${
                  selectedCategory === cat.name
                    ? 'bg-orange-500 text-white border-transparent shadow-lg shadow-orange-500/15'
                    : 'bg-white dark:bg-[#0c0c0c] border-slate-200/60 dark:border-white/5 text-slate-500 hover:text-slate-800 dark:hover:text-white shadow-sm'
                }`}
              >
                <CatIcon className="w-3.5 h-3.5" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* 2 & 3. DYNAMIC MENU FOOD ITEM CARDS (GRID VIEW) */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <MenuItemSkeleton key={n} />
            ))}
          </div>
        ) : errorMsg ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-[2rem] p-8 text-center max-w-lg mx-auto space-y-4 shadow-sm">
            <AlertTriangle className="w-10 h-10 mx-auto text-red-500" />
            <h4 className="text-sm font-black uppercase tracking-widest">Database Sync Alert</h4>
            <p className="text-xs font-bold leading-relaxed">{errorMsg}</p>
            <button onClick={() => fetchMenu(true)} className="px-6 py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all">Retry Server Connection</button>
          </div>
        ) : filteredMenuItems.length === 0 ? (
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200/60 dark:border-white/5 rounded-[3rem] p-16 text-center max-w-md mx-auto space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-orange-500/5 rounded-2xl flex items-center justify-center mx-auto">
              <Layers className="w-8 h-8 text-orange-500/60" />
            </div>
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">No items found</h4>
            <p className="text-[11px] font-bold text-slate-400 dark:text-white/20">Try revising filters or add a new menu item to seed the catalog</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredMenuItems.map((item) => {
              return (
                <div 
                  key={item.id}
                  className={`bg-white dark:bg-[#0c0c0c] border border-slate-200/60 dark:border-white/5 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between group relative overflow-hidden
                    ${!item.isAvailable ? 'opacity-50 dark:opacity-40' : ''}
                  `}
                >
                  
                  <div>
                    {/* Diet Dot Indicator (VEG / NON_VEG) */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1.5">
                        <CircleDot className={`w-3.5 h-3.5 ${item.type === 'VEG' ? 'text-emerald-500' : 'text-red-500'}`} />
                        <span className={`text-[9px] font-black uppercase tracking-widest
                          ${item.type === 'VEG' ? 'text-emerald-500' : 'text-red-500'}
                        `}>
                          {item.type} • {item.category}
                        </span>
                      </div>
                    </div>

                    {/* Food Names & Marathi Translation */}
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-slate-800 dark:text-white leading-tight uppercase group-hover:text-orange-500 transition-colors flex items-center gap-2">
                        <span>{item.name}</span>
                        {item.code && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                            {item.code}
                          </span>
                        )}
                      </h3>
                      {item.marathiName && (
                        <p className="text-xs font-black text-orange-500/80 tracking-wide font-sans">
                          {item.marathiName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 space-y-4">
                    {/* Price and iOS Availability Switch Row */}
                    <div className="flex items-center justify-between">
                      {item.pricing_type === 'HALF_FULL' ? (
                        <div className="flex flex-col gap-1 text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-white/40 bg-slate-50 dark:bg-white/5 px-1.5 py-0.5 rounded">Half</span>
                            <div className="flex items-baseline font-black text-xs text-slate-700 dark:text-slate-300">
                              <span className="text-[10px] mr-0.5 text-slate-400">₹</span>
                              {parseFloat(item.half_price || 0).toFixed(0)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-white/40 bg-slate-50 dark:bg-white/5 px-1.5 py-0.5 rounded">Full</span>
                            <div className="flex items-baseline font-black text-xs text-slate-700 dark:text-slate-300">
                              <span className="text-[10px] mr-0.5 text-slate-400">₹</span>
                              {parseFloat(item.full_price || 0).toFixed(0)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-baseline text-slate-900 dark:text-white">
                          <IndianRupee className="w-3.5 h-3.5 text-slate-400 self-center" />
                          <span className="text-xl font-black">{parseFloat(item.price || 0).toFixed(0)}</span>
                        </div>
                      )}

                      {/* IOS Availability switch */}
                      <button
                        onClick={() => handleAvailabilityToggle(item)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer
                          ${item.isAvailable ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/10'}
                        `}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-250
                            ${item.isAvailable ? 'translate-x-6' : 'translate-x-1'}
                          `}
                        />
                      </button>
                    </div>

                    {/* Actions Panel */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setFormData({
                            name: item.name,
                            marathiName: item.marathiName || "",
                            hindiName: item.hindiName || "",
                            code: item.code || "",
                            price: item.price ? parseFloat(item.price).toString() : "",
                            pricing_type: item.pricing_type || 'SINGLE',
                            half_price: item.half_price ? parseFloat(item.half_price).toString() : "",
                            full_price: item.full_price ? parseFloat(item.full_price).toString() : "",
                            category: item.category,
                            type: item.type,
                            isAvailable: item.isAvailable
                          });
                          setManualOverride({ marathiName: false, hindiName: false });
                          setNameTouched(false);
                          setTranslationStatus('idle');
                          setTranslationError('');
                          setIsModalOpen(true);
                        }}
                        className="flex-1 py-2 bg-slate-50 hover:bg-orange-50 dark:bg-white/2 dark:hover:bg-orange-500/10 text-slate-500 hover:text-orange-500 dark:text-white/60 dark:hover:text-orange-500 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer border border-slate-100 dark:border-white/5 flex items-center justify-center gap-1.5"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                        className="py-2 px-3 bg-slate-50 hover:bg-red-50 dark:bg-white/2 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-xl transition-colors cursor-pointer border border-slate-100 dark:border-white/5"
                        title="Remove item"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ADD / EDIT DOCK DIALOG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-2xl p-8 max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {editingItem ? 'Edit Dish Details' : 'Add New Menu Item'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-orange-500 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-5 pr-1.5 scrollbar-thin">
                
                {/* Name and Code row */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Food Item Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Butter Paneer Masala"
                      value={formData.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setFormData(prev => {
                          const updated = { ...prev, name: newName };
                          const generateInitials = (val) => {
                            if (!val) return "";
                            return val
                              .trim()
                              .replace(/[^a-zA-Z0-9\s]/g, '')
                              .split(/\s+/)
                              .filter(Boolean)
                              .map(w => w.charAt(0).toUpperCase())
                              .join('');
                          };
                          const oldInitials = generateInitials(prev.name);
                          if (!prev.code || prev.code === oldInitials) {
                            updated.code = generateInitials(newName);
                          }
                          return updated;
                        });
                        setNameTouched(true);
                        if (translationStatus === 'error') {
                          setTranslationStatus('idle');
                          setTranslationError('');
                        }
                      }}
                      className="w-full h-13 px-4 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 focus:border-orange-500 focus:outline-none text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Item Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. BPM"
                      value={formData.code}
                      onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      className="w-full h-13 px-4 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 focus:border-orange-500 focus:outline-none text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Marathi Subtitle / Translation</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. बटर पनीर मसाला"
                      value={formData.marathiName}
                      onChange={(e) => {
                        setManualOverride(prev => ({ ...prev, marathiName: true }));
                        setFormData(prev => ({ ...prev, marathiName: e.target.value }));
                      }}
                      className="w-full h-13 px-4 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 focus:border-orange-500 focus:outline-none text-xs font-bold text-slate-900 dark:text-white"
                    />
                    {translationStatus === 'loading' && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Hindi Subtitle / Translation</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. बटर पनीर मसाला"
                      value={formData.hindiName}
                      onChange={(e) => {
                        setManualOverride(prev => ({ ...prev, hindiName: true }));
                        setFormData(prev => ({ ...prev, hindiName: e.target.value }));
                      }}
                      className="w-full h-13 px-4 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 focus:border-orange-500 focus:outline-none text-xs font-bold text-slate-900 dark:text-white"
                    />
                    {translationStatus === 'loading' && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                    )}
                  </div>
                </div>

                {translationError && (
                  <div className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">
                    {translationError}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Pricing Scheme *</label>
                    <div className="grid grid-cols-2 p-1 bg-slate-50 dark:bg-white/2 rounded-2xl border border-slate-200/60 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, pricing_type: 'SINGLE' }))}
                        className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                          formData.pricing_type === 'SINGLE'
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/10'
                            : 'text-slate-600 dark:text-white/60 hover:text-[#ff6b00]'
                        }`}
                      >
                        Single Price
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, pricing_type: 'HALF_FULL' }))}
                        className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                          formData.pricing_type === 'HALF_FULL'
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/10'
                            : 'text-slate-600 dark:text-white/60 hover:text-[#ff6b00]'
                        }`}
                      >
                        Half / Full Price
                      </button>
                    </div>
                  </div>

                  {formData.pricing_type === 'HALF_FULL' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Half Price *</label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="number"
                            required
                            min="1"
                            placeholder="100"
                            value={formData.half_price}
                            onChange={(e) => setFormData(prev => ({ ...prev, half_price: e.target.value }))}
                            className="w-full h-13 pl-9 pr-4 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 focus:border-orange-500 focus:outline-none text-xs font-bold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Full Price *</label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="number"
                            required
                            min="1"
                            placeholder="180"
                            value={formData.full_price}
                            onChange={(e) => setFormData(prev => ({ ...prev, full_price: e.target.value }))}
                            className="w-full h-13 pl-9 pr-4 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 focus:border-orange-500 focus:outline-none text-xs font-bold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Price (INR) *</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="180"
                          value={formData.price}
                          onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                          className="w-full h-13 pl-9 pr-4 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 focus:border-orange-500 focus:outline-none text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Dietary Class *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full h-13 px-3 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 focus:border-orange-500 focus:outline-none text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value="VEG">Vegetarian (VEG)</option>
                      <option value="NON_VEG">Non-Vegetarian (NON-VEG)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Menu Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full h-13 px-3 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 focus:border-orange-500 focus:outline-none text-xs font-bold text-slate-900 dark:text-white"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* IOS Switch inside Form */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/2 rounded-2xl border border-slate-200/60 dark:border-white/5">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white/80">Available for Order</h4>
                      <p className="text-[9px] font-bold text-slate-400 dark:text-white/20">Instantly grey out or hide if disabled</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, isAvailable: !prev.isAvailable }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer
                        ${formData.isAvailable ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/10'}
                      `}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-250
                          ${formData.isAvailable ? 'translate-x-6' : 'translate-x-1'}
                        `}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-white/5 mt-4 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-13 bg-slate-50 hover:bg-slate-100 dark:bg-white/2 dark:hover:bg-white/5 border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 h-13 bg-orange-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-orange-500/10 transition-all flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>{editingItem ? 'Save Updates' : 'Add Item'}</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* DELETE DIALOG DOCK */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setDeleteTarget(null)} />
          
          <div className="relative bg-white dark:bg-[#0c0c0c] border border-red-500/20 rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 text-center animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Remove Dish?</h3>
            <p className="text-xs font-bold text-slate-400 mt-2 leading-relaxed">
              Are you sure you want to completely delete <strong className="text-slate-800 dark:text-white">{deleteTarget.name}</strong> from the active restaurant menu card?
            </p>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-12 bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Keep Item
              </button>
              <button
                onClick={() => executeDelete(deleteTarget.id)}
                disabled={actionLoading}
                className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-500/10 transition-all flex items-center justify-center"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Delete Dish</span>}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
