import request from 'supertest';
import { app } from '../app.js';

export const api = () => request(app);

export async function login(identifier: string, password: string): Promise<string> {
  const res = await api().post('/api/auth/login').send({ identifier, password });
  if (res.status !== 200) throw new Error(`Login failed for ${identifier}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function productStock(token: string, productId: number): Promise<number> {
  const res = await api().get(`/api/products/${productId}`).set(auth(token));
  const stock = res.body.product?.stock_quantity;
  if (typeof stock !== 'number') throw new Error(`No stock for product ${productId}: ${JSON.stringify(res.body)}`);
  return stock;
}

export async function createCartWith(token: string, items: Array<{ product_id: number; quantity: number }>) {
  const created = await api().post('/api/carts').set(auth(token)).send({});
  if (created.status !== 201 && created.status !== 200) throw new Error(`Cart create failed: ${JSON.stringify(created.body)}`);
  const cartId: number = created.body.id;
  const updated = await api().put(`/api/carts/${cartId}/items`).set(auth(token)).send({ items });
  if (updated.status !== 200) throw new Error(`Cart update failed: ${JSON.stringify(updated.body)}`);
  return cartId;
}
