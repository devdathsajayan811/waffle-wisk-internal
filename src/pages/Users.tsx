import React, { useState, useEffect } from 'react';
import { UserPlus, Key, Edit, ShieldCheck, UserCheck, Users as UsersIcon } from 'lucide-react';
import { api } from '../services/api';
import { User, UserRole } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Alert, EmptyState, PageHeader, SkeletonRows, StatCard } from '../components/ui';

export const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [userModalOpen, setUserModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [resetModalOpen, setResetModalOpen] = useState<boolean>(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');

  // User Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('STAFF');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'DISABLED'>('ACTIVE');

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setUsername('');
    setPhone('');
    setRole('STAFF');
    setPassword('');
    setStatus('ACTIVE');
    setFormError(null);
    setUserModalOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setUsername(u.username);
    setPhone(u.phone || '');
    setRole(u.role);
    setStatus(u.status);
    setFormError(null);
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          name,
          phone,
          role,
          status,
        });
      } else {
        await api.createUser({
          name,
          email,
          username,
          phone,
          password,
          role,
        });
      }
      setUserModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setFormError(null);
    setFormLoading(true);

    try {
      await api.resetUserPassword(targetUser.id, newPassword);
      setResetModalOpen(false);
      setNewPassword('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to reset password');
    } finally {
      setFormLoading(false);
    }
  };

  const adminCount = users.filter((u) => u.role === 'ADMIN').length;
  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Administration"
        title="Team"
        description="Staff accounts, roles and access. Disable an account to block sign-in without losing its history."
        actions={
          <button onClick={handleOpenAdd} className="btn-primary">
            <UserPlus className="h-4 w-4" />
            Add team member
          </button>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Team members" value={users.length} icon={UsersIcon} tone="choco" loading={loading} />
        <StatCard label="Admins" value={adminCount} icon={ShieldCheck} tone="waffle" loading={loading} />
        <StatCard label="Active accounts" value={activeCount} icon={UserCheck} tone="emerald" loading={loading} hint={users.length - activeCount > 0 ? `${users.length - activeCount} disabled` : 'Everyone can sign in'} />
      </section>

      <div className="card overflow-hidden">
        {!loading && users.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No team members yet" description="Add staff so they can sign in and take orders." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="hidden md:table-cell">Contact</th>
                  <th>Role</th>
                  <th className="hidden sm:table-cell">Status</th>
                  <th className="hidden lg:table-cell">Last sign-in</th>
                  <th className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows cols={6} rows={4} />
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className={u.status === 'DISABLED' ? 'opacity-60' : ''}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-waffle-100 to-waffle-200 font-display text-sm font-semibold text-waffle-800 ring-1 ring-inset ring-waffle-300/50">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-choco-900">{u.name}</p>
                            <p className="truncate text-xs text-choco-400">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell">
                        <p className="text-choco-700">{u.email}</p>
                        <p className="text-xs text-choco-400">{u.phone || '—'}</p>
                      </td>
                      <td>
                        <StatusBadge status={u.role} type="role" />
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className={u.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}>
                          <span className="dot" />
                          {u.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap text-xs text-choco-400 lg:table-cell">
                        {u.last_login
                          ? new Date(u.last_login).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
                          : 'Never'}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => handleOpenEdit(u)} className="icon-btn h-8 w-8" title="Edit member" aria-label={`Edit ${u.name}`}>
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setTargetUser(u);
                              setNewPassword('');
                              setFormError(null);
                              setResetModalOpen(true);
                            }}
                            className="icon-btn h-8 w-8 hover:bg-waffle-50 hover:text-waffle-700"
                            title="Reset password"
                            aria-label={`Reset password for ${u.name}`}
                          >
                            <Key className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {userModalOpen && (
        <Modal
          isOpen={userModalOpen}
          onClose={() => setUserModalOpen(false)}
          title={editingUser ? `Edit ${editingUser.name}` : 'Add team member'}
          description={editingUser ? 'Email and username cannot be changed.' : 'They can sign in with their username or email.'}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveUser} className="space-y-4">
            {formError && <Alert tone="error">{formError}</Alert>}

            <div>
              <label className="label" htmlFor="user-name">Full name</label>
              <input
                id="user-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ananya Iyer"
                className="input"
              />
            </div>

            {!editingUser && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="user-email">Email</label>
                    <input
                      id="user-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ananya@wafflewisk.com"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="user-username">Username</label>
                    <input
                      id="user-username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ananya"
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="user-password">Temporary password</label>
                  <input
                    id="user-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                  />
                  <p className="field-hint">At least 8 characters, with one uppercase letter and one number.</p>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="user-phone">Phone</label>
                <input
                  id="user-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98204 31756"
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="user-role">Role</label>
                <select id="user-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="select">
                  <option value="STAFF">Staff · POS and orders</option>
                  <option value="ADMIN">Admin · full access</option>
                </select>
              </div>
            </div>

            {editingUser && (
              <div>
                <label className="label" htmlFor="user-status">Account status</label>
                <select id="user-status" value={status} onChange={(e) => setStatus(e.target.value as any)} className="select">
                  <option value="ACTIVE">Active</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </div>
            )}

            <div className="-mx-6 -mb-5 mt-2 flex justify-end gap-2 border-t border-cream-200 bg-cream-50/60 px-6 py-4">
              <button type="button" onClick={() => setUserModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={formLoading} className="btn-primary">
                {formLoading ? 'Saving…' : editingUser ? 'Save changes' : 'Create account'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {resetModalOpen && targetUser && (
        <Modal
          isOpen={resetModalOpen}
          onClose={() => setResetModalOpen(false)}
          title="Reset password"
          description={`Set a new password for ${targetUser.name}.`}
          maxWidth="sm"
        >
          <form onSubmit={handleResetPassword} className="space-y-4">
            {formError && <Alert tone="error">{formError}</Alert>}

            <div>
              <label className="label" htmlFor="reset-password">New password</label>
              <input
                id="reset-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
              />
              <p className="field-hint">At least 8 characters, with one uppercase letter and one number.</p>
            </div>

            <div className="-mx-6 -mb-5 mt-2 flex justify-end gap-2 border-t border-cream-200 bg-cream-50/60 px-6 py-4">
              <button type="button" onClick={() => setResetModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={formLoading} className="btn-primary">
                {formLoading ? 'Updating…' : 'Reset password'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
