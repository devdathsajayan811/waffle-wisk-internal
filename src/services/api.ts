import {
  User,
  Category,
  Product,
  PriceHistory,
  InventoryItem,
  InventoryMovement,
  Order,
  Receipt,
  BusinessSettings,
  AuditLog,
  SystemStatus,
} from '../types';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('waffle_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('waffle_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('waffle_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const isLoginRequest = endpoint.startsWith('/auth/login');

  if ((response.status === 401 || response.status === 403) && !isLoginRequest) {
    removeAuthToken();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Session expired or unauthorized');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API Request failed');
  }

  return data as T;
}

export const api = {
  // Auth
  login: (identifier: string, password: string) =>
    request<{ token: string; user: User; settings: BusinessSettings }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  getCurrentUser: () => request<{ user: User; settings: BusinessSettings }>('/auth/me'),

  changePassword: (data: any) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string; devHint?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Products & Categories
  getCategories: () => request<Category[]>('/products/categories'),

  getProducts: (params?: { category?: string; availability?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.availability) query.append('availability', params.availability);
    if (params?.search) query.append('search', params.search);
    return request<Product[]>(`/products?${query.toString()}`);
  },

  getProduct: (id: number) => request<{ product: Product; priceHistory: PriceHistory[] }>(`/products/${id}`),

  createProduct: (data: Partial<Product>) =>
    request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProduct: (id: number, data: Partial<Product>) =>
    request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateProductPrice: (id: number, price: number, discount_price?: number | null) =>
    request<{ message: string; newPrice: number; priceHistory: PriceHistory[] }>(`/products/${id}/price`, {
      method: 'PATCH',
      body: JSON.stringify({ price, discount_price }),
    }),

  toggleProductStatus: (id: number) =>
    request<{ message: string; availability: string }>(`/products/${id}/toggle-status`, {
      method: 'PATCH',
    }),

  deleteProduct: (id: number) =>
    request<{ message: string }>(`/products/${id}`, {
      method: 'DELETE',
    }),

  uploadProductImage: async (file: File): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    return request<{ imageUrl: string }>('/products/upload-image', {
      method: 'POST',
      body: formData,
    });
  },

  // Inventory
  getInventory: (params?: { category?: string; low_stock_only?: boolean; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.low_stock_only) query.append('low_stock_only', 'true');
    if (params?.search) query.append('search', params.search);
    return request<InventoryItem[]>(`/inventory?${query.toString()}`);
  },

  getLowStock: () => request<{ inventory: InventoryItem[]; products: Product[] }>('/inventory/low-stock'),

  getMovements: (params?: { itemId?: number; type?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.itemId) query.append('itemId', params.itemId.toString());
    if (params?.type) query.append('type', params.type);
    if (params?.limit) query.append('limit', params.limit.toString());
    return request<InventoryMovement[]>(`/inventory/movements?${query.toString()}`);
  },

  createInventoryItem: (data: Partial<InventoryItem>) =>
    request<InventoryItem>('/inventory', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateInventoryItem: (id: number, data: Partial<InventoryItem>) =>
    request<InventoryItem>(`/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  recordMovement: (data: { inventory_item_id: number; type: string; quantity: number; reason: string; cost?: number; notes?: string }) =>
    request<{ message: string; item: InventoryItem }>('/inventory/movements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Orders & POS
  createOrder: (data: any) =>
    request<{ order: Order; items: any[]; receiptNumber: string; receiptData: any }>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getOrders: (params?: { date_range?: string; start_date?: string; end_date?: string; payment_method?: string; status?: string; staff_id?: string; search?: string; own_sales_only?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.date_range) query.append('date_range', params.date_range);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    if (params?.payment_method) query.append('payment_method', params.payment_method);
    if (params?.status) query.append('status', params.status);
    if (params?.staff_id) query.append('staff_id', params.staff_id);
    if (params?.search) query.append('search', params.search);
    if (params?.own_sales_only) query.append('own_sales_only', 'true');
    return request<Order[]>(`/orders?${query.toString()}`);
  },

  getOrder: (id: number) => request<{ order: Order; items: any[]; receipt: Receipt }>(`/orders/${id}`),

  refundOrder: (id: number) =>
    request<{ message: string }>(`/orders/${id}/refund`, {
      method: 'PATCH',
    }),

  // Receipts
  getReceipts: (params?: { search?: string; start_date?: string; end_date?: string; payment_method?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    if (params?.payment_method) query.append('payment_method', params.payment_method);
    return request<Receipt[]>(`/receipts?${query.toString()}`);
  },

  getReceipt: (id: string | number) => request<Receipt>(`/receipts/${id}`),

  // Users (Admin Only)
  getUsers: () => request<User[]>('/users'),

  createUser: (data: any) =>
    request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: number, data: any) =>
    request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  resetUserPassword: (id: number, new_password: string) =>
    request<{ message: string }>(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password }),
    }),

  // Reports
  getSalesReport: (range: string = '7days') => request<any>(`/reports/sales?range=${range}`),
  getProductReport: () => request<any[]>('/reports/products'),
  getPaymentReport: () => request<any[]>('/reports/payments'),
  getInventoryReport: () => request<{ items: InventoryItem[]; totalValuation: number }>('/reports/inventory'),

  // Settings
  getSettings: () => request<BusinessSettings>('/settings'),
  updateSettings: (data: Partial<BusinessSettings>) =>
    request<BusinessSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Audit Logs
  getAuditLogs: (params?: { action?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.action) query.append('action', params.action);
    if (params?.limit) query.append('limit', params.limit.toString());
    return request<AuditLog[]>(`/audit-logs?${query.toString()}`);
  },

  // System Status
  getSystemStatus: () => request<SystemStatus>('/status'),
};
