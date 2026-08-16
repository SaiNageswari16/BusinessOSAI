import { useState, useEffect, useCallback } from "react";
import { documentTemplatesApi, DocumentTemplate } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Search, Plus, FileText, Edit2, Trash2, Loader2, Star } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

const DOC_TYPES = ["invoice", "purchase_order", "receipt", "delivery_note", "quotation", "report", "contract"];
const FORMATS = ["pdf", "word", "excel", "html"];

function DocTemplateDialog({ open, onClose, initial, onSaved }: {
  open: boolean; onClose: () => void; initial?: DocumentTemplate; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [docType, setDocType] = useState(initial?.document_type ?? DOC_TYPES[0]);
  const [format, setFormat] = useState(initial?.format ?? "pdf");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? ""); setDocType(initial?.document_type ?? DOC_TYPES[0]);
      setFormat(initial?.format ?? "pdf"); setDescription(initial?.description ?? "");
      setIsDefault(initial?.is_default ?? false); setError("");
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true); setError("");
    try {
      const data = { name, document_type: docType, format, description: description || null, is_default: isDefault, status: "active" };
      if (initial) await documentTemplatesApi.update(initial.id, data);
      else await documentTemplatesApi.create(data);
      onSaved(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-lg font-bold mb-4">{initial ? "Edit" : "Create"} Document Template</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Invoice Template" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Document Type</label>
              <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Format</label>
              <select value={format} onChange={e => setFormat(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                {FORMATS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-md border bg-background resize-none" placeholder="Optional description..." />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="dt-default" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="h-4 w-4 rounded" />
            <label htmlFor="dt-default" className="text-sm">Set as default for this document type</label>
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

export function DocumentTemplates() {
    const { currency, formatCurrency } = useCurrency();
  const [items, setItems] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTemplate | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await documentTemplatesApi.list(page, 20, search || undefined, typeFilter || undefined);
      setItems(res.items); setTotal(res.total);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [page, search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    setDeleting(id);
    try { await documentTemplatesApi.delete(id); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleting(null); }
  };

  const FORMAT_COLORS: Record<string, string> = {
    pdf: "bg-red-500/10 text-red-600",
    word: "bg-blue-500/10 text-blue-600",
    excel: "bg-green-500/10 text-green-600",
    html: "bg-orange-500/10 text-orange-600",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Document Templates</h2>
          <p className="text-sm text-muted-foreground">PDF, Word, and Excel templates for business documents. <span className="font-medium text-primary">{total} total</span></p>
        </div>
        <Button className="gradient-brand text-white border-0" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
          <Plus className="size-4 mr-2" /> Create Template
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
            placeholder="Search templates..." />
        </div>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="h-10 px-3 text-sm rounded-lg border bg-card">
          <option value="">All Types</option>
          {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
      {error && <div className="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <FileText className="size-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No templates found</p>
              <p className="text-sm">Create document templates to automate document generation.</p>
            </div>
          ) : items.map(dt => (
            <Card key={dt.id} className="p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <FileText className="size-5" />
                </div>
                <div className="flex items-center gap-1">
                  {dt.is_default && <Star className="size-4 text-amber-500 fill-amber-500" />}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${FORMAT_COLORS[dt.format] || "bg-muted"}`}>
                    {dt.format}
                  </span>
                </div>
              </div>
              <h3 className="font-bold text-base leading-tight mb-1">{dt.name}</h3>
              <p className="text-xs text-muted-foreground capitalize mb-3">{dt.document_type.replace(/_/g, " ")}</p>
              {dt.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{dt.description}</p>}
              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="outline" size="sm" onClick={() => { setEditing(dt); setDialogOpen(true); }}>
                  <Edit2 className="size-3.5 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700"
                  onClick={() => handleDelete(dt.id)} disabled={deleting === dt.id}>
                  {deleting === dt.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page}</span>
          <Button variant="outline" size="sm" disabled={items.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      <DocTemplateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} onSaved={load} />
    </div>
  );
}
