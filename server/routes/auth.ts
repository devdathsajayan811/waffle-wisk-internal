import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbQuery } from '../db.js';
import { JWT_SECRET, AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';

const router = Router();

// Login
router.post('/login', (req, res) => {
  const { identifier, password } = req.body; // identifier can be username or email

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  const user = dbQuery.get(
    'SELECT * FROM users WHERE (email = ? OR username = ?) AND status = "ACTIVE"',
    [identifier.trim(), identifier.trim()]
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid username/email or password' });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid username/email or password' });
  }

  // Update last login
  dbQuery.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

  // Record Audit log
  dbQuery.run(
    'INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)',
    ['LOGIN', user.id, user.name, user.role, `${user.name} logged into the portal.`]
  );

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  const settings = dbQuery.get('SELECT * FROM business_settings WHERE id = 1');

  return res.json({
    token,
    user: payload,
    settings,
  });
});

// Get Current User Profile
router.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const user = dbQuery.get('SELECT id, name, email, username, phone, role, status, created_at, last_login FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const settings = dbQuery.get('SELECT * FROM business_settings WHERE id = 1');
  return res.json({ user, settings });
});

// Change Password
router.post('/change-password', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New password and confirmation do not match' });
  }

  // Password requirements: Min 8 chars, 1 uppercase, 1 number
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }
  if (!/[A-Z]/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
  }
  if (!/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must contain at least one number' });
  }

  const user = dbQuery.get('SELECT * FROM users WHERE id = ?', [req.user!.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const isPasswordValid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!isPasswordValid) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  dbQuery.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user!.id]);

  dbQuery.run(
    'INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)',
    ['CHANGE_PASSWORD', req.user!.id, req.user!.name, req.user!.role, 'User successfully changed their password.']
  );

  return res.json({ message: 'Password changed successfully' });
});

// Dev Forgot Password Reset flow
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email address is required' });

  const user = dbQuery.get('SELECT * FROM users WHERE email = ?', [email.trim()]);
  if (!user) {
    // Return friendly success message without revealing email non-existence for security
    return res.json({ message: 'If the email exists in our system, a password reset link has been dispatched.' });
  }

  // Local development reset mechanism
  return res.json({
    message: 'Development Reset Mode: You can log in with default credentials (Admin: admin/admin123, Staff: staff/staff123) or contact system admin.',
    devHint: 'Use admin123 or staff123'
  });
});

export default router;
