import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Loader2, 
  AlertTriangle, 
  X, 
  Layers, 
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../../shared/layouts/AdminLayout';
import { API_BASE, authorizedFetch } from '../../../shared/services/apiBase';
import { getTranslationCacheKey, transliterateCategoryName } from '../../../shared/services/menuTranslation';
import { invalidateMenuCache } from '../../../shared/services/menuCache';

export default function ManageCategories() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState(null);

  // Modals controller states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Item Form States
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    marathi_name: "",
    hindi_name: "",
    display_order: 0,
    is_active: true
  });
  const [manualOverride, setManualOverride] = useState({ marathi_name: false, hindi_name: false });
  const [nameTouched, setNameTouched] = useState(false);
  const [translationStatus, setTranslationStatus] = useState('idle');
  const [translationError, setTranslationError] = useState('');
  const translationCache = useRef({});

  const fetchCategories = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setErrorMsg("");
    try {
      const response = await authorizedFetch(`${API_BASE}/menu-categories`);
      const resData = await response.json();
      if (resData.success) {
        setCategories(resData.data);
        localStorage.setItem('mejwani_cached_categories', JSON.stringify(resData.data));
      } else {
        setErrorMsg(resData.message || 'Failed to query categories');
      }
    } catch (err) {
      console.error('Categories pull error:', err);
      setErrorMsg('Database access error. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories(true);
  }, []);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const rawName = formData.name || '';
    const shouldTranslate = rawName.trim() && nameTouched && (!manualOverride.marathi_name || !manualOverride.hindi_name);

    if (!shouldTranslate) {
      if (!rawName.trim()) {
        setTranslationStatus('idle');
        setTranslationError('');
      }
      return;
    }

    const cacheKey = getTranslationCacheKey(rawName);
    const cached = translationCache.current[cacheKey];
    if (cached) {
      setTranslationStatus('success');
      setTranslationError('');
      setFormData((prev) => ({
        ...prev,
        marathi_name: manualOverride.marathi_name ? prev.marathi_name : cached.marathi,
        hindi_name: manualOverride.hindi_name ? prev.hindi_name : cached.hindi
      }));
      return;
    }

    try {
      const { marathi, hindi } = transliterateCategoryName(rawName);
      translationCache.current[cacheKey] = { marathi, hindi };
      setFormData((prev) => ({
        ...prev,
        marathi_name: manualOverride.marathi_name ? prev.marathi_name : marathi,
        hindi_name: manualOverride.hindi_name ? prev.hindi_name : hindi
      }));
      setTranslationStatus('success');
      setTranslationError('');
    } catch (err) {
      console.error('Category auto-translation failed:', err);
      setTranslationStatus('error');
      setTranslationError('Auto-transliteration failed. You can type Marathi/Hindi manually.');
    }
  }, [formData.name, manualOverride, nameTouched]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('error', 'Category Name is required');
      return;
    }

    setActionLoading(true);
    const token = localStorage.getItem('mejwani_admin_jwt');
    const method = editingItem ? 'PUT' : 'POST';
    const endpoint = editingItem 
      ? `${API_BASE}/menu-categories/${editingItem.id}` 
      : `${API_BASE}/menu-categories`;
      
    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          marathi_name: formData.marathi_name.trim() || null,
          hindi_name: formData.hindi_name.trim() || null,
          display_order: parseInt(formData.display_order),
          is_active: formData.is_active
        })
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        invalidateMenuCache();
        showToast('success', editingItem ? 'Category updated' : 'Category created');
        setIsModalOpen(false);
        setEditingItem(null);
        fetchCategories();
      } else {
        showToast('error', resData.message || 'Operation failed');
      }
    } catch (err) {
      console.error('Category save error:', err);
      showToast('error', 'Database failure');
    } finally {
      setActionLoading(false);
    }
  };

  const executeDelete = async (id) => {
    setActionLoading(true);
    const token = localStorage.getItem('mejwani_admin_jwt');

    try {
      const response = await fetch(`${API_BASE}/menu-categories/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        invalidateMenuCache();
        showToast('success', resData.message || 'Category deleted');
        setDeleteTarget(null);
        fetchCategories();
      } else {
        showToast('error', resData.message || 'Failed to remove category');
      }
    } catch (err) {
      console.error('Delete category error:', err);
      showToast('error', 'Database access error');
    } finally {
      setActionLoading(false);
      setDeleteTarget(null);
    }
  };
  
  const handleAvailabilityToggle = async (item) => {
    const updatedStatus = !item.is_active;
    const token = localStorage.getItem('mejwani_admin_jwt');

    const originalItems = categories;
    setCategories(prev => prev.map(m => m.id === item.id ? { ...m, is_active: updatedStatus } : m));

    try {
      const response = await fetch(`${API_BASE}/menu-categories/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...item, is_active: updatedStatus })
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        setCategories(originalItems); // Rollback
        showToast('error', resData.message || 'Failed to sync status');
      } else {
        invalidateMenuCache();
        showToast('success', `${item.name} set to ${updatedStatus ? 'Active' : 'Inactive'}`);
      }
    } catch (err) {
      console.error('Toggle error:', err);
      setCategories(originalItems); // Rollback
      showToast('error', 'Database sync failure');
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

        {/* HEADER SECTION */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-[#0c0c0c] p-6 md:p-8 rounded-[2rem] border border-slate-200/60 dark:border-white/5 shadow-sm">
          <div>
            <button 
              onClick={() => navigate('/admin/hotel-menu')}
              className="flex items-center gap-2 text-slate-400 hover:text-orange-500 mb-2 transition-colors text-xs font-bold uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Menu
            </button>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Manage Categories</h2>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">Configure dynamic categories, translations, and sorting order</p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            <button
              onClick={() => {
                setEditingItem(null);
                setFormData({
                  name: "",
                  marathi_name: "",
                  hindi_name: "",
                  display_order: categories.length > 0 ? Math.max(...categories.map(c => c.display_order)) + 1 : 1,
                  is_active: true
                });
                setManualOverride({ marathi_name: false, hindi_name: false });
                setNameTouched(false);
                setTranslationStatus('idle');
                setTranslationError('');
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/15 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>
        </div>

        {/* LIST SECTION */}
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>
        ) : errorMsg ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-[2rem] p-8 text-center max-w-lg mx-auto space-y-4 shadow-sm">
            <AlertTriangle className="w-10 h-10 mx-auto text-red-500" />
            <p className="text-xs font-bold leading-relaxed">{errorMsg}</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200/60 dark:border-white/5 rounded-[3rem] p-16 text-center max-w-md mx-auto space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-orange-500/5 rounded-2xl flex items-center justify-center mx-auto">
              <Layers className="w-8 h-8 text-orange-500/60" />
            </div>
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">No categories found</h4>
            <p className="text-[11px] font-bold text-slate-400 dark:text-white/20">Add your first menu category</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {categories.map((item) => (
              <div 
                key={item.id}
                className={`bg-white dark:bg-[#0c0c0c] border border-slate-200/60 dark:border-white/5 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between group relative overflow-hidden
                  ${!item.is_active ? 'opacity-50 dark:opacity-40' : ''}
                `}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/10 px-3 py-1 rounded-full">
                      Order: {item.display_order}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight uppercase group-hover:text-orange-500 transition-colors">
                      {item.name}
                    </h3>
                    {(item.marathi_name || item.hindi_name) && (
                      <p className="text-xs font-black text-orange-500/80 tracking-wide font-sans">
                        {item.marathi_name} {item.marathi_name && item.hindi_name && '|'} {item.hindi_name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">Status</span>
                    <button
                      onClick={() => handleAvailabilityToggle(item)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer
                        ${item.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/10'}
                      `}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-250
                          ${item.is_active ? 'translate-x-6' : 'translate-x-1'}
                        `}
                      />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setFormData({
                          name: item.name,
                          marathi_name: item.marathi_name || "",
                          hindi_name: item.hindi_name || "",
                          display_order: item.display_order,
                          is_active: item.is_active
                        });
                        setManualOverride({ marathi_name: false, hindi_name: false });
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
                      title="Remove category"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

      {/* ADD / EDIT DOCK DIALOG */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-white/10 rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {editingItem ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-orange-500 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Category Name (English) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SOUP"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, name: e.target.value.toUpperCase() }));
                    setNameTouched(true);
                    if (translationStatus === 'error') {
                      setTranslationStatus('idle');
                      setTranslationError('');
                    }
                  }}
                  className="w-full h-13 px-4 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 focus:border-orange-500 focus:outline-none text-xs font-bold text-slate-900 dark:text-white uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Marathi Name</label>
                <input
                  type="text"
                  placeholder="e.g. सूप"
                  value={formData.marathi_name}
                  onChange={(e) => {
                    setManualOverride(prev => ({ ...prev, marathi_name: true }));
                    setFormData(prev => ({ ...prev, marathi_name: e.target.value }));
                  }}
                  className="w-full h-13 px-4 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 focus:border-orange-500 focus:outline-none text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Hindi Name</label>
                <input
                  type="text"
                  placeholder="e.g. सूप"
                  value={formData.hindi_name}
                  onChange={(e) => {
                    setManualOverride(prev => ({ ...prev, hindi_name: true }));
                    setFormData(prev => ({ ...prev, hindi_name: e.target.value }));
                  }}
                  className="w-full h-13 px-4 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 focus:border-orange-500 focus:outline-none text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              {translationStatus === 'loading' && (
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Transliteration in progress...
                </div>
              )}

              {translationError && (
                <div className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">
                  {translationError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Display Order (Sorting)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: e.target.value }))}
                  className="w-full h-13 px-4 rounded-2xl bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 focus:border-orange-500 focus:outline-none text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/2 rounded-2xl border border-slate-200/60 dark:border-white/5">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white/80">Active Status</h4>
                  <p className="text-[9px] font-bold text-slate-400 dark:text-white/20">Hide category from customer menu</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer
                    ${formData.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/10'}
                  `}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-250
                      ${formData.is_active ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>

              <div className="flex items-center gap-3 pt-2">
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
                    <span>{editingItem ? 'Save Updates' : 'Add Category'}</span>
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
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Delete Category?</h3>
            <p className="text-xs font-bold text-slate-400 mt-2 leading-relaxed">
              This will permanently delete the category and all menu items inside it.
            </p>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-12 bg-slate-50 dark:bg-white/2 border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => executeDelete(deleteTarget.id)}
                disabled={actionLoading}
                className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-500/10 transition-all flex items-center justify-center cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Delete Everything</span>}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
