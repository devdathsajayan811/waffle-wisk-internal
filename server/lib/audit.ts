import type { Queryable } from '../db/index.js';
import type { AuthUser } from '../middleware/auth.js';

export async function audit(
  q: Queryable,
  actor: Pick<AuthUser, 'id' | 'name' | 'role'>,
  action: string,
  description: string,
  ip?: string
): Promise<void> {
  await q.run(
    'INSERT INTO audit_logs (action, user_id, user_name, user_role, description, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
    [action, actor.id, actor.name, actor.role, description, ip ?? null]
  );
}
