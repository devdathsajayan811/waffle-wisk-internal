import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  PackageCheck,
  Clock,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { Order } from '../types';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useAuth();
  const currency = settings?.currency_symbol || '₹';

  const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days'>('7days');
  const [metrics, setMetrics] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStockList, setLowStockList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const salesData = await api.getSalesReport(timeRange);
      setMetrics(salesData);

      const ordersData = await api.getOrders({ date_range: 'today' });
      setRecentOrders(ordersData.slice(0, 6));

      const lowStockData = await api.getLowStock();
      const combined = [
        ...lowStockData.products.map((p) => ({
          name: p.name,
          stock: p.stock_quantity,
          unit: p.unit,
          type: 'Product',
        })),
        ...lowStockData.inventory.map((i) => ({
          name: i.name,
          stock: i.current_quantity,
          unit: i.unit,
          type: 'Storage Material',
        })),
      ];
      setLowStockList(combined);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  return (
    <div className="space-y-6">
      {/* Top Banner Alert for Low Stock Items */}
      {lowStockList.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/80 rounded-2xl p-4 shadow-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-950">
                Low Stock Alert ({lowStockList.length} Items Require Attention)
              </h4>
              <p className="text-xs text-amber-800">
                Example: "{lowStockList[0].name} — {lowStockList[0].stock} {lowStockList[0].unit} remaining"
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/inventory')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center shrink-0"
          >
            <span>Manage Inventory</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </button>
        </div>
      )}

      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-choco-900">Sales Overview</h2>
          <p className="text-xs text-choco-500">Real-time performance metrics and cart activity</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchData}
            className="p-2 text-choco-600 bg-white hover:bg-cream-200 border border-cream-300 rounded-xl transition-colors shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="bg-white p-1 rounded-xl border border-cream-300 shadow-2xs flex space-x-1">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                timeRange === 'today' ? 'bg-waffle-500 text-white shadow-xs' : 'text-choco-600 hover:bg-cream-100'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('7days')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                timeRange === '7days' ? 'bg-waffle-500 text-white shadow-xs' : 'text-choco-600 hover:bg-cream-100'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeRange('30days')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                timeRange === '30days' ? 'bg-waffle-500 text-white shadow-xs' : 'text-choco-600 hover:bg-cream-100'
              }`}
            >
              30 Days
            </button>
          </div>
        </div>
      </div>

      {/* 6 Core Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Today's Sales */}
        <div className="bg-white p-4 rounded-2xl border border-cream-200 shadow-soft hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-choco-500 uppercase tracking-wider">Total Sales</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-choco-900">
            {currency}
            {metrics?.totalSales ? metrics.totalSales.toLocaleString() : 0}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">Completed orders</span>
        </div>

        {/* Card 2: Total Orders */}
        <div className="bg-white p-4 rounded-2xl border border-cream-200 shadow-soft hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-choco-500 uppercase tracking-wider">Total Orders</span>
            <div className="w-8 h-8 rounded-xl bg-waffle-100 text-waffle-700 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-choco-900">{metrics?.totalOrders || 0}</p>
          <span className="text-[10px] text-waffle-600 font-medium">Cart transactions</span>
        </div>

        {/* Card 3: Average Order Value */}
        <div className="bg-white p-4 rounded-2xl border border-cream-200 shadow-soft hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-choco-500 uppercase tracking-wider">Avg Order Value</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-choco-900">
            {currency}
            {metrics?.avgOrderValue ? Math.round(metrics.avgOrderValue) : 0}
          </p>
          <span className="text-[10px] text-blue-600 font-medium">Per checkout ticket</span>
        </div>

        {/* Card 4: Products Sold */}
        <div className="bg-white p-4 rounded-2xl border border-cream-200 shadow-soft hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-choco-500 uppercase tracking-wider">Products Sold</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-choco-900">{metrics?.totalProductsSold || 0}</p>
          <span className="text-[10px] text-purple-600 font-medium">Waffles & items</span>
        </div>

        {/* Card 5: Pending Orders */}
        <div className="bg-white p-4 rounded-2xl border border-cream-200 shadow-soft hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-choco-500 uppercase tracking-wider">Pending Orders</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-choco-900">{metrics?.pendingOrders || 0}</p>
          <span className="text-[10px] text-amber-600 font-medium">Awaiting payment</span>
        </div>

        {/* Card 6: Low-Stock Items */}
        <div className="bg-white p-4 rounded-2xl border border-cream-200 shadow-soft hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-choco-500 uppercase tracking-wider">Low-Stock Items</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-rose-600">{lowStockList.length}</p>
          <span className="text-[10px] text-rose-500 font-medium">Reorder required</span>
        </div>
      </div>

      {/* Main Grid: Chart & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart Container */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-cream-200 shadow-soft">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-choco-900">Sales Trend & Revenue</h3>
              <p className="text-xs text-choco-500">Revenue trajectory over time</p>
            </div>
            <span className="text-xs font-bold text-waffle-600 bg-waffle-50 px-3 py-1 rounded-full border border-waffle-200">
              {timeRange.toUpperCase()}
            </span>
          </div>

          <div className="h-72 w-full">
            {metrics?.chartData && metrics.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="waffleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E89D25" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#E89D25" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5EFE6" />
                  <XAxis dataKey="date" stroke="#966E52" fontSize={11} tickLine={false} />
                  <YAxis stroke="#966E52" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#2C1810',
                      color: '#FFFDF9',
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    }}
                    formatter={(value: any) => [`${currency}${value}`, 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#D97706"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#waffleGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-choco-400">
                No revenue data recorded for this time range yet.
              </div>
            )}
          </div>
        </div>

        {/* Top Selling Products Card */}
        <div className="bg-white p-6 rounded-2xl border border-cream-200 shadow-soft">
          <h3 className="text-base font-bold text-choco-900 mb-1">Top Selling Items</h3>
          <p className="text-xs text-choco-500 mb-4">Most popular waffles & shakes</p>

          <div className="space-y-4">
            {metrics?.topProducts && metrics.topProducts.length > 0 ? (
              metrics.topProducts.map((p: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-cream-50/60 border border-cream-200/80 hover:bg-cream-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-lg bg-waffle-100 text-waffle-700 font-extrabold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-choco-900">{p.product_name}</h4>
                      <p className="text-[10px] text-choco-500">{p.qty_sold} units sold</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-700">
                    {currency}
                    {p.revenue}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-choco-400 py-8 text-center">No items sold yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b border-cream-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-choco-900">Recent Cart Orders</h3>
            <p className="text-xs text-choco-500">Today's latest transactions</p>
          </div>
          <button
            onClick={() => navigate('/orders')}
            className="text-xs font-bold text-waffle-600 hover:text-waffle-700 flex items-center"
          >
            <span>View All Orders</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cream-100/60 text-choco-700 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-3">Order ID</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Payment</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Staff</th>
                <th className="px-6 py-3">Date/Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 text-choco-900">
              {recentOrders.length > 0 ? (
                recentOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-cream-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-bold font-mono text-waffle-700">{ord.order_number}</td>
                    <td className="px-6 py-3.5 font-medium">{ord.customer_name}</td>
                    <td className="px-6 py-3.5 font-extrabold text-choco-900">
                      {currency}
                      {ord.grand_total}
                    </td>
                    <td className="px-6 py-3.5 font-medium">{ord.payment_method}</td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={ord.payment_status} type="payment" />
                    </td>
                    <td className="px-6 py-3.5 text-choco-600">{ord.staff_name}</td>
                    <td className="px-6 py-3.5 text-choco-500 text-[11px]">
                      {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-choco-400">
                    No orders recorded today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
