import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Trash2, Receipt, Save, UtensilsCrossed } from 'lucide-react';
import { api } from '../services/api';
import { Product, Cart, CheckoutPayload, ReceiptData } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';
import { CheckoutModal } from '../components/CheckoutModal';
import { Alert, EmptyState, PageHeader, SearchInput, SkeletonCards, formatMoney } from '../components/ui';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=400&q=80';

interface LocalCartItem {
  product_id: number;
  name: string;
  price: number; // Snapshot price
  quantity: number;
}

export const POS: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCartId = searchParams.get('cartId');

  // Master products list
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [menuSearch, setMenuSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Active Carts list for multi-cart tab bar
  const [activeCarts, setActiveCarts] = useState<Cart[]>([]);
  const [selectedCart, setSelectedCart] = useState<Cart | null>(null);
  const [localItems, setLocalItems] = useState<LocalCartItem[]>([]);

  const [loadingCart, setLoadingCart] = useState(false);
  const [savingCart, setSavingCart] = useState(false);
  const [submittingComplete, setSubmittingComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [lastReceiptData, setLastReceiptData] = useState<ReceiptData | null>(null);

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

  const subtotal = Math.round(localItems.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
  const totalItemsCount = localItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleOpenCheckout = () => {
    if (!selectedCart || localItems.length === 0) return;
    setCheckoutError(null);
    setCheckoutOpen(true);
  };

  const handleConfirmCheckout = async (payment: CheckoutPayload) => {
    if (!selectedCart) return;

    setSubmittingComplete(true);
    setCheckoutError(null);

    try {
      const synced = await syncCartItems();
      if (!synced) {
        setCheckoutError('Could not save the cart items. Please try again.');
        return;
      }

      const result = await api.completeCart(selectedCart.id, payment);
      setCheckoutOpen(false);
      setLastReceiptData(result.receiptData);
      setReceiptModalOpen(true);

      setActiveCarts((prev) => prev.filter((c) => c.id !== selectedCart.id));
      setSelectedCart(null);
      setLocalItems([]);
      setSearchParams({}, { replace: true });
    } catch (err: any) {
      setCheckoutError(err.message || 'Failed to complete cart');
    } finally {
      setSubmittingComplete(false);
    }
  };

  const categories = Array.from(
    new Set(products.map((p) => p.category_name).filter((c): c is string => Boolean(c)))
  );
  const query = menuSearch.trim().toLowerCase();
  const visibleProducts = products.filter(
    (p) =>
      (categoryFilter === 'all' || p.category_name === categoryFilter) &&
      (!query || p.name.toLowerCase().includes(query))
  );
  const canCheckout = Boolean(selectedCart) && localItems.length > 0 && !submittingComplete;
  const isBusy = loadingProducts || loadingCart;

  return (
    <div className="mx-auto w-full max-w-[96rem] animate-fade-up">
      <PageHeader
        eyebrow="Point of sale"
        title="Take an order"
        description="Run several carts side by side. Switch between them at any time; items are saved when you switch."
        actions={
          <button onClick={handleCreateNewCart} className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New cart
          </button>
        }
      />

      {/* Open carts */}
      <div className="no-scrollbar -mx-1 mt-6 flex items-center gap-2 overflow-x-auto px-1 pb-1">
        {activeCarts.map((cart) => {
          const isSelected = selectedCart?.id === cart.id;
          const amount = isSelected ? subtotal : Number(cart.total);
          return (
            <button
              key={cart.id}
              onClick={() => handleSwitchCart(cart)}
              className={`flex shrink-0 items-center gap-3 rounded-xl border py-2 pl-3 pr-2 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-choco-800 bg-choco-800 text-cream-50 shadow-soft'
                  : 'border-cream-300 bg-white text-choco-700 hover:border-cream-400 hover:bg-cream-50'
              }`}
            >
              <ShoppingCart className={`h-4 w-4 ${isSelected ? 'text-waffle-300' : 'text-choco-300'}`} />
              <span className="text-sm font-semibold">{cart.cart_number}</span>
              <span
                className={`rounded-md px-2 py-0.5 text-2xs font-semibold tabular-nums ${
                  isSelected ? 'bg-white/10 text-waffle-200' : 'bg-cream-100 text-choco-500'
                }`}
              >
                {formatMoney(amount)}
              </span>
            </button>
          );
        })}

        <button
          onClick={handleCreateNewCart}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-cream-400 px-3.5 py-2.5 text-sm font-medium text-choco-400 transition-colors hover:border-waffle-400 hover:bg-waffle-50/50 hover:text-waffle-700"
        >
          <Plus className="h-4 w-4" />
          Add cart
        </button>
      </div>

      {error && (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Menu */}
        <section className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput value={menuSearch} onChange={setMenuSearch} placeholder="Search the menu" className="sm:w-72" />
            {categories.length > 1 && (
              <div className="segmented no-scrollbar">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`segmented-item ${categoryFilter === 'all' ? 'segmented-item-active' : ''}`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`segmented-item ${categoryFilter === cat ? 'segmented-item-active' : ''}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isBusy ? (
            <SkeletonCards
              count={8}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
              itemClassName="aspect-[4/5]"
            />
          ) : products.length === 0 ? (
            <div className="card">
              <EmptyState icon={UtensilsCrossed} title="The menu is empty" description="Ask an admin to add items before taking orders." />
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="card">
              <EmptyState icon={UtensilsCrossed} title="No matching items" description="Try a different search or category." />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((product) => {
                const cartItem = localItems.find((item) => item.product_id === product.id);
                const qty = cartItem ? cartItem.quantity : 0;
                const unitPrice = product.discount_price || product.price;

                return (
                  <div
                    key={product.id}
                    className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-300 ease-out-expo ${
                      qty > 0
                        ? 'border-waffle-400 shadow-card-hover ring-4 ring-waffle-400/10'
                        : 'border-cream-300/70 shadow-card hover:-translate-y-0.5 hover:shadow-card-hover'
                    } ${!selectedCart ? 'opacity-60' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      disabled={!selectedCart}
                      className="flex flex-1 flex-col text-left disabled:cursor-not-allowed"
                      aria-label={`Add ${product.name}`}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-cream-100">
                        <img
                          src={product.image_url || FALLBACK_IMAGE}
                          alt={product.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 ease-out-expo group-hover:scale-[1.04]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-choco-900/25 via-transparent to-transparent" />
                        {qty > 0 && (
                          <span className="absolute right-2 top-2 flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-waffle-500 px-2 text-xs font-bold tabular-nums text-white shadow-waffle animate-scale-in">
                            {qty}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <h3 className="line-clamp-2 font-sans text-sm font-semibold leading-snug text-choco-900">{product.name}</h3>
                        {product.category_name && <p className="mt-0.5 text-2xs text-choco-400">{product.category_name}</p>}
                        <div className="mt-auto flex items-baseline gap-1.5 pt-2">
                          <span className="font-display text-base font-semibold tabular-nums text-choco-900">₹{unitPrice}</span>
                          {product.discount_price ? (
                            <span className="text-2xs tabular-nums text-choco-300 line-through">₹{product.price}</span>
                          ) : null}
                        </div>
                      </div>
                    </button>

                    <div className="px-3 pb-3">
                      {qty === 0 ? (
                        <button
                          onClick={() => handleAddToCart(product)}
                          disabled={!selectedCart}
                          className="btn-soft btn-sm w-full"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                          Add
                        </button>
                      ) : (
                        <div className="flex items-center justify-between rounded-lg border border-cream-300 bg-cream-50 p-0.5">
                          <button
                            onClick={() => handleUpdateQuantity(product.id, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-choco-600 transition-colors hover:bg-white hover:text-rose-600"
                            aria-label={`Remove one ${product.name}`}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-sm font-semibold tabular-nums text-choco-900">{qty}</span>
                          <button
                            onClick={() => handleUpdateQuantity(product.id, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-waffle-500 text-white shadow-xs transition-colors hover:bg-waffle-600"
                            aria-label={`Add one ${product.name}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Order summary */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="card flex flex-col overflow-hidden lg:max-h-[calc(100dvh-8rem)]">
            <div className="flex items-start justify-between gap-3 border-b border-cream-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-choco-400">Current order</p>
                <h2 className="mt-0.5 truncate font-display text-lg font-semibold text-choco-900">
                  {selectedCart ? selectedCart.cart_number : 'No cart open'}
                </h2>
                {selectedCart && <p className="text-xs text-choco-400">Started by {selectedCart.staff_name}</p>}
              </div>
              {selectedCart && (
                <button onClick={syncCartItems} disabled={savingCart} className="btn-secondary btn-sm shrink-0">
                  <Save className="h-3.5 w-3.5" />
                  {savingCart ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {!selectedCart ? (
                <EmptyState
                  compact
                  icon={ShoppingCart}
                  title="Open a cart to begin"
                  description="Pick an open cart above or start a new one."
                  action={
                    !isBusy && (
                      <button onClick={handleCreateNewCart} className="btn-primary btn-sm">
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        New cart
                      </button>
                    )
                  }
                />
              ) : localItems.length === 0 ? (
                <EmptyState compact icon={UtensilsCrossed} title="Cart is empty" description="Tap any menu item to add it here." />
              ) : (
                <ul className="divide-y divide-cream-200/70 px-2 py-1">
                  {localItems.map((item) => (
                    <li key={item.product_id} className="group flex items-center gap-3 rounded-lg px-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-choco-900">{item.name}</p>
                        <p className="text-xs tabular-nums text-choco-400">₹{item.price} each</p>
                      </div>
                      <div className="flex items-center rounded-lg border border-cream-300 bg-cream-50 p-0.5">
                        <button
                          onClick={() => handleUpdateQuantity(item.product_id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-choco-500 hover:bg-white hover:text-choco-900"
                          aria-label={`Decrease ${item.name}`}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-semibold tabular-nums">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.product_id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-choco-500 hover:bg-white hover:text-choco-900"
                          aria-label={`Increase ${item.name}`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="w-16 text-right text-sm font-semibold tabular-nums text-choco-900">
                        {formatMoney(item.price * item.quantity)}
                      </span>
                      <button
                        onClick={() => handleRemoveItem(item.product_id)}
                        className="-mr-1 rounded-md p-1 text-choco-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-cream-200 bg-cream-50/70 px-5 py-4">
              <div className="flex items-center justify-between text-sm text-choco-500">
                <span>
                  {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
                </span>
                {localItems.length > 0 && (
                  <button onClick={() => setLocalItems([])} className="text-xs font-medium text-choco-400 hover:text-rose-600">
                    Clear all
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-sm font-medium text-choco-700">Subtotal</span>
                <span className="font-display text-2xl font-semibold tabular-nums text-choco-900">
                  {formatMoney(subtotal)}
                </span>
              </div>
              <p className="mt-0.5 text-2xs text-choco-400">GST and discounts are applied at checkout.</p>
              <button onClick={handleOpenCheckout} disabled={!canCheckout} className="btn-primary btn-lg mt-4 hidden w-full lg:flex">
                <Receipt className="h-4 w-4" />
                Checkout
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile checkout dock */}
      <div className="sticky bottom-0 z-20 -mx-4 -mb-6 mt-6 border-t border-choco-700 bg-choco-800/95 px-4 py-3 text-cream-50 shadow-dock backdrop-blur-xl sm:-mx-6 sm:px-6 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-2xs text-cream-300/80">
              {selectedCart ? selectedCart.cart_number : 'No cart'} · {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
            </p>
            <p className="font-display text-xl font-semibold tabular-nums">{formatMoney(subtotal)}</p>
          </div>
          <button onClick={handleOpenCheckout} disabled={!canCheckout} className="btn-primary">
            <Receipt className="h-4 w-4" />
            Checkout
          </button>
        </div>
      </div>

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => !submittingComplete && setCheckoutOpen(false)}
        subtotal={subtotal}
        submitting={submittingComplete}
        error={checkoutError}
        onConfirm={handleConfirmCheckout}
      />

      {/* Printable / Downloadable Receipt Modal */}
      {receiptModalOpen && lastReceiptData && (
        <ReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => {
            setReceiptModalOpen(false);
            if (activeCarts.length > 0) {
              openCartDetails(activeCarts[0]);
            }
          }}
          receiptData={lastReceiptData}
        />
      )}
    </div>
  );
};

export default POS;
