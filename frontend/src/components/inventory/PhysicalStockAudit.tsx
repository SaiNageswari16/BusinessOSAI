import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, ClipboardCheck, ArrowRight, CheckCircle2, PlayCircle, Loader2, Trash2 } from "lucide-react";
import { inventoryApi, CycleCount as CycleCountType } from "../../lib/api-client";

export function PhysicalStockAudit() {
  const [audits, setAudits] = useState<CycleCountType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAudits = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getCycleCounts();
      setAudits(res);
    } catch (error) {
      console.error("Failed to fetch Audits:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudits();
  }, []);

  const handleCreate = async () => {
    const count_number = window.prompt("Enter Audit Reference (e.g. AUD-2026-Q4):");
    if (!count_number) return;
    const location = window.prompt("Enter Location (e.g. Mumbai Central Hub):");
    const auditor = window.prompt("Enter Lead Auditor Name:");
    
    try {
      await inventoryApi.createCycleCount({
        count_number,
        location,
        auditor,
        notes: "Full Physical Audit"
      });
      fetchAudits();
    } catch (error) {
      console.error("Failed to schedule Audit:", error);
      alert("Failed to schedule. Ensure valid input and permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this Audit?")) return;
    try {
      await inventoryApi.deleteCycleCount(id);
      fetchAudits();
    } catch (error) {
      console.error("Failed to cancel Audit:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Physical Stock Audit</h2>
          <p className="text-sm text-muted-foreground">Manage wall-to-wall physical inventory counts and variance.</p>
        </div>
        <Button onClick={handleCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Schedule Audit</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
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
            {audits.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  No Audits Scheduled.
                </td>
              </tr>
            )}
            {audits.map((audit) => (
              <tr key={audit.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold">Physical Audit</div>
                  <div className="font-mono text-xs text-primary font-medium">{audit.count_number}</div>
                </td>
                <td className="px-6 py-4 font-medium">{audit.location || 'All'}</td>
                <td className="px-6 py-4 font-mono text-xs">-</td>
                <td className="px-6 py-4">
                  <span className="font-mono font-bold text-muted-foreground">-</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    audit.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
                  }`}>
                    {audit.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  {audit.status === 'Completed' ? (
                    <Button variant="ghost" size="sm" className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="size-4 mr-2" /> Report</Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary"><PlayCircle className="size-4 mr-2" /> Start Count</Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(audit.id)} className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10">
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
