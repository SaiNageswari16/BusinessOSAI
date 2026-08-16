import { useState, useEffect, useCallback } from "react";
import { locationsApi, ERPLocation } from "../../lib/api-client";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Search, Plus, MapPin, Edit2, Trash2, Loader2, Building, Warehouse } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

const LOCATION_TYPES = ["office", "warehouse", "factory", "site", "showroom", "store"];

const TYPE_COLORS: Record<string, string> = {
  office: "bg-blue-500/10 text-blue-600",
  warehouse: "bg-amber-500/10 text-amber-600",
  factory: "bg-orange-500/10 text-orange-600",
  site: "bg-green-500/10 text-green-600",
  showroom: "bg-purple-500/10 text-purple-600",
  store: "bg-rose-500/10 text-rose-600",
};

function LocationDialog({ open, onClose, initial, onSaved }: {
  open: boolean; onClose: () => void; initial?: ERPLocation; onSaved: () => void;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [locationType, setLocationType] = useState(initial?.location_type ?? "office");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setCode(initial?.code ?? ""); setName(initial?.name ?? "");
      setLocationType(initial?.location_type ?? "office"); setAddress(initial?.address ?? "");
      setCity(initial?.city ?? ""); setState(initial?.state ?? "");
      setCountry(initial?.country ?? ""); setError("");
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (!initial && !code.trim())) { setError("Name and code are required"); return; }
    setLoading(true); setError("");
    try {
      const data = { code, name, location_type: locationType, address: address || null, city: city || null, state: state || null, country: country || null, status: "active" };
      if (initial) await locationsApi.update(initial.id, data);
      else await locationsApi.create(data);
      onSaved(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to save"); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">{initial ? "Edit" : "Add"} Location</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {!initial && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Code *</label>
                <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. MUM-WH1" />
              </div>
            )}
            <div className={`space-y-1 ${initial ? "col-span-2" : ""}`}>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Location Name *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mumbai Warehouse 1" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Location Type</label>
            <select value={locationType} onChange={e => setLocationType(e.target.value)} className="w-full h-10 px-3 text-sm rounded-md border bg-background">
              {LOCATION_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Address</label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-md border bg-background resize-none" placeholder="Street address..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">City</label>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">State</label>
              <Input value={state} onChange={e => setState(e.target.value)} placeholder="State" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Country</label>
              <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="Country" />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 gradient-brand text-white border-0" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : (initial ? "Update" : "Add Location")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function Locations() {
    const { currency, formatCurrency } = useCurrency();
  const [items, setItems] = useState<ERPLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ERPLocation | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await locationsApi.list(page, 20, search || undefined, undefined, typeFilter || undefined);
      setItems(res.items); setTotal(res.total);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [page, search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this location?")) return;
    setDeleting(id);
    try { await locationsApi.delete(id); load(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleting(null); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Locations</h2>
          <p className="text-sm text-muted-foreground">Offices, warehouses, factories and sites. <span className="font-medium text-primary">{total} total</span></p>
        </div>
        <Button className="gradient-brand text-white border-0" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
          <Plus className="size-4 mr-2" /> Add Location
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
            placeholder="Search locations..." />
        </div>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="h-10 px-3 text-sm rounded-lg border bg-card">
          <option value="">All Types</option>
          {LOCATION_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>}
      {error && <div className="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm border border-red-500/20">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {items.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <MapPin className="size-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No locations configured</p>
              <p className="text-sm">Add offices, warehouses, and sites for operations tracking.</p>
            </div>
          ) : items.map(loc => {
            const TypeIcon = loc.location_type === "warehouse" ? Warehouse : Building;
            return (
              <Card key={loc.id} className="p-5 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between mb-3">
                  <div className={`size-10 rounded-lg grid place-items-center ${TYPE_COLORS[loc.location_type] || "bg-muted"}`}>
                    <TypeIcon className="size-5" />
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${TYPE_COLORS[loc.location_type] || "bg-muted"}`}>
                    {loc.location_type}
                  </span>
                </div>
                <h3 className="font-bold text-base leading-tight">{loc.name}</h3>
                <p className="text-xs font-mono text-muted-foreground mb-2">{loc.code}</p>
                {(loc.city || loc.country) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="size-3" />
                    {[loc.city, loc.state, loc.country].filter(Boolean).join(", ")}
                  </p>
                )}
                <div className="flex justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm" onClick={() => { setEditing(loc); setDialogOpen(true); }}>
                    <Edit2 className="size-3.5 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDelete(loc.id)} disabled={deleting === loc.id}>
                    {deleting === loc.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm text-muted-foreground self-center">Page {page}</span>
          <Button variant="outline" size="sm" disabled={items.length < 20} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      <LocationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} onSaved={load} />
    </div>
  );
}
