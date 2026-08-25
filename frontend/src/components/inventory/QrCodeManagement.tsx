import { useState, useEffect, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  QrCode, Loader2, Search, Plus, Edit2, Trash2, Printer, Power,
  Hash, X, AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { inventoryApi, type ProductQRCode } from "../../lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

const QR_TYPES = ["product", "batch", "serial", "location"];

function QRVisual({ data }: { data: string }) {
  // Deterministic QR-like visual using nested squares
  const grid = useMemo(() => {
    const g: boolean[] = [];
    for (let i = 0; i < 169; i++) {
      // Stable pattern from string hash
      const c = (data.charCodeAt(i % data.length) * (i + 1)) & 0xff;
      g.push(c % 3 !== 0);
    }
    return g;
  }, [data]);

  const cellSize = 4;

  return (
    <div className="bg-white border rounded-lg p-3 flex justify-center">
      <svg width={cellSize * 13 + 12} height={cellSize * 13 + 12} viewBox={`0 0 ${cellSize * 13 + 12} ${cellSize * 13 + 12}`}>
        <rect width="100%" height="100%" fill="white" />
        {grid.map((on, i) => {
          if (!on) return null;
          const x = (i % 13) * cellSize + 6;
          const y = Math.floor(i / 13) * cellSize + 6;
          return <rect key={i} x={x} y={y} width={cellSize} height={cellSize} fill="#000" />;
        })}
        {/* corner finder squares */}
        {[[6,6],[86,6],[6,86]].map(([x,y], i) => (
          <g key={i}>
            <rect x={x} y={y} width={12} height={12} fill="none" stroke="#000" strokeWidth="3" />
            <rect x={x+3} y={y+3} width={6} height={6} fill="#000" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function QRModal({
  qr, onClose, onSave, saving,
}: { qr: Partial<ProductQRCode> | null; onClose: () => void; onSave: (q: Partial<ProductQRCode>) => void; saving: boolean }) {
  const [form, setForm] = useState<Partial<ProductQRCode>>(qr || {
    qr_data: "https://product/" + Math.random().toString(36).slice(2, 9).toUpperCase(),
    qr_type: "product",
    format: "QR",
    version: "v1",
    error_correction: "M",
    is_active: true,
    notes: "",
  });
  const set = (k: keyof ProductQRCode, v: any) => setForm(p => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.qr_data) return alert("QR data is required");
    onSave(form);
  };

  const generate = () => {
    set("qr_data", "https://product/" + Math.random().toString(36).slice(2, 14).toUpperCase());
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <h3 className="text-xl font-bold">{qr?.id ? "Edit" : "New"} QR Code</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <form id="qr-form" onSubmit={submit} className="p-6 overflow-y-auto flex-1 grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">QR Data *</label>
              <div className="flex gap-2">
                <input required value={form.qr_data || ""} onChange={e => set("qr_data", e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                <Button type="button" variant="outline" size="sm" onClick={generate}>Generate</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
                <select value={form.qr_type} onChange={e => set("qr_type", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                  {QR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Format</label>
                <input value={form.format || ""} onChange={e => set("format", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Version</label>
                <input value={form.version || ""} onChange={e => set("version", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Error Correction</label>
                <select value={form.error_correction || "M"} onChange={e => set("error_correction", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                  {["L", "M", "Q", "H"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
              <textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} rows={2}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active ?? true} onChange={e => set("is_active", e.target.checked)}
                className="size-4 rounded border-slate-300" />
              <span>Active</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Live Preview</label>
            <QRVisual data={form.qr_data || "preview"} />
            <div className="mt-2 text-center text-[10px] font-mono text-muted-foreground truncate">{form.qr_data}</div>
          </div>
        </form>

        <div className="p-6 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-2 shrink-0">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} form="qr-form">{saving && <Loader2 className="size-4 animate-spin mr-2" />} {qr?.id ? "Update" : "Create"} QR</Button>
        </div>
      </motion.div>
    </div>
  );
}

export function QrCodeManagement() {
    const { currency, formatCurrency } = useCurrency();
  const [items, setItems] = useState<ProductQRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [working, setWorking] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ProductQRCode> | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await inventoryApi.getQRCodes({ search: search || undefined });
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
  }, [search]);

  const filtered = useMemo(() => {
    if (!typeFilter) return items;
    return items.filter(q => q.qr_type === typeFilter);
  }, [items, typeFilter]);

  const handleSave = async (q: Partial<ProductQRCode>) => {
    try {
      setWorking(true);
      if (q.id) {
        const updated = await inventoryApi.updateQRCode(q.id, q);
        setItems(prev => prev.map(x => x.id === q.id ? updated : x));
      } else {
        const created = await inventoryApi.createQRCode(q as Record<string, unknown>);
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

  const handlePrint = async (id: string) => {
    try {
      setWorking(true);
      await inventoryApi.printQRCode(id);
      load();
    } catch (e: any) {
      alert(`Print failed: ${e?.detail ?? e?.message}`);
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this QR code?")) return;
    try {
      await inventoryApi.deleteQRCode(id);
      setItems(prev => prev.filter(x => x.id !== id));
    } catch (e: any) {
      alert(`Delete failed: ${e?.detail ?? e?.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">QR Code Management
          </h2>
          <p className="text-sm text-muted-foreground">Create, track, and print QR codes for products, batches, serials, and locations.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> New QR Code
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
              placeholder="Search QR data..." />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="h-10 px-3 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30">
            <option value="">All Types</option>
            {QR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-muted/20 border-dashed">
          <QrCode className="size-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No QR codes yet</h3>
          <p className="text-muted-foreground mb-4">Generate QR codes for products, batches, or locations.</p>
          <Button onClick={() => setModalOpen(true)} className="gradient-brand text-white border-0">
            <Plus className="size-4 mr-2" /> Create QR Code
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(qr => (
            <Card key={qr.id} className={`p-4 ${!qr.is_active ? "opacity-60" : ""}`}>
              <div className="flex justify-center">
                <QRVisual data={qr.qr_data} />
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="text-center text-[10px] font-mono text-muted-foreground truncate" title={qr.qr_data}>
                  {qr.qr_data}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded uppercase font-bold text-[10px]">
                    <Hash className="size-3" /> {qr.qr_type}
                  </span>
                  <span className="font-mono">{qr.format} · {qr.error_correction}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t">
                  <span className="text-muted-foreground">
                    Printed <strong className="text-foreground">{qr.print_count}×</strong>
                  </span>
                  <span className={`inline-flex items-center gap-1 ${qr.is_active ? "text-emerald-600" : "text-slate-400"}`}>
                    <Power className="size-3" />
                    {qr.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex gap-1.5">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handlePrint(qr.id)} disabled={working}>
                  <Printer className="size-3 mr-1" /> Print
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(qr); setModalOpen(true); }}>
                  <Edit2 className="size-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(qr.id)}>
                  <Trash2 className="size-3 text-rose-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <QRModal qr={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} saving={working} />
        )}
      </AnimatePresence>
    </div>
  );
}
