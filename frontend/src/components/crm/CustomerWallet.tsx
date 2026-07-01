import React from "react";
import { motion } from "framer-motion";
import { Wallet, ArrowDownRight, ArrowUpRight, Plus, Download, Search, CreditCard, History, Coins } from "lucide-react";

import { useCrmData } from "@/hooks/useCrmData";

interface Props {
  tab?: string;
}

export function CustomerWallet({ tab = "store_credit" }: Props) {
  const { mockWalletTransactions } = useCrmData();
  const transactions = mockWalletTransactions;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Wallets</h1>
          <p className="text-sm text-muted-foreground">Manage prepaid balances, store credit, and wallet transactions.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors">
            <Download className="size-4" /> Export Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 gradient-brand text-white rounded-lg text-sm font-medium shadow-elegant hover:opacity-90 transition-opacity">
            <Plus className="size-4" /> Add Funds
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-xl border border-border/50 bg-gradient-to-br from-primary/10 to-transparent relative overflow-hidden">
          <Wallet className="absolute -right-4 -bottom-4 size-32 text-primary/10" />
          <p className="text-sm font-medium text-muted-foreground mb-2">Total Wallet Liabilities</p>
          <h2 className="text-3xl font-bold text-foreground mb-4">$1,452,890.00</h2>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md">
              <ArrowUpRight className="size-3.5" /> +$45k this week
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600">
              <CreditCard className="size-5" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Recharges (30d)</p>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">$345,000.00</h2>
          <p className="text-xs text-muted-foreground">Across 1,240 transactions</p>
        </div>

        <div className="glass-panel p-6 rounded-xl border border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600">
              <Coins className="size-5" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Wallet Payments (30d)</p>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">$280,450.00</h2>
          <p className="text-xs text-muted-foreground">Across 3,450 orders</p>
        </div>
      </div>

      <div className="glass-panel rounded-xl border border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="font-semibold flex items-center gap-2"><History className="size-4" /> Recent Transactions</h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input type="text" placeholder="Search transactions..." className="w-full pl-9 pr-4 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border/50">
              <tr>
                <th className="px-6 py-3">Transaction ID</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Method</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {transactions.map((tx, i) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={tx.id} 
                  className="hover:bg-muted/50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium">{tx.id}</td>
                  <td className="px-6 py-4">{tx.customer}</td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1 w-fit px-2 py-1 rounded-md text-xs font-medium ${
                      tx.type === 'Recharge' || tx.type === 'Refund' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {tx.type === 'Recharge' || tx.type === 'Refund' ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                      {tx.type}
                    </span>
                  </td>
                  <td className={`px-6 py-4 font-semibold ${tx.amount > 0 ? 'text-emerald-600' : ''}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{tx.date}</td>
                  <td className="px-6 py-4 text-muted-foreground">{tx.method}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      tx.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {tx.status}
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
