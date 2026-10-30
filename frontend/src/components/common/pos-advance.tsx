import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarClock,
  Play,
  Printer,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, type Tone } from "@/components/common/StatusBadge";
import { posService } from "@/services/posService";
import {
  kitchenService,
  type KOTPrintPreview,
  type KOTListResponse,
} from "@/services/kitchenService";
import { resolveActiveOutletId } from "@/services/orderService";

const kotTone: Record<string, Tone> = {
  PENDING: "info",
  ACKNOWLEDGED: "info",
  PREPARING: "warning",
  READY: "success",
  SERVED: "neutral",
  CANCELLED: "critical",
};

// ── Advance Orders (scheduled) ───────────────────────────────────────────────

interface ScheduledOrder {
  id: string;
  order_number?: string;
  scheduled_for?: string | null;
  status?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  [k: string]: unknown;
}

export function AdvanceOrdersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const outletId = resolveActiveOutletId();
  const [due, setDue] = useState<ScheduledOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  // Schedule form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = await posService.getDueScheduledOrders({ outletId });
      setDue(Array.isArray(res) ? res : (res as unknown as { items?: ScheduledOrder[] })?.items ?? []);
    } catch (e) {
      console.warn("Scheduled orders unavailable:", e);
      setDue([]);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  const schedule = async () => {
    if (!scheduledFor) {
      toast.error("Pick the time to run the order");
      return;
    }
    setSaving(true);
    try {
      await posService.scheduleOrder({
        outlet_id: outletId,
        order_type: "dine_in",
        scheduled_for: new Date(scheduledFor).toISOString(),
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(`Advance order scheduled for ${new Date(scheduledFor).toLocaleString()}`, {
        description: customerName.trim() ? `Reserved for ${customerName.trim()}` : undefined,
      });
      setCustomerName("");
      setCustomerPhone("");
      setScheduledFor("");
      setNotes("");
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to schedule order");
    } finally {
      setSaving(false);
    }
  };

  const activate = async (id: string) => {
    setActivating(id);
    try {
      await posService.activateScheduledOrder(id);
      toast.success("Advance order activated now — fired to the kitchen");
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to activate order");
    } finally {
      setActivating(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" /> Advance orders
          </DialogTitle>
          <DialogDescription>
            Schedule an order to run at a set time, and activate any that are due.
          </DialogDescription>
        </DialogHeader>

        {/* Schedule form */}
        <div className="space-y-2.5 rounded-lg border bg-surface p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Send className="size-3.5" /> Schedule an order
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Customer</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Guest name"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Phone</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Optional"
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Scheduled for *</Label>
            <Input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. party of 4, 5 course tasting"
              className="text-xs"
            />
          </div>
          <Button size="sm" disabled={saving} onClick={() => void schedule()}>
            <CalendarClock className="size-3.5" /> {saving ? "Scheduling…" : "Schedule advance order"}
          </Button>
        </div>

        {/* Due scheduled orders */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Play className="size-3.5" /> Due scheduled orders ({due.length})
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void reload()}>
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
          {loading ? (
            <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
              Loading due orders…
            </div>
          ) : due.length === 0 ? (
            <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
              No scheduled orders are due yet.
            </div>
          ) : (
            <div className="space-y-2">
              {due.map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {o.customer_name || o.order_number || String(o.id).slice(0, 8)}
                      {o.scheduled_for && (
                        <span className="text-[11px] text-muted-foreground">
                          due {new Date(o.scheduled_for).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    {o.status && (
                      <div className="text-[11px] text-muted-foreground">status: {o.status}</div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={activating === o.id}
                    onClick={() => void activate(o.id)}
                  >
                    <Play className="size-3.5" /> {activating === o.id ? "Activating…" : "Activate now"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── KOT lookup by order number ───────────────────────────────────────────────

export function KotLookupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [tickets, setTickets] = useState<KOTListResponse["tickets"][number][]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Per-KOT status overrides + print preview modal
  const [preview, setPreview] = useState<KOTPrintPreview | null>(null);

  const lookup = async () => {
    if (!query.trim()) {
      toast.error("Enter an order number to look up");
      return;
    }
    try {
      setLoading(true);
      setSearched(true);
      const res = await kitchenService.getKOTsByNumber(query.trim());
      setTickets(res.tickets);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "KOT lookup failed");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setQuery("");
      setTickets([]);
      setSearched(false);
      setPreview(null);
    }
  }, [open]);

  const bump = async (id: string, action: "ready" | "served") => {
    try {
      const fn = action === "ready" ? kitchenService.markReady : kitchenService.markServed;
      await fn(id);
      toast.success(`KOT ${action === "ready" ? "marked ready" : "marked served"}`);
      await lookup();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update KOT");
    }
  };

  const printPreview = async (id: string) => {
    try {
      const p = await kitchenService.getKOTPrintPreview(id);
      setPreview(p);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No print preview available");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="size-4 text-primary" /> KOT lookup by number
          </DialogTitle>
          <DialogDescription>
            Type an order number to list its KOTs, with ready / served and print actions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void lookup()}
              placeholder="Order number, e.g. 1048 or ORD-1048"
              className="h-8 pl-8 font-mono text-xs"
            />
          </div>
          <Button size="sm" variant="secondary" disabled={loading} onClick={() => void lookup()}>
            <Search className="size-3.5" /> {loading ? "…" : "Lookup"}
          </Button>
        </div>

        {searched && (
          <div className="space-y-2">
            {tickets.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                <AlertCircle className="mx-auto size-4" />
                <span>No open KOTs found for “{query}”.</span>
              </div>
            ) : (
              tickets.map((t) => {
                const s = String(t.status).toUpperCase();
                const open = s !== "SERVED" && s !== "CANCELLED";
                return (
                  <div key={t.id} className="rounded-lg border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold">
                        {t.kot_number}
                        {t.order_number ? ` · ${t.order_number}` : ""}
                      </span>
                      {t.table_name && (
                        <span className="text-[11px] text-muted-foreground">{t.table_name}</span>
                      )}
                      <StatusBadge status={s} tone={kotTone[s] ?? "neutral"} />
                      {t.priority !== "normal" && t.priority && (
                        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning uppercase">
                          {t.priority}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {open && s !== "READY" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void bump(t.id, "ready")}>
                          Mark ready
                        </Button>
                      )}
                      {open && s === "READY" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void bump(t.id, "served")}>
                          Mark served
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void printPreview(t.id)}>
                        <Printer className="size-3.5" /> Print
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Monospace KOT print preview */}
        {preview && (
          <KotPreviewModal preview={preview} onClose={() => setPreview(null)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Monospace receipt modal for the KOT print preview ────────────────────────

function KotPreviewModal({
  preview,
  onClose,
}: {
  preview: KOTPrintPreview;
  onClose: () => void;
}) {
  const items = (preview.items || []) as {
    name?: string;
    variant_name?: string;
    qty?: number;
    notes?: string;
    modifiers?: unknown[];
  }[];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs bg-slate-900 p-4 text-white">
        <DialogHeader>
          <DialogTitle className="text-sm text-white">
            <Printer className="mr-1.5 inline size-4" />
            KOT {preview.kot_number}
            {preview.station_name ? ` · ${preview.station_name}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="bg-white text-slate-900 p-3 font-mono text-[11px] shadow-2xl">
          <div className="border-b-2 border-slate-900 pb-1 text-center">
            <div className="font-bold uppercase tracking-widest">Kitchen Order Ticket</div>
            {preview.order_number && <div>Order: {preview.order_number}</div>}
            {preview.table_name && <div>Table: {preview.table_name}</div>}
            <div className="flex justify-between">
              <span>Covers: {preview.covers}</span>
              <span>{preview.priority?.toUpperCase()}</span>
            </div>
          </div>
          <div className="space-y-1.5 py-2">
            {items.length === 0 ? (
              <div className="text-center text-slate-400">No items</div>
            ) : (
              items.map((it, i) => (
                <div key={i}>
                  <div className="flex justify-between font-bold">
                    <span>
                      {it.qty != null ? `${it.qty}× ` : ""}
                      {it.name || it.variant_name || "item"}
                    </span>
                    <span>{it.name ? "" : it.variant_name}</span>
                  </div>
                  {(it.notes || (it.modifiers && (it.modifiers as unknown[]).length)) && (
                    <div className="pl-3 text-[10px] text-rose-600">
                      → {[it.notes, ...(it.modifiers as unknown[])].filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="border-t-2 border-slate-900 pt-1.5 text-center font-bold">
            {preview.item_count} item(s) ·{" "}
            {preview.fired_at
              ? new Date(preview.fired_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : ""}
          </div>
        </div>
        <DialogFooter className="bg-slate-900">
          <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
