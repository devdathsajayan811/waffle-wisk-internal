import { randomUUID } from 'crypto';
import { z } from 'zod';
import type { Queryable } from '../db/index.js';
import { audit } from '../lib/audit.js';
import { badRequest, conflict, formatNumber, notFound, optionalNumber, optionalString, roundMoney } from '../lib/http.js';
import type { AuthUser } from '../middleware/auth.js';

export const paymentMethods = ['CASH', 'UPI', 'CARD', 'OTHER'] as const;

export const checkoutSchema = z.object({
  customer_name: optionalString(100),
  customer_phone: optionalString(20),
  notes: optionalString(500),
  discount: optionalNumber(z.number().min(0, 'Discount cannot be negative')),
  payment_method: z.enum(paymentMethods, { errorMap: () => ({ message: 'Payment method must be CASH, UPI, CARD or OTHER' }) }),
  payment_status: z.enum(['PAID', 'PENDING', 'FAILED']).optional(),
  payment_ref: optionalString(100),
  amount_received: optionalNumber(z.number().min(0)),
});

export type CheckoutInput = z.output<typeof checkoutSchema>;

export const orderLineSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int('Quantity must be a whole number').min(1, 'Quantity must be at least 1').max(1000),
});

export interface OrderLine {
  product_id: number;
  quantity: number;
  /** Price captured when the item was added to a cart; defaults to the current product price. */
  unit_price?: number;
  name?: string;
}

interface ProductRow {
  id: number;
  name: string;
  price: number;
  discount_price: number | null;
  stock_quantity: number;
  availability: string;
  is_archived: number;
}

export interface ReceiptData {
  receiptNumber: string;
  orderNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  items: Array<{ name: string; qty: number; price: number; total: number }>;
  subtotal: number;
  discount: number;
  tax: number;
  taxPercent: number;
  grandTotal: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentRef: string;
  amountReceived: number;
  changeReturned: number;
  staffName: string;
  notes: string;
}

function mergeLines(lines: OrderLine[]): OrderLine[] {
  const merged = new Map<number, OrderLine>();
  for (const line of lines) {
    const existing = merged.get(line.product_id);
    if (existing) existing.quantity += line.quantity;
    else merged.set(line.product_id, { ...line });
  }
  return [...merged.values()];
}

/**
 * Creates a complete order inside the caller's transaction: validates products
 * and stock, computes tax from business settings, records payment, deducts
 * stock, and writes the receipt and audit log.
 */
export async function createOrder(
  tx: Queryable,
  actor: AuthUser,
  rawLines: OrderLine[],
  checkout: CheckoutInput,
  options: { cartId?: number; ip?: string } = {}
) {
  const lines = mergeLines(rawLines);
  if (lines.length === 0) throw badRequest('Order must contain at least one item');

  const placeholders = lines.map(() => '?').join(', ');
  const products = await tx.all<ProductRow>(
    `SELECT id, name, price, discount_price, stock_quantity, availability, is_archived FROM products WHERE id IN (${placeholders})`,
    lines.map((l) => l.product_id)
  );
  const productById = new Map(products.map((p) => [p.id, p]));

  const paymentStatus = checkout.payment_status ?? 'PAID';
  const failed = paymentStatus === 'FAILED';

  const items = lines.map((line) => {
    const product = productById.get(line.product_id);
    if (!product) throw badRequest(`Product ID ${line.product_id} not found`);
    if (product.is_archived) throw badRequest(`'${product.name}' is no longer sold`);
    if (product.availability !== 'AVAILABLE') throw badRequest(`'${product.name}' is currently unavailable`);
    if (!failed && product.stock_quantity < line.quantity) {
      throw conflict(`Insufficient stock for '${product.name}' (available: ${product.stock_quantity})`);
    }
    const unitPrice = line.unit_price ?? Number(product.discount_price || product.price);
    return {
      productId: product.id,
      name: line.name ?? product.name,
      qty: line.quantity,
      price: unitPrice,
      total: roundMoney(unitPrice * line.quantity),
    };
  });

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const discount = roundMoney(checkout.discount ?? 0);
  if (discount > subtotal) throw badRequest('Discount cannot exceed the order subtotal');

  const settings = await tx.get<{ default_gst_percent: number }>(
    'SELECT default_gst_percent FROM business_settings WHERE id = 1'
  );
  const taxPercent = Number(settings?.default_gst_percent ?? 5);
  const tax = roundMoney(((subtotal - discount) * taxPercent) / 100);
  const grandTotal = roundMoney(subtotal - discount + tax);

  let amountReceived = paymentStatus === 'PAID' ? grandTotal : 0;
  let changeReturned = 0;
  if (checkout.payment_method === 'CASH' && paymentStatus === 'PAID') {
    amountReceived = roundMoney(checkout.amount_received ?? grandTotal);
    if (amountReceived < grandTotal) {
      throw badRequest(`Received amount (₹${amountReceived}) is less than order total (₹${grandTotal})`);
    }
    changeReturned = roundMoney(amountReceived - grandTotal);
  }

  const customerName = checkout.customer_name || 'Walk-in Customer';
  const customerPhone = checkout.customer_phone ?? '';
  const status = failed ? 'CANCELLED' : 'COMPLETED';

  const { lastInsertRowid: orderId } = await tx.run(
    `INSERT INTO orders (order_number, customer_name, customer_phone, notes, subtotal, discount, tax, grand_total,
       payment_method, payment_status, payment_ref, amount_received, change_returned, staff_id, staff_name, status, cart_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `TMP-${randomUUID()}`,
      customerName,
      customerPhone,
      checkout.notes ?? '',
      subtotal,
      discount,
      tax,
      grandTotal,
      checkout.payment_method,
      paymentStatus,
      checkout.payment_ref ?? '',
      amountReceived,
      changeReturned,
      actor.id,
      actor.name,
      status,
      options.cartId ?? null,
    ]
  );
  const orderNumber = formatNumber('ORD', orderId);
  await tx.run('UPDATE orders SET order_number = ? WHERE id = ?', [orderNumber, orderId]);

  for (const item of items) {
    await tx.run(
      `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, item.productId, item.name, item.qty, item.price, item.total]
    );
    if (!failed) {
      const { changes } = await tx.run(
        `UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND stock_quantity >= ?`,
        [item.qty, item.productId, item.qty]
      );
      if (changes !== 1) throw conflict(`Insufficient stock for '${item.name}'`);
    }
  }

  let receiptNumber: string | null = null;
  let receiptData: ReceiptData | null = null;
  if (!failed) {
    receiptNumber = formatNumber('RCP', orderId);
    receiptData = {
      receiptNumber,
      orderNumber,
      date: new Date().toISOString(),
      customerName,
      customerPhone,
      items: items.map(({ name, qty, price, total }) => ({ name, qty, price, total })),
      subtotal,
      discount,
      tax,
      taxPercent,
      grandTotal,
      paymentMethod: checkout.payment_method,
      paymentStatus,
      paymentRef: checkout.payment_ref ?? '',
      amountReceived,
      changeReturned,
      staffName: actor.name,
      notes: checkout.notes ?? '',
    };
    await tx.run(
      `INSERT INTO receipts (receipt_number, order_id, customer_name, customer_phone, grand_total, payment_method, payment_status, receipt_data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [receiptNumber, orderId, customerName, customerPhone, grandTotal, checkout.payment_method, paymentStatus, JSON.stringify(receiptData)]
    );
  }

  await audit(
    tx,
    actor,
    'CREATE_ORDER',
    `Created Order #${orderNumber} for ₹${grandTotal} (${checkout.payment_method}, ${paymentStatus})`,
    options.ip
  );

  const order = await tx.get('SELECT * FROM orders WHERE id = ?', [orderId]);
  const orderItems = await tx.all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  return { order, items: orderItems, receiptNumber, receiptData };
}

export async function refundOrder(tx: Queryable, actor: AuthUser, orderId: number, ip?: string) {
  const order = await tx.get<{ id: number; order_number: string; status: string; grand_total: number }>(
    'SELECT id, order_number, status, grand_total FROM orders WHERE id = ?',
    [orderId]
  );
  if (!order) throw notFound('Order not found');
  if (order.status === 'REFUNDED') throw badRequest('Order has already been refunded');
  if (order.status !== 'COMPLETED') throw badRequest(`Only completed orders can be refunded (status: ${order.status})`);

  const items = await tx.all<{ product_id: number; quantity: number }>(
    'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
    [orderId]
  );
  for (const item of items) {
    await tx.run('UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      item.quantity,
      item.product_id,
    ]);
  }

  await tx.run(`UPDATE orders SET status = 'REFUNDED', payment_status = 'REFUNDED' WHERE id = ?`, [orderId]);
  await tx.run(`UPDATE receipts SET payment_status = 'REFUNDED' WHERE order_id = ?`, [orderId]);
  await audit(tx, actor, 'REFUND_ORDER', `Refunded Order #${order.order_number} (Amount: ₹${order.grand_total})`, ip);
}
