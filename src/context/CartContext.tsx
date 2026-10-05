import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, PaymentMethod } from '../types';
import { useAuth } from './AuthContext';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  customerName: string;
  customerPhone: string;
  notes: string;
  discount: number;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  amountReceived: number;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  changeReturned: number;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setNotes: (notes: string) => void;
  setDiscount: (discount: number) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setPaymentRef: (ref: string) => void;
  setAmountReceived: (amount: number) => void;
  clearCart: () => void;
  holdOrder: () => void;
  heldOrders: Array<{ id: string; name: string; time: string; cart: CartItem[] }>;
  loadHeldOrder: (id: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useAuth();
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('waffle_cart_draft');
    return saved ? JSON.parse(saved) : [];
  });

  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [heldOrders, setHeldOrders] = useState<Array<{ id: string; name: string; time: string; cart: CartItem[] }>>(() => {
    const saved = localStorage.getItem('waffle_held_orders');
    return saved ? JSON.parse(saved) : [];
  });

  // Save cart draft locally
  useEffect(() => {
    localStorage.setItem('waffle_cart_draft', JSON.stringify(cart));
  }, [cart]);

  // Save held orders locally
  useEffect(() => {
    localStorage.setItem('waffle_held_orders', JSON.stringify(heldOrders));
  }, [heldOrders]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setDiscount(0);
    setPaymentRef('');
    setAmountReceived(0);
    localStorage.removeItem('waffle_cart_draft');
  };

  const holdOrder = () => {
    if (cart.length === 0) return;
    const held = {
      id: `HOLD-${Date.now().toString().slice(-4)}`,
      name: customerName || 'Walk-in Guest',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cart: [...cart],
    };
    setHeldOrders((prev) => [held, ...prev]);
    clearCart();
  };

  const loadHeldOrder = (id: string) => {
    const target = heldOrders.find((h) => h.id === id);
    if (target) {
      setCart(target.cart);
      setCustomerName(target.name === 'Walk-in Guest' ? '' : target.name);
      setHeldOrders((prev) => prev.filter((h) => h.id !== id));
    }
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => {
    const price = item.product.discount_price ? Number(item.product.discount_price) : Number(item.product.price);
    return sum + price * item.quantity;
  }, 0);

  const gstRate = settings?.default_gst_percent !== undefined ? Number(settings.default_gst_percent) : 5.0;
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Number(((taxable * gstRate) / 100).toFixed(2));
  const grandTotal = Number((taxable + taxAmount).toFixed(2));

  const changeReturned = paymentMethod === 'CASH' ? Math.max(0, Number((amountReceived - grandTotal).toFixed(2))) : 0;

  return (
    <CartContext.Provider
      value={{
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
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
