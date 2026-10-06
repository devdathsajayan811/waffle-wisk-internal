export type UserRole = 'ADMIN' | 'STAFF';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  created_at?: string;
  last_login?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  display_order: number;
}

export type ProductAvailability = 'AVAILABLE' | 'UNAVAILABLE' | 'OUT_OF_STOCK';

export interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  description?: string;
  image_url?: string;
  price: number;
  discount_price?: number | null;
  tax_percent: number;
  stock_quantity: number;
  low_stock_threshold: number;
  unit: string;
  availability: ProductAvailability;
  created_at?: string;
  updated_at?: string;
}

export interface PriceHistory {
  id: number;
  product_id: number;
  old_price: number;
  new_price: number;
  updated_by: number;
  updated_by_name: string;
  created_at: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  current_quantity: number;
  unit: string;
  minimum_stock: number;
  cost_per_unit: number;
  supplier?: string;
  last_restocked?: string;
  expiry_date?: string | null;
  stock_value?: number;
  created_at?: string;
  updated_at?: string;
}

export type MovementType = 'IN' | 'OUT' | 'SALE_DEDUCTION' | 'ADJUSTMENT';

export interface InventoryMovement {
  id: number;
  inventory_item_id: number;
  item_name?: string;
  item_unit?: string;
  type: MovementType;
  quantity: number;
  reason: string;
  cost?: number;
  notes?: string;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
}

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'OTHER';
export type PaymentStatus = 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED';
export type OrderStatus = 'COMPLETED' | 'HOLD' | 'CANCELLED' | 'REFUNDED';

export interface OrderItem {
  id?: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  notes?: string;
  subtotal: number;
  discount: number;
  tax: number;
  grand_total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_ref?: string;
  amount_received?: number;
  change_returned?: number;
  staff_id: number;
  staff_name: string;
  status: OrderStatus;
  created_at: string;
  items?: OrderItem[];
}

export interface ReceiptData {
  receiptNumber: string;
  orderNumber: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  items: Array<{ name: string; qty: number; price: number; total: number }>;
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  staffName: string;
  notes?: string;
}

export interface Receipt {
  id: number;
  receipt_number: string;
  order_id: number;
  order_number?: string;
  customer_name?: string;
  customer_phone?: string;
  grand_total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  receipt_data_json: string;
  receipt_data?: ReceiptData;
  created_at: string;
}

export interface BusinessSettings {
  id: number;
  business_name: string;
  logo_url: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  currency_symbol: string;
  receipt_footer: string;
  default_gst_percent: number;
  low_stock_threshold_default: number;
  updated_at?: string;
}

export interface AuditLog {
  id: number;
  action: string;
  user_id: number;
  user_name: string;
  user_role: UserRole;
  description: string;
  ip_address?: string;
  created_at: string;
}

export interface SystemStatus {
  internetStatus: 'Connected' | 'Offline';
  databaseStatus: 'Connected' | 'Disconnected' | 'Error';
  serverStatus: 'Online' | 'Offline';
  lastSyncTime: string;
  applicationHealth: 'Healthy' | 'Warning' | 'Error';
  uptimeSeconds: number;
}

export type RequestStatus = 'Pending' | 'Approved' | 'Completed';

export interface MaterialRequest {
  id: number;
  staff_id: number;
  staff_name: string;
  cart_id?: number;
  cart_number?: string;
  material: string;
  quantity: number;
  unit: string;
  note?: string;
  status: RequestStatus;
  created_at: string;
}

export type CartStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface CartItem {
  id?: number;
  cart_id?: number;
  product_id: number;
  item_name_snapshot: string;
  price_snapshot: number;
  quantity: number;
  subtotal: number;
}

export interface Cart {
  id: number;
  cart_number: string;
  staff_id: number;
  staff_name: string;
  customer_name?: string;
  status: CartStatus;
  total: number;
  created_at: string;
  completed_at?: string;
  items?: CartItem[];
  itemCount?: number;
  receipt?: any;
}
