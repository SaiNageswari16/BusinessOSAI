/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { api } from '@/services/api';
import { apiClient } from '@/services/apiClient';
import { customerApi, GymSlotBookingItem } from '@/services/customerApi';
import type { Member } from '@/types';
import { cn } from '@/utils/cn';
import { EnrollmentModal } from '@/components/EnrollmentModal';
import { formatDateDDMMYY, getTodayISO, addDaysISO } from '@/utils/date';

interface PlanItem {
  id?: string;
  name: string;
  price: number;
  duration_days?: number;
  period?: string;
  features?: string[];
}

const statusConfig: Record<Member['status'], { variant: 'success' | 'warning' | 'danger' | 'brand' | 'ai' | 'neutral'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  inactive: { variant: 'neutral', label: 'Inactive' },
  expiring: { variant: 'warning', label: 'Expiring' },
  trial: { variant: 'ai', label: 'Trial' },
  vip: { variant: 'brand', label: 'VIP' },
};

const riskConfig: Record<Member['risk'], { variant: 'success' | 'warning' | 'danger'; label: string }> = {
  low: { variant: 'success', label: 'Low' },
  medium: { variant: 'warning', label: 'Medium' },
  high: { variant: 'danger', label: 'High' },
};

const filters = ['All', 'Active', 'Inactive', 'Expiring', 'High Risk', 'VIP', 'New', 'Trial'] as const;

export function MembersPage() {
  const [activeTab, setActiveTab] = useState<'members' | 'slots'>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [slotBookings, setSlotBookings] = useState<GymSlotBookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<typeof filters[number]>('All');
  const [slotDateFilter, setSlotDateFilter] = useState<'all' | 'today' | 'upcoming'>('all');
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Renewal Modal state
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [selectedPlanIdx, setSelectedPlanIdx] = useState(0);
  const [renewalStartDate, setRenewalStartDate] = useState(() => getTodayISO());
  const [renewalExpiryDate, setRenewalExpiryDate] = useState(() => addDaysISO(getTodayISO(), 30));
  const [renewalPaymentMethod, setRenewalPaymentMethod] = useState('UPI');
  const [renewing, setRenewing] = useState(false);

  const navigate = useNavigate();

  const fetchSlotBookings = () => {
    setSlotsLoading(true);
    customerApi.getAllSlotBookings()
      .then((data) => setSlotBookings(data || []))
      .catch(() => setSlotBookings([]))
      .finally(() => setSlotsLoading(false));
  };

  const fetchMembers = () => {
    setLoading(true);
    api.customers
      .list()
      .then((data) => {
        setMembers(data || []);
      })
      .catch(() => {
        setMembers([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMembers();
    fetchSlotBookings();
  }, []);

  const fetchDynamicPlans = () => {
    apiClient.get<PlanItem[]>('/memberships/plans')
      .then((res) => {
        if (Array.isArray(res)) {
          setPlans(res);
        }
      })
      .catch(() => {
        setPlans([]);
      });
  };

  useEffect(() => {
    fetchDynamicPlans();
  }, []);

  // Auto calculate renewal expiry date when plan or start date changes
  useEffect(() => {
    const currentPlan = plans[selectedPlanIdx];
    const duration = currentPlan?.duration_days ?? 30;
    setRenewalExpiryDate(addDaysISO(renewalStartDate, duration));
  }, [selectedPlanIdx, plans, renewalStartDate]);

  const filtered = members.filter((m) => {
    const name = m.name || (m as any).full_name || '';
    const email = m.email || '';
    const phone = m.phone || '';
    const matchesSearch = !search ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      phone.includes(search) ||
      email.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' ||
      (filter === 'Active' && m.status === 'active') ||
      (filter === 'Inactive' && m.status === 'inactive') ||
      (filter === 'Expiring' && m.status === 'expiring') ||
      (filter === 'High Risk' && m.risk === 'high') ||
      (filter === 'VIP' && m.status === 'vip') ||
      (filter === 'Trial' && m.status === 'trial') ||
      (filter === 'New' && (m.joinDate || '').startsWith('2024'));
    return matchesSearch && matchesFilter;
  });

  const todayIso = getTodayISO();
  const filteredSlots = slotBookings.filter((s) => {
    const custName = (s.customer_name || '').toLowerCase();
    const custPhone = (s.customer_phone || '').toLowerCase();
    const custEmail = (s.customer_email || '').toLowerCase();
    const branchName = (s.branch_name || '').toLowerCase();
    const workouts = (s.workout_types || []).join(' ').toLowerCase();
    const q = search.toLowerCase();

    const matchesSearch = !search ||
      custName.includes(q) ||
      custPhone.includes(q) ||
      custEmail.includes(q) ||
      branchName.includes(q) ||
      workouts.includes(q);

    let matchesDate = true;
    if (slotDateFilter === 'today') {
      matchesDate = s.booking_date === todayIso;
    } else if (slotDateFilter === 'upcoming') {
      matchesDate = s.booking_date >= todayIso;
    }

    return matchesSearch && matchesDate;
  });

  const selectedMembers = members.filter((m) => selectedMemberIds.includes(m.id));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedMemberIds(filtered.map((m) => m.id));
    } else {
      setSelectedMemberIds([]);
    }
  };

  const handleToggleSelect = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.target.checked) {
      setSelectedMemberIds((prev) => [...prev, id]);
    } else {
      setSelectedMemberIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleOpenRenewalModal = () => {
    if (selectedMemberIds.length === 0) return;
    fetchDynamicPlans();
    setRenewalStartDate(getTodayISO());
    setRenewalOpen(true);
  };

  const handleExecuteRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMemberIds.length === 0) return;

    const currentPlan = plans[selectedPlanIdx] || { name: 'Standard Plan', price: 2500, duration_days: 30 };
    setRenewing(true);

    try {
      for (const mId of selectedMemberIds) {
        await apiClient.post(`/memberships/renew/${mId}`, {
          plan_name: currentPlan.name,
          duration_days: currentPlan.duration_days || 30,
          price: currentPlan.price,
          paid_amount: currentPlan.price,
          start_date: renewalStartDate,
          expiry_date: renewalExpiryDate,
          payment_method: renewalPaymentMethod,
        });
      }
      setRenewalOpen(false);
      setSelectedMemberIds([]);
      fetchMembers();
    } catch (_err) {
      /* handle gracefully */
    } finally {
      setRenewing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <PageHeader
        title="Members & Customers"
        breadcrumb={['Owner', activeTab === 'members' ? 'Members' : 'Gym Slot Bookings']}
        actions={
          <div className="flex items-center gap-2">
            {activeTab === 'members' && (
              <>
                <button
                  onClick={handleOpenRenewalModal}
                  disabled={selectedMemberIds.length === 0}
                  className={cn(
                    'btn-secondary flex items-center gap-2 text-sm font-semibold transition-all',
                    selectedMemberIds.length > 0
                      ? 'border-brand-500 text-brand-600 bg-brand-50 ring-2 ring-brand-500/20 shadow-glow'
                      : 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Icon name="refresh-cw" size={16} /> Renewal {selectedMemberIds.length > 0 && `(${selectedMemberIds.length})`}
                </button>
                <button onClick={() => setEnrollOpen(true)} className="btn-primary flex items-center gap-2">
                  <Icon name="plus" size={16} /> Add Member
                </button>
              </>
            )}
            {activeTab === 'slots' && (
              <button onClick={fetchSlotBookings} className="btn-secondary flex items-center gap-2 text-sm">
                <Icon name="refresh-cw" size={16} className={cn(slotsLoading && 'animate-spin')} /> Refresh Bookings
              </button>
            )}
          </div>
        }
      />

      {/* Top View Toggle Tabs */}
      <div className="flex items-center gap-3 p-1.5 bg-navy-100/60 rounded-2xl w-fit border border-navy-200/50">
        <button
          onClick={() => setActiveTab('members')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all',
            activeTab === 'members'
              ? 'bg-white text-brand-600 shadow-sm'
              : 'text-navy-600 hover:text-navy-900'
          )}
        >
          <Icon name="users" size={16} />
          <span>Members Directory</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-navy-100 text-navy-600 font-bold">
            {members.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('slots');
            fetchSlotBookings();
          }}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all',
            activeTab === 'slots'
              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-glow'
              : 'text-navy-600 hover:text-navy-900'
          )}
        >
          <Icon name="calendar" size={16} />
          <span>Gym Slot Bookings</span>
          <span className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-bold',
            activeTab === 'slots' ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-600'
          )}>
            {slotBookings.length}
          </span>
        </button>
      </div>

      {activeTab === 'members' ? (
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
              <input
                type="text"
                placeholder="Search by name, phone or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-semibold transition-all',
                    filter === f ? 'bg-brand-600 text-white' : 'bg-navy-50 text-navy-500 hover:bg-navy-100'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <SkeletonTable rows={8} cols={9} />
          ) : filtered.length === 0 ? (
            <EmptyState icon="!" title="No members found" description="Try adjusting your search or filters." />
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full min-w-[950px]">
                <thead>
                  <tr className="border-b border-navy-100">
                    <th className="px-3 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selectedMemberIds.length === filtered.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                    </th>
                    {['Member', 'Membership', 'Status', 'Attendance', 'Last Visit', 'Expiry', 'Revenue', 'Risk', ''].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-navy-400 uppercase tracking-wider px-3 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const name = m.name || (m as any).full_name || 'Member';
                    const initials = name ? name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'M';
                    const statusConf = statusConfig[m.status] || { variant: 'success', label: m.status || 'Active' };
                    const riskConf = riskConfig[m.risk] || { variant: 'success', label: m.risk || 'Low' };
                    const isSelected = selectedMemberIds.includes(m.id);

                    return (
                      <tr
                        key={m.id}
                        onClick={() => navigate(`/owner/customers/${m.id}`)}
                        className={cn(
                          'border-b border-navy-50 hover:bg-navy-50 cursor-pointer transition-colors',
                          isSelected && 'bg-brand-50/50'
                        )}
                      >
                        <td className="px-3 py-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleToggleSelect(m.id, e)}
                            className="w-4 h-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-navy-900 truncate">{name}</div>
                              <div className="text-xs text-navy-500 font-medium truncate">{m.phone || m.email || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-navy-600 font-medium">{m.membership}</td>
                        <td className="px-3 py-3"><Badge variant={statusConf.variant}>{statusConf.label}</Badge></td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-navy-100 overflow-hidden">
                              <div className="h-full rounded-full bg-brand-500" style={{ width: `${m.attendance || 0}%` }} />
                            </div>
                            <span className="text-xs text-navy-500 font-medium">{m.attendance || 0}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-navy-500">{m.lastVisit}</td>
                        <td className="px-3 py-3 text-sm font-medium text-navy-700">{formatDateDDMMYY(m.expiry)}</td>
                        <td className="px-3 py-3 text-sm font-semibold text-navy-900">{m.revenue}</td>
                        <td className="px-3 py-3"><Badge variant={riskConf.variant}>{riskConf.label}</Badge></td>
                        <td className="px-3 py-3"><Icon name="chevron-right" size={16} className="text-navy-300" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Gym Slot Bookings Tab for Owner */
        <div className="card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pb-2 border-b border-navy-100">
            <div className="relative flex-1 w-full sm:w-auto">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
              <input
                type="text"
                placeholder="Search member, phone, branch, or workout muscle (chest, back...)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              {(['all', 'today', 'upcoming'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSlotDateFilter(mode)}
                  className={cn(
                    'px-3.5 py-2 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all',
                    slotDateFilter === mode
                      ? 'bg-brand-600 text-white shadow-glow'
                      : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
                  )}
                >
                  {mode === 'all' ? 'All Bookings' : mode === 'today' ? "Today's Slots" : 'Upcoming Slots'}
                </button>
              ))}
            </div>
          </div>

          {slotsLoading ? (
            <SkeletonTable rows={6} cols={6} />
          ) : filteredSlots.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No Slot Bookings Found"
              description="Customer gym slot reservations will appear dynamically here as members book."
            />
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr className="border-b border-navy-100">
                    {['Customer', 'Date & Time Slot', 'Workout Focus', 'Branch / Facility', 'Status', 'Notes'].map((h) => (
                      <th key={h} className="text-left text-xs font-bold text-navy-500 uppercase tracking-wider px-3 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {filteredSlots.map((slot) => {
                    const name = slot.customer_name || 'Member';
                    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);
                    return (
                      <tr key={slot.id} className="hover:bg-navy-50/70 transition-colors">
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                              {initials}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-navy-900">{name}</div>
                              <div className="text-xs text-navy-500 font-medium">{slot.customer_phone || slot.customer_email || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                            <Icon name="calendar" size={14} className="text-brand-600" />
                            {formatDateDDMMYY(slot.booking_date)}
                          </div>
                          <div className="text-xs font-semibold text-brand-600 flex items-center gap-1.5 mt-0.5">
                            <Icon name="clock" size={14} />
                            {slot.start_time} - {slot.end_time}
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {(slot.workout_types || []).map((wt, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200/60"
                              >
                                {wt}
                              </span>
                            ))}
                            {(!slot.workout_types || slot.workout_types.length === 0) && (
                              <span className="text-xs text-navy-400">General Workout</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="text-xs font-bold text-navy-800 flex items-center gap-1">
                            <Icon name="map-pin" size={13} className="text-navy-400" />
                            {slot.branch_name || 'Main Branch'}
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <Badge variant={slot.status === 'CONFIRMED' ? 'success' : slot.status === 'CANCELLED' ? 'danger' : 'brand'}>
                            {slot.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-3.5 text-xs text-navy-500 font-medium">
                          {slot.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <EnrollmentModal open={enrollOpen} onClose={() => setEnrollOpen(false)} />

      {/* Renewal Modal */}
      {renewalOpen && (
        <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-scale-in border border-navy-100">
            <div className="flex items-center justify-between border-b border-navy-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                  <Icon name="refresh-cw" size={18} className="text-brand-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy-900">Renew Membership</h3>
                  <p className="text-xs text-navy-400">Selected {selectedMembers.length} member(s) for renewal</p>
                </div>
              </div>
              <button onClick={() => setRenewalOpen(false)} className="text-navy-400 hover:text-navy-600">
                <Icon name="x" size={18} />
              </button>
            </div>

            {/* Selected Members Summary */}
            <div className="card p-3 bg-navy-50 max-h-32 overflow-y-auto space-y-1.5 border border-navy-200">
              <div className="text-[11px] font-bold text-navy-500 uppercase tracking-wider mb-1">Target Members</div>
              {selectedMembers.map((sm) => (
                <div key={sm.id} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-navy-100">
                  <div className="font-semibold text-navy-900">{sm.name} ({sm.phone || sm.email})</div>
                  <Badge variant="brand">{sm.membership || 'Standard'}</Badge>
                </div>
              ))}
            </div>

            <form onSubmit={handleExecuteRenewal} className="space-y-4">
              {/* Select Plan */}
              <div>
                <label className="text-xs font-semibold text-navy-700 mb-2 block">Select Renewal Plan</label>
                {plans.length === 0 ? (
                  <div className="p-3 text-center text-xs text-navy-400 font-medium bg-navy-50 rounded-xl border border-navy-200">
                    No active membership plans created by owner yet. Please create plans on the Memberships page.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {plans.map((p, idx) => (
                      <button
                        key={p.name + idx}
                        type="button"
                        onClick={() => setSelectedPlanIdx(idx)}
                        className={cn(
                          'p-3 rounded-xl border text-left transition-all',
                          selectedPlanIdx === idx
                            ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                            : 'border-navy-200 hover:border-navy-300 bg-white'
                        )}
                      >
                        <div className="text-xs font-bold text-navy-900">{p.name}</div>
                        <div className="text-sm font-bold text-brand-600 mt-0.5">₹{p.price.toLocaleString()}</div>
                        <div className="text-[10px] text-navy-400">{p.duration_days || 30} Days Validity</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Renewal Date Range */}
              <div className="card p-3 bg-brand-50/40 border border-brand-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-navy-800">Renewal Validity</span>
                  <Badge variant="success">
                    Expiry: {formatDateDDMMYY(renewalExpiryDate)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-navy-600 block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={renewalStartDate}
                      onChange={(e) => setRenewalStartDate(e.target.value)}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-navy-600 block mb-1">Expiry Date (DD-MM-YY)</label>
                    <input
                      type="date"
                      value={renewalExpiryDate}
                      onChange={(e) => setRenewalExpiryDate(e.target.value)}
                      className="input-field text-xs py-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-xs font-semibold text-navy-700 mb-1.5 block">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {['UPI', 'Cash', 'Card', 'Online'].map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setRenewalPaymentMethod(pm)}
                      className={cn(
                        'py-2 rounded-xl text-xs font-semibold transition-all',
                        renewalPaymentMethod === pm
                          ? 'bg-brand-600 text-white shadow-glow'
                          : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
                      )}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setRenewalOpen(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renewing}
                  className="btn-primary flex-1 bg-success-600 hover:bg-success-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Icon name="check-circle" size={16} />
                  {renewing ? 'Processing...' : 'Confirm Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
