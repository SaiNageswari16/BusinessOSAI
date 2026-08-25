import { useState, useEffect, useCallback } from "react";
import { customFieldsApi, CustomField } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Search, Plus, Settings2, Edit2, Trash2, Loader2, ToggleLeft, Type, Hash, Calendar, ChevronDown, SquareCheck } from "lucide-react";

const ENTITY_TYPES = ["employee", "customer", "supplier", "product", "order", "invoice", "any"];
const FIELD_TYPES = ["text", "number", "date", "dropdown", "checkbox", "textarea", "email", "phone"];

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  text: Type, number: Hash, date: Calendar, dropdown: ChevronDown,
  checkbox: SquareCheck, textarea: Type, email: Type, phone: Hash,
};

function FieldDialog({ open, onClose, initial, onSaved }: {
  open: boolean; onClose: () => void; initial?: CustomField; onSaved: () => void;
}) {
  const [entityType, setEntityType] = useState(initial?.entity_type ?? "employee");
  const [fieldName, setFieldName] = useState(initial?.field_name ?? "");
  const [fieldLabel, setFieldLabel] = useState(initial?.field_label ?? "");
  const [fieldType, setFieldType] = useState(initial?.field_type ?? "text");
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? false);
  const [optionsText, setOptionsText] = useState(initial?.options?.join(", ") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setEntityType(initial?.entity_type ?? "employee"); setFieldName(initial?.field_name ?? "");
      setFieldLabel(initial?.field_label ?? ""); setFieldType(initial?.field_type ?? "text");
      setIsRequired(initial?.is_required ?? false);
      setOptionsText(initial?.options?.join(", ") ?? ""); setError("");
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim()) { setError("Field label is required"); return; }
    if (!initial && !fieldName.trim()) { setError("Field name is required"); return; }
    setLoading(true); setError("");
    try {
      const options = fieldType === "dropdown" ? optionsText.split(",").map(s => s.trim()).filter(Boolean) : null;
      if (initial) {
        await customFieldsApi.update(initial.id, { field_label: fieldLabel, field_type: fieldType, is_required: isRequired, options });
      } else {
        await customFieldsApi.create({ entity_type: entityType, field_name: fieldName.toLowerCase().replace(/\s+/g, "_"), field_label: fieldLabel, field_type: fieldType, is_required: isRequired, options, status: "active" });
      }
      onSaved(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-lg font-bold mb-4">{initial ? "Edit" : "Create"} Custom Field</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!initial && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Entity Type</label>
              <select value={entityType} onChange={e => setEntityType(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
                {ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          )}
          {!initial && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Field Name (key) *</label>
              <Input value={fieldName} onChange={e => setFieldName(e.target.value)} placeholder="e.g. emergency_contact" />
              <p className="text-xs text-muted-foreground">Lowercase, no spaces (underscores allowed)</p>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Field Label *</label>
            <Input value={fieldLabel} onChange={e => setFieldLabel(e.target.value)} placeholder="e.g. Emergency Contact" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Field Type</label>
            <select value={fieldType} onChange={e => setFieldType(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
              {FIELD_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {fieldType === "dropdown" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Options (comma separated)</label>
              <Input value={optionsText} onChange={e => setOptionsText(e.target.value)} placeholder="Option 1, Option 2, Option 3" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="cf-required" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} className="h-4 w-4 rounded" />
            <label htmlFor="cf-required" className="text-sm">Required field</label>
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

export function CustomFields() {
  const [items, setItems] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomField | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await customFieldsApi.list(page, 50, search || undefined, entityFilter || undefined);
      setItems(res.items); setTotal(res.total);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [page, search, entityFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this custom field?")) return;
    setDeleting(id);
    try { await customFieldsApi.delete(id); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleting(null); }
  };

  // Group by entity_type
  const grouped = items.reduce((acc, cf) => {
    if (!acc[cf.entity_type]) acc[cf.entity_type] = [];
    acc[cf.entity_type].push(cf);
    return acc;
  }, {} as Record<string, CustomField[]>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold tracking-tight">Custom Fields</h2>
          <p className="text-xs text-muted-foreground">Extend any entity with custom data fields. <span className="font-medium text-primary">{total} total</span></p>
        </div>
        <Button size="sm" className="h-8 gradient-brand text-white border-0 text-xs font-semibold" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
          <Plus className="size-3.5 mr-1.5" /> Add Field
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
            placeholder="Search fields..." />
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
        items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Settings2 className="size-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No custom fields</p>
            <p className="text-sm">Add custom fields to extend entity data models.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([entityType, fields]) => (
              <div key={entityType}>
                <h3 className="text-sm font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded bg-primary inline-block" />
                  {entityType.charAt(0).toUpperCase() + entityType.slice(1)} Fields
                  <span className="text-xs font-normal text-muted-foreground">({fields.length})</span>
                </h3>
                <Card className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3 text-left">Field Label</th>
                        <th className="px-4 py-3 text-left">Field Key</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Required</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {fields.map(cf => {
                        const Icon = FIELD_TYPE_ICONS[cf.field_type] || Type;
                        return (
                          <tr key={cf.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Icon className="size-3.5 text-muted-foreground" />
                                <span className="font-medium">{cf.field_label}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{cf.field_name}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 bg-muted rounded text-[10px] font-semibold uppercase">{cf.field_type}</span>
                            </td>
                            <td className="px-4 py-3">
                              {cf.is_required ? (
                                <span className="text-[10px] bg-red-500/10 text-red-600 px-2 py-0.5 rounded font-bold">Required</span>
                              ) : (
                                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded font-bold">Optional</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(cf); setDialogOpen(true); }}>
                                <Edit2 className="size-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => handleDelete(cf.id)} disabled={deleting === cf.id}>
                                {deleting === cf.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              </div>
            ))}
          </div>
        )
      )}

      <FieldDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} onSaved={load} />
    </div>
  );
}
