import { Database } from './types.js';

interface Migration {
  id: string;
  statements: string[];
}

// Append-only: never edit a migration that has shipped; add a new one instead.
export const migrations: Migration[] = [
  {
    id: '001_initial_schema',
    statements: [
      `CREATE TABLE IF NOT EXISTS users (
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
      )`,
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        display_order INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS products (
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
      )`,
      `CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        old_price REAL NOT NULL,
        new_price REAL NOT NULL,
        updated_by INTEGER NOT NULL REFERENCES users(id),
        updated_by_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS inventory_items (
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
      )`,
      `CREATE TABLE IF NOT EXISTS inventory_movements (
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
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
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
      )`,
      `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS receipts (
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
      )`,
      `CREATE TABLE IF NOT EXISTS business_settings (
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
      )`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id),
        user_name TEXT NOT NULL,
        user_role TEXT NOT NULL,
        description TEXT NOT NULL,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS material_requests (
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
      )`,
      `CREATE TABLE IF NOT EXISTS carts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cart_number TEXT UNIQUE NOT NULL,
        staff_id INTEGER REFERENCES users(id),
        staff_name TEXT NOT NULL,
        customer_name TEXT DEFAULT 'Walk-in Customer',
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
        total REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )`,
      `CREATE TABLE IF NOT EXISTS cart_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        item_name_snapshot TEXT NOT NULL,
        price_snapshot REAL NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        subtotal REAL NOT NULL
      )`,
    ],
  },
  {
    id: '002_checkout_integrity',
    statements: [
      `ALTER TABLE orders ADD COLUMN cart_id INTEGER REFERENCES carts(id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_cart_id ON orders(cart_id) WHERE cart_id IS NOT NULL`,
      `ALTER TABLE products ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE business_settings ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'`,
      `INSERT OR IGNORE INTO business_settings (id) VALUES (1)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_staff_id ON orders(staff_id)`,
      `CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id)`,
      `CREATE INDEX IF NOT EXISTS idx_carts_staff_status ON carts(staff_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`,
    ],
  },
];

export async function runMigrations(db: Database): Promise<void> {
  await db.run(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const applied = new Set((await db.all<{ id: string }>('SELECT id FROM schema_migrations')).map((r) => r.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    await db.transaction(async (tx) => {
      for (const sql of migration.statements) {
        await tx.run(sql);
      }
      await tx.run('INSERT INTO schema_migrations (id) VALUES (?)', [migration.id]);
    });
    console.log(`Applied migration ${migration.id}`);
  }
}
