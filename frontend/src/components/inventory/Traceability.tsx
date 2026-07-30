import { useState, useEffect, useMemo } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Search, FlaskConical, Loader2, Plus, X, Package, AlertCircle,
  ArrowRight, ArrowDown, Warehouse, Truck, ClipboardCheck,
  ShieldAlert, RotateCcw, CheckCircle2, ChevronRight, Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { inventoryApi, type BatchGenealogy, type InventoryBatch, type TraceabilityEvent } from "../../lib/api-client";

const EVENT_META: Record<string, { label: string; icon: any; color: string; bg: string; dotColor: string }> = {
  received:     { label: "Received",       icon: ClipboardCheck, color: "text-emerald-600", bg: "bg-emerald-500/10", dotColor: "bg-emerald-500" },
  produced:     { label: "Produced",       icon: FlaskConical,   color: "text-indigo-600",  bg: "bg-indigo-500/10",  dotColor: "bg-indigo-500" },
  packed:       { label: "Packed",         icon: Package,        color: "text-blue-600",    bg: "bg-blue-500/10",    dotColor: "bg-blue-500" },
  shipped:      { label: "Shipped",        icon: Truck,          color: "text-amber-600",   bg: "bg-amber-500/10",   dotColor: "bg-amber-500" },
  delivered:    { label: "Delivered",      icon: CheckCircle2,   color: "text-emerald-700", bg: "bg-emerald-600/10", dotColor: "bg-emerald-600" },
  returned:     { label: "Returned",       icon: RotateCcw,      color: "text-violet-600",  bg: "bg-violet-500/10",  dotColor: "bg-violet-500" },
  recalled:     { label: "Recalled",       icon: ShieldAlert,    color: "text-rose-700",    bg: "bg-rose-600/10",    dotColor: "bg-rose-600" },
  quarantined:  { label: "Quarantined",    icon: AlertCircle,    color: "text-amber-700",   bg: "bg-amber-600/10",   dotColor: "bg-amber-600" },
  released:     { label: "Released",       icon: CheckCircle2,   color: "text-emerald-600", bg: "bg-emerald-500/10", dotColor: "bg-emerald-500" },
  consumed:     { label: "Consumed",       icon: Activity,       color: "text-slate-600",   bg: "bg-slate-500/10",   dotColor: "bg-slate-500" },
  adjusted:     { label: "Stock Adjusted", icon: AlertCircle,    color: "text-orange-600",  bg: "bg-orange-500/10",  dotColor: "bg-orange-500" },
  transferred:  { label: "Transferred",    icon: Warehouse,      color: "text-cyan-600",    bg: "bg-cyan-500/10",    dotColor: "bg-cyan-500" },
};

const EVENT_OPTS = Object.keys(EVENT_META);

function EventModal({
  onClose, onSave, saving, batches, defaultBatchId,
}: {
  onClose: () => void;
  onSave: (e: Partial<TraceabilityEvent>) => void;
  saving: boolean;
  batches: InventoryBatch[];
  defaultBatchId?: string;
}) {
  const [form, setForm] = useState<Partial<TraceabilityEvent>>({
    event_type: "received",
    batch_id: defaultBatchId || null,
    serial_id: null,
    source_location: "",
    destination_location: "",
    party_type: "",
    party_name: "",
    reference_document: "",
    quantity: 1,
    unit: "pcs",
    notes: "",
    event_at: new Date().toISOString().slice(0, 16),
  });
  const set = (k: keyof TraceabilityEvent, v: any) => setForm(p => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batch_id) return alert("Select a batch");
    onSave({ ...form, event_at: form.event_at ? new Date(form.event_at).toISOString() : undefined });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <h3 className="text-xl font-bold text-slate-900">Record Traceability Event</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <form id="event-form" onSubmit={submit} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Batch *</label>
              <select required value={form.batch_id || ""} onChange={e => set("batch_id", e.target.value || null)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="">— Select —</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.batch_number} ({b.product_name})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Event Type *</label>
              <select required value={form.event_type} onChange={e => set("event_type", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                {EVENT_OPTS.map(t => <option key={t} value={t}>{EVENT_META[t].label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Source Location</label>
              <input value={form.source_location || ""} onChange={e => set("source_location", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Destination Location</label>
              <input value={form.destination_location || ""} onChange={e => set("destination_location", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Party Type</label>
              <select value={form.party_type || ""} onChange={e => set("party_type", e.target.value || null)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                <option value="">— None —</option>
                <option value="supplier">Supplier</option>
                <option value="customer">Customer</option>
                <option value="carrier">Carrier</option>
                <option value="internal">Internal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Party Name</label>
              <input value={form.party_name || ""} onChange={e => set("party_name", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reference Document</label>
              <input placeholder="GRN-001, PO-2026-042..." value={form.reference_document || ""} onChange={e => set("reference_document", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Event Date/Time</label>
              <input type="datetime-local" value={form.event_at ? String(form.event_at).slice(0, 16) : ""}
                onChange={e => set("event_at", e.target.value ? e.target.value : null)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quantity</label>
              <input type="number" min={0} value={form.quantity ?? 0} onChange={e => set("quantity", Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Unit</label>
              <input value={form.unit || "pcs"} onChange={e => set("unit", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
              <textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} rows={2}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
          <button type="submit" form="event-form" disabled={saving}
            className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/20 disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />}
            Record Event
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function GenealogyTimeline({ events }: { events: BatchGenealogy["events"] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="size-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No traceability events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* spine */}
      <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />

      <div className="space-y-4">
        {events.map((ev, idx) => {
          const meta = EVENT_META[ev.event_type] || EVENT_META.received;
          const Icon = meta.icon;
          const isLast = idx === events.length - 1;
          return (
            <div key={ev.id} className="relative pl-6">
              {/* dot on spine */}
              <div className={`absolute left-0 top-1.5 -translate-x-1/2 size-4 rounded-full ring-4 ring-card ${meta.dotColor}`} />
              {!isLast && <div className="absolute left-[7px] top-5 bottom-0 -mb-4 w-px bg-border" />}

              <Card className={`p-4 ${meta.bg}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${meta.bg} ${meta.color}`}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-bold ${meta.color}`}>{meta.label}</span>
                      {ev.reference_document && (
                        <span className="text-[10px] font-mono bg-white/60 px-1.5 py-0.5 rounded">
                          {ev.reference_document}
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      {ev.source_location && <><span>{ev.source_location}</span><ArrowRight className="size-3" /></>}
                      <span className="font-medium text-foreground">{ev.destination_location || "—"}</span>
                    </div>

                    <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                      <time className="font-mono">{new Date(ev.event_at).toLocaleString()}</time>
                      {ev.quantity != null && (
                        <span className="inline-flex items-center gap-1 bg-white/60 px-1.5 py-0.5 rounded font-mono">
                          {ev.quantity} {ev.unit || "pcs"}
                        </span>
                      )}
                      {ev.party_name && (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[10px] uppercase">{ev.party_type}</span>
                          <span className="font-medium">{ev.party_name}</span>
                        </span>
                      )}
                    </div>

                    {ev.notes && <div className="mt-2 text-xs text-muted-foreground italic">"{ev.notes}"</div>}
                  </div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Traceability({ preselectedBatchId }: { preselectedBatchId?: string | null }) {
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(preselectedBatchId || null);
  const [genealogy, setGenealogy] = useState<BatchGenealogy | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingGene, setLoadingGene] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const loadBatches = async () => {
    try {
      setLoadingList(true);
      setError(null);
      const b = await inventoryApi.getBatches();
      setBatches(b);
    } catch (e: any) {
      setError(e?.detail ?? "Failed to load batches");
    } finally {
      setLoadingList(false);
    }
  };

  const loadGenealogy = async (id: string) => {
    try {
      setLoadingGene(true);
      const data = await inventoryApi.getBatchGenealogy(id);
      setGenealogy(data);
    } catch (e: any) {
      setGenealogy(null);
      setError(e?.detail ?? "Failed to load genealogy");
    } finally {
      setLoadingGene(false);
    }
  };

  useEffect(() => { loadBatches(); }, []);

  useEffect(() => {
    if (selectedBatchId) loadGenealogy(selectedBatchId);
    else setGenealogy(null);
  }, [selectedBatchId]);

  // If preselectedBatchId changes (from BatchNumbers click), use it
  useEffect(() => {
    if (preselectedBatchId) setSelectedBatchId(preselectedBatchId);
  }, [preselectedBatchId]);

  const filteredBatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter(b =>
      b.batch_number.toLowerCase().includes(q)
      || (b.product_name || "").toLowerCase().includes(q)
    );
  }, [batches, search]);

  const handleEventSave = async (e: Partial<TraceabilityEvent>) => {
    try {
      setSaving(true);
      await inventoryApi.createTraceabilityEvent(e as Record<string, unknown>);
      setModalOpen(false);
      if (selectedBatchId) await loadGenealogy(selectedBatchId);
    } catch (e: any) {
      alert(`Save failed: ${e?.detail ?? e?.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="size-6 text-indigo-600" />
            Traceability
          </h2>
          <p className="text-sm text-muted-foreground">Trace any batch through its full lifecycle — from receipt to delivery, return or recall.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}
          disabled={batches.length === 0} className="gradient-brand text-white border-0">
          <Plus className="size-4 mr-2" /> Record Event
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
          <button onClick={loadBatches} className="ml-3 underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Left: Batch picker */}
        <Card className="col-span-12 md:col-span-4 p-4 self-start">
          <div className="flex items-center gap-2 mb-3">
            <Search className="size-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 h-9 px-3 text-sm rounded-md border bg-card focus:ring-1 focus:ring-primary/30"
              placeholder="Find a batch..." />
          </div>

          {loadingList ? (
            <div className="flex justify-center p-6"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : filteredBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No batches found.</p>
          ) : (
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {filteredBatches.map(b => (
                <button key={b.id} onClick={() => setSelectedBatchId(b.id)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selectedBatchId === b.id
                      ? "border-indigo-500 bg-indigo-500/5"
                      : "border-transparent hover:bg-muted/50"
                  }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-sm">{b.batch_number}</span>
                    {selectedBatchId === b.id && <ChevronRight className="size-4 text-indigo-600" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{b.product_name || "—"}</div>
                  {b.warehouse_name && <div className="text-[10px] text-muted-foreground mt-1">📍 {b.warehouse_name}</div>}
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Right: Genealogy details */}
        <Card className="col-span-12 md:col-span-8 p-6">
          {!selectedBatchId ? (
            <div className="text-center py-12">
              <FlaskConical className="size-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Pick a batch to begin tracing</h3>
              <p className="text-sm text-muted-foreground">The full lifecycle chain will appear here.</p>
            </div>
          ) : loadingGene ? (
            <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
          ) : !genealogy ? (
            <div className="text-center py-12">
              <AlertCircle className="size-12 text-rose-500 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">No data found for this batch.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Batch summary */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase font-bold text-muted-foreground">Batch</div>
                    <div className="font-mono font-bold text-2xl text-foreground">{genealogy.batch.batch_number}</div>
                    <div className="text-sm font-medium mt-1">{genealogy.batch.product_name || "—"}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                    genealogy.batch.status === "Active" ? "bg-emerald-500/10 text-emerald-600"
                      : genealogy.batch.status === "Quarantined" ? "bg-amber-500/10 text-amber-600"
                        : genealogy.batch.status === "Expired" || (genealogy.batch.expiry_date && new Date(genealogy.batch.expiry_date) < new Date())
                          ? "bg-rose-500/10 text-rose-600"
                          : "bg-slate-500/10 text-slate-600"
                  }`}>
                    {genealogy.batch.status}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3 mt-4">
                  <div className="bg-card p-3 rounded-md">
                    <div className="text-[10px] uppercase text-muted-foreground">Quantity</div>
                    <div className="font-bold text-lg">{genealogy.batch.quantity}</div>
                  </div>
                  <div className="bg-card p-3 rounded-md">
                    <div className="text-[10px] uppercase text-muted-foreground">Remaining</div>
                    <div className="font-bold text-lg">{genealogy.batch.remaining_quantity}</div>
                  </div>
                  <div className="bg-card p-3 rounded-md">
                    <div className="text-[10px] uppercase text-muted-foreground">Mfg Date</div>
                    <div className="font-medium text-xs">{genealogy.batch.manufacturing_date || "—"}</div>
                  </div>
                  <div className="bg-card p-3 rounded-md">
                    <div className="text-[10px] uppercase text-muted-foreground">Expiry</div>
                    <div className="font-medium text-xs">{genealogy.batch.expiry_date || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Serials */}
              {genealogy.serial_count > 0 && (
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">
                    Linked Serials · {genealogy.serial_count}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {genealogy.serials.slice(0, 8).map(s => (
                      <span key={s.id} className="font-mono text-xs px-2 py-1 rounded border bg-card">
                        {s.serial_number}
                      </span>
                    ))}
                    {genealogy.serials.length > 8 && (
                      <span className="text-xs text-muted-foreground">+{genealogy.serials.length - 8} more</span>
                    )}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-3 flex items-center gap-2">
                  <Activity className="size-3" /> Lifecycle · {genealogy.events.length} events
                </div>
                <GenealogyTimeline events={genealogy.events} />
              </div>
            </div>
          )}
        </Card>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <EventModal onClose={() => setModalOpen(false)} onSave={handleEventSave} saving={saving}
            batches={batches} defaultBatchId={selectedBatchId || undefined} />
        )}
      </AnimatePresence>
    </div>
  );
}
