import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  QrCode,
  CreditCard,
  PauseCircle,
  FileCheck,
  RotateCcw,
  User,
  Phone,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import { Product, Category, PaymentMethod, ReceiptData } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { ReceiptModal } from '../components/ReceiptModal';

export const POS: React.FC = () => {
  const { settings } = useAuth();
  const currency = settings?.currency_symbol || '₹';

  const {
    cart,
    customerName,
    customerPhone,
    notes,
    discount,
    paymentMethod,
    paymentRef,
    amountReceived,
    subtotal,
    taxAmount,
    grandTotal,
    changeReturned,
    addToCart,
    removeFromCart,
    updateQuantity,
    setCustomerName,
    setCustomerPhone,
    setNotes,
    setDiscount,
    setPaymentMethod,
    setPaymentRef,
    setAmountReceived,
    clearCart,
    holdOrder,
    heldOrders,
    loadHeldOrder,
  } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Mobile Tab State: 'products' | 'cart'
  const [activeMobileTab, setActiveMobileTab] = useState<'products' | 'cart'>('products');

  // Payment Confirmation Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Generated Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

  const fetchProductsAndCategories = async () => {
    setLoading(true);
    try {
      const [catsRes, prodsRes] = await Promise.all([
        api.getCategories(),
        api.getProducts({ category: selectedCategory, search: searchTerm }),
      ]);
      setCategories(catsRes);
      setProducts(prodsRes);
    } catch (err) {
      console.error('Failed to load POS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsAndCategories();
  }, [selectedCategory, searchTerm]);

  const handlePay = async () => {
    if (cart.length === 0) return;
    setPaymentError(null);

    if (paymentMethod === 'CASH' && amountReceived < grandTotal) {
      setPaymentError(`Received amount (${currency}${amountReceived}) cannot be less than grand total (${currency}${grandTotal})`);
      return;
    }

    setPaymentLoading(true);

    try {
      const orderPayload = {
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        customer_name: customerName,
        customer_phone: customerPhone,
        notes,
        discount,
        payment_method: paymentMethod,
        payment_status: 'PAID',
        payment_ref: paymentRef,
        amount_received: paymentMethod === 'CASH' ? amountReceived : grandTotal,
      };

      const res = await api.createOrder(orderPayload);
      setActiveReceipt(res.receiptData);
      setPaymentModalOpen(false);
      setReceiptModalOpen(true);
      clearCart();
    } catch (err: any) {
      setPaymentError(err.message || 'Payment processing failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col lg:flex-row gap-4 overflow-hidden">
      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex bg-white p-1 rounded-xl border border-cream-300 shadow-2xs shrink-0">
        <button
          onClick={() => setActiveMobileTab('products')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-1 ${
            activeMobileTab === 'products' ? 'bg-waffle-500 text-white shadow-xs' : 'text-choco-700'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Products Menu ({products.length})</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('cart')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-1 relative ${
            activeMobileTab === 'cart' ? 'bg-waffle-500 text-white shadow-xs' : 'text-choco-700'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Current Cart ({cart.reduce((sum, i) => sum + i.quantity, 0)})</span>
          {cart.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2 right-4 animate-ping" />
          )}
        </button>
      </div>

      {/* LEFT SECTION: PRODUCT CATALOGUE */}
      <div
        className={`flex-1 flex flex-col bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden ${
          activeMobileTab === 'cart' ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Top Controls: Search & Category Pills */}
        <div className="p-4 border-b border-cream-200 space-y-3 bg-cream-50/50">
          <div className="relative">
            <Search className="w-4 h-4 text-choco-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search waffle name, code or topping..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400 bg-white"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-choco-800 text-cream-50 shadow-xs'
                  : 'bg-cream-200/80 text-choco-700 hover:bg-cream-300'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.slug)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat.slug
                    ? 'bg-waffle-500 text-white shadow-xs'
                    : 'bg-cream-200/80 text-choco-700 hover:bg-cream-300'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-choco-400">
              Loading menu products...
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((prod) => {
                const isAvailable = prod.availability === 'AVAILABLE' && prod.stock_quantity > 0;
                const inCart = cart.find((i) => i.product.id === prod.id);

                return (
                  <div
                    key={prod.id}
                    onClick={() => isAvailable && addToCart(prod)}
                    className={`group relative bg-cream-50/40 rounded-2xl border transition-all duration-200 p-3 flex flex-col justify-between cursor-pointer select-none ${
                      isAvailable
                        ? 'border-cream-200/80 hover:border-waffle-400 hover:shadow-soft hover:-translate-y-0.5'
                        : 'border-gray-200 opacity-60 bg-gray-50'
                    } ${inCart ? 'ring-2 ring-waffle-500 bg-waffle-50/20' : ''}`}
                  >
                    {/* Badge */}
                    <div className="absolute top-2 left-2 z-10">
                      <StatusBadge status={prod.availability} type="availability" />
                    </div>

                    {inCart && (
                      <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-waffle-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                        {inCart.quantity}
                      </div>
                    )}

                    {/* Image */}
                    <div className="w-full h-28 rounded-xl overflow-hidden mb-2.5 bg-cream-200/60 relative">
                      <img
                        src={prod.image_url || 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=400&q=80'}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e: any) => {
                          e.target.src = 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=400&q=80';
                        }}
                      />
                    </div>

                    {/* Product Details */}
                    <div>
                      <h4 className="font-bold text-xs text-choco-900 line-clamp-1 leading-tight">{prod.name}</h4>
                      <p className="text-[10px] text-choco-500 truncate mb-2">{prod.category_name}</p>

                      <div className="flex items-center justify-between">
                        <div>
                          {prod.discount_price ? (
                            <div className="flex items-baseline space-x-1">
                              <span className="font-extrabold text-sm text-waffle-600">
                                {currency}{prod.discount_price}
                              </span>
                              <span className="text-[10px] text-gray-400 line-through">
                                {currency}{prod.price}
                              </span>
                            </div>
                          ) : (
                            <span className="font-extrabold text-sm text-choco-900">
                              {currency}{prod.price}
                            </span>
                          )}
                        </div>

                        <button
                          disabled={!isAvailable}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAvailable) addToCart(prod);
                          }}
                          className={`p-1.5 rounded-lg text-white font-bold transition-all shadow-2xs ${
                            isAvailable
                              ? 'bg-waffle-500 hover:bg-waffle-600 active:scale-95'
                              : 'bg-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-choco-400">
              <ShoppingBag className="w-12 h-12 mb-2 text-cream-300" />
              <p className="font-bold text-sm">No products found</p>
              <p className="text-xs">Try selecting a different category or clearing search.</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SECTION: POS CART CHECKOUT DRAWER */}
      <div
        className={`w-full lg:w-96 bg-white rounded-2xl border border-cream-200 shadow-soft flex flex-col overflow-hidden ${
          activeMobileTab === 'products' ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Cart Header */}
        <div className="p-4 border-b border-cream-200 bg-cream-50/50 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-choco-900">Current Cart Ticket</h3>
            <p className="text-[11px] text-choco-500">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} items in order
            </p>
          </div>

          <div className="flex space-x-1">
            {heldOrders.length > 0 && (
              <button
                onClick={() => loadHeldOrder(heldOrders[0].id)}
                className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-300 flex items-center"
                title="Restore Held Order"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Held ({heldOrders.length})
              </button>
            )}
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-30"
              title="Clear Cart"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-cream-100">
          {cart.length > 0 ? (
            cart.map((item) => {
              const unitPrice = item.product.discount_price ? Number(item.product.discount_price) : Number(item.product.price);
              const itemTotal = unitPrice * item.quantity;

              return (
                <div key={item.product.id} className="pt-3 first:pt-0 flex items-center justify-between">
                  <div className="pr-2 flex-1">
                    <h5 className="font-bold text-xs text-choco-900 line-clamp-1">{item.product.name}</h5>
                    <p className="text-[10px] text-choco-500">
                      {currency}{unitPrice} x {item.quantity}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center border border-cream-300 rounded-lg bg-cream-50/50">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 text-choco-600 hover:bg-cream-200 rounded-l-lg"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-bold text-choco-900">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 text-choco-600 hover:bg-cream-200 rounded-r-lg"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-extrabold text-xs text-choco-900 w-14 text-right">
                      {currency}{itemTotal}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-choco-400">
              <ShoppingBag className="w-10 h-10 mb-2 text-cream-300" />
              <p className="font-bold text-xs">Cart is empty</p>
              <p className="text-[11px]">Select items from menu to start order.</p>
            </div>
          )}
        </div>

        {/* Customer Details Inputs */}
        <div className="p-4 border-t border-cream-200 bg-cream-50/30 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <User className="w-3.5 h-3.5 text-choco-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Guest Name"
                className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-cream-300 focus:outline-hidden focus:ring-1 focus:ring-waffle-400 bg-white"
              />
            </div>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-choco-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone Number"
                className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-cream-300 focus:outline-hidden focus:ring-1 focus:ring-waffle-400 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Totals Breakdown & Action Buttons */}
        <div className="p-4 border-t border-cream-200 bg-white space-y-2">
          <div className="space-y-1 text-xs text-choco-700">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold">{currency}{subtotal}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Discount ({currency})</span>
              <input
                type="number"
                min="0"
                value={discount || ''}
                onChange={(e) => setDiscount(Number(e.target.value))}
                placeholder="0"
                className="w-16 px-1.5 py-0.5 text-xs text-right rounded-md border border-cream-300 focus:outline-hidden"
              />
            </div>
            <div className="flex justify-between">
              <span>GST Tax ({settings?.default_gst_percent || 5}%)</span>
              <span className="font-semibold">{currency}{taxAmount}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-choco-900 pt-2 border-t border-cream-200">
              <span>GRAND TOTAL</span>
              <span className="text-waffle-600 text-base">{currency}{grandTotal}</span>
            </div>
          </div>

          <div className="pt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={holdOrder}
              disabled={cart.length === 0}
              className="py-2.5 px-3 bg-cream-200 hover:bg-cream-300 text-choco-800 text-xs font-bold rounded-xl flex items-center justify-center space-x-1 disabled:opacity-40"
            >
              <PauseCircle className="w-4 h-4" />
              <span>Hold Order</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentModalOpen(true)}
              disabled={cart.length === 0}
              className="py-2.5 px-3 bg-gradient-to-r from-waffle-500 to-waffle-600 hover:from-waffle-600 hover:to-waffle-700 text-white text-xs font-extrabold rounded-xl shadow-waffle flex items-center justify-center space-x-1 disabled:opacity-40"
            >
              <FileCheck className="w-4 h-4" />
              <span>Pay & Checkout</span>
            </button>
          </div>
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-choco-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl border border-cream-200">
            <div className="flex items-center justify-between border-b border-cream-200 pb-3">
              <h3 className="font-extrabold text-lg text-choco-900">Complete Payment</h3>
              <span className="text-xl font-extrabold text-waffle-600">{currency}{grandTotal}</span>
            </div>

            {paymentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {paymentError}
              </div>
            )}

            {/* Select Payment Method */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-choco-800 uppercase tracking-wider">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    paymentMethod === 'CASH'
                      ? 'border-waffle-500 bg-waffle-50 text-waffle-700 shadow-xs'
                      : 'border-cream-300 bg-cream-50/50 text-choco-700 hover:bg-cream-100'
                  }`}
                >
                  <DollarSign className="w-5 h-5" />
                  <span>CASH</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    paymentMethod === 'UPI'
                      ? 'border-waffle-500 bg-waffle-50 text-waffle-700 shadow-xs'
                      : 'border-cream-300 bg-cream-50/50 text-choco-700 hover:bg-cream-100'
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                  <span>UPI / QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    paymentMethod === 'CARD'
                      ? 'border-waffle-500 bg-waffle-50 text-waffle-700 shadow-xs'
                      : 'border-cream-300 bg-cream-50/50 text-choco-700 hover:bg-cream-100'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span>CARD</span>
                </button>
              </div>
            </div>

            {/* Payment Method Specific Input */}
            {paymentMethod === 'CASH' ? (
              <div className="space-y-3 bg-cream-50/60 p-4 rounded-2xl border border-cream-200">
                <div>
                  <label className="block text-xs font-semibold text-choco-700 mb-1">
                    Cash Amount Received ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={amountReceived || ''}
                    onChange={(e) => setAmountReceived(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-base font-extrabold rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400 bg-white"
                    placeholder={`e.g. ${grandTotal}`}
                  />
                </div>

                <div className="flex justify-between items-center text-xs font-bold pt-1">
                  <span className="text-choco-600">Change to Return:</span>
                  <span className="text-lg text-emerald-600">{currency}{changeReturned}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-cream-50/60 p-4 rounded-2xl border border-cream-200">
                <div>
                  <label className="block text-xs font-semibold text-choco-700 mb-1">
                    Transaction / Reference ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden focus:ring-2 focus:ring-waffle-400 bg-white font-mono"
                    placeholder="e.g. UPI-9876543210 or TXN-102"
                  />
                </div>
                <p className="text-[11px] text-choco-500">
                  Confirm that customer has completed payment of {currency}{grandTotal} via {paymentMethod}.
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="flex-1 py-3 px-4 bg-cream-200 hover:bg-cream-300 text-choco-800 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePay}
                disabled={paymentLoading}
                className="flex-1 py-3 px-4 bg-waffle-500 hover:bg-waffle-600 text-white text-xs font-extrabold rounded-xl shadow-waffle flex items-center justify-center space-x-1"
              >
                {paymentLoading ? 'Confirming...' : 'Confirm & Print Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {receiptModalOpen && activeReceipt && (
        <ReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          receiptData={activeReceipt}
          onNewOrder={() => {
            setReceiptModalOpen(false);
            setActiveMobileTab('products');
          }}
        />
      )}
    </div>
  );
};
