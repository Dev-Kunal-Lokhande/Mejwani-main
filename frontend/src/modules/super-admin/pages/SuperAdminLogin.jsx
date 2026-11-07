import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Lock, ShieldCheck, Utensils, User, HelpCircle } from 'lucide-react';
import { setSuperAdminSession } from '../services/superAdminApi';
import { API_BASE } from '../../../shared/services/apiBase';
import SuperAdminForgotModal from '../components/SuperAdminForgotModal';

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/super-admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
  email: username,
  password: password
}),
      });
      const data = await response.json();

      if (!response.ok || !data.token) {
  throw new Error(data.message || 'Invalid email or password');
}

setSuperAdminSession(data.token, data.admin);
      navigate('/super-admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,107,0,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.16),transparent_32%)]" />
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-md border border-white/10 bg-white/[0.06] backdrop-blur-2xl rounded-2xl p-6 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Mejwani</h1>
              <p className="text-xs uppercase tracking-[0.22em] text-orange-200 font-bold">Super Admin</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-white/60">Username</label>
              <div className="mt-2 relative">
                <User className="absolute left-4 top-3.5 w-4 h-4 text-white/40" />
                <input
                  id="super-admin-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-xl bg-white/10 border border-white/10 pl-11 pr-4 py-3 outline-none focus:border-orange-400"
                  placeholder="Enter username"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-white/60">Password</label>
              <div className="mt-2 relative">
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-white/40" />
                <input
                  id="super-admin-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  className="w-full rounded-xl bg-white/10 border border-white/10 pl-11 pr-12 py-3 outline-none focus:border-orange-400"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-3.5 text-white/50 hover:text-white"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <button
              id="super-admin-login-btn"
              disabled={loading}
              className="w-full rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-60 py-3 font-black uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {loading ? 'Verifying…' : 'Unlock Control Center'}
            </button>
          </form>

          {/* Forgot credentials link */}
          <div className="mt-5 text-center">
            <button
              id="super-admin-forgot-btn"
              onClick={() => setShowForgot(true)}
              className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-orange-300 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Forgot username or password?
            </button>
          </div>
        </motion.section>
      </main>

      <AnimatePresence>
        {showForgot && <SuperAdminForgotModal onClose={() => setShowForgot(false)} />}
      </AnimatePresence>
    </>
  );
}
