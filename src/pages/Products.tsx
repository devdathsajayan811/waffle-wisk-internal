import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Tag,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Product, Category } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { ProductFormModal } from './ProductFormModal';
import { PriceHistoryModal } from './PriceHistoryModal';

export const Products: React.FC = () => {
  const { isAdmin, settings } = useAuth();
  const currency = settings?.currency_symbol || '₹';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [formModalOpen, setFormModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [priceModalOpen, setPriceModalOpen] = useState<boolean>(false);
  const [priceProduct, setPriceProduct] = useState<Product | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const [catsRes, prodsRes] = await Promise.all([
        api.getCategories(),
        api.getProducts({
          category: selectedCategory,
          availability: availabilityFilter,
          search: searchTerm,
        }),
      ]);
      setCategories(catsRes);
      setProducts(prodsRes);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, availabilityFilter, searchTerm]);

  const handleToggleStatus = async (id: number) => {
    if (!isAdmin) return;
    try {
      await api.toggleProductStatus(id);
      fetchProducts();
    } catch (err) {
      console.error('Failed to toggle product status:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) return;
    try {
      await api.deleteProduct(id);
      setDeleteConfirmId(null);
      fetchProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-choco-900">Products & Menu Management</h2>
          <p className="text-xs text-choco-500">Manage waffle items, pricing, inventory stock, and availability</p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setEditingProduct(null);
              setFormModalOpen(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-waffle-500 to-waffle-600 hover:from-waffle-600 hover:to-waffle-700 text-white font-bold text-xs rounded-xl shadow-waffle flex items-center space-x-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Menu Item</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-cream-200 shadow-soft flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-choco-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by product name or SKU..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400 bg-cream-50/30"
          />
        </div>

        {/* Category & Availability Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center space-x-1 text-xs text-choco-600">
            <Filter className="w-3.5 h-3.5" />
            <span>Category:</span>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden bg-white text-choco-800"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden bg-white text-choco-800"
          >
            <option value="all">All Availability</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="UNAVAILABLE">UNAVAILABLE</option>
            <option value="OUT_OF_STOCK">OUT_OF_STOCK</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cream-100/60 text-choco-700 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Tax (GST)</th>
                <th className="px-6 py-3">Stock Qty</th>
                <th className="px-6 py-3">Availability</th>
                {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 text-choco-900">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-choco-400">
                    Loading products...
                  </td>
                </tr>
              ) : products.length > 0 ? (
                products.map((p) => {
                  const isLowStock = p.stock_quantity <= p.low_stock_threshold;
                  return (
                    <tr key={p.id} className="hover:bg-cream-50/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center space-x-3">
                          <img
                            src={p.image_url || 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=200&q=80'}
                            alt={p.name}
                            className="w-10 h-10 rounded-xl object-cover border border-cream-200 shrink-0"
                            onError={(e: any) => {
                              e.target.src = 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=200&q=80';
                            }}
                          />
                          <div>
                            <span className="font-bold text-choco-900 block">{p.name}</span>
                            <span className="text-[10px] text-choco-400 font-mono">SKU: {p.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-medium">{p.category_name}</td>
                      <td className="px-6 py-3.5">
                        {p.discount_price ? (
                          <div>
                            <span className="font-extrabold text-waffle-600 block">
                              {currency}{p.discount_price}
                            </span>
                            <span className="text-[10px] text-gray-400 line-through">
                              {currency}{p.price}
                            </span>
                          </div>
                        ) : (
                          <span className="font-extrabold text-choco-900">{currency}{p.price}</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-choco-600">{p.tax_percent}%</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center space-x-1.5">
                          <span className={`font-bold ${isLowStock ? 'text-rose-600' : 'text-choco-900'}`}>
                            {p.stock_quantity} {p.unit}
                          </span>
                          {isLowStock && (
                            <span className="p-1 bg-amber-100 text-amber-700 rounded-md" title="Low Stock Warning">
                              <AlertTriangle className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <StatusBadge status={p.availability} type="availability" />
                      </td>

                      {isAdmin && (
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {/* Toggle Status */}
                            <button
                              onClick={() => handleToggleStatus(p.id)}
                              className="p-1.5 text-choco-500 hover:text-choco-900 hover:bg-cream-200 rounded-lg"
                              title="Toggle Availability"
                            >
                              {p.availability === 'AVAILABLE' ? (
                                <ToggleRight className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-gray-400" />
                              )}
                            </button>

                            {/* Change Price with History */}
                            <button
                              onClick={() => {
                                setPriceProduct(p);
                                setPriceModalOpen(true);
                              }}
                              className="p-1.5 text-waffle-600 hover:bg-waffle-50 rounded-lg"
                              title="Price Management & History"
                            >
                              <TrendingUp className="w-4 h-4" />
                            </button>

                            {/* Edit Product */}
                            <button
                              onClick={() => {
                                setEditingProduct(p);
                                setFormModalOpen(true);
                              }}
                              className="p-1.5 text-choco-600 hover:bg-cream-200 rounded-lg"
                              title="Edit Item Details"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            {/* Delete Product */}
                            <button
                              onClick={() => setDeleteConfirmId(p.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-choco-400">
                    No products found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Add/Edit Form Modal */}
      {formModalOpen && (
        <ProductFormModal
          isOpen={formModalOpen}
          onClose={() => setFormModalOpen(false)}
          product={editingProduct}
          categories={categories}
          onSaved={fetchProducts}
        />
      )}

      {/* Price Management & History Modal */}
      {priceModalOpen && priceProduct && (
        <PriceHistoryModal
          isOpen={priceModalOpen}
          onClose={() => setPriceModalOpen(false)}
          product={priceProduct}
          onUpdated={fetchProducts}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-choco-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-choco-900">Delete Menu Item?</h3>
            <p className="text-xs text-choco-600">
              Are you sure you want to delete this product? This action cannot be undone.
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold text-choco-600 bg-cream-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
              >
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
