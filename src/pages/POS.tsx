import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Trash2, Receipt, AlertCircle, PlusCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { Product, Cart } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';
import { useAuth } from '../context/AuthContext';

interface LocalCartItem {
  product_id: number;
  name: string;
  price: number; // Snapshot price
  quantity: number;
}

export const POS: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCartId = searchParams.get('cartId');

  // Master products list
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Active Carts list for multi-cart tab bar
  const [activeCarts, setActiveCarts] = useState<Cart[]>([]);
  const [selectedCart, setSelectedCart] = useState<Cart | null>(null);
  const [localItems, setLocalItems] = useState<LocalCartItem[]>([]);

  const [loadingCart, setLoadingCart] = useState(false);
  const [savingCart, setSavingCart] = useState(false);
  const [submittingComplete, setSubmittingComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [lastReceiptData, setLastReceiptData] = useState<any | null>(null);

  // Fetch Master Products & Active Carts on load
  const fetchActiveCartsAndProducts = async () => {
    try {
      setLoadingProducts(true);
      const [prodsData, cartsData] = await Promise.all([
        api.getProducts({ availability: 'AVAILABLE' }),
        api.getCarts({ status: 'ACTIVE' }),
      ]);

      setProducts(prodsData);
      setActiveCarts(cartsData);

      // Determine which cart to open
      let targetCart: Cart | null = null;

      if (queryCartId) {
        targetCart = cartsData.find((c) => c.id === Number(queryCartId)) || null;
      }

      if (!targetCart && cartsData.length > 0) {
        targetCart = cartsData[0];
      }

      if (targetCart) {
        openCartDetails(targetCart);
      } else {
        // Automatically create initial cart if no active carts exist
        handleCreateNewCart();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize cart system');
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchActiveCartsAndProducts();
  }, []);

  const openCartDetails = async (cartObj: Cart) => {
    try {
      setLoadingCart(true);
      const fullCart = await api.getCart(cartObj.id);
      setSelectedCart(fullCart);
      setSearchParams({ cartId: fullCart.id.toString() }, { replace: true });

      // Transform backend items to local format preserving price_snapshot!
      if (fullCart.items && fullCart.items.length > 0) {
        const itemsList: LocalCartItem[] = fullCart.items.map((i) => ({
          product_id: i.product_id,
          name: i.item_name_snapshot,
          price: i.price_snapshot,
          quantity: i.quantity,
        }));
        setLocalItems(itemsList);
      } else {
        setLocalItems([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load cart details');
    } finally {
      setLoadingCart(false);
    }
  };

  const handleCreateNewCart = async () => {
    setError(null);
    try {
      const newCart = await api.createCart();
      setActiveCarts((prev) => [newCart, ...prev]);
      openCartDetails(newCart);
    } catch (err: any) {
      setError(err.message || 'Failed to create new cart');
    }
  };

  const handleAddToCart = (product: Product) => {
    if (!selectedCart) return;

    setLocalItems((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // Read current master price snapshot at addition time
      const unitPrice = product.discount_price ? Number(product.discount_price) : Number(product.price);
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          price: unitPrice,
          quantity: 1,
        },
      ];
    });
  };

  const handleUpdateQuantity = (productId: number, delta: number) => {
    setLocalItems((prev) =>
      prev
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as LocalCartItem[]
    );
  };

  const handleRemoveItem = (productId: number) => {
    setLocalItems((prev) => prev.filter((item) => item.product_id !== productId));
  };

  // Sync / Save current cart state to backend
  const syncCartItems = async (): Promise<boolean> => {
    if (!selectedCart) return false;
    setSavingCart(true);
    try {
      const updatedCart = await api.updateCartItems(
        selectedCart.id,
        localItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity }))
      );
      setSelectedCart(updatedCart);
      setActiveCarts((prev) => prev.map((c) => (c.id === updatedCart.id ? updatedCart : c)));
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to save cart items');
      return false;
    } finally {
      setSavingCart(false);
    }
  };

  const handleSwitchCart = async (targetCart: Cart) => {
    if (selectedCart && selectedCart.id !== targetCart.id) {
      await syncCartItems();
    }
    openCartDetails(targetCart);
  };

  const grandTotal = localItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItemsCount = localItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleCompleteCart = async () => {
    if (!selectedCart || localItems.length === 0) return;

    setSubmittingComplete(true);
    setError(null);

    try {
      // First sync current items
      const synced = await syncCartItems();
      if (!synced) return;

      // Complete cart
      const result = await api.completeCart(selectedCart.id);
      setLastReceiptData(result.receiptData);
      setReceiptModalOpen(true);

      // Remove completed cart from active list
      setActiveCarts((prev) => prev.filter((c) => c.id !== selectedCart.id));
      setSelectedCart(null);
      setLocalItems([]);
    } catch (err: any) {
      setError(err.message || 'Failed to complete cart');
    } finally {
      setSubmittingComplete(false);
    }
  };

  return (
    <div className="space-y-5 pb-28 max-w-7xl mx-auto">
      {/* Header & Multi-Cart Selector Tabs */}
      <div className="space-y-3 border-b border-cream-300 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-choco-900 flex items-center">
              <ShoppingCart className="w-7 h-7 mr-2 text-waffle-500" />
              Multi-Cart Manager
            </h1>
            <p className="text-xs text-choco-600 font-medium">
              Manage multiple independent active carts simultaneously.
            </p>
          </div>

          <button
            onClick={handleCreateNewCart}
            className="py-2.5 px-4 bg-waffle-500 hover:bg-waffle-600 text-white font-extrabold text-xs rounded-xl shadow-waffle flex items-center space-x-1 shrink-0 self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Create New Cart</span>
          </button>
        </div>

        {/* ACTIVE CARTS TAB BAR */}
        <div className="flex items-center space-x-2 overflow-x-auto pt-2 pb-1 no-scrollbar">
          {activeCarts.map((cart) => {
            const isSelected = selectedCart?.id === cart.id;
            return (
              <button
                key={cart.id}
                onClick={() => handleSwitchCart(cart)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black shrink-0 transition-all flex items-center space-x-2 border ${
                  isSelected
                    ? 'bg-choco-900 text-white border-choco-900 shadow-soft'
                    : 'bg-white text-choco-800 border-cream-300 hover:bg-cream-100'
                }`}
              >
                <span>{cart.cart_number}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] ${isSelected ? 'bg-waffle-500 text-white' : 'bg-cream-200 text-choco-700'}`}>
                  ₹{cart.id === selectedCart?.id ? grandTotal : cart.total}
                </span>
              </button>
            );
          })}

          <button
            onClick={handleCreateNewCart}
            className="px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-cream-200 hover:bg-cream-300 text-choco-800 border border-cream-300 shrink-0 flex items-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>Add Cart</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Selected Cart Info Bar */}
      {selectedCart && (
        <div className="bg-waffle-50 border border-waffle-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-waffle-900 font-medium">
          <div>
            <strong>Active Cart:</strong> {selectedCart.cart_number} • Staff: {selectedCart.staff_name}
          </div>
          <button
            onClick={syncCartItems}
            disabled={savingCart}
            className="text-waffle-700 hover:text-waffle-900 font-bold underline"
          >
            {savingCart ? 'Saving...' : 'Save Draft'}
          </button>
        </div>
      )}

      {/* Main Grid: Item Menu */}
      {loadingProducts || loadingCart ? (
        <div className="py-20 text-center text-xs font-bold text-choco-500">
          Loading menu items & cart...
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center text-xs font-bold text-choco-500">
          No items available. Please ask Admin to add items.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map((product) => {
            const cartItem = localItems.find((item) => item.product_id === product.id);
            const qty = cartItem ? cartItem.quantity : 0;

            return (
              <div
                key={product.id}
                className={`bg-white rounded-3xl p-3.5 border transition-all duration-200 flex flex-col justify-between shadow-soft hover:shadow-soft-lg ${
                  qty > 0 ? 'border-waffle-500 ring-2 ring-waffle-400/20' : 'border-cream-300'
                }`}
              >
                <div>
                  {/* Image */}
                  <div className="aspect-square w-full rounded-2xl overflow-hidden bg-cream-100 mb-3 border border-cream-200">
                    <img
                      src={product.image_url || 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=400&q=80'}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Name & Price */}
                  <h3 className="font-extrabold text-choco-900 text-sm leading-snug line-clamp-2">
                    {product.name}
                  </h3>
                  <p className="font-black text-emerald-600 text-base mt-1">
                    ₹{product.price}
                  </p>
                </div>

                {/* Quantity Controls */}
                <div className="mt-3 pt-2 border-t border-cream-200">
                  {qty === 0 ? (
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="w-full py-2 bg-waffle-50 hover:bg-waffle-100 text-waffle-800 font-extrabold text-xs rounded-xl border border-waffle-300 transition-colors flex items-center justify-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Item</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between bg-cream-100 p-1 rounded-xl border border-cream-300">
                      <button
                        onClick={() => handleUpdateQuantity(product.id, -1)}
                        className="w-8 h-8 rounded-lg bg-white text-choco-800 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center font-bold shadow-xs transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <span className="font-black text-choco-900 text-sm px-2">
                        {qty}
                      </span>

                      <button
                        onClick={() => handleUpdateQuantity(product.id, 1)}
                        className="w-8 h-8 rounded-lg bg-waffle-500 text-white hover:bg-waffle-600 flex items-center justify-center font-bold shadow-xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Items Summary List */}
      {localItems.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-cream-300 shadow-soft">
          <h2 className="text-xs font-extrabold text-choco-800 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Current Cart Items ({totalItemsCount})</span>
            <button
              onClick={() => setLocalItems([])}
              className="text-rose-600 hover:text-rose-700 text-xs font-bold underline"
            >
              Clear Items
            </button>
          </h2>

          <div className="divide-y divide-cream-200">
            {localItems.map((item) => (
              <div key={item.product_id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-choco-900 text-sm">
                    {item.name}
                  </span>
                  <span className="text-xs text-choco-500 block">
                    ₹{item.price} × {item.quantity} = ₹{item.price * item.quantity}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleUpdateQuantity(item.product_id, -1)}
                    className="w-7 h-7 rounded-lg bg-cream-100 text-choco-800 flex items-center justify-center font-bold"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <span className="font-black text-choco-900 text-xs px-1">
                    {item.quantity}
                  </span>

                  <button
                    onClick={() => handleUpdateQuantity(item.product_id, 1)}
                    className="w-7 h-7 rounded-lg bg-waffle-500 text-white flex items-center justify-center font-bold"
                  >
                    <Plus className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => handleRemoveItem(item.product_id)}
                    className="text-rose-500 hover:text-rose-700 p-1 ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky Bottom Summary Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-choco-900/95 backdrop-blur-md text-white border-t border-choco-700 p-4 z-30 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-cream-300 block uppercase tracking-wider">
              {selectedCart ? selectedCart.cart_number : 'Cart Summary'} ({totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'})
            </span>
            <span className="text-2xl font-black text-emerald-400">
              Total: ₹{grandTotal.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleCompleteCart}
              disabled={localItems.length === 0 || submittingComplete}
              className="py-3.5 px-7 bg-gradient-to-r from-waffle-500 to-waffle-600 hover:from-waffle-600 hover:to-waffle-700 text-white font-black text-sm rounded-2xl shadow-waffle transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Receipt className="w-5 h-5" />
              <span>{submittingComplete ? 'Completing...' : 'Complete & Print Receipt'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printable / Downloadable Receipt Modal */}
      {receiptModalOpen && lastReceiptData && (
        <ReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => {
            setReceiptModalOpen(false);
            if (activeCarts.length > 0) {
              openCartDetails(activeCarts[0]);
            } else {
              handleCreateNewCart();
            }
          }}
          receiptData={lastReceiptData}
        />
      )}
    </div>
  );
};

export default POS;
