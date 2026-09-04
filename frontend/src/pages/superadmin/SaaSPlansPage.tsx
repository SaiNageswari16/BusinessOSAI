import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { api } from '@/services/api';
import { cn } from '@/utils/cn';

interface SaaSPlanItem {
  id: string;
  name: string;
  code: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  max_branches: number;
  max_members: number;
  max_trainers: number;
  ai_credits_monthly: number;
  storage_gb: number;
  features: string[];
  is_active: boolean;
  is_popular: boolean;
}

export function SaaSPlansPage() {
  const [plans, setPlans] = useState<SaaSPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // New Plan Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    price_monthly: '',
    price_annual: '',
    max_branches: '',
    max_members: '',
    max_trainers: '',
    ai_credits_monthly: '',
    storage_gb: '',
    features: '',
    is_popular: false,
  });

  const fetchPlans = () => {
    setLoading(true);
    api.superAdmin.plans()
      .then((data) => {
        setPlans(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;
    setCreating(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toLowerCase(),
        description: form.description.trim() || null,
        price_monthly: form.price_monthly !== '' ? Number(form.price_monthly) : null,
        price_annual: form.price_annual !== '' ? Number(form.price_annual) : null,
        max_branches: form.max_branches !== '' ? Number(form.max_branches) : null,
        max_members: form.max_members !== '' ? Number(form.max_members) : null,
        max_trainers: form.max_trainers !== '' ? Number(form.max_trainers) : null,
        ai_credits_monthly: form.ai_credits_monthly !== '' ? Number(form.ai_credits_monthly) : null,
        storage_gb: form.storage_gb !== '' ? Number(form.storage_gb) : null,
        features: form.features ? form.features.split(',').map((s) => s.trim()).filter(Boolean) : [],
        is_active: true,
        is_popular: form.is_popular,
      };
      await api.superAdmin.createPlan(payload);
      setCreateOpen(false);
      setForm({
        name: '',
        code: '',
        description: '',
        price_monthly: '',
        price_annual: '',
        max_branches: '',
        max_members: '',
        max_trainers: '',
        ai_credits_monthly: '',
        storage_gb: '',
        features: '',
        is_popular: false,
      });
      fetchPlans();
    } catch (_err) {
      /* ignore */
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="SaaS Subscription Packages"
        breadcrumb={['Super Admin', 'SaaS Plans']}
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-primary flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <Icon name="plus" size={16} /> Create SaaS Plan
          </button>
        }
      />

      {/* Cycle Toggle */}
      <div className="flex justify-center">
        <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 shadow-inner border border-slate-200">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'px-4 py-1.5 rounded-xl text-xs font-bold transition-all',
              billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            )}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={cn(
              'px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
              billingCycle === 'annual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            )}
          >
            Annual Billing
            <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-md font-extrabold">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : plans.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p) => {
            const price = billingCycle === 'monthly' ? p.price_monthly : p.price_annual;
            return (
              <div
                key={p.id}
                className={cn(
                  'card p-6 relative flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-xl',
                  p.is_popular ? 'border-2 border-brand-500 bg-gradient-to-b from-brand-50/20 to-white' : ''
                )}
              >
                {p.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-[10px] font-extrabold tracking-wider uppercase px-3 py-1 rounded-full shadow-md">
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-black text-slate-900">{p.name}</h3>
                    <Badge variant={p.is_active ? 'success' : 'danger'} size="sm">
                      {p.code.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mb-5 min-h-[36px]">{p.description || 'Enterprise platform access tier.'}</p>

                  <div className="mb-6 pb-6 border-b border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900">₹{(price || 0).toLocaleString()}</span>
                      <span className="text-xs text-slate-400 font-semibold">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                    </div>
                  </div>

                  {/* Limits Spec */}
                  <div className="space-y-2.5 mb-6 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5"><Icon name="building-2" size={14} className="text-brand-500" /> Max Branches:</span>
                      <span className="font-bold text-slate-900">{p.max_branches ?? 'Unlimited'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5"><Icon name="users" size={14} className="text-brand-500" /> Member Capacity:</span>
                      <span className="font-bold text-slate-900">{p.max_members ? p.max_members.toLocaleString() : 'Unlimited'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5"><Icon name="sparkles" size={14} className="text-indigo-500" /> Monthly AI Credits:</span>
                      <span className="font-bold text-slate-900">{p.ai_credits_monthly ? p.ai_credits_monthly.toLocaleString() : '1,000'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5"><Icon name="hard-drive" size={14} className="text-brand-500" /> Storage Limit:</span>
                      <span className="font-bold text-slate-900">{p.storage_gb || 10} GB</span>
                    </div>
                  </div>

                  {/* Feature Checkmarks */}
                  <div className="space-y-2 mb-6">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Included Modules</div>
                    {(p.features && Array.isArray(p.features) ? p.features : []).map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                        <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon name="check" size={11} />
                        </div>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button className="btn-secondary w-full py-2.5 text-xs font-bold hover:border-slate-400 transition-all">
                  Configure Tier
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Icon name="credit-card" size={24} />
          </div>
          <h4 className="text-base font-bold text-slate-900 mb-1">No SaaS Plans Registered</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Create subscription tiers to enable gym businesses to subscribe and scale.
          </p>
          <button onClick={() => setCreateOpen(true)} className="btn-primary inline-flex items-center gap-2">
            <Icon name="plus" size={16} /> Create First Plan
          </button>
        </div>
      )}

      {/* Create Plan Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl border border-slate-100 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Icon name="credit-card" size={18} className="text-brand-600" /> Create New SaaS Tier
              </h3>
              <button onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Plan Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pro Growth"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Plan Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. pro"
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Short tagline for tier"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Monthly Price (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.price_monthly}
                    onChange={(e) => setForm((p) => ({ ...p, price_monthly: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Annual Price (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.price_annual}
                    onChange={(e) => setForm((p) => ({ ...p, price_annual: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Max Branches</label>
                  <input
                    type="number"
                    placeholder="1"
                    value={form.max_branches}
                    onChange={(e) => setForm((p) => ({ ...p, max_branches: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Max Members</label>
                  <input
                    type="number"
                    placeholder="500"
                    value={form.max_members}
                    onChange={(e) => setForm((p) => ({ ...p, max_members: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">AI Credits / Mo</label>
                  <input
                    type="number"
                    placeholder="1000"
                    value={form.ai_credits_monthly}
                    onChange={(e) => setForm((p) => ({ ...p, ai_credits_monthly: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Enabled Features (comma separated)</label>
                <textarea
                  rows={3}
                  value={form.features}
                  onChange={(e) => setForm((p) => ({ ...p, features: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="pop"
                  checked={form.is_popular}
                  onChange={(e) => setForm((p) => ({ ...p, is_popular: e.target.checked }))}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="pop" className="text-slate-700 font-bold cursor-pointer">
                  Mark as "Most Popular"
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary py-2 px-4 font-bold">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary py-2 px-4 font-bold">
                  {creating ? 'Saving...' : 'Create SaaS Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
