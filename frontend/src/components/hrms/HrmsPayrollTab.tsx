import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard, Skeleton } from '@/components/ui/Skeleton';
import { hrmsApi, type PayrollItem, type EmployeeItem } from '@/services/hrmsApi';
import { apiClient } from '@/services/apiClient';
import { cn } from '@/utils/cn';

interface TrainerProfileItem {
  id: string;
  user_id?: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  specialization?: string;
  base_monthly_salary: number;
  pt_session_rate: number;
  bank_account_no?: string;
  bank_ifsc?: string;
  upi_id?: string;
  assigned_customers_count?: number;
}

interface HrmsPayrollTabProps {
  onSuccessToast?: (msg: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function HrmsPayrollTab({ onSuccessToast }: HrmsPayrollTabProps) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTH_NAMES[currentDate.getMonth()]);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  const [payrollRecords, setPayrollRecords] = useState<PayrollItem[]>([]);
  const [trainers, setTrainers] = useState<TrainerProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Checkbox selections for batch payroll generation
  const [selectedTrainerIds, setSelectedTrainerIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Paid'>('ALL');

  // Modals state
  const [disburseModalItem, setDisburseModalItem] = useState<PayrollItem | null>(null);
  const [payslipModalItem, setPayslipModalItem] = useState<PayrollItem | null>(null);
  const [disbursePaymentMethod, setDisbursePaymentMethod] = useState<'UPI' | 'Bank Transfer' | 'Cash'>('UPI');
  const [disburseTxnRef, setDisburseTxnRef] = useState('');
  const [disbursing, setDisbursing] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [payrollRes, trainersRes] = await Promise.all([
        hrmsApi.getPayroll(selectedMonth, selectedYear),
        apiClient.get<TrainerProfileItem[]>('/payroll/trainers').catch(() => []),
      ]);

      setPayrollRecords(payrollRes || []);
      setTrainers(trainersRes || []);

      // If no payroll records generated yet, auto-select all trainers for convenience
      if (trainersRes && trainersRes.length > 0) {
        setSelectedTrainerIds(trainersRes.map((t) => t.id));
      }
    } catch (err) {
      console.error('Failed to load payroll data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  // Handle Select All Checkbox
  const handleToggleSelectAll = () => {
    if (selectedTrainerIds.length === combinedList.length) {
      setSelectedTrainerIds([]);
    } else {
      setSelectedTrainerIds(combinedList.map((item) => item.targetId));
    }
  };

  const handleToggleSelect = (targetId: string) => {
    setSelectedTrainerIds((prev) =>
      prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId]
    );
  };

  // Generate Batch Payroll
  const handleGeneratePayroll = async () => {
    if (selectedTrainerIds.length === 0) {
      onSuccessToast?.('Please select at least one trainer or employee.');
      return;
    }

    setGenerating(true);
    try {
      const generated = await hrmsApi.generateBatchPayroll({
        trainer_ids: selectedTrainerIds,
        month: selectedMonth,
        year: selectedYear,
      });

      onSuccessToast?.(`Generated payroll for ${generated.length} trainer(s) for ${selectedMonth} ${selectedYear}!`);
      // Refresh payroll records
      const updated = await hrmsApi.getPayroll(selectedMonth, selectedYear);
      setPayrollRecords(updated || []);
    } catch (err: any) {
      console.error('Failed to generate payroll:', err);
      onSuccessToast?.(err?.message || 'Error generating payroll.');
    } finally {
      setGenerating(false);
    }
  };

  // Disburse payout
  const handleConfirmDisburse = async () => {
    if (!disburseModalItem) return;

    setDisbursing(true);
    try {
      const txn = disburseTxnRef.trim() || `TXN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      await hrmsApi.disbursePayroll(disburseModalItem.id, {
        payment_method: disbursePaymentMethod,
        transaction_reference: txn,
      });

      onSuccessToast?.(`Salary of ₹${disburseModalItem.net_salary.toLocaleString()} disbursed to ${disburseModalItem.employee_name}!`);
      setDisburseModalItem(null);
      setDisburseTxnRef('');

      // Refresh
      const updated = await hrmsApi.getPayroll(selectedMonth, selectedYear);
      setPayrollRecords(updated || []);
    } catch (err: any) {
      console.error('Failed to disburse salary:', err);
      onSuccessToast?.(err?.message || 'Error disbursing salary.');
    } finally {
      setDisbursing(false);
    }
  };

  // Build unified items list for table: combining active trainers with their generated or draft payroll records
  const payrollByTrainerId = new Map<string, PayrollItem>();
  payrollRecords.forEach((p) => {
    if (p.trainer_id) payrollByTrainerId.set(p.trainer_id, p);
    if (p.employee_id) {
      payrollByTrainerId.set(p.employee_id, p);
      payrollByTrainerId.set(p.employee_id.replace('emp_', ''), p);
    }
  });

  const combinedList = (trainers.length > 0
    ? trainers.map((t) => {
        const pay = payrollByTrainerId.get(t.id) || payrollByTrainerId.get(t.user_id || '') || null;
        return {
          targetId: t.id,
          trainerProfile: t,
          payrollRecord: pay,
          name: t.full_name,
          role: t.role || 'Fitness Trainer',
          baseSalary: t.base_monthly_salary || 0,
          ptRate: t.pt_session_rate || 500,
          assignedClients: t.assigned_customers_count || 0,
          status: pay ? pay.status : 'Not Generated',
        };
      })
    : payrollRecords.map((p) => ({
        targetId: p.employee_id,
        trainerProfile: null,
        payrollRecord: p,
        name: p.employee_name,
        role: p.designation || 'Staff',
        baseSalary: p.base_salary || 0,
        ptRate: p.pt_session_rate || 500,
        assignedClients: 0,
        status: p.status,
      }))
  );

  // Filtered List
  const filteredList = combinedList.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.role.toLowerCase().includes(q) ||
      item.targetId.toLowerCase().includes(q);

    let matchesStatus = true;
    if (statusFilter === 'Paid') matchesStatus = item.status === 'Paid';
    if (statusFilter === 'Pending') matchesStatus = item.status === 'Pending' || item.status === 'DRAFT';

    return matchesSearch && matchesStatus;
  });

  // KPI calculations
  const totalPayrollOutflow = payrollRecords.reduce((acc, p) => acc + (p.net_salary || 0), 0);
  const totalPaidOutflow = payrollRecords
    .filter((p) => p.status === 'Paid')
    .reduce((acc, p) => acc + (p.net_salary || 0), 0);
  const totalPendingOutflow = payrollRecords
    .filter((p) => p.status !== 'Paid')
    .reduce((acc, p) => acc + (p.net_salary || 0), 0);
  const activeStaffCount = combinedList.length;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER & MONTH/YEAR CONTROLS                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-navy-100 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-navy-900 tracking-tight flex items-center gap-2">
            <Icon name="credit-card" size={24} className="text-purple-600" />
            <span>Trainer Payroll &amp; Disbursements</span>
          </h2>
          <p className="text-xs text-navy-500 font-medium mt-1">
            Generate monthly salary dynamically based on attendance biometric punches, approved leaves, and PT commissions.
          </p>
        </div>

        {/* Month & Year Selectors */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-navy-50 p-1.5 rounded-xl border border-navy-200">
            <Icon name="calendar" size={14} className="text-purple-600 ml-1.5" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-navy-900 outline-none cursor-pointer pr-2"
            >
              {MONTH_NAMES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-navy-50 p-1.5 rounded-xl border border-navy-200">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-navy-900 outline-none cursor-pointer px-2"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
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
          {/* Total Estimated Payroll */}
          <div className="bg-white rounded-2xl p-5 border border-navy-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Total Net Payroll</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Icon name="credit-card" size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-navy-900">₹{totalPayrollOutflow.toLocaleString()}</div>
            <div className="text-[11px] text-purple-700 font-bold mt-1">
              For {selectedMonth} {selectedYear}
            </div>
          </div>

          {/* Paid / Disbursed Amount */}
          <div className="bg-white rounded-2xl p-5 border border-navy-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Disbursed (Paid)</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Icon name="check-circle" size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">₹{totalPaidOutflow.toLocaleString()}</div>
            <div className="text-[11px] text-emerald-700 font-bold mt-1">Settled payouts</div>
          </div>

          {/* Pending Disbursements */}
          <div className="bg-white rounded-2xl p-5 border border-navy-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Pending Outflow</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Icon name="clock" size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600">₹{totalPendingOutflow.toLocaleString()}</div>
            <div className="text-[11px] text-amber-700 font-bold mt-1">Awaiting disbursement</div>
          </div>

          {/* Active Trainers & Staff */}
          <div className="bg-white rounded-2xl p-5 border border-navy-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-navy-500 uppercase tracking-wider">Active Staff / Coaches</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Icon name="users" size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-navy-900">{activeStaffCount}</div>
            <div className="text-[11px] text-blue-600 font-bold mt-1">Eligible for payroll</div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. SELECTION ACTION BANNER & CONTROLS                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-navy-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="selectAllTrainers"
              checked={combinedList.length > 0 && selectedTrainerIds.length === combinedList.length}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-navy-300 cursor-pointer"
            />
            <label htmlFor="selectAllTrainers" className="text-xs font-bold text-navy-700 cursor-pointer">
              Select All ({combinedList.length})
            </label>
          </div>

          <span className="text-navy-300">|</span>

          <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
            {selectedTrainerIds.length} Selected
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Filter */}
          <div className="flex items-center gap-1 bg-navy-50 p-1 rounded-xl border border-navy-200">
            {(['ALL', 'Pending', 'Paid'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer',
                  statusFilter === s ? 'bg-purple-600 text-white shadow-xs' : 'text-navy-600 hover:text-navy-900'
                )}
              >
                {s === 'ALL' ? 'All' : s}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[200px]">
            <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input
              type="text"
              placeholder="Search coach by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-navy-50 border border-navy-200 text-xs font-semibold text-navy-900 placeholder-navy-400 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGeneratePayroll}
            disabled={generating || selectedTrainerIds.length === 0}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center gap-2 shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            {generating ? (
              <Icon name="loader-2" size={14} className="animate-spin" />
            ) : (
              <Icon name="zap" size={14} className="text-amber-300" />
            )}
            <span>Generate Payroll ({selectedTrainerIds.length})</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. PAYROLL & SALARY BREAKDOWN TABLE                           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-navy-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Icon name="credit-card" size={32} className="mx-auto text-navy-300" />
            <div className="text-sm font-bold text-navy-700">No trainer records found</div>
            <div className="text-xs text-navy-400">
              Select month {selectedMonth} {selectedYear} or register new coaches in Employee Management tab.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-50/70 text-[11px] font-black uppercase text-navy-500 tracking-wider border-b border-navy-100">
                <tr>
                  <th className="py-3.5 px-4 w-10 text-center">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="py-3.5 px-4">TRAINER / COACH</th>
                  <th className="py-3.5 px-4">BASE SALARY</th>
                  <th className="py-3.5 px-4">ATTENDANCE DAYS</th>
                  <th className="py-3.5 px-4">PT COMMISSIONS</th>
                  <th className="py-3.5 px-4">DEDUCTIONS</th>
                  <th className="py-3.5 px-4">NET PAYABLE</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50 font-medium text-navy-800">
                {filteredList.map((item) => {
                  const pay = item.payrollRecord;
                  const isSelected = selectedTrainerIds.includes(item.targetId);
                  const isPaid = pay?.status === 'Paid';
                  const initials = item.name
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'TR';

                  return (
                    <tr
                      key={item.targetId}
                      className={cn(
                        'transition-colors',
                        isSelected ? 'bg-purple-50/40' : 'hover:bg-navy-50/40'
                      )}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.targetId)}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-navy-300 cursor-pointer"
                        />
                      </td>

                      {/* Coach Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-navy-900">{item.name}</div>
                            <div className="text-[10px] text-navy-400 flex items-center gap-1.5">
                              <span>{item.role}</span>
                              {item.assignedClients > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-purple-700 font-semibold">
                                    {item.assignedClients} PT Clients
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Base Salary */}
                      <td className="py-3.5 px-4 font-mono font-bold text-navy-900">
                        ₹{item.baseSalary.toLocaleString()}
                        <div className="text-[10px] text-navy-400 font-normal">/ month</div>
                      </td>

                      {/* Attendance breakdown */}
                      <td className="py-3.5 px-4">
                        {pay ? (
                          <div>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                              {pay.days_present ?? 26} Present
                            </span>
                            {(pay.days_absent ?? 0) > 0 && (
                              <span className="ml-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[11px]">
                                {pay.days_absent} Absent
                              </span>
                            )}
                            {(pay.paid_leave_days ?? 0) > 0 && (
                              <div className="text-[10px] text-purple-700 font-semibold mt-0.5">
                                +{pay.paid_leave_days} Paid Leaves
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-navy-400 italic text-[11px]">Click Generate</span>
                        )}
                      </td>

                      {/* PT Sessions & Commission */}
                      <td className="py-3.5 px-4">
                        {pay ? (
                          <div>
                            <div className="font-bold text-purple-700 font-mono">
                              +₹{(pay.commission_earned ?? 0).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-navy-400">
                              {pay.pt_sessions_count ?? 0} Sessions @ ₹{pay.pt_session_rate ?? item.ptRate}
                            </div>
                          </div>
                        ) : (
                          <span className="text-navy-400 text-[11px]">@ ₹{item.ptRate}/session</span>
                        )}
                      </td>

                      {/* Deductions */}
                      <td className="py-3.5 px-4">
                        {pay ? (
                          <div className="font-mono text-rose-600 font-bold">
                            -₹{(pay.deductions ?? 0).toLocaleString()}
                          </div>
                        ) : (
                          <span className="text-navy-400">—</span>
                        )}
                      </td>

                      {/* Net Payable */}
                      <td className="py-3.5 px-4">
                        {pay ? (
                          <div className="font-mono font-black text-sm text-navy-900">
                            ₹{pay.net_salary.toLocaleString()}
                          </div>
                        ) : (
                          <span className="text-navy-400 font-mono text-xs">₹{item.baseSalary.toLocaleString()} (Est.)</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {pay ? (
                          <span
                            className={cn(
                              'px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit',
                              isPaid
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            )}
                          >
                            <span
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                isPaid ? 'bg-emerald-500' : 'bg-amber-500'
                              )}
                            />
                            {isPaid ? 'Paid' : 'Pending Payout'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-navy-100 text-navy-600">
                            Draft
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {pay && !isPaid && (
                            <button
                              onClick={() => {
                                setDisburseModalItem(pay);
                                setDisburseTxnRef(`TXN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`);
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1"
                            >
                              <Icon name="send" size={12} />
                              <span>Disburse</span>
                            </button>
                          )}

                          {pay && (
                            <button
                              onClick={() => setPayslipModalItem(pay)}
                              title="View &amp; Print Payslip"
                              className="px-2 py-1.5 rounded-lg text-xs font-bold bg-navy-50 hover:bg-purple-50 text-navy-600 hover:text-purple-700 border border-navy-200 transition cursor-pointer flex items-center gap-1"
                            >
                              <Icon name="file-text" size={13} />
                              <span className="hidden md:inline">Payslip</span>
                            </button>
                          )}
                        </div>
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
      {/* 5. DISBURSE SALARY MODAL                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {disburseModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-navy-100 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-navy-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Icon name="send" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-navy-900">Disburse Trainer Salary</h3>
                  <p className="text-xs text-navy-500">Record payout and transaction details.</p>
                </div>
              </div>
              <button
                onClick={() => setDisburseModalItem(null)}
                className="w-8 h-8 rounded-xl bg-navy-50 text-navy-500 hover:text-navy-900 flex items-center justify-center transition cursor-pointer"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            {/* Salary Summary Card */}
            <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-purple-900">
                <span className="font-semibold">Recipient:</span>
                <span className="font-bold">{disburseModalItem.employee_name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-purple-900">
                <span className="font-semibold">Period:</span>
                <span className="font-bold">{disburseModalItem.month} {disburseModalItem.year}</span>
              </div>
              <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between">
                <span className="text-xs font-bold text-purple-950 uppercase tracking-wide">Net Disbursable:</span>
                <span className="text-xl font-black text-purple-900 font-mono">
                  ₹{disburseModalItem.net_salary.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-bold text-navy-700 mb-1.5">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['UPI', 'Bank Transfer', 'Cash'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDisbursePaymentMethod(mode)}
                      className={cn(
                        'py-2 px-3 rounded-xl text-xs font-bold border transition text-center cursor-pointer',
                        disbursePaymentMethod === mode
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-navy-50 text-navy-700 border-navy-200 hover:bg-navy-100/80'
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank / UPI details display */}
              {disbursePaymentMethod === 'UPI' && disburseModalItem.upi_id && (
                <div className="text-xs p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-navy-700 flex items-center justify-between">
                  <span>Registered UPI ID:</span>
                  <span className="font-mono font-bold text-purple-700">{disburseModalItem.upi_id}</span>
                </div>
              )}

              {disbursePaymentMethod === 'Bank Transfer' && disburseModalItem.bank_account_no && (
                <div className="text-xs p-2.5 rounded-xl bg-navy-50 border border-navy-200 text-navy-700 space-y-1">
                  <div className="flex justify-between">
                    <span>A/C No:</span>
                    <span className="font-mono font-bold text-navy-900">{disburseModalItem.bank_account_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IFSC Code:</span>
                    <span className="font-mono font-bold text-navy-900">{disburseModalItem.bank_ifsc || '—'}</span>
                  </div>
                </div>
              )}

              {/* Transaction Ref */}
              <div>
                <label className="block text-xs font-bold text-navy-700 mb-1.5">Transaction Reference ID</label>
                <input
                  type="text"
                  placeholder="e.g. TXN-9284729"
                  value={disburseTxnRef}
                  onChange={(e) => setDisburseTxnRef(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-navy-50 border border-navy-200 text-xs font-mono font-semibold text-navy-900 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-navy-100">
              <button
                type="button"
                onClick={() => setDisburseModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-navy-600 hover:bg-navy-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={disbursing}
                onClick={handleConfirmDisburse}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {disbursing && <Icon name="loader-2" size={14} className="animate-spin" />}
                <span>Confirm &amp; Mark as Paid</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. DIGITAL PAYSLIP MODAL                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {payslipModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-navy-100 space-y-6 animate-scale-up">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-navy-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black text-lg">
                  FC
                </div>
                <div>
                  <h3 className="text-base font-black text-navy-900 tracking-tight">FIT CLUB AI PLATFORM</h3>
                  <p className="text-[11px] text-navy-500 font-mono">Monthly Salary Slip &amp; Computation</p>
                </div>
              </div>
              <button
                onClick={() => setPayslipModalItem(null)}
                className="w-8 h-8 rounded-xl bg-navy-50 text-navy-500 hover:text-navy-900 flex items-center justify-center transition cursor-pointer"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            {/* Coach & Period Meta */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-navy-50/70 p-4 rounded-2xl border border-navy-100 text-xs">
              <div>
                <div className="text-navy-400 text-[10px] uppercase font-bold">Employee / Coach</div>
                <div className="font-bold text-navy-900 mt-0.5">{payslipModalItem.employee_name}</div>
              </div>
              <div>
                <div className="text-navy-400 text-[10px] uppercase font-bold">Designation</div>
                <div className="font-bold text-navy-900 mt-0.5">{payslipModalItem.designation || 'Fitness Trainer'}</div>
              </div>
              <div>
                <div className="text-navy-400 text-[10px] uppercase font-bold">Month / Period</div>
                <div className="font-bold text-purple-700 mt-0.5">{payslipModalItem.month} {payslipModalItem.year}</div>
              </div>
            </div>

            {/* Breakdown Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Earnings */}
              <div className="border border-navy-100 rounded-2xl p-4 space-y-2.5">
                <div className="font-black text-emerald-800 uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Earnings</span>
                  <span>Amount</span>
                </div>
                <div className="divide-y divide-navy-50 space-y-2 pt-1 font-medium">
                  <div className="flex justify-between pt-1">
                    <span className="text-navy-600">Base Salary Earned:</span>
                    <span className="font-mono font-bold text-navy-900">
                      ₹{(payslipModalItem.base_salary_earned ?? payslipModalItem.base_salary).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-navy-600">PT Commissions:</span>
                    <span className="font-mono font-bold text-purple-700">
                      +₹{(payslipModalItem.commission_earned ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-navy-600">Special Allowances:</span>
                    <span className="font-mono font-bold text-navy-900">
                      ₹{(payslipModalItem.allowances ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="border border-navy-100 rounded-2xl p-4 space-y-2.5">
                <div className="font-black text-rose-800 uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Deductions</span>
                  <span>Amount</span>
                </div>
                <div className="divide-y divide-navy-50 space-y-2 pt-1 font-medium">
                  <div className="flex justify-between pt-1">
                    <span className="text-navy-600">Absent Days Penalty:</span>
                    <span className="font-mono font-bold text-rose-600">
                      -₹{(payslipModalItem.deductions ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-navy-600">Tax / PF Deductions:</span>
                    <span className="font-mono text-navy-500">₹0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Total Box */}
            <div className="bg-purple-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-md shadow-purple-600/20">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-purple-200">Net Salary Payable</div>
                <div className="text-xs text-purple-100 mt-0.5">
                  Status:{' '}
                  <span className="font-black text-white">{payslipModalItem.status}</span>
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono">
                ₹{payslipModalItem.net_salary.toLocaleString()}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl border border-navy-200 text-xs font-bold text-navy-700 hover:bg-navy-50 transition cursor-pointer flex items-center gap-1.5"
              >
                <Icon name="printer" size={14} />
                <span>Print Payslip</span>
              </button>
              <button
                type="button"
                onClick={() => setPayslipModalItem(null)}
                className="px-5 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
