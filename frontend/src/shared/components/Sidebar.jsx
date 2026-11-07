import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Utensils,
  Users,
  Settings,
  LogOut,
  ChefHat,
  MenuSquare,
  Package
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { invalidateMenuCache } from '../services/menuCache';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { icon: ShoppingBag, label: 'Captain Orders', path: '/admin/orders' },
  { icon: Package, label: 'Parcel', path: '/admin/parcel' },
  { icon: Utensils, label: 'Tables', path: '/admin/tables' },
  { icon: MenuSquare, label: 'Hotel Menu', path: '/admin/hotel-menu' },
  { icon: Users, label: 'Mess', path: '/admin/mess' },
  { icon: ChefHat, label: 'Kitchen', path: '/admin/kitchen' },
  { icon: Settings, label: 'Settings', path: '/admin/settings' },
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    const hotelSlug = localStorage.getItem('mejwani_hotel_slug');

    localStorage.removeItem('mejwani_admin_token');
    localStorage.removeItem('mejwani_admin_jwt');
    localStorage.removeItem('mejwani_admin_user');
    localStorage.removeItem('mejwani_settings');
    invalidateMenuCache();

    if (hotelSlug) {
      navigate(`/${hotelSlug}/select-panel`);
    } else {
      navigate('/select-panel');
    }
  };

  return (
    <aside className="w-64 h-screen bg-white dark:bg-[#0a0a0a] border-r border-slate-200 dark:border-white/5 flex flex-col p-6 fixed left-0 top-0 z-50 shadow-xl shadow-black/5 dark:shadow-none">
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
          <Utensils className="text-white w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Mejwani <span className="text-[#ff6b00] text-xs block -mt-1 font-extrabold uppercase tracking-wider">Restaurant</span>
        </h1>
      </div>

      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.label}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold",
                isActive
                  ? "bg-[#ff6b00] text-white shadow-lg shadow-orange-500/20"
                  : "text-slate-900 dark:text-white/60 hover:text-[#ff6b00] hover:bg-orange-50 dark:hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-[#ff6b00] dark:text-[#ff6b00]")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-slate-200 dark:border-white/10">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 w-full text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-500/5"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
