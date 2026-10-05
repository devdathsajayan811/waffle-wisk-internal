import React, { useState, useEffect } from 'react';
import { Plus, UserPlus, Key, Edit, ShieldCheck, User as UserIcon } from 'lucide-react';
import { api } from '../services/api';
import { User, UserRole } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-choco-900">User & Staff Management</h2>
          <p className="text-xs text-choco-500">Create staff accounts, assign roles, reset passwords, and manage active status</p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-gradient-to-r from-waffle-500 to-waffle-600 hover:from-waffle-600 hover:to-waffle-700 text-white font-bold text-xs rounded-xl shadow-waffle flex items-center space-x-2 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New User / Staff</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cream-100/60 text-choco-700 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Last Login</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 text-choco-900">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-choco-400">
                    Loading user accounts...
                  </td>
                </tr>
              ) : users.length > 0 ? (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-cream-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-waffle-100 text-waffle-800 font-extrabold flex items-center justify-center text-xs">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-choco-900 block">{u.name}</span>
                          <span className="text-[10px] text-choco-400 font-mono">@{u.username}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="block font-medium">{u.email}</span>
                      <span className="block text-[10px] text-choco-500">{u.phone || '—'}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={u.role} type="role" />
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-choco-500 text-[11px]">
                      {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 text-choco-600 hover:bg-cream-200 rounded-lg"
                          title="Edit User Info"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setTargetUser(u);
                            setNewPassword('');
                            setResetModalOpen(true);
                          }}
                          className="p-1.5 text-waffle-600 hover:bg-waffle-50 rounded-lg"
                          title="Reset User Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-choco-400">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* USER ADD/EDIT MODAL */}
      {userModalOpen && (
        <Modal
          isOpen={userModalOpen}
          onClose={() => setUserModalOpen(false)}
          title={editingUser ? `Edit User: ${editingUser.name}` : 'Add New Staff / Admin'}
          maxWidth="md"
        >
          <form onSubmit={handleSaveUser} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Verma"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
              />
            </div>

            {!editingUser && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-choco-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="rahul@wafflewisk.com"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-choco-700 mb-1">Username *</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="rahul"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-choco-700 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-choco-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-choco-700 mb-1">Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                >
                  <option value="STAFF">STAFF (POS & Orders)</option>
                  <option value="ADMIN">ADMIN (Full Control)</option>
                </select>
              </div>
            </div>

            {editingUser && (
              <div>
                <label className="block text-xs font-semibold text-choco-700 mb-1">Account Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </div>
            )}

            <div className="pt-3 flex justify-end space-x-2 border-t border-cream-200">
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-choco-600 bg-cream-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-5 py-2 text-xs font-bold text-white bg-waffle-500 hover:bg-waffle-600 rounded-xl shadow-waffle"
              >
                {formLoading ? 'Saving...' : editingUser ? 'Update User' : 'Create User Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetModalOpen && targetUser && (
        <Modal
          isOpen={resetModalOpen}
          onClose={() => setResetModalOpen(false)}
          title={`Reset Password for ${targetUser.name}`}
          maxWidth="sm"
        >
          <form onSubmit={handleResetPassword} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-choco-700 mb-1">New Password *</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-cream-300 focus:outline-hidden"
              />
            </div>

            <div className="pt-3 flex justify-end space-x-2 border-t border-cream-200">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-choco-600 bg-cream-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-5 py-2 text-xs font-bold text-white bg-waffle-500 hover:bg-waffle-600 rounded-xl shadow-waffle"
              >
                {formLoading ? 'Updating...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
