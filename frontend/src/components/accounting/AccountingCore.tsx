import React from "react";
import { motion } from "framer-motion";
import { Plus, Search, Filter, ArrowRight, CheckCircle, Clock } from "lucide-react";
import { useAccountingData } from "@/hooks/useAccountingData";

interface Props { tab?: string; }

export function AccountingCore({ tab = "chart_of_accounts" }: Props) {
  const { mockAccounts, mockJournalEntries } = useAccountingData();

  if (tab === "journal_entries" || tab === "closing_entries") {
    const filtered = tab === "closing_entries"
      ? mockJournalEntries.filter(j => j.description.toLowerCase().includes("closing") || j.reference.startsWith("DEP") || j.reference.startsWith("ADJ"))
      : mockJournalEntries;
    const title = tab === "closing_entries" ? "Closing Entries" : "Journal Entries";
    const subtitle = tab === "closing_entries" ? "Period-end adjusting and closing journal entries." : "All manual and system-generated journal postings.";
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">{title}</h1><p className="text-sm text-muted-foreground">{subtitle}</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> New Entry
          </button>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Entry ID</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Reference</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 font-medium">Account</th>
                  <th className="px-6 py-4 font-medium text-right">Debit</th>
                  <th className="px-6 py-4 font-medium text-right">Credit</th>
                  <th className="px-6 py-4 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {(filtered.length > 0 ? filtered : mockJournalEntries).map((entry, i) => (
                  <motion.tr key={entry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{entry.id}</td>
                    <td className="px-6 py-4 text-muted-foreground">{entry.date}</td>
                    <td className="px-6 py-4 text-primary font-mono text-xs">{entry.reference}</td>
                    <td className="px-6 py-4 text-foreground max-w-[220px] truncate">{entry.description}</td>
                    <td className="px-6 py-4 text-muted-foreground">{entry.account}</td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-500">{entry.debit > 0 ? `$${entry.debit.toLocaleString()}` : "—"}</td>
                    <td className="px-6 py-4 text-right font-medium text-red-400">{entry.credit > 0 ? `$${entry.credit.toLocaleString()}` : "—"}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${entry.status === "Posted" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                        {entry.status === "Posted" ? <CheckCircle className="size-3" /> : <Clock className="size-3" />}{entry.status}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "opening_balances") {
    const openingBalances = mockAccounts.map(a => ({
      ...a,
      openingBalance: Math.round(a.balance * 0.82 * 100) / 100,
      asOfDate: "2026-01-01"
    }));
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Opening Balances</h1><p className="text-sm text-muted-foreground">Opening balances as of January 1, 2026.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Set Balance
          </button>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-amber-600">
          ⚠ Opening balances are locked after the first transaction is posted. Contact your accountant to make changes.
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Account Code</th>
                  <th className="px-6 py-4 font-medium">Account Name</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium text-center">As Of Date</th>
                  <th className="px-6 py-4 font-medium text-right">Opening Balance</th>
                </tr>
              </thead>
              <tbody>
                {openingBalances.map((acc, i) => (
                  <motion.tr key={acc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-primary font-medium">{acc.code}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{acc.name}</td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-secondary/50 rounded-md text-xs">{acc.type}</span></td>
                    <td className="px-6 py-4 text-center text-muted-foreground">{acc.asOfDate}</td>
                    <td className="px-6 py-4 text-right font-medium">${acc.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "general_ledger") {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">General Ledger</h1><p className="text-sm text-muted-foreground">All ledger postings by account.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> New Entry
          </button>
        </div>
        <div className="space-y-4">
          {mockAccounts.slice(0, 5).map((acct, ai) => {
            const entries = mockJournalEntries.filter(j => j.account === acct.name);
            if (entries.length === 0 && ai > 2) return null;
            return (
              <motion.div key={acct.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ai * 0.1 }}
                className="glass-panel rounded-xl border border-border/50 overflow-hidden">
                <div className="px-6 py-4 bg-muted/20 border-b border-border/50 flex justify-between items-center">
                  <div><span className="font-mono text-xs text-primary mr-3">{acct.code}</span><span className="font-semibold text-foreground">{acct.name}</span></div>
                  <span className="text-sm font-bold text-foreground">Balance: ${acct.balance.toLocaleString()}</span>
                </div>
                {entries.length > 0 ? (
                  <div className="divide-y divide-border/30">
                    {entries.map(entry => (
                      <div key={entry.id} className="flex justify-between items-center px-6 py-3 text-sm hover:bg-muted/10">
                        <div><p className="font-medium text-foreground">{entry.description}</p><p className="text-xs text-muted-foreground">{entry.date} · {entry.reference}</p></div>
                        <div className="text-right">
                          {entry.debit > 0 && <p className="font-medium text-emerald-500">DR ${entry.debit.toLocaleString()}</p>}
                          {entry.credit > 0 && <p className="font-medium text-red-400">CR ${entry.credit.toLocaleString()}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-6 py-3 text-sm text-muted-foreground">No recent transactions</div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // Default: chart_of_accounts
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-foreground">Chart of Accounts</h1><p className="text-sm text-muted-foreground">All GL accounts organized by type.</p></div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> Add Account
        </button>
      </div>
      <div className="flex gap-3 glass-panel p-4 rounded-xl border border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input type="text" placeholder="Search accounts..." className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-primary/50 transition-colors" />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-background border border-border/50 rounded-lg text-sm hover:bg-muted transition-colors">
          <Filter className="size-4" /> Filter by Type
        </button>
      </div>
      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Code</th>
                <th className="px-6 py-4 font-medium">Account Name</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 text-right font-medium">Balance</th>
                <th className="px-6 py-4 text-center font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {mockAccounts.map((acc, i) => (
                <motion.tr key={acc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-mono font-semibold text-primary">{acc.code}</td>
                  <td className="px-6 py-4 font-medium text-foreground">{acc.name}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-secondary/50 text-secondary-foreground rounded-md text-xs font-medium">{acc.type}</span></td>
                  <td className="px-6 py-4 text-right font-medium">${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${acc.status === "Active" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>{acc.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-primary hover:underline text-sm inline-flex items-center gap-1">View <ArrowRight className="size-3" /></button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
