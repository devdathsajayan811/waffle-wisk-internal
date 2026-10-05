import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  History,
  Filter,
  Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { InventoryItem, InventoryMovement } from '../types';
import { Modal } from '../components/Modal';

export const Inventory: React.FC = () => {
  const { isAdmin, settings } = useAuth();
  const currency = settings?.currency_symbol || '₹';

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [itemModalOpen, setItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [movementModalOpen, setMovementModalOpen] = useState<boolean>(false);
  const [selectedMovementItem, setSelectedMovementItem] = useState<InventoryItem | null>(null);
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN');

  // New Item Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Ingredients');
  const [quantity, setQuantity] = useState<number>(10);
  const [unit, setUnit] = useState('kg');
  const [minStock, setMinStock] = useState<number>(5);
  const [costPerUnit, setCostPerUnit] = useState<number>(100);
  const [supplier, setSupplier] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // Movement Form State
  const [movQty, setMovQty] = useState<number>(1);
  const [movReason, setMovReason] = useState('Stock Purchase');
  const [movCost, setMovCost] = useState<number>(0);
  const [movNotes, setMovNotes] = useState('');

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const [invRes, movRes] = await Promise.all([
        api.getInventory({
          category: selectedCategory,
          low_stock_only: lowStockOnly,
          search: searchTerm,
        }),
        api.getMovements({ limit: 30 }),
      ]);
      setInventory(invRes);
      setMovements(movRes);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedCategory, lowStockOnly, searchTerm]);

  const handleOpenNewItem = () => {
    setEditingItem(null);
    setName('');
    setCategory('Ingredients');
    setQuantity(10);
    setUnit('kg');
    setMinStock(5);
    setCostPerUnit(100);
    setSupplier('');
    setExpiryDate('');
    setItemModalOpen(true);
  };

  const handleOpenEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setQuantity(item.current_quantity);
    setUnit(item.unit);
    setMinStock(item.minimum_stock);
    setCostPerUnit(item.cost_per_unit);
    setSupplier(item.supplier || '');
    setExpiryDate(item.expiry_date || '');
    setItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      if (editingItem) {
        await api.updateInventoryItem(editingItem.id, {
          name,
          category,
          unit,
          minimum_stock: minStock,
          cost_per_unit: costPerUnit,
          supplier,
          expiry_date: expiryDate || null,
        });
      } else {
        await api.createInventoryItem({
          name,
          category,
          current_quantity: quantity,
          unit,
          minimum_stock: minStock,
          cost_per_unit: costPerUnit,
          supplier,
          expiry_date: expiryDate || null,
        });
      }
      setItemModalOpen(false);
      fetchInventory();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save item');
    } finally {
      setFormLoading(false);
    }
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovementItem) return;
    setFormError(null);
    setFormLoading(true);

    try {
      await api.recordMovement({
        inventory_item_id: selectedMovementItem.id,
        type: movementType,
        quantity: movQty,
        reason: movReason,
        cost: movCost,
        notes: movNotes,
      });
      setMovementModalOpen(false);
      fetchInventory();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record movement');
    } finally {
      setFormLoading(false);
    }
  };

  const openMovementModal = (item: InventoryItem, type: 'IN' | 'OUT') => {
    setSelectedMovementItem(item);
    setMovementType(type);
    setMovQty(1);
    setMovReason(type === 'IN' ? 'Stock Purchase' : 'Damaged / Waste');
    setMovCost(type === 'IN' ? item.cost_per_unit * 1 : 0);
    setMovNotes('');
    setMovementModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-choco-900">Inventory & Raw Material Storage</h2>
          <p className="text-xs text-choco-500">Track waffle premix, syrups, packaging, toppings, and stock movements</p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenNewItem}
            className="px-4 py-2.5 bg-gradient-to-r from-waffle-500 to-waffle-600 hover:from-waffle-600 hover:to-waffle-700 text-white font-bold text-xs rounded-xl shadow-waffle flex items-center space-x-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Storage Material</span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-cream-200 shadow-soft flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-choco-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search material or supplier..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400 bg-cream-50/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden bg-white text-choco-800"
          >
            <option value="all">All Categories</option>
            <option value="Ingredients">Ingredients (Premix/Flour)</option>
            <option value="Syrups">Syrups & Sauces</option>
            <option value="Toppings">Toppings & Sprinkles</option>
            <option value="Packaging">Packaging & Trays</option>
            <option value="Consumables">Consumables</option>
          </select>

          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1 ${
              lowStockOnly
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-cream-200 text-choco-700 hover:bg-cream-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Stock Only</span>
          </button>
        </div>
      </div>

      {/* Storage Table */}
      <div className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cream-100/60 text-choco-700 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-3">Material Name</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Current Qty</th>
                <th className="px-6 py-3">Cost / Unit</th>
                <th className="px-6 py-3">Supplier</th>
                <th className="px-6 py-3">Last Restocked</th>
                {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 text-choco-900">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-choco-400">
                    Loading inventory items...
                  </td>
                </tr>
              ) : inventory.length > 0 ? (
                inventory.map((item) => {
                  const isLow = item.current_quantity <= item.minimum_stock;
                  return (
                    <tr key={item.id} className="hover:bg-cream-50/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <span className="font-bold text-choco-900 block">{item.name}</span>
                        {item.expiry_date && (
                          <span className="text-[10px] text-choco-400">Exp: {item.expiry_date}</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 font-medium">{item.category}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center space-x-2">
                          <span className={`font-extrabold ${isLow ? 'text-rose-600' : 'text-choco-900'}`}>
                            {item.current_quantity} {item.unit}
                          </span>
                          {isLow && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 rounded-full border border-rose-200 animate-pulse">
                              Low Stock (Min: {item.minimum_stock})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-choco-900">
                        {currency}{item.cost_per_unit} / {item.unit}
                      </td>
                      <td className="px-6 py-3.5 text-choco-600">{item.supplier || '—'}</td>
                      <td className="px-6 py-3.5 text-choco-500 text-[11px]">
                        {item.last_restocked ? new Date(item.last_restocked).toLocaleDateString() : '—'}
                      </td>

                      {isAdmin && (
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {/* Stock In Button */}
                            <button
                              onClick={() => openMovementModal(item, 'IN')}
                              className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center"
                              title="Stock In (New arrival)"
                            >
                              <ArrowDownLeft className="w-3 h-3 mr-1 text-emerald-600" />
                              Stock In
                            </button>

                            {/* Stock Out Button */}
                            <button
                              onClick={() => openMovementModal(item, 'OUT')}
                              className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center"
                              title="Stock Out (Waste/Damage)"
                            >
                              <ArrowUpRight className="w-3 h-3 mr-1 text-rose-600" />
                              Stock Out
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleOpenEditItem(item)}
                              className="p-1.5 text-choco-600 hover:bg-cream-200 rounded-lg"
                              title="Edit Details"
                            >
                              Edit
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
                    No storage items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Movement Log Table */}
      <div className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b border-cream-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-choco-900 flex items-center">
            <History className="w-4 h-4 mr-2 text-waffle-600" /> Recent Stock Movements
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cream-100/60 text-choco-700 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Item</th>
                <th className="px-6 py-3">Qty</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Cost</th>
                <th className="px-6 py-3">Logged By</th>
                <th className="px-6 py-3">Date/Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 text-choco-900">
              {movements.length > 0 ? (
                movements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-cream-50/50 transition-colors">
                    <td className="px-6 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          mov.type === 'IN'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {mov.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-bold">{mov.item_name}</td>
                    <td className="px-6 py-3 font-semibold">
                      {mov.quantity} {mov.item_unit}
                    </td>
                    <td className="px-6 py-3 text-choco-600">{mov.reason}</td>
                    <td className="px-6 py-3">{mov.cost ? `${currency}${mov.cost}` : '—'}</td>
                    <td className="px-6 py-3 text-choco-600">{mov.created_by_name}</td>
                    <td className="px-6 py-3 text-choco-400 text-[11px]">
                      {new Date(mov.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-choco-400">
                    No stock movements recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ITEM ADD/EDIT MODAL */}
      {itemModalOpen && (
        <Modal
          isOpen={itemModalOpen}
          onClose={() => setItemModalOpen(false)}
          title={editingItem ? 'Edit Storage Material' : 'Add Storage Material'}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveItem} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-choco-700 mb-1">Material Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Belgian Waffle Premix"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-choco-700 mb-1">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                >
                  <option value="Ingredients">Ingredients</option>
                  <option value="Syrups">Syrups & Sauces</option>
                  <option value="Toppings">Toppings & Sprinkles</option>
                  <option value="Packaging">Packaging & Trays</option>
                  <option value="Consumables">Consumables</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {!editingItem && (
                <div>
                  <label className="block text-xs font-semibold text-choco-700 mb-1">Initial Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-choco-700 mb-1">Unit</label>
                <input
                  type="text"
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="kg, bottles, cans"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-choco-700 mb-1">Min Stock Alert</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={minStock}
                  onChange={(e) => setMinStock(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-choco-700 mb-1">Cost Per Unit ({currency})</label>
                <input
                  type="number"
                  min="0"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-choco-700 mb-1">Supplier Name</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Metro Wholesale"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-choco-700 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end space-x-2 border-t border-cream-200">
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-choco-600 bg-cream-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-5 py-2 text-xs font-bold text-white bg-waffle-500 hover:bg-waffle-600 rounded-xl shadow-waffle"
              >
                {formLoading ? 'Saving...' : 'Save Material'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MOVEMENT RECORD MODAL */}
      {movementModalOpen && selectedMovementItem && (
        <Modal
          isOpen={movementModalOpen}
          onClose={() => setMovementModalOpen(false)}
          title={`Record Stock ${movementType === 'IN' ? 'In (Arrival)' : 'Out (Usage/Damage)'}: ${selectedMovementItem.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleRecordMovement} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-choco-700 mb-1">
                  Quantity ({selectedMovementItem.unit}) *
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={movQty}
                  onChange={(e) => setMovQty(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm font-bold rounded-xl border border-cream-300 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-choco-700 mb-1">Reason *</label>
                <input
                  type="text"
                  required
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                  placeholder="e.g. New Batch Purchase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">Total Cost ({currency})</label>
              <input
                type="number"
                min="0"
                value={movCost}
                onChange={(e) => setMovCost(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">Notes</label>
              <textarea
                rows={2}
                value={movNotes}
                onChange={(e) => setMovNotes(e.target.value)}
                placeholder="Additional invoice info or damage notes..."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
              />
            </div>

            <div className="pt-3 flex justify-end space-x-2 border-t border-cream-200">
              <button
                type="button"
                onClick={() => setMovementModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-choco-600 bg-cream-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs ${
                  movementType === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {formLoading ? 'Recording...' : `Record Stock ${movementType}`}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
