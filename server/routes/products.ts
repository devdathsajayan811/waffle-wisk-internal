import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { dbQuery } from '../db.js';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Configure Multer for product image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'product-' + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Image Upload Endpoint
router.post('/upload-image', authenticateToken, requireRole('ADMIN'), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  return res.json({ imageUrl });
});

// Get Categories
router.get('/categories', authenticateToken, (_req, res) => {
  const categories = dbQuery.all('SELECT * FROM categories ORDER BY display_order ASC');
  return res.json(categories);
});

// Get All Products
router.get('/', authenticateToken, (req, res) => {
  const { category, search, availability } = req.query;

  let sql = `
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (category && category !== 'all') {
    sql += ` AND (c.slug = ? OR c.id = ?)`;
    params.push(category, category);
  }

  if (availability && availability !== 'all') {
    sql += ` AND p.availability = ?`;
    params.push(availability);
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  sql += ` ORDER BY p.id DESC`;

  const products = dbQuery.all(sql, params);
  return res.json(products);
});

// Get Single Product & Price History
router.get('/:id', authenticateToken, (req, res) => {
  const product = dbQuery.get(
    `SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
    [req.params.id]
  );
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const priceHistory = dbQuery.all(
    `SELECT * FROM price_history WHERE product_id = ? ORDER BY created_at DESC`,
    [req.params.id]
  );

  return res.json({ product, priceHistory });
});

// Add Product (Admin Only)
router.post('/', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const {
    sku,
    name,
    category_id,
    description,
    image_url,
    price,
    discount_price,
    tax_percent,
    stock_quantity,
    low_stock_threshold,
    unit,
    availability,
  } = req.body;

  if (!name || !category_id || price === undefined || price === null) {
    return res.status(400).json({ error: 'Name, Category, and Price are required' });
  }

  if (Number(price) < 0) {
    return res.status(400).json({ error: 'Price must be a non-negative number' });
  }

  const generatedSku = sku || `WFL-${Math.floor(1000 + Math.random() * 9000)}`;

  const result = dbQuery.run(
    `INSERT INTO products (sku, name, category_id, description, image_url, price, discount_price, tax_percent, stock_quantity, low_stock_threshold, unit, availability)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generatedSku,
      name.trim(),
      Number(category_id),
      description || '',
      image_url || '',
      Number(price),
      discount_price ? Number(discount_price) : null,
      tax_percent !== undefined ? Number(tax_percent) : 5.0,
      stock_quantity !== undefined ? Number(stock_quantity) : 0,
      low_stock_threshold !== undefined ? Number(low_stock_threshold) : 5,
      unit || 'pcs',
      availability || 'AVAILABLE',
    ]
  );

  const newProduct = dbQuery.get(`SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = ?`, [result.lastInsertRowid]);

  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['CREATE_PRODUCT', req.user!.id, req.user!.name, req.user!.role, `Created new product: ${name} (Price: ₹${price})`]
  );

  return res.status(201).json(newProduct);
});

// Edit Product Details (Admin Only)
router.put('/:id', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const productId = Number(req.params.id);
  const existing = dbQuery.get('SELECT * FROM products WHERE id = ?', [productId]);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const {
    sku,
    name,
    category_id,
    description,
    image_url,
    price,
    discount_price,
    tax_percent,
    stock_quantity,
    low_stock_threshold,
    unit,
    availability,
  } = req.body;

  const newPrice = Number(price);
  const oldPrice = Number(existing.price);

  // If price changed, maintain mandatory price history record
  if (newPrice !== oldPrice) {
    dbQuery.run(
      `INSERT INTO price_history (product_id, old_price, new_price, updated_by, updated_by_name) VALUES (?, ?, ?, ?, ?)`,
      [productId, oldPrice, newPrice, req.user!.id, req.user!.name]
    );

    dbQuery.run(
      `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
      ['PRICE_CHANGE', req.user!.id, req.user!.name, req.user!.role, `Price for '${existing.name}' updated from ₹${oldPrice} to ₹${newPrice}`]
    );
  }

  dbQuery.run(
    `UPDATE products SET
      sku = ?,
      name = ?,
      category_id = ?,
      description = ?,
      image_url = ?,
      price = ?,
      discount_price = ?,
      tax_percent = ?,
      stock_quantity = ?,
      low_stock_threshold = ?,
      unit = ?,
      availability = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      sku || existing.sku,
      name ? name.trim() : existing.name,
      category_id ? Number(category_id) : existing.category_id,
      description !== undefined ? description : existing.description,
      image_url !== undefined ? image_url : existing.image_url,
      newPrice,
      discount_price !== undefined ? (discount_price ? Number(discount_price) : null) : existing.discount_price,
      tax_percent !== undefined ? Number(tax_percent) : existing.tax_percent,
      stock_quantity !== undefined ? Number(stock_quantity) : existing.stock_quantity,
      low_stock_threshold !== undefined ? Number(low_stock_threshold) : existing.low_stock_threshold,
      unit || existing.unit,
      availability || existing.availability,
      productId,
    ]
  );

  const updatedProduct = dbQuery.get(`SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = ?`, [productId]);

  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['UPDATE_PRODUCT', req.user!.id, req.user!.name, req.user!.role, `Updated product: ${name || existing.name}`]
  );

  return res.json(updatedProduct);
});

// Specific Price Management Endpoint (Admin Only)
router.patch('/:id/price', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const productId = Number(req.params.id);
  const { price, discount_price } = req.body;

  if (price === undefined || price === null || Number(price) < 0) {
    return res.status(400).json({ error: 'Valid price is required' });
  }

  const existing = dbQuery.get('SELECT * FROM products WHERE id = ?', [productId]);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const oldPrice = Number(existing.price);
  const newPrice = Number(price);

  dbQuery.run(
    `INSERT INTO price_history (product_id, old_price, new_price, updated_by, updated_by_name) VALUES (?, ?, ?, ?, ?)`,
    [productId, oldPrice, newPrice, req.user!.id, req.user!.name]
  );

  dbQuery.run(
    `UPDATE products SET price = ?, discount_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [newPrice, discount_price ? Number(discount_price) : null, productId]
  );

  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['PRICE_CHANGE', req.user!.id, req.user!.name, req.user!.role, `Explicit price update for '${existing.name}' from ₹${oldPrice} to ₹${newPrice}`]
  );

  const history = dbQuery.all(`SELECT * FROM price_history WHERE product_id = ? ORDER BY created_at DESC`, [productId]);
  return res.json({ message: 'Price updated successfully', newPrice, priceHistory: history });
});

// Toggle Status / Availability
router.patch('/:id/toggle-status', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const productId = Number(req.params.id);
  const existing = dbQuery.get('SELECT * FROM products WHERE id = ?', [productId]);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const nextStatus = existing.availability === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
  dbQuery.run('UPDATE products SET availability = ? WHERE id = ?', [nextStatus, productId]);

  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['TOGGLE_PRODUCT_STATUS', req.user!.id, req.user!.name, req.user!.role, `Status of '${existing.name}' changed to ${nextStatus}`]
  );

  return res.json({ message: `Product availability changed to ${nextStatus}`, availability: nextStatus });
});

// Delete Product (Admin Only)
router.delete('/:id', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const productId = Number(req.params.id);
  const existing = dbQuery.get('SELECT * FROM products WHERE id = ?', [productId]);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  dbQuery.run('DELETE FROM products WHERE id = ?', [productId]);

  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['DELETE_PRODUCT', req.user!.id, req.user!.name, req.user!.role, `Deleted product: ${existing.name}`]
  );

  return res.json({ message: 'Product deleted successfully' });
});

export default router;
