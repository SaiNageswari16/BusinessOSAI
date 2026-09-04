import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { api } from '@/services/api';
import { cn } from '@/utils/cn';

interface GlobalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  organization: string;
  branch: string;
  is_active: boolean;
  created_at: string;
}

const roleColors: Record<string, 'brand' | 'success' | 'warning' | 'purple' | 'danger'> = {
  SUPER_ADMIN: 'purple',
  GYM_OWNER: 'brand',
  MANAGER: 'warning',
  TRAINER: 'success',
  CUSTOMER: 'brand',
};

export function GlobalUsersPage() {
  const [users, setUsers] = useState<GlobalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [selectedUser, setSelectedUser] = useState<GlobalUser | null>(null);

  const fetchUsers = () => {
    setLoading(true);
    api.superAdmin.users()
      .then((data) => {
        setUsers(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const roles = ['ALL', 'GYM_OWNER', 'TRAINER', 'CUSTOMER', 'SUPER_ADMIN'];

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesSearch =
      !search ||
      (u.name && u.name.toLowerCase().includes(search.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase())) ||
      (u.organization && u.organization.toLowerCase().includes(search.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global Platform Users"
        breadcrumb={['Super Admin', 'Users']}
        actions={
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500 font-semibold bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
              Total Users: <span className="text-brand-600 font-bold">{users.length}</span>
            </div>
          </div>
        }
      />

      {/* Filter & Search Bar */}
      <div className="card p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                roleFilter === r
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {r === 'ALL' ? 'All Roles' : r.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or gym..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card p-4">
        {loading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[800px] text-xs">
              <thead>
                <tr className="border-b border-navy-100 text-navy-400 text-left font-semibold uppercase tracking-wider">
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Organization</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Joined Date</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                          {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{u.name || 'Unnamed User'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={roleColors[u.role] || 'brand'} size="sm">
                        {u.role.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Icon name="building-2" size={14} className="text-slate-400" />
                        {u.organization || 'Global Platform'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={u.is_active ? 'success' : 'danger'} dot size="sm">
                        {u.is_active ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-slate-500">{u.created_at || '—'}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(u);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Icon name="more-horizontal" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Icon name="users" size={20} />
            </div>
            <p className="text-xs font-semibold text-slate-600">No users found matching your criteria</p>
          </div>
        )}
      </div>

      {/* User Inspector Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Icon name="user" size={18} className="text-brand-600" /> User Profile Inspector
              </h3>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-600">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center text-sm shadow-md">
                  {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{selectedUser.name || 'Unnamed User'}</div>
                  <div className="text-xs text-slate-400 font-mono">{selectedUser.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-slate-400 font-semibold mb-1">Assigned Role</div>
                  <Badge variant={roleColors[selectedUser.role] || 'brand'} size="sm">
                    {selectedUser.role.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-slate-400 font-semibold mb-1">Account State</div>
                  <Badge variant={selectedUser.is_active ? 'success' : 'danger'} dot size="sm">
                    {selectedUser.is_active ? 'Active' : 'Suspended'}
                  </Badge>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Organization:</span>
                  <span className="font-bold text-slate-800">{selectedUser.organization || 'Global'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">User ID:</span>
                  <span className="font-mono text-slate-600">{selectedUser.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Joined:</span>
                  <span className="text-slate-600">{selectedUser.created_at || 'Recently'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button onClick={() => setSelectedUser(null)} className="btn-secondary py-2 px-4 text-xs font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
