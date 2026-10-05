import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Upload, X, Image as ImageIcon, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { Product, Category } from '../types';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  categories: Category[];
  onSaved: () => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  product,
  categories,
  onSaved,
}) => {
  const isEditing = !!product;

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id || 1);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [discountPrice, setDiscountPrice] = useState<number | ''>('');
  const [taxPercent, setTaxPercent] = useState<number>(5.0);
  const [stockQuantity, setStockQuantity] = useState<number>(10);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);
  const [unit, setUnit] = useState('plate');
  const [availability, setAvailability] = useState<'AVAILABLE' | 'UNAVAILABLE' | 'OUT_OF_STOCK'>('AVAILABLE');

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setSku(product.sku || '');
      setName(product.name || '');
      setCategoryId(product.category_id || categories[0]?.id || 1);
      setDescription(product.description || '');
      setImageUrl(product.image_url || '');
      setPrice(product.price);
      setDiscountPrice(product.discount_price || '');
      setTaxPercent(product.tax_percent !== undefined ? product.tax_percent : 5.0);
      setStockQuantity(product.stock_quantity);
      setLowStockThreshold(product.low_stock_threshold);
      setUnit(product.unit || 'plate');
      setAvailability(product.availability || 'AVAILABLE');
    } else {
      setSku('');
      setName('');
      setCategoryId(categories[0]?.id || 1);
      setDescription('');
      setImageUrl('');
      setPrice('');
      setDiscountPrice('');
      setTaxPercent(5.0);
      setStockQuantity(10);
      setLowStockThreshold(5);
      setUnit('plate');
      setAvailability('AVAILABLE');
    }
  }, [product, categories]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploading(true);
    setError(null);

    try {
      const res = await api.uploadProductImage(file);
      setImageUrl(res.imageUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Item name is required');
      return;
    }
    if (price === '' || Number(price) < 0) {
      setError('Please provide a valid non-negative price');
      return;
    }

    setLoading(true);

    const payload: Partial<Product> = {
      sku: sku || undefined,
      name: name.trim(),
      category_id: Number(categoryId),
      description: description.trim(),
      image_url: imageUrl,
      price: Number(price),
      discount_price: discountPrice !== '' ? Number(discountPrice) : null,
      tax_percent: Number(taxPercent),
      stock_quantity: Number(stockQuantity),
      low_stock_threshold: Number(lowStockThreshold),
      unit: unit.trim() || 'plate',
      availability,
    };

    try {
      if (isEditing && product) {
        await api.updateProduct(product.id, payload);
      } else {
        await api.createProduct(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Waffle / Item' : 'Add New Item'} maxWidth="2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
            {error}
          </div>
        )}

        {/* Basic Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-choco-700 mb-1">Item Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nutella Overload Waffle"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-choco-700 mb-1">Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-choco-700 mb-1">Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Crispy Belgian waffle loaded with Nutella spread & hazelnuts..."
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
          />
        </div>

        {/* Price & Stock Fields */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-choco-700 mb-1">Price (₹) *</label>
            <input
              type="number"
              min="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="179"
              className="w-full px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-choco-700 mb-1">Discount Price (₹)</label>
            <input
              type="number"
              min="0"
              value={discountPrice}
              onChange={(e) => setDiscountPrice(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="159"
              className="w-full px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-choco-700 mb-1">Tax / GST (%)</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={taxPercent}
              onChange={(e) => setTaxPercent(Number(e.target.value))}
              placeholder="5.0"
              className="w-full px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-choco-700 mb-1">Unit</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="plate, bottle, scoop"
              className="w-full px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
            />
          </div>
        </div>

        {/* Stock & Availability Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-choco-700 mb-1">Initial Stock Qty</label>
            <input
              type="number"
              min="0"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-choco-700 mb-1">Low Stock Threshold</label>
            <input
              type="number"
              min="0"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-choco-700 mb-1">Availability Status</label>
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400"
            >
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="UNAVAILABLE">UNAVAILABLE</option>
              <option value="OUT_OF_STOCK">OUT_OF_STOCK</option>
            </select>
          </div>
        </div>

        {/* Image Uploader */}
        <div>
          <label className="block text-xs font-semibold text-choco-700 mb-1">Product Image</label>
          <div className="flex items-center space-x-3">
            {imageUrl ? (
              <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-cream-300 group shrink-0">
                <img src={imageUrl} alt="Product" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-cream-300 bg-cream-50 flex items-center justify-center text-cream-400 shrink-0">
                <ImageIcon className="w-8 h-8" />
              </div>
            )}

            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL or upload file below..."
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
              />
              <label className="inline-flex items-center px-3 py-1.5 bg-cream-200 hover:bg-cream-300 text-choco-800 text-xs font-semibold rounded-xl cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 mr-1.5 text-waffle-600" />
                <span>{uploading ? 'Uploading...' : 'Browse Local Image File'}</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        <div className="pt-3 flex justify-end space-x-2 border-t border-cream-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-choco-600 bg-cream-200 rounded-xl hover:bg-cream-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || uploading}
            className="px-5 py-2 text-xs font-bold text-white bg-waffle-500 hover:bg-waffle-600 rounded-xl shadow-waffle disabled:opacity-50"
          >
            {loading ? 'Saving...' : isEditing ? 'Update Item' : 'Add Item'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
