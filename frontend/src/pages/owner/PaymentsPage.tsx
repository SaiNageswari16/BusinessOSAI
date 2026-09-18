import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/services/api';

export function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.payments.all()
      .then((res: any) => {
        const txs = Array.isArray(res) ? res : res?.transactions || [];
        setPayments(txs);
      })
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);

  const completed = payments.filter((p) => (p.status || '').toLowerCase() === 'completed');
  const pending = payments.filter((p) => (p.status || '').toLowerCase() === 'pending');
  const failed = payments.filter((p) => (p.status || '').toLowerCase() === 'failed');
  const totalRevenue = completed.reduce((s, p) => s + (p.amount || 0), 0);
  const pendingAmount = pending.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" breadcrumb={['Owner', 'Payments']} actions={<button className="btn-primary"><Icon name="download" size={16} /> Export</button>} />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5"><div className="flex items-center justify-between mb-2"><span className="stat-label">Total Revenue</span><div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center"><Icon name="indian-rupee" size={16} className="text-success-600" /></div></div><div className="text-2xl font-bold text-navy-900">₹{totalRevenue.toLocaleString()}</div><div className="text-xs text-success-600 font-semibold mt-1">Live DB Revenue</div></div>
          <div className="card p-5"><div className="flex items-center justify-between mb-2"><span className="stat-label">Pending</span><div className="w-8 h-8 rounded-lg bg-warning-50 flex items-center justify-center"><Icon name="clock" size={16} className="text-warning-600" /></div></div><div className="text-2xl font-bold text-navy-900">₹{pendingAmount.toLocaleString()}</div><div className="text-xs text-warning-600 font-semibold mt-1">{pending.length} pending items</div></div>
          <div className="card p-5"><div className="flex items-center justify-between mb-2"><span className="stat-label">Completed</span><div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center"><Icon name="check-circle" size={16} className="text-brand-600" /></div></div><div className="text-2xl font-bold text-navy-900">{completed.length}</div><div className="text-xs text-navy-400 mt-1">transactions</div></div>
          <div className="card p-5"><div className="flex items-center justify-between mb-2"><span className="stat-label">Failed</span><div className="w-8 h-8 rounded-lg bg-danger-50 flex items-center justify-center"><Icon name="alert-circle" size={16} className="text-danger-600" /></div></div><div className="text-2xl font-bold text-navy-900">{failed.length}</div><div className="text-xs text-danger-600 font-semibold mt-1">needs retry</div></div>
        </div>
      )}

      <div className="card p-4">
        <h3 className="text-sm font-bold text-navy-900 mb-4">Transaction History</h3>
        {loading ? <SkeletonTable rows={6} cols={6} /> : payments.length === 0 ? (
          <EmptyState
            title="No Transactions Found"
            description="Membership payments and POS transactions will appear here when completed."
            icon="credit-card"
          />
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[700px]">
              <thead><tr className="border-b border-navy-100">{['Invoice', 'Member', 'Amount', 'Method', 'Date', 'Status'].map((h) => (<th key={h} className="text-left text-xs font-semibold text-navy-400 uppercase tracking-wider px-3 py-3">{h}</th>))}</tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-navy-50 hover:bg-navy-50 transition-colors">
                    <td className="px-3 py-3 text-sm font-mono text-navy-500">{p.invoice_number || p.invoice || 'INV-000'}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-navy-900">{p.member || p.customer_name || 'Member'}</td>
                    <td className="px-3 py-3 text-sm font-bold text-navy-900">₹{(p.amount || 0).toLocaleString()}</td>
                    <td className="px-3 py-3"><Badge variant="neutral">{p.payment_method || p.method || 'Online'}</Badge></td>
                    <td className="px-3 py-3 text-sm text-navy-500">{p.date || p.created_at || 'Today'}</td>
                    <td className="px-3 py-3"><Badge variant={(p.status || '').toLowerCase() === 'completed' ? 'success' : (p.status || '').toLowerCase() === 'pending' ? 'warning' : 'danger'} dot>{p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
