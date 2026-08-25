import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, RefreshCw, CheckCircle, Clock, X, ChevronDown, Save,
  TrendingUp, TrendingDown, Loader2, AlertCircle, Eye, Edit, Trash2, Check
} from "lucide-react";
import { accountingApi, ChartOfAccount, JournalEntry, PaginatedResponse } from "@/lib/api-client";
import { toast } from "sonner";
import { fmt, statusStyle } from "@/components/accounting/utils";
import { useCurrency } from "@/hooks/use-currency";

interface Props { tab?: string; }

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  asset: "text-emerald-500 bg-emerald-500/10",
  liability: "text-red-400 bg-red-400/10",
  equity: "text-blue-500 bg-blue-500/10",
  income: "text-teal-500 bg-teal-500/10",
  expense: "text-orange-500 bg-orange-500/10",
};

// ─── Modal: Add Account ──────────────────────────────────────────────────
function AccountFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    account_type: "asset",
    account_sub_type: "bank",
    opening_balance: 0,
    description: "",
    is_active: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await accountingApi.createAccount(form);
      toast.success("Account created successfully!");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground">Add Ledger Account</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Account Code *</label>
              <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-mono" placeholder="1010" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Account Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="ICICI operational" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Account Type *</label>
              <select value={form.account_type} onChange={e => setForm(p => ({ ...p, account_type: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 capitalize">
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Sub-Type *</label>
              <select value={form.account_sub_type} onChange={e => setForm(p => ({ ...p, account_sub_type: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 capitalize">
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
                <option value="receivable">Receivable</option>
                <option value="payable">Payable</option>
                <option value="retained_earnings">Retained Earnings</option>
                <option value="sales">Sales</option>
                <option value="operating_expense">Operating Expense</option>
                <option value="tax">Tax</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Opening Balance (INR)</label>
              <input type="number" step="any" value={form.opening_balance} onChange={e => setForm(p => ({ ...p, opening_balance: parseFloat(e.target.value) || 0 }))}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-semibold" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                className="w-full p-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="Optional description..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Account
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Modal: New Journal Entry ─────────────────────────────────────────────
function JournalEntryFormModal({ onClose, onSaved, accounts }: { onClose: () => void; onSaved: () => void; accounts: ChartOfAccount[] }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split("T")[0],
    reference: "",
    description: "",
  });
  const [lines, setLines] = useState([
    { account_id: accounts[0]?.id || "", debit: 0, credit: 0, description: "" },
    { account_id: accounts[1]?.id || "", debit: 0, credit: 0, description: "" },
  ]);

  const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);
  const outOfBalance = Math.abs(totalDebits - totalCredits) > 0.01;

  const handleAddLine = () => {
    setLines(p => [...p, { account_id: accounts[0]?.id || "", debit: 0, credit: 0, description: "" }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(p => p.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: string, val: any) => {
    setLines(p => p.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (outOfBalance) {
      toast.error("Debits and Credits must balance!");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        entry_type: "journal",
        lines: lines.map(l => ({
          account_id: l.account_id,
          debit: l.debit,
          credit: l.credit,
          description: l.description || null
        }))
      };
      await accountingApi.createJournalEntry(payload);
      toast.success("Journal Entry created successfully!");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to create journal entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-bold text-lg text-foreground">New Journal Entry</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Entry Date *</label>
              <input type="date" value={form.entry_date} onChange={e => setForm(p => ({ ...p, entry_date: e.target.value }))} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Reference</label>
              <input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-mono" placeholder="INV-402, DEPRECIATION-Q3" />
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                className="w-full p-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="Overall entry description..." />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-foreground">Entry Lines</h3>
              <button type="button" onClick={handleAddLine} className="px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-semibold rounded-lg flex items-center gap-1">
                <Plus className="size-3" /> Add Row
              </button>
            </div>

            <div className="border border-border/50 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/30 border-b border-border/50">
                  <tr>
                    <th className="px-4 py-2 font-medium">Account</th>
                    <th className="px-4 py-2 font-medium text-right w-28">Debit (INR)</th>
                    <th className="px-4 py-2 font-medium text-right w-28">Credit (INR)</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="border-b border-border/50 last:border-0">
                      <td className="p-2">
                        <select value={line.account_id} onChange={e => updateLine(idx, "account_id", e.target.value)} required
                          className="w-full h-8 px-2 text-xs rounded-lg border bg-background outline-none">
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 w-28">
                        <input type="number" step="any" value={line.debit || ""} onChange={e => updateLine(idx, "debit", parseFloat(e.target.value) || 0)}
                          className="w-full h-8 px-2 text-xs text-right rounded-lg border bg-background font-semibold" placeholder="0.00" />
                      </td>
                      <td className="p-2 w-28">
                        <input type="number" step="any" value={line.credit || ""} onChange={e => updateLine(idx, "credit", parseFloat(e.target.value) || 0)}
                          className="w-full h-8 px-2 text-xs text-right rounded-lg border bg-background font-semibold" placeholder="0.00" />
                      </td>
                      <td className="p-2">
                        <input value={line.description} onChange={e => updateLine(idx, "description", e.target.value)}
                          className="w-full h-8 px-2 text-xs rounded-lg border bg-background" placeholder="Line description..." />
                      </td>
                      <td className="p-2 text-center w-12">
                        <button type="button" onClick={() => handleRemoveLine(idx)} disabled={lines.length <= 2}
                          className="p-1 hover:bg-red-500/10 text-red-400 rounded transition-colors disabled:opacity-30">
                          <X className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center p-3 bg-muted/20 border border-border/50 rounded-xl text-xs font-semibold">
              <div className="flex gap-4">
                <span>Total Debits: <span className="text-emerald-500">{fmt(totalDebits)}</span></span>
                <span>Total Credits: <span className="text-red-400">{fmt(totalCredits)}</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                {outOfBalance ? (
                  <span className="text-red-400 flex items-center gap-1"><AlertCircle className="size-3.5" /> Out of Balance</span>
                ) : (
                  <span className="text-emerald-500 flex items-center gap-1"><Check className="size-3.5" /> Balanced</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving || outOfBalance} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Post Entry
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Chart of Accounts ─────────────────────────────────────────────────────
function ChartOfAccountsTab() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountingApi.listAccounts({ page, page_size: 50, search: search || undefined, account_type: typeFilter || undefined });
      setAccounts(res.items);
      setTotal(res.total);
    } catch {
      toast.error("Failed to load chart of accounts");
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">All GL accounts organized by type. {total} total accounts.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> Add Account
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search accounts..."
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          <option value="">All Types</option>
          <option value="asset">Asset</option>
          <option value="liability">Liability</option>
          <option value="equity">Equity</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <button onClick={load} className="p-2 border border-border rounded-lg hover:bg-muted/50 transition-colors">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border/70 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <AlertCircle className="size-8 mb-2" />
            <p className="text-sm">No accounts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Account Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Sub-Type</th>
                  <th className="px-4 py-3 text-right font-bold">Opening Balance</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 font-medium">
                {accounts.map((acc, i) => (
                  <React.Fragment key={acc.id}>
                    <motion.tr initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
                      className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">{acc.code}</td>
                      <td className="px-4 py-3 font-bold text-foreground">{acc.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize border ${ACCOUNT_TYPE_COLORS[acc.account_type] || "text-muted-foreground bg-muted border-border/40"}`}>
                          {acc.account_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{(acc.account_sub_type || "—").replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(acc.opening_balance)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${acc.is_active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground border-border/40"}`}>
                          {acc.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setSelectedAccount(acc)} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs font-semibold inline-flex items-center gap-1">
                          <Eye className="size-3" /> View
                        </button>
                      </td>
                    </motion.tr>
                    {selectedAccount && selectedAccount.id === acc.id && (
                      <motion.tr key={`detail-${acc.id}`}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="bg-primary/5 border-b border-border/50">
                        <td colSpan={7} className="px-5 py-0">
                            <div className="py-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-foreground text-sm">Account Details</h4>
                                <button onClick={() => setSelectedAccount(null)} className="text-muted-foreground hover:text-foreground text-xs">Close</button>
                              </div>
                              <div className="grid grid-cols-4 gap-4">
                                <div>
                                  <p className="text-xs text-muted-foreground">Account Code</p>
                                  <p className="text-sm font-mono text-primary font-semibold">{selectedAccount.code}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Account Name</p>
                                  <p className="text-sm font-semibold text-foreground">{selectedAccount.name}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Type / Sub-type</p>
                                  <p className="text-sm text-foreground capitalize">{selectedAccount.account_type} / {(selectedAccount.account_sub_type || "—").replace(/_/g, " ")}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Opening Balance</p>
                                  <p className="text-sm font-bold text-foreground">{fmt(selectedAccount.opening_balance)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Status</p>
                                  <p className={`text-sm font-semibold ${selectedAccount.is_active ? "text-emerald-500" : "text-muted-foreground"}`}>
                                    {selectedAccount.is_active ? "Active" : "Inactive"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Allow Posting</p>
                                  <p className="text-sm text-foreground">{selectedAccount.allow_posting ? "Yes" : "No"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Currency</p>
                                  <p className="text-sm text-foreground">{selectedAccount.currency_code || "INR"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Sort Order</p>
                                  <p className="text-sm text-foreground">{selectedAccount.sort_order}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Control Account</p>
                                  <p className="text-sm text-foreground">{selectedAccount.is_control_account ? "Yes" : "No"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Parent Account</p>
                                  <p className="text-sm text-foreground">{selectedAccount.parent_id || "None"}</p>
                                </div>
                                {selectedAccount.description && (
                                  <div className="col-span-2">
                                    <p className="text-xs text-muted-foreground">Description</p>
                                    <p className="text-sm text-foreground">{selectedAccount.description}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <AccountFormModal onClose={() => setShowAddModal(false)} onSaved={load} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Journal Entries ────────────────────────────────────────────────────────
function JournalEntriesTab({ filterClosing = false }: { filterClosing?: boolean }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const handleView = async (id: string) => {
    setViewLoading(true);
    try {
      const entry = await accountingApi.getJournalEntry(id);
      setViewingEntry(entry);
    } catch {
      toast.error("Failed to load journal entry details");
    } finally {
      setViewLoading(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountingApi.listJournalEntries({ page: 1, page_size: 100, status: statusFilter || undefined, search: search || undefined });
      let items = res.items;
      if (filterClosing) {
        items = items.filter(j => j.description?.toLowerCase().includes("closing") || j.reference?.startsWith("DEP") || j.reference?.startsWith("ADJ"));
      }
      setEntries(items);
      setTotal(res.total);

      // Load accounts for form dropdowns
      const accRes = await accountingApi.listAccounts({ page: 1, page_size: 200, is_active: true });
      setAccounts(accRes.items);
    } catch {
      toast.error("Failed to load journal entries");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, filterClosing]);

  useEffect(() => { load(); }, [load]);

  const handlePost = async (id: string) => {
    try {
      await accountingApi.postJournalEntry(id);
      toast.success("Journal entry posted successfully!");
      load();
    } catch { toast.error("Failed to post entry"); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{filterClosing ? "Closing Entries" : "Journal Entries"}</h1>
          <p className="text-sm text-muted-foreground">{filterClosing ? "Period-end adjusting and closing entries." : `All manual and system journal postings. ${total} total.`}</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-semibold shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> New Entry
        </button>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries..." className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
          <option value="voided">Voided</option>
        </select>
        <button onClick={load} className="p-2 border border-border rounded-lg hover:bg-muted/50 transition-colors"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      <div className="bg-card rounded-2xl border border-border/70 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><Loader2 className="size-8 animate-spin text-primary" /></div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <AlertCircle className="size-8 mb-2" /><p className="text-sm">No journal entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Entry #</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right font-bold">Debit</th>
                  <th className="px-4 py-3 text-right font-bold">Credit</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 font-medium">
                {entries.map((entry, i) => (
                  <motion.tr key={entry.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
                    className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">{entry.entry_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.entry_date}</td>
                    <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{entry.entry_type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 font-mono text-xs">{entry.reference || "—"}</td>
                    <td className="px-4 py-3 text-foreground max-w-[200px] truncate">{entry.description || "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{entry.total_debit > 0 ? fmt(entry.total_debit) : "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400">{entry.total_credit > 0 ? fmt(entry.total_credit) : "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize border ${statusStyle(entry.status)}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center flex items-center justify-center gap-1">
                      {entry.status === "draft" && (
                        <button onClick={() => handlePost(entry.id)} className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[11px] font-bold hover:bg-primary/20 transition-colors">Post</button>
                      )}
                      <button onClick={() => handleView(entry.id)} className="p-1 hover:bg-muted rounded transition-colors" title="View details"><Eye className="size-3.5 text-muted-foreground" /></button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <JournalEntryFormModal onClose={() => setShowAddModal(false)} onSaved={load} accounts={accounts} />
        )}
        {viewingEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setViewingEntry(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-border/50">
                <h2 className="font-bold text-lg text-foreground">Journal Entry Details</h2>
                <button onClick={() => setViewingEntry(null)} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="size-4" /></button>
              </div>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {viewLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="size-8 animate-spin text-primary" /></div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="text-xs text-muted-foreground">Entry Number</p><p className="font-mono font-semibold text-sm">{viewingEntry.entry_number}</p></div>
                      <div><p className="text-xs text-muted-foreground">Date</p><p className="text-sm font-semibold">{viewingEntry.entry_date}</p></div>
                      <div><p className="text-xs text-muted-foreground">Type</p><p className="text-sm capitalize">{viewingEntry.entry_type.replace(/_/g, " ")}</p></div>
                      <div><p className="text-xs text-muted-foreground">Status</p><span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusStyle(viewingEntry.status)}`}>{viewingEntry.status}</span></div>
                      {viewingEntry.reference && <div><p className="text-xs text-muted-foreground">Reference</p><p className="font-mono text-sm">{viewingEntry.reference}</p></div>}
                      {viewingEntry.description && <div className="col-span-2"><p className="text-xs text-muted-foreground">Description</p><p className="text-sm">{viewingEntry.description}</p></div>}
                    </div>
                    <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
                      <div className="px-4 py-3 bg-muted/20 border-b border-border/50"><h3 className="font-semibold text-sm">Entry Lines</h3></div>
                      <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground bg-muted/10 border-b border-border/50">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">#</th>
                            <th className="px-4 py-2 text-left font-medium">Account</th>
                            <th className="px-4 py-2 text-right font-medium">Debit</th>
                            <th className="px-4 py-2 text-right font-medium">Credit</th>
                            <th className="px-4 py-2 text-left font-medium">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {(viewingEntry.lines || []).map((line, idx) => (
                            <tr key={line.id} className="hover:bg-muted/10 transition-colors">
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{idx + 1}</td>
                              <td className="px-4 py-2.5 font-medium">{line.account_name}{line.account_code ? <span className="text-muted-foreground ml-1 font-mono text-xs">({line.account_code})</span> : ""}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-emerald-500">{line.debit > 0 ? fmt(line.debit) : "—"}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-red-400">{line.credit > 0 ? fmt(line.credit) : "—"}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{line.description || "—"}</td>
                            </tr>
                          ))}
                          {(!viewingEntry.lines || viewingEntry.lines.length === 0) && (
                            <tr><td colSpan={5} className="px-4 py-4 text-center text-xs text-muted-foreground">No line items</td></tr>
                          )}
                        </tbody>
                        <tfoot className="bg-muted/20 font-semibold text-xs border-t border-border/50">
                          <tr>
                            <td colSpan={2} className="px-4 py-3 text-right">Totals</td>
                            <td className="px-4 py-3 text-right text-emerald-500">{fmt(viewingEntry.total_debit)}</td>
                            <td className="px-4 py-3 text-right text-red-400">{fmt(viewingEntry.total_credit)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── General Ledger ──────────────────────────────────────────────────────────
function GeneralLedgerTab() {
  const [glData, setGlData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [accountFilter, setAccountFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  const loadGL = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedAccount) params.account_id = selectedAccount;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const data = await accountingApi.getGeneralLedger(params);
      setGlData(Array.isArray(data) ? data : []);
    } catch {
      setGlData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGL(); }, [selectedAccount, dateFrom, dateTo]);

  const accountOptions = glData.map(a => ({ id: a.account_id, code: a.account_code, name: a.account_name }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">General Ledger</h1><p className="text-sm text-muted-foreground">Detailed transaction-level view of all account postings.</p></div>
      </div>
      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">Account</label>
          <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} className="h-9 px-3 text-sm rounded-lg border bg-background outline-none">
            <option value="">All Accounts</option>
            {accountOptions.map(a => <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">From Date</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 px-3 text-sm rounded-lg border bg-background outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">To Date</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 px-3 text-sm rounded-lg border bg-background outline-none" />
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="size-8 animate-spin text-primary" /></div>
      ) : glData.length === 0 ? (
        <div className="glass-panel rounded-xl border border-border/50 p-8 text-center text-muted-foreground">No ledger entries found.</div>
      ) : (
        <div className="space-y-4">
          {glData.map((acct, idx) => (
            <motion.div key={acct.account_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="bg-card rounded-2xl border border-border/70 shadow-xs overflow-hidden">
              <div className="p-4 bg-muted/30 border-b border-border/60 flex justify-between items-center">
                <div>
                  <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold mr-2">[{acct.account_code}]</span>
                  <span className="font-bold text-foreground">{acct.account_name}</span>
                  <span className="text-xs text-muted-foreground ml-2 capitalize">({acct.account_type})</span>
                </div>
                <div className="text-xs text-right">
                  <span className="text-muted-foreground">Opening: </span><span className="font-bold text-foreground">{fmt(acct.opening_balance)}</span>
                  <span className="text-muted-foreground ml-3">Closing: </span><span className={`font-bold ${acct.closing_balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{fmt(acct.closing_balance)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[11px] font-bold tracking-wider border-b border-border/60">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Entry #</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right font-bold">Debit</th>
                      <th className="px-4 py-3 text-right font-bold">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 font-medium">
                    {acct.lines?.map((line: any, i: number) => (
                      <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{line.entry_date}</td>
                        <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{line.entry_number}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-muted rounded text-[10px] font-bold capitalize border border-border/40">{line.entry_type}</span></td>
                        <td className="px-4 py-3 text-foreground">{line.description || line.reference || "—"}</td>
                        <td className="px-4 py-3 text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize border ${line.status === "posted" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>{line.status}</span></td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{line.debit > 0 ? fmt(line.debit) : "—"}</td>
                        <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400">{line.credit > 0 ? fmt(line.credit) : "—"}</td>
                      </motion.tr>
                    ))}
                    {(!acct.lines || acct.lines.length === 0) && (
                      <tr><td colSpan={7} className="px-4 py-4 text-xs text-muted-foreground text-center">No transactions in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Opening Balances ────────────────────────────────────────────────────────
function OpeningBalancesTab() {
  const [balances, setBalances] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await accountingApi.getOpeningBalances({ search: search || undefined });
      setBalances(Array.isArray(data) ? data : []);
    } catch {
      setBalances([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  const handleUpdate = async (id: string, field: string, value: number) => {
    setSaving(id);
    try {
      await accountingApi.updateOpeningBalance(id, { opening_balance: value } as { opening_balance: number });
      setBalances(p => p.map(b => b.id === id ? { ...b, opening_balance: value } : b));
      toast.success("Opening balance updated");
    } catch {
      toast.error("Failed to update balance");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Opening Balances</h1><p className="text-sm text-muted-foreground">Set account opening balances at the start of a new fiscal year.</p></div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts..." className="pl-9 pr-4 py-2 h-9 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="size-8 animate-spin text-primary" /></div>
      ) : (
        <div className="bg-card rounded-2xl border border-border/70 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Account Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right font-bold">Opening Balance</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 font-medium">
                {balances.map((b, i) => (
                  <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-indigo-600 dark:text-indigo-400 font-bold text-xs">{b.code}</td>
                    <td className="px-4 py-3 font-bold text-foreground">{b.name}</td>
                    <td className="px-4 py-3"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize border ${ACCOUNT_TYPE_COLORS[b.account_type] || "bg-muted text-muted-foreground border-border/40"}`}>{b.account_type}</span></td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">
                      <EditableCell value={b.opening_balance || 0} onSave={(val) => handleUpdate(b.id, "opening_balance", val)} saving={saving === b.id} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleUpdate(b.id, "opening_balance", 0)} className="text-xs text-muted-foreground hover:text-rose-500 font-semibold transition-colors">Reset</button>
                    </td>
                  </motion.tr>
                ))}
                {balances.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No accounts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function EditableCell({ value, onSave, saving }: { value: number; onSave: (v: number) => void; saving: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value || 0));
  useEffect(() => { setDraft(String(value || 0)); }, [value]);

  const commit = () => {
    const parsed = parseFloat(draft) || 0;
    onSave(parsed);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <input type="number" value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()} autoFocus className="w-28 h-8 px-2 text-sm text-right rounded border bg-background outline-none focus:border-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <span className="font-semibold text-foreground">{fmt(value || 0)}</span>
      <button onClick={() => setEditing(true)} className="p-1 hover:bg-muted/50 rounded transition-colors"><Edit className="size-3 text-muted-foreground" /></button>
      {saving && <Loader2 className="size-3 animate-spin text-primary" />}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export function AccountingCore({ tab = "chart_of_accounts" }: Props) {
    const { currency, formatCurrency } = useCurrency();
  if (tab === "chart_of_accounts") return <ChartOfAccountsTab />;
  if (tab === "journal_entries") return <JournalEntriesTab />;
  if (tab === "closing_entries") return <JournalEntriesTab filterClosing />;
  if (tab === "general_ledger" || tab === "gl_statement") return <GeneralLedgerTab />;
  if (tab === "opening_balances") return <OpeningBalancesTab />;
  return <ChartOfAccountsTab />;
}
