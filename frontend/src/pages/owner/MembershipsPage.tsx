import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { DonutChart, BarChart } from '@/components/ui/Charts';
import { SkeletonCard, Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/services/api';
import { apiClient } from '@/services/apiClient';
import type { Member } from '@/types';
import { cn } from '@/utils/cn';

interface MembershipPlanItem {
  id?: string;
  name: string;
  price: number;
  duration_days?: number;
  period?: string;
  features: string[];
  color?: string;
  badge?: string;
}

export function MembershipsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Plan Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    price: '',
    duration_days: '',
    features: '',
    badge: '',
  });

  const fetchPlansAndMembers = () => {
    setLoading(true);
    Promise.all([
      api.customers.list().catch(() => []),
      apiClient.get<MembershipPlanItem[]>('/memberships/plans').catch(() => []),
    ])
      .then(([m, p]) => {
        setMembers(m || []);
        setPlans(p || []);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPlansAndMembers();
  }, []);

  const openCreateModal = () => {
    setEditingPlanId(null);
    setPlanForm({
      name: '',
      price: '',
      duration_days: '',
      features: '',
      badge: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (p: MembershipPlanItem) => {
    setEditingPlanId(p.id || null);
    setPlanForm({
      name: p.name,
      price: String(p.price),
      duration_days: p.duration_days ? String(p.duration_days) : '',
      features: (p.features || []).join(', '),
      badge: p.badge || '',
    });
    setModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.name || !planForm.price) return;

    const payload = {
      name: planForm.name,
      price: Number(planForm.price),
      duration_days: Number(planForm.duration_days) || 30,
      features: planForm.features.split(',').map((f) => f.trim()).filter(Boolean),
      badge: planForm.badge,
    };

    try {
      if (editingPlanId) {
        await apiClient.put(`/memberships/plans/${editingPlanId}`, payload);
      } else {
        await apiClient.post('/memberships/plans', payload);
      }
      setModalOpen(false);
      fetchPlansAndMembers();
    } catch (_err) {
      /* ignore */
    }
  };

  const handleDeletePlan = async (planId?: string) => {
    if (!planId) return;
    if (!confirm('Are you sure you want to delete this membership plan?')) return;
    try {
      await apiClient.delete(`/memberships/plans/${planId}`);
      if (editingPlanId === planId) {
        setModalOpen(false);
      }
      fetchPlansAndMembers();
    } catch (_err) {
      /* ignore */
    }
  };

  const activeCount = members.filter((m) => m.status === 'active' || m.status === 'vip').length;
  const expiringCount = members.filter((m) => m.status === 'expiring').length;
  const trialCount = members.filter((m) => m.status === 'trial').length;

  const totalRevenue = members.reduce((acc, m) => {
    const val = parseInt(String(m.revenue || '').replace(/[^0-9]/g, ''), 10);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const colors = ['#2563eb', '#059669', '#d97706', '#9333ea', '#94a3b8'];
  const planCounts = plans.map((p, i) => ({
    label: p.name,
    value: members.filter((m) => m.membership === p.name).length,
    color: colors[i % colors.length],
  }));

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <PageHeader
        title="Memberships"
        breadcrumb={['Owner', 'Memberships']}
        actions={
          <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
            <Icon name="plus" size={16} /> New Plan
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5"><div className="flex items-center justify-between mb-2"><span className="stat-label">Active Members</span><div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center"><Icon name="check-circle" size={16} className="text-success-600" /></div></div><div className="text-2xl font-bold text-navy-900">{activeCount}</div><div className="text-xs text-navy-400 mt-1">Live active count</div></div>
          <div className="card p-5"><div className="flex items-center justify-between mb-2"><span className="stat-label">Expiring</span><div className="w-8 h-8 rounded-lg bg-warning-50 flex items-center justify-center"><Icon name="clock" size={16} className="text-warning-600" /></div></div><div className="text-2xl font-bold text-navy-900">{expiringCount}</div><div className="text-xs text-warning-600 font-semibold mt-1">within 7 days</div></div>
          <div className="card p-5"><div className="flex items-center justify-between mb-2"><span className="stat-label">Trials</span><div className="w-8 h-8 rounded-lg bg-ai-50 flex items-center justify-center"><Icon name="sparkles" size={16} className="text-ai-600" /></div></div><div className="text-2xl font-bold text-navy-900">{trialCount}</div><div className="text-xs text-ai-600 font-semibold mt-1">awaiting conversion</div></div>
          <div className="card p-5"><div className="flex items-center justify-between mb-2"><span className="stat-label">Total Revenue</span><div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center"><Icon name="indian-rupee" size={16} className="text-brand-600" /></div></div><div className="text-2xl font-bold text-navy-900">₹{totalRevenue.toLocaleString()}</div><div className="text-xs text-navy-400 mt-1">Aggregated from memberships</div></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-navy-900 mb-4">Plan Distribution</h3>
          {loading ? <Skeleton className="h-48 w-full" /> : (
            <>
              <div className="flex justify-center mb-4"><DonutChart segments={planCounts.filter((p) => p.value > 0)} size={160} centerLabel={`${members.length}`} centerSublabel="Members" /></div>
              <div className="space-y-2">
                {planCounts.map((p) => (
                  <div key={p.label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: p.color }} /><span className="text-navy-600 font-medium">{p.label}</span></div>
                    <span className="font-semibold text-navy-900">{p.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-bold text-navy-900 mb-4">Monthly Membership Sales</h3>
          {loading ? <Skeleton className="h-48 w-full" /> : (
            <BarChart data={[32, 28, 35, 42, 38, 45, 48, Math.max(1, members.length)]} labels={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']} height={200} color="#2563eb" />
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-navy-900">Available Plans (Defined by Owner)</h3>
            <p className="text-xs text-navy-400 mt-0.5">Plans created here automatically configure duration and validity when enrolling new members.</p>
          </div>
          <button onClick={openCreateModal} className="btn-secondary text-xs flex items-center gap-1">
            <Icon name="plus" size={14} /> Add Plan
          </button>
        </div>

        {loading ? <Skeleton className="h-48 w-full" /> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((p, idx) => {
              const enrolledCount = members.filter((m) => m.membership === p.name).length;
              const defaultColor = ['from-navy-400 to-navy-600', 'from-brand-400 to-brand-600', 'from-success-400 to-success-600', 'from-ai-400 to-ai-600'][idx % 4];
              const days = p.duration_days || 30;
              const durationLabel = days === 30 ? '30 Days (1 Mo)' : days === 90 ? '90 Days (3 Mo)' : days === 365 ? '365 Days (1 Yr)' : `${days} Days`;

              return (
                <div key={p.id || p.name} className="card card-hover p-5 relative flex flex-col justify-between">
                  <div>
                    {p.badge && (
                      <span className="absolute top-3 right-3 text-[10px] font-bold text-white bg-brand-600 px-2 py-0.5 rounded-full shadow-glow">
                        {p.badge}
                      </span>
                    )}
                    <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br mb-3 flex items-center justify-center text-white', p.color || defaultColor)}>
                      <Icon name="credit-card" size={18} />
                    </div>
                    <div className="text-sm font-bold text-navy-900">{p.name}</div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold text-brand-600">₹{p.price.toLocaleString()}</span>
                      <span className="text-xs text-navy-400">/{p.period || `${days}d`}</span>
                    </div>
                    <div className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-1 rounded-lg mt-2 inline-block">
                      Duration: {durationLabel}
                    </div>
                    <div className="space-y-1 mt-3 mb-3">
                      {(p.features || []).map((f) => (
                        <div key={f} className="flex items-center gap-1.5 text-xs text-navy-500">
                          <Icon name="check" size={12} className="text-success-500 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-navy-100 mt-3">
                    <span className="text-xs text-navy-400 font-medium">{enrolledCount} members</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditModal(p)} className="btn-ghost text-xs flex items-center gap-1">
                        <Icon name="edit" size={12} /> Edit
                      </button>
                      {p.id && (
                        <button
                          onClick={() => handleDeletePlan(p.id)}
                          className="btn-ghost text-xs text-danger-600 hover:text-danger-700 hover:bg-danger-50 flex items-center gap-1"
                        >
                          <Icon name="trash-2" size={12} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Owner Plan Creator / Editor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-scale-in border border-navy-100">
            <div className="flex items-center justify-between border-b border-navy-100 pb-3">
              <h3 className="text-base font-bold text-navy-900">
                {editingPlanId ? 'Edit Membership Plan' : 'Create New Membership Plan'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-navy-400 hover:text-navy-600">
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-navy-700 mb-1 block">Plan Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Standard, Quarterly Pro, Half-Yearly"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-navy-700 mb-1 block">Price (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="2500"
                    value={planForm.price}
                    onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-navy-700 mb-1 block">Duration (Days)</label>
                  <input
                    type="number"
                    required
                    placeholder="30"
                    value={planForm.duration_days}
                    onChange={(e) => setPlanForm({ ...planForm, duration_days: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-navy-700 mb-1 block">Quick Duration Presets</label>
                <div className="flex gap-2">
                  {[
                    { label: '30 Days (1 Mo)', days: 30 },
                    { label: '90 Days (3 Mo)', days: 90 },
                    { label: '180 Days (6 Mo)', days: 180 },
                    { label: '365 Days (1 Yr)', days: 365 },
                  ].map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setPlanForm({ ...planForm, duration_days: String(preset.days) })}
                      className={cn(
                        'px-2 py-1 text-[11px] font-semibold rounded-lg border transition-all',
                        planForm.duration_days === String(preset.days)
                          ? 'bg-brand-50 border-brand-500 text-brand-600'
                          : 'bg-navy-50 border-navy-200 text-navy-600 hover:bg-navy-100'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-navy-700 mb-1 block">Features (Comma Separated)</label>
                <input
                  type="text"
                  placeholder="Gym Access, Locker, Basic App, AI Coach"
                  value={planForm.features}
                  onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-navy-700 mb-1 block">Badge Label (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Popular, Best Value, VIP"
                  value={planForm.badge}
                  onChange={(e) => setPlanForm({ ...planForm, badge: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                {editingPlanId && (
                  <button
                    type="button"
                    onClick={() => handleDeletePlan(editingPlanId)}
                    className="btn-secondary text-xs text-danger-600 border-danger-200 hover:bg-danger-50 flex items-center gap-1"
                  >
                    <Icon name="trash-2" size={14} /> Delete
                  </button>
                )}
                <div className="flex gap-2 flex-1 justify-end">
                  <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary flex-1">
                    {editingPlanId ? 'Update Plan' : 'Save & Create Plan'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
