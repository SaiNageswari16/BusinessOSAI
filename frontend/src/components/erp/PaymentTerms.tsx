import { useState } from "react";
import { erpPaymentTerms } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, CreditCard, Filter, Plus, CalendarClock } from "lucide-react";

export function PaymentTerms() {
  const [search, setSearch] = useState("");
  const filtered = erpPaymentTerms.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payment Terms</h2>
          <p className="text-sm text-muted-foreground">Define default payment schedules and credit limits.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Add Payment Term</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search terms..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Term Name</th>
              <th className="px-6 py-4">Due Days</th>
              <th className="px-6 py-4">Credit Limit</th>
              <th className="px-6 py-4">Late Fee</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((term) => (
              <tr key={term.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-medium flex items-center gap-2">
                  <CalendarClock className="size-4 text-primary" /> 
                  {term.name}
                </td>
                <td className="px-6 py-4 font-medium">{term.days} Days</td>
                <td className="px-6 py-4 font-mono">{term.creditLimit}</td>
                <td className="px-6 py-4">{term.lateFee}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {term.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
