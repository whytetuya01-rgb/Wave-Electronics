import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { TableSkeleton, ButtonSpinner } from '../components/ui/Loading';
import { FormField } from '../components/ui/FormField';
import { ValidatedInput } from '../components/ui/ValidatedInput';
import { SimpleSelect } from '../components/ui/Select';
import { PageHeader } from '../components/ui/PageHeader';
import { TablePagination } from '../components/ui/TablePagination';
import { usePagination } from '../hooks/usePagination';
import { toast } from '../utils/toast';
import { handleApiError } from '../utils/apiErrors';
import {
  createUserSchema,
  CreateUserFormData,
  resetPasswordSchema,
  ResetPasswordFormData,
} from '../utils/validationSchemas';
import {
  Users as UsersIcon,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Factory,
  Mail,
  Clock,
} from 'lucide-react';

type UserRole = 'admin' | 'store_keeper' | 'production';

interface UserItem {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'store_keeper', label: 'Store Keeper' },
  { value: 'production', label: 'Production' },
];

const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
  switch (role) {
    case 'admin':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#807365]/10 text-[#716B64] border border-[#807365]/25">
          <ShieldCheck className="w-3 h-3" /> Admin
        </span>
      );
    case 'store_keeper':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#168060]/10 text-[#168060] border border-[#168060]/25">
          <UserCheck className="w-3 h-3" /> Store Keeper
        </span>
      );
    case 'production':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#B7791F]/10 text-[#B7791F] border border-[#B7791F]/25">
          <Factory className="w-3 h-3" /> Production
        </span>
      );
    default:
      return null;
  }
};

export const Users: React.FC = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserItem | null>(null);
  const [userToToggle, setUserToToggle] = useState<UserItem | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { name: '', email: '', password: '', role: 'store_keeper' },
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: { password: '' },
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/users');
      setUsers(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    form.reset({ name: '', email: '', password: '', role: 'store_keeper' });
    setFormError('');
    setShowAddModal(true);
  };

  const handleCreateUser = async (data: CreateUserFormData) => {
    setFormError('');
    setIsSaving(true);
    try {
      await api.post('/auth/users', data);
      toast.success(`User '${data.name}' created successfully.`);
      setShowAddModal(false);
      fetchUsers();
    } catch (err: any) {
      const msg = handleApiError(err, form.setError, 'Failed to create user');
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = async (u: UserItem, role: string) => {
    if (role === u.role) return;
    try {
      await api.patch(`/auth/users/${u._id}/role`, { role });
      toast.success(`${u.name}'s role updated to ${ROLE_OPTIONS.find((r) => r.value === role)?.label}.`);
      fetchUsers();
    } catch (err: any) {
      handleApiError(err, undefined, 'Failed to update role');
    }
  };

  const executeToggleStatus = async () => {
    if (!userToToggle) return;
    setToggleLoading(true);
    try {
      await api.patch(`/auth/users/${userToToggle._id}/status`);
      toast.success(
        `User '${userToToggle.name}' ${userToToggle.isActive ? 'deactivated' : 'activated'} successfully.`
      );
      setUserToToggle(null);
      fetchUsers();
    } catch (err: any) {
      handleApiError(err, undefined, 'Failed to change user status');
    } finally {
      setToggleLoading(false);
    }
  };

  const handleOpenResetPassword = (u: UserItem) => {
    resetPasswordForm.reset({ password: '' });
    setResetPasswordUser(u);
  };

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    if (!resetPasswordUser) return;
    setIsSaving(true);
    try {
      await api.patch(`/auth/users/${resetPasswordUser._id}/password`, data);
      toast.success(`Password reset for '${resetPasswordUser.name}'.`);
      setResetPasswordUser(null);
    } catch (err: any) {
      handleApiError(err, resetPasswordForm.setError, 'Failed to reset password');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesStatus =
      statusFilter === 'all' || (statusFilter === 'active' ? u.isActive : !u.isActive);
    const q = search.toLowerCase();
    const matchesSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });
  const usersPagination = usePagination(filteredUsers, `${search}|${statusFilter}`);

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.isActive).length;
  const adminCount = users.filter((u) => u.role === 'admin' && u.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UsersIcon}
        title="Users & Roles"
        description="Manage staff accounts and their access level across the workspace."
        actions={
          <button onClick={handleOpenAdd} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatCard title="Total Users" value={totalUsers} icon={UsersIcon} subtitle="Registered accounts" loading={loading} />
        <StatCard
          title="Active Accounts"
          value={activeUsers}
          icon={CheckCircle2}
          subtitle="Can currently sign in"
          iconBgClass="bg-[#168060]/10"
          iconColorClass="text-[#168060]"
          badge={{ label: `${activeUsers} Active`, variant: 'success' }}
          loading={loading}
        />
        <StatCard
          title="Active Admins"
          value={adminCount}
          icon={ShieldCheck}
          subtitle="Full access accounts"
          iconBgClass="bg-[#807365]/10"
          iconColorClass="text-[#716B64]"
          loading={loading}
        />
      </div>

      <div className="enterprise-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#807365] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-enterprise !pl-9"
          />
        </div>

        <div className="inline-flex rounded-[9px] border border-[#E6E3DE] p-1 bg-[#F7F6F3] text-xs w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-1 sm:flex-none px-3 py-1 rounded-[7px] text-[13px] font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-white text-[#171717] shadow-xs border border-[#E6E3DE]'
                : 'text-[#6B6863] hover:text-[#171717]'
            }`}
          >
            All ({users.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`flex-1 sm:flex-none px-3 py-1 rounded-[7px] text-[13px] font-medium transition-all ${
              statusFilter === 'active'
                ? 'bg-white text-[#168060] shadow-xs border border-[#E6E3DE] font-semibold'
                : 'text-[#6B6863] hover:text-[#171717]'
            }`}
          >
            Active ({users.filter((u) => u.isActive).length})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`flex-1 sm:flex-none px-3 py-1 rounded-[7px] text-[13px] font-medium transition-all ${
              statusFilter === 'inactive'
                ? 'bg-white text-[#171717] shadow-xs border border-[#E6E3DE] font-semibold'
                : 'text-[#6B6863] hover:text-[#171717]'
            }`}
          >
            Inactive ({users.filter((u) => !u.isActive).length})
          </button>
        </div>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="th-enterprise">Name</th>
                <th className="th-enterprise">Email</th>
                <th className="th-enterprise">Role</th>
                <th className="th-enterprise">Last Login</th>
                <th className="th-enterprise text-center">Status</th>
                <th className="th-enterprise text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E3DE]/60">
              {loading ? (
                <TableSkeleton rows={5} cols={6} />
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12">
                    <EmptyState
                      icon={UsersIcon}
                      title={search ? 'No matching users found' : 'No users yet'}
                      description={
                        search
                          ? 'Try adjusting your search criteria.'
                          : 'Add your first staff account to get started.'
                      }
                      action={
                        !search
                          ? { label: 'Add User', onClick: handleOpenAdd, icon: Plus }
                          : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                usersPagination.pageItems.map((u) => {
                  const isSelf = currentUser?.id === u._id;
                  return (
                    <tr key={u._id} className="tr-enterprise group">
                      <td className="td-enterprise">
                        <div className="font-semibold text-[#171717] group-hover:text-[#807365] transition-colors">
                          {u.name}
                          {isSelf && (
                            <span className="ml-2 text-[11px] text-[#A69B8D] font-normal">(You)</span>
                          )}
                        </div>
                      </td>
                      <td className="td-enterprise">
                        <div className="flex items-center gap-1.5 text-[#6B6863] font-mono text-[12px]">
                          <Mail className="w-3.5 h-3.5 text-[#A69B8D]" />
                          {u.email}
                        </div>
                      </td>
                      <td className="td-enterprise w-44">
                        <SimpleSelect
                          value={u.role}
                          onValueChange={(val) => handleRoleChange(u, val)}
                          options={ROLE_OPTIONS}
                          disabled={isSelf}
                          triggerClassName="!h-8 !text-xs"
                        />
                      </td>
                      <td className="td-enterprise text-[12px] text-[#6B6863]">
                        {u.lastLogin ? (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#A69B8D]" />
                            {new Date(u.lastLogin).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-[#A69B8D] italic">Never</span>
                        )}
                      </td>
                      <td className="td-enterprise text-center">
                        <Badge variant={u.isActive ? 'success' : 'neutral'} dot>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="td-enterprise text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenResetPassword(u)}
                            title="Reset Password"
                            className="btn-ghost p-1.5 rounded-[8px]"
                          >
                            <KeyRound className="w-4 h-4 text-[#6B6863] hover:text-[#171717]" />
                          </button>
                          <button
                            onClick={() => !isSelf && setUserToToggle(u)}
                            title={isSelf ? 'Cannot deactivate your own account' : u.isActive ? 'Deactivate' : 'Activate'}
                            disabled={isSelf}
                            className="btn-ghost p-1.5 rounded-[8px] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {u.isActive ? (
                              <XCircle className="w-4 h-4 text-[#A69B8D] hover:text-[#B7791F]" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-[#A69B8D] hover:text-[#168060]" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={usersPagination.page}
          pageSize={usersPagination.pageSize}
          total={usersPagination.total}
          onPageChange={usersPagination.setPage}
          onPageSizeChange={usersPagination.setPageSize}
          itemLabel="users"
        />
      </div>

      {/* ADD USER DIALOG */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        size="md"
        icon={<UsersIcon className="w-5 h-5 text-[#807365]" />}
        title="Add User"
        onSubmit={form.handleSubmit(handleCreateUser)}
        footer={
          <>
            <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? <ButtonSpinner /> : <Plus className="w-4 h-4" />}
              <span>Create User</span>
            </button>
          </>
        }
      >
        {formError && (
          <div className="mb-4 p-3 rounded-[10px] bg-[#C2413A]/10 border border-[#C2413A]/30 text-[#C2413A] text-xs font-medium">
            {formError}
          </div>
        )}
        <div className="space-y-4">
          <FormField label="Full Name" required error={form.formState.errors.name?.message} id="user-name">
            <ValidatedInput id="user-name" placeholder="e.g. Priya Sharma" {...form.register('name')} />
          </FormField>

          <FormField label="Email Address" required error={form.formState.errors.email?.message} id="user-email">
            <ValidatedInput
              id="user-email"
              type="email"
              leftIcon={<Mail />}
              placeholder="name@wave.com"
              {...form.register('email')}
            />
          </FormField>

          <FormField
            label="Temporary Password"
            required
            error={form.formState.errors.password?.message}
            id="user-password"
            helperText="Share this with the user securely; they can be assigned a new one anytime via Reset Password."
          >
            <ValidatedInput id="user-password" type="password" placeholder="••••••••" {...form.register('password')} />
          </FormField>

          <FormField label="Role" required error={form.formState.errors.role?.message} id="user-role">
            <SimpleSelect
              id="user-role"
              value={form.watch('role')}
              onValueChange={(val) => form.setValue('role', val as UserRole, { shouldValidate: true })}
              options={ROLE_OPTIONS}
              hasError={Boolean(form.formState.errors.role)}
            />
          </FormField>
        </div>
      </Modal>

      {/* RESET PASSWORD DIALOG */}
      <Modal
        isOpen={!!resetPasswordUser}
        onClose={() => setResetPasswordUser(null)}
        size="sm"
        icon={<KeyRound className="w-5 h-5 text-[#807365]" />}
        title={`Reset Password: ${resetPasswordUser?.name}`}
        onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)}
        footer={
          <>
            <button type="button" onClick={() => setResetPasswordUser(null)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? <ButtonSpinner /> : <KeyRound className="w-4 h-4" />}
              <span>Reset Password</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField
            label="New Password"
            required
            error={resetPasswordForm.formState.errors.password?.message}
            id="new-password"
          >
            <ValidatedInput
              id="new-password"
              type="password"
              placeholder="••••••••"
              {...resetPasswordForm.register('password')}
            />
          </FormField>
        </div>
      </Modal>

      {/* TOGGLE STATUS CONFIRM */}
      <ConfirmModal
        isOpen={!!userToToggle}
        onClose={() => setUserToToggle(null)}
        onConfirm={executeToggleStatus}
        isLoading={toggleLoading}
        variant={userToToggle?.isActive ? 'warning' : 'primary'}
        title={userToToggle?.isActive ? 'Deactivate User' : 'Activate User'}
        description={
          userToToggle?.isActive
            ? `'${userToToggle?.name}' will no longer be able to sign in. They can be reactivated anytime.`
            : `'${userToToggle?.name}' will regain access and be able to sign in again.`
        }
        confirmText={userToToggle?.isActive ? 'Deactivate' : 'Activate'}
      />
    </div>
  );
};

export default Users;
