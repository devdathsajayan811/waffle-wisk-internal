import React, { useState, useEffect } from 'react';
import { Download, Printer, BarChart2, PieChart, Package, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

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

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-choco-900">Analytics & Business Reports</h2>
          <p className="text-xs text-choco-500">Sales breakdowns, product performance, payment methods, and inventory valuation</p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-cream-200 hover:bg-cream-300 text-choco-800 text-xs font-bold rounded-xl border border-cream-300 transition-colors flex items-center space-x-1"
          >
            <Download className="w-4 h-4 text-choco-600" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-choco-700 hover:bg-choco-800 text-cream-50 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1"
          >
            <Printer className="w-4 h-4 text-waffle-400" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-cream-200 shadow-soft flex space-x-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center space-x-2 shrink-0 ${
            activeTab === 'sales' ? 'bg-waffle-500 text-white shadow-xs' : 'text-choco-700 hover:bg-cream-100'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Sales Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center space-x-2 shrink-0 ${
            activeTab === 'products' ? 'bg-waffle-500 text-white shadow-xs' : 'text-choco-700 hover:bg-cream-100'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Product Performance</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center space-x-2 shrink-0 ${
            activeTab === 'payments' ? 'bg-waffle-500 text-white shadow-xs' : 'text-choco-700 hover:bg-cream-100'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>Payment Methods</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center space-x-2 shrink-0 ${
            activeTab === 'inventory' ? 'bg-waffle-500 text-white shadow-xs' : 'text-choco-700 hover:bg-cream-100'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Inventory Valuation</span>
        </button>
      </div>

      {/* Report Content Body */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-cream-200 text-center text-xs text-choco-400">
          Generating report data...
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'sales' && salesReport && (
            <div className="bg-white p-6 rounded-2xl border border-cream-200 shadow-soft space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-cream-50 rounded-xl border border-cream-200">
                  <span className="text-xs text-choco-500 font-bold block uppercase">Total Sales (30 Days)</span>
                  <span className="text-2xl font-extrabold text-choco-900">{currency}{salesReport.totalSales}</span>
                </div>
                <div className="p-4 bg-cream-50 rounded-xl border border-cream-200">
                  <span className="text-xs text-choco-500 font-bold block uppercase">Total Orders</span>
                  <span className="text-2xl font-extrabold text-choco-900">{salesReport.totalOrders}</span>
                </div>
                <div className="p-4 bg-cream-50 rounded-xl border border-cream-200">
                  <span className="text-xs text-choco-500 font-bold block uppercase">Avg Order Value</span>
                  <span className="text-2xl font-extrabold text-choco-900">{currency}{Math.round(salesReport.avgOrderValue)}</span>
                </div>
              </div>

              <h3 className="font-bold text-sm text-choco-900 pt-2">Daily Revenue Breakdown</h3>
              <table className="w-full text-left text-xs border border-cream-200 rounded-xl overflow-hidden">
                <thead className="bg-cream-100 text-choco-700 font-bold">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Completed Orders</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {salesReport.chartData.map((cd: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-4 py-2.5 font-mono">{cd.date}</td>
                      <td className="px-4 py-2.5 font-medium">{cd.orders} orders</td>
                      <td className="px-4 py-2.5 text-right font-extrabold text-choco-900">{currency}{cd.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-cream-100 text-choco-700 uppercase font-bold">
                  <tr>
                    <th className="px-6 py-3">Product Name</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Current Stock</th>
                    <th className="px-6 py-3">Quantity Sold</th>
                    <th className="px-6 py-3 text-right">Revenue Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200 text-choco-900">
                  {productReport.map((p) => (
                    <tr key={p.id} className="hover:bg-cream-50/50">
                      <td className="px-6 py-3.5 font-bold">{p.name}</td>
                      <td className="px-6 py-3.5 text-choco-600">{p.category_name}</td>
                      <td className="px-6 py-3.5">{p.stock_quantity} units</td>
                      <td className="px-6 py-3.5 font-bold text-waffle-700">{p.total_sold} units</td>
                      <td className="px-6 py-3.5 text-right font-extrabold text-choco-900">
                        {currency}{p.total_revenue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="bg-white p-6 rounded-2xl border border-cream-200 shadow-soft space-y-4">
              <h3 className="font-bold text-sm text-choco-900">Revenue by Payment Channel</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {paymentReport.map((pm, idx) => (
                  <div key={idx} className="p-4 bg-cream-50 rounded-2xl border border-cream-200 space-y-2">
                    <span className="font-extrabold text-xs text-waffle-700 uppercase tracking-wider block">
                      {pm.payment_method}
                    </span>
                    <p className="text-2xl font-extrabold text-choco-900">{currency}{pm.total_amount}</p>
                    <p className="text-xs text-choco-500">{pm.count} successful transactions</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'inventory' && inventoryReport && (
            <div className="bg-white p-6 rounded-2xl border border-cream-200 shadow-soft space-y-4">
              <div className="p-4 bg-waffle-50 border border-waffle-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-waffle-800 uppercase tracking-wider block">
                    Total Storage Inventory Valuation
                  </span>
                  <span className="text-3xl font-extrabold text-choco-900">
                    {currency}{inventoryReport.totalValuation.toLocaleString()}
                  </span>
                </div>
              </div>

              <table className="w-full text-left text-xs border border-cream-200 rounded-xl overflow-hidden">
                <thead className="bg-cream-100 text-choco-700 font-bold">
                  <tr>
                    <th className="px-4 py-3">Material Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Current Qty</th>
                    <th className="px-4 py-3">Cost / Unit</th>
                    <th className="px-4 py-3 text-right">Total Stock Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {inventoryReport.items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2.5 font-bold">{item.name}</td>
                      <td className="px-4 py-2.5 text-choco-600">{item.category}</td>
                      <td className="px-4 py-2.5 font-semibold">{item.current_quantity} {item.unit}</td>
                      <td className="px-4 py-2.5">{currency}{item.cost_per_unit}</td>
                      <td className="px-4 py-2.5 text-right font-extrabold text-choco-900">
                        {currency}{item.stock_value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
