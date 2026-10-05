import { Router, Response } from 'express';
import { dbQuery } from '../db.js';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Get Business Settings
router.get('/', authenticateToken, (_req, res) => {
  const settings = dbQuery.get('SELECT * FROM business_settings WHERE id = 1');
  return res.json(settings);
});

// Update Business Settings (Admin Only)
router.put('/', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const {
    business_name,
    logo_url,
    address,
    phone,
    email,
    gstin,
    currency_symbol,
    receipt_footer,
    default_gst_percent,
    low_stock_threshold_default,
  } = req.body;

  dbQuery.run(
    `UPDATE business_settings SET
      business_name = ?,
      logo_url = ?,
      address = ?,
      phone = ?,
      email = ?,
      gstin = ?,
      currency_symbol = ?,
      receipt_footer = ?,
      default_gst_percent = ?,
      low_stock_threshold_default = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
    [
      business_name || 'Waffle Wisk Cart',
      logo_url !== undefined ? logo_url : '',
      address || '',
      phone || '',
      email || '',
      gstin || '',
      currency_symbol || '₹',
      receipt_footer || 'Thank you for enjoying our waffles!',
      default_gst_percent !== undefined ? Number(default_gst_percent) : 5.0,
      low_stock_threshold_default !== undefined ? Number(low_stock_threshold_default) : 5,
    ]
  );

  const updated = dbQuery.get('SELECT * FROM business_settings WHERE id = 1');

  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['UPDATE_SETTINGS', req.user!.id, req.user!.name, req.user!.role, 'Updated business settings & POS configuration']
  );

  return res.json(updated);
});

export default router;
