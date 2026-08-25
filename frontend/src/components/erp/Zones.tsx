import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle, Globe, MapPin } from "lucide-react";
import { zonesApi, regionsApi, type Zone, type Region } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

function ZoneFormModal({ zone, regions, onClose, onSaved }: {
  zone: Zone | null; regions: Region[]; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!zone;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    region_id: zone?.region_id ?? (regions[0]?.id ?? ""),
    name: zone?.name ?? "",
    status: zone?.status ?? "active",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (isEdit) { await zonesApi.update(zone.id, form); toast.success("Zone updated"); }
      else { await zonesApi.create(form); toast.success("Zone created"); }
      onSaved(); onClose();
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Globe className="size-5 text-primary" />{isEdit ? "Edit Zone" : "Add Zone"}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Region *</label>
            <select value={form.region_id} onChange={set("region_id")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Zone Name *</label>
              <input value={form.name} onChange={set("name")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Zone Alpha" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Status</label>
              <select value={form.status} onChange={set("status")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gradient-brand text-white border-0 min-w-[100px]">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-4 mr-1.5" />{isEdit ? "Update" : "Create"}</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function Zones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editZone, setEditZone] = useState<Zone | null>(null);
  const [deleteZone, setDeleteZone] = useState<Zone | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [zRes, rRes] = await Promise.all([zonesApi.list(1, 100), regionsApi.list(1, 100)]);
      setZones(zRes.items);
      setRegions(rRes.items);
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, []);

  const filtered = zones.filter((z) => z.name.toLowerCase().includes(search.toLowerCase()));

  const handleDelete = async () => {
    if (!deleteZone) return;
    setDeleting(true);
    try {
      await zonesApi.delete(deleteZone.id);
      toast.success("Zone deleted");
      setDeleteZone(null);
      void load();
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed"); }
    finally { setDeleting(false); }
  };

  const regionMap = Object.fromEntries(regions.map((r) => [r.id, r.name]));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold tracking-tight">Zones</h2>
          <p className="text-xs text-muted-foreground">Sub-regional groupings under each geographic region.</p>
        </div>
        <Button size="sm" className="h-8 gradient-brand text-white border-0 gap-1.5 text-xs font-semibold" onClick={() => { setEditZone(null); setShowForm(true); }}>
          <Plus className="size-3.5" /> Add Zone
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-9 pr-3 text-xs rounded-lg border bg-card focus:ring-1 focus:ring-primary/30 outline-none"
            placeholder="Search zones..." />
        </div>
        <span className="text-xs text-muted-foreground">{zones.length} zones</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Globe className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No zones yet</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditZone(null); setShowForm(true); }}>
            <Plus className="size-4 mr-1" /> Add Zone
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((zone) => (
            <Card key={zone.id} className="p-5 hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center"><Globe className="size-4" /></div>
                  <div>
                    <h3 className="font-bold text-sm">{zone.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />{regionMap[zone.region_id] ?? "—"}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEditZone(zone); setShowForm(true); }}><Edit2 className="size-3" /></Button>
                  <Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => setDeleteZone(zone)}><Trash2 className="size-3" /></Button>
                </div>
              </div>
              <span className={cn("text-[10px] font-medium", zone.status === "active" ? "text-emerald-600" : "text-muted-foreground")}>
                {zone.status.charAt(0).toUpperCase() + zone.status.slice(1)}
              </span>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <ZoneFormModal zone={editZone} regions={regions}
            onClose={() => { setShowForm(false); setEditZone(null); }} onSaved={load} />
        )}
        {deleteZone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete Zone</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Delete <span className="font-semibold text-foreground">{deleteZone.name}</span>?</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteZone(null)}>Cancel</Button>
                <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                  {deleting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Trash2 className="size-4 mr-1" />} Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
