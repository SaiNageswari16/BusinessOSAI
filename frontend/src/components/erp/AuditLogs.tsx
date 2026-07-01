import { useState } from "react";
import { erpAuditLogs } from "@/data/erp-mock";
import { Button } from "@/components/ui/button";
import { Search, Filter, History, Download, ArrowRight } from "lucide-react";

export function AuditLogs() {
  const [search, setSearch] = useState("");

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><History className="size-6 text-primary" /> Audit Logs</h2>
          <p className="text-muted-foreground text-sm mt-1">Enterprise-grade tracking of system modifications for compliance.</p>
        </div>
        <Button variant="outline" size="sm" className="h-9 gap-2"><Download className="size-4" /> Export CSV</Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20" 
            placeholder="Search by user, module, or IP..." 
          />
        </div>
        <Button variant="outline" className="h-10 gap-2"><Filter className="size-4" /> Filters</Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Timestamp</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground">User & Device</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Module</th>
              <th className="px-6 py-3 text-left font-semibold text-muted-foreground">Change Details</th>
              <th className="px-6 py-3 text-right font-semibold text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {erpAuditLogs.filter(a => a.user.toLowerCase().includes(search.toLowerCase()) || a.module.toLowerCase().includes(search.toLowerCase())).slice(0, 12).map((log) => (
              <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-mono text-xs">{log.date}</div>
                  <div className="text-[10px] text-muted-foreground">{log.time}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-foreground">{log.user}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{log.ip} • {log.browser}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                    {log.module}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs font-semibold mb-1">{log.action}</div>
                  {log.action === 'Updated' && (
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/50 p-1.5 rounded-md inline-flex">
                      <span className="text-rose-500 line-through">{log.oldValue}</span>
                      <ArrowRight className="size-3" />
                      <span className="text-emerald-500">{log.newValue}</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600">
                    {log.status}
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
