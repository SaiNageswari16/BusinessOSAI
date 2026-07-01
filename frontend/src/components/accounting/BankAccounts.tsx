import React from "react";
import { motion } from "framer-motion";
import { Plus, RefreshCw, CheckCircle, Clock, FileText, Search } from "lucide-react";
import { useAccountingData } from "@/hooks/useAccountingData";

interface Props { tab?: string; }

export function BankAccounts({ tab = "dashboard" }: Props) {
  const { mockBankAccounts } = useAccountingData();

  if (tab === "reconciliation") {
    const items = [
      { date: "2026-06-30", description: "Payroll Transfer", bankAmount: -85000, ledgerAmount: -85000, matched: true },
      { date: "2026-06-29", description: "Customer Payment – TechNova", bankAmount: 4000, ledgerAmount: 4000, matched: true },
      { date: "2026-06-28", description: "Supplier Payment – Metro Logistics", bankAmount: -4200, ledgerAmount: -4200, matched: true },
      { date: "2026-06-27", description: "POS Daily Sales", bankAmount: 42000, ledgerAmount: 42000, matched: true },
      { date: "2026-06-26", description: "Bank Charge – Annual Fee", bankAmount: -250, ledgerAmount: 0, matched: false },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Bank Reconciliation</h1><p className="text-sm text-muted-foreground">Match bank statement lines against your ledger entries.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><RefreshCw className="size-4" /> Reconcile Now</button>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-border/50 flex gap-6 text-sm">
          <div><p className="text-muted-foreground text-xs">Account</p><p className="font-semibold">Primary Operations · ****4521</p></div>
          <div><p className="text-muted-foreground text-xs">Statement Date</p><p className="font-semibold">June 30, 2026</p></div>
          <div><p className="text-muted-foreground text-xs">Bank Balance</p><p className="font-semibold text-emerald-500">$1,250,000.50</p></div>
          <div><p className="text-muted-foreground text-xs">Ledger Balance</p><p className="font-semibold text-emerald-500">$1,250,250.50</p></div>
          <div><p className="text-muted-foreground text-xs">Difference</p><p className="font-semibold text-red-500">-$250.00</p></div>
        </div>
        <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 text-right font-medium">Bank Amt</th>
                  <th className="px-6 py-4 text-right font-medium">Ledger Amt</th>
                  <th className="px-6 py-4 text-center font-medium">Matched</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 text-muted-foreground">{item.date}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{item.description}</td>
                    <td className={`px-6 py-4 text-right font-medium ${item.bankAmount < 0 ? "text-red-400" : "text-emerald-500"}`}>{item.bankAmount < 0 ? `-$${Math.abs(item.bankAmount).toLocaleString()}` : `$${item.bankAmount.toLocaleString()}`}</td>
                    <td className={`px-6 py-4 text-right font-medium ${item.ledgerAmount < 0 ? "text-red-400" : item.ledgerAmount === 0 ? "text-muted-foreground" : "text-emerald-500"}`}>{item.ledgerAmount !== 0 ? (item.ledgerAmount < 0 ? `-$${Math.abs(item.ledgerAmount).toLocaleString()}` : `$${item.ledgerAmount.toLocaleString()}`) : "—"}</td>
                    <td className="px-6 py-4 text-center">{item.matched ? <span className="inline-flex items-center gap-1 text-emerald-500 text-xs"><CheckCircle className="size-3" /> Matched</span> : <span className="inline-flex items-center gap-1 text-red-500 text-xs"><Clock className="size-3" /> Unmatched</span>}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "bank_statements") {
    const statements = [
      { period: "June 2026", account: "Primary Operations · ****4521", openingBal: 1156320, closingBal: 1250000, debits: 94450, credits: 188130 },
      { period: "May 2026", account: "Primary Operations · ****4521", openingBal: 1050000, closingBal: 1156320, debits: 78000, credits: 184320 },
      { period: "June 2026", account: "Payroll · ****8832", openingBal: 190000, closingBal: 215000, debits: 85000, credits: 110000 },
    ];
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Bank Statements</h1><p className="text-sm text-muted-foreground">Monthly bank statement summaries across all accounts.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium border border-border/50"><FileText className="size-4" /> Download Statement</button>
        </div>
        <div className="space-y-4">
          {statements.map((stmt, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-panel p-6 rounded-xl border border-border/50">
              <div className="flex justify-between items-start mb-4">
                <div><h3 className="font-semibold text-foreground">{stmt.account}</h3><p className="text-sm text-muted-foreground">{stmt.period}</p></div>
                <button className="text-primary text-sm hover:underline">View Full Statement</button>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div><p className="text-muted-foreground text-xs">Opening Balance</p><p className="font-semibold text-foreground">${stmt.openingBal.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">Total Debits</p><p className="font-semibold text-red-400">-${stmt.debits.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">Total Credits</p><p className="font-semibold text-emerald-500">+${stmt.credits.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground text-xs">Closing Balance</p><p className="font-semibold text-foreground">${stmt.closingBal.toLocaleString()}</p></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "cash_accounts") {
    const cashAccounts = mockBankAccounts.filter(a => a.type === "Cash");
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-foreground">Cash Accounts</h1><p className="text-sm text-muted-foreground">Petty cash and till management across all branches.</p></div>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity"><Plus className="size-4" /> Add Cash Account</button>
        </div>
        {cashAccounts.map((acct, i) => (
          <motion.div key={acct.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-6 rounded-xl border border-border/50">
            <div className="flex justify-between items-start">
              <div><h3 className="font-semibold text-foreground">{acct.name}</h3><p className="text-sm text-muted-foreground">{acct.accountNo}</p></div>
              <p className="text-2xl font-bold text-foreground">${acct.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="mt-4 flex gap-4 text-sm">
              <span className="text-muted-foreground">Last reconciled: <span className="font-medium text-foreground">{acct.lastReconciled}</span></span>
              <button className="text-primary hover:underline">Add Transaction</button>
              <button className="text-primary hover:underline">View Ledger</button>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }
  const typeColor = (type: string) => {
    switch (type) {
      case "Current": return "text-blue-500 bg-blue-500/10";
      case "Savings": return "text-emerald-500 bg-emerald-500/10";
      case "Cash": return "text-amber-500 bg-amber-500/10";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const totalBalance = mockBankAccounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bank Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage all bank and cash accounts with reconciliation.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
          <Plus className="size-4" /> Link Account
        </button>
      </div>

      <div className="glass-panel p-5 rounded-xl border border-primary/30 bg-primary/5">
        <p className="text-sm text-muted-foreground mb-1">Total Cash & Bank Balance</p>
        <p className="text-4xl font-bold text-foreground">${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        <p className="text-xs text-muted-foreground mt-1">Across {mockBankAccounts.length} accounts · As of July 1, 2026</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockBankAccounts.map((acct, i) => (
          <motion.div key={acct.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-panel p-6 rounded-xl border border-border/50 hover:shadow-elegant transition-all duration-300 cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{acct.name}</h3>
                <p className="text-sm text-muted-foreground">{acct.bank || "Cash Account"} · {acct.accountNo}</p>
              </div>
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${typeColor(acct.type)}`}>{acct.type}</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
                <p className="text-2xl font-bold text-foreground">${acct.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Last Reconciled</p>
                <p className="text-sm font-medium text-emerald-500 flex items-center gap-1 justify-end">
                  <CheckCircle className="size-3" /> {acct.lastReconciled}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50 flex gap-2">
              <button className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <RefreshCw className="size-3" /> Reconcile
              </button>
              <button className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-4">View Statements</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
