import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  History,
  Pencil,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { InventoryItem, InventoryMovement } from '../types';
import { Modal } from '../components/Modal';
import { Alert, EmptyState, PageHeader, SearchInput, SkeletonRows, StatCard } from '../components/ui';

const CATEGORIES = [
  { value: 'Ingredients', label: 'Ingredients' },
  { value: 'Syrups', label: 'Syrups & sauces' },
  { value: 'Toppings', label: 'Toppings' },
  { value: 'Packaging', label: 'Packaging' },
  { value: 'Consumables', label: 'Consumables' },
];

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
    setFormError(null);
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
    setFormError(null);
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
    setFormError(null);
    setMovementModalOpen(true);
  };

  const lowCount = inventory.filter((i) => i.current_quantity <= i.minimum_stock).length;
  const stockValue = inventory.reduce((sum, i) => sum + i.current_quantity * i.cost_per_unit, 0);
  const colCount = isAdmin ? 6 : 5;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Catalog & stock"
        title="Inventory"
        description="Premix, syrups, toppings and packaging on hand, with every stock movement logged."
        actions={
          isAdmin && (
            <button onClick={handleOpenNewItem} className="btn-primary">
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add material
            </button>
          )
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Materials tracked" value={inventory.length} icon={Boxes} tone="choco" loading={loading} />
        <StatCard
          label="Below minimum"
          value={lowCount}
          icon={AlertTriangle}
          tone={lowCount > 0 ? 'rose' : 'emerald'}
          loading={loading}
          hint={lowCount > 0 ? 'Restock soon' : 'All levels healthy'}
        />
        <StatCard
          label="Stock value"
          value={`${currency}${Math.round(stockValue).toLocaleString('en-IN')}`}
          icon={Wallet}
          tone="waffle"
          loading={loading}
          hint="Quantity × cost per unit"
        />
      </section>

      <div className="toolbar">
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search material or supplier" className="md:w-80" />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="select input-sm w-auto min-w-[11rem]"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            aria-pressed={lowStockOnly}
            className={`btn btn-sm h-[2.125rem] ${
              lowStockOnly
                ? 'border border-amber-300 bg-amber-50 text-amber-800'
                : 'border border-cream-300 bg-white text-choco-500 hover:text-choco-900'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Low stock only
          </button>
        </div>
      </div>

      {/* Stock table */}
      <div className="card overflow-hidden">
        {!loading && inventory.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={searchTerm || lowStockOnly || selectedCategory !== 'all' ? 'Nothing matches these filters' : 'No materials tracked yet'}
            description={
              searchTerm || lowStockOnly || selectedCategory !== 'all'
                ? 'Clear a filter to see more.'
                : 'Add the ingredients and packaging you buy so you know when to restock.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>On hand</th>
                  <th className="hidden md:table-cell">Cost / unit</th>
                  <th className="hidden lg:table-cell">Supplier</th>
                  <th className="hidden lg:table-cell">Last restock</th>
                  {isAdmin && (
                    <th className="text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={colCount} />
                ) : (
                  inventory.map((item) => {
                    const isLow = item.current_quantity <= item.minimum_stock;
                    const ratio = item.minimum_stock > 0 ? Math.min(item.current_quantity / (item.minimum_stock * 3), 1) : 1;
                    return (
                      <tr key={item.id}>
                        <td>
                          <p className="font-semibold text-choco-900">{item.name}</p>
                          <p className="text-xs text-choco-400">
                            {item.category}
                            {item.expiry_date && ` · Expires ${item.expiry_date}`}
                          </p>
                        </td>
                        <td className="min-w-[10rem]">
                          <div className="flex items-baseline gap-2">
                            <span className={`font-semibold tabular-nums ${isLow ? 'text-rose-700' : 'text-choco-900'}`}>
                              {item.current_quantity} {item.unit}
                            </span>
                            {isLow && <span className="badge-danger">Low</span>}
                          </div>
                          <div className="mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-cream-200">
                            <div
                              className={`h-full rounded-full ${isLow ? 'bg-rose-500' : ratio < 0.6 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.max(ratio * 100, 4)}%` }}
                            />
                          </div>
                          <p className="mt-1 text-2xs text-choco-400">Min {item.minimum_stock} {item.unit}</p>
                        </td>
                        <td className="hidden tabular-nums md:table-cell">
                          {currency}
                          {item.cost_per_unit}
                          <span className="text-choco-400"> / {item.unit}</span>
                        </td>
                        <td className="hidden text-choco-500 lg:table-cell">{item.supplier || '—'}</td>
                        <td className="hidden whitespace-nowrap text-xs text-choco-400 lg:table-cell">
                          {item.last_restocked ? new Date(item.last_restocked).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                        </td>
                        {isAdmin && (
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openMovementModal(item, 'IN')}
                                className="btn btn-sm border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                title="Record a delivery"
                              >
                                <ArrowDownLeft className="h-3.5 w-3.5" />
                                <span className="hidden xl:inline">In</span>
                              </button>
                              <button
                                onClick={() => openMovementModal(item, 'OUT')}
                                className="btn btn-sm border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                title="Record usage or waste"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                                <span className="hidden xl:inline">Out</span>
                              </button>
                              <button
                                onClick={() => handleOpenEditItem(item)}
                                className="icon-btn h-8 w-8"
                                title="Edit details"
                                aria-label={`Edit ${item.name}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Movement log */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream-200 text-choco-600">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h2 className="card-title">Recent stock movements</h2>
              <p className="card-subtitle">Last 30 deliveries, usage and waste entries</p>
            </div>
          </div>
        </div>

        {movements.length === 0 && !loading ? (
          <EmptyState compact icon={History} title="No movements yet" description="Deliveries and waste you record will be listed here." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Change</th>
                  <th className="hidden md:table-cell">Reason</th>
                  <th className="hidden md:table-cell text-right">Cost</th>
                  <th className="hidden lg:table-cell">Logged by</th>
                  <th className="text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={6} rows={4} />
                ) : (
                  movements.map((mov) => {
                    const isIn = mov.type === 'IN';
                    return (
                      <tr key={mov.id}>
                        <td className="font-medium text-choco-900">{mov.item_name}</td>
                        <td>
                          <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${isIn ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {isIn ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                            {isIn ? '+' : '−'}
                            {mov.quantity} {mov.item_unit}
                          </span>
                        </td>
                        <td className="hidden text-choco-500 md:table-cell">{mov.reason}</td>
                        <td className="hidden text-right tabular-nums md:table-cell">{mov.cost ? `${currency}${mov.cost}` : '—'}</td>
                        <td className="hidden text-choco-500 lg:table-cell">{mov.created_by_name}</td>
                        <td className="whitespace-nowrap text-right text-xs text-choco-400">
                          {new Date(mov.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / edit material */}
      {itemModalOpen && (
        <Modal
          isOpen={itemModalOpen}
          onClose={() => setItemModalOpen(false)}
          title={editingItem ? 'Edit material' : 'Add material'}
          description={editingItem ? 'Use stock in / out to change quantities.' : 'Start tracking a new ingredient or supply.'}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveItem} className="space-y-4">
            {formError && <Alert tone="error">{formError}</Alert>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="inv-name">Material name</label>
                <input
                  id="inv-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Belgian waffle premix"
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="inv-category">Category</label>
                <select id="inv-category" value={category} onChange={(e) => setCategory(e.target.value)} className="select">
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {!editingItem && (
                <div>
                  <label className="label" htmlFor="inv-qty">Opening quantity</label>
                  <input
                    id="inv-qty"
                    type="number"
                    min="0"
                    step="0.1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="input tabular-nums"
                  />
                </div>
              )}
              <div>
                <label className="label" htmlFor="inv-unit">Unit</label>
                <input
                  id="inv-unit"
                  type="text"
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="kg, bottles, cans"
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="inv-min">Alert below</label>
                <input
                  id="inv-min"
                  type="number"
                  min="0"
                  step="0.1"
                  value={minStock}
                  onChange={(e) => setMinStock(Number(e.target.value))}
                  className="input tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="inv-cost">Cost per unit ({currency})</label>
                <input
                  id="inv-cost"
                  type="number"
                  min="0"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(Number(e.target.value))}
                  className="input tabular-nums"
                />
              </div>
              <div>
                <label className="label" htmlFor="inv-supplier">Supplier</label>
                <input
                  id="inv-supplier"
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Metro Wholesale"
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="inv-expiry">Expiry date</label>
                <input
                  id="inv-expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div className="-mx-6 -mb-5 mt-2 flex justify-end gap-2 border-t border-cream-200 bg-cream-50/60 px-6 py-4">
              <button type="button" onClick={() => setItemModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={formLoading} className="btn-primary">
                {formLoading ? 'Saving…' : editingItem ? 'Save changes' : 'Add material'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record movement */}
      {movementModalOpen && selectedMovementItem && (
        <Modal
          isOpen={movementModalOpen}
          onClose={() => setMovementModalOpen(false)}
          title={movementType === 'IN' ? 'Record delivery' : 'Record usage or waste'}
          description={`${selectedMovementItem.name} · ${selectedMovementItem.current_quantity} ${selectedMovementItem.unit} on hand`}
          maxWidth="md"
        >
          <form onSubmit={handleRecordMovement} className="space-y-4">
            {formError && <Alert tone="error">{formError}</Alert>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="mov-qty">Quantity ({selectedMovementItem.unit})</label>
                <input
                  id="mov-qty"
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={movQty}
                  onChange={(e) => setMovQty(Number(e.target.value))}
                  className="input font-semibold tabular-nums"
                />
              </div>
              <div>
                <label className="label" htmlFor="mov-cost">Total cost ({currency})</label>
                <input
                  id="mov-cost"
                  type="number"
                  min="0"
                  value={movCost}
                  onChange={(e) => setMovCost(Number(e.target.value))}
                  className="input tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="mov-reason">Reason</label>
              <input
                id="mov-reason"
                type="text"
                required
                value={movReason}
                onChange={(e) => setMovReason(e.target.value)}
                className="input"
                placeholder="e.g. Weekly purchase"
              />
            </div>

            <div>
              <label className="label" htmlFor="mov-notes">Notes</label>
              <textarea
                id="mov-notes"
                rows={2}
                value={movNotes}
                onChange={(e) => setMovNotes(e.target.value)}
                placeholder="Invoice number, damage details…"
                className="input resize-none"
              />
            </div>

            <div className="-mx-6 -mb-5 mt-2 flex justify-end gap-2 border-t border-cream-200 bg-cream-50/60 px-6 py-4">
              <button type="button" onClick={() => setMovementModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={formLoading} className={movementType === 'IN' ? 'btn-success' : 'btn-danger'}>
                {formLoading ? 'Recording…' : movementType === 'IN' ? 'Add to stock' : 'Remove from stock'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
