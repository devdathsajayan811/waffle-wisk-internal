import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { toDbTimestamp } from '../lib/time.js';
import { Database, Queryable } from './types.js';

async function userCount(db: Queryable): Promise<number> {
  const row = await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM users');
  return Number(row?.count ?? 0);
}

const DEFAULT_CATEGORIES = [
  ['Classic Waffles', 'classic-waffles'],
  ['Chocolate Waffles', 'chocolate-waffles'],
  ['Fruit Waffles', 'fruit-waffles'],
  ['Premium Waffles', 'premium-waffles'],
  ['Drinks', 'drinks'],
  ['Toppings', 'toppings'],
  ['Combos', 'combos'],
] as const;

/** Products require a category and the UI has no category editor, so an empty table gets the defaults. */
async function ensureCategories(db: Queryable): Promise<void> {
  const row = await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM categories');
  if (Number(row?.count ?? 0) > 0) return;
  for (const [i, [name, slug]] of DEFAULT_CATEGORIES.entries()) {
    await db.run('INSERT INTO categories (name, slug, display_order) VALUES (?, ?, ?)', [name, slug, i + 1]);
  }
}

/** Creates the first admin from ADMIN_* env vars when the users table is empty. */
async function bootstrapAdmin(db: Database): Promise<void> {
  const { name, username, email, password } = config.bootstrapAdmin;
  if (!username || !email || !password) {
    console.error(
      'No users exist and ADMIN_USERNAME / ADMIN_EMAIL / ADMIN_PASSWORD are not set. Nobody can sign in until they are.'
    );
    return;
  }
  await db.run(
    `INSERT INTO users (name, email, username, password_hash, role, status) VALUES (?, ?, ?, ?, 'ADMIN', 'ACTIVE')`,
    [name, email, username, bcrypt.hashSync(password, 10)]
  );
  console.log(`Bootstrapped admin account '${username}'.`);
}

async function seedDemoData(db: Database): Promise<void> {
  console.log('Seeding demo data (development only)...');
  await db.transaction(async (tx) => {
    const adminHash = bcrypt.hashSync('admin123', 10);
    const staffHash = bcrypt.hashSync('staff123', 10);
    const insertUser = `INSERT INTO users (name, email, username, phone, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`;

    const adminId = (
      await tx.run(insertUser, ['Waffle Owner (Admin)', 'admin@wafflewisk.com', 'admin', '+91 98765 00001', adminHash, 'ADMIN'])
    ).lastInsertRowid;
    const staffId = (
      await tx.run(insertUser, ['Priya Sharma (Staff)', 'staff@wafflewisk.com', 'staff', '+91 98765 00002', staffHash, 'STAFF'])
    ).lastInsertRowid;
    await tx.run(insertUser, ['Rahul Verma (Staff)', 'rahul@wafflewisk.com', 'rahul', '+91 98765 00003', staffHash, 'STAFF']);

    await tx.run(
      `UPDATE business_settings SET business_name = ?, logo_url = ?, receipt_footer = ? WHERE id = 1`,
      ['Waffle Wisk Cart', '/waffle_logo.png', 'Thank you for enjoying our freshly baked waffles! Visit us again soon.']
    );

    const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=80`;
    const products: Array<[string, string, number, string, string, number, number | null, number, number, string]> = [
      ['WFL-001', 'Classic Belgian Waffle', 1, 'Golden crispy waffle dusted with icing sugar and butter.', img('photo-1562376552-0d160a2f238d'), 99, null, 45, 5, 'plate'],
      ['WFL-002', 'Double Chocolate Waffle', 2, 'Rich chocolate waffle loaded with dark & milk chocolate drizzle.', img('photo-1598214886806-c87b84b7078b'), 129, 119, 30, 5, 'plate'],
      ['WFL-003', 'Strawberry Delight Waffle', 3, 'Fresh strawberry slices on vanilla waffle with strawberry glaze.', img('photo-1554520735-0a6b8b6ce8b7'), 149, null, 3, 5, 'plate'],
      ['WFL-004', 'Nutella Overload Waffle', 4, 'Crispy waffle layered with generous Nutella spread & hazelnuts.', img('photo-1621303837174-89787a7d4729'), 179, null, 25, 5, 'plate'],
      ['WFL-005', 'Brownie Blast Waffle', 4, 'Fudgy brownie chunks embedded with chocolate syrup & ice cream.', img('photo-1509440159596-0249088772ff'), 169, 159, 18, 5, 'plate'],
      ['WFL-006', 'Royal Belgian Special', 4, 'Triple chocolate waffle with almond flakes, whipped cream & ice cream.', img('photo-1551024709-8f23befc6f87'), 199, null, 12, 5, 'plate'],
      ['DRK-001', 'Thick Chocolate Shake', 5, 'Chilled creamy chocolate milk shake topped with chocolate chips.', img('photo-1572490122747-3968b75cc699'), 119, null, 40, 10, 'bottle'],
      ['DRK-002', 'Iced Cold Coffee', 5, 'Rich espresso blended with cold milk & ice cream.', img('photo-1517701604599-bb29b565090c'), 99, null, 50, 10, 'cup'],
      ['TOP-001', 'Extra Whipped Cream Scoop', 6, 'Fluffy fresh whipped cream scoop.', img('photo-1488477181946-6428a0291777'), 30, null, 60, 10, 'scoop'],
      ['TOP-002', 'Maple Syrup Dip', 6, 'Authentic maple syrup dip cup.', img('photo-1589301760014-d929f3979dbc'), 25, null, 70, 10, 'dip'],
      ['CMB-001', 'Chocolate & Berry Combo', 7, '1 Double Chocolate Waffle + 1 Strawberry Delight + 1 Cold Coffee.', img('photo-1565299624946-b28f40a0ae38'), 249, 229, 15, 5, 'combo'],
    ];
    for (const p of products) {
      await tx.run(
        `INSERT INTO products (sku, name, category_id, description, image_url, price, discount_price, tax_percent, stock_quantity, low_stock_threshold, unit, availability)
         VALUES (?, ?, ?, ?, ?, ?, ?, 5.0, ?, ?, ?, 'AVAILABLE')`,
        p
      );
    }

    await tx.run(
      `INSERT INTO price_history (product_id, old_price, new_price, updated_by, updated_by_name) VALUES (?, ?, ?, ?, ?)`,
      [1, 89, 99, adminId, 'Waffle Owner (Admin)']
    );

    const inventory: Array<[string, string, number, string, number, number, string, string | null]> = [
      ['Belgian Waffle Premix Powder', 'Ingredients', 25, 'kg', 5, 180, 'Golden Bake Supplies', '2027-03-31'],
      ['Dark Chocolate Syrup Bottles', 'Syrups', 3, 'bottles', 5, 140, 'ChocoCraft Ltd', '2026-12-31'],
      ['Strawberry Crush Bottles', 'Syrups', 8, 'bottles', 3, 160, 'BerryBest Foods', '2027-01-15'],
      ['Pure Nutella Spread Jar (1kg)', 'Toppings', 4, 'jars', 2, 480, 'Metro Wholesale', '2027-05-31'],
      ['Fresh Whipped Cream Spray', 'Toppings', 10, 'cans', 4, 220, 'Dairy Fresh India', '2026-10-30'],
      ['Paper Waffle Trays (100s)', 'Packaging', 4, 'packs', 2, 250, 'EcoPack Solutions', null],
    ];
    for (const item of inventory) {
      await tx.run(
        `INSERT INTO inventory_items (name, category, current_quantity, unit, minimum_stock, cost_per_unit, supplier, last_restocked, expiry_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
        item
      );
    }

    const hoursAgo = (h: number) => toDbTimestamp(new Date(Date.now() - h * 3600_000));
    const demoOrders: Array<{ number: string; customer: string; items: Array<[number, string, number, number]>; method: string; at: string }> = [
      { number: 'ORD-1000', customer: 'Sneha Kapoor', items: [[6, 'Royal Belgian Special', 1, 199]], method: 'CARD', at: hoursAgo(26) },
      { number: 'ORD-1001', customer: 'Ananya Roy', items: [[1, 'Classic Belgian Waffle', 1, 99], [2, 'Double Chocolate Waffle', 1, 119]], method: 'UPI', at: hoursAgo(3) },
    ];
    for (const o of demoOrders) {
      const subtotal = o.items.reduce((sum, [, , qty, price]) => sum + qty * price, 0);
      const tax = Number((subtotal * 0.05).toFixed(2));
      const total = Number((subtotal + tax).toFixed(2));
      const orderId = (
        await tx.run(
          `INSERT INTO orders (order_number, customer_name, subtotal, discount, tax, grand_total, payment_method, payment_status, amount_received, change_returned, staff_id, staff_name, status, created_at)
           VALUES (?, ?, ?, 0, ?, ?, ?, 'PAID', ?, 0, ?, 'Priya Sharma (Staff)', 'COMPLETED', ?)`,
          [o.number, o.customer, subtotal, tax, total, o.method, total, staffId, o.at]
        )
      ).lastInsertRowid;
      for (const [productId, name, qty, price] of o.items) {
        await tx.run(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, productId, name, qty, price, qty * price]
        );
      }
      const receiptNumber = o.number.replace('ORD', 'RCP');
      const receiptData = {
        receiptNumber,
        orderNumber: o.number,
        date: `${o.at.replace(' ', 'T')}Z`,
        customerName: o.customer,
        items: o.items.map(([, name, qty, price]) => ({ name, qty, price, total: qty * price })),
        subtotal,
        discount: 0,
        tax,
        grandTotal: total,
        paymentMethod: o.method,
        paymentStatus: 'PAID',
        staffName: 'Priya Sharma (Staff)',
      };
      await tx.run(
        `INSERT INTO receipts (receipt_number, order_id, customer_name, grand_total, payment_method, payment_status, receipt_data_json, created_at)
         VALUES (?, ?, ?, ?, ?, 'PAID', ?, ?)`,
        [receiptNumber, orderId, o.customer, total, o.method, JSON.stringify(receiptData), o.at]
      );
    }

    await tx.run(
      `INSERT INTO material_requests (staff_id, staff_name, material, quantity, unit, note, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [staffId, 'Priya Sharma (Staff)', 'Flour / Premix Powder', 5, 'kg', 'Required for tomorrow morning', 'Pending']
    );
    await tx.run(
      `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
      ['SYSTEM_INIT', adminId, 'Waffle Owner (Admin)', 'ADMIN', 'Seeded demo data.']
    );
  });
}

export async function seed(db: Database): Promise<void> {
  await ensureCategories(db);
  if ((await userCount(db)) > 0) return;
  if (config.seedDemoData) {
    await seedDemoData(db);
  } else {
    await bootstrapAdmin(db);
  }
}
