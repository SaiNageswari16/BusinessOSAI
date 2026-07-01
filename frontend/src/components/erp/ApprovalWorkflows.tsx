import { useState } from "react";
import { erpWorkflows } from "../../data/erp-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, GitMerge, ChevronRight } from "lucide-react";

export function ApprovalWorkflows() {
  const [search, setSearch] = useState("");
  const filtered = erpWorkflows.filter(w => w.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Approval Workflows</h2>
          <p className="text-sm text-muted-foreground">Visual builder for multi-level hierarchical approvals and escalations.</p>
        </div>
        <Button className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Workflow</Button>
      </div>

      <div className="flex gap-4 items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30" 
            placeholder="Search workflows..." 
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((wf) => (
          <Card key={wf.id} className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <GitMerge className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{wf.name}</h3>
                  <p className="text-xs text-muted-foreground">Module: {wf.module}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${wf.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                {wf.status}
              </span>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border">
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-3">{wf.levels} Levels of Approval</div>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {wf.approvers.split(', ').map((approver, idx, arr) => (
                  <div key={idx} className="flex items-center gap-2 shrink-0">
                    <div className="px-3 py-1.5 bg-background border rounded text-xs font-medium text-foreground">
                      {approver}
                    </div>
                    {idx < arr.length - 1 && <ChevronRight className="size-4 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm">Edit Flow</Button>
              <Button variant="outline" size="sm">View Rules</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
