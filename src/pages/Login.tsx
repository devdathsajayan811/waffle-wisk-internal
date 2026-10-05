import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('admin');
  const [password, setPassword] = useState('admin123');
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

  const handleQuickFill = (role: 'admin' | 'staff') => {
    if (role === 'admin') {
      setIdentifier('admin');
      setPassword('admin123');
    } else {
      setIdentifier('staff');
      setPassword('staff123');
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
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Subtle Waffle Decorative Circles */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-waffle-200/40 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-choco-200/30 rounded-full blur-3xl" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-soft-lg border border-cream-200/80 p-8 sm:p-10 relative z-10 backdrop-blur-sm">
        {/* Brand Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-waffle-500 via-waffle-400 to-amber-300 items-center justify-center text-4xl shadow-waffle transform hover:scale-105 transition-transform">
            🧇
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-choco-900 font-sans tracking-tight">Waffle Wisk Portal</h1>
            <p className="text-xs text-choco-500 font-medium">Cart Management & POS System</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-2xl flex items-center space-x-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-choco-800 uppercase tracking-wider mb-1.5">
              Username or Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-choco-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400 focus:border-waffle-400 transition-all text-choco-900 bg-cream-50/30"
                placeholder="Enter admin or staff email"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-choco-800 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-choco-400 absolute left-3.5 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 text-sm rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400 focus:border-waffle-400 transition-all text-choco-900 bg-cream-50/30"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-choco-400 hover:text-choco-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center text-choco-700 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded-md text-waffle-500 focus:ring-waffle-400 border-cream-300 mr-2"
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => {
                setForgotModal(true);
                setForgotMsg(null);
              }}
              className="font-semibold text-waffle-600 hover:text-waffle-700 underline"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-waffle-500 to-waffle-600 hover:from-waffle-600 hover:to-waffle-700 text-white font-bold text-sm rounded-xl shadow-waffle hover:shadow-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Authenticating...</span>
              </span>
            ) : (
              <span>Sign In to Waffle Cart</span>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials Assistant */}
        <div className="mt-8 pt-6 border-t border-cream-200 text-center">
          <p className="text-[11px] font-semibold text-choco-500 uppercase tracking-wider mb-2 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-waffle-500" /> Quick Demo Accounts
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickFill('admin')}
              className="p-2 bg-cream-100 hover:bg-cream-200 text-choco-800 rounded-xl font-medium border border-cream-300 transition-colors text-left"
            >
              <span className="block font-bold text-waffle-600 text-[11px]">ADMIN</span>
              <span className="text-[10px] text-choco-500">admin / admin123</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('staff')}
              className="p-2 bg-cream-100 hover:bg-cream-200 text-choco-800 rounded-xl font-medium border border-cream-300 transition-colors text-left"
            >
              <span className="block font-bold text-emerald-600 text-[11px]">STAFF</span>
              <span className="text-[10px] text-choco-500">staff / staff123</span>
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-choco-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-choco-900">Forgot Password</h3>
            <p className="text-xs text-choco-600">Enter your registered email address to receive password instructions.</p>

            {forgotMsg && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl font-medium">
                {forgotMsg}
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-3">
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="name@wafflewisk.com"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
              />
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setForgotModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-choco-600 bg-cream-200 rounded-xl"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-waffle-500 hover:bg-waffle-600 rounded-xl"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
