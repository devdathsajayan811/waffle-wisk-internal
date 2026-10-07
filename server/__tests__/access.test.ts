import { beforeAll, describe, expect, it } from 'vitest';
import { api, auth, createCartWith, login } from './helpers.js';

let admin: string;
let staff: string;
let otherStaff: string;

beforeAll(async () => {
  admin = await login('admin', 'admin123');
  staff = await login('staff', 'staff123');
  otherStaff = await login('rahul', 'staff123');
});

describe('authentication', () => {
  it('rejects requests without a valid token', async () => {
    expect((await api().get('/api/orders')).status).toBe(401);
    expect((await api().get('/api/orders').set(auth('not-a-token'))).status).toBe(401);
  });

  it('rejects wrong passwords with a generic message', async () => {
    const res = await api().post('/api/auth/login').send({ identifier: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).not.toMatch(/admin123/);
  });

  it('does not leak credentials from forgot-password', async () => {
    const res = await api().post('/api/auth/forgot-password').send({ email: 'admin@wafflewisk.com' });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/admin123|password_hash/);
  });

  it('locks out a disabled user immediately, even with an unexpired token', async () => {
    const created = await api().post('/api/users').set(auth(admin)).send({
      name: 'Temp Staff',
      email: 'temp@wafflewisk.com',
      username: 'temp',
      password: 'TempPass123',
      role: 'STAFF',
    });
    expect(created.status).toBe(201);
    const tempToken = await login('temp', 'TempPass123');
    expect((await api().get('/api/auth/me').set(auth(tempToken))).status).toBe(200);

    const disabled = await api().put(`/api/users/${created.body.id}`).set(auth(admin)).send({ status: 'DISABLED' });
    expect(disabled.status).toBe(200);
    expect((await api().get('/api/auth/me').set(auth(tempToken))).status).toBe(401);
  });
});

describe('admin-only endpoints', () => {
  const adminOnly: Array<[method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, body?: object]> = [
    ['get', '/api/users'],
    ['post', '/api/users', { name: 'X', email: 'x@x.com', username: 'xx', password: 'Password1', role: 'ADMIN' }],
    ['put', '/api/settings', { business_name: 'Hacked' }],
    ['get', '/api/audit-logs'],
    ['get', '/api/reports/payments'],
    ['get', '/api/reports/products'],
    ['post', '/api/products', { name: 'Free Waffle', category_id: 1, price: 0 }],
    ['put', '/api/products/1', { price: 1 }],
    ['delete', '/api/products/1'],
    ['post', '/api/inventory/movements', { inventory_item_id: 1, type: 'STOCK_OUT', quantity: 1, reason: 'x' }],
    ['patch', '/api/material-requests/1/status', { status: 'Approved' }],
    ['patch', '/api/orders/1/refund'],
  ];

  it.each(adminOnly)('staff gets 403 on %s %s', async (method, path, body) => {
    const res = await api()[method](path).set(auth(staff)).send(body ?? {});
    expect(res.status).toBe(403);
  });

  it('admin can reach the same read endpoints', async () => {
    for (const path of ['/api/users', '/api/audit-logs', '/api/reports/payments', '/api/reports/products']) {
      expect((await api().get(path).set(auth(admin))).status).toBe(200);
    }
  });
});

describe('ownership', () => {
  it("staff cannot read or modify another staff member's cart", async () => {
    const cartId = await createCartWith(staff, [{ product_id: 1, quantity: 1 }]);
    expect((await api().get(`/api/carts/${cartId}`).set(auth(otherStaff))).status).toBe(403);
    expect(
      (await api().put(`/api/carts/${cartId}/items`).set(auth(otherStaff)).send({ items: [{ product_id: 1, quantity: 5 }] })).status
    ).toBe(403);
    expect(
      (await api().post(`/api/carts/${cartId}/complete`).set(auth(otherStaff)).send({ payment_method: 'UPI' })).status
    ).toBe(403);
    expect((await api().post(`/api/carts/${cartId}/cancel`).set(auth(otherStaff))).status).toBe(403);

    expect((await api().get(`/api/carts/${cartId}`).set(auth(admin))).status).toBe(200);
  });

  it("staff only see their own orders and cannot open someone else's", async () => {
    const mine = await api()
      .post('/api/orders')
      .set(auth(otherStaff))
      .send({ items: [{ product_id: 1, quantity: 1 }], payment_method: 'UPI' });
    expect(mine.status).toBe(201);
    const orderId = mine.body.order.id;

    expect((await api().get(`/api/orders/${orderId}`).set(auth(staff))).status).toBe(403);
    expect((await api().get(`/api/orders/${orderId}`).set(auth(otherStaff))).status).toBe(200);

    const list = await api().get('/api/orders?date_range=all').set(auth(staff));
    expect(list.status).toBe(200);
    const rows: Array<{ staff_name: string; id: number }> = Array.isArray(list.body) ? list.body : list.body.orders;
    expect(rows.some((o) => o.id === orderId)).toBe(false);
  });
});

describe('user safety rails', () => {
  it('an admin cannot demote or disable themselves', async () => {
    const me = await api().get('/api/auth/me').set(auth(admin));
    const demote = await api().put(`/api/users/${me.body.id}`).set(auth(admin)).send({ role: 'STAFF' });
    expect(demote.status).toBe(400);
    const disable = await api().put(`/api/users/${me.body.id}`).set(auth(admin)).send({ status: 'DISABLED' });
    expect(disable.status).toBe(400);
  });

  it('rejects weak passwords', async () => {
    const res = await api().post('/api/users').set(auth(admin)).send({
      name: 'Weak',
      email: 'weak@wafflewisk.com',
      username: 'weak',
      password: 'abc',
      role: 'STAFF',
    });
    expect(res.status).toBe(400);
  });
});
