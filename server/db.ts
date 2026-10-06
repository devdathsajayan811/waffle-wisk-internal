import initSqlJs, { Database } from 'sql.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = !!(process.env.VERCEL || process.env.NOW_BUILDER);
const dbPath = isVercel ? '/tmp/waffle_wisk.db' : path.resolve(__dirname, '../waffle_wisk.db');
const uploadsDir = isVercel ? '/tmp/uploads' : path.resolve(__dirname, '../uploads');

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (e) {
    console.warn('Could not create uploads dir:', e);
  }
}

let dbInstance: Database | null = null;

function saveDb() {
  if (dbInstance) {
    try {
      const data = dbInstance.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch (err) {
      console.warn('Database save skipped or failed:', err);
    }
  }
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  let SQL: any;
  try {
    const wasmPath1 = path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');
    const wasmPath2 = path.resolve(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm');
    let wasmBinary: Buffer | null = null;
    if (fs.existsSync(wasmPath1)) {
      wasmBinary = fs.readFileSync(wasmPath1);
    } else if (fs.existsSync(wasmPath2)) {
      wasmBinary = fs.readFileSync(wasmPath2);
    }

    if (wasmBinary) {
      SQL = await initSqlJs({ wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength) as ArrayBuffer });
    } else {
      SQL = await initSqlJs({
        locateFile: (file) => {
          const wasmPath = path.resolve(process.cwd(), 'node_modules/sql.js/dist', file);
          if (fs.existsSync(wasmPath)) return wasmPath;
          return file;
        },
      });
    }
  } catch (err) {
    console.warn('initSqlJs wasmBinary failed, trying fallback:', err);
    SQL = await initSqlJs();
  }

  const repoDbPath = path.resolve(process.cwd(), 'waffle_wisk.db');
  const altRepoDbPath = path.resolve(__dirname, '../waffle_wisk.db');

  let fileToLoad: string | null = null;
  if (fs.existsSync(dbPath)) {
    fileToLoad = dbPath;
  } else if (fs.existsSync(repoDbPath)) {
    fileToLoad = repoDbPath;
  } else if (fs.existsSync(altRepoDbPath)) {
    fileToLoad = altRepoDbPath;
  }

  if (fileToLoad) {
    try {
      const filebuffer = fs.readFileSync(fileToLoad);
      dbInstance = new SQL.Database(filebuffer);
      if (isVercel && fileToLoad !== dbPath) {
        try {
          fs.writeFileSync(dbPath, filebuffer);
        } catch (e) {
          console.warn('Could not mirror bundled DB to /tmp:', e);
        }
      }
    } catch (e) {
      console.warn('Failed reading DB file, creating fresh DB:', e);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }
  return dbInstance!;
}

// Database helper functions
export const dbQuery = {
  all(sql: string, params: any[] = []): any[] {
    if (!dbInstance) throw new Error('Database not initialized');
    const sqlite = dbInstance;
    const stmt = sqlite.prepare(sql);
    stmt.bind(params);
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  get(sql: string, params: any[] = []): any | undefined {
    const results = this.all(sql, params);
    return results.length > 0 ? results[0] : undefined;
  },

  run(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
    if (!dbInstance) throw new Error('Database not initialized');
    const sqlite = dbInstance;
    sqlite.run(sql, params);
    
    const res = sqlite.exec('SELECT last_insert_rowid() as id, changes() as cnt');
    let lastInsertRowid = 0;
    let changes = 0;
    if (res && res.length > 0 && res[0].values && res[0].values.length > 0) {
      lastInsertRowid = Number(res[0].values[0][0]);
      changes = Number(res[0].values[0][1]);
    }
    
    saveDb();
    return { lastInsertRowid, changes };
  },

  exec(sql: string) {
    if (!dbInstance) throw new Error('Database not initialized');
    dbInstance.exec(sql);
    saveDb();
  }
};

export async function initDb() {
  console.log('Initializing Database Schema with sql.js...');
  const sqlite = await getDb();

  sqlite.exec(`
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'STAFF')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DISABLED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    -- Product Categories Table
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      display_order INTEGER DEFAULT 0
    );

    -- Products Table
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      description TEXT,
      image_url TEXT,
      price REAL NOT NULL,
      discount_price REAL,
      tax_percent REAL DEFAULT 5.0,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      unit TEXT DEFAULT 'pcs',
      availability TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(availability IN ('AVAILABLE', 'UNAVAILABLE', 'OUT_OF_STOCK')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Price History Table
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      old_price REAL NOT NULL,
      new_price REAL NOT NULL,
      updated_by INTEGER NOT NULL REFERENCES users(id),
      updated_by_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Inventory Items Table (Storage)
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      current_quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      minimum_stock REAL NOT NULL DEFAULT 5,
      cost_per_unit REAL NOT NULL DEFAULT 0,
      supplier TEXT,
      last_restocked DATETIME,
      expiry_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Stock Movements Table
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('IN', 'OUT', 'SALE_DEDUCTION', 'ADJUSTMENT')),
      quantity REAL NOT NULL,
      reason TEXT NOT NULL,
      cost REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_by_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Orders Table
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT DEFAULT 'Walk-in Customer',
      customer_phone TEXT,
      notes TEXT,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'UPI', 'CARD', 'OTHER')),
      payment_status TEXT NOT NULL CHECK(payment_status IN ('PAID', 'PENDING', 'FAILED', 'REFUNDED')),
      payment_ref TEXT,
      amount_received REAL,
      change_returned REAL,
      staff_id INTEGER NOT NULL REFERENCES users(id),
      staff_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK(status IN ('COMPLETED', 'HOLD', 'CANCELLED', 'REFUNDED')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Order Items Table
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL
    );

    -- Receipts Table
    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT UNIQUE NOT NULL,
      order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      customer_name TEXT,
      customer_phone TEXT,
      grand_total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      receipt_data_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Business Settings Table
    CREATE TABLE IF NOT EXISTS business_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      business_name TEXT DEFAULT 'Waffle Wisk Cart',
      logo_url TEXT DEFAULT '',
      address TEXT DEFAULT 'Stall #14, Food Street, City Center',
      phone TEXT DEFAULT '+91 98765 43210',
      email TEXT DEFAULT 'contact@wafflewisk.com',
      gstin TEXT DEFAULT '27AABCT3518Q1ZB',
      currency_symbol TEXT DEFAULT '₹',
      receipt_footer TEXT DEFAULT 'Thank you for enjoying our waffles! Visit us again.',
      default_gst_percent REAL DEFAULT 5.0,
      low_stock_threshold_default INTEGER DEFAULT 5,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit Logs Table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id),
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      description TEXT NOT NULL,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Material Requests Table
    CREATE TABLE IF NOT EXISTS material_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL REFERENCES users(id),
      staff_name TEXT NOT NULL,
      cart_id INTEGER REFERENCES carts(id),
      cart_number TEXT,
      material TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Completed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Carts Table (Multiple Independent Carts)
    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_number TEXT UNIQUE NOT NULL,
      staff_id INTEGER REFERENCES users(id),
      staff_name TEXT NOT NULL,
      customer_name TEXT DEFAULT 'Walk-in Customer',
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
      total REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    -- Cart Items Table (Price snapshot per item)
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      item_name_snapshot TEXT NOT NULL,
      price_snapshot REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      subtotal REAL NOT NULL
    );
  `);

  saveDb();
  seedData();
}

function seedData() {
  const userRes = dbQuery.get('SELECT count(*) as count FROM users');
  const userCount = userRes ? Number(userRes.count) : 0;
  
  if (userCount === 0) {
    console.log('Seeding initial demo data...');
    
    // Passwords
    const adminPasswordHash = bcrypt.hashSync('admin123', 10);
    const staffPasswordHash = bcrypt.hashSync('staff123', 10);

    // Users
    const adminRes = dbQuery.run(
      `INSERT INTO users (name, email, username, phone, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Waffle Owner (Admin)', 'admin@wafflewisk.com', 'admin', '+91 98765 00001', adminPasswordHash, 'ADMIN', 'ACTIVE']
    );
    const adminId = adminRes.lastInsertRowid;

    const staffRes = dbQuery.run(
      `INSERT INTO users (name, email, username, phone, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Priya Sharma (Staff)', 'staff@wafflewisk.com', 'staff', '+91 98765 00002', staffPasswordHash, 'STAFF', 'ACTIVE']
    );
    const staffId = staffRes.lastInsertRowid;

    dbQuery.run(
      `INSERT INTO users (name, email, username, phone, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Rahul Verma (Staff)', 'rahul@wafflewisk.com', 'rahul', '+91 98765 00003', staffPasswordHash, 'STAFF', 'ACTIVE']
    );

    // Business Settings
    dbQuery.run(`
      INSERT OR REPLACE INTO business_settings (id, business_name, logo_url, address, phone, email, gstin, currency_symbol, receipt_footer, default_gst_percent, low_stock_threshold_default)
      VALUES (1, 'Waffle Wisk Cart', '/waffle_logo.png', 'Stall #14, Food Street, City Center', '+91 98765 43210', 'contact@wafflewisk.com', '27AABCT3518Q1ZB', '₹', 'Thank you for enjoying our freshly baked waffles! Visit us again soon.', 5.0, 5)
    `);

    // Categories
    dbQuery.run('INSERT INTO categories (name, slug, display_order) VALUES (?, ?, ?)', ['Classic Waffles', 'classic-waffles', 1]);
    dbQuery.run('INSERT INTO categories (name, slug, display_order) VALUES (?, ?, ?)', ['Chocolate Waffles', 'chocolate-waffles', 2]);
    dbQuery.run('INSERT INTO categories (name, slug, display_order) VALUES (?, ?, ?)', ['Fruit Waffles', 'fruit-waffles', 3]);
    dbQuery.run('INSERT INTO categories (name, slug, display_order) VALUES (?, ?, ?)', ['Premium Waffles', 'premium-waffles', 4]);
    dbQuery.run('INSERT INTO categories (name, slug, display_order) VALUES (?, ?, ?)', ['Drinks', 'drinks', 5]);
    dbQuery.run('INSERT INTO categories (name, slug, display_order) VALUES (?, ?, ?)', ['Toppings', 'toppings', 6]);
    dbQuery.run('INSERT INTO categories (name, slug, display_order) VALUES (?, ?, ?)', ['Combos', 'combos', 7]);

    // Products
    const sqlProd = `INSERT INTO products (sku, name, category_id, description, image_url, price, discount_price, tax_percent, stock_quantity, low_stock_threshold, unit, availability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    dbQuery.run(sqlProd, ['WFL-001', 'Classic Belgian Waffle', 1, 'Golden crispy waffle dusted with icing sugar and butter.', 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=600&q=80', 99, null, 5.0, 45, 5, 'plate', 'AVAILABLE']);
    dbQuery.run(sqlProd, ['WFL-002', 'Double Chocolate Waffle', 2, 'Rich chocolate waffle loaded with dark & milk chocolate drizzle.', 'https://images.unsplash.com/photo-1598214886806-c87b84b7078b?auto=format&fit=crop&w=600&q=80', 129, 119, 5.0, 30, 5, 'plate', 'AVAILABLE']);
    dbQuery.run(sqlProd, ['WFL-003', 'Strawberry Delight Waffle', 3, 'Fresh strawberry slices on vanilla waffle with strawberry glaze.', 'https://images.unsplash.com/photo-1554520735-0a6b8b6ce8b7?auto=format&fit=crop&w=600&q=80', 149, null, 5.0, 3, 5, 'plate', 'AVAILABLE']); // LOW STOCK ALERT
    dbQuery.run(sqlProd, ['WFL-004', 'Nutella Overload Waffle', 4, 'Crispy waffle layered with generous Nutella spread & hazelnuts.', 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?auto=format&fit=crop&w=600&q=80', 179, null, 5.0, 25, 5, 'plate', 'AVAILABLE']);
    dbQuery.run(sqlProd, ['WFL-005', 'Brownie Blast Waffle', 4, 'Fudgy brownie chunks embedded with chocolate syrup & ice cream.', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80', 169, 159, 5.0, 18, 5, 'plate', 'AVAILABLE']);
    dbQuery.run(sqlProd, ['WFL-006', 'Royal Belgian Special', 4, 'Triple chocolate waffle with almond flakes, whipped cream & ice cream.', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80', 199, null, 5.0, 12, 5, 'plate', 'AVAILABLE']);
    dbQuery.run(sqlProd, ['DRK-001', 'Thick Chocolate Shake', 5, 'Chilled creamy chocolate milk shake topped with chocolate chips.', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80', 119, null, 5.0, 40, 10, 'bottle', 'AVAILABLE']);
    dbQuery.run(sqlProd, ['DRK-002', 'Iced Cold Coffee', 5, 'Rich espresso blended with cold milk & ice cream.', 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80', 99, null, 5.0, 50, 10, 'cup', 'AVAILABLE']);
    dbQuery.run(sqlProd, ['TOP-001', 'Extra Whipped Cream Scoop', 6, 'Fluffy fresh whipped cream scoop.', 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80', 30, null, 5.0, 60, 10, 'scoop', 'AVAILABLE']);
    dbQuery.run(sqlProd, ['TOP-002', 'Maple Syrup Dip', 6, 'Authentic maple syrup dip cup.', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80', 25, null, 5.0, 70, 10, 'dip', 'AVAILABLE']);
    dbQuery.run(sqlProd, ['CMB-001', 'Chocolate & Berry Combo', 7, '1 Double Chocolate Waffle + 1 Strawberry Delight + 1 Cold Coffee.', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80', 249, 229, 5.0, 15, 5, 'combo', 'AVAILABLE']);

    // Price History
    dbQuery.run(
      `INSERT INTO price_history (product_id, old_price, new_price, updated_by, updated_by_name) VALUES (?, ?, ?, ?, ?)`,
      [1, 89, 99, adminId, 'Waffle Owner (Admin)']
    );
    dbQuery.run(
      `INSERT INTO price_history (product_id, old_price, new_price, updated_by, updated_by_name) VALUES (?, ?, ?, ?, ?)`,
      [2, 119, 129, adminId, 'Waffle Owner (Admin)']
    );

    // Inventory Items (Storage)
    const sqlInv = `INSERT INTO inventory_items (name, category, current_quantity, unit, minimum_stock, cost_per_unit, supplier, last_restocked, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const inv1Res = dbQuery.run(sqlInv, ['Belgian Waffle Premix Powder', 'Ingredients', 25.0, 'kg', 5.0, 180, 'Golden Bake Supplies', '2026-09-25 10:00:00', '2027-03-31']);
    const inv2Res = dbQuery.run(sqlInv, ['Dark Chocolate Syrup Bottles', 'Syrups', 3.0, 'bottles', 5.0, 140, 'ChocoCraft Ltd', '2026-09-20 14:30:00', '2026-12-31']); // LOW STOCK
    dbQuery.run(sqlInv, ['Strawberry Crush Bottles', 'Syrups', 8.0, 'bottles', 3.0, 160, 'BerryBest Foods', '2026-09-22 11:15:00', '2027-01-15']);
    dbQuery.run(sqlInv, ['Pure Nutella Spread Jar (1kg)', 'Toppings', 4.0, 'jars', 2.0, 480, 'Metro Wholesale', '2026-09-28 09:45:00', '2027-05-31']);
    dbQuery.run(sqlInv, ['Fresh Whipped Cream Spray', 'Toppings', 10.0, 'cans', 4.0, 220, 'Dairy Fresh India', '2026-09-29 16:20:00', '2026-10-30']);
    dbQuery.run(sqlInv, ['Vanilla Ice Cream Tubs (5L)', 'Toppings', 6.0, 'tubs', 2.0, 350, 'Amul Dairy', '2026-10-01 08:00:00', '2026-11-15']);
    dbQuery.run(sqlInv, ['Paper Waffle Trays (100s)', 'Packaging', 4.0, 'packs', 2.0, 250, 'EcoPack Solutions', '2026-09-15 12:00:00', null]);
    dbQuery.run(sqlInv, ['Takeaway Packing Boxes (50s)', 'Packaging', 3.0, 'packs', 2.0, 300, 'EcoPack Solutions', '2026-09-18 15:00:00', null]);

    // Inventory Movements
    const sqlMov = `INSERT INTO inventory_movements (inventory_item_id, type, quantity, reason, cost, notes, created_by, created_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    dbQuery.run(sqlMov, [inv1Res.lastInsertRowid, 'IN', 25.0, 'Stock Purchase', 4500, 'Monthly premix batch arrival', adminId, 'Waffle Owner (Admin)']);
    dbQuery.run(sqlMov, [inv2Res.lastInsertRowid, 'OUT', 2.0, 'Damaged', 280, 'Bottle seal broken during transit', adminId, 'Waffle Owner (Admin)']);

    // Seed Orders (Historical & Today's Sales)
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    
    const sqlOrd = `INSERT INTO orders (order_number, customer_name, customer_phone, notes, subtotal, discount, tax, grand_total, payment_method, payment_status, payment_ref, amount_received, change_returned, staff_id, staff_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)`;
    const sqlItem = `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)`;
    const sqlRcpt = `INSERT INTO receipts (receipt_number, order_id, customer_name, customer_phone, grand_total, payment_method, payment_status, receipt_data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    // Order 1 (Today)
    const ord1Time = `${todayStr} 11:20:00`;
    const o1Res = dbQuery.run(sqlOrd, ['ORD-1001', 'Ananya Roy', '+91 98111 22334', 'Extra crispy waffle', 228, 0, 11.4, 239.4, 'UPI', 'PAID', 'UPI-987654321', 239.4, 0, staffId, 'Priya Sharma (Staff)', ord1Time]);
    const o1Id = o1Res.lastInsertRowid;
    dbQuery.run(sqlItem, [o1Id, 1, 'Classic Belgian Waffle', 1, 99, 99]);
    dbQuery.run(sqlItem, [o1Id, 2, 'Double Chocolate Waffle', 1, 129, 129]);
    
    const r1Data = {
      receiptNumber: 'RCP-1001',
      orderNumber: 'ORD-1001',
      date: ord1Time,
      customerName: 'Ananya Roy',
      customerPhone: '+91 98111 22334',
      items: [
        { name: 'Classic Belgian Waffle', qty: 1, price: 99, total: 99 },
        { name: 'Double Chocolate Waffle', qty: 1, price: 129, total: 129 }
      ],
      subtotal: 228,
      discount: 0,
      tax: 11.4,
      grandTotal: 239.4,
      paymentMethod: 'UPI',
      paymentStatus: 'PAID',
      staffName: 'Priya Sharma (Staff)'
    };
    dbQuery.run(sqlRcpt, ['RCP-1001', o1Id, 'Ananya Roy', '+91 98111 22334', 239.4, 'UPI', 'PAID', JSON.stringify(r1Data), ord1Time]);

    // Order 2 (Today)
    const ord2Time = `${todayStr} 14:45:00`;
    const o2Res = dbQuery.run(sqlOrd, ['ORD-1002', 'Vikram Malhotra', '+91 98222 33445', 'Less ice in shake', 298, 20, 13.9, 291.9, 'CASH', 'PAID', null, 300, 8.1, staffId, 'Priya Sharma (Staff)', ord2Time]);
    const o2Id = o2Res.lastInsertRowid;
    dbQuery.run(sqlItem, [o2Id, 4, 'Nutella Overload Waffle', 1, 179, 179]);
    dbQuery.run(sqlItem, [o2Id, 7, 'Thick Chocolate Shake', 1, 119, 119]);
    
    const r2Data = {
      receiptNumber: 'RCP-1002',
      orderNumber: 'ORD-1002',
      date: ord2Time,
      customerName: 'Vikram Malhotra',
      customerPhone: '+91 98222 33445',
      items: [
        { name: 'Nutella Overload Waffle', qty: 1, price: 179, total: 179 },
        { name: 'Thick Chocolate Shake', qty: 1, price: 119, total: 119 }
      ],
      subtotal: 298,
      discount: 20,
      tax: 13.9,
      grandTotal: 291.9,
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
      staffName: 'Priya Sharma (Staff)'
    };
    dbQuery.run(sqlRcpt, ['RCP-1002', o2Id, 'Vikram Malhotra', '+91 98222 33445', 291.9, 'CASH', 'PAID', JSON.stringify(r2Data), ord2Time]);

    // Order 3 (Yesterday)
    const yesterday = new Date(now.getTime() - 86400000);
    const yestStr = yesterday.toISOString().slice(0, 10);
    const ord3Time = `${yestStr} 17:30:00`;
    const o3Res = dbQuery.run(sqlOrd, ['ORD-1000', 'Sneha Kapoor', '+91 98333 44556', null, 199, 0, 9.95, 208.95, 'CARD', 'PAID', 'TXN-778899', 208.95, 0, staffId, 'Priya Sharma (Staff)', ord3Time]);
    const o3Id = o3Res.lastInsertRowid;
    dbQuery.run(sqlItem, [o3Id, 6, 'Royal Belgian Special', 1, 199, 199]);
    
    const r3Data = {
      receiptNumber: 'RCP-1000',
      orderNumber: 'ORD-1000',
      date: ord3Time,
      customerName: 'Sneha Kapoor',
      customerPhone: '+91 98333 44556',
      items: [{ name: 'Royal Belgian Special', qty: 1, price: 199, total: 199 }],
      subtotal: 199,
      discount: 0,
      tax: 9.95,
      grandTotal: 208.95,
      paymentMethod: 'CARD',
      paymentStatus: 'PAID',
      staffName: 'Priya Sharma (Staff)'
    };
    dbQuery.run(sqlRcpt, ['RCP-1000', o3Id, 'Sneha Kapoor', '+91 98333 44556', 208.95, 'CARD', 'PAID', JSON.stringify(r3Data), ord3Time]);

    // Initial Audit Logs
    const sqlAudit = `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`;
    dbQuery.run(sqlAudit, ['SYSTEM_INIT', adminId, 'Waffle Owner (Admin)', 'ADMIN', 'Initialized Waffle Wisk system schema and seeded default products & settings.']);
    dbQuery.run(sqlAudit, ['LOGIN', adminId, 'Waffle Owner (Admin)', 'ADMIN', 'Admin logged in from local terminal.']);

    // Seed Material Requests
    dbQuery.run(
      `INSERT INTO material_requests (staff_id, staff_name, material, quantity, unit, note, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [staffId, 'Priya Sharma (Staff)', 'Flour / Premix Powder', 5, 'kg', 'Required for tomorrow morning', 'Pending']
    );
    dbQuery.run(
      `INSERT INTO material_requests (staff_id, staff_name, material, quantity, unit, note, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [staffId, 'Priya Sharma (Staff)', 'Chocolate Sauce', 2, 'bottles', 'Running low on chocolate syrup', 'Approved']
    );

    saveDb();
    console.log('Seed completed successfully!');
  } else {
    // Ensure default admin and staff accounts are guaranteed to exist
    const adminUser = dbQuery.get('SELECT * FROM users WHERE username = ? OR email = ?', ['admin', 'admin@wafflewisk.com']);
    if (!adminUser) {
      console.log('Ensuring admin user exists...');
      const adminPasswordHash = bcrypt.hashSync('admin123', 10);
      dbQuery.run(
        `INSERT INTO users (name, email, username, phone, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['Waffle Owner (Admin)', 'admin@wafflewisk.com', 'admin', '+91 98765 00001', adminPasswordHash, 'ADMIN', 'ACTIVE']
      );
      saveDb();
    }

    const staffUser = dbQuery.get('SELECT * FROM users WHERE username = ? OR email = ?', ['staff', 'staff@wafflewisk.com']);
    if (!staffUser) {
      console.log('Ensuring staff user exists...');
      const staffPasswordHash = bcrypt.hashSync('staff123', 10);
      const staffRes = dbQuery.run(
        `INSERT INTO users (name, email, username, phone, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['Priya Sharma (Staff)', 'staff@wafflewisk.com', 'staff', '+91 98765 00002', staffPasswordHash, 'STAFF', 'ACTIVE']
      );
      saveDb();
    }

    // Ensure material_requests table has initial demo data
    try {
      const matCount = dbQuery.get('SELECT count(*) as count FROM material_requests');
      if (!matCount || Number(matCount.count) === 0) {
        const staffObj = dbQuery.get('SELECT id, name FROM users WHERE role = "STAFF" LIMIT 1');
        const sId = staffObj ? staffObj.id : 2;
        const sName = staffObj ? staffObj.name : 'Priya Sharma (Staff)';
        dbQuery.run(
          `INSERT INTO material_requests (staff_id, staff_name, material, quantity, unit, note, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [sId, sName, 'Flour / Premix Powder', 5, 'kg', 'Required for tomorrow morning', 'Pending']
        );
        dbQuery.run(
          `INSERT INTO material_requests (staff_id, staff_name, material, quantity, unit, note, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [sId, sName, 'Chocolate Sauce', 2, 'bottles', 'Running low on chocolate syrup', 'Approved']
        );
        saveDb();
      }
    } catch (e) {
      console.warn('Material requests count check skipped:', e);
    }
  }
}
