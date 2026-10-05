import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbQuery } from '../db.js';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// List Users (Admin Only)
router.get('/', authenticateToken, requireRole('ADMIN'), (_req, res) => {
  const users = dbQuery.all('SELECT id, name, email, username, phone, role, status, created_at, last_login FROM users ORDER BY id ASC');
  return res.json(users);
});

// Create User (Admin Only)
router.post('/', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const { name, email, username, phone, password, role } = req.body;

  if (!name || !email || !username || !password || !role) {
    return res.status(400).json({ error: 'Name, email, username, password, and role are required' });
  }

  // Password validation: min 8 chars, 1 number, 1 uppercase
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and contain at least one uppercase letter and one number' });
  }

  // Check duplicate email or username
  const existingEmail = dbQuery.get('SELECT id FROM users WHERE email = ?', [email.trim()]);
  if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

  const existingUsername = dbQuery.get('SELECT id FROM users WHERE username = ?', [username.trim()]);
  if (existingUsername) return res.status(400).json({ error: 'Username already taken' });

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = dbQuery.run(
    `INSERT INTO users (name, email, username, phone, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [name.trim(), email.trim(), username.trim(), phone || '', passwordHash, role]
  );

  const newUser = dbQuery.get('SELECT id, name, email, username, phone, role, status, created_at, last_login FROM users WHERE id = ?', [result.lastInsertRowid]);

  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['CREATE_USER', req.user!.id, req.user!.name, req.user!.role, `Created user '${name}' with role ${role}`]
  );

  return res.status(201).json(newUser);
});

// Edit User (Admin Only)
router.put('/:id', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const userId = Number(req.params.id);
  const existing = dbQuery.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const { name, phone, role, status } = req.body;

  dbQuery.run(
    `UPDATE users SET name = ?, phone = ?, role = ?, status = ? WHERE id = ?`,
    [name ? name.trim() : existing.name, phone !== undefined ? phone : existing.phone, role || existing.role, status || existing.status, userId]
  );

  const updated = dbQuery.get('SELECT id, name, email, username, phone, role, status, created_at, last_login FROM users WHERE id = ?', [userId]);

  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['UPDATE_USER', req.user!.id, req.user!.name, req.user!.role, `Updated user details for '${existing.name}'`]
  );

  return res.json(updated);
});

// Admin Reset Password for User (Admin Only)
router.post('/:id/reset-password', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const userId = Number(req.params.id);
  const { new_password } = req.body;

  if (!new_password || new_password.length < 8 || !/[A-Z]/.test(new_password) || !/[0-9]/.test(new_password)) {
    return res.status(400).json({ error: 'New password must be at least 8 characters with 1 uppercase letter and 1 number' });
  }

  const existing = dbQuery.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const passwordHash = bcrypt.hashSync(new_password, 10);
  dbQuery.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['RESET_USER_PASSWORD', req.user!.id, req.user!.name, req.user!.role, `Reset password for user '${existing.name}'`]
  );

  return res.json({ message: `Password for ${existing.name} reset successfully` });
});

export default router;
