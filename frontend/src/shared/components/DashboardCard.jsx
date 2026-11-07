import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function DashboardCard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  className 
}) {
  return (
    <div className={cn("glass-card p-6", className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-lg",
            trend.isUp ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
          )}>
            {trend.isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {trend.value}%
          </div>
        )}
      </div>
      
      <div>
        <p className="text-slate-700 dark:text-white/50 text-sm font-semibold mb-1">{title}</p>
        <h3 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</h3>
      </div>
    </div>
  );
}
