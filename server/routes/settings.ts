import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { audit } from '../lib/audit.js';
import { optionalNumber, optionalString, parse } from '../lib/http.js';
import { isValidTimeZone } from '../lib/time.js';
import { AuthenticatedRequest, authenticateToken, currentUser, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, async (_req, res) => {
  return res.json(await db.get('SELECT * FROM business_settings WHERE id = 1'));
});

const settingsSchema = z.object({
  business_name: optionalString(100),
  logo_url: optionalString(2000),
  address: optionalString(300),
  phone: optionalString(30),
  email: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.string().trim().email().optional()),
  gstin: optionalString(20),
  currency_symbol: optionalString(5),
  receipt_footer: optionalString(300),
  default_gst_percent: optionalNumber(z.number().min(0).max(100)),
  low_stock_threshold_default: optionalNumber(z.number().int().min(0)),
  timezone: z
    .string()
    .trim()
    .refine(isValidTimeZone, 'Unknown timezone (use an IANA name such as Asia/Kolkata)')
    .optional(),
});

router.put('/', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const data = parse(settingsSchema, req.body);

  const updated = await db.transaction(async (tx) => {
    const current = await tx.get<Record<string, any>>('SELECT * FROM business_settings WHERE id = 1');
    const pick = <K extends keyof typeof data>(key: K) => (data[key] !== undefined ? data[key] : current?.[key]);

    await tx.run(
      `UPDATE business_settings SET business_name = ?, logo_url = ?, address = ?, phone = ?, email = ?, gstin = ?,
         currency_symbol = ?, receipt_footer = ?, default_gst_percent = ?, low_stock_threshold_default = ?, timezone = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [
        pick('business_name') || 'Waffle Wisk Cart',
        pick('logo_url') ?? '',
        pick('address') ?? '',
        pick('phone') ?? '',
        pick('email') ?? '',
        pick('gstin') ?? '',
        pick('currency_symbol') || '₹',
        pick('receipt_footer') ?? '',
        pick('default_gst_percent') ?? 5,
        pick('low_stock_threshold_default') ?? 5,
        pick('timezone') || 'Asia/Kolkata',
      ]
    );
    await audit(tx, actor, 'UPDATE_SETTINGS', 'Updated business settings & POS configuration', req.ip);
    return tx.get('SELECT * FROM business_settings WHERE id = 1');
  });

  return res.json(updated);
});

export default router;
