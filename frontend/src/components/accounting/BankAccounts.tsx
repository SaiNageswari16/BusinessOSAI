import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, RefreshCw, Loader2, AlertCircle, Building2, CreditCard, ArrowUpRight, ArrowDownLeft, CheckCircle, Clock, ChevronRight, X, Save } from "lucide-react";
import { bankApi, BankAccountRecord, BankTransaction, accountingApi, ChartOfAccount } from "@/lib/api-client";
import { toast } from "sonner";

interface Props { tab?: string; }

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
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

// ─── Reconciliation placeholder ────────────────────────────────────────────
function ReconciliationTab() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-1">Bank Reconciliation</h1>
      <p className="text-sm text-muted-foreground mb-6">Match bank statement lines to your system transactions.</p>
      <div className="glass-panel rounded-xl border border-border/50 p-12 flex flex-col items-center justify-center text-center">
        <CheckCircle className="size-12 text-primary/40 mb-3" />
        <p className="font-medium text-foreground">Select an account to start reconciliation</p>
        <p className="text-sm text-muted-foreground mt-1">Go to Bank Accounts tab, click an account, then start a new reconciliation run.</p>
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export function BankAccounts({ tab = "bank_accounts" }: Props) {
  if (tab === "reconciliation") return <ReconciliationTab />;
  return <BankAccountsTab />;
}
