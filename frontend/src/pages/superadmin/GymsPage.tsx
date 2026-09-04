import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { api } from '@/services/api';
import type { Gym } from '@/types';
import { cn } from '@/utils/cn';

const statusConfig: Record<Gym['status'], { variant: 'success' | 'warning' | 'danger'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  suspended: { variant: 'danger', label: 'Suspended' },
  pending: { variant: 'warning', label: 'Pending' },
};

export function GymsPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Gym | null>(null);

  // Onboard Gym Modal State
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    gym_name: '',
    branch_name: '',
    city: '',
    address: '',
    owner_name: '',
    owner_email: '',
    password: '',
  });
  const [onboarding, setOnboarding] = useState(false);

  const fetchGyms = () => {
    setLoading(true);
    api.superAdmin.gyms()
      .then((data) => { setGyms(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchGyms();
  }, []);

  const handleStatusChange = async (gymId: string, newStatus: string) => {
    try {
      await api.superAdmin.updateGymStatus(gymId, newStatus);
      if (selected && selected.id === gymId) {
        setSelected((prev) => prev ? { ...prev, status: newStatus as any } : null);
      }
      fetchGyms();
    } catch (_err) {
      /* ignore */
    }
  };

  const handleOnboardGymSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.gym_name.trim()) return;
    setOnboarding(true);
    try {
      await api.superAdmin.onboardGym(onboardForm);
      setOnboardOpen(false);
      setOnboardForm({ gym_name: '', branch_name: '', city: '', address: '', owner_name: '', owner_email: '', password: '' });
      fetchGyms();
    } catch (_err) {
      /* ignore */
    } finally {
      setOnboarding(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gyms"
        breadcrumb={['Super Admin', 'Gyms']}
        actions={
          <button onClick={() => setOnboardOpen(true)} className="btn-primary flex items-center gap-2">
            <Icon name="plus" size={16} /> Onboard Gym
          </button>
        }
      />

      <div className="card p-4">
        {loading ? <SkeletonTable rows={5} cols={8} /> : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-navy-100">
                  {['Gym', 'Owner', 'Locations', 'Members', 'Revenue', 'Subscription', 'Health', 'Status', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-navy-400 uppercase tracking-wider px-3 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gyms.map((g) => (
                  <tr key={g.id} onClick={() => setSelected(g)} className="border-b border-navy-50 hover:bg-navy-50 cursor-pointer transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white"><Icon name="building-2" size={16} /></div>
                        <div className="text-sm font-semibold text-navy-900">{g.name}</div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-navy-600">{g.owner}</td>
                    <td className="px-3 py-3 text-sm text-navy-500">{g.locations}</td>
                    <td className="px-3 py-3 text-sm text-navy-500">{g.members.toLocaleString()}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-navy-900">{g.revenue}</td>
                    <td className="px-3 py-3"><Badge variant="brand">{g.subscription}</Badge></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-navy-100 overflow-hidden"><div className={cn('h-full rounded-full', g.health >= 90 ? 'bg-success-500' : g.health >= 75 ? 'bg-warning-500' : 'bg-danger-500')} style={{ width: `${g.health}%` }} /></div>
                        <span className="text-xs text-navy-500 font-medium">{g.health}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3"><Badge variant={statusConfig[g.status]?.variant || 'success'} dot>{statusConfig[g.status]?.label || g.status}</Badge></td>
                    <td className="px-3 py-3"><Icon name="chevron-right" size={16} className="text-navy-300" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Gym Detail Drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-navy-900/30 backdrop-blur-sm z-40" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 bg-white border-b border-navy-100 p-5 flex items-center justify-between">
              <h3 className="text-base font-bold text-navy-900">Gym 360</h3>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-navy-100"><Icon name="x" size={18} className="text-navy-500" /></button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="text-lg font-bold text-navy-900">{selected.name}</div>
                <div className="text-sm text-navy-400">Owner: {selected.owner}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Locations', value: selected.locations, icon: 'map-pin' },
                  { label: 'Members', value: selected.members.toLocaleString(), icon: 'users' },
                  { label: 'Trainers', value: selected.trainers, icon: 'user-cog' },
                  { label: 'Revenue', value: selected.revenue, icon: 'indian-rupee' },
                  { label: 'AI Usage', value: `${selected.aiUsage}%`, icon: 'sparkles' },
                  { label: 'Health', value: `${selected.health}%`, icon: 'activity' },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-xl bg-navy-50">
                    <div className="flex items-center gap-2 mb-1"><Icon name={s.icon} size={14} className="text-navy-500" /><span className="text-xs text-navy-400 font-medium">{s.label}</span></div>
                    <div className="text-base font-bold text-navy-900">{s.value}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs font-semibold text-navy-500 uppercase tracking-wider mb-2">Enabled Features</div>
                <div className="flex flex-wrap gap-2">{selected.enabledFeatures?.map((f) => <Badge key={f} variant="brand">{f}</Badge>)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-navy-500 uppercase tracking-wider mb-2">Actions</div>
                <div className="grid grid-cols-2 gap-2">
                  {selected.status !== 'active' && (
                    <button onClick={() => handleStatusChange(selected.id, 'active')} className="btn-primary flex items-center justify-center gap-1">
                      <Icon name="check" size={14} /> Activate
                    </button>
                  )}
                  {selected.status === 'active' && (
                    <button onClick={() => handleStatusChange(selected.id, 'suspended')} className="btn-secondary text-danger-600 flex items-center justify-center gap-1">
                      <Icon name="x" size={14} /> Suspend
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Onboard Gym Modal */}
      {onboardOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Icon name="building-2" size={18} className="text-brand-600" /> Onboard New Gym Branch
              </h3>
              <button onClick={() => setOnboardOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleOnboardGymSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Gym Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gold Gym Elite"
                  value={onboardForm.gym_name}
                  onChange={(e) => setOnboardForm((p) => ({ ...p, gym_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Branch Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Main Branch"
                    value={onboardForm.branch_name}
                    onChange={(e) => setOnboardForm((p) => ({ ...p, branch_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. City Name"
                    value={onboardForm.city}
                    onChange={(e) => setOnboardForm((p) => ({ ...p, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Street / Area Address"
                  value={onboardForm.address}
                  onChange={(e) => setOnboardForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Owner Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Owner Name"
                    value={onboardForm.owner_name}
                    onChange={(e) => setOnboardForm((p) => ({ ...p, owner_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Owner Email</label>
                  <input
                    type="email"
                    placeholder="owner@example.com"
                    value={onboardForm.owner_email}
                    onChange={(e) => setOnboardForm((p) => ({ ...p, owner_email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setOnboardOpen(false)} className="btn-secondary py-2 px-4 text-xs font-bold">
                  Cancel
                </button>
                <button type="submit" disabled={onboarding} className="btn-primary py-2 px-4 text-xs font-bold">
                  {onboarding ? 'Onboarding...' : 'Save & Onboard Gym'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
