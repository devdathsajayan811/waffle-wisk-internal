import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  IndianRupee,
  PackageCheck,
  Plus,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Cart, MaterialRequest } from '../types';
import { Alert, EmptyState, SkeletonCards, StatCard, formatMoney } from '../components/ui';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [activeCarts, setActiveCarts] = useState<Cart[]>([]);
  const [completedCartsCount, setCompletedCartsCount] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<MaterialRequest[]>([]);
  const [creatingCart, setCreatingCart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const stats = await api.getCartStatsToday();
      setCompletedCartsCount(stats.completedCarts);
      setTodayTotal(stats.todayTotal);

      const activeData = await api.getCarts({ status: 'ACTIVE' });
      setActiveCarts(activeData);

      const requestsData = await api.getMaterialRequests();
      setPendingRequests(requestsData.filter((r) => r.status === 'Pending'));
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [isAdmin]);

  const handleCreateNewCart = async () => {
    setCreatingCart(true);
    setError(null);
    try {
      const newCart = await api.createCart();
      navigate(`/pos?cartId=${newCart.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create new cart');
    } finally {
      setCreatingCart(false);
    }
  };

  const firstName = user?.name?.split(' ')[0] ?? '';
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const avgTicket = completedCartsCount > 0 ? Math.round(todayTotal / completedCartsCount) : 0;

  return (
    <div className="page">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-choco-800 px-6 py-7 text-cream-50 shadow-soft-lg sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute inset-0 waffle-grid opacity-60 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-waffle-500/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.05] mix-blend-overlay" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium text-waffle-300">{todayLabel}</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-2 max-w-md text-sm text-cream-300/80">
              {activeCarts.length > 0
                ? `${activeCarts.length} cart${activeCarts.length === 1 ? ' is' : 's are'} open right now. Pick one up or start a fresh order.`
                : 'No carts are open. Start a new order when the next customer arrives.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate('/pos')} className="btn border border-white/10 bg-white/5 text-cream-100 hover:bg-white/10">
              Open POS
            </button>
            <button onClick={handleCreateNewCart} disabled={creatingCart} className="btn-primary btn-lg">
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              {creatingCart ? 'Creating…' : 'New cart'}
            </button>
          </div>
        </div>
      </section>

      {error && <Alert tone="error">{error}</Alert>}

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Today's revenue" value={formatMoney(todayTotal)} icon={IndianRupee} tone="emerald" loading={loading} hint="Completed carts only" />
        <StatCard label="Completed carts" value={completedCartsCount} icon={CheckCircle2} tone="choco" loading={loading} hint={avgTicket ? `Avg ticket ${formatMoney(avgTicket)}` : 'No sales yet today'} />
        <StatCard label="Active carts" value={activeCarts.length} icon={ShoppingCart} tone="waffle" loading={loading} hint="Currently open" />
        <StatCard label="Pending requests" value={pendingRequests.length} icon={PackageCheck} tone={pendingRequests.length > 0 ? 'amber' : 'choco'} loading={loading} hint="Raw material requests" />
      </section>

      {/* Content */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Active carts */}
        <div className="card xl:col-span-2">
          <div className="card-header">
            <div>
              <h2 className="card-title">Active carts</h2>
              <p className="card-subtitle">Open any cart to add items or check out.</p>
            </div>
            <button onClick={handleCreateNewCart} disabled={creatingCart} className="btn-soft btn-sm self-start sm:self-auto">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              New cart
            </button>
          </div>

          <div className="card-body">
            {loading ? (
              <SkeletonCards count={4} className="grid grid-cols-1 gap-3 sm:grid-cols-2" itemClassName="h-32" />
            ) : activeCarts.length === 0 ? (
              <EmptyState
                compact
                icon={ShoppingCart}
                title="No carts in progress"
                description="Every open order shows up here so staff can work on several at once."
                action={
                  <button onClick={handleCreateNewCart} className="btn-primary">
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    Start first cart
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {activeCarts.map((cart) => (
                  <button
                    key={cart.id}
                    onClick={() => navigate(`/pos?cartId=${cart.id}`)}
                    className="group flex flex-col rounded-xl border border-cream-200 bg-cream-50/60 p-4 text-left transition-all duration-200 hover:border-waffle-300 hover:bg-white hover:shadow-card"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-[0.9375rem] font-semibold text-choco-900">{cart.cart_number}</span>
                      <span className="badge-waffle">
                        <span className="dot animate-pulse" />
                        Active
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-choco-400">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3.5 w-3.5" />
                        {cart.staff_name}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-cream-400" />
                      <span>
                        {cart.itemCount || 0} item{cart.itemCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="mt-4 flex items-end justify-between border-t border-cream-200 pt-3">
                      <div>
                        <p className="text-2xs text-choco-400">Running total</p>
                        <p className="font-display text-lg font-semibold tabular-nums text-choco-900">{formatMoney(cart.total)}</p>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-semibold text-waffle-600 transition-transform group-hover:translate-x-0.5">
                        Open <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending requests */}
        <div className="card flex flex-col">
          <div className="card-header !flex-row !items-center">
            <div>
              <h2 className="card-title">Pending requests</h2>
              <p className="card-subtitle">Raw materials awaiting approval</p>
            </div>
            <button onClick={() => navigate('/material-requests')} className="btn-ghost btn-sm">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 p-2">
            {loading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-14 rounded-xl" />
                ))}
              </div>
            ) : pendingRequests.length === 0 ? (
              <EmptyState compact icon={PackageCheck} title="All caught up" description="No material requests are waiting." />
            ) : (
              <ul className="divide-y divide-cream-200/70">
                {pendingRequests.slice(0, 6).map((req) => (
                  <li key={req.id} className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-cream-50">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200/70">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-choco-900">{req.material}</p>
                      <p className="truncate text-xs text-choco-400">
                        {req.staff_name}
                        {req.cart_number ? ` · ${req.cart_number}` : ''}
                      </p>
                    </div>
                    <span className="badge-neutral tabular-nums">
                      {req.quantity} {req.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
