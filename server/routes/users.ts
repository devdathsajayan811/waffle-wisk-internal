import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, Queryable } from '../db/index.js';
import { audit } from '../lib/audit.js';
import { badRequest, conflict, idParam, notFound, optionalString, parse, password } from '../lib/http.js';
import { AuthenticatedRequest, authenticateToken, currentUser, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken, requireRole('ADMIN'));

const PUBLIC_FIELDS = 'id, name, email, username, phone, role, status, created_at, last_login';

const roles = z.enum(['ADMIN', 'STAFF'], { errorMap: () => ({ message: 'Role must be ADMIN or STAFF' }) });
const statuses = z.enum(['ACTIVE', 'DISABLED'], { errorMap: () => ({ message: 'Status must be ACTIVE or DISABLED' }) });

router.get('/', async (_req, res) => {
  return res.json(await db.all(`SELECT ${PUBLIC_FIELDS} FROM users ORDER BY id ASC`));
});

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores'),
  phone: optionalString(20),
  password,
  role: roles,
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const data = parse(createSchema, req.body);

  const user = await db.transaction(async (tx) => {
    if (await tx.get('SELECT id FROM users WHERE email = ?', [data.email])) throw conflict('Email already registered');
    if (await tx.get('SELECT id FROM users WHERE username = ?', [data.username])) throw conflict('Username already taken');

    const { lastInsertRowid } = await tx.run(
      `INSERT INTO users (name, email, username, phone, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [data.name, data.email, data.username, data.phone ?? '', bcrypt.hashSync(data.password, 10), data.role]
    );
    await audit(tx, actor, 'CREATE_USER', `Created user '${data.name}' with role ${data.role}`, req.ip);
    return tx.get(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`, [lastInsertRowid]);
  });

  return res.status(201).json(user);
});

async function otherActiveAdmins(q: Queryable, excludeId: number): Promise<number> {
  const row = await q.get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE' AND id != ?`,
    [excludeId]
  );
  return Number(row?.count ?? 0);
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: optionalString(20),
  role: roles.optional(),
  status: statuses.optional(),
});

router.put('/:id', async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);
  const data = parse(updateSchema, req.body);

  const user = await db.transaction(async (tx) => {
    const existing = await tx.get<{ id: number; name: string; phone: string; role: string; status: string }>(
      'SELECT id, name, phone, role, status FROM users WHERE id = ?',
      [id]
    );
    if (!existing) throw notFound('User not found');

    const nextRole = data.role ?? existing.role;
    const nextStatus = data.status ?? existing.status;

    if (id === actor.id && (nextStatus !== 'ACTIVE' || nextRole !== 'ADMIN')) {
      throw badRequest('You cannot disable or demote your own account.');
    }
    const losesAdmin = existing.role === 'ADMIN' && existing.status === 'ACTIVE' && (nextRole !== 'ADMIN' || nextStatus !== 'ACTIVE');
    if (losesAdmin && (await otherActiveAdmins(tx, id)) === 0) {
      throw badRequest('At least one active admin account is required.');
    }

    await tx.run('UPDATE users SET name = ?, phone = ?, role = ?, status = ? WHERE id = ?', [
      data.name ?? existing.name,
      data.phone ?? existing.phone,
      nextRole,
      nextStatus,
      id,
    ]);
    await audit(tx, actor, 'UPDATE_USER', `Updated user details for '${existing.name}'`, req.ip);
    return tx.get(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`, [id]);
  });

  return res.json(user);
});

router.post('/:id/reset-password', async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);
  const { new_password } = parse(z.object({ new_password: password }), req.body);

  const existing = await db.get<{ name: string }>('SELECT name FROM users WHERE id = ?', [id]);
  if (!existing) throw notFound('User not found');

  await db.transaction(async (tx) => {
    await tx.run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(new_password, 10), id]);
    await audit(tx, actor, 'RESET_USER_PASSWORD', `Reset password for user '${existing.name}'`, req.ip);
  });

  return res.json({ message: `Password for ${existing.name} reset successfully` });
});

export default router;
