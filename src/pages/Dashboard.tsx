import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Receipt,
  IndianRupee,
  PackageCheck,
  PlusCircle,
  Clock,
  ArrowRight,
  PlayCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Cart, MaterialRequest } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [activeCarts, setActiveCarts] = useState<Cart[]>([]);
  const [completedCartsCount, setCompletedCartsCount] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<MaterialRequest[]>([]);
  const [creatingCart, setCreatingCart] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch Today's Cart Stats
      const stats = await api.getCartStatsToday();
      setCompletedCartsCount(stats.completedCarts);
      setTodayTotal(stats.todayTotal);

      // Fetch Active Carts
      const activeData = await api.getCarts({ status: 'ACTIVE' });
      setActiveCarts(activeData);

      // Fetch Material Requests
      const requestsData = await api.getMaterialRequests();
      const pending = requestsData.filter((r) => r.status === 'Pending');
      setPendingRequests(pending);
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
    try {
      const newCart = await api.createCart();
      navigate(`/pos?cartId=${newCart.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to create new cart');
    } finally {
      setCreatingCart(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome Banner & Create New Cart Button */}
      <div className="bg-gradient-to-r from-choco-800 to-choco-900 rounded-3xl p-6 text-white shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-3 py-1 bg-waffle-500/20 text-waffle-300 text-xs font-black tracking-wider rounded-full uppercase border border-waffle-500/30">
            {isAdmin ? 'Owner Dashboard' : 'Staff Dashboard'}
          </span>
          <h1 className="text-2xl font-black mt-2 font-sans tracking-tight">
            Welcome back, {user?.name}! 👋
          </h1>
          <p className="text-xs text-cream-200 mt-1">
            Waffle Wisk Multi-Cart Order Management
          </p>
        </div>

        <div>
          <button
            onClick={handleCreateNewCart}
            disabled={creatingCart}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-waffle-500 to-waffle-600 hover:from-waffle-600 hover:to-waffle-700 text-white font-extrabold text-sm rounded-2xl shadow-waffle hover:shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <PlusCircle className="w-5 h-5" />
            <span>{creatingCart ? 'Creating...' : '+ CREATE NEW CART'}</span>
          </button>
        </div>
      </div>

      {/* DASHBOARD STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Today's Active Carts */}
        <div className="bg-white p-6 rounded-3xl border border-cream-300 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold text-choco-500 uppercase tracking-wider">Active Carts</p>
            <h3 className="text-3xl font-black text-waffle-600 mt-1">
              {loading ? '...' : activeCarts.length}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-waffle-100 text-waffle-600 flex items-center justify-center text-xl font-bold">
            <ShoppingCart className="w-6 h-6 text-waffle-600" />
          </div>
        </div>

        {/* Today's Completed Carts */}
        <div className="bg-white p-6 rounded-3xl border border-cream-300 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold text-choco-500 uppercase tracking-wider">Completed Carts</p>
            <h3 className="text-3xl font-black text-choco-900 mt-1">
              {loading ? '...' : completedCartsCount}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cream-200 text-choco-700 flex items-center justify-center text-xl font-bold">
            <CheckCircle2 className="w-6 h-6 text-choco-700" />
          </div>
        </div>

        {/* Today's Total */}
        <div className="bg-white p-6 rounded-3xl border border-cream-300 shadow-soft flex items-center justify-between">
          <div>
            <p className="text-xs font-extrabold text-choco-500 uppercase tracking-wider">Today's Total</p>
            <h3 className="text-3xl font-black text-emerald-600 mt-1">
              ₹{loading ? '...' : todayTotal.toLocaleString('en-IN')}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl font-bold">
            <IndianRupee className="w-6 h-6 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* ACTIVE CARTS SECTION (SIMULTANEOUS MULTI-CART MANAGER) */}
      <div className="bg-white rounded-3xl p-6 border border-cream-300 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-choco-900">Active Carts ({activeCarts.length})</h2>
            <p className="text-xs text-choco-500 font-medium">
              Click OPEN to edit, add items, or complete any active cart independently.
            </p>
          </div>
          <button
            onClick={handleCreateNewCart}
            disabled={creatingCart}
            className="px-4 py-2 bg-waffle-50 hover:bg-waffle-100 text-waffle-800 font-extrabold text-xs rounded-xl border border-waffle-300 transition-colors flex items-center space-x-1"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Cart</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs font-bold text-choco-500">
            Loading active carts...
          </div>
        ) : activeCarts.length === 0 ? (
          <div className="py-12 text-center text-xs text-choco-500 font-medium space-y-3">
            <p>No active carts currently in progress.</p>
            <button
              onClick={handleCreateNewCart}
              className="py-2.5 px-5 bg-waffle-500 hover:bg-waffle-600 text-white font-extrabold text-xs rounded-xl shadow-waffle inline-flex items-center space-x-1"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Create First Cart</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCarts.map((cart) => (
              <div
                key={cart.id}
                className="p-5 rounded-2xl bg-cream-50/70 border border-cream-300 hover:border-waffle-400 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-choco-900 text-base">
                    {cart.cart_number}
                  </span>
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-800 rounded-md uppercase">
                    ACTIVE
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="text-choco-600">
                    <strong className="text-choco-800">Staff:</strong> {cart.staff_name}
                  </p>
                  <p className="text-choco-600">
                    <strong className="text-choco-800">Items:</strong> {cart.itemCount || 0} items
                  </p>
                  <p className="font-black text-emerald-600 text-base pt-1">
                    Total: ₹{cart.total}
                  </p>
                </div>

                <button
                  onClick={() => navigate(`/pos?cartId=${cart.id}`)}
                  className="w-full py-2.5 bg-waffle-500 hover:bg-waffle-600 text-white font-extrabold text-xs rounded-xl shadow-waffle flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>OPEN CART</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raw Material Requests Quick Section */}
      <div className="bg-white rounded-3xl p-6 border border-cream-300 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-extrabold text-choco-900">Pending Raw Material Requests</h2>
          <button
            onClick={() => navigate('/material-requests')}
            className="text-xs font-bold text-waffle-600 hover:text-waffle-700 flex items-center"
          >
            View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-choco-500 font-medium">
            No pending material requests.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.slice(0, 5).map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-2xl bg-cream-50/60 border border-cream-200 flex items-center justify-between"
              >
                <div>
                  <span className="font-extrabold text-choco-900 text-sm">{req.material}</span>
                  <span className="text-xs text-choco-500 block">
                    Requested by {req.staff_name} ({req.quantity} {req.unit})
                    {req.cart_number ? ` for Cart #${req.cart_number}` : ''}
                  </span>
                </div>
                <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 rounded-md">
                  Pending
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
