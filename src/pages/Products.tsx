import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash2, EyeOff, Upload, Image as ImageIcon } from 'lucide-react';
import { api } from '../services/api';
import { Category, Product } from '../types';
import { Modal } from '../components/Modal';
import { Alert, EmptyState, PageHeader, SearchInput, SkeletonCards } from '../components/ui';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=400&q=80';

export const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
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
    api.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setName('');
    setPrice('');
    setImageUrl('');
    setIsAvailable(true);
    setCategoryId(categories[0] ? String(categories[0].id) : '');
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setPrice(prod.price.toString());
    setImageUrl(prod.image_url || '');
    setIsAvailable(prod.availability === 'AVAILABLE');
    setCategoryId(String(prod.category_id));
    setFormError(null);
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
      setFormError('Image upload failed: ' + err.message);
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
        category_id: Number(categoryId),
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
      } else {
        await api.createProduct(payload);
      }

      setModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save item');
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
      setError('Could not change availability: ' + err.message);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('Remove this item from the menu? Past orders keep their history.')) return;
    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setError('Could not delete the item: ' + err.message);
    }
  };

  const enabledCount = products.filter((p) => p.availability === 'AVAILABLE').length;
  const query = search.trim().toLowerCase();
  const visibleProducts = products.filter((p) => {
    const isActive = p.availability === 'AVAILABLE';
    if (statusFilter === 'enabled' && !isActive) return false;
    if (statusFilter === 'disabled' && isActive) return false;
    return !query || p.name.toLowerCase().includes(query) || (p.category_name ?? '').toLowerCase().includes(query);
  });

  const filters: Array<{ id: typeof statusFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: products.length },
    { id: 'enabled', label: 'On menu', count: enabledCount },
    { id: 'disabled', label: 'Hidden', count: products.length - enabledCount },
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Catalog & stock"
        title="Menu items"
        description="Everything staff can sell from the cart. Hide an item to take it off the POS without deleting it."
        actions={
          <button onClick={handleOpenAddModal} className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add item
          </button>
        }
      />

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search items or categories" className="md:w-80" />
        <div className="segmented">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`segmented-item ${statusFilter === f.id ? 'segmented-item-active' : ''}`}
            >
              {f.label}
              <span className="rounded bg-cream-200/80 px-1.5 text-2xs tabular-nums text-choco-500">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <SkeletonCards count={8} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" itemClassName="h-72" />
      ) : products.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Package}
            title="No menu items yet"
            description="Add your first waffle so staff can start selling it."
            action={
              <button onClick={handleOpenAddModal} className="btn-primary">
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add item
              </button>
            }
          />
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="card">
          <EmptyState icon={Package} title="Nothing matches" description="Try a different search or filter." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleProducts.map((prod) => {
            const isActive = prod.availability === 'AVAILABLE';

            return (
              <div key={prod.id} className="card-interactive group flex flex-col overflow-hidden">
                <div className="relative aspect-[4/3] overflow-hidden bg-cream-100">
                  <img
                    src={prod.image_url || FALLBACK_IMAGE}
                    alt={prod.name}
                    loading="lazy"
                    className={`h-full w-full object-cover transition-all duration-500 ease-out-expo group-hover:scale-[1.04] ${
                      isActive ? '' : 'grayscale-[60%]'
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-choco-900/30 via-transparent to-transparent" />
                  <div className="absolute left-3 top-3">
                    {isActive ? (
                      <span className="badge border-white/40 bg-white/90 text-emerald-700 backdrop-blur">
                        <span className="dot" /> On menu
                      </span>
                    ) : (
                      <span className="badge border-white/20 bg-choco-900/70 text-cream-100 backdrop-blur">
                        <EyeOff className="h-3 w-3" /> Hidden
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 font-sans text-[0.9375rem] font-semibold leading-snug text-choco-900">{prod.name}</h3>
                      {prod.category_name && <p className="mt-0.5 text-xs text-choco-400">{prod.category_name}</p>}
                    </div>
                    <span className="shrink-0 font-display text-lg font-semibold tabular-nums text-choco-900">₹{prod.price}</span>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-cream-200 pt-3">
                    <button
                      onClick={() => handleToggleStatus(prod)}
                      role="switch"
                      aria-checked={isActive}
                      className="group/toggle flex items-center gap-2 text-xs font-medium text-choco-500 hover:text-choco-900"
                    >
                      <span
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
                          isActive ? 'bg-emerald-500' : 'bg-cream-400'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-200 ease-out-expo ${
                            isActive ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
                          }`}
                        />
                      </span>
                      {isActive ? 'Available' : 'Hidden'}
                    </button>

                    <div className="flex items-center">
                      <button onClick={() => handleOpenEditModal(prod)} className="icon-btn h-8 w-8" title="Edit item" aria-label={`Edit ${prod.name}`}>
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(prod.id)}
                        className="icon-btn h-8 w-8 hover:bg-rose-50 hover:text-rose-600"
                        title="Delete item"
                        aria-label={`Delete ${prod.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? 'Edit item' : 'Add menu item'}
        description={editingProduct ? 'Price changes apply to new carts only.' : 'New items appear on the POS straight away.'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <Alert tone="error">{formError}</Alert>}

          <div>
            <label className="label" htmlFor="product-name">Item name</label>
            <input
              id="product-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Belgian chocolate waffle"
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="product-price">Price (₹)</label>
              <input
                id="product-price"
                type="number"
                step="any"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="149"
                className="input tabular-nums"
              />
            </div>
            <div>
              <label className="label" htmlFor="product-category">Category</label>
              <select
                id="product-category"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="select"
              >
                <option value="" disabled>
                  Choose…
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="product-image">Image</label>
            <div className="flex gap-3">
              <div className="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border border-cream-300 bg-cream-100">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-choco-300">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  id="product-image"
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Paste an image URL"
                  className="input input-sm"
                />
                <label className="btn-secondary btn-sm cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingImage ? 'Uploading…' : 'Upload file'}
                  <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-cream-300 bg-cream-50 px-4 py-3">
            <span>
              <span className="block text-sm font-semibold text-choco-900">Show on POS</span>
              <span className="block text-xs text-choco-400">Hidden items stay in reports but can't be sold.</span>
            </span>
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="checkbox h-5 w-5"
            />
          </label>

          <div className="-mx-6 -mb-5 mt-2 flex justify-end gap-2 border-t border-cream-200 bg-cream-50/60 px-6 py-4">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting || uploadingImage} className="btn-primary">
              {submitting ? 'Saving…' : editingProduct ? 'Save changes' : 'Add item'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Products;
