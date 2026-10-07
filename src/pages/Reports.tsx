import React, { useState, useEffect } from 'react';
import { Download, Printer, BarChart2, PieChart, Package, Wallet, IndianRupee, ShoppingBag, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { EmptyState, PageHeader, StatCard } from '../components/ui';

export const Reports: React.FC = () => {
  const { settings } = useAuth();
  const currency = settings?.currency_symbol || '₹';

  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'payments' | 'inventory'>('sales');
  const [salesReport, setSalesReport] = useState<any>(null);
  const [productReport, setProductReport] = useState<any[]>([]);
  const [paymentReport, setPaymentReport] = useState<any[]>([]);
  const [inventoryReport, setInventoryReport] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sales') {
        const data = await api.getSalesReport('30days');
        setSalesReport(data);
      } else if (activeTab === 'products') {
        const data = await api.getProductReport();
        setProductReport(data);
      } else if (activeTab === 'payments') {
        const data = await api.getPaymentReport();
        setPaymentReport(data);
      } else if (activeTab === 'inventory') {
        const data = await api.getInventoryReport();
        setInventoryReport(data);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeTab]);

  const exportCSV = () => {
    let rows: string[][] = [];
    let filename = `waffle_wisk_${activeTab}_report.csv`;

    if (activeTab === 'products') {
      rows.push(['Product Name', 'Category', 'Stock Qty', 'Total Sold', 'Total Revenue']);
      productReport.forEach((p) => {
        rows.push([p.name, p.category_name, p.stock_quantity.toString(), p.total_sold.toString(), p.total_revenue.toString()]);
      });
    } else if (activeTab === 'payments') {
      rows.push(['Payment Method', 'Transaction Count', 'Total Revenue']);
      paymentReport.forEach((pm) => {
        rows.push([pm.payment_method, pm.count.toString(), pm.total_amount.toString()]);
      });
    } else if (activeTab === 'inventory' && inventoryReport) {
      rows.push(['Material Name', 'Category', 'Current Qty', 'Unit', 'Cost/Unit', 'Stock Value']);
      inventoryReport.items.forEach((item: any) => {
        rows.push([item.name, item.category, item.current_quantity.toString(), item.unit, item.cost_per_unit.toString(), item.stock_value.toString()]);
      });
    } else if (activeTab === 'sales' && salesReport) {
      rows.push(['Date', 'Orders', 'Revenue']);
      salesReport.chartData.forEach((cd: any) => {
        rows.push([cd.date, cd.orders.toString(), cd.revenue.toString()]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const tabs = [
    { id: 'sales' as const, label: 'Sales', icon: BarChart2 },
    { id: 'products' as const, label: 'Products', icon: Package },
    { id: 'payments' as const, label: 'Payments', icon: PieChart },
    { id: 'inventory' as const, label: 'Inventory value', icon: Wallet },
  ];

  const money = (v: number) => `${currency}${Math.round(Number(v) || 0).toLocaleString('en-IN')}`;
  const shortDate = (v: string) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const maxProductRevenue = Math.max(1, ...productReport.map((p) => Number(p.total_revenue) || 0));
  const paymentTotal = paymentReport.reduce((sum, pm) => sum + (Number(pm.total_amount) || 0), 0) || 1;
  const PAYMENT_COLORS = ['bg-waffle-500', 'bg-choco-500', 'bg-emerald-500', 'bg-sky-500', 'bg-cream-400'];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description="Sales trends, best sellers, payment mix and the value of stock on hand."
        actions={
          <>
            <button onClick={exportCSV} className="btn-secondary">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button onClick={handlePrint} className="btn-dark">
              <Printer className="h-4 w-4" />
              Print
            </button>
          </>
        }
      />

      <div className="segmented no-print">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`segmented-item ${activeTab === t.id ? 'segmented-item-active' : ''}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'sales' && salesReport && (
            <>
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="Revenue · last 30 days" value={money(salesReport.totalSales)} icon={IndianRupee} tone="emerald" />
                <StatCard label="Completed orders" value={Number(salesReport.totalOrders).toLocaleString('en-IN')} icon={ShoppingBag} tone="choco" />
                <StatCard label="Average order value" value={money(salesReport.avgOrderValue)} icon={TrendingUp} tone="waffle" />
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Daily revenue</h2>
                    <p className="card-subtitle">Completed orders over the last 30 days</p>
                  </div>
                </div>
                <div className="card-body">
                  {salesReport.chartData.length === 0 ? (
                    <EmptyState compact icon={BarChart2} title="No sales in this period" />
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={salesReport.chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#E89D25" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="#E89D25" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#EAE0D0" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickFormatter={shortDate}
                            tick={{ fontSize: 11, fill: '#966E52' }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={24}
                          />
                          <YAxis
                            tickFormatter={(v) => `${currency}${Number(v).toLocaleString('en-IN')}`}
                            tick={{ fontSize: 11, fill: '#966E52' }}
                            axisLine={false}
                            tickLine={false}
                            width={64}
                          />
                          <Tooltip
                            cursor={{ stroke: '#F4C468', strokeWidth: 1 }}
                            contentStyle={{
                              borderRadius: 12,
                              border: '1px solid #EAE0D0',
                              boxShadow: '0 8px 24px -12px rgba(74,46,27,0.25)',
                              fontSize: 12,
                            }}
                            labelFormatter={shortDate}
                            formatter={(value: number, key: string) =>
                              key === 'revenue' ? [money(value), 'Revenue'] : [value, 'Orders']
                            }
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#D97706" strokeWidth={2} fill="url(#revenueFill)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </section>

              <section className="card overflow-hidden">
                <div className="card-header">
                  <h2 className="card-title">Day by day</h2>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th className="text-right">Orders</th>
                        <th className="text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesReport.chartData.map((cd: any, idx: number) => (
                        <tr key={idx}>
                          <td>{shortDate(cd.date)}</td>
                          <td className="text-right tabular-nums">{cd.orders}</td>
                          <td className="text-right font-semibold tabular-nums text-choco-900">{money(cd.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeTab === 'products' && (
            <section className="card overflow-hidden">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Product performance</h2>
                  <p className="card-subtitle">Units sold and revenue per menu item</p>
                </div>
              </div>
              {productReport.length === 0 ? (
                <EmptyState compact icon={Package} title="No product sales yet" />
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="hidden md:table-cell">Category</th>
                        <th className="text-right">Sold</th>
                        <th className="hidden sm:table-cell">Share of revenue</th>
                        <th className="text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productReport.map((p) => {
                        const share = (Number(p.total_revenue) || 0) / maxProductRevenue;
                        return (
                          <tr key={p.id}>
                            <td className="font-semibold text-choco-900">{p.name}</td>
                            <td className="hidden text-choco-500 md:table-cell">{p.category_name}</td>
                            <td className="text-right tabular-nums">{p.total_sold}</td>
                            <td className="hidden w-1/4 sm:table-cell">
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-200">
                                <div className="h-full rounded-full bg-gradient-to-r from-waffle-300 to-waffle-500" style={{ width: `${Math.max(share * 100, 2)}%` }} />
                              </div>
                            </td>
                            <td className="text-right font-semibold tabular-nums text-choco-900">{money(p.total_revenue)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeTab === 'payments' && (
            <section className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Payment mix</h2>
                  <p className="card-subtitle">How customers paid for completed orders</p>
                </div>
              </div>
              <div className="card-body space-y-6">
                {paymentReport.length === 0 ? (
                  <EmptyState compact icon={PieChart} title="No payments recorded yet" />
                ) : (
                  <>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-cream-200">
                      {paymentReport.map((pm, idx) => (
                        <div
                          key={idx}
                          className={`${PAYMENT_COLORS[idx % PAYMENT_COLORS.length]} h-full first:rounded-l-full last:rounded-r-full`}
                          style={{ width: `${((Number(pm.total_amount) || 0) / paymentTotal) * 100}%` }}
                          title={pm.payment_method}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {paymentReport.map((pm, idx) => {
                        const pct = ((Number(pm.total_amount) || 0) / paymentTotal) * 100;
                        return (
                          <div key={idx} className="surface-muted p-4">
                            <div className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${PAYMENT_COLORS[idx % PAYMENT_COLORS.length]}`} />
                              <span className="text-xs font-semibold text-choco-600">{pm.payment_method}</span>
                              <span className="ml-auto text-xs tabular-nums text-choco-400">{pct.toFixed(1)}%</span>
                            </div>
                            <p className="mt-3 font-display text-2xl font-semibold tabular-nums text-choco-900">{money(pm.total_amount)}</p>
                            <p className="text-xs text-choco-400">{pm.count} transactions</p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {activeTab === 'inventory' && inventoryReport && (
            <>
              <section className="relative overflow-hidden rounded-2xl bg-choco-800 p-6 text-cream-50 shadow-soft-lg">
                <div className="pointer-events-none absolute inset-0 waffle-grid opacity-50 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
                <div className="relative">
                  <p className="text-xs font-medium text-waffle-300">Total stock valuation</p>
                  <p className="mt-1 font-display text-4xl font-semibold tabular-nums tracking-tight">
                    {money(inventoryReport.totalValuation)}
                  </p>
                  <p className="mt-1 text-xs text-cream-300/70">{inventoryReport.items.length} materials · quantity × cost per unit</p>
                </div>
              </section>

              <section className="card overflow-hidden">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th className="hidden md:table-cell">Category</th>
                        <th className="text-right">On hand</th>
                        <th className="hidden text-right sm:table-cell">Cost / unit</th>
                        <th className="text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryReport.items.map((item: any) => (
                        <tr key={item.id}>
                          <td className="font-semibold text-choco-900">{item.name}</td>
                          <td className="hidden text-choco-500 md:table-cell">{item.category}</td>
                          <td className="text-right tabular-nums">
                            {item.current_quantity} {item.unit}
                          </td>
                          <td className="hidden text-right tabular-nums sm:table-cell">
                            {currency}
                            {item.cost_per_unit}
                          </td>
                          <td className="text-right font-semibold tabular-nums text-choco-900">{money(item.stock_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
};
