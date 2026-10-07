import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, createCartWith, login, productStock } from './helpers.js';

// Demo seed: product 1 = Classic Belgian (99, stock 45), product 2 = Double Chocolate (129, discounted to 119),
// product 3 = Strawberry Delight (149, stock 3).
let admin: string;
let staff: string;
let gst: number;

beforeAll(async () => {
  admin = await login('admin', 'admin123');
  staff = await login('staff', 'staff123');
  const settings = await api().get('/api/settings').set(auth(admin));
  gst = Number(settings.body.default_gst_percent);
});

const money = (n: number) => Math.round(n * 100) / 100;

describe('cart checkout', () => {
  it('records tax, discount, payment and change, deducts stock, and issues a receipt', async () => {
    const before1 = await productStock(admin, 1);
    const before2 = await productStock(admin, 2);

    const cartId = await createCartWith(staff, [
      { product_id: 1, quantity: 2 },
      { product_id: 2, quantity: 1 },
    ]);

    const subtotal = 2 * 99 + 119;
    const discount = 17;
    const tax = money(((subtotal - discount) * gst) / 100);
    const total = money(subtotal - discount + tax);

    const res = await api()
      .post(`/api/carts/${cartId}/complete`)
      .set(auth(staff))
      .send({ payment_method: 'CASH', discount, amount_received: 500 });

    expect(res.status).toBe(200);
    expect(res.body.cart.status).toBe('COMPLETED');
    expect(res.body.order).toMatchObject({
      subtotal,
      discount,
      tax,
      grand_total: total,
      payment_method: 'CASH',
      payment_status: 'PAID',
      status: 'COMPLETED',
      cart_id: cartId,
    });
    expect(res.body.order.change_returned).toBeCloseTo(500 - total, 2);
    expect(res.body.order.order_number).toMatch(/^ORD-\d{7}$/);
    expect(res.body.receiptNumber).toMatch(/^RCP-\d{7}$/);
    expect(res.body.receiptData.grandTotal).toBe(total);

    expect(await productStock(admin, 1)).toBe(before1 - 2);
    expect(await productStock(admin, 2)).toBe(before2 - 1);

    const cart = await api().get(`/api/carts/${cartId}`).set(auth(staff));
    expect(cart.body.receipt?.receipt_number).toBe(res.body.receiptNumber);
  });

  it('refuses to complete a cart twice', async () => {
    const cartId = await createCartWith(staff, [{ product_id: 1, quantity: 1 }]);
    const first = await api().post(`/api/carts/${cartId}/complete`).set(auth(staff)).send({ payment_method: 'UPI' });
    expect(first.status).toBe(200);
    const second = await api().post(`/api/carts/${cartId}/complete`).set(auth(staff)).send({ payment_method: 'UPI' });
    expect(second.status).toBe(400);
  });

  it('rejects checkout when stock is insufficient and leaves stock unchanged', async () => {
    const before = await productStock(admin, 3);
    const cartId = await createCartWith(staff, [{ product_id: 3, quantity: before + 1 }]);
    const res = await api().post(`/api/carts/${cartId}/complete`).set(auth(staff)).send({ payment_method: 'CARD' });
    expect(res.status).toBe(409);
    expect(await productStock(admin, 3)).toBe(before);

    const cart = await api().get(`/api/carts/${cartId}`).set(auth(staff));
    expect(cart.body.status).toBe('ACTIVE');
  });

  it('rejects cash payments that do not cover the total', async () => {
    const cartId = await createCartWith(staff, [{ product_id: 1, quantity: 1 }]);
    const res = await api()
      .post(`/api/carts/${cartId}/complete`)
      .set(auth(staff))
      .send({ payment_method: 'CASH', amount_received: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects invalid quantities and payment methods', async () => {
    const created = await api().post('/api/carts').set(auth(staff)).send({});
    const bad = await api()
      .put(`/api/carts/${created.body.id}/items`)
      .set(auth(staff))
      .send({ items: [{ product_id: 1, quantity: -2 }] });
    expect(bad.status).toBe(400);

    await api().put(`/api/carts/${created.body.id}/items`).set(auth(staff)).send({ items: [{ product_id: 1, quantity: 1 }] });
    const badMethod = await api()
      .post(`/api/carts/${created.body.id}/complete`)
      .set(auth(staff))
      .send({ payment_method: 'BITCOIN' });
    expect(badMethod.status).toBe(400);
  });

  it('rejects a discount larger than the subtotal', async () => {
    const cartId = await createCartWith(staff, [{ product_id: 1, quantity: 1 }]);
    const res = await api()
      .post(`/api/carts/${cartId}/complete`)
      .set(auth(staff))
      .send({ payment_method: 'UPI', discount: 5000 });
    expect(res.status).toBe(400);

    const full = await api()
      .post(`/api/carts/${cartId}/complete`)
      .set(auth(staff))
      .send({ payment_method: 'UPI', discount: 99 });
    expect(full.status).toBe(200);
    expect(full.body.order.grand_total).toBe(0);
  });

  it('cancels an active cart without touching stock', async () => {
    const before = await productStock(admin, 1);
    const cartId = await createCartWith(staff, [{ product_id: 1, quantity: 3 }]);
    const res = await api().post(`/api/carts/${cartId}/cancel`).set(auth(staff));
    expect(res.status).toBe(200);
    expect(await productStock(admin, 1)).toBe(before);

    const complete = await api().post(`/api/carts/${cartId}/complete`).set(auth(staff)).send({ payment_method: 'UPI' });
    expect(complete.status).toBe(400);
  });
});

describe('refunds', () => {
  it('restores stock and can only happen once', async () => {
    const before = await productStock(admin, 1);
    const cartId = await createCartWith(staff, [{ product_id: 1, quantity: 4 }]);
    const done = await api().post(`/api/carts/${cartId}/complete`).set(auth(staff)).send({ payment_method: 'UPI' });
    const orderId = done.body.order.id;
    expect(await productStock(admin, 1)).toBe(before - 4);

    const refund = await api().patch(`/api/orders/${orderId}/refund`).set(auth(admin));
    expect(refund.status).toBe(200);
    expect(await productStock(admin, 1)).toBe(before);

    const order = await api().get(`/api/orders/${orderId}`).set(auth(admin));
    expect(order.body.order.status).toBe('REFUNDED');

    const again = await api().patch(`/api/orders/${orderId}/refund`).set(auth(admin));
    expect(again.status).toBe(400);
    expect(await productStock(admin, 1)).toBe(before);
  });
});

describe('order numbering', () => {
  it('gives every order a unique number', async () => {
    const numbers = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const res = await api()
        .post('/api/orders')
        .set(auth(staff))
        .send({ items: [{ product_id: 1, quantity: 1 }], payment_method: 'UPI' });
      expect(res.status).toBe(201);
      numbers.add(res.body.order.order_number);
    }
    expect(numbers.size).toBe(3);
  });
});
