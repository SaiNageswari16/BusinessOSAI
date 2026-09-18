import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard, Skeleton } from '@/components/ui/Skeleton';
import { hrmsApi, type LeaveItem, type EmployeeItem } from '@/services/hrmsApi';
import { cn } from '@/utils/cn';

interface HrmsLeaveTabProps {
  onSuccessToast?: (msg: string) => void;
}

export function HrmsLeaveTab({ onSuccessToast }: HrmsLeaveTabProps) {
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Approved' | 'Rejected'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Apply Leave Modal State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formLeaveType, setFormLeaveType] = useState('Casual Leave');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [formReason, setFormReason] = useState('');
  const [formError, setFormError] = useState('');

  const fetchLeaveData = async () => {
    setLoading(true);
    try {
      const [leavesRes, empRes] = await Promise.all([
        hrmsApi.getLeaves(),
        hrmsApi.getEmployees(),
      ]);
      setLeaves(leavesRes || []);
      setEmployees(empRes || []);
      if (empRes && empRes.length > 0 && !formEmployeeId) {
        setFormEmployeeId(empRes[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch leave data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveData();
  }, []);

  const handleUpdateStatus = async (leaveId: string, status: 'Approved' | 'Rejected', employeeName: string) => {
    setActionLoadingId(leaveId);
    try {
      await hrmsApi.updateLeaveStatus(leaveId, { status, reviewer: 'Gym Owner / Admin' });
      onSuccessToast?.(`${status === 'Approved' ? 'Approved' : 'Rejected'} leave application for ${employeeName}`);
      // Refresh
      const updated = await hrmsApi.getLeaves();
      setLeaves(updated || []);
    } catch (err) {
      console.error('Failed to update leave status:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formEmployeeId) {
      setFormError('Please select an employee / trainer.');
      return;
    }
    if (!formStartDate || !formEndDate) {
      setFormError('Please select valid start and end dates.');
      return;
    }
    if (new Date(formEndDate) < new Date(formStartDate)) {
      setFormError('End date cannot be earlier than start date.');
      return;
    }

    setSubmitting(true);
    try {
      await hrmsApi.applyLeave({
        employee_id: formEmployeeId,
        leave_type: formLeaveType,
        start_date: formStartDate,
        end_date: formEndDate,
        reason: formReason.trim(),
      });
      onSuccessToast?.('Leave application recorded successfully!');
      setShowApplyModal(false);
      setFormReason('');
      // Refresh
      const updated = await hrmsApi.getLeaves();
      setLeaves(updated || []);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to submit leave application.');
    } finally {
      setSubmitting(false);
    }
  };

  // KPI Calculations
  const totalCount = leaves.length;
  const pendingCount = leaves.filter((l) => l.status === 'Pending').length;
  const approvedCount = leaves.filter((l) => l.status === 'Approved').length;
  const todayStr = new Date().toISOString().split('T')[0];
  const onLeaveTodayCount = leaves.filter((l) => {
    if (l.status !== 'Approved') return false;
    const s = l.start_date ? l.start_date.split('/').reverse().join('-') : '';
    const e = l.end_date ? l.end_date.split('/').reverse().join('-') : '';
    return s && e && todayStr >= s && todayStr <= e;
  }).length;

  // Filtered leaves
  const filteredLeaves = leaves.filter((l) => {
    const matchesStatus = statusFilter === 'ALL' || l.status.toLowerCase() === statusFilter.toLowerCase();
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      l.employee_name.toLowerCase().includes(q) ||
      l.employee_code.toLowerCase().includes(q) ||
      l.leave_type.toLowerCase().includes(q) ||
      l.department.toLowerCase().includes(q) ||
      l.reason.toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER & APPLY ACTION                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-navy-100 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-navy-900 tracking-tight flex items-center gap-2">
            <Icon name="calendar" size={24} className="text-purple-600" />
            <span>Leave &amp; Absence Hub</span>
          </h2>
          <p className="text-xs text-navy-500 font-medium mt-1">
            Dynamic leave applications, approval tracking, and attendance integration for coaches &amp; staff.
          </p>
        </div>

        <button
          onClick={() => setShowApplyModal(true)}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer"
        >
          <Icon name="plus" size={15} />
          <span>Apply Leave / Request</span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. KPI CARDS                                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-navy-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Total Requests</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Icon name="file-text" size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-navy-900">{totalCount}</div>
            <div className="text-[11px] text-purple-700 font-bold mt-1">All recorded applications</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-navy-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Pending Approvals</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Icon name="clock" size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600">{pendingCount}</div>
            <div className="text-[11px] text-amber-700 font-bold mt-1">Awaiting owner review</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-navy-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Approved Leaves</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Icon name="check-circle" size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">{approvedCount}</div>
            <div className="text-[11px] text-emerald-700 font-bold mt-1">Valid &amp; excused absences</div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-navy-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">On Leave Today</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Icon name="user-x" size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-navy-900">{onLeaveTodayCount}</div>
            <div className="text-[11px] text-blue-600 font-bold mt-1">Active staff away today</div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. FILTERS & SEARCH BAR                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-navy-100 shadow-sm">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Requests', count: totalCount },
            { id: 'Pending', label: 'Pending', count: pendingCount },
            { id: 'Approved', label: 'Approved', count: approvedCount },
            { id: 'Rejected', label: 'Rejected', count: leaves.filter((l) => l.status === 'Rejected').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer',
                statusFilter === tab.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-navy-50 text-navy-600 hover:text-navy-900 hover:bg-navy-100/80'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-black',
                  statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-navy-200/60 text-navy-700'
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[220px]">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            type="text"
            placeholder="Search trainer, type, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-semibold text-navy-900 placeholder-navy-400 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
          />
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. LEAVES TABLE                                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-navy-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Icon name="calendar-x" size={32} className="mx-auto text-navy-300" />
            <div className="text-sm font-bold text-navy-700">No leave applications found</div>
            <div className="text-xs text-navy-400 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your search query or status filter.'
                : 'No leave applications have been submitted yet. Click "Apply Leave / Request" to record one.'}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-50/70 text-[11px] font-black uppercase text-navy-500 tracking-wider border-b border-navy-100">
                <tr>
                  <th className="py-3.5 px-4">TRAINER / STAFF</th>
                  <th className="py-3.5 px-4">LEAVE TYPE</th>
                  <th className="py-3.5 px-4">PERIOD</th>
                  <th className="py-3.5 px-4">DAYS</th>
                  <th className="py-3.5 px-4">REASON &amp; NOTES</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4">REVIEWER</th>
                  <th className="py-3.5 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50 font-medium text-navy-800">
                {filteredLeaves.map((l) => {
                  const initials = l.employee_name
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'TR';

                  const isPending = l.status === 'Pending';
                  const isApproved = l.status === 'Approved';
                  const isActing = actionLoadingId === l.id;

                  return (
                    <tr key={l.id} className="hover:bg-purple-50/30 transition-colors">
                      {/* Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-navy-900">{l.employee_name}</div>
                            <div className="text-[10px] text-navy-400 font-mono flex items-center gap-1.5">
                              <span>{l.employee_code}</span>
                              <span>•</span>
                              <span>{l.department || 'Fitness'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Leave Type */}
                      <td className="py-3.5 px-4">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[10px] font-bold border',
                            l.leave_type.toLowerCase().includes('sick')
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : l.leave_type.toLowerCase().includes('paid')
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : l.leave_type.toLowerCase().includes('unpaid')
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-purple-50 text-purple-700 border-purple-200'
                          )}
                        >
                          {l.leave_type}
                        </span>
                      </td>

                      {/* Period */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-navy-900 font-semibold">
                          {l.start_date} <span className="text-navy-400">→</span> {l.end_date}
                        </div>
                        <div className="text-[10px] text-navy-400">Applied {l.applied_on}</div>
                      </td>

                      {/* Days */}
                      <td className="py-3.5 px-4 font-black text-navy-900">
                        {l.days} {l.days === 1 ? 'Day' : 'Days'}
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-4 text-navy-600 max-w-xs truncate" title={l.reason}>
                        {l.reason || '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit',
                            isApproved
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              isApproved ? 'bg-emerald-500' : isPending ? 'bg-amber-500' : 'bg-rose-500'
                            )}
                          />
                          {l.status}
                        </span>
                      </td>

                      {/* Reviewer */}
                      <td className="py-3.5 px-4 text-xs text-navy-500 font-medium">
                        {l.approved_by || 'Pending Review'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              disabled={isActing}
                              onClick={() => handleUpdateStatus(l.id, 'Approved', l.employee_name)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            >
                              <Icon name="check" size={13} />
                              <span>Approve</span>
                            </button>
                            <button
                              disabled={isActing}
                              onClick={() => handleUpdateStatus(l.id, 'Rejected', l.employee_name)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            >
                              <Icon name="x" size={13} />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : isApproved ? (
                          <span className="text-emerald-700 text-xs font-bold flex items-center justify-end gap-1">
                            <Icon name="check-circle" size={14} />
                            <span>Approved</span>
                          </span>
                        ) : (
                          <span className="text-rose-600 text-xs font-bold flex items-center justify-end gap-1">
                            <Icon name="x-circle" size={14} />
                            <span>Rejected</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. APPLY LEAVE MODAL                                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-navy-100 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-navy-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Icon name="calendar" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-navy-900">Record Leave Application</h3>
                  <p className="text-xs text-navy-500">Apply leave on behalf of a coach or staff member.</p>
                </div>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="w-8 h-8 rounded-xl bg-navy-50 text-navy-500 hover:text-navy-900 flex items-center justify-center transition cursor-pointer"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <Icon name="alert-circle" size={15} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleApplyLeave} className="space-y-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-navy-700 mb-1.5">
                  Select Trainer / Employee <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none cursor-pointer"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name || ''} ({emp.designation || 'Staff'}) — {emp.code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Leave Type */}
              <div>
                <label className="block text-xs font-bold text-navy-700 mb-1.5">
                  Leave Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formLeaveType}
                  onChange={(e) => setFormLeaveType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none cursor-pointer"
                >
                  <option value="Casual Leave">🏖️ Casual Leave (CL)</option>
                  <option value="Sick Leave">🏥 Sick Leave (SL)</option>
                  <option value="Paid Leave">⭐ Paid Leave (PL)</option>
                  <option value="Unpaid Leave">⚠️ Unpaid Leave (LWP)</option>
                  <option value="Emergency Leave">🚨 Emergency Leave</option>
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy-700 mb-1.5">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy-700 mb-1.5">
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-navy-50 border border-navy-200 text-xs font-bold text-navy-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-navy-700 mb-1.5">Reason / Description</label>
                <textarea
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="e.g. Personal emergency, medical recovery, family event..."
                  className="w-full px-3.5 py-2 rounded-xl bg-navy-50 border border-navy-200 text-xs font-medium text-navy-900 placeholder-navy-400 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-navy-100">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-navy-600 hover:bg-navy-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <Icon name="loader-2" size={14} className="animate-spin" />}
                  <span>Submit Application</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
