import { useState } from "react";
import { erpErrorLogs } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, AlertTriangle, Bug, TerminalSquare, Eye } from "lucide-react";

export function ErrorLogs() {
  const [search, setSearch] = useState("");
  const filtered = erpErrorLogs.filter(e => e.module.toLowerCase().includes(search.toLowerCase()) || e.message.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Error Logs</h2>
          <p className="text-sm text-muted-foreground">Monitor system exceptions, API failures, and unhandled errors.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100 hover:text-rose-700">Clear Logs</Button>
          <Button className="gradient-brand text-white border-0"><TerminalSquare className="size-4 mr-2" /> Export to CSV</Button>
        </div>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search error messages or modules..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Severity Filter</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Severity</th>
              <th className="px-6 py-4">Module</th>
              <th className="px-6 py-4 w-1/3">Error Message</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono text-xs">{log.date}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    log.severity === 'Critical' ? 'bg-rose-500/10 text-rose-600' : 
                    log.severity === 'High' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'
                  }`}>
                    {log.severity === 'Critical' ? <Bug className="size-3" /> : <AlertTriangle className="size-3" />}
                    {log.severity}
                  </span>
                </td>
                <td className="px-6 py-4 font-semibold">{log.module}</td>
                <td className="px-6 py-4 text-muted-foreground truncate max-w-[300px]">{log.message}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-bold ${log.status === 'Resolved' ? 'text-emerald-500' : 'text-amber-500'}`}>{log.status}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" className="font-medium"><Eye className="size-4 mr-2" /> Stack Trace</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
