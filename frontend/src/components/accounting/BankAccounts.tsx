import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, RefreshCw, Loader2, AlertCircle, Building2, CreditCard, ArrowUpRight, ArrowDownLeft, CheckCircle, Clock, ChevronRight, X, Save } from "lucide-react";
import { bankApi, BankAccountRecord, BankTransaction, accountingApi, ChartOfAccount } from "@/lib/api-client";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { formatCurrency } from "@/lib/utils";

import { getActiveCurrency } from "@/lib/utils";

interface Props { tab?: string; }

function fmt(n: number) {
  const curr = getActiveCurrency();
  return `${curr.symbol}${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500",
  inactive: "bg-muted text-muted-foreground",
  closed: "bg-red-400/10 text-red-400",
};

// ─── Modal: Add Bank Account ──────────────────────────────────────────────
function BankAccountFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [form, setForm] = useState({
    name: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    branch_name: "",
    account_type: "checking",
    currency_code: "INR",
    opening_balance: 0,
    is_default: false,
    chart_of_account_id: "",
  });

  useEffect(() => {
    // Load asset/bank accounts for chart_of_account dropdown selection
    const loadCOA = async () => {
      try {
        const res = await accountingApi.listAccounts({ page: 1, page_size: 100, account_type: "asset", is_active: true });
        // filter bank/cash sub-types if possible, or just all assets
        setAccounts(res.items);
        if (res.items.length > 0) {
          setForm(p => ({ ...p, chart_of_account_id: res.items[0].id }));
        }
      } catch {
        toast.error("Failed to load chart of accounts");
      }
    };
    loadCOA();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await bankApi.createBankAccount({
        ...form,
        chart_of_account_id: form.chart_of_account_id || undefined
      });
      toast.success("Bank Account created successfully!");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to create bank account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground">Add Bank Account</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Account Nickname *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="Primary Operating" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Bank Name *</label>
              <input value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="HDFC Bank" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Account Number *</label>
              <input value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-mono" placeholder="501002040" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">IFSC Code *</label>
              <input value={form.ifsc_code} onChange={e => setForm(p => ({ ...p, ifsc_code: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-mono uppercase" placeholder="HDFC0000104" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Branch Name</label>
              <input value={form.branch_name} onChange={e => setForm(p => ({ ...p, branch_name: e.target.value }))}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="Bandra BKC" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Account Type *</label>
              <select value={form.account_type} onChange={e => setForm(p => ({ ...p, account_type: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="loan">Loan / Overdraft</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Linked Ledger (GL) Account *</label>
              <select value={form.chart_of_account_id} onChange={e => setForm(p => ({ ...p, chart_of_account_id: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Opening Balance (INR)</label>
              <input type="number" step="any" value={form.opening_balance} onChange={e => setForm(p => ({ ...p, opening_balance: parseFloat(e.target.value) || 0 }))}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-semibold" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="is_default" checked={form.is_default} onChange={e => setForm(p => ({ ...p, is_default: e.target.checked }))}
                className="size-4 text-primary focus:ring-primary rounded border-border" />
              <label htmlFor="is_default" className="text-xs font-semibold text-muted-foreground cursor-pointer select-none">Set as default account</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Bank
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Bank Accounts List ─────────────────────────────────────────────────────
function BankAccountsTab() {
  const [, setCurrencyTick] = useState(0);
  useEffect(() => {
    const cb = () => setCurrencyTick(t => t + 1);
    window.addEventListener("bos-currency-changed", cb);
    return () => window.removeEventListener("bos-currency-changed", cb);
  }, []);

  const [accounts, setAccounts] = useState<BankAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BankAccountRecord | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bankApi.listBankAccounts({ page: 1, page_size: 50 });
      setAccounts(res.items);
      // Auto-select first account if none selected
      if (res.items.length > 0 && !selected) {
        handleSelectAccount(res.items[0]);
      }
    } catch {
      toast.error("Failed to load bank accounts");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const handleSelectAccount = async (acc: BankAccountRecord) => {
    setSelected(acc);
    setTxLoading(true);
    try {
      const res = await bankApi.listTransactions(acc.id, { page: 1, page_size: 50 });
      setTransactions(res.items);
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bank Accounts</h1>
          <p className="text-sm text-muted-foreground">Total balance across all accounts: <span className="font-semibold text-foreground">{fmt(totalBalance)}</span></p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> Add Bank Account
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="size-8 animate-spin text-primary" /></div>
      ) : accounts.length === 0 ? (
        <div className="glass-panel rounded-xl border border-border/50 p-12 flex flex-col items-center justify-center text-center">
          <Building2 className="size-12 text-primary/40 mb-3" />
          <p className="font-medium text-foreground">No bank accounts configured</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first bank account to start tracking transactions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Account cards list */}
          <div className="space-y-3">
            {accounts.map((acc, i) => (
              <motion.div key={acc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                onClick={() => handleSelectAccount(acc)}
                className={`glass-panel rounded-xl border p-4 cursor-pointer transition-all hover:shadow-lg ${selected?.id === acc.id ? "border-primary bg-primary/5" : "border-border/50"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg"><Building2 className="size-4 text-primary" /></div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{acc.name}</p>
                      <p className="text-xs text-muted-foreground">{acc.bank_name || "—"}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${STATUS_COLORS[acc.status] || "bg-muted text-muted-foreground"}`}>{acc.status}</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Account No.</p>
                    <p className="font-mono text-sm text-foreground">{acc.account_number || "N/A"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className={`font-bold text-base ${acc.current_balance >= 0 ? "text-emerald-500" : "text-red-400"}`}>{fmt(acc.current_balance)}</p>
                  </div>
                </div>
                {acc.is_default && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <span className="text-xs text-primary font-medium">★ Default Account</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Transactions panel */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
                <div className="p-4 border-b border-border/50 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{selected.name} — Transactions</p>
                    <p className="text-xs text-muted-foreground">{selected.bank_name} · {selected.account_number}</p>
                  </div>
                  <button onClick={() => handleSelectAccount(selected)} className="p-2 hover:bg-muted/50 rounded-lg transition-colors">
                    <RefreshCw className={`size-4 ${txLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
                {txLoading ? (
                  <div className="flex items-center justify-center h-48"><Loader2 className="size-6 animate-spin text-primary" /></div>
                ) : transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <CreditCard className="size-8 mb-2" /><p className="text-sm">No transactions yet</p>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-[500px]">
                    {transactions.map((tx, i) => (
                      <motion.div key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                        className="flex items-center gap-3 p-4 border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                        <div className={`p-2 rounded-lg shrink-0 ${tx.transaction_type === "credit" || tx.transaction_type === "deposit" ? "bg-emerald-500/10" : "bg-red-400/10"}`}>
                          {tx.transaction_type === "credit" || tx.transaction_type === "deposit"
                            ? <ArrowDownLeft className="size-4 text-emerald-500" />
                            : <ArrowUpRight className="size-4 text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">{tx.transaction_date}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-semibold text-sm ${tx.transaction_type === "credit" || tx.transaction_type === "deposit" ? "text-emerald-500" : "text-red-400"}`}>
                            {tx.transaction_type === "credit" || tx.transaction_type === "deposit" ? "+" : "−"}{fmt(Math.abs(tx.amount))}
                          </p>
                          {tx.running_balance !== null && <p className="text-xs text-muted-foreground">Bal: {fmt(tx.running_balance)}</p>}
                        </div>
                        <div>
                          {tx.is_reconciled
                            ? <CheckCircle className="size-4 text-emerald-500" />
                            : <Clock className="size-4 text-muted-foreground" />}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-panel rounded-xl border border-border/50 p-12 flex flex-col items-center justify-center h-full text-center">
                <ChevronRight className="size-10 text-primary/30 mb-3" />
                <p className="font-medium text-foreground">Select an account</p>
                <p className="text-sm text-muted-foreground mt-1">Click a bank account on the left to view its transactions.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <BankAccountFormModal onClose={() => setShowAddModal(false)} onSaved={loadAccounts} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Reconciliation Tab ────────────────────────────────────────────────────
function ReconciliationTab() {
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadReconciliations = async () => {
    setLoading(true);
    try {
      const params: any = { page_size: 100 };
      if (filterStatus) params.status = filterStatus;
      const res = await bankApi.listReconciliations(params);
      setReconciliations(res.items || []);
    } catch {
      toast.error("Failed to load reconciliations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReconciliations();
  }, [filterStatus]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    try {
      await bankApi.createReconciliation({
        bank_account_id: fd.get("bank_account_id") as string,
        reconciliation_date: fd.get("reconciliation_date") as string,
        statement_balance: parseFloat(fd.get("statement_balance") as string) || 0,
        notes: (fd.get("notes") as string) || undefined,
      });
      toast.success("Reconciliation created successfully!");
      setShowCreateModal(false);
      loadReconciliations();
    } catch {
      toast.error("Failed to create reconciliation");
    } finally {
      setCreating(false);
    }
  };

  const handleComplete = async (reconId: string) => {
    setCompleting(true);
    try {
      await bankApi.completeReconciliation(reconId);
      toast.success("Reconciliation completed!");
      setSelected(null);
      loadReconciliations();
    } catch {
      toast.error("Failed to complete reconciliation");
    } finally {
      setCompleting(false);
    }
  };

  const filtered = reconciliations.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.id?.toLowerCase().includes(q) || r.status?.toLowerCase().includes(q);
  });

  // ─── Detail View ──────────────────────────────────────────────────────
  if (selected) {
    const matchedItems = (selected.items || []).filter((i: any) => i.is_matched);
    const clearedItems = (selected.items || []).filter((i: any) => i.is_cleared);
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Reconciliation Details</h1>
            <p className="text-xs text-muted-foreground font-mono">{selected.id?.slice(0, 12)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Date</p>
            <p className="text-sm font-semibold text-foreground">{selected.reconciliation_date}</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${selected.status === "completed" ? "bg-emerald-500/10 text-emerald-500" : selected.status === "in_progress" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}`}>{selected.status}</span>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Statement Balance</p>
            <p className="text-sm font-semibold text-foreground">{fmt(selected.statement_balance)}</p>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Difference</p>
            <p className={`text-sm font-semibold ${Math.abs(selected.difference || 0) < 0.01 ? "text-emerald-500" : "text-red-500"}`}>{fmt(selected.difference || 0)}</p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-foreground">Items ({selected.items?.length || 0})</h3>
          {selected.status !== "completed" && (
            <button onClick={() => handleComplete(selected.id)} disabled={completing} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              {completing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />} Complete Reconciliation
            </button>
          )}
        </div>

        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 font-medium">Matched</th>
                  <th className="px-4 py-3 font-medium">Cleared</th>
                  <th className="px-4 py-3 font-medium">Transaction</th>
                  <th className="px-4 py-3 font-medium">Journal Entry</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(selected.items || []).map((item: any) => (
                  <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      {item.is_matched ? <CheckCircle className="size-4 text-emerald-500" /> : <Clock className="size-4 text-muted-foreground" />}
                    </td>
                    <td className="px-4 py-3">
                      {item.is_cleared ? <CheckCircle className="size-4 text-emerald-500" /> : <Clock className="size-4 text-muted-foreground" />}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.bank_transaction_id?.slice(0, 8) || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.journal_entry_id?.slice(0, 8) || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.notes || "—"}</td>
                  </tr>
                ))}
                {(!selected.items || selected.items.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No items in this reconciliation.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ─── List View ────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bank Reconciliation</h1>
          <p className="text-sm text-muted-foreground">Match bank statement lines to your system transactions.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> New Reconciliation
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search reconciliations..." className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border bg-background outline-none" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 px-3 text-sm rounded-lg border bg-background outline-none">
          <option value="">All Statuses</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="size-6 animate-spin mr-2" /> Loading reconciliations…</div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-12 rounded-xl border border-border/50 text-center text-muted-foreground">No reconciliations found. Create one to get started.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              onClick={() => setSelected(r)} className="glass-panel p-5 rounded-xl border border-border/50 hover:shadow-elegant transition-all cursor-pointer">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-xs font-mono text-muted-foreground">{r.id?.slice(0, 12)}</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{r.reconciliation_date}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.status === "completed" ? "bg-emerald-500/10 text-emerald-500" : r.status === "in_progress" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}`}>{r.status}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Statement Balance</span><span className="font-semibold text-foreground">{fmt(r.statement_balance)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Difference</span><span className={`font-semibold ${Math.abs(r.difference || 0) < 0.01 ? "text-emerald-500" : "text-red-500"}`}>{fmt(r.difference || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Items</span><span className="font-semibold text-foreground">{r.items?.length || 0}</span></div>
              </div>
              {r.notes && <p className="text-xs text-muted-foreground mt-3 line-clamp-1">{r.notes}</p>}
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-border/50">
                <h2 className="font-bold text-lg text-foreground">New Reconciliation</h2>
                <button onClick={() => setShowCreateModal(false)} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
              </div>
              <form onSubmit={handleCreate} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Bank Account ID *</label>
                  <input name="bank_account_id" required className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none font-mono" placeholder="Bank account UUID" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Reconciliation Date *</label>
                  <input name="reconciliation_date" type="date" required className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Statement Balance (INR) *</label>
                  <input name="statement_balance" type="number" step="any" required className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none font-semibold" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Notes</label>
                  <textarea name="notes" rows={2} className="w-full px-3 py-2 text-sm rounded-lg border bg-background outline-none resize-none" placeholder="Optional notes..." />
                </div>
                <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
                  <button type="submit" disabled={creating} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                    {creating ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export function BankAccounts({ tab = "bank_accounts" }: Props) {
    const { currency, formatCurrency } = useCurrency();
  if (tab === "reconciliation") return <ReconciliationTab />;
  return <BankAccountsTab />;
}
