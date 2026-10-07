import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { Alert } from '../components/ui';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotModal, setForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier || !password) {
      setError('Please enter your username/email and password.');
      return;
    }

    setLoading(true);

    try {
      const data = await api.login(identifier, password);
      login(data.token, data.user, data.settings);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid username/email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    try {
      const res = await api.forgotPassword(forgotEmail);
      setForgotMsg(res.message);
    } catch (err: any) {
      setForgotMsg(err.message || 'Reset request failed');
    }
  };

  return (
    <div className="grid min-h-dvh bg-cream-50 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-choco-800 text-cream-50 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="pointer-events-none absolute inset-0 waffle-grid opacity-70" />
        <div className="pointer-events-none absolute -left-32 top-1/3 h-[28rem] w-[28rem] rounded-full bg-waffle-500/20 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-waffle-300/10 blur-[90px]" />
        <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.05] mix-blend-overlay" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-waffle-300 to-waffle-500 text-2xl shadow-waffle ring-1 ring-inset ring-white/20">
            🧇
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">Waffle Wisk</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">
            Every cart, every order, <span className="text-waffle-300">one counter.</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-cream-300/80">
            Take orders on several carts at once, print receipts, and keep an eye on stock before the batter runs out.
          </p>
        </div>

        <div className="relative flex items-center gap-6 text-xs text-cream-400/70">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Works offline
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-waffle-400" /> GST-ready receipts
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-cream-300" /> Multi-cart
          </span>
        </div>
      </aside>

      {/* Form */}
      <main className="relative flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-app lg:hidden" />
        <div className="relative w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-waffle-300 to-waffle-500 text-2xl shadow-waffle">
              🧇
            </div>
            <span className="font-display text-lg font-semibold tracking-tight text-choco-900">Waffle Wisk</span>
          </div>

          <h1 className="font-display text-3xl font-semibold tracking-tight text-choco-900">Welcome back</h1>
          <p className="mt-1.5 text-sm text-choco-400">Sign in to open your carts.</p>

          {error && (
            <div className="mt-6 animate-shake">
              <Alert tone="error">{error}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="label" htmlFor="login-identifier">Username or email</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-choco-300" />
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="input py-3 pl-10"
                  placeholder="you@wafflewisk.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="login-password">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotModal(true);
                    setForgotMsg(null);
                  }}
                  className="mb-1.5 text-xs font-medium text-waffle-600 hover:text-waffle-700"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-choco-300" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input py-3 pl-10 pr-11"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-choco-300 transition-colors hover:bg-cream-100 hover:text-choco-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-choco-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="checkbox"
              />
              Keep me signed in
            </label>

            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-xs text-choco-300">Staff accounts are created by the owner.</p>
        </div>
      </main>

      <Modal
        isOpen={forgotModal}
        onClose={() => setForgotModal(false)}
        title="Reset your password"
        description="Enter the email on your account and we'll send instructions."
        maxWidth="sm"
      >
        <form onSubmit={handleForgotPassword} className="space-y-4">
          {forgotMsg && <Alert tone="warning">{forgotMsg}</Alert>}
          <div>
            <label className="label" htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              required
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="you@wafflewisk.com"
              className="input"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setForgotModal(false)} className="btn-secondary">
              Close
            </button>
            <button type="submit" className="btn-primary">
              Send instructions
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
