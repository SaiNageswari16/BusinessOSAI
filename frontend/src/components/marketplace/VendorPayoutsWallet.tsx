import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, DollarSign, ArrowUpRight, Clock, CheckCircle2, AlertCircle, Building2, CreditCard, ShieldCheck } from "lucide-react";
import { marketplaceApi } from "@/lib/marketplace-api";

export function VendorPayoutsWallet() {
  const [summary, setSummary] = useState({
    totalPendingPayouts: 48500.0,
    totalPaidThisMonth: 210000.0,
    walletHoldbackReserve: 15000.0,
  });
  const [payouts, setPayouts] = useState([
    { id: "PAY-901", vendor: "Apex Tech Solutions", amount: 14200.0, status: "Processed", date: "2026-08-10", method: "Bank Wire Transfer" },
    { id: "PAY-902", vendor: "Global Logistics Hub", amount: 8900.0, status: "Pending Approval", date: "2026-08-14", method: "Stripe Direct" },
    { id: "PAY-903", vendor: "Nexus Supply Chain", amount: 25400.0, status: "In Transit", date: "2026-08-15", method: "Wire Transfer" },
    { id: "PAY-904", vendor: "Urban Retail Group", amount: 6750.0, status: "Pending Approval", date: "2026-08-15", method: "Bank Wire Transfer" },
  ]);
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPayout, setNewPayout] = useState({
    vendor_id: "",
    amount: 5000.0,
    method: "Bank Wire Transfer",
    notes: "Bi-weekly seller balance disbursement",
  });

  const fetchPayoutsData = async () => {
    try {
      const data = await marketplaceApi.getVendorPayouts();
      if (data.summary) setSummary(data.summary);
      if (data.payouts && data.payouts.length > 0) setPayouts(data.payouts);
    } catch (err) {
      console.error("Failed to load payouts:", err);
    }
  };

  useEffect(() => {
    fetchPayoutsData();
    marketplaceApi.getVendors().then(v => {
      if (v.vendors) {
        setVendorsList(v.vendors);
        if (v.vendors.length > 0) setNewPayout(prev => ({ ...prev, vendor_id: v.vendors[0].id }));
      }
    }).catch(() => {});
  }, []);

  const handleApprove = (id: string) => {
    setPayouts(payouts.map(p => p.id === id ? { ...p, status: "Processed" } : p));
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayout.vendor_id || newPayout.amount <= 0) return;
    try {
      const res = await marketplaceApi.requestVendorPayout(newPayout);
      const selVendor = vendorsList.find(v => v.id === newPayout.vendor_id);
      setPayouts([
        {
          id: res.payout?.id || `PAY-${Math.floor(Math.random() * 900) + 100}`,
          vendor: selVendor ? selVendor.name : "Registered Supplier",
          amount: newPayout.amount,
          status: "Pending Approval",
          date: new Date().toISOString().split("T")[0],
          method: newPayout.method,
        },
        ...payouts,
      ]);
    } catch {
      setPayouts([
        {
          id: `PAY-${Math.floor(Math.random() * 900) + 100}`,
          vendor: "Registered Supplier",
          amount: newPayout.amount,
          status: "Pending Approval",
          date: new Date().toISOString().split("T")[0],
          method: newPayout.method,
        },
        ...payouts,
      ]);
    }
    setShowAddModal(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendor Wallet & Payouts</h1>
          <p className="text-sm text-muted-foreground">Monitor vendor wallet balances, escrow holdbacks, and approve payout disbursements.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <DollarSign className="size-4" /> Request Payout
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-border/50 bg-gradient-to-br from-emerald-500/10 via-background to-background">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Paid This Month</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <DollarSign className="size-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-foreground">${summary.totalPaidThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-emerald-500 font-medium mt-1 flex items-center gap-1">
            <ArrowUpRight className="size-3.5" /> +15.4% from last month
          </p>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border/50 bg-gradient-to-br from-amber-500/10 via-background to-background">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Payout Queue</span>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Clock className="size-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-foreground">${summary.totalPendingPayouts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-amber-500 font-medium mt-1">
            {payouts.filter(p => p.status === "Pending Approval").length} payout requests pending approval
          </p>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-border/50 bg-gradient-to-br from-blue-500/10 via-background to-background">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Escrow Reserve Holdback</span>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <ShieldCheck className="size-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-foreground">${summary.walletHoldbackReserve.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground mt-1">Safety buffer for returns & disputes</p>
        </div>
      </div>

      <div className="glass-panel border border-border/50 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border/50 flex justify-between items-center">
          <h2 className="font-bold text-foreground text-base">Recent Payout Requests</h2>
          <span className="text-xs text-muted-foreground">Automated settlement on 1st & 15th</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3.5 px-4">Payout ID</th>
                <th className="py-3.5 px-4">Vendor</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-accent/30 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs font-semibold text-primary">{p.id}</td>
                  <td className="py-3.5 px-4 font-medium text-foreground">{p.vendor}</td>
                  <td className="py-3.5 px-4 font-bold text-foreground">${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-3.5 px-4 text-xs text-muted-foreground">{p.method}</td>
                  <td className="py-3.5 px-4 text-xs text-muted-foreground">{p.date}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide uppercase ${
                      p.status === "Processed" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                      p.status === "Pending Approval" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                      "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {p.status === "Pending Approval" ? (
                      <button 
                        onClick={() => handleApprove(p.id)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors shadow-sm"
                      >
                        Approve & Pay
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-background border border-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4"
          >
            <div className="border-b border-border/50 pb-3">
              <h2 className="text-xl font-bold text-foreground">Request Vendor Payout</h2>
              <p className="text-xs text-muted-foreground">Authorize seller wallet balance disbursement.</p>
            </div>

            <form onSubmit={handleRequestPayout} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Select Vendor *</label>
                <select
                  value={newPayout.vendor_id}
                  onChange={e => setNewPayout({ ...newPayout, vendor_id: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  required
                >
                  <option value="">-- Select Vendor --</option>
                  {vendorsList.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Disbursement Amount ($) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={newPayout.amount}
                  onChange={e => setNewPayout({ ...newPayout, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Payment Method</label>
                <select
                  value={newPayout.method}
                  onChange={e => setNewPayout({ ...newPayout, method: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                >
                  <option value="Bank Wire Transfer">Bank Wire Transfer</option>
                  <option value="Stripe Direct">Stripe Direct</option>
                  <option value="ACH">ACH Transfer</option>
                  <option value="UPI">UPI Instant Pay</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium transition-colors text-foreground"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Submit Payout Request
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
