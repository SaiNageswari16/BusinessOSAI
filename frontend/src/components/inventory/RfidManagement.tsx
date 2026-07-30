import { useState, useEffect, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Radio, Loader2, Search, Plus, Edit2, Trash2, RadioTower, X,
  Scan, MapPin, Power, AlertCircle, Hash,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { inventoryApi, type ProductRFID } from "../../lib/api-client";

const TAG_TYPES = ["passive", "active", "semi-passive"];
const FREQUENCIES = ["LF 125kHz", "HF 13.56MHz", "UHF 860-960MHz", "NFC"];
const PROTOCOLS = ["ISO 14443", "ISO 15693", "EPC Gen2", "ISO 18000-63", "NDEF"];
const STATUS_OPTS = ["active", "deactivated", "lost"];
const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600",
  deactivated: "bg-slate-500/10 text-slate-600",
  lost: "bg-rose-500/10 text-rose-600",
};

function RFIDModal({
  tag, onClose, onSave, saving,
}: { tag: Partial<ProductRFID> | null; onClose: () => void; onSave: (t: Partial<ProductRFID>) => void; saving: boolean }) {
  const [form, setForm] = useState<Partial<ProductRFID>>(tag || {
    tag_uid: "E280-" + Math.random().toString(16).slice(2, 18).toUpperCase(),
    tag_type: "passive",
    frequency: "UHF 860-960MHz",
    protocol: "EPC Gen2",
    memory_bits: 96,
    last_seen_location: "",
    status: "active",
    notes: "",
  });
  const set = (k: keyof ProductRFID, v: any) => setForm(p => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tag_uid) return alert("Tag UID is required");
    onSave(form);
  };

  const generate = () => {
    set("tag_uid", "E280-" + Math.random().toString(16).slice(2, 18).toUpperCase());
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <h3 className="text-xl font-bold">{tag?.id ? "Edit" : "New"} RFID Tag</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <form id="rfid-form" onSubmit={submit} className="p-6 overflow-y-auto flex-1 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tag UID (EPC) *</label>
            <div className="flex gap-2">
              <input required value={form.tag_uid || ""} onChange={e => set("tag_uid", e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
              <Button type="button" variant="outline" size="sm" onClick={generate}>Generate</Button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tag Type</label>
            <select value={form.tag_type || "passive"} onChange={e => set("tag_type", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              {TAG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Frequency</label>
            <select value={form.frequency || ""} onChange={e => set("frequency", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Protocol</label>
            <select value={form.protocol || ""} onChange={e => set("protocol", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              {PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Memory (bits)</label>
            <input type="number" min={0} value={form.memory_bits ?? 0} onChange={e => set("memory_bits", Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
            <select value={form.status || "active"} onChange={e => set("status", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Last Seen Location</label>
            <input value={form.last_seen_location || ""} onChange={e => set("last_seen_location", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
            <textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
        </form>

        <div className="p-6 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-2 shrink-0">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} form="rfid-form">{saving && <Loader2 className="size-4 animate-spin mr-2" />} {tag?.id ? "Update" : "Create"} Tag</Button>
        </div>
      </motion.div>
    </div>
  );
}

function ScanModal({
  tag, onClose, onScan,
}: { tag: ProductRFID; onClose: () => void; onScan: (location: string) => void }) {
  const [location, setLocation] = useState("");
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
          <Scan className="size-5 text-indigo-600" />
          Scan RFID Tag
        </h3>
        <p className="text-sm text-muted-foreground mb-4 font-mono">{tag.tag_uid}</p>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</label>
        <input value={location} onChange={e => setLocation(e.target.value)} autoFocus
          className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g. Warehouse A · Aisle 3 · Rack 5" />
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onScan(location)} disabled={!location.trim()}>
            <MapPin className="size-4 mr-2" />
            Record Scan
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export function RfidManagement() {
  const [items, setItems] = useState<ProductRFID[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [working, setWorking] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ProductRFID> | null>(null);
  const [scanTag, setScanTag] = useState<ProductRFID | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await inventoryApi.getRFIDs({ search: search || undefined, status: statusFilter || undefined });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, statusFilter]);

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    items.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
    return {
      total: items.length,
      active: byStatus["active"] || 0,
      deactivated: byStatus["deactivated"] || 0,
      lost: byStatus["lost"] || 0,
    };
  }, [items]);

  const handleSave = async (t: Partial<ProductRFID>) => {
    try {
      setWorking(true);
      if (t.id) {
        const updated = await inventoryApi.updateRFID(t.id, t);
        setItems(prev => prev.map(x => x.id === t.id ? updated : x));
      } else {
        const created = await inventoryApi.createRFID(t as Record<string, unknown>);
        setItems(prev => [created, ...prev]);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e: any) {
      alert(`Save failed: ${e?.detail ?? e?.message}`);
    } finally {
      setWorking(false);
    }
  };

  const handleScan = async (location: string) => {
    if (!scanTag) return;
    try {
      setWorking(true);
      const updated = await inventoryApi.scanRFID(scanTag.id, location);
      setItems(prev => prev.map(x => x.id === scanTag.id ? updated : x));
      setScanTag(null);
    } catch (e: any) {
      alert(`Scan failed: ${e?.detail ?? e?.message}`);
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this RFID tag?")) return;
    try {
      await inventoryApi.deleteRFID(id);
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e: any) {
      alert(`Delete failed: ${e?.detail ?? e?.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <RadioTower className="size-6 text-primary" />
            RFID Management
          </h2>
          <p className="text-sm text-muted-foreground">Track RFID tags, monitor their lifecycle, and record scan events for inventory visibility.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> New RFID Tag
        </Button>
      </div>

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Hash className="size-3" /> Total</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Power className="size-3 text-emerald-600" /> Active</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><Power className="size-3 text-slate-400" /> Deactivated</div>
            <div className="text-2xl font-bold text-slate-500 mt-1">{stats.deactivated}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><AlertCircle className="size-3 text-rose-500" /> Lost</div>
            <div className="text-2xl font-bold text-rose-600 mt-1">{stats.lost}</div>
          </Card>
        </div>
      )}

      <Card className="p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
              placeholder="Search by UID..." />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-10 px-3 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30">
            <option value="">All Status</option>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center bg-muted/20 border-dashed">
          <Radio className="size-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No RFID tags yet</h3>
          <p className="text-muted-foreground mb-4">Register your first RFID tag to start tracking inventory movement in real-time.</p>
          <Button onClick={() => setModalOpen(true)} className="gradient-brand text-white border-0">
            <Plus className="size-4 mr-2" /> Create First Tag
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Tag UID</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Frequency</th>
                <th className="px-6 py-4">Protocol</th>
                <th className="px-6 py-4">Memory</th>
                <th className="px-6 py-4">Last Seen</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(tag => (
                <tr key={tag.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-xs">{tag.tag_uid}</td>
                  <td className="px-6 py-4 text-xs capitalize">{tag.tag_type || "—"}</td>
                  <td className="px-6 py-4 text-xs">{tag.frequency || "—"}</td>
                  <td className="px-6 py-4 text-xs">{tag.protocol || "—"}</td>
                  <td className="px-6 py-4 text-xs font-mono">{tag.memory_bits ?? "—"}b</td>
                  <td className="px-6 py-4 text-xs">
                    {tag.last_seen_at ? (
                      <>
                        <div>{new Date(tag.last_seen_at).toLocaleString()}</div>
                        {tag.last_seen_location && (
                          <div className="text-muted-foreground text-[10px]">📍 {tag.last_seen_location}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[tag.status] || ""}`}>
                      {tag.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setScanTag(tag)} disabled={tag.status !== "active"}>
                        <Scan className="size-3 mr-1" /> Scan
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(tag); setModalOpen(true); }}>
                        <Edit2 className="size-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(tag.id)}>
                        <Trash2 className="size-3 text-rose-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <AnimatePresence>
        {modalOpen && (
          <RFIDModal tag={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} saving={working} />
        )}
        {scanTag && (
          <ScanModal tag={scanTag} onClose={() => setScanTag(null)} onScan={handleScan} />
        )}
      </AnimatePresence>
    </div>
  );
}
