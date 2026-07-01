import { useState } from "react";
import { erpFiscalYears } from "@/data/erp-mock";
import { Button } from "@/components/ui/button";
import { Search, Plus, Calendar, Lock, Unlock, CheckCircle2 } from "lucide-react";

export function FiscalYears() {
  const [search, setSearch] = useState("");

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fiscal Years</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage financial years, accounting periods, and tax rules.</p>
        </div>
        <Button size="sm" className="h-9 gap-2 gradient-brand text-white border-0"><Plus className="size-4" /> Create Fiscal Year</Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Financial Year</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Start Date</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground">End Date</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Status</th>
              <th className="px-6 py-3 text-right font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {erpFiscalYears.filter(f => f.name.includes(search)).map((fy) => (
              <tr key={fy.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-bold flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /> {fy.name}</td>
                <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{fy.start}</td>
                <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{fy.end}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${fy.status === 'Open' ? 'bg-emerald-500/10 text-emerald-600' : fy.status === 'Locked' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                    {fy.status === 'Open' ? <Unlock className="size-3" /> : fy.status === 'Locked' ? <Lock className="size-3" /> : <CheckCircle2 className="size-3" />}
                    {fy.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="outline" size="sm" className="text-xs h-7">Manage</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
