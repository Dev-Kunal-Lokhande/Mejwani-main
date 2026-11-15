import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Smartphone, 
  Loader2, 
  ChefHat,
  Utensils,
  ChevronRight,
  ShieldCheck,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowLeft,
  Mail,
  Key,
  AlertTriangle
} from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../services/apiBase';
import { invalidateMenuCache } from '../services/menuCache';

export default function RoleSelection() {
  const navigate = useNavigate();
  const { slug } = useParams();

  // Handle slug parsing to preserve hotel context
  useEffect(() => {
    if (slug) {
      localStorage.setItem('mejwani_hotel_slug', slug);
    }
  }, [slug]);

  const [hotelData, setHotelData] = useState(null);
  const [fetchingHotel, setFetchingHotel] = useState(false);
  const [slugError, setSlugError] = useState(false);

  // Control state for the simulated premium database loader
  const [selectedRole, setSelectedRole] = useState(null); // 'admin' | 'captain' | null
  const [loadingText, setLoadingText] = useState('');
  const [hoveredCard, setHoveredCard] = useState(null); // 'admin' | 'captain' | null

  // Admin login states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Captain login states
  const [showCaptainLoginModal, setShowCaptainLoginModal] = useState(false);
  const [captainEmail, setCaptainEmail] = useState('');
  const [captainPassword, setCaptainPassword] = useState('');
  const [showCaptainPassword, setShowCaptainPassword] = useState(false);
  const [captainLoginLoading, setCaptainLoginLoading] = useState(false);
  const [captainErrorMsg, setCaptainErrorMsg] = useState('');

  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState('EMAIL'); // 'EMAIL' | 'OTP' | 'RESET'
  const [resetEmail, setResetEmail] = useState('');
  const [resetOTP, setResetOTP] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  // Captain Forgot password states
  const [showCaptainForgotPassword, setShowCaptainForgotPassword] = useState(false);
  const [captainForgotPasswordStep, setCaptainForgotPasswordStep] = useState('EMAIL'); // 'EMAIL' | 'OTP' | 'RESET'
  const [captainResetEmail, setCaptainResetEmail] = useState('');
  const [captainResetOTP, setCaptainResetOTP] = useState('');
  const [captainResetNewPassword, setCaptainResetNewPassword] = useState('');
  const [captainResetConfirmPassword, setCaptainResetConfirmPassword] = useState('');
  const [showCaptainResetNewPassword, setShowCaptainResetNewPassword] = useState(false);
  const [showCaptainResetConfirmPassword, setShowCaptainResetConfirmPassword] = useState(false);
  const [captainResetLoading, setCaptainResetLoading] = useState(false);
  const [captainResetSuccessMsg, setCaptainResetSuccessMsg] = useState('');

  // Initialize theme from localStorage, defaulting to 'light' (Day Mode)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('role-selection-theme') || 'light';
  });

  // Sync theme to localStorage
  useEffect(() => {
    localStorage.setItem('role-selection-theme', theme);
  }, [theme]);

  // Sync check to see if we redirected with ?showLogin=true or ?showCaptainLogin=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('showLogin') === 'true') {
      setShowLoginModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('showCaptainLogin') === 'true') {
      setShowCaptainLoginModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch hotel branding by slug
  useEffect(() => {
    if (!slug) {
      setHotelData(null);
      setSlugError(false);
      return;
    }

    const fetchHotelData = async () => {
      setFetchingHotel(true);
      try {
        const response = await fetch(`${API_BASE}/hotels/by-slug/${slug}`);
        const data = await response.json();
        if (response.ok && data.success) {
          setHotelData(data.data);
          setSlugError(false);
          // Persist hotel ID so Captain Panel & other public routes can send hotelId in API requests
          if (data.data?.id) {
            localStorage.setItem('mejwani_hotel_id', data.data.id);
            console.debug('[RoleSelection] Hotel loaded:', data.data.name, '| ID:', data.data.id);
          }
        } else {
          console.warn('Hotel slug not found:', slug);
          setHotelData(null);
          setSlugError(true);
        }
      } catch (error) {
        console.error('Error fetching hotel branding:', error);
        setHotelData(null);
        setSlugError(true);
      } finally {
        setFetchingHotel(false);
      }
    };

    fetchHotelData();
  }, [slug]);

  // Toggle theme between 'light' and 'dark'
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Hotkey listener for fast touchless desktop selection (Press '1' or '2')
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedRole || showLoginModal) return; // ignore keys if already loading or in modal
      if (e.key === '1') {
        handleSelectRole('admin');
      } else if (e.key === '2') {
        handleSelectRole('captain');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRole, showLoginModal]);

  // Validate admin login credentials with real Express/PostgreSQL JWT endpoint
  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Username and Password are required.');
      return;
    }

    setLoginLoading(true);
    setErrorMsg('');

    try {
      const urlHotelId = hotelData?.id || localStorage.getItem('mejwani_hotel_id');
      const response = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, hotelId: urlHotelId ? Number(urlHotelId) : null, hotelSlug: slug }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setLoginLoading(false);
        setErrorMsg(data.message || 'Invalid admin credentials. Please try again.');
        return;
      }

      // Success! Save JWT token + admin data
      localStorage.setItem('mejwani_admin_token', 'true');
      localStorage.setItem('mejwani_admin_jwt', data.token);
      localStorage.setItem('mejwani_admin_user', JSON.stringify(data.admin));
      localStorage.setItem('mejwani_hotel_id', data.admin.hotel_id);
      if (data.admin.hotel_slug) {
        localStorage.setItem('mejwani_hotel_slug', data.admin.hotel_slug);
      }
      invalidateMenuCache();
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      
      setLoginLoading(false);
      setShowLoginModal(false);
      
      // Fire database loader synchronize text
      setSelectedRole('admin');
      setLoadingText('Synchronizing secure session...');
      setTimeout(() => {
        navigate('/admin/orders');
      }, 250);

    } catch (error) {
      console.error('Error connecting to backend auth API:', error);
      setLoginLoading(false);
      setErrorMsg('Unable to connect to the authentication server. Please verify the backend is running.');
    }
  };

  const handleCaptainLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!captainEmail || !captainPassword) {
      setCaptainErrorMsg('Email and Password are required.');
      return;
    }

    setCaptainLoginLoading(true);
    setCaptainErrorMsg('');

    try {
      const urlHotelId = hotelData?.id || localStorage.getItem('mejwani_hotel_id');
      const response = await fetch(`${API_BASE}/staff/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: captainEmail, password: captainPassword, hotelId: urlHotelId ? Number(urlHotelId) : null, hotelSlug: slug }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setCaptainLoginLoading(false);
        setCaptainErrorMsg(data.message || 'Invalid email or password.');
        return;
      }

      // Success! Save Captain JWT token + user details
      localStorage.setItem('mejwani_captain_jwt', data.token);
      localStorage.setItem('mejwani_captain_user', JSON.stringify(data.captain));
      localStorage.setItem('mejwani_hotel_id', data.captain.hotel_id);
      if (data.captain.hotel_slug) {
        localStorage.setItem('mejwani_hotel_slug', data.captain.hotel_slug);
      }
      
      setCaptainLoginLoading(false);
      setShowCaptainLoginModal(false);
      
      setSelectedRole('captain');
      setLoadingText('Loading Captain Panel...');
      setTimeout(() => {
        navigate(`/captain?slug=${data.captain.hotel_slug}`);
      }, 250);

    } catch (error) {
      console.error('Error connecting to captain login API:', error);
      setCaptainLoginLoading(false);
      setCaptainErrorMsg('Unable to connect to the authentication server. Please verify the backend is running.');
    }
  };

  // Handle Captain OTP-based forgot password flow
  const handleCaptainForgotPasswordSubmit = async (e) => {
    if (e) e.preventDefault();
    setCaptainErrorMsg('');

    // Retrieve hotel_id from the context or localStorage
    const hotelId = hotelData?.id || localStorage.getItem('mejwani_hotel_id');
    if (!hotelId) {
      setCaptainErrorMsg('Hotel context is missing. Please access this page using the hotel-specific link.');
      return;
    }

    if (captainForgotPasswordStep === 'EMAIL') {
      if (!captainResetEmail) {
        setCaptainErrorMsg('Email address is required.');
        return;
      }
      setCaptainResetLoading(true);
      try {
        const response = await fetch(`${API_BASE}/captain/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: captainResetEmail, hotelId: Number(hotelId) }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          setCaptainResetLoading(false);
          setCaptainErrorMsg(data.message || 'Failed to send OTP.');
          return;
        }
        setCaptainResetLoading(false);
        setCaptainForgotPasswordStep('OTP');
      } catch (error) {
        setCaptainResetLoading(false);
        setCaptainErrorMsg('Unable to connect to the server. Please verify the backend is running.');
      }
    } else if (captainForgotPasswordStep === 'OTP') {
      if (!captainResetOTP) {
        setCaptainErrorMsg('Please enter the 6-digit OTP.');
        return;
      }
      if (captainResetOTP.length !== 6) {
        setCaptainErrorMsg('OTP must be exactly 6 digits.');
        return;
      }
      setCaptainResetLoading(true);
      try {
        const response = await fetch(`${API_BASE}/captain/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: captainResetEmail, otp: captainResetOTP, hotelId: Number(hotelId) }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          setCaptainResetLoading(false);
          setCaptainErrorMsg(data.message || 'Incorrect or expired OTP.');
          return;
        }
        setCaptainResetLoading(false);
        setCaptainForgotPasswordStep('RESET');
      } catch (error) {
        setCaptainResetLoading(false);
        setCaptainErrorMsg('Unable to connect to the server. Please verify the backend is running.');
      }
    } else if (captainForgotPasswordStep === 'RESET') {
      if (!captainResetNewPassword || !captainResetConfirmPassword) {
        setCaptainErrorMsg('All fields are required.');
        return;
      }
      if (captainResetNewPassword.length < 8) {
        setCaptainErrorMsg('Password must be at least 8 characters long.');
        return;
      }
      if (captainResetNewPassword !== captainResetConfirmPassword) {
        setCaptainErrorMsg('New password and confirm password do not match.');
        return;
      }
      setCaptainResetLoading(true);
      try {
        const response = await fetch(`${API_BASE}/captain/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: captainResetEmail,
            otp: captainResetOTP,
            newPassword: captainResetNewPassword,
            confirmPassword: captainResetConfirmPassword,
            hotelId: Number(hotelId)
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          setCaptainResetLoading(false);
          setCaptainErrorMsg(data.message || 'Failed to reset password.');
          return;
        }
        setCaptainResetEmail('');
        setCaptainResetOTP('');
        setCaptainResetNewPassword('');
        setCaptainResetConfirmPassword('');
        setCaptainResetLoading(false);
        setCaptainForgotPasswordStep('EMAIL');
        setShowCaptainForgotPassword(false);
        setCaptainResetSuccessMsg('Password reset successfully! Log in with your new password.');
        setTimeout(() => {
          setCaptainResetSuccessMsg('');
        }, 5000);
      } catch (error) {
        setCaptainResetLoading(false);
        setCaptainErrorMsg('Unable to connect to the server. Please verify the backend is running.');
      }
    }
  };

  // Handle OTP-based forgot password flow
  const handleForgotPasswordSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (forgotPasswordStep === 'EMAIL') {
      if (!resetEmail) {
        setErrorMsg('Email address is required.');
        return;
      }
      setResetLoading(true);
      try {
        const urlHotelId = hotelData?.id || localStorage.getItem('mejwani_hotel_id');
        const response = await fetch(`${API_BASE}/admin/forgot-password/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail, hotelId: urlHotelId ? Number(urlHotelId) : null, hotelSlug: slug }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          setResetLoading(false);
          setErrorMsg(data.message || 'Failed to send OTP.');
          return;
        }
        setResetLoading(false);
        setForgotPasswordStep('OTP');
      } catch (error) {
        setResetLoading(false);
        setErrorMsg('Unable to connect to the server. Please verify the backend is running.');
      }
    } else if (forgotPasswordStep === 'OTP') {
      if (!resetOTP) {
        setErrorMsg('Please enter the 6-digit OTP.');
        return;
      }
      if (resetOTP.length !== 6) {
        setErrorMsg('OTP must be exactly 6 digits.');
        return;
      }
      setResetLoading(true);
      try {
        const urlHotelId = hotelData?.id || localStorage.getItem('mejwani_hotel_id');
        const response = await fetch(`${API_BASE}/admin/forgot-password/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail, otp: resetOTP, hotelId: urlHotelId ? Number(urlHotelId) : null, hotelSlug: slug }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          setResetLoading(false);
          setErrorMsg(data.message || 'Incorrect or expired OTP.');
          return;
        }
        setResetLoading(false);
        setForgotPasswordStep('RESET');
      } catch (error) {
        setResetLoading(false);
        setErrorMsg('Unable to connect to the server. Please verify the backend is running.');
      }
    } else if (forgotPasswordStep === 'RESET') {
      if (!resetNewPassword || !resetConfirmPassword) {
        setErrorMsg('All fields are required.');
        return;
      }
      if (resetNewPassword.length < 8) {
        setErrorMsg('Password must be at least 8 characters long.');
        return;
      }
      if (resetNewPassword !== resetConfirmPassword) {
        setErrorMsg('New password and confirm password do not match.');
        return;
      }
      setResetLoading(true);
      try {
        const urlHotelId = hotelData?.id || localStorage.getItem('mejwani_hotel_id');
        const response = await fetch(`${API_BASE}/admin/forgot-password/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: resetEmail,
            otp: resetOTP,
            newPassword: resetNewPassword,
            confirmPassword: resetConfirmPassword,
            hotelId: urlHotelId ? Number(urlHotelId) : null,
            hotelSlug: slug
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          setResetLoading(false);
          setErrorMsg(data.message || 'Failed to reset password.');
          return;
        }
        setResetEmail('');
        setResetOTP('');
        setResetNewPassword('');
        setResetConfirmPassword('');
        setResetLoading(false);
        setForgotPasswordStep('EMAIL');
        setShowForgotPassword(false);
        setResetSuccessMsg('Password reset successfully! Log in with your new password.');
        setTimeout(() => {
          setResetSuccessMsg('');
        }, 5000);
      } catch (error) {
        setResetLoading(false);
        setErrorMsg('Unable to connect to the server. Please verify the backend is running.');
      }
    }
  };

  // Handle choice selection with animated preloading delay
  const handleSelectRole = (role) => {
    if (role === 'admin') {
      // Check if already authenticated with active JWT token
      const isAuthenticated = localStorage.getItem('mejwani_admin_token') === 'true' &&
                              !!localStorage.getItem('mejwani_admin_jwt');
      if (isAuthenticated) {
        setSelectedRole('admin');
        setLoadingText('Synchronizing secure session...');
        setTimeout(() => {
          navigate('/admin/orders');
        }, 250);
      } else {
        setShowLoginModal(true);
      }
    } else {
      // Check if already authenticated with active Captain JWT token (also validate expiry)
      const captainToken = localStorage.getItem('mejwani_captain_jwt');
      let isAuthenticated = false;
      if (captainToken) {
        try {
          const payload = JSON.parse(atob(captainToken.split('.')[1]));
          isAuthenticated = payload.exp && payload.exp * 1000 > Date.now();
          if (!isAuthenticated) {
            // Token expired — clear stale data and show login
            localStorage.removeItem('mejwani_captain_jwt');
            localStorage.removeItem('mejwani_captain_user');
          }
        } catch {
          localStorage.removeItem('mejwani_captain_jwt');
        }
      }
      if (isAuthenticated) {
        setSelectedRole('captain');
        setLoadingText('Loading Captain Panel...');
        setTimeout(() => {
          // Navigate with hotel slug context so CaptainPanel can resolve hotelId
          const currentSlug = localStorage.getItem('mejwani_hotel_slug') || slug;
          if (currentSlug) {
            navigate(`/captain?slug=${currentSlug}`);
          } else {
            navigate('/captain');
          }
        }, 250);
      } else {
        setShowCaptainLoginModal(true);
      }
    }
  };

  return (
    <div 
      className={`relative min-h-screen bg-no-repeat flex flex-col items-center lg:items-start justify-center p-4 sm:p-6 md:p-10 lg:pl-16 xl:pl-28 overflow-hidden select-none transition-colors duration-500 ${
        theme === 'dark' ? 'dark bg-slate-950' : 'bg-slate-50'
      }`}
      style={{ 
        backgroundImage: hotelData?.cover_image ? `url('${hotelData.cover_image}')` : "url('/hotel1.png')",
        backgroundPosition: 'center top',
        backgroundSize: 'cover'
      }}
    >
      
      {/* PREMIUM FLOATING THEME TOGGLE BUTTON AT TOP-RIGHT */}
      <div className="absolute top-6 right-6 sm:right-10 z-20">
        <button 
          onClick={toggleTheme}
          className={`px-3.5 py-2 rounded-full border transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 ${
            theme === 'dark' 
              ? 'bg-black/50 border-white/15 hover:bg-black/75 text-white shadow-md shadow-black/20' 
              : 'bg-white/80 border-slate-200 hover:bg-white text-slate-800 shadow-sm shadow-slate-200/50'
          }`}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-orange-400" />
              <span className="text-[9px] font-black uppercase tracking-wider pr-0.5">Day Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-600" />
              <span className="text-[9px] font-black uppercase tracking-wider pr-0.5">Night Mode</span>
            </>
          )}
        </button>
      </div>

      {/* CINEMATIC DYNAMIC BACKDROP OVERLAY (SOFT DIM & BLUR ONLY ON HOVER, REMAINS SHARP BY DEFAULT) */}
      <motion.div 
        animate={{
          backgroundColor: hoveredCard 
            ? (theme === 'dark' ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.35)') 
            : (theme === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.2)'),
          backdropFilter: hoveredCard ? 'blur(1.5px)' : 'blur(0px)'
        }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        className="absolute inset-0 z-0 pointer-events-none"
      />

      {/* ATMOSPHERIC GRADIENT FOR REALISTIC NIGHT AMBIENCE */}
      {theme === 'dark' && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/35 z-0 pointer-events-none" />
      )}

      {/* WARM CORNER BLURS FOR RESORT AMBIENCE */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-80 dark:opacity-100">
        <div className="absolute -top-48 -left-48 w-96 h-96 bg-orange-500/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-48 -right-48 w-96 h-96 bg-[#1c7ed6]/10 rounded-full blur-[140px]" />
      </div>

      {/* MAIN CONTAINER: TRULY LUXURIOUS FROSTED GLASSMORPHIC PANEL (COMPACT PREMIUM SIZE) */}
      <motion.div 
        initial={{ opacity: 0, y: 35 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: 'spring', stiffness: 80 }}
        className={`relative z-10 w-full max-w-2xl lg:max-w-[700px] rounded-[32px] p-5 sm:p-7 md:p-8 text-center ring-1 ring-inset transition-all duration-500 ${
          theme === 'dark' 
            ? 'backdrop-blur-2xl bg-black/35 border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.55)] ring-white/10' 
            : 'backdrop-blur-md bg-white/65 border border-white/40 shadow-2xl ring-white/30'
        }`}
      >
        
        {/* Mirror Reflection Overlay */}
        <div className={`absolute inset-0 pointer-events-none rounded-[32px] transition-all duration-500 ${
          theme === 'dark' ? 'bg-gradient-to-tr from-white/[0.04] via-transparent to-transparent' : 'bg-gradient-to-tr from-white/[0.2] via-transparent to-transparent'
        }`} />

        {/* BRAND HALO BLOOM BACKDROP */}
        <AnimatePresence>
          {hoveredCard && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 0.2, scale: 1.25 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className={`absolute -top-12 left-1/2 -translate-x-1/2 w-52 h-52 rounded-full blur-3xl pointer-events-none z-0 ${
                hoveredCard === 'admin' ? 'bg-[#ff6b00]' : 'bg-[#1c7ed6]'
              }`}
            />
          )}
        </AnimatePresence>

        {/* LOGO & HEADING (COMPACT) */}
        <div className="space-y-3 mb-6 relative z-10 flex flex-col items-center">
          
          {/* Logo brand circle */}
          <motion.div 
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 12, stiffness: 120 }}
            className="w-10 h-10 bg-gradient-to-br from-[#ff6b00] to-[#ff8c3a] rounded-xl flex items-center justify-center shadow-md shadow-orange-500/25 border border-white/15"
          >
            <Utensils className="text-white w-5 h-5" />
          </motion.div>

          <div className="space-y-2 w-full flex flex-col items-center">
            <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-light tracking-[0.22em] leading-none pl-2 transition-all duration-300 font-serif hover:tracking-[0.24em] select-none ${
              theme === 'dark' 
                ? 'text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)]' 
                : 'text-slate-800 drop-shadow-[0_2px_6px_rgba(0,0,0,0.06)]'
            }`}>
              {hotelData?.name ? hotelData.name.toUpperCase() : 'MEJWANI'}
            </h1>
            
            {/* Elegant Serif Divider Line */}
            <div className="flex items-center justify-center gap-3 my-2 w-full max-w-xs opacity-50">
              <div className={`h-[1px] w-16 bg-gradient-to-r from-transparent transition-colors duration-300 ${theme === 'dark' ? 'to-white/40' : 'to-slate-800/30'}`} />
              <span className="text-[#d6b36a] text-[8px] tracking-normal font-black">✦</span>
              <div className={`h-[1px] w-16 bg-gradient-to-l from-transparent transition-colors duration-300 ${theme === 'dark' ? 'to-white/40' : 'to-slate-800/30'}`} />
            </div>

            <h2 className="text-xs sm:text-[13px] lg:text-[14px] font-bold uppercase tracking-[0.3em] text-[#d6b36a]/90 select-none transition-all">
              Restaurant Management System
            </h2>
          </div>

        </div>

        {slugError ? (
          <div className="py-12 px-6 flex flex-col items-center justify-center gap-4 text-center relative z-10">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20 text-rose-500">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-2">Hotel Not Found</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              The restaurant slug <span className="font-mono font-bold text-rose-500">"{slug}"</span> could not be found. Please verify the URL or contact system administration.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('mejwani_hotel_slug');
                navigate('/select-panel');
              }}
              className="mt-4 px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Go to Default Panel
            </button>
          </div>
        ) : (
          <>
            {/* DUAL ROLE SELECTION CARDS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch relative z-10 max-w-2xl mx-auto">
              
              {/* CARD 1: ADMIN OPERATIONS */}
              <motion.div
                whileHover={{ y: -4, scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                onMouseEnter={() => setHoveredCard('admin')}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => handleSelectRole('admin')}
                className={`group relative cursor-pointer p-5 sm:p-6 rounded-[24px] border-2 transition-all duration-300 flex flex-col justify-between items-center text-center backdrop-blur-xl ring-1 ring-inset ${
                  theme === 'dark'
                    ? `bg-black/65 border-white/10 ring-white/[0.08] ${
                        hoveredCard === 'admin'
                          ? 'border-[#ff6b00] shadow-[0_15px_35px_-5px_rgba(255,107,0,0.35)] bg-black/75'
                          : hoveredCard === 'captain'
                          ? 'border-white/5 opacity-35 scale-[0.98]'
                          : 'border-orange-500/20 shadow-[0_4px_20px_rgba(255,107,0,0.08)]'
                      }`
                    : `bg-white/95 border-slate-200 ring-slate-100/10 ${
                        hoveredCard === 'admin'
                          ? 'border-[#ff6b00] shadow-[0_15px_30px_rgba(255,107,0,0.15)] bg-white'
                          : hoveredCard === 'captain'
                          ? 'border-slate-100 opacity-35 scale-[0.98]'
                          : 'border-orange-500/15 shadow-[0_4px_20px_rgba(0,0,0,0.02)]'
                      }`
                }`}
              >
                {/* Gloss reflection shine logic */}
                <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none overflow-hidden rounded-[24px]">
                  <motion.div
                    animate={{ x: ['-100%', '120%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
                    className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent -skew-x-12"
                  />
                </div>

                <div className="space-y-3 py-2 flex flex-col items-center z-10 relative">
                  
                  {/* glowing Hexagon wrapper */}
                  <div className="w-12 h-12 relative flex items-center justify-center text-orange-500 mb-1">
                    <svg viewBox="0 0 100 100" className={`absolute inset-0 w-full h-full fill-orange-500/5 stroke-[#ff6b00] stroke-[2.2] overflow-visible transition-all duration-300 ${
                      theme === 'dark' ? 'drop-shadow-[0_0_10px_rgba(255,107,0,0.4)]' : 'drop-shadow-[0_0_8px_rgba(255,107,0,0.2)]'
                    }`}>
                      <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" />
                    </svg>
                    <ChefHat className="w-5 h-5 z-10 text-orange-400 group-hover:scale-110 transition-transform duration-300" />
                  </div>

                  <div className="space-y-1.5 flex flex-col items-center">
                    <h3 className={`text-lg sm:text-xl lg:text-[22px] font-semibold tracking-[0.08em] transition-all duration-300 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                      <span className="text-[#ff6b00] font-black mr-2 drop-shadow-[0_2px_10px_rgba(255,107,0,0.15)]">ADMIN</span>DASHBOARD
                    </h3>
                    <p className={`text-xs sm:text-[13px] lg:text-[14px] font-medium leading-[1.6] max-w-[240px] transition-colors duration-300 ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
                      Manage restaurant operations with full control
                    </p>
                  </div>

                </div>

                <div className="w-full mt-5 z-10 relative">
                  
                  {/* solid orange button in Light mode, glowing outline neon style in Dark mode */}
                  <button 
                    className={`w-full py-3 rounded-full font-bold text-xs lg:text-[13.5px] tracking-[0.08em] uppercase transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.97] hover:scale-[1.01] ${
                      theme === 'dark'
                        ? 'bg-transparent border border-[#ff6b00] text-orange-400 hover:bg-[#ff6b00]/10 hover:shadow-[0_0_18px_rgba(255,107,0,0.45)]'
                        : 'bg-gradient-to-r from-[#ff6b00] to-[#ff8524] text-white hover:shadow-[0_5px_18px_rgba(255,107,0,0.4)] shadow-md shadow-orange-500/20'
                    }`}
                  >
                    <span>Open Admin Panel</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <span className={`text-[9.5px] font-bold uppercase tracking-[0.16em] block mt-3 transition-colors duration-300 ${
                    theme === 'dark' ? 'text-white/30' : 'text-slate-400'
                  }`}>
                    [Press 1]
                  </span>

                </div>
              </motion.div>

              {/* CARD 2: CAPTAIN HANDHELD PANEL */}
              <motion.div
                whileHover={{ y: -4, scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                onMouseEnter={() => setHoveredCard('captain')}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => handleSelectRole('captain')}
                className={`group relative cursor-pointer p-5 sm:p-6 rounded-[24px] border-2 transition-all duration-300 flex flex-col justify-between items-center text-center backdrop-blur-xl ring-1 ring-inset ${
                  theme === 'dark'
                    ? `bg-black/65 border-white/10 ring-white/[0.08] ${
                        hoveredCard === 'captain'
                          ? 'border-[#1c7ed6] shadow-[0_15px_35px_-5px_rgba(28,126,214,0.35)] bg-black/75'
                          : hoveredCard === 'admin'
                          ? 'border-white/5 opacity-35 scale-[0.98]'
                          : 'border-blue-500/20 shadow-[0_4px_20px_rgba(28,126,214,0.08)]'
                      }`
                    : `bg-white/95 border-slate-200 ring-slate-100/10 ${
                        hoveredCard === 'captain'
                          ? 'border-[#4c6ef5] shadow-[0_15px_30px_rgba(76,110,245,0.15)] bg-white'
                          : hoveredCard === 'admin'
                          ? 'border-slate-100 opacity-35 scale-[0.98]'
                          : 'border-[#4c6ef5]/15 shadow-[0_4px_20px_rgba(0,0,0,0.02)]'
                      }`
                }`}
              >
                {/* Gloss reflection shine logic */}
                <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none overflow-hidden rounded-[24px]">
                  <motion.div
                    animate={{ x: ['-100%', '120%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
                    className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent -skew-x-12"
                  />
                </div>

                <div className="space-y-3 py-2 flex flex-col items-center z-10 relative">
                  
                  {/* glowing Hexagon wrapper */}
                  <div className="w-12 h-12 relative flex items-center justify-center text-indigo-500 mb-1">
                    <svg viewBox="0 0 100 100" className={`absolute inset-0 w-full h-full fill-indigo-500/5 stroke-[2.2] overflow-visible transition-all duration-300 ${
                      theme === 'dark' 
                        ? 'stroke-[#1c7ed6] drop-shadow-[0_0_10px_rgba(28,126,214,0.4)]' 
                        : 'stroke-[#4c6ef5] drop-shadow-[0_0_8px_rgba(76,110,245,0.2)]'
                    }`}>
                      <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" />
                    </svg>
                    <Smartphone className={`w-5 h-5 z-10 transition-all duration-300 ${
                      theme === 'dark' ? 'text-[#4dabf7]' : 'text-[#4c6ef5]'
                    }`} />
                  </div>

                  <div className="space-y-1.5 flex flex-col items-center">
                    <h3 className={`text-lg sm:text-xl lg:text-[22px] font-semibold tracking-[0.08em] transition-all duration-300 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                      <span className={`${theme === 'dark' ? 'text-[#1c7ed6]' : 'text-[#4c6ef5]'} font-black mr-2 drop-shadow-[0_2px_10px_rgba(28,126,214,0.15)]`}>CAPTAIN</span>PANEL
                    </h3>
                    <p className={`text-xs sm:text-[13px] lg:text-[14px] font-medium leading-[1.6] max-w-[240px] transition-colors duration-300 ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
                      Take orders and manage tables easily
                    </p>
                  </div>

                </div>

                <div className="w-full mt-5 z-10 relative">
                  
                  {/* solid indigo button in Light mode, glowing outline neon style in Dark mode */}
                  <button 
                    className={`w-full py-3 rounded-full font-bold text-xs lg:text-[13.5px] tracking-[0.08em] uppercase transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.97] hover:scale-[1.01] ${
                      theme === 'dark'
                        ? 'bg-transparent border border-[#1c7ed6] text-[#4dabf7] hover:bg-[#1c7ed6]/10 hover:shadow-[0_0_18px_rgba(28,126,214,0.45)]'
                        : 'bg-gradient-to-r from-[#4c6ef5] to-[#5c7cfa] text-white hover:shadow-[0_5px_18px_rgba(76,110,245,0.4)] shadow-md shadow-indigo-500/20'
                    }`}
                  >
                    <span>Open Captain Panel</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <span className={`text-[9.5px] font-bold uppercase tracking-[0.16em] block mt-3 transition-colors duration-300 ${
                    theme === 'dark' ? 'text-white/30' : 'text-slate-400'
                  }`}>
                    [Press 2]
                  </span>

                </div>
              </motion.div>

            </div>

            {/* BOTTOM METADATA TRUST BADGE */}
            <div className="relative z-10 mt-8 flex justify-center">
              <div className={`inline-flex items-center gap-2 rounded-full border px-6 py-2.5 transition-all duration-300 ${
                theme === 'dark' 
                  ? 'border-white/10 bg-black/50 shadow-[0_2px_15px_rgba(0,0,0,0.5)]' 
                  : 'border-slate-200/80 bg-white/90 shadow-md'
              }`}>
                <ShieldCheck className="w-4 h-4 text-[#d6b36a] filter drop-shadow-[0_0_4px_rgba(214,179,106,0.4)]" />
                <span className="text-[#d6b36a]/90 text-[10.5px] sm:text-xs font-bold uppercase tracking-[0.24em] transition-all">
                  Secure • Reliable • Designed For Restaurants
                </span>
              </div>
            </div>
          </>
        )}

      </motion.div>

      {/* FULL-SCREEN GLASS PRE-LOADER OVERLAY */}
      <AnimatePresence>
        {selectedRole && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 backdrop-blur-xl flex items-center justify-center transition-colors duration-500 ${
              theme === 'dark' ? 'bg-black/90' : 'bg-slate-900/80'
            }`}
          >
            <motion.div
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              className="text-center"
            >
              <div className="relative w-20 h-20 mx-auto">
                <Loader2 className="w-20 h-20 text-orange-500 animate-spin" />
                <div className={`absolute inset-2.5 rounded-full flex items-center justify-center transition-colors duration-500 ${
                  theme === 'dark' ? 'bg-black' : 'bg-slate-900'
                }`}>
                  <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-8.03c2.09-.13 3.75-1.85 3.75-3.97V22zm7-7c-2.21 0-4 1.79-4 4v6h2v10h2V2h-2z" />
                  </svg>
                </div>
              </div>
              <p className="mt-8 text-white uppercase tracking-[0.28em] text-xs font-black animate-pulse">
                {loadingText}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PREMIUM ADMIN AUTHENTICATION GLASS LOGIN MODAL */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 backdrop-blur-xl flex items-center justify-center p-4"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(15, 23, 42, 0.45)'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 25 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 25 }}
              transition={{ type: 'spring', damping: 20, stiffness: 150 }}
              className={`w-full max-w-[420px] rounded-[32px] p-6 sm:p-8 relative border transition-all duration-300 ${
                theme === 'dark'
                  ? 'bg-black/80 border-white/20 shadow-[0_25px_80px_rgba(0,0,0,0.65)] text-white'
                  : 'bg-white/95 border-slate-200 shadow-2xl text-slate-800'
              }`}
            >
              
              {/* Back / Close button */}
              <button
                onClick={() => {
                  if (showForgotPassword) {
                    setShowForgotPassword(false);
                    setErrorMsg('');
                  } else {
                    setShowLoginModal(false);
                    setErrorMsg('');
                    setUsername('');
                    setPassword('');
                  }
                }}
                className={`absolute top-5 left-5 p-1.5 rounded-full border transition-all duration-200 hover:scale-105 active:scale-95 ${
                  theme === 'dark'
                    ? 'border-white/10 hover:bg-white/10 text-white/70 hover:text-white'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* BRANDING INSIDE MODAL */}
              {!showForgotPassword ? (
                <div className="flex flex-col items-center mt-4 mb-6">
                  <div className="w-9 h-9 bg-gradient-to-br from-[#ff6b00] to-[#ff8c3a] rounded-xl flex items-center justify-center shadow-md shadow-orange-500/25 border border-white/15 mb-2.5">
                    <Utensils className="text-white w-4.5 h-4.5" />
                  </div>
                  <h2 className={`text-2xl font-light tracking-[0.16em] font-serif ${
                    theme === 'dark' ? 'text-white' : 'text-slate-800'
                  }`}>
                    ADMIN GATEWAY
                  </h2>
                  <div className="flex items-center justify-center gap-2 my-1.5 opacity-55">
                    <span className="text-[#d6b36a] text-[6px] tracking-normal font-black">✦</span>
                  </div>
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.24em] text-[#d6b36a]/95 text-center mt-1 select-none">
                    Restaurant Control Panel
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center mt-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="w-9 h-9 bg-gradient-to-br from-[#ff6b00] to-[#ff8c3a] rounded-xl flex items-center justify-center shadow-md shadow-orange-500/25 border border-white/15 mb-2.5">
                    <ShieldCheck className="text-white w-4.5 h-4.5 animate-pulse" />
                  </div>
                  <h2 className={`text-2xl font-light tracking-[0.16em] font-serif ${
                    theme === 'dark' ? 'text-white' : 'text-slate-800'
                  }`}>
                    PASSWORD RESET
                  </h2>
                  <div className="flex items-center justify-center gap-2 my-1.5 opacity-55">
                    <span className="text-[#d6b36a] text-[6px] tracking-normal font-black">✦</span>
                  </div>
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.24em] text-[#d6b36a]/95 text-center mt-1 select-none">
                    {forgotPasswordStep === 'EMAIL' ? 'Enter Admin Email' : forgotPasswordStep === 'OTP' ? 'OTP Verification' : 'Set New Password'}
                  </p>
                </div>
              )}

              {/* DYNAMIC FORM VIEWS */}
              {showForgotPassword ? (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 animate-in fade-in duration-300">
                  {forgotPasswordStep === 'EMAIL' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      {/* Reset Email Input */}
                      <div className="space-y-1.5">
                        <label className={`text-[10.5px] font-bold uppercase tracking-[0.16em] block mb-2 pl-0.5 transition-colors ${
                          theme === 'dark' ? 'text-[#d6b36a]/85' : 'text-slate-600/90'
                        }`}>
                          Admin Email
                        </label>
                        <div className="relative">
                          <Mail className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${
                            theme === 'dark' ? 'text-white/40' : 'text-slate-400'
                          }`} />
                          <input
                            type="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            placeholder="e.g. owner@hotel.com"
                            disabled={resetLoading}
                            className={`w-full pl-11 pr-4 py-3 rounded-2xl text-xs font-bold transition-all duration-300 outline-none border ${
                              theme === 'dark'
                                ? 'bg-white/[0.03] border-white/10 text-white placeholder-white/25 focus:border-[#ff6b00] focus:bg-white/[0.06] focus:ring-1 focus:ring-[#ff6b00]/30'
                                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#ff6b00] focus:bg-white focus:ring-1 focus:ring-[#ff6b00]/25'
                            }`}
                          />
                        </div>
                      </div>

                      {/* ERROR FEEDBACK */}
                      <AnimatePresence>
                        {errorMsg && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl px-5 py-3 text-xs font-semibold text-center leading-relaxed tracking-wide shadow-inner"
                          >
                            {errorMsg}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* SUBMIT BUTTON */}
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className={`w-full py-3 rounded-full font-extrabold text-[10px] tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 mt-2 cursor-pointer ${
                          resetLoading
                            ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed border-none'
                            : 'bg-gradient-to-r from-[#ff6b00] to-[#ff8524] text-white hover:shadow-[0_4px_20px_rgba(255,107,0,0.35)] shadow-md shadow-orange-500/25'
                        }`}
                      >
                        {resetLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Sending OTP...</span>
                          </>
                        ) : (
                          <>
                            <span>Send OTP</span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {forgotPasswordStep === 'OTP' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      {/* OTP Input */}
                      <div className="space-y-1.5">
                        <label className={`text-[10.5px] font-bold uppercase tracking-[0.16em] block mb-2 pl-0.5 transition-colors ${
                          theme === 'dark' ? 'text-[#d6b36a]/85' : 'text-slate-600/90'
                        }`}>
                          6-Digit OTP
                        </label>
                        <div className="relative">
                          <Key className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${
                            theme === 'dark' ? 'text-white/40' : 'text-slate-400'
                          }`} />
                          <input
                            type="text"
                            maxLength={6}
                            value={resetOTP}
                            onChange={(e) => setResetOTP(e.target.value.replace(/\D/g, ''))}
                            placeholder="Enter 6-digit OTP"
                            disabled={resetLoading}
                            className={`w-full pl-11 pr-4 py-3 rounded-2xl text-xs font-bold transition-all duration-300 outline-none border ${
                              theme === 'dark'
                                ? 'bg-white/[0.03] border-white/10 text-white placeholder-white/25 focus:border-[#ff6b00] focus:bg-white/[0.06] focus:ring-1 focus:ring-[#ff6b00]/30'
                                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#ff6b00] focus:bg-white focus:ring-1 focus:ring-[#ff6b00]/25'
                            }`}
                          />
                        </div>
                      </div>

                      {/* ERROR FEEDBACK */}
                      <AnimatePresence>
                        {errorMsg && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl px-5 py-3 text-xs font-semibold text-center leading-relaxed tracking-wide shadow-inner"
                          >
                            {errorMsg}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* VERIFY BUTTON */}
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className={`w-full py-3 rounded-full font-extrabold text-[10px] tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 mt-2 cursor-pointer ${
                          resetLoading
                            ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed border-none'
                            : 'bg-gradient-to-r from-[#ff6b00] to-[#ff8524] text-white hover:shadow-[0_4px_20px_rgba(255,107,0,0.35)] shadow-md shadow-orange-500/25'
                        }`}
                      >
                        {resetLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Verifying OTP...</span>
                          </>
                        ) : (
                          <>
                            <span>Verify OTP</span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      {/* Back to Email / Resend Option */}
                      <div className="flex justify-between items-center px-1 text-[10.5px]">
                        <button
                          type="button"
                          disabled={resetLoading}
                          onClick={() => {
                            setForgotPasswordStep('EMAIL');
                            setErrorMsg('');
                          }}
                          className={`font-bold transition-colors ${
                            theme === 'dark' ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Change Email
                        </button>
                        <button
                          type="button"
                          disabled={resetLoading}
                          onClick={async () => {
                            setResetLoading(true);
                            setErrorMsg('');
                            try {
                              const urlHotelId = hotelData?.id || localStorage.getItem('mejwani_hotel_id');
                              const response = await fetch(`${API_BASE}/admin/forgot-password/request`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: resetEmail, hotelId: urlHotelId ? Number(urlHotelId) : null, hotelSlug: slug }),
                              });
                              const data = await response.json();
                              setResetLoading(false);
                              if (!response.ok || !data.success) {
                                setErrorMsg(data.message || 'Failed to resend OTP.');
                                return;
                              }
                              setResetOTP('');
                              setErrorMsg('New OTP sent successfully!');
                              setTimeout(() => setErrorMsg(''), 3000);
                            } catch (e) {
                              setResetLoading(false);
                              setErrorMsg('Failed to resend OTP.');
                            }
                          }}
                          className="font-extrabold text-[#ff6b00] hover:text-[#ff8524] transition-colors bg-transparent border-none cursor-pointer outline-none"
                        >
                          Resend OTP
                        </button>
                      </div>
                    </div>
                  )}

                  {forgotPasswordStep === 'RESET' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      {/* Reset New Password Input */}
                      <div className="space-y-1.5">
                        <label className={`text-[10.5px] font-bold uppercase tracking-[0.16em] block mb-2 pl-0.5 transition-colors ${
                          theme === 'dark' ? 'text-[#d6b36a]/85' : 'text-slate-600/90'
                        }`}>
                          New Password (min 8 chars)
                        </label>
                        <div className="relative">
                          <Lock className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${
                            theme === 'dark' ? 'text-white/40' : 'text-slate-400'
                          }`} />
                          <input
                            type={showResetNewPassword ? 'text' : 'password'}
                            value={resetNewPassword}
                            onChange={(e) => setResetNewPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={resetLoading}
                            className={`w-full pl-11 pr-12 py-3 rounded-2xl text-xs font-bold transition-all duration-300 outline-none border ${
                              theme === 'dark'
                                ? 'bg-white/[0.03] border-white/10 text-white placeholder-white/25 focus:border-[#ff6b00] focus:bg-white/[0.06] focus:ring-1 focus:ring-[#ff6b00]/30'
                                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#ff6b00] focus:bg-white focus:ring-1 focus:ring-[#ff6b00]/25'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetNewPassword(prev => !prev)}
                            disabled={resetLoading}
                            className={`absolute right-4 top-3.5 transition-colors ${
                              theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                            }`}
                          >
                            {showResetNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Reset Confirm Password Input */}
                      <div className="space-y-1.5">
                        <label className={`text-[10.5px] font-bold uppercase tracking-[0.16em] block mb-2 pl-0.5 transition-colors ${
                          theme === 'dark' ? 'text-[#d6b36a]/85' : 'text-slate-600/90'
                        }`}>
                          Confirm Password
                        </label>
                        <div className="relative">
                          <Lock className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${
                            theme === 'dark' ? 'text-white/40' : 'text-slate-400'
                          }`} />
                          <input
                            type={showResetConfirmPassword ? 'text' : 'password'}
                            value={resetConfirmPassword}
                            onChange={(e) => setResetConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={resetLoading}
                            className={`w-full pl-11 pr-12 py-3 rounded-2xl text-xs font-bold transition-all duration-300 outline-none border ${
                              theme === 'dark'
                                ? 'bg-white/[0.03] border-white/10 text-white placeholder-white/25 focus:border-[#ff6b00] focus:bg-white/[0.06] focus:ring-1 focus:ring-[#ff6b00]/30'
                                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#ff6b00] focus:bg-white focus:ring-1 focus:ring-[#ff6b00]/25'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetConfirmPassword(prev => !prev)}
                            disabled={resetLoading}
                            className={`absolute right-4 top-3.5 transition-colors ${
                              theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                            }`}
                          >
                            {showResetConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* ERROR FEEDBACK */}
                      <AnimatePresence>
                        {errorMsg && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl px-5 py-3 text-xs font-semibold text-center leading-relaxed tracking-wide shadow-inner"
                          >
                            {errorMsg}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* RESET ACTION BUTTON */}
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className={`w-full py-3 rounded-full font-extrabold text-[10px] tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 mt-2 cursor-pointer ${
                          resetLoading
                            ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed border-none'
                            : 'bg-gradient-to-r from-[#ff6b00] to-[#ff8524] text-white hover:shadow-[0_4px_20px_rgba(255,107,0,0.35)] shadow-md shadow-orange-500/25'
                        }`}
                      >
                        {resetLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Resetting Credentials...</span>
                          </>
                        ) : (
                          <>
                            <span>Reset Security Password</span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* RETURN TO LOGIN BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordStep('EMAIL');
                      setResetEmail('');
                      setResetOTP('');
                      setResetNewPassword('');
                      setResetConfirmPassword('');
                      setErrorMsg('');
                    }}
                    className={`w-full py-2.5 rounded-full font-bold text-[9px] tracking-wider uppercase transition-colors outline-none border cursor-pointer ${
                      theme === 'dark'
                        ? 'border-white/10 hover:bg-white/5 text-white/60 hover:text-white'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Return to Login
                  </button>
                </form>
              ) : (
                /* MAIN LOGIN FORM */
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {/* Username Input */}
                  <div className="space-y-1.5">
                    <label className={`text-[10.5px] font-bold uppercase tracking-[0.16em] block mb-2 pl-0.5 transition-colors ${
                      theme === 'dark' ? 'text-[#d6b36a]/85' : 'text-slate-600/90'
                    }`}>
                      Admin Username
                    </label>
                    <div className="relative">
                      <User className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${
                        theme === 'dark' ? 'text-white/40' : 'text-slate-400'
                      }`} />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. admin"
                        disabled={loginLoading}
                        className={`w-full pl-11 pr-4 py-3 rounded-2xl text-xs font-bold transition-all duration-300 outline-none border ${
                          theme === 'dark'
                            ? 'bg-white/[0.03] border-white/10 text-white placeholder-white/25 focus:border-[#ff6b00] focus:bg-white/[0.06] focus:ring-1 focus:ring-[#ff6b00]/30'
                            : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#ff6b00] focus:bg-white focus:ring-1 focus:ring-[#ff6b00]/25'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1.5">
                    <label className={`text-[10.5px] font-bold uppercase tracking-[0.16em] block mb-2 pl-0.5 transition-colors ${
                      theme === 'dark' ? 'text-[#d6b36a]/85' : 'text-slate-600/90'
                    }`}>
                      Security Password
                    </label>
                    <div className="relative">
                      <Lock className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${
                        theme === 'dark' ? 'text-white/40' : 'text-slate-400'
                      }`} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={loginLoading}
                        className={`w-full pl-11 pr-12 py-3 rounded-2xl text-xs font-bold transition-all duration-300 outline-none border ${
                          theme === 'dark'
                            ? 'bg-white/[0.03] border-white/10 text-white placeholder-white/25 focus:border-[#ff6b00] focus:bg-white/[0.06] focus:ring-1 focus:ring-[#ff6b00]/30'
                            : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#ff6b00] focus:bg-white focus:ring-1 focus:ring-[#ff6b00]/25'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(prev => !prev)}
                        disabled={loginLoading}
                        className={`absolute right-4 top-3.5 transition-colors ${
                          theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Forgot Password trigger */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setForgotPasswordStep('EMAIL');
                          setResetEmail('');
                          setResetOTP('');
                          setResetNewPassword('');
                          setResetConfirmPassword('');
                          setErrorMsg('');
                        }}
                        className={`text-xs font-semibold tracking-wide transition-all duration-300 hover:text-[#ff6b00] hover:drop-shadow-[0_0_8px_rgba(255,107,0,0.45)] outline-none cursor-pointer select-none ${
                          theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>

                  {/* ERROR FEEDBACK */}
                  <AnimatePresence>
                    {errorMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl px-5 py-3 text-xs font-semibold text-center leading-relaxed tracking-wide shadow-inner"
                      >
                        {errorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* RESET PASSWORD SUCCESS FEEDBACK */}
                  <AnimatePresence>
                    {resetSuccessMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl px-5 py-3 text-xs font-semibold text-center leading-relaxed tracking-wide shadow-inner"
                      >
                        {resetSuccessMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* SIGN IN BUTTON */}
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className={`w-full py-3 rounded-full font-extrabold text-[10px] tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 mt-2 cursor-pointer ${
                      loginLoading
                        ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed border-none'
                        : 'bg-gradient-to-r from-[#ff6b00] to-[#ff8524] text-white hover:shadow-[0_4px_20px_rgba(255,107,0,0.35)] shadow-md shadow-orange-500/25'
                    }`}
                  >
                    {loginLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Verifying Authority...</span>
                      </>
                    ) : (
                      <>
                        <span>Unlock System Access</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* SECURE SUBTEXT */}
              <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] text-center mt-6 transition-all duration-300 select-none ${
                theme === 'dark' ? 'text-zinc-500/40 hover:text-[#d6b36a]/60' : 'text-slate-400 hover:text-[#ff6b00]'
              }`}>
                Protected Session • Credentials Required
              </p>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PREMIUM CAPTAIN AUTHENTICATION GLASS LOGIN MODAL */}
      <AnimatePresence>
        {showCaptainLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 backdrop-blur-xl flex items-center justify-center p-4"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(15, 23, 42, 0.45)'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 25 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 25 }}
              transition={{ type: 'spring', damping: 20, stiffness: 150 }}
              className={`w-full max-w-[420px] rounded-[32px] p-6 sm:p-8 relative border transition-all duration-300 ${
                theme === 'dark'
                  ? 'bg-black/80 border-white/20 shadow-[0_25px_80px_rgba(0,0,0,0.65)] text-white'
                  : 'bg-white/95 border-slate-200 shadow-2xl text-slate-800'
              }`}
            >
              
              {/* Close button */}
              <button
                onClick={() => {
                  if (showCaptainForgotPassword) {
                    setShowCaptainForgotPassword(false);
                    setCaptainErrorMsg('');
                  } else {
                    setShowCaptainLoginModal(false);
                    setCaptainErrorMsg('');
                    setCaptainEmail('');
                    setCaptainPassword('');
                  }
                }}
                className={`absolute top-5 left-5 p-1.5 rounded-full border transition-all duration-200 hover:scale-105 active:scale-95 ${
                  theme === 'dark'
                    ? 'border-white/10 hover:bg-white/10 text-white/70 hover:text-white'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* BRANDING INSIDE MODAL */}
              {!showCaptainForgotPassword ? (
                <div className="flex flex-col items-center mt-4 mb-6">
                  <div className="w-9 h-9 bg-gradient-to-br from-[#4f46e5] to-[#6366f1] rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/25 border border-white/15 mb-2.5">
                    <ChefHat className="text-white w-4.5 h-4.5" />
                  </div>
                  <h2 className={`text-2xl font-light tracking-[0.16em] font-serif ${
                    theme === 'dark' ? 'text-white' : 'text-slate-800'
                  }`}>
                    CAPTAIN GATEWAY
                  </h2>
                  <div className="flex items-center justify-center gap-2 my-1.5 opacity-55">
                    <span className="text-indigo-500 text-[6px] tracking-normal font-black">✦</span>
                  </div>
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.24em] text-indigo-500/95 text-center mt-1 select-none">
                    Handheld POS Panel Login
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center mt-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="w-9 h-9 bg-gradient-to-br from-[#4f46e5] to-[#6366f1] rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/25 border border-white/15 mb-2.5">
                    <ShieldCheck className="text-white w-4.5 h-4.5 animate-pulse" />
                  </div>
                  <h2 className={`text-2xl font-light tracking-[0.16em] font-serif ${
                    theme === 'dark' ? 'text-white' : 'text-slate-800'
                  }`}>
                    PASSWORD RESET
                  </h2>
                  <div className="flex items-center justify-center gap-2 my-1.5 opacity-55">
                    <span className="text-indigo-500 text-[6px] tracking-normal font-black">✦</span>
                  </div>
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.24em] text-indigo-500/95 text-center mt-1 select-none">
                    {captainForgotPasswordStep === 'EMAIL' ? 'Enter Captain Email' : captainForgotPasswordStep === 'OTP' ? 'OTP Verification' : 'Set New Password'}
                  </p>
                </div>
              )}

              {/* DYNAMIC FORM VIEWS */}
              {!showCaptainForgotPassword ? (
                <form onSubmit={handleCaptainLoginSubmit} className="space-y-4">
                  {/* Email Input */}
                  <div className="space-y-1.5">
                    <label className={`text-[10.5px] font-bold uppercase tracking-[0.16em] block mb-2 pl-0.5 transition-colors ${
                      theme === 'dark' ? 'text-indigo-400/85' : 'text-slate-600/90'
                    }`}>
                      Captain Email
                    </label>
                    <div className="relative">
                      <Mail className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${
                        theme === 'dark' ? 'text-white/40' : 'text-slate-400'
                      }`} />
                      <input
                        type="email"
                        value={captainEmail}
                        onChange={(e) => setCaptainEmail(e.target.value)}
                        placeholder="e.g. captain@hotel.com"
                        disabled={captainLoginLoading}
                        className={`w-full pl-11 pr-4 py-3 rounded-2xl text-xs font-bold transition-all duration-300 outline-none border ${
                          theme === 'dark'
                            ? 'bg-white/[0.03] border-white/10 text-white placeholder-white/25 focus:border-[#4f46e5] focus:bg-white/[0.06] focus:ring-1 focus:ring-[#4f46e5]/30'
                            : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-1 focus:ring-[#4f46e5]/25'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1.5">
                    <label className={`text-[10.5px] font-bold uppercase tracking-[0.16em] block mb-2 pl-0.5 transition-colors ${
                      theme === 'dark' ? 'text-indigo-400/85' : 'text-slate-600/90'
                    }`}>
                      Password
                    </label>
                    <div className="relative">
                      <Lock className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${
                        theme === 'dark' ? 'text-white/40' : 'text-slate-400'
                      }`} />
                      <input
                        type={showCaptainPassword ? 'text' : 'password'}
                        value={captainPassword}
                        onChange={(e) => setCaptainPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={captainLoginLoading}
                        className={`w-full pl-11 pr-12 py-3 rounded-2xl text-xs font-bold transition-all duration-300 outline-none border ${
                          theme === 'dark'
                            ? 'bg-white/[0.03] border-white/10 text-white placeholder-white/25 focus:border-[#4f46e5] focus:bg-white/[0.06] focus:ring-1 focus:ring-[#4f46e5]/30'
                            : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-1 focus:ring-[#4f46e5]/25'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCaptainPassword(prev => !prev)}
                        disabled={captainLoginLoading}
                        className={`absolute right-4 top-3.5 transition-colors ${
                          theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {showCaptainPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Forgot Password trigger */}
                  <div className="flex justify-end px-1 text-[10.5px]">
                    <button
                      type="button"
                      disabled={captainLoginLoading}
                      onClick={() => {
                        setShowCaptainForgotPassword(true);
                        setCaptainForgotPasswordStep('EMAIL');
                        setCaptainErrorMsg('');
                      }}
                      className={`font-bold transition-colors ${
                        theme === 'dark' ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Forgot Password?
                    </button>
                  </div>

                  {/* ERROR FEEDBACK */}
                  <AnimatePresence>
                    {captainErrorMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl px-5 py-3 text-xs font-semibold text-center leading-relaxed tracking-wide shadow-inner"
                      >
                        {captainErrorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* RESET PASSWORD SUCCESS FEEDBACK */}
                  <AnimatePresence>
                    {captainResetSuccessMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl px-5 py-3 text-xs font-semibold text-center leading-relaxed tracking-wide shadow-inner"
                      >
                        {captainResetSuccessMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* SIGN IN BUTTON */}
                  <button
                    type="submit"
                    disabled={captainLoginLoading}
                    className={`w-full py-3 rounded-full font-extrabold text-[10px] tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 mt-2 cursor-pointer ${
                      captainLoginLoading
                        ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed border-none'
                        : 'bg-gradient-to-r from-[#4f46e5] to-[#6366f1] text-white hover:shadow-[0_4px_20px_rgba(79,70,229,0.35)] shadow-md shadow-indigo-500/25'
                    }`}
                  >
                    {captainLoginLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Verifying Captain Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Open Handheld Panel</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCaptainForgotPasswordSubmit} className="space-y-4 animate-in fade-in duration-300">
                  {captainForgotPasswordStep === 'EMAIL' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      {/* Reset Email Input */}
                      <div className="space-y-1.5">
                        <label className={`text-[10.5px] font-bold uppercase tracking-[0.16em] block mb-2 pl-0.5 transition-colors ${
                          theme === 'dark' ? 'text-indigo-400/85' : 'text-slate-600/90'
                        }`}>
                          Captain Email
                        </label>
                        <div className="relative">
                          <Mail className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${
                            theme === 'dark' ? 'text-white/40' : 'text-slate-400'
                          }`} />
                          <input
                            type="email"
                            value={captainResetEmail}
                            onChange={(e) => setCaptainResetEmail(e.target.value)}
                            placeholder="e.g. captain@hotel.com"
                            disabled={captainResetLoading}
                            className={`w-full pl-11 pr-4 py-3 rounded-2xl text-xs font-bold transition-all duration-300 outline-none border ${
                              theme === 'dark'
                                ? 'bg-white/[0.03] border-white/10 text-white placeholder-white/25 focus:border-[#4f46e5] focus:bg-white/[0.06] focus:ring-1 focus:ring-[#4f46e5]/30'
                                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-1 focus:ring-[#4f46e5]/25'
                            }`}
                          />
                        </div>
                      </div>

                      {/* ERROR FEEDBACK */}
                      <AnimatePresence>
                        {captainErrorMsg && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl px-5 py-3 text-xs font-semibold text-center leading-relaxed tracking-wide shadow-inner"
                          >
                            {captainErrorMsg}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* SUBMIT BUTTON */}
                      <button
                        type="submit"
                        disabled={captainResetLoading}
                        className={`w-full py-3 rounded-full font-extrabold text-[10px] tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 mt-2 cursor-pointer ${
                          captainResetLoading
                            ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed border-none'
                            : 'bg-gradient-to-r from-[#4f46e5] to-[#6366f1] text-white hover:shadow-[0_4px_20px_rgba(79,70,229,0.35)] shadow-md shadow-indigo-500/25'
                        }`}
                      >
                        {captainResetLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Sending OTP...</span>
                          </>
                        ) : (
                          <>
                            <span>Send OTP</span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {captainForgotPasswordStep === 'OTP' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      {/* OTP Input */}
                      <div className="space-y-1.5">
                        <label className={`text-[10.5px] font-bold uppercase tracking-[0.16em] block mb-2 pl-0.5 transition-colors ${
                          theme === 'dark' ? 'text-indigo-400/85' : 'text-slate-600/90'
                        }`}>
                          6-Digit OTP
                        </label>
                        <div className="relative">
                          <Key className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${
                            theme === 'dark' ? 'text-white/40' : 'text-slate-400'
                          }`} />
                          <input
                            type="text"
                            maxLength={6}
                            value={captainResetOTP}
                            onChange={(e) => setCaptainResetOTP(e.target.value.replace(/\D/g, ''))}
                            placeholder="Enter 6-digit OTP"
                            disabled={captainResetLoading}
                            className={`w-full pl-11 pr-4 py-3 rounded-2xl text-xs font-bold transition-all duration-300 outline-none border ${
                              theme === 'dark'
                                ? 'bg-white/[0.03] border-white/10 text-white placeholder-white/25 focus:border-[#4f46e5] focus:bg-white/[0.06] focus:ring-1 focus:ring-[#4f46e5]/30'
                                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-1 focus:ring-[#4f46e5]/25'
                            }`}
                          />
                        </div>
                      </div>

                      {/* ERROR FEEDBACK */}
                      <AnimatePresence>
                        {captainErrorMsg && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl px-5 py-3 text-xs font-semibold text-center leading-relaxed tracking-wide shadow-inner"
                          >
                            {captainErrorMsg}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* VERIFY BUTTON */}
                      <button
                        type="submit"
                        disabled={captainResetLoading}
                        className={`w-full py-3 rounded-full font-extrabold text-[10px] tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 mt-2 cursor-pointer ${
                          captainResetLoading
                            ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed border-none'
                            : 'bg-gradient-to-r from-[#4f46e5] to-[#6366f1] text-white hover:shadow-[0_4px_20px_rgba(79,70,229,0.35)] shadow-md shadow-indigo-500/25'
                        }`}
                      >
                        {captainResetLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Verifying OTP...</span>
                          </>
                        ) : (
                          <>
                            <span>Verify OTP</span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      {/* Back to Email / Resend Option */}
                      <div className="flex justify-between items-center px-1 text-[10.5px]">
                        <button
                          type="button"
                          disabled={captainResetLoading}
                          onClick={() => {
                            setCaptainForgotPasswordStep('EMAIL');
                            setCaptainErrorMsg('');
                          }}
                          className={`font-bold transition-colors ${
                            theme === 'dark' ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Change Email
                        </button>
                        <button
                          type="button"
                          disabled={captainResetLoading}
                          onClick={async () => {
                            const hotelId = hotelData?.id || localStorage.getItem('mejwani_hotel_id');
                            if (!hotelId) {
                              setCaptainErrorMsg('Hotel context is missing.');
                              return;
                            }
                            setCaptainResetLoading(true);
                            setCaptainErrorMsg('');
                            try {
                              const response = await fetch(`${API_BASE}/captain/forgot-password`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: captainResetEmail, hotelId: Number(hotelId) }),
                              });
                              const data = await response.json();
                              setCaptainResetLoading(false);
                              if (!response.ok || !data.success) {
                                setCaptainErrorMsg(data.message || 'Failed to resend OTP.');
                                return;
                              }
                              setCaptainResetOTP('');
                              setCaptainErrorMsg('New OTP sent successfully!');
                              setTimeout(() => setCaptainErrorMsg(''), 3000);
                            } catch (e) {
                              setCaptainResetLoading(false);
                              setCaptainErrorMsg('Failed to resend OTP.');
                            }
                          }}
                          className="font-extrabold text-[#4f46e5] hover:text-[#6366f1] transition-colors bg-transparent border-none cursor-pointer outline-none"
                        >
                          Resend OTP
                        </button>
                      </div>
                    </div>
                  )}

                  {captainForgotPasswordStep === 'RESET' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      {/* Reset New Password Input */}
                      <div className="space-y-1.5">
                        <label className={`text-[10.5px] font-bold uppercase tracking-[0.16em] block mb-2 pl-0.5 transition-colors ${
                          theme === 'dark' ? 'text-indigo-400/85' : 'text-slate-600/90'
                        }`}>
                          New Password (min 8 chars)
                        </label>
                        <div className="relative">
                          <Lock className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${
                            theme === 'dark' ? 'text-white/40' : 'text-slate-400'
                          }`} />
                          <input
                            type={showCaptainResetNewPassword ? 'text' : 'password'}
                            value={captainResetNewPassword}
                            onChange={(e) => setCaptainResetNewPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={captainResetLoading}
                            className={`w-full pl-11 pr-12 py-3 rounded-2xl text-xs font-bold transition-all duration-300 outline-none border ${
                              theme === 'dark'
                                ? 'bg-white/[0.03] border-white/10 text-white placeholder-white/25 focus:border-[#4f46e5] focus:bg-white/[0.06] focus:ring-1 focus:ring-[#4f46e5]/30'
                                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-1 focus:ring-[#4f46e5]/25'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCaptainResetNewPassword(prev => !prev)}
                            disabled={captainResetLoading}
                            className={`absolute right-4 top-3.5 transition-colors ${
                              theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                            }`}
                          >
                            {showCaptainResetNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Reset Confirm Password Input */}
                      <div className="space-y-1.5">
                        <label className={`text-[10.5px] font-bold uppercase tracking-[0.16em] block mb-2 pl-0.5 transition-colors ${
                          theme === 'dark' ? 'text-indigo-400/85' : 'text-slate-600/90'
                        }`}>
                          Confirm Password
                        </label>
                        <div className="relative">
                          <Lock className={`absolute left-4 top-3.5 w-4 h-4 transition-colors ${
                            theme === 'dark' ? 'text-white/40' : 'text-slate-400'
                          }`} />
                          <input
                            type={showCaptainResetConfirmPassword ? 'text' : 'password'}
                            value={captainResetConfirmPassword}
                            onChange={(e) => setCaptainResetConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={captainResetLoading}
                            className={`w-full pl-11 pr-12 py-3 rounded-2xl text-xs font-bold transition-all duration-300 outline-none border ${
                              theme === 'dark'
                                ? 'bg-white/[0.03] border-white/10 text-white placeholder-white/25 focus:border-[#4f46e5] focus:bg-white/[0.06] focus:ring-1 focus:ring-[#4f46e5]/30'
                                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#4f46e5] focus:bg-white focus:ring-1 focus:ring-[#4f46e5]/25'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCaptainResetConfirmPassword(prev => !prev)}
                            disabled={captainResetLoading}
                            className={`absolute right-4 top-3.5 transition-colors ${
                              theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                            }`}
                          >
                            {showCaptainResetConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* ERROR FEEDBACK */}
                      <AnimatePresence>
                        {captainErrorMsg && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl px-5 py-3 text-xs font-semibold text-center leading-relaxed tracking-wide shadow-inner"
                          >
                            {captainErrorMsg}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* RESET ACTION BUTTON */}
                      <button
                        type="submit"
                        disabled={captainResetLoading}
                        className={`w-full py-3 rounded-full font-extrabold text-[10px] tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 active:scale-98 mt-2 cursor-pointer ${
                          captainResetLoading
                            ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed border-none'
                            : 'bg-gradient-to-r from-[#4f46e5] to-[#6366f1] text-white hover:shadow-[0_4px_20px_rgba(79,70,229,0.35)] shadow-md shadow-indigo-500/25'
                        }`}
                      >
                        {captainResetLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Resetting Credentials...</span>
                          </>
                        ) : (
                          <>
                            <span>Reset Security Password</span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* RETURN TO LOGIN BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowCaptainForgotPassword(false);
                      setCaptainForgotPasswordStep('EMAIL');
                      setCaptainResetEmail('');
                      setCaptainResetOTP('');
                      setCaptainResetNewPassword('');
                      setCaptainResetConfirmPassword('');
                      setCaptainErrorMsg('');
                    }}
                    className={`w-full py-2.5 rounded-full font-bold text-[9px] tracking-wider uppercase transition-colors outline-none border cursor-pointer ${
                      theme === 'dark'
                        ? 'border-white/10 hover:bg-white/5 text-white/60 hover:text-white'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Back to Captain Login
                  </button>
                </form>
              )}

              {/* SECURE SUBTEXT */}
              <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] text-center mt-6 transition-all duration-300 select-none ${
                theme === 'dark' ? 'text-zinc-500/40 hover:text-indigo-400/60' : 'text-slate-400 hover:text-[#4f46e5]'
              }`}>
                Protected Session • Credentials Required
              </p>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}