import { useState, useEffect, useCallback } from "react";
import { tagsApi, Tag } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Search, Plus, Tag as TagIcon, Edit2, Trash2, Loader2 } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

const ENTITY_TYPES = ["any", "employee", "customer", "supplier", "product", "order"];
const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#64748b",
];

function TagDialog({ open, onClose, initial, onSaved }: {
  open: boolean; onClose: () => void; initial?: Tag; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [entityType, setEntityType] = useState(initial?.entity_type ?? "any");
  const [color, setColor] = useState(initial?.color ?? "#6366f1");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? ""); setEntityType(initial?.entity_type ?? "any");
      setColor(initial?.color ?? "#6366f1"); setDescription(initial?.description ?? "");
      setError("");
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true); setError("");
    try {
      const data = { name, entity_type: entityType, color, description: description || null, status: "active" };
      if (initial) await tagsApi.update(initial.id, data);
      else await tagsApi.create(data);
      onSaved(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-lg font-bold mb-4">{initial ? "Edit" : "Create"} Tag</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Tag Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Priority Customer" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Entity Type</label>
            <select value={entityType} onChange={e => setEntityType(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
              {ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button type="button" key={c} onClick={() => setColor(c)}
                  className={`size-7 rounded-full transition-transform border-2 ${color === c ? "scale-125 border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                className="size-7 rounded-full cursor-pointer border-0 p-0 bg-transparent" title="Custom color" />
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium text-white" style={{ backgroundColor: color }}>
                <TagIcon className="size-3" /> {name || "Preview"}
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..." />
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

export function TagsLabels() {
    const { currency, formatCurrency } = useCurrency();
  const [items, setItems] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tag | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await tagsApi.list(page, 50, search || undefined, entityFilter || undefined);
      setItems(res.items); setTotal(res.total);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [page, search, entityFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tag?")) return;
    setDeleting(id);
    try { await tagsApi.delete(id); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleting(null); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tags & Labels</h2>
          <p className="text-sm text-muted-foreground">Color-coded labels for categorizing entities. <span className="font-medium text-primary">{total} total</span></p>
        </div>
        <Button className="gradient-brand text-white border-0" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
          <Plus className="size-4 mr-2" /> Create Tag
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
            placeholder="Search tags..." />
        </div>
        <select value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
          className="h-10 px-3 text-sm rounded-lg border bg-card">
          <option value="">All Entities</option>
          {ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
      {error && <div className="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      {!loading && !error && (
        <div>
          {items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <TagIcon className="size-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No tags created</p>
              <p className="text-sm">Create tags to categorize and filter entities across the system.</p>
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap">
              {items.map(tag => (
                <div key={tag.id} className="group relative">
                  <div className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full text-sm font-medium text-white shadow-sm cursor-default"
                    style={{ backgroundColor: tag.color }}>
                    <TagIcon className="size-3.5" />
                    <span>{tag.name}</span>
                    {tag.entity_type !== "any" && (
                      <span className="opacity-70 text-xs">({tag.entity_type})</span>
                    )}
                    <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(tag); setDialogOpen(true); }}
                        className="size-4 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                        <Edit2 className="size-2.5" />
                      </button>
                      <button onClick={() => handleDelete(tag.id)} disabled={deleting === tag.id}
                        className="size-4 rounded-full bg-white/20 hover:bg-red-400/60 flex items-center justify-center">
                        {deleting === tag.id ? <Loader2 className="size-2.5 animate-spin" /> : <Trash2 className="size-2.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <TagDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} onSaved={load} />
    </div>
  );
}
