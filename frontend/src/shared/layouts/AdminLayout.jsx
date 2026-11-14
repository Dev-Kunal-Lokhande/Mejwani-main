import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import {
  Sun,
  Moon,
  Menu,
  LogOut,
  Utensils,
  LayoutDashboard,
  ShoppingBag,
  Users,
  ChefHat,
  Settings,
  MenuSquare,
  Package,
  Volume2,
  VolumeX,
  Bell,
  CheckCheck,
  Trash2
} from 'lucide-react';

import { Link, useLocation, useNavigate } from 'react-router-dom';

import toast, { Toaster } from 'react-hot-toast';
import socket from '../services/socketClient';
import { subscribeRealtimeAlerts } from '../services/realtimeAlerts';
import { unlockAudioContext } from '../services/audioHelper';
import { API_BASE } from '../services/apiBase';
import { cacheSystemSettings } from '../services/systemSettings';
import { invalidateMenuCache } from '../services/menuCache';

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

export default function AdminLayout({ children }) {
  const { isDarkMode, toggleTheme } = useTheme();
  const notifCtx = useNotifications();
  const notifications = notifCtx?.notifications || [];
  const unreadCount = notifCtx?.unreadCount || 0;

  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [voiceAnnouncementEnabled, setVoiceAnnouncementEnabled] = useState(
    () => localStorage.getItem('mejwani_voice_announcement_enabled') !== 'false'
  );

  const toggleVoiceAnnouncement = () => {
    const newVal = !voiceAnnouncementEnabled;
    setVoiceAnnouncementEnabled(newVal);
    localStorage.setItem('mejwani_voice_announcement_enabled', String(newVal));
    toast.success(`Alert Sounds & Voice: ${newVal ? 'Unmuted' : 'Muted'}`, {
      id: 'voice-toggle-toast',
      style: {
        borderRadius: '12px',
        background: '#0f172a',
        color: '#ffffff',
      }
    });
  };

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'mejwani_voice_announcement_enabled') {
        setVoiceAnnouncementEnabled(e.newValue !== 'false');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const adminUser = JSON.parse(localStorage.getItem('mejwani_admin_user') || '{}');
  const filteredNavItems = navItems;

  useEffect(() => {
    window.addEventListener('click', unlockAudioContext, {
      once: true,
    });

    return () => {
      window.removeEventListener('click', unlockAudioContext);
    };
  }, []);

  // =========================================
  // GLOBAL SOCKET LISTENER
  // =========================================
  useEffect(() => {
    const joinRoom = () => {
      const storedHotelId = adminUser?.hotel_id || localStorage.getItem('mejwani_hotel_id');
      if (storedHotelId && storedHotelId !== '0') {
        console.log(`[SOCKET] AdminLayout emitting join-hotel-room: ${storedHotelId}:admin`);
        socket.emit('join-hotel-room', `${storedHotelId}:admin`);
      }
    };

    socket.on('connect', joinRoom);

    if (socket.connected) {
      joinRoom();
    }

    return () => {
      socket.off('connect', joinRoom);
    };
  }, [adminUser?.hotel_id]);

  useEffect(() => {
    if (adminUser && adminUser.hotel_id) {
      const fetchSettings = async () => {
        try {
          const token = localStorage.getItem('mejwani_admin_jwt');
          if (!token) return;
          const resp = await fetch(`${API_BASE}/admin/system-settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await resp.json();
          if (resp.ok && data.success && data.data) {
            cacheSystemSettings(data.data);
          }
        } catch (e) {
          console.warn('Failed to load system settings in AdminLayout', e);
        }
      };
      fetchSettings();
    }
  }, [adminUser?.hotel_id]);

  useEffect(() => {
    return subscribeRealtimeAlerts(socket);
  }, []);

  // =========================================
  // LOGOUT
  // =========================================
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

  const handleNotificationClick = (note) => {
    if (notifCtx?.markAsRead) {
      notifCtx.markAsRead(note.id);
    }
    setBellOpen(false);

    // Navigate directly to the relevant page
    const isParcel = String(note.title || note.message || '').toLowerCase().includes('parcel');
    if (note.targetRoute) {
      navigate(isParcel ? '/admin/parcel' : note.targetRoute);
    } else {
      navigate(isParcel ? '/admin/parcel' : '/admin/orders');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060606] transition-colors duration-300 flex flex-col select-none">

      {/* TOP NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#0b0b0b]/85 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/5 shadow-sm">

        <div className="max-w-[1700px] mx-auto px-6 h-16 flex items-center justify-between">

          {/* LOGO / BRANDING */}
          <div className="flex items-center gap-2.5">
            <div className="w-8.5 h-8.5 bg-orange-500 rounded-lg flex items-center justify-center shadow-md shadow-orange-500/10">
              <Utensils className="text-white w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white leading-none">
                {adminUser.hotel_name || 'Mejwani'}
              </h1>
            </div>
          </div>

          {/* DESKTOP NAVIGATION */}
          <nav className="hidden xl:flex items-center justify-center gap-1.5 px-4 mx-4">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`group flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all duration-200 text-[15px]
                  ${isActive
                      ? 'bg-orange-500/10 text-orange-500 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white font-semibold'
                    }`}
                >
                  <item.icon className={`w-[18px] h-[18px] transition-colors ${isActive ? 'text-orange-500' : 'text-slate-400 group-hover:text-orange-500'}`} />
                  <span className="leading-none">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* ACTIONS */}
          <div className="flex items-center gap-2">

            {/* REAL-TIME SYNC STATUS */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all select-none ${
                isConnected
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 animate-pulse'
              }`}
              title={isConnected ? 'Live Sync Active' : 'Live Sync Reconnecting...'}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="hidden sm:inline">{isConnected ? 'Live' : 'Offline'}</span>
            </div>

            {/* THEME */}
            <button
              onClick={toggleTheme}
              className="w-8.5 h-8.5 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-white/60 hover:text-orange-500 transition-all cursor-pointer shadow-sm"
            >
              {isDarkMode
                ? <Sun className="w-3.5 h-3.5" />
                : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* VOICE ANNOUNCEMENT / MUTE TOGGLE */}
            <button
              onClick={toggleVoiceAnnouncement}
              className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center border transition-all cursor-pointer shadow-sm ${
                voiceAnnouncementEnabled
                  ? 'bg-orange-500/10 border-orange-500/25 text-orange-500'
                  : 'bg-slate-50 dark:bg-white/5 border-slate-200/60 dark:border-white/5 text-slate-400 dark:text-white/35 hover:text-orange-500'
              }`}
              title={voiceAnnouncementEnabled ? "Mute All Alerts (Sound & Voice)" : "Unmute All Alerts (Sound & Voice)"}
            >
              {voiceAnnouncementEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* NOTIFICATION BELL + DROPDOWN */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen((prev) => !prev)}
                className={`relative w-8.5 h-8.5 rounded-lg flex items-center justify-center border transition-all cursor-pointer shadow-sm ${
                  bellOpen || unreadCount > 0
                    ? 'bg-orange-500/10 border-orange-500/25 text-orange-500'
                    : 'bg-slate-50 dark:bg-white/5 border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-white/60 hover:text-orange-500'
                }`}
                title="Notifications"
              >
                <Bell className="w-3.5 h-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-bounce">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-[#111111] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Dropdown Header */}
                  <div className="px-4 py-3 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-orange-500/15 text-orange-500 text-[10px] font-black rounded-full">
                          {unreadCount} New
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {notifications.length > 0 && (
                        <>
                          <button
                            onClick={() => notifCtx?.markAllAsRead?.()}
                            className="p-1 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
                            title="Mark all as read"
                          >
                            <CheckCheck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => notifCtx?.clearNotifications?.()}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            title="Clear all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Notification Items List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center">
                        <Bell className="w-8 h-8 text-slate-300 dark:text-white/15 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-400 dark:text-white/40">
                          No notifications yet
                        </p>
                      </div>
                    ) : (
                      notifications.map((note) => (
                        <button
                          key={note.id}
                          onClick={() => handleNotificationClick(note)}
                          className={`w-full text-left px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-start gap-3 cursor-pointer ${
                            note.unread ? 'bg-orange-500/[0.04]' : 'opacity-75'
                          }`}
                        >
                          <span
                            className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                              note.unread ? 'bg-orange-500' : 'bg-transparent'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {note.title}
                              </p>
                              <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                {note.time}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-600 dark:text-white/60 mt-0.5 line-clamp-2">
                              {note.message}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* LOGOUT */}
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer border border-red-500/10 shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="leading-none">Logout</span>
            </button>

            {/* MOBILE MENU */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden w-8.5 h-8.5 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-white/60 hover:text-orange-500 transition-all cursor-pointer shadow-sm"
            >
              <Menu className="w-3.5 h-3.5" />
            </button>

          </div>

        </div>

        {/* MOBILE DRAWER */}
        {mobileMenuOpen && (
          <div className="xl:hidden bg-white dark:bg-[#0c0c0c] border-b border-slate-200/60 dark:border-white/5 p-4 animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-2 gap-2">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg transition-all font-semibold text-xs
                    ${isActive
                        ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-500'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="leading-none">{item.label}</span>
                  </Link>
                );
              })}

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-lg text-xs font-bold transition-colors hover:bg-red-100 dark:hover:bg-red-500/20"
              >
                <LogOut className="w-4 h-4" />
                <span className="leading-none">Logout Admin Panel</span>
              </button>
            </div>
          </div>
        )}

      </header>

      {/* MAIN */}
      <main className="flex-1 max-w-[1700px] mx-auto w-full px-6 py-10 min-h-screen">

        {location.pathname === '/admin' && (

          <header className="flex justify-between items-center mb-10 bg-white dark:bg-[#0c0c0c] p-8 rounded-[2rem] border border-slate-200/60 dark:border-white/5 shadow-sm">

            <div>

              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Admin Dashboard
              </h2>

              <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">
                Welcome back, managing {adminUser.hotel_name || 'Mejwani'} today.
              </p>

            </div>

            <div className="flex items-center gap-4">

              <div className="text-right hidden sm:block">

                <p className="text-xs font-black uppercase text-slate-800 dark:text-white/80">
                  Active Session
                </p>

                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Admin Manager
                </p>

              </div>

              {adminUser.cover_image ? (
                <img src={adminUser.cover_image} alt={adminUser.hotel_name} className="w-10 h-10 rounded-full object-cover border-2 border-orange-500 shadow-lg shadow-orange-500/20" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 border-2 border-white/10 shadow-lg shadow-orange-500/20" />
              )}

            </div>

          </header>

        )}

        {children}

      </main>

      <Toaster position="top-center" />
    </div>
  );
}