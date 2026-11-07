import React from 'react';
import { motion } from 'framer-motion';
import { Snowflake, Wind, CloudSun, Users, ChevronRight, Layers } from 'lucide-react';

const iconMap = {
  Snowflake: Snowflake,
  Wind: Wind,
  CloudSun: CloudSun,
  Users: Users
};

export default function SectionSelector({ sections, activeSection, onSelect, tables }) {
  const getSectionStats = (sectionName) => {
    const secTables = tables.filter(t => t.section === sectionName);
    const available = secTables.filter(t => t.status === 'available').length;
    const occupied = secTables.filter(t => t.status === 'occupied').length;
    const billPending = secTables.filter(t => t.status === 'bill_pending').length;
    return { total: secTables.length, available, occupied, billPending };
  };

  return (
    <div className="space-y-4 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2 sm:gap-3">
            <Layers className="w-5 h-5 sm:w-7 sm:h-7 text-primary" /> Select Section
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 dark:text-white/20 font-bold mt-1">
            Choose a dining area or zone to take orders
          </p>
        </div>
        <div className="px-3.5 py-1.5 bg-primary/10 rounded-xl text-[10px] sm:text-xs font-black text-primary uppercase tracking-widest self-start sm:self-auto">
          {sections.length} Zones Available
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
        {sections.map((sec, index) => {
          const IconComponent = iconMap[sec.icon] || Layers;
          const stats = getSectionStats(sec.name);
          const isActive = activeSection === sec.name;

          return (
            <motion.div
              key={sec.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, type: 'spring', stiffness: 120 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(sec.name)}
              className={`group relative cursor-pointer p-5 sm:p-7 rounded-2xl sm:rounded-[2rem] border-2 transition-all duration-300 ${
                isActive
                  ? 'border-primary bg-primary/[0.02] shadow-xl shadow-orange-500/5 scale-[1.02]'
                  : 'bg-white dark:bg-[#0d0d0d] border-slate-200 dark:border-white/5 hover:border-primary/40 hover:shadow-lg'
              }`}
            >
              {/* Top Row: Icon & Selector Indicator */}
              <div className="flex justify-between items-start mb-4 sm:mb-6">
                <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-transform duration-300 ${
                  isActive ? 'bg-primary text-white shadow-lg shadow-orange-500/15' : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/60'
                }`}>
                  <IconComponent className="w-5.5 h-5.5 sm:w-7 sm:h-7" />
                </div>
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                  isActive 
                    ? 'border-primary bg-primary text-white scale-110' 
                    : 'border-slate-200 dark:border-white/10 text-transparent group-hover:border-primary/50'
                }`}>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
              </div>

              {/* Card Labels */}
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white leading-tight">
                  {sec.name}
                </h3>
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-white/20 uppercase tracking-widest block">
                  {stats.total} Tables Total
                </span>
              </div>

              {/* Stats details */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-3 sm:pt-4 mt-4 sm:mt-5 border-t border-slate-100 dark:border-white/5 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                <div className="flex items-center gap-1.5 text-emerald-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{stats.available} Ready</span>
                </div>
                <div className="flex items-center gap-1.5 text-primary">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span>{stats.occupied} Occupied</span>
                </div>
                {stats.billPending > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-500 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>{stats.billPending} Bill</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
