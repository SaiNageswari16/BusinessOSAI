import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Bike,
  MapPin,
  MapPinned,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge, type Tone } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deliveryService,
  type Delivery,
  type DeliveryBoy,
  type DeliveryLiveItem,
  type DeliveryZone,
} from "@/services/deliveryService";
import { resolveActiveOutletId } from "@/services/orderService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery Dispatch — RestaurantOS" },
      {
        name: "description",
        content:
          "Live dispatch board, delivery boys, zones, and order-to-boy assignment.",
      },
    ],
  }),
  component: DeliveryPage,
});

const deliveryTone: Record<string, Tone> = {
  ASSIGNED: "info",
  DELIVERING: "warning",
  DELIVERED: "success",
  CANCELLED: "critical",
};

function normStatus(s: string): string {
  const u = s.toUpperCase();
  return deliveryTone[u] ? u : u;
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function DeliveryPage() {
  const outletId = useMemo(() => resolveActiveOutletId(), []);

  // ── Data state ──
  const [board, setBoard] = useState<DeliveryLiveItem[]>([]);
  const [boys, setBoys] = useState<DeliveryBoy[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);

  // ── UI state ──
  const [boyQuery, setBoyQuery] = useState("");
  const [dispatchTarget, setDispatchTarget] = useState<Delivery | null>(null);
  const [addBoyOpen, setAddBoyOpen] = useState(false);
  const [editZoneTarget, setEditZoneTarget] = useState<DeliveryZone | null>(null);
  const [addZoneOpen, setAddZoneOpen] = useState(false);
  const [createDeliveryOpen, setCreateDeliveryOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const [live, boyList, zoneList] = await Promise.all([
        deliveryService.getLiveBoard(outletId),
        deliveryService.getBoys({ outletId }),
        deliveryService.getZones({ outletId }),
      ]);
      setBoard(live);
      setBoys(boyList);
      setZones(zoneList);
    } catch (e) {
      console.warn("Delivery service unavailable:", e);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Poll the live board — the dispatch screen refreshes without a full reload.
  useEffect(() => {
    const t = setInterval(() => void reload(), 30000);
    return () => clearInterval(t);
  }, [reload]);

  const visibleBoys = useMemo(
    () =>
      boys.filter((b) => {
        const q = boyQuery.trim().toLowerCase();
        if (!q) return true;
        return [b.name, b.phone, b.email, b.area]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      }),
    [boys, boyQuery]
  );

  // ── Dispatch flow: pick open delivery → assign boy ──
  const handleAssign = async (boyId: string, zoneId: string | null, note: string) => {
    if (!dispatchTarget) return;
    setBusy(true);
    try {
      const updated = await deliveryService.assignDelivery(dispatchTarget.id, {
        order_id: dispatchTarget.order_id,
        boy_id: boyId,
        zone_id: zoneId,
        notes: note || undefined,
      });
      toast.success(
        `Dispatched to ${updated.boy_name || boys.find((b) => b.id === boyId)?.name || "driver"}`,
        { description: "Status is ASSIGNED — the board reflects the update." }
      );
      setDispatchTarget(null);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to dispatch delivery");
    } finally {
      setBusy(false);
    }
  };

  const advanceStatus = async (
    d: Delivery,
    toStatus: "delivering" | "delivered" | "cancelled"
  ) => {
    setBusy(true);
    try {
      const updated = await deliveryService.updateStatus(d.id, toStatus);
      toast.success(`Delivery ${toStatus.toUpperCase()}`, {
        description: updated.boy_name ? `Handled by ${updated.boy_name}` : undefined,
      });
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : `Could not move to ${toStatus}`);
    } finally {
      setBusy(false);
    }
  };

  // Group the board by boy (unassigned first — those need dispatching).
  const grouped = useMemo(() => {
    const unassigned = board.filter((x) => !x.delivery.boy_id);
    const byBoy = new Map<string, DeliveryLiveItem[]>();
    for (const x of board.filter((i) => i.delivery.boy_id)) {
      const key = x.boy?.name || "Unknown driver";
      byBoy.set(key, [...(byBoy.get(key) ?? []), x]);
    }
    return { unassigned, byBoy };
  }, [board]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Restaurant Vertical · Operations"
        title="Delivery Dispatch"
        description="Live board of today's open deliveries, driver and zone management, and the order-to-boy dispatch flow."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateDeliveryOpen(true)}>
              <Truck className="size-3.5" /> Open dispatch for order
            </Button>
          </>
        }
      />

      {/* Live dispatch board */}
      <Panel
        title="Live dispatch board"
        subtitle="Open deliveries (ASSIGNED / DELIVERING) created today, newest first. Refreshes every 30s."
        action={
          <span className="text-xs text-muted-foreground tabular">
            {board.length} open
          </span>
        }
      >
        {loading ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            Loading dispatch board…
          </div>
        ) : board.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-xs text-muted-foreground">
            No open deliveries today — use “Open dispatch for order” to start one.
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.unassigned.length > 0 && (
              <div>
                <div className="eyebrow mb-2">Awaiting dispatch ({grouped.unassigned.length})</div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {grouped.unassigned.map((item) => (
                    <DispatchTile
                      key={item.delivery.id}
                      item={item}
                      busy={busy}
                      onDispatch={() => setDispatchTarget(item.delivery)}
                      onDelivering={() => void advanceStatus(item.delivery, "delivering")}
                      onCancel={() => void advanceStatus(item.delivery, "cancelled")}
                      onDelivered={() => void advanceStatus(item.delivery, "delivered")}
                    />
                  ))}
                </div>
              </div>
            )}

            {[...grouped.byBoy.entries()].map(([boyName, items]) => (
              <div key={boyName}>
                <div className="mb-2 flex items-center gap-2">
                  <Bike className="size-3.5 text-primary" />
                  <span className="eyebrow">{boyName}</span>
                  <span className="text-xs text-muted-foreground tabular">
                    {items.length} active
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => (
                    <DispatchTile
                      key={item.delivery.id}
                      item={item}
                      busy={busy}
                      onDispatch={() => setDispatchTarget(item.delivery)}
                      onDelivering={() => void advanceStatus(item.delivery, "delivering")}
                      onCancel={() => void advanceStatus(item.delivery, "cancelled")}
                      onDelivered={() => void advanceStatus(item.delivery, "delivered")}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Delivery boys CRUD */}
        <Panel
          title="Delivery boys"
          subtitle="Drivers available for dispatch at this outlet"
          action={
            <Button size="sm" variant="outline" onClick={() => setAddBoyOpen(true)}>
              <Plus className="size-3.5" /> Add boy
            </Button>
          }
        >
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={boyQuery}
              onChange={(e) => setBoyQuery(e.target.value)}
              placeholder="Search by name, phone, email or area…"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {visibleBoys.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
                No boys match — add one to start dispatching.
              </div>
            ) : (
              visibleBoys.map((b) => (
                <div
                  key={b.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border bg-card p-2.5",
                    !b.active && "opacity-60"
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <User className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {b.name}
                      {b.phone && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Phone className="size-3" /> {b.phone}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {[b.email, b.area, b.notes].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <Switch
                    checked={b.active}
                    onCheckedChange={(v) => void toggleBoy(b, v)}
                    aria-label={`Toggle ${b.name} active`}
                  />
                </div>
              ))
            )}
          </div>
        </Panel>

        {/* Zones CRUD */}
        <Panel
          title="Delivery zones / areas"
          subtitle="Serviceable areas with radius and pincode"
          action={
            <Button size="sm" variant="outline" onClick={() => setAddZoneOpen(true)}>
              <Plus className="size-3.5" /> Add zone
            </Button>
          }
        >
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {zones.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
                No zones configured yet.
              </div>
            ) : (
              zones.map((z) => (
                <div
                  key={z.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border bg-card p-2.5",
                    !z.active && "opacity-60"
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-info/10 text-info">
                    <MapPin className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{z.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {z.radius_km} km radius
                      {z.pincode ? ` · ${z.pincode}` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setEditZoneTarget(z)}
                  >
                    <Pencil className="size-3" /> Edit
                  </Button>
                  <Switch
                    checked={z.active}
                    onCheckedChange={(v) => void toggleZone(z, v)}
                    aria-label={`Toggle ${z.name} active`}
                  />
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* Assign-boy dialog */}
      <AssignBoyDialog
        delivery={dispatchTarget}
        boys={boys.filter((b) => b.active)}
        zones={zones.filter((z) => z.active)}
        busy={busy}
        onClose={() => setDispatchTarget(null)}
        onAssign={(boyId, zoneId, note) => void handleAssign(boyId, zoneId, note)}
      />

      {/* Add delivery boy form */}
      <AddBoyDialog
        outletId={outletId}
        open={addBoyOpen}
        onClose={() => setAddBoyOpen(false)}
        onSaved={() => {
          setAddBoyOpen(false);
          void reload();
        }}
      />

      {/* Add / edit zone forms */}
      <ZoneFormDialog
        outletId={outletId}
        open={addZoneOpen}
        onClose={() => setAddZoneOpen(false)}
        onSaved={() => {
          setAddZoneOpen(false);
          void reload();
        }}
      />
      <ZoneFormDialog
        outletId={outletId}
        open={!!editZoneTarget}
        initial={editZoneTarget ?? undefined}
        onClose={() => setEditZoneTarget(null)}
        onSaved={() => {
          setEditZoneTarget(null);
          void reload();
        }}
      />

      {/* Open a dispatch for an order */}
      <CreateDeliveryDialog
        boys={boys.filter((b) => b.active)}
        zones={zones.filter((z) => z.active)}
        open={createDeliveryOpen}
        onClose={() => setCreateDeliveryOpen(false)}
        onCreated={async (orderId, zoneId, boyId, note) => {
          try {
            setBusy(true);
            const d = await deliveryService.createDelivery({
              order_id: orderId.trim(),
              zone_id: zoneId,
              boy_id: boyId,
              notes: note || undefined,
            });
            toast.success(
              boyId
                ? "Dispatch opened — driver assigned"
                : "Delivery opened — pending on the board"
            );
            void reload();
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to open delivery";
            toast.error(msg, { description: "A delivery may already exist for this order." });
          } finally {
            setBusy(false);
            setCreateDeliveryOpen(false);
          }
        }}
      />
    </PageContainer>
  );

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  async function toggleBoy(b: DeliveryBoy, active: boolean) {
    try {
      await deliveryService.updateBoy(b.id, { active });
      toast.success(`${b.name} is now ${active ? "active" : "inactive"}`);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update driver");
    }
  }

  async function toggleZone(z: DeliveryZone, active: boolean) {
    try {
      await deliveryService.updateZone(z.id, { active });
      toast.success(`Zone "${z.name}" is now ${active ? "active" : "inactive"}`);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update zone");
    }
  }
}

// ── Board tile ───────────────────────────────────────────────────────────────

function DispatchTile({
  item,
  onDispatch,
  onDelivering,
  onDelivered,
  onCancel,
  busy,
}: {
  item: DeliveryLiveItem;
  onDispatch: () => void;
  onDelivering: () => void;
  onDelivered: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const d = item.delivery;
  const s = normStatus(d.status);
  return (
    <article className="panel space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-foreground">
          {String(d.order_id).slice(0, 8)}…
        </span>
        <StatusBadge status={s} tone={deliveryTone[s] ?? "neutral"} />
      </div>
      <div className="space-y-0.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Bike className="size-3.5" />
          {item.boy ? item.boy.name : "Unassigned — pick a driver"}
        </div>
        {d.zone_name && (
          <div className="flex items-center gap-1.5">
            <MapPinned className="size-3.5" /> {d.zone_name}
          </div>
        )}
        <div className="text-[11px]">Updated {timeAgo(d.assigned_at ?? d.updated_at)}</div>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t pt-2">
        <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={onDispatch}>
          <Send className="size-3" /> Dispatch
        </Button>
        {s === "ASSIGNED" && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onDelivering}>
            Delivered soon? Start
          </Button>
        )}
        {s === "DELIVERING" && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onDelivered}>
            Mark delivered
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-critical hover:text-critical"
          disabled={busy}
          onClick={onCancel}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </article>
  );
}

// ── Assign-boy dialog ────────────────────────────────────────────────────────

function AssignBoyDialog({
  delivery,
  boys,
  zones,
  busy,
  onClose,
  onAssign,
}: {
  delivery: Delivery | null;
  boys: DeliveryBoy[];
  zones: DeliveryZone[];
  busy: boolean;
  onClose: () => void;
  onAssign: (boyId: string, zoneId: string | null, note: string) => void;
}) {
  const [boyId, setBoyId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    // Reset when a new delivery is targeted.
    setBoyId(delivery?.boy_id || boys[0]?.id || "");
    setZoneId(delivery?.zone_id || "");
    setNote("");
  }, [delivery?.id, boys, delivery?.boy_id, delivery?.zone_id]);

  return (
    <Dialog open={!!delivery} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="size-4 text-primary" />
            Dispatch order {delivery ? String(delivery.order_id).slice(0, 8) : ""}…
          </DialogTitle>
          <DialogDescription>
            Pick a driver and optional zone. The delivery moves to ASSIGNED; use the board to
            advance it to DELIVERING → DELIVERED.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Driver *</Label>
            <Select value={boyId || "none"} onValueChange={(v) => setBoyId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a driver" />
              </SelectTrigger>
              <SelectContent>
                {boys.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                    {b.area ? ` · ${b.area}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {boys.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No active drivers yet — add one above.
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Zone</Label>
            <Select value={zoneId || "none"} onValueChange={(v) => setZoneId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No zone (outlet default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No zone (outlet default)</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name} ({z.radius_km} km)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Note</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional dispatch note"
              className="h-8 text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-3.5" /> Cancel
          </Button>
          <Button size="sm" disabled={!boyId || busy} onClick={() => onAssign(boyId, zoneId || null, note)}>
            <Send className="size-3.5" /> Assign & Dispatch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add delivery boy form ────────────────────────────────────────────────────

function AddBoyDialog({
  outletId,
  open,
  onClose,
  onSaved,
}: {
  outletId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Driver name is required");
      return;
    }
    setSaving(true);
    try {
      await deliveryService.createBoy({
        outlet_id: outletId,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        area: area.trim() || null,
      });
      toast.success(`Driver "${name.trim()}" added`);
      onSaved();
      setName("");
      setPhone("");
      setEmail("");
      setArea("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add driver");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="size-4 text-primary" /> Add delivery boy
          </DialogTitle>
          <DialogDescription>Register a driver for dispatch at this outlet.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Name *">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ravi Kumar" className="h-8 text-xs" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" className="h-8 font-mono text-xs" />
            </Field>
            <Field label="Email">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" className="h-8 text-xs" />
            </Field>
          </div>
          <Field label="Area / zone">
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Gachibowli" className="h-8 text-xs" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void submit()}>
            <Plus className="size-3.5" /> Add driver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Zone form (add + edit) ───────────────────────────────────────────────────

function ZoneFormDialog({
  outletId,
  open,
  initial,
  onClose,
  onSaved,
}: {
  outletId: string;
  open: boolean;
  /** When set, the dialog edits this zone (id-driven update). */
  initial?: DeliveryZone;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [radius, setRadius] = useState("5");
  const [pincode, setPincode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Sync when the dialog target changes.
    setName(initial?.name ?? "");
    setRadius(String(initial?.radius_km ?? 5));
    setPincode(initial?.pincode ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Zone name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        radius_km: parseFloat(radius) || 5,
        pincode: pincode.trim() || null,
      };
      if (initial) {
        await deliveryService.updateZone(initial.id, payload);
        toast.success(`Zone "${name.trim()}" updated`);
      } else {
        await deliveryService.createZone({ outlet_id: outletId, ...payload });
        toast.success(`Zone "${name.trim()}" created`);
      }
      onSaved();
      setName("");
      setRadius("5");
      setPincode("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save zone");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            {initial ? "Edit delivery zone" : "Add delivery zone"}
          </DialogTitle>
          <DialogDescription>Serviceable area, delivery radius, and pincode.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Zone name *">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hitec City" className="h-8 text-xs" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Radius (km)">
              <Input value={radius} onChange={(e) => setRadius(e.target.value)} type="number" min="0" step="0.5" className="h-8 text-xs" />
            </Field>
            <Field label="Pincode">
              <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="500034" className="h-8 font-mono text-xs" />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void save()}>
            {initial ? "Save changes" : "Add zone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create delivery for an order ─────────────────────────────────────────────

function CreateDeliveryDialog({
  boys,
  zones,
  open,
  onClose,
  onCreated,
}: {
  boys: DeliveryBoy[];
  zones: DeliveryZone[];
  open: boolean;
  onClose: () => void;
  onCreated: (orderId: string, zoneId: string | null, boyId: string | null, note: string) => void;
}) {
  const [orderId, setOrderId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [boyId, setBoyId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setOrderId("");
      setZoneId("");
      setBoyId("");
      setNote("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open a dispatch for an order</DialogTitle>
          <DialogDescription>
            Enter the POS order ID. Leave the driver blank to queue it on the board, or assign now.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Order ID / number *">
            <Input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. 3f2a9c1b-… or ORD-0042"
              className="h-8 font-mono text-xs"
            />
          </Field>
          <Field label="Driver (optional)">
            <Select value={boyId || "none"} onValueChange={(v) => setBoyId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Queue without driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Queue without driver</SelectItem>
                {boys.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Zone (optional)">
            <Select value={zoneId || "none"} onValueChange={(v) => setZoneId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No zone</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className="h-8 text-xs" />
          </Field>
        </div>
        <DialogFooter>
          <Button
            size="sm"
            disabled={!orderId.trim()}
            onClick={() => {
              onCreated(orderId, zoneId || null, boyId || null, note);
            }}
          >
            <Truck className="size-3.5" /> Create delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
    </div>
  );
}
