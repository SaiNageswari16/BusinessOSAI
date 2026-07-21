import React, { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, RotateCw, Calendar, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { inventoryApi, CycleCount as CycleCountType } from "../../lib/api-client";

export function CycleCounting() {
  const [counts, setCounts] = useState<CycleCountType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCounts = async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getCycleCounts();
      setCounts(res);
    } catch (error) {
      console.error("Failed to fetch Cycle Counts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const handleCreate = async () => {
    const count_number = window.prompt("Enter Count Number (e.g. CC-001):");
    if (!count_number) return;
    const location = window.prompt("Enter Location to count:");
    const auditor = window.prompt("Enter Auditor Name:");
    
    try {
      await inventoryApi.createCycleCount({
        count_number,
        location,
        auditor,
      });
      fetchCounts();
    } catch (error) {
      console.error("Failed to create Cycle Count:", error);
      alert("Failed to create. Ensure valid input and permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this cycle count?")) return;
    try {
      await inventoryApi.deleteCycleCount(id);
      fetchCounts();
    } catch (error) {
      console.error("Failed to delete Cycle Count:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cycle Counting</h2>
          <p className="text-sm text-muted-foreground">Automate perpetual inventory counting schedules.</p>
        </div>
        <Button onClick={handleCreate} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> New Schedule</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        )}
        {counts.length === 0 && !loading && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            No cycle count schedules found. Create one to get started.
          </div>
        )}
        {counts.map((cycle) => (
          <Card key={cycle.id} className="p-6 border-t-4 border-t-primary">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <RotateCw className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold">{cycle.count_number}</h3>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">{cycle.location || 'All Locations'}</div>
                </div>
              </div>
            </div>

            <div className="bg-muted/40 p-3 rounded-lg border border-dashed mb-4 flex justify-between items-center">
              <div>
                <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1"><Calendar className="size-3" /> Auditor</div>
                <div className="text-sm font-bold mt-1">{cycle.auditor || 'Unassigned'}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground font-semibold">Target Items</div>
                <div className="text-sm font-bold mt-1">{cycle.items?.length || 0}</div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                cycle.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
              }`}>
                <CheckCircle2 className="size-3" /> {cycle.status}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">Manage</Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(cycle.id)} className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
