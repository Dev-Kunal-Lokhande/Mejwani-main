import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Mail, ShieldCheck, KeyRound, User, Eye, EyeOff,
  ArrowLeft, CheckCircle, RefreshCw, AlertCircle, Loader2
} from 'lucide-react';
import { API_BASE } from '../../../shared/services/apiBase';

const STEP = {
  CHOOSE: 'choose',
  OTP_SENT: 'otp_sent',
  VERIFIED: 'verified',
  SUCCESS: 'success',
};

const OTP_EXPIRY_SECONDS = 600; // 10 minutes

function useCountdown(startSeconds, running) {
  const [seconds, setSeconds] = useState(startSeconds);
  useEffect(() => {
    if (!running) return;
    setSeconds(startSeconds);
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [running, startSeconds]);
  return seconds;
}

export default function SuperAdminForgotModal({ onClose }) {
  const [step, setStep] = useState(STEP.CHOOSE);
  const [otpType, setOtpType] = useState('password_reset'); // 'password_reset' | 'username_recovery'
  const [otpCode, setOtpCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdownActive, setCountdownActive] = useState(false);
  const timeLeft = useCountdown(OTP_EXPIRY_SECONDS, countdownActive);

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const clearError = () => setError('');

  const handleRequestOtp = useCallback(async () => {
    setLoading(true);
    clearError();
    try {
      const res = await fetch(`${API_BASE}/super-admin/forgot/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_type: otpType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to send OTP');
      setMaskedEmail(data.masked_email || '');
      setStep(STEP.OTP_SENT);
      setCountdownActive(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [otpType]);

  const handleVerifyOtp = async () => {
    if (otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }
    setLoading(true);
    clearError();
    try {
      const res = await fetch(`${API_BASE}/super-admin/forgot/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_code: otpCode.trim(), otp_type: otpType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'OTP verification failed');
      setOtpToken(data.otp_token);
      setCountdownActive(false);
      setStep(STEP.VERIFIED);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    clearError();
    try {
      const res = await fetch(`${API_BASE}/super-admin/forgot/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_token: otpToken, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Password reset failed');
      setStep(STEP.SUCCESS);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetUsername = async () => {
    if (newUsername.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
    setLoading(true);
    clearError();
    try {
      const res = await fetch(`${API_BASE}/super-admin/forgot/reset-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_token: otpToken, new_username: newUsername.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Username update failed');
      setStep(STEP.SUCCESS);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden"
      >
        {/* Decorative gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {step !== STEP.CHOOSE && step !== STEP.SUCCESS && (
                <button
                  onClick={() => { setStep(step === STEP.VERIFIED ? STEP.OTP_SENT : STEP.CHOOSE); clearError(); }}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-4 h-4 text-white/60" />
                </button>
              )}
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">
                  {step === STEP.CHOOSE && 'Account Recovery'}
                  {step === STEP.OTP_SENT && 'Enter OTP'}
                  {step === STEP.VERIFIED && (otpType === 'password_reset' ? 'New Password' : 'New Username')}
                  {step === STEP.SUCCESS && 'Done!'}
                </h2>
                <p className="text-white/40 text-xs mt-0.5">
                  Super Admin credential recovery
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {/* ── STEP: CHOOSE ── */}
            {step === STEP.CHOOSE && (
              <motion.div key="choose" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-white/55 text-sm mb-5">
                  Select what you'd like to recover. An OTP will be sent to your registered recovery email.
                </p>

                <div className="space-y-3 mb-6">
                  {[
                    { value: 'password_reset', icon: KeyRound, label: 'Forgot Password', desc: 'Reset your Super Admin password' },
                    { value: 'username_recovery', icon: User, label: 'Forgot Username', desc: 'Recover your Super Admin username' },
                  ].map(({ value, icon: Icon, label, desc }) => (
                    <button
                      key={value}
                      onClick={() => { setOtpType(value); clearError(); }}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left
                        ${otpType === value
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                        ${otpType === value ? 'bg-orange-500/20' : 'bg-white/5'}`}>
                        <Icon className={`w-5 h-5 ${otpType === value ? 'text-orange-400' : 'text-white/40'}`} />
                      </div>
                      <div>
                        <div className={`font-semibold text-sm ${otpType === value ? 'text-orange-300' : 'text-white/80'}`}>{label}</div>
                        <div className="text-white/40 text-xs mt-0.5">{desc}</div>
                      </div>
                      {otpType === value && (
                        <div className="ml-auto w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {error && <ErrorBox message={error} />}

                <button
                  onClick={handleRequestOtp}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-60 font-bold text-white transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {loading ? 'Sending OTP…' : 'Send OTP to Recovery Email'}
                </button>
              </motion.div>
            )}

            {/* ── STEP: OTP SENT ── */}
            {step === STEP.OTP_SENT && (
              <motion.div key="otp_sent" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex flex-col items-center mb-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center mb-3">
                    <Mail className="w-7 h-7 text-orange-400" />
                  </div>
                  <p className="text-white/70 text-sm">
                    OTP sent to <span className="text-white font-semibold">{maskedEmail}</span>
                  </p>
                  <div className={`mt-2 font-mono text-lg font-bold ${timeLeft < 60 ? 'text-red-400' : 'text-orange-400'}`}>
                    {formatTime(timeLeft)}
                  </div>
                  <p className="text-white/35 text-xs mt-0.5">remaining</p>
                </div>

                <div className="mb-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2 block">6-Digit OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); clearError(); }}
                    className="w-full text-center text-3xl font-black tracking-[0.5em] rounded-xl bg-white/5 border border-white/10 focus:border-orange-400 outline-none py-4 text-white placeholder:text-white/20"
                    placeholder="••••••"
                    autoFocus
                  />
                </div>

                {error && <ErrorBox message={error} />}

                <button
                  onClick={handleVerifyOtp}
                  disabled={loading || otpCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 font-bold text-white transition-colors mb-3"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  {loading ? 'Verifying…' : 'Verify OTP'}
                </button>

                {timeLeft === 0 ? (
                  <button
                    onClick={handleRequestOtp}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-white/60 hover:text-white text-sm transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Resend OTP
                  </button>
                ) : (
                  <p className="text-center text-white/30 text-xs">
                    Didn't receive it? You can resend after the timer expires.
                  </p>
                )}
              </motion.div>
            )}

            {/* ── STEP: VERIFIED — Update Credential ── */}
            {step === STEP.VERIFIED && (
              <motion.div key="verified" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-emerald-300 text-sm font-medium">Identity verified. Set your new {otpType === 'password_reset' ? 'password' : 'username'} below.</span>
                </div>

                {otpType === 'password_reset' ? (
                  <div className="space-y-4 mb-5">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2 block">New Password</label>
                      <div className="relative">
                        <KeyRound className="absolute left-4 top-3.5 w-4 h-4 text-white/30" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => { setNewPassword(e.target.value); clearError(); }}
                          className="w-full rounded-xl bg-white/5 border border-white/10 focus:border-orange-400 outline-none pl-11 pr-12 py-3 text-white"
                          placeholder="Min. 6 characters"
                        />
                        <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-3.5 text-white/40 hover:text-white/70">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2 block">Confirm Password</label>
                      <div className="relative">
                        <KeyRound className="absolute left-4 top-3.5 w-4 h-4 text-white/30" />
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => { setConfirmPassword(e.target.value); clearError(); }}
                          className="w-full rounded-xl bg-white/5 border border-white/10 focus:border-orange-400 outline-none pl-11 pr-12 py-3 text-white"
                          placeholder="Re-enter password"
                        />
                        <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-3.5 text-white/40 hover:text-white/70">
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-red-400 text-xs">Passwords do not match.</p>
                    )}
                  </div>
                ) : (
                  <div className="mb-5">
                    <label className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2 block">New Username</label>
                    <div className="relative">
                      <User className="absolute left-4 top-3.5 w-4 h-4 text-white/30" />
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => { setNewUsername(e.target.value.toLowerCase()); clearError(); }}
                        className="w-full rounded-xl bg-white/5 border border-white/10 focus:border-orange-400 outline-none pl-11 pr-4 py-3 text-white"
                        placeholder="Min. 3 characters"
                        autoFocus
                      />
                    </div>
                  </div>
                )}

                {error && <ErrorBox message={error} />}

                <button
                  onClick={otpType === 'password_reset' ? handleResetPassword : handleResetUsername}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-60 font-bold text-white transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {loading ? 'Saving…' : `Update ${otpType === 'password_reset' ? 'Password' : 'Username'}`}
                </button>
              </motion.div>
            )}

            {/* ── STEP: SUCCESS ── */}
            {step === STEP.SUCCESS && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-white font-black text-xl mb-2">
                  {otpType === 'password_reset' ? 'Password Updated!' : 'Username Updated!'}
                </h3>
                <p className="text-white/50 text-sm mb-6">
                  Your Super Admin {otpType === 'password_reset' ? 'password has been changed' : 'username has been updated'}.
                  Please log in with your new credentials.
                </p>
                <button
                  onClick={onClose}
                  className="px-8 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 font-bold text-white transition-colors"
                >
                  Back to Login
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
      <span className="text-red-300 text-sm">{message}</span>
    </div>
  );
}
