import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Cpu,
  HeartPulse,
  Link2,
  Plus,
  Printer,
  RefreshCw,
  Repeat,
  Send,
  Trash2,
  Unlink,
} from "lucide-react";
import { Panel } from "@/components/common/PageHeader";
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
  printersService,
  type Printer as PrinterRecord,
  type PrinterDevice,
  type PrintJob,
  type ReceiptPreview,
} from "@/services/printersService";
import { resolveActiveOutletId } from "@/services/orderService";
import { cn } from "@/lib/utils";

const healthTone: Record<string, Tone> = {
  HEALTHY: "success",
  UNREACHABLE: "critical",
  UNKNOWN: "neutral",
};

const jobTone: Record<string, Tone> = {
  QUEUED: "warning",
  SENT: "info",
  ACKED: "success",
  FAILED: "critical",
  EXPIRED: "neutral",
};

function lastSeenLabel(iso?: string | null): string {
  if (!iso) return "never seen";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/**
 * Printers / devices / print-queue / receipt-preview settings section.
 * Rendered as a tab inside Settings — the natural home alongside the
 * existing thermal-receipt configuration.
 */
export function PrintersSettingsSection() {
  const outletId = useMemo(() => resolveActiveOutletId(), []);

  const [printers, setPrinters] = useState<PrinterRecord[]>([]);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);
  const [previewQuery, setPreviewQuery] = useState("");
  const [previewType, setPreviewType] = useState("KOT");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [addPrinterOpen, setAddPrinterOpen] = useState(false);
  const [registerDeviceOpen, setRegisterDeviceOpen] = useState(false);
  const [bindTarget, setBindTarget] = useState<PrinterDevice | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const [p, d, j] = await Promise.all([
        printersService.getPrinters(outletId),
        printersService.getDevices(outletId),
        printersService.getJobs({ limit: 30 }),
      ]);
      setPrinters(p);
      setDevices(d);
      setJobs(j);
    } catch (e) {
      console.warn("Printers service unavailable:", e);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ── Printer actions ──
  const testPrint = async (printerId: string, name: string) => {
    setBusy(true);
    try {
      const job = await printersService.testPrint(printerId);
      toast.success(`Test job queued for "${name}"`, {
        description: job.status ? `Job status: ${job.status}` : undefined,
      });
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Test print failed");
    } finally {
      setBusy(false);
    }
  };

  const heartbeat = async (printerId: string) => {
    try {
      await printersService.printerHeartbeat(printerId);
      toast.success("Printer heartbeat recorded");
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Heartbeat failed");
    }
  };

  const removePrinter = async (p: PrinterRecord) => {
    try {
      setBusy(true);
      await printersService.deletePrinter(p.id);
      toast.success(`Printer "${p.name}" removed`);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to remove printer");
    } finally {
      setBusy(false);
    }
  };

  // ── Device actions ──
  const bindPrinter = async (deviceCode: string, printerId: string | null) => {
    try {
      setBusy(true);
      await printersService.bindDevice(deviceCode, { printer_id: printerId });
      toast.success(
        printerId
          ? `Device ${deviceCode} bound to printer ${printerId.slice(0, 8)}`
          : `Device ${deviceCode} unbound`
      );
      setBindTarget(null);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to bind device");
    } finally {
      setBusy(false);
    }
  };

  const revokeDevice = async (d: PrinterDevice) => {
    try {
      setBusy(true);
      await printersService.revokeDevice(d.device_code);
      toast.success(`Device ${d.device_code} revoked`);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke device");
    } finally {
      setBusy(false);
    }
  };

  // ── Job actions ──
  const retryJob = async (job: PrintJob) => {
    try {
      setBusy(true);
      const res = await printersService.retryJob(job.id);
      toast.success(`Job re-queued (${res.status}, retry ${res.retry})`);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Retry failed — retry budget may be exhausted");
    } finally {
      setBusy(false);
    }
  };

  // ── Receipt preview ──
  const runPreview = async () => {
    if (!previewQuery.trim()) {
      toast.error("Enter a KOT / bill / order number to preview");
      return;
    }
    try {
      setLoading(true);
      const p = await printersService.getReceiptPreview(previewType, previewQuery.trim());
      setPreview(p);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No print job found for that reference");
    } finally {
      setLoading(false);
    }
  };

  const boundPrinterName = (printerId?: string | null) =>
    printers.find((p) => p.id === printerId)?.name;

  return (
    <div className="space-y-6">
      {/* Printers list / CRUD */}
      <Panel
        title="Printers"
        subtitle="Physical print destinations registered for this outlet"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAddPrinterOpen(true)}>
              <Plus className="size-3.5" /> Add printer
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          {loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading printers…</div>
          ) : printers.length === 0 ? (
            <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
              No printers registered — add one to route KOT / bill / order prints.
            </div>
          ) : (
            printers.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3",
                  !p.active && "opacity-60"
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Printer className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {p.name}
                    <StatusBadge status={p.health} tone={healthTone[p.health] ?? "neutral"} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.printer_type} · {p.host || "local"}:{p.port}
                    {p.paper_width_mm ? ` · ${p.paper_width_mm}mm` : ""} · last seen{" "}
                    {lastSeenLabel(p.last_seen_at)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void testPrint(p.id, p.name)}
                >
                  <Send className="size-3.5" /> Test print
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void heartbeat(p.id)}
                  title="Mark this printer reachable now"
                >
                  <HeartPulse className="size-3.5" />
                </Button>
                <Switch
                  checked={p.active}
                  onCheckedChange={(v) =>
                    void (async () => {
                      try {
                        await printersService.updatePrinter(p.id, { active: v });
                        toast.success(`Printer ${v ? "enabled" : "disabled"}`);
                        await reload();
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : "Failed to toggle printer");
                      }
                    })()
                  }
                  aria-label={`Toggle ${p.name} active`}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-critical hover:text-critical"
                  disabled={busy}
                  onClick={() => void removePrinter(p)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Device registration */}
        <Panel
          title="Devices"
          subtitle="Pair POS / KDS / tablet devices by code, bind to a printer"
          action={
            <Button size="sm" variant="outline" onClick={() => setRegisterDeviceOpen(true)}>
              <Plus className="size-3.5" /> Register device
            </Button>
          }
        >
          <div className="space-y-2">
            {devices.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
                No devices registered yet.
              </div>
            ) : (
              devices.map((d) => (
                <div key={d.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Cpu className="size-4 text-muted-foreground" />
                      <span className="font-mono text-xs font-semibold">{d.device_code}</span>
                      <span className="text-[11px] text-muted-foreground">{d.device_kind}</span>
                    </div>
                    <StatusBadge
                      status={d.status}
                      tone={
                        d.status === "BOUND"
                          ? "success"
                          : d.status === "PENDING"
                            ? "warning"
                            : "neutral"
                      }
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {d.bound_printer_id
                        ? `Bound to ${boundPrinterName(d.bound_printer_id) || d.bound_printer_id.slice(0, 8)}`
                        : "Unbound"}
                      {" · "}heartbeat {lastSeenLabel(d.last_heartbeat_at)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px]"
                        onClick={() => setBindTarget(d)}
                      >
                        <Link2 className="size-3" /> Bind
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px] text-critical"
                        onClick={() => void revokeDevice(d)}
                      >
                        <Unlink className="size-3" /> Revoke
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        {/* Receipt preview panel */}
        <Panel
          title="Receipt preview"
          subtitle="Renders the last print job's payload at the destination paper width"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={previewType} onValueChange={setPreviewType}>
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KOT">KOT</SelectItem>
                  <SelectItem value="BILL">Bill</SelectItem>
                  <SelectItem value="ORDER">Order</SelectItem>
                  <SelectItem value="TEST">Test</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={previewQuery}
                onChange={(e) => setPreviewQuery(e.target.value)}
                placeholder="Document number (e.g. KOT-0042)"
                className="h-8 flex-1 font-mono text-xs"
              />
              <Button size="sm" variant="outline" onClick={() => void runPreview()}>
                <Printer className="size-3.5" /> Preview
              </Button>
            </div>

            {preview ? (
              <ReceiptPreviewMonospace preview={preview} />
            ) : (
              <div className="rounded-md border border-dashed py-10 text-center text-xs text-muted-foreground">
                No preview loaded — pick a source and a document number.
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Print jobs queue */}
      <Panel
        title="Print jobs queue"
        subtitle="Recent jobs across destinations — retry failed ones (bounded retry budget)"
      >
        <div className="space-y-2">
          {jobs.length === 0 ? (
            <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
              No print jobs recorded yet.
            </div>
          ) : (
            jobs.map((j) => (
              <div
                key={j.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-2.5"
              >
                <span className="font-mono text-xs font-semibold">
                  {j.source_type} · {j.source_ref}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  dest {j.destination} · {new Date(j.requested_at).toLocaleString()}
                  {j.last_error ? ` · ${j.last_error}` : ""}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <StatusBadge status={j.status} tone={jobTone[j.status] ?? "neutral"} />
                  <span className="text-[11px] text-muted-foreground tabular">retry {j.retry}</span>
                  {(j.status === "FAILED" || j.status === "EXPIRED") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={busy}
                      onClick={() => void retryJob(j)}
                    >
                      <Repeat className="size-3" /> Retry
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      {/* Add printer dialog */}
      <AddPrinterDialog
        outletId={outletId}
        open={addPrinterOpen}
        onClose={() => setAddPrinterOpen(false)}
        onCreated={() => {
          setAddPrinterOpen(false);
          void reload();
        }}
      />

      {/* Register device dialog */}
      <RegisterDeviceDialog
        outletId={outletId}
        open={registerDeviceOpen}
        onClose={() => setRegisterDeviceOpen(false)}
        onCreated={() => {
          setRegisterDeviceOpen(false);
          void reload();
        }}
      />

      {/* Bind device to printer dialog */}
      <Dialog open={!!bindTarget} onOpenChange={(o) => !o && setBindTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Bind device <span className="font-mono text-xs">{bindTarget?.device_code}</span>
            </DialogTitle>
            <DialogDescription>Route this device's prints to a registered printer.</DialogDescription>
          </DialogHeader>
          <BindPicker
            printers={printers}
            busy={busy}
            onPick={(id) => bindTarget && void bindPrinter(bindTarget.device_code, id)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Simple monospace thermal receipt render of the preview payload ─────────

function ReceiptPreviewMonospace({ preview }: { preview: ReceiptPreview }) {
  const w = preview.paper_width_mm === 58 ? "w-[235px]" : "w-[310px]";
  const line = "border-b border-dashed border-slate-300";
  const items = preview.items || [];
  const rows = preview.lines || [];

  return (
    <div
      className={cn(
        "bg-white text-slate-900 font-mono shadow-2xl border border-slate-300 p-4 select-none",
        w
      )}
    >
      <div className="text-center text-[10px] font-bold uppercase tracking-widest">
        {preview.source_type} · {preview.source_ref}
      </div>
      {preview.order_number && (
        <div className="mt-1 text-center text-[10px]">Order {preview.order_number}</div>
      )}
      <div className={cn("mt-2 py-1.5", line)}>
        {items.length > 0 ? (
          items.map((it, i) => (
            <div key={i} className="flex justify-between text-[10px]">
              <span className="flex-1 pr-1">
                {it.qty != null ? `${it.qty}× ` : ""}
                {String(it.name ?? it.variant_name ?? "item")}
              </span>
              <span className="tabular">
                {it.amount != null ? String(it.amount) : it.unit_price != null ? String(it.unit_price) : ""}
              </span>
            </div>
          ))
        ) : (
          <div className="text-[10px] text-slate-400">No line items in payload</div>
        )}
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between text-[10px]">
            <span>{r.label ?? ""}</span>
            <span className="tabular">{r.value ?? ""}</span>
          </div>
        ))}
      </div>
      {preview.totals && Object.keys(preview.totals).length > 0 && (
        <div className="py-1.5 text-[10px]">
          {preview.totals.subtotal != null && (
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular">{preview.totals.subtotal}</span>
            </div>
          )}
          {preview.totals.tax_total != null && (
            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span className="tabular">{preview.totals.tax_total}</span>
            </div>
          )}
          {preview.totals.grand_total != null && (
            <div className="mt-1 flex justify-between border-t-2 border-slate-900 pt-1 text-sm font-extrabold">
              <span>TOTAL</span>
              <span className="tabular">{preview.totals.grand_total}</span>
            </div>
          )}
        </div>
      )}
      {preview.notes && (
        <div className="pt-1 text-center text-[9px] text-slate-500">{preview.notes}</div>
      )}
    </div>
  );
}

// ── Add printer form ─────────────────────────────────────────────────────────

function AddPrinterDialog({
  outletId,
  open,
  onClose,
  onCreated,
}: {
  outletId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState("9100");
  const [type, setType] = useState("THERMAL");
  const [paper, setPaper] = useState("80");
  const [dest, setDest] = useState("RECEIPT");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Printer name is required");
      return;
    }
    setSaving(true);
    try {
      await printersService.createPrinter({
        name: name.trim(),
        outlet_id: outletId,
        printer_type: type,
        host: host.trim(),
        port: parseInt(port) || 9100,
        paper_width_mm: paper ? parseInt(paper) : null,
        default_destination: dest as never,
        model: model.trim() || null,
      });
      toast.success(`Printer "${name.trim()}" registered`);
      onCreated();
      setName("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to register printer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="size-4 text-primary" /> Register printer
          </DialogTitle>
          <DialogDescription>ESC/POS raw (port 9100) or network destination.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Printer name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Counter 80mm" className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Host</Label>
              <Input value={host} onChange={(e) => setHost(e.target.value)} className="h-8 font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Port</Label>
              <Input value={port} onChange={(e) => setPort(e.target.value)} className="h-8 font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Paper mm</Label>
              <Input value={paper} onChange={(e) => setPaper(e.target.value)} placeholder="80" className="h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="THERMAL">Thermal</SelectItem>
                  <SelectItem value="LASER">Laser</SelectItem>
                  <SelectItem value="NETWORK">Network</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Default destination</Label>
              <Select value={dest} onValueChange={setDest}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEIPT">Receipt</SelectItem>
                  <SelectItem value="KDS">KDS</SelectItem>
                  <SelectItem value="CHEF">Chef</SelectItem>
                  <SelectItem value="BAR">Bar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Model (optional)</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Epson TM-T82" className="h-8 text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void submit()}>
            <Plus className="size-3.5" /> Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Register device (pairing code) form ─────────────────────────────────────

function RegisterDeviceDialog({
  outletId,
  open,
  onClose,
  onCreated,
}: {
  outletId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState("POS");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!code.trim()) {
      toast.error("Device pairing code is required");
      return;
    }
    setSaving(true);
    try {
      await printersService.registerDevice({
        device_code: code.trim(),
        outlet_id: outletId,
        device_kind: kind as never,
      });
      toast.success(`Device "${code.trim()}" registered (PENDING)`);
      onCreated();
      setCode("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to register device");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="size-4 text-primary" /> Register device
          </DialogTitle>
          <DialogDescription>
            Enter the pairing code the device is showing, then bind it to a printer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Pairing code *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. POS-8F3A-21" className="h-8 font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Device kind</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POS">POS terminal</SelectItem>
                <SelectItem value="KDS">KDS display</SelectItem>
                <SelectItem value="TABLET">Tablet</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void submit()}>
            <Plus className="size-3.5" /> Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BindPicker({
  printers,
  busy,
  onPick,
}: {
  printers: PrinterRecord[];
  busy: boolean;
  onPick: (printerId: string | null) => void;
}) {
  return (
    <div className="space-y-2 py-2">
      <Label className="text-xs font-semibold">Destination printer</Label>
      <div className="flex flex-wrap gap-1.5">
        {printers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            disabled={busy}
            className="rounded-md border px-2.5 py-1 text-xs font-medium transition hover:bg-accent disabled:opacity-50"
          >
            {p.name}
            {p.default_destination ? ` · ${p.default_destination.toLowerCase()}` : ""}
          </button>
        ))}
        {printers.length === 0 && (
          <span className="text-xs text-muted-foreground">No printers to bind yet.</span>
        )}
      </div>
      <Button variant="ghost" size="sm" className="text-critical" disabled={busy} onClick={() => onPick(null)}>
        <Unlink className="size-3.5" /> Unbind device
      </Button>
    </div>
  );
}
