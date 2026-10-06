import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash2, Power, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { Product } from '../types';

export const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts();
      setProducts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setName('');
    setPrice('');
    setImageUrl('');
    setIsAvailable(true);
    setModalOpen(true);
  };

  const handleOpenEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setPrice(prod.price.toString());
    setImageUrl(prod.image_url || '');
    setIsAvailable(prod.availability === 'AVAILABLE');
    setModalOpen(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const res = await api.uploadProductImage(file);
      setImageUrl(res.imageUrl);
    } catch (err: any) {
      alert('Failed to upload image: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    setSubmitting(true);
    try {
      const payload: Partial<Product> = {
        name,
        price: Number(price),
        image_url: imageUrl || 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=400&q=80',
        availability: isAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
        category_id: 1, // Default classic category
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
      } else {
        await api.createProduct(payload);
      }

      setModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      alert(err.message || 'Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (prod: Product) => {
    try {
      await api.toggleProductStatus(prod.id);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === prod.id
            ? { ...p, availability: p.availability === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE' }
            : p
        )
      );
    } catch (err: any) {
      alert('Failed to toggle status: ' + err.message);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert('Failed to delete item: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-cream-300 pb-4">
        <div>
          <h1 className="text-2xl font-black text-choco-900 flex items-center">
            <Package className="w-7 h-7 mr-2 text-waffle-500" />
            Manage Items
          </h1>
          <p className="text-xs text-choco-600 font-medium">
            Add, edit, delete, or enable/disable menu items available on the cart.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="py-3 px-5 bg-waffle-500 hover:bg-waffle-600 text-white font-extrabold text-sm rounded-2xl shadow-waffle flex items-center justify-center space-x-2 transition-all shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Item</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Items Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs font-bold text-choco-500">
          Loading items list...
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center text-xs font-bold text-choco-500">
          No items found. Click "Add New Item" to create your first menu item.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map((prod) => {
            const isActive = prod.availability === 'AVAILABLE';

            return (
              <div
                key={prod.id}
                className={`bg-white rounded-3xl p-4 border transition-all duration-200 flex flex-col justify-between shadow-soft ${
                  isActive ? 'border-cream-300' : 'border-rose-200 bg-rose-50/20 opacity-80'
                }`}
              >
                <div>
                  {/* Image */}
                  <div className="aspect-square w-full rounded-2xl overflow-hidden bg-cream-100 mb-3 relative border border-cream-200">
                    <img
                      src={prod.image_url || 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=400&q=80'}
                      alt={prod.name}
                      className="w-full h-full object-cover"
                    />
                    {!isActive && (
                      <div className="absolute inset-0 bg-choco-900/60 backdrop-blur-xs flex items-center justify-center text-white font-extrabold text-xs">
                        Disabled
                      </div>
                    )}
                  </div>

                  {/* Name & Price */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-extrabold text-choco-900 text-base leading-snug">
                      {prod.name}
                    </h3>
                    <span className="font-black text-emerald-600 text-lg shrink-0">
                      ₹{prod.price}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-cream-200 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleToggleStatus(prod)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 border transition-colors ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{isActive ? 'Enabled' : 'Disabled'}</span>
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEditModal(prod)}
                      className="p-2 text-choco-600 hover:text-choco-900 hover:bg-cream-100 rounded-xl"
                      title="Edit Item"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(prod.id)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
                      title="Delete Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-choco-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 border border-cream-300">
            <h2 className="text-xl font-black text-choco-900">
              {editingProduct ? 'Edit Item' : 'Add New Item'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-choco-800 uppercase tracking-wider mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Chocolate Waffle"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-choco-800 uppercase tracking-wider mb-1">
                  Price (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g., 100"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-choco-800 uppercase tracking-wider mb-1">
                  Item Image URL or File Upload
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
                  />
                  <div className="flex items-center space-x-2">
                    <label className="cursor-pointer px-3 py-1.5 bg-cream-100 hover:bg-cream-200 text-choco-800 text-xs font-bold rounded-xl border border-cream-300 inline-flex items-center">
                      <ImageIcon className="w-3.5 h-3.5 mr-1" />
                      <span>{uploadingImage ? 'Uploading...' : 'Upload Image File'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isAvailableToggle"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="w-4 h-4 rounded text-waffle-500 focus:ring-waffle-400"
                />
                <label htmlFor="isAvailableToggle" className="text-sm font-bold text-choco-800 cursor-pointer">
                  Item is Available / Enabled
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-cream-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-choco-700 bg-cream-100 hover:bg-cream-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-waffle-500 hover:bg-waffle-600 rounded-xl shadow-waffle disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : editingProduct ? 'Update Item' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
