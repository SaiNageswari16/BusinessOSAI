import React, { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Minus,
  RotateCw,
  Search,
  CreditCard,
  History,
  X,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { crmWalletApi, crmCustomersApi, type CrmCustomer, type WalletTransaction } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

type TxType = "credit" | "debit" | "adjust";

const blankTx = { amount: 0, description: "", reference_id: "" };

export function CustomerWallet() {
    const { currency, formatCurrency } = useCurrency();
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState<TxType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>(blankTx);
  const [balance, setBalance] = useState<number>(0);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await crmCustomersApi.list(1, 200);
      setCustomers(response.items);
    } catch {
      toast.error("Could not load customers");
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (customerId: string) => {
    setLoading(true);
    try {
      const response = await crmWalletApi.listTransactions(customerId, 1, 100);
      setTransactions(response.items);
      setTotal(response.total);
    } catch {
      toast.error("Could not load transactions");
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async (customerId: string) => {
    try {
      const res = await crmWalletApi.getBalance(customerId);
      setBalance(res.balance);
    } catch {
      setBalance(0);
    }
  };

  useEffect(() => { void loadCustomers(); }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      void loadTransactions(selectedCustomerId);
      void loadBalance(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term)
    );
  }, [customers, customerSearch]);

  const stats = useMemo(() => {
    const totalCredit = transactions
      .filter((t) => t.transaction_type === "credit")
      .reduce((s, t) => s + t.amount, 0);
    const totalDebit = transactions
      .filter((t) => t.transaction_type === "debit")
      .reduce((s, t) => s + t.amount, 0);
    return { totalCredit, totalDebit, txCount: transactions.length };
  }, [transactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showForm || !selectedCustomerId) return;
    setSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomerId,
        amount: Number(form.amount),
        description: form.description as string,
        reference_id: (form.reference_id as string) || undefined,
      };
      let result: WalletTransaction;
      if (showForm === "credit") result = await crmWalletApi.credit(selectedCustomerId, payload.amount, payload.description, payload.reference_id);
      else if (showForm === "debit") result = await crmWalletApi.debit(selectedCustomerId, payload.amount, payload.description, payload.reference_id);
      else result = await crmWalletApi.adjust(selectedCustomerId, payload.amount, payload.description);
      setTransactions((curr) => [result, ...curr]);
      await loadBalance(selectedCustomerId);
      setShowForm(null);
      setForm(blankTx);
      toast.success(`${showForm.charAt(0).toUpperCase() + showForm.slice(1)} successful`);
    } catch {
      toast.error(`Could not ${showForm} wallet`);
    } finally {
      setSaving(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Customer Wallet</h2>
          <p className="text-xs text-muted-foreground">
            Manage stored-value wallet balances for your customers. Credit, debit, or adjust balances.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Selected Balance" value={`₹${balance.toLocaleString()}`} icon={<Wallet className="size-5" />} />
        <StatCard label="Total Credit" value={`₹${stats.totalCredit.toLocaleString()}`} icon={<ArrowUpRight className="size-5" />} />
        <StatCard label="Total Debit" value={`₹${stats.totalDebit.toLocaleString()}`} icon={<ArrowDownRight className="size-5" />} />
        <StatCard label="Transactions" value={stats.txCount} icon={<History className="size-5" />} />
      </div>

      {/* Customer Selector */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <label className="block text-sm font-medium">Select Customer</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="Search customers by name, email, phone…"
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
          {filteredCustomers.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCustomerId(c.id)}
              className={cn("text-left p-3 rounded-lg border transition-colors",
                selectedCustomerId === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50")}
            >
              <p className="font-medium text-sm">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.email || c.phone}</p>
              <p className="text-xs text-primary mt-1">Balance: {currency.symbol}{(c.wallet_balance ?? 0).toLocaleString()}</p>
            </button>
          ))}
          {filteredCustomers.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-4">No customers found.</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {selectedCustomerId && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setShowForm("credit"); setForm(blankTx); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-500/20">
            <Plus className="size-4" /> Credit
          </button>
          <button onClick={() => { setShowForm("debit"); setForm(blankTx); }}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-600 rounded-lg text-sm font-medium hover:bg-red-500/20">
            <Minus className="size-4" /> Debit
          </button>
          <button onClick={() => { setShowForm("adjust"); setForm(blankTx); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-500/20">
            <RotateCw className="size-4" /> Adjust Balance
          </button>
        </div>
      )}

      {/* Transaction Form */}
      {showForm && selectedCustomer && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              {showForm === "credit" && <ArrowUpRight className="size-5 text-emerald-500" />}
              {showForm === "debit" && <ArrowDownRight className="size-5 text-red-500" />}
              {showForm === "adjust" && <RotateCw className="size-5 text-blue-500" />}
              {showForm.charAt(0).toUpperCase() + showForm.slice(1)} Wallet for {selectedCustomer.name}
            </h3>
            <button type="button" onClick={() => setShowForm(null)}>
              <X className="size-5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Amount ({currency.symbol}) *</label>
              <input type="number" required min={0.01} step={0.01}
                value={String(form.amount)}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
              {showForm === "adjust" && (
                <p className="text-xs text-muted-foreground mt-1">Use negative amount to deduct.</p>
              )}
              {showForm === "debit" && (
                <p className="text-xs text-muted-foreground mt-1">Available balance: {currency.symbol}{balance.toLocaleString()}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Reference ID (optional)</label>
              <input value={form.reference_id as string}
                onChange={(e) => setForm({ ...form, reference_id: e.target.value })}
                className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Description *</label>
              <textarea required value={form.description as string}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-border bg-background/80 px-3 py-2 text-sm" rows={2}
                placeholder={showForm === "credit" ? "Reason for credit (e.g. Refund, Promo)" : showForm === "debit" ? "Reason for debit (e.g. Order payment)" : "Reason for adjustment"} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(null)} className="px-4 py-2 text-sm border border-border rounded-lg">Cancel</button>
            <button disabled={saving} className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground font-medium">
              {saving ? "Saving…" : `Apply ${showForm}`}
            </button>
          </div>
        </form>
      )}

      {/* Transactions Table */}
      {selectedCustomerId && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="font-semibold">Transaction History</h3>
            <p className="text-xs text-muted-foreground">All wallet activity for {selectedCustomer?.name}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-left px-4 py-3 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 font-medium">Balance After</th>
                  <th className="text-left px-4 py-3 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No transactions yet.</td></tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(tx.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
                          tx.transaction_type === "credit" && "bg-emerald-500/10 text-emerald-600",
                          tx.transaction_type === "debit" && "bg-red-500/10 text-red-600",
                          tx.transaction_type === "adjust" && "bg-blue-500/10 text-blue-600")}>
                          {tx.transaction_type === "credit" ? <ArrowUpRight className="size-3" /> : tx.transaction_type === "debit" ? <ArrowDownRight className="size-3" /> : <RotateCw className="size-3" />}
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{tx.description}</td>
                      <td className="px-4 py-3 font-medium">
                        {tx.transaction_type === "credit" ? "+" : tx.transaction_type === "debit" ? "−" : "±"}
                        {currency.symbol}{tx.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{currency.symbol}{tx.balance_after.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{tx.reference_id || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            Showing {transactions.length} of {total} transactions
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="glass-panel p-5 rounded-xl border border-border/50">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold flex gap-2 items-center"><span className="text-primary">{icon}</span>{value}</p>
    </div>
  );
}