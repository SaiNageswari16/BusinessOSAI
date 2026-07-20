import { posCustomers } from "../../lib/pos-fallback";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Search, Users, Trophy, Mail, Phone } from "lucide-react";

export function PosCustomers() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">POS Customers</h2>
          <p className="text-sm text-muted-foreground">Manage your retail customer database and view lifetime value.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Customer</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Contact</th>
              <th className="px-6 py-4">Loyalty Tier</th>
              <th className="px-6 py-4">Total Spent</th>
              <th className="px-6 py-4">Last Visit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {posCustomers.map((cust) => (
              <tr key={cust.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-bold flex items-center gap-2"><Users className="size-4 text-primary" /> {cust.name}</td>
                <td className="px-6 py-4">
                  <div className="text-xs font-mono flex items-center gap-1.5"><Phone className="size-3 text-muted-foreground" /> {cust.phone}</div>
                  <div className="text-xs font-mono flex items-center gap-1.5 mt-1"><Mail className="size-3 text-muted-foreground" /> {cust.email}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${cust.tier === 'Gold' ? 'bg-amber-500/10 text-amber-600' : cust.tier === 'Silver' ? 'bg-slate-400/10 text-slate-500' : 'bg-orange-700/10 text-orange-800'
                    }`}>
                    <Trophy className="size-3" /> {cust.tier} ({cust.points} pts)
                  </span>
                </td>
                <td className="px-6 py-4 font-bold text-emerald-600">{cust.totalSpent}</td>
                <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{cust.lastVisit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
