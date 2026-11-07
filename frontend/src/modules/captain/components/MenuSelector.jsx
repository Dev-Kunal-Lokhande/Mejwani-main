import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Minus, FileText, Sparkles, Filter, AlertCircle, CircleDot } from 'lucide-react';

export default function MenuSelector({
  menuItems,
  categories,
  cart,
  onAddToCart,
  onRemoveFromCart,
  onUpdateCartItemNote
}) {
  const [activeCategory, setActiveCategory] = useState(categories[0] || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVegOnly, setFilterVegOnly] = useState(false);
  const searchInputRef = React.useRef(null);

  // Removed auto-focus useEffect to prevent virtual keyboard from popping up on mobile/tablet devices


  useEffect(() => {
    if (categories.length > 0 && !categories.includes(activeCategory)) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  const expandedMenuItems = useMemo(() => {
    const list = [];
    menuItems.forEach((item) => {
      if (item.pricing_type === 'HALF_FULL') {
        // Half
        list.push({
          ...item,
          id: `${item.id}_HALF`,
          originalId: item.id,
          name: `${item.name} (Half)`,
          marathiName: item.marathiName ? `${item.marathiName} (हाफ)` : null,
          price: item.half_price,
          code: item.code ? `${item.code}H` : null,
          pricing_type: 'SINGLE',
          portion_type: 'HALF'
        });
        // Full
        list.push({
          ...item,
          id: `${item.id}_FULL`,
          originalId: item.id,
          name: `${item.name} (Full)`,
          marathiName: item.marathiName ? `${item.marathiName} (फुल)` : null,
          price: item.full_price,
          code: item.code ? `${item.code}F` : null,
          pricing_type: 'SINGLE',
          portion_type: 'FULL'
        });
      } else {
        list.push({
          ...item,
          originalId: item.id,
          portion_type: 'FULL'
        });
      }
    });
    return list;
  }, [menuItems]);

  // Group and filter items dynamically using PostgreSQL schema
  const filteredItems = useMemo(() => {
    return expandedMenuItems.filter((item) => {
      const matchesCategory = searchQuery ? true : item.category === activeCategory;
      const matchesSearch = [item.name, item.marathiName, item.category, item.code]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesVeg = filterVegOnly ? item.type === 'VEG' : true;
      return matchesCategory && matchesSearch && matchesVeg;
    });
  }, [expandedMenuItems, activeCategory, searchQuery, filterVegOnly]);

  const getItemQuantity = (itemId) => {
    const cartItem = cart.find(i => i.id === itemId);
    return cartItem ? cartItem.qty : 0;
  };

  const getItemNote = (itemId) => {
    const cartItem = cart.find(i => i.id === itemId);
    return cartItem ? cartItem.note || '' : '';
  };

  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, filteredItems.length]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems.length > 0) {
        const itemToSelect = filteredItems[highlightedIndex] || filteredItems[0];
        if (itemToSelect && itemToSelect.isAvailable) {
          onAddToCart(itemToSelect, itemToSelect.portion_type || 'FULL');
          setSearchQuery('');
        }
      }
    }
  };

  const renderPortionControl = (item, portionLabel, portionValue, price) => {
    const isHalfFull = item.pricing_type === 'HALF_FULL';
    const idKey = isHalfFull ? `${item.id}_${portionValue}` : item.id;
    const qty = getItemQuantity(idKey);
    const note = getItemNote(idKey);

    return (
      <div 
        className="w-full flex flex-col gap-2 mt-2 pt-2 border-t border-dashed border-slate-100 dark:border-white/5"
        onClick={(e) => {
          if (isHalfFull) {
            e.stopPropagation();
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{portionLabel}</span>
            <span className="text-sm font-black text-[#ff6b00]">₹{parseFloat(price).toFixed(0)}</span>
          </div>

          <div className="flex items-center gap-2">
            {qty > 0 ? (
              <div className="flex items-center bg-[#ff6b00] rounded-xl p-0.5 text-white shadow-sm" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveFromCart(idKey); }}
                  className="p-1 hover:bg-white/10 rounded-lg transition-all active:scale-90"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-xs font-black min-w-6 text-center select-none">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAddToCart(item, portionValue); }}
                  className="p-1 hover:bg-white/10 rounded-lg transition-all active:scale-90"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAddToCart(item, portionValue); }}
                className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-[10px] uppercase tracking-wider hover:bg-[#ff6b00] hover:border-[#ff6b00] hover:text-white active:scale-97 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {qty > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mt-1 space-y-1.5">
                <div className="flex gap-1 flex-wrap">
                  {['Roti', 'Chapati', 'Bhakari'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        const current = note || '';
                        const prefix = current ? `${current}, ` : '';
                        onUpdateCartItemNote(idKey, `${prefix}${opt}`);
                      }}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-[8px] text-slate-500 dark:text-white/60 rounded-md font-extrabold cursor-pointer border border-slate-200/50 dark:border-white/5 transition-all"
                    >
                      +{opt}
                    </button>
                  ))}
                  {note && (
                    <button
                      type="button"
                      onClick={() => onUpdateCartItemNote(idKey, '')}
                      className="px-1.5 py-0.5 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-[8px] text-red-500 rounded-md font-extrabold cursor-pointer transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="relative flex items-center">
                  <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-white/30" />
                  <input
                    type="text"
                    placeholder="Instructions (e.g. 2 Roti, 2 Bhakari)..."
                    value={note}
                    onChange={(e) => onUpdateCartItemNote(idKey, e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-white/3 border border-slate-205 dark:border-white/10 rounded-lg text-[10px] font-bold focus:outline-none focus:border-[#ff6b00]/50 text-slate-700 dark:text-white/80"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search and Veg-only Filter Row */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search soup, starters, curries, beverages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/20 transition-all text-slate-800 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 hover:text-slate-600 uppercase"
            >
              Clear
            </button>
          )}
        </div>

        {/* Veg-only Toggle */}
        <button
          onClick={() => setFilterVegOnly(!filterVegOnly)}
          className={`flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border font-black text-xs uppercase tracking-wider transition-all duration-300 ${
            filterVegOnly
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-md shadow-emerald-500/5'
              : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/60 hover:border-emerald-500/30 hover:text-emerald-500'
          }`}
        >
          <span className={`w-3 h-3 rounded-full flex items-center justify-center border ${filterVegOnly ? 'border-emerald-500 bg-emerald-500' : 'border-emerald-500 bg-transparent'}`}>
            <span className="w-1 h-1 bg-white rounded-full" />
          </span>
          Veg Only
        </button>
      </div>

      {/* Categories Horizontal Scroller */}
      {!searchQuery && (
        <div className="flex gap-2 overflow-x-auto pb-2.5 scrollbar-none -mx-6 px-6">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-6 py-3 rounded-full font-black text-xs uppercase tracking-wider transition-all duration-200 ${
                  isActive
                    ? 'bg-[#ff6b00] text-white shadow-md shadow-orange-500/10 scale-102'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/40 hover:text-[#ff6b00] hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid of Menu Items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredItems.map((item, idx) => {
            const isHalfFull = item.pricing_type === 'HALF_FULL';
            const qty = getItemQuantity(item.id);
            const isAvail = item.isAvailable;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                style={!isAvail ? { filter: 'grayscale(60%)' } : undefined}
                onClick={() => {
                  if (isAvail && !isHalfFull) {
                    onAddToCart(item, 'FULL');
                  }
                }}
                className={`group flex flex-col bg-white dark:bg-[#0d0d0d] border-2 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300 ${
                  idx === highlightedIndex
                    ? 'ring-4 ring-[#ff6b00] border-[#ff6b00] scale-[1.01] bg-orange-500/[0.01]'
                    : ((!isHalfFull && qty > 0) || (isHalfFull && (getItemQuantity(`${item.id}_HALF`) > 0 || getItemQuantity(`${item.id}_FULL`) > 0))
                      ? 'border-[#ff6b00]/40 bg-orange-500/[0.01]' 
                      : 'border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10')
                } ${!isAvail ? 'opacity-50 cursor-not-allowed select-none' : (!isHalfFull ? 'cursor-pointer active:scale-98' : '')}`}
              >
                {/* Header Row: Veg/Non-veg dot & Availability */}
                <div className="flex justify-between items-center mb-4">
                  <div className={`flex items-center gap-1.5 text-xs font-black uppercase ${
                    item.type === 'VEG' ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                    <span className={`w-2.5 h-2.5 rounded-full flex items-center justify-center ${item.type === 'VEG' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                      <span className="w-1 bg-white rounded-full" />
                    </span>
                    {item.type === 'VEG' ? 'Veg' : 'Non-Veg'}
                  </div>
                </div>

                {/* Food Name & Marathi Subtitle & Price */}
                <div className="flex-1 mb-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white leading-snug group-hover:text-[#ff6b00] transition-colors truncate flex items-center gap-2">
                        <span>{item.name}</span>
                        {item.code && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                            {item.code}
                          </span>
                        )}
                      </h3>
                      {item.marathiName && (
                        <span className="block text-sm font-bold text-[#d6b36a]/85 mt-1 font-serif">
                          {item.marathiName}
                        </span>
                      )}
                    </div>
                    {!isHalfFull && (
                      <span className="text-lg font-black text-[#ff6b00] whitespace-nowrap">
                        ₹{parseFloat(item.price).toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Portion controls section */}
                {!isAvail ? (
                  <div className="flex justify-end items-center mt-auto pt-3 border-t border-slate-100 dark:border-white/5 w-full">
                    <button
                      disabled
                      tabIndex={-1}
                      className="w-full px-6 py-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-xs uppercase tracking-wider cursor-not-allowed opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                ) : isHalfFull ? (
                  <div className="flex flex-col w-full">
                    {renderPortionControl(item, 'Half Portion', 'HALF', item.half_price)}
                    {renderPortionControl(item, 'Full Portion', 'FULL', item.full_price)}
                  </div>
                ) : (
                  <div className="flex flex-col w-full mt-auto">
                    {renderPortionControl(item, 'Price', 'FULL', item.price)}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-[2.5rem] opacity-40">
          <Filter className="w-10 h-10 mx-auto text-slate-400 mb-3" />
          <p className="text-sm font-black uppercase tracking-wider text-slate-500">No dishes match filters</p>
          <p className="text-xs text-slate-400 dark:text-white/20 mt-1 font-semibold">Try searching for something else or check active filters</p>
        </div>
      )}
    </div>
  );
}
