import { useState, useEffect, useCallback } from "react";
import { approvalWorkflowsApi, ApprovalWorkflow } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Search, Filter, Plus, GitMerge, ChevronRight, Edit2, Trash2, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

const MODULES = ["Purchase", "HR", "Finance", "Sales", "Inventory", "General"];

function WorkflowDialog({
  open, onClose, initial, onSaved,
}: { open: boolean; onClose: () => void; initial?: ApprovalWorkflow; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [module, setModule] = useState(initial?.module ?? "General");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? ""); setModule(initial?.module ?? "General");
      setDescription(initial?.description ?? ""); setIsActive(initial?.is_active ?? true);
      setError("");
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true); setError("");
    try {
      const data = { name, module, description: description || null, is_active: isActive, status: "active" };
      if (initial) await approvalWorkflowsApi.update(initial.id, data);
      else await approvalWorkflowsApi.create(data);
      onSaved(); onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-lg font-bold mb-4">{initial ? "Edit" : "Create"} Approval Workflow</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Purchase Order Approval" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Module</label>
            <select value={module} onChange={e => setModule(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
              {MODULES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Optional description..." className="w-full px-3 py-2 text-sm rounded-md border bg-background resize-none" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="wf-active" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="h-4 w-4 rounded" />
            <label htmlFor="wf-active" className="text-sm">Active</label>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 gradient-brand text-white border-0" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : (initial ? "Update" : "Create")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function ApprovalWorkflows() {
    const { currency, formatCurrency } = useCurrency();
  const [items, setItems] = useState<ApprovalWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovalWorkflow | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await approvalWorkflowsApi.list(page, 20, search || undefined, moduleFilter || undefined);
      setItems(res.items); setTotal(res.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally { setLoading(false); }
  }, [page, search, moduleFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workflow?")) return;
    setDeleting(id);
    try { await approvalWorkflowsApi.delete(id); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleting(null); }
  };

  const STATUS_COLORS: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600",
    inactive: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold tracking-tight">Approval Workflows</h2>
          <p className="text-xs text-muted-foreground">Multi-level hierarchical approvals and escalations. <span className="font-medium text-primary">{total} total</span></p>
        </div>
        <Button size="sm" className="h-8 gradient-brand text-white border-0 text-xs font-semibold" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
          <Plus className="size-3.5 mr-1.5" /> Create Workflow
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
            placeholder="Search workflows..." />
        </div>
        <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1); }}
          className="h-10 px-3 text-sm rounded-lg border bg-card">
          <option value="">All Modules</option>
          {MODULES.map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
      {error && <div className="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.length === 0 ? (
            <div className="col-span-2 text-center py-16 text-muted-foreground">
              <GitMerge className="size-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No workflows found</p>
              <p className="text-sm">Create your first approval workflow to get started.</p>
            </div>
          ) : items.map(wf => (
            <Card key={wf.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <GitMerge className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{wf.name}</h3>
                    <p className="text-xs text-muted-foreground">Module: {wf.module}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[wf.status] || STATUS_COLORS.inactive}`}>
                    {wf.is_active ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
                    {wf.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {wf.description && <p className="text-sm text-muted-foreground mb-4">{wf.description}</p>}

              <div className="bg-muted/30 p-3 rounded-lg border mb-4">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">
                  {(wf.steps?.length ?? 0)} Approval Step{(wf.steps?.length ?? 0) !== 1 ? "s" : ""}
                </div>
                {(!wf.steps || wf.steps.length === 0) ? (
                  <p className="text-xs text-muted-foreground italic">No steps configured yet</p>
                ) : (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {wf.steps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 shrink-0">
                        <div className="px-3 py-1.5 bg-background border rounded text-xs font-medium">
                          Step {idx + 1}
                        </div>
                        {idx < (wf.steps?.length ?? 0) - 1 && <ChevronRight className="size-4 text-muted-foreground" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditing(wf); setDialogOpen(true); }}>
                  <Edit2 className="size-3.5 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700"
                  onClick={() => handleDelete(wf.id)} disabled={deleting === wf.id}>
                  {deleting === wf.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page}</span>
          <Button variant="outline" size="sm" disabled={items.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      <WorkflowDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} onSaved={load} />
    </div>
  );
}
