import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/index.js';
import { audit } from '../lib/audit.js';
import { badRequest, notFound, parse, password } from '../lib/http.js';
import { AuthenticatedRequest, AuthUser, authenticateToken, currentUser, signToken } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Username/email is required').max(200),
  password: z.string().min(1, 'Password is required').max(200),
});

router.post('/login', async (req, res) => {
  const { identifier, password: plain } = parse(loginSchema, req.body);

  const user = await db.get<AuthUser & { password_hash: string }>(
    `SELECT id, name, email, username, role, password_hash FROM users
     WHERE (email = ? OR username = ?) AND status = 'ACTIVE'`,
    [identifier, identifier]
  );

  if (!user || !bcrypt.compareSync(plain, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username/email or password' });
  }

  await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  await audit(db, user, 'LOGIN', `${user.name} logged into the portal.`, req.ip);

  const profile: AuthUser = { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role };
  const settings = await db.get('SELECT * FROM business_settings WHERE id = 1');
  return res.json({ token: signToken(profile), user: profile, settings });
});

router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const user = await db.get(
    'SELECT id, name, email, username, phone, role, status, created_at, last_login FROM users WHERE id = ?',
    [currentUser(req).id]
  );
  if (!user) throw notFound('User not found');
  const settings = await db.get('SELECT * FROM business_settings WHERE id = 1');
  return res.json({ user, settings });
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation do not match',
    path: ['confirmPassword'],
  });

router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);

  const row = await db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [actor.id]);
  if (!row) throw notFound('User not found');
  if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
    throw badRequest('Current password is incorrect');
  }

  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), actor.id]);
  await audit(db, actor, 'CHANGE_PASSWORD', 'User successfully changed their password.', req.ip);
  return res.json({ message: 'Password changed successfully' });
});

// No email delivery exists, so resets are performed by an admin. The response is
// identical whether or not the account exists to avoid leaking which emails are registered.
router.post('/forgot-password', (req, res) => {
  parse(z.object({ email: z.string().trim().email('A valid email address is required') }), req.body);
  return res.json({
    message: 'If an account exists for that email, please ask your administrator to reset the password from the Users page.',
  });
});

export default router;
