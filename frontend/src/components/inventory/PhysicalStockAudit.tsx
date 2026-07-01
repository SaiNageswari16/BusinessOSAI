import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, ClipboardCheck, ArrowRight, CheckCircle2, PlayCircle } from "lucide-react";

export function PhysicalStockAudit() {
  const data = [
    { id: 1, ref: "AUD-2026-Q2", title: "Q2 Full Physical Audit", location: "Mumbai Central Hub", date: "2026-06-30", variance: "₹12,450", status: "Completed" },
    { id: 2, ref: "AUD-2026-Q3", title: "Q3 Full Physical Audit", location: "Delhi Cold Storage", date: "2026-09-30", variance: "-", status: "Scheduled" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Physical Stock Audit</h2>
          <p className="text-sm text-muted-foreground">Manage wall-to-wall physical inventory counts and variance.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Schedule Audit</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Audit Reference & Title</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Scheduled Date</th>
              <th className="px-6 py-4">Variance Value</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((audit) => (
              <tr key={audit.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold">{audit.title}</div>
                  <div className="font-mono text-xs text-primary font-medium">{audit.ref}</div>
                </td>
                <td className="px-6 py-4 font-medium">{audit.location}</td>
                <td className="px-6 py-4 font-mono text-xs">{audit.date}</td>
                <td className="px-6 py-4">
                  <span className={`font-mono font-bold ${audit.variance !== '-' ? 'text-rose-500' : 'text-muted-foreground'}`}>{audit.variance}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    audit.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
                  }`}>
                    {audit.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {audit.status === 'Completed' ? (
                    <Button variant="ghost" size="sm" className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="size-4 mr-2" /> Report</Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary"><PlayCircle className="size-4 mr-2" /> Start Count</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
