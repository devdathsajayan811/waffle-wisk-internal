import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/index.js';

export type Role = 'ADMIN' | 'STAFF';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  username: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ id: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/**
 * Verifies the bearer token and reloads the user, so disabling an account or
 * changing a role takes effect immediately rather than when the token expires.
 */
export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  let userId: number;
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { id?: unknown };
    userId = Number(decoded.id);
    if (!Number.isInteger(userId)) throw new Error('Malformed token');
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = await db.get<AuthUser & { status: string }>(
    'SELECT id, name, email, username, role, status FROM users WHERE id = ?',
    [userId]
  );
  if (!user || user.status !== 'ACTIVE') {
    return res.status(401).json({ error: 'Account is disabled or no longer exists' });
  }

  req.user = { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role };
  return next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
    }
    return next();
  };
}

/** Narrowing helper for handlers mounted behind authenticateToken. */
export function currentUser(req: AuthenticatedRequest): AuthUser {
  if (!req.user) throw new Error('authenticateToken must run before this handler');
  return req.user;
}
