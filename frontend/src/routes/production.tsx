import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Beef,
  CheckCircle2,
  FileUp,
  FlaskConical,
  ListChecks,
  Package,
  Play,
  Plus,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge, type Tone } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  productionService,
  type ExcelImportRow,
  type ProductionPlanLine,
  type ProductionProcess,
  type ProductionRun,
} from "@/services/productionService";
import { resolveActiveOutletId } from "@/services/orderService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/production")({
  head: () => ({
    meta: [
      { title: "Production & Process Masters — RestaurantOS" },
      {
        name: "description",
        content:
          "Process masters, production runs, planning, and spreadsheet import for in-house production.",
      },
    ],
  }),
  component: ProductionPage,
});

const runTone: Record<string, Tone> = {
  planned: "info",
  started: "warning",
  completed: "success",
  cancelled: "critical",
};

function ProductionPage() {
  const outletId = useMemo(() => resolveActiveOutletId(), []);

  const [processes, setProcesses] = useState<ProductionProcess[]>([]);
  const [runs, setRuns] = useState<ProductionRun[]>([]);
  const [plans, setPlans] = useState<ProductionPlanLine[]>([]);
  const [loading, setLoading] = useState(true);

  // ── UI state ──
  const [masterOpen, setMasterOpen] = useState(false);
  const [startRunTarget, setStartRunTarget] = useState<ProductionProcess | null>(null);
  const [completeRunTarget, setCompleteRunTarget] = useState<ProductionRun | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [runFilter, setRunFilter] = useState("all");
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const [proc, run, plan] = await Promise.all([
        productionService.getProcesses(outletId),
        productionService.getRuns({ outletId }),
        productionService.getPlans({ outletId }),
      ]);
      setProcesses(proc);
      setRuns(run);
      setPlans(plan);
    } catch (e) {
      console.warn("Production service unavailable:", e);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visibleRuns = useMemo(
    () =>
      runs
        .filter((r) => runFilter === "all" || r.status === runFilter)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")),
    [runs, runFilter]
  );

  const openByStatus = useMemo(() => {
    const started = runs.filter((r) => r.status === "started").length;
    const planned = runs.filter((r) => r.status === "planned").length;
    const completed = runs.filter((r) => r.status === "completed").length;
    return { started, planned, completed };
  }, [runs]);

  const processName = useCallback(
    (processId: string) =>
      processes.find((p) => p.id === processId)?.name ||
      processes.find((p) => p.id === processId)?.output_item_name ||
      processId.slice(0, 8),
    [processes]
  );

  // ── Run actions ──
  const startRun = async (processId: string, plannedQty: number, source: "manual" | "plan") => {
    setBusy(true);
    try {
      const run = await productionService.startRun({
        process_id: processId,
        planned_qty: plannedQty,
        source,
      });
      toast.success(`Run started (${run.status.toUpperCase()})`);
      setStartRunTarget(null);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to start run");
    } finally {
      setBusy(false);
    }
  };

  const completeRun = async (runId: string, qty: string) => {
    const actual = parseFloat(qty);
    if (!Number.isFinite(actual) || actual < 0) {
      toast.error("Enter the actual output quantity");
      return;
    }
    setBusy(true);
    try {
      const run = await productionService.completeRun(runId, { output_qty_actual: actual });
      toast.success(`Run completed — ${run.output_qty_actual ?? actual} actual output`);
      setCompleteRunTarget(null);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to complete run");
    } finally {
      setBusy(false);
    }
  };

  const cancelRun = async (runId: string) => {
    setBusy(true);
    try {
      await productionService.cancelRun(runId);
      toast.success("Run cancelled");
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel run");
    } finally {
      setBusy(false);
    }
  };

  const raisePo = async (run: ProductionRun) => {
    setBusy(true);
    try {
      const res = await productionService.raisePo(run.id);
      toast.success("Purchase order raised from this run", {
        description:
          typeof res === "object" && res && "po_ids" in (res as object)
            ? `POs: ${(res as { po_ids?: string[] }).po_ids?.join(", ") || "created"}`
            : undefined,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to raise PO");
    } finally {
      setBusy(false);
    }
  };

  const sendSelectedToProduction = async () => {
    if (selectedPlans.size === 0) {
      toast.error("Select at least one plan line to send to production");
      return;
    }
    setBusy(true);
    try {
      // Bulk "send selected to production": start a run per selected plan line.
      const lines = plans.filter((p) => selectedPlans.has(p.id));
      let startedCount = 0;
      for (const line of lines) {
        try {
          await productionService.startRun({
            process_id: line.process_id,
            planned_qty: line.planned_qty,
            source: "plan",
          });
          startedCount += 1;
        } catch {
          // keep going — one locked plan shouldn't block the rest
        }
      }
      toast.success(`${startedCount}/${lines.length} plan lines sent to production`);
      setSelectedPlans(new Set());
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Restaurant Vertical · In-house Production"
        title="Production & Process Masters"
        description="Define process masters (output + raw material lines), execute runs, plan demand, and import spreadsheets."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-3.5" /> Import Excel/CSV
            </Button>
            <Button size="sm" onClick={() => setMasterOpen(true)}>
              <Plus className="size-3.5" /> New process master
            </Button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Process masters"
          value={String(processes.length)}
          icon={<FlaskConical />}
          sub="output + BOM definitions"
        />
        <KpiCard
          label="Runs in progress"
          value={String(openByStatus.started)}
          icon={<Play />}
          sub="started, not yet completed"
        />
        <KpiCard
          label="Planned / queued"
          value={String(openByStatus.planned)}
          icon={<ListChecks />}
          sub="waiting to be started"
        />
        <KpiCard
          label="Completed runs"
          value={String(openByStatus.completed)}
          icon={<CheckCircle2 />}
          sub="stock-deducting completions"
        />
      </div>

      <Tabs defaultValue="runs" className="space-y-5">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="runs" className="gap-1.5 text-xs font-semibold">
            <Play className="size-3.5" /> Production execution
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5 text-xs font-semibold">
            <ListChecks className="size-3.5" /> Plans
          </TabsTrigger>
          <TabsTrigger value="masters" className="gap-1.5 text-xs font-semibold">
            <FlaskConical className="size-3.5" /> Process masters
          </TabsTrigger>
        </TabsList>

        {/* ── Production execution ── */}
        <TabsContent value="runs">
          <Panel
            title="Runs"
            subtitle="Start a master as a run, complete with actuals, raise direct POs, or cancel."
            action={
              <div className="flex flex-wrap gap-1">
                {["all", "planned", "started", "completed", "cancelled"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setRunFilter(s)}
                    className={cn(
                      "rounded px-2.5 py-1 text-xs",
                      s === runFilter
                        ? "bg-primary font-medium text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s === "all" ? "All" : s}
                  </button>
                ))}
              </div>
            }
          >
            <div className="space-y-2">
              {visibleRuns.length === 0 ? (
                <div className="rounded-md border border-dashed py-10 text-center text-xs text-muted-foreground">
                  No {runFilter === "all" ? "" : runFilter + " "}runs yet — start one from a process
                  master below.
                </div>
              ) : (
                visibleRuns.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Beef className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {processName(r.process_id)}{" "}
                        <span className="text-xs text-muted-foreground">
                          · planned {r.planned_qty}
                          {r.output_qty_actual != null ? ` · actual ${r.output_qty_actual}` : ""}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.source}
                        {r.notes ? ` · ${r.notes}` : ""} · started {r.started_at ? new Date(r.started_at).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    <StatusBadge status={String(r.status).toUpperCase()} tone={runTone[String(r.status)] ?? "neutral"} />
                    {(r.status === "planned" || r.status === "started") && (
                      <div className="flex gap-1.5">
                        {r.status === "planned" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void startRun(r.process_id, r.planned_qty, "manual")}
                          >
                            <Play className="size-3.5" /> Start
                          </Button>
                        )}
                        {r.status === "started" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => setCompleteRunTarget(r)}
                          >
                            <CheckCircle2 className="size-3.5" /> Complete
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-critical hover:text-critical"
                          disabled={busy}
                          onClick={() => void cancelRun(r.id)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void raisePo(r)}
                      title="Create a purchase order for this run's raw material lines"
                    >
                      <ShoppingCart className="size-3.5" /> Raise PO
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </TabsContent>

        {/* ── Plans ── */}
        <TabsContent value="plans">
          <Panel
            title="Production plans"
            subtitle="Demand lines per process and target date. Select lines and send them to production."
            action={
              <Button
                size="sm"
                disabled={selectedPlans.size === 0 || busy}
                onClick={() => void sendSelectedToProduction()}
                className="gap-1.5"
              >
                <Truck className="size-3.5" />
                Send selected to production ({selectedPlans.size})
              </Button>
            }
          >
            <div className="space-y-2">
              {plans.length === 0 ? (
                <div className="rounded-md border border-dashed py-10 text-center text-xs text-muted-foreground">
                  No plan lines — create demand from a process or import a spreadsheet.
                </div>
              ) : (
                plans
                  .slice()
                  .sort((a, b) => a.target_date.localeCompare(b.target_date))
                  .map((p) => (
                    <label
                      key={p.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3",
                        selectedPlans.has(p.id) && "border-primary/60 bg-primary/5"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlans.has(p.id)}
                        onChange={(e) =>
                          setSelectedPlans((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(p.id);
                            else next.delete(p.id);
                            return next;
                          })
                        }
                        className="size-4 rounded border-input"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{processName(p.process_id)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(p.target_date).toLocaleDateString()} · {p.planned_qty} units ·{" "}
                          {p.status || "planned"}
                        </div>
                      </div>
                      <Package className="size-4 text-muted-foreground" />
                    </label>
                  ))
              )}
            </div>
          </Panel>
        </TabsContent>

        {/* ── Process masters ── */}
        <TabsContent value="masters">
          <Panel
            title="Process masters"
            subtitle="Output item plus raw material lines (qty + UOM) that runs and POs are built from."
          >
            <div className="grid gap-3 md:grid-cols-2">
              {processes.length === 0 ? (
                <div className="rounded-md border border-dashed py-10 text-center text-xs text-muted-foreground md:col-span-2">
                  No process masters yet — create one to start production runs.
                </div>
              ) : (
                processes.map((p) => (
                  <div key={p.id} className="panel space-y-2 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Output: {p.output_item_name || "—"} {p.output_qty > 0 ? `· ${p.output_qty} ${p.output_uom || ""}`.trim() : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={p.is_active ? "ACTIVE" : "INACTIVE"} tone={p.is_active ? "success" : "neutral"} />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setStartRunTarget(p)}
                        >
                          <Play className="size-3" /> Run
                        </Button>
                      </div>
                    </div>
                    {p.lines.length > 0 && (
                      <ul className="space-y-1 border-t pt-2 text-xs">
                        {p.lines.map((l, i) => (
                          <li key={l.id ?? i} className="flex justify-between gap-2">
                            <span className="truncate text-muted-foreground">
                              {l.raw_item_name || "raw item"}
                              {l.loss_pct ? ` (loss ${l.loss_pct}%)` : ""}
                            </span>
                            <span className="shrink-0 font-medium tabular">
                              {l.qty} {l.uom || ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>

      {/* New process master dialog */}
      <ProcessMasterDialog
        outletId={outletId}
        open={masterOpen}
        onClose={() => setMasterOpen(false)}
        onSaved={() => {
          setMasterOpen(false);
          void reload();
        }}
      />

      {/* Start run dialog */}
      <Dialog open={!!startRunTarget} onOpenChange={(o) => !o && setStartRunTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Start run · {startRunTarget?.name}</DialogTitle>
            <DialogDescription>Planned quantity sets the target output for this run.</DialogDescription>
          </DialogHeader>
          <StartRunForm
            process={startRunTarget}
            busy={busy}
            onStart={(qty) => startRunTarget && void startRun(startRunTarget.id, qty, "manual")}
          />
        </DialogContent>
      </Dialog>

      {/* Complete run dialog */}
      <Dialog open={!!completeRunTarget} onOpenChange={(o) => !o && setCompleteRunTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Complete run · {completeRunTarget ? processName(completeRunTarget.process_id) : ""}
            </DialogTitle>
            <DialogDescription>
              Report the actual output. Completion deducts stock for the raw material lines.
            </DialogDescription>
          </DialogHeader>
          <CompleteRunForm
            run={completeRunTarget}
            busy={busy}
            onComplete={(qty) => completeRunTarget && void completeRun(completeRunTarget.id, qty)}
          />
        </DialogContent>
      </Dialog>

      {/* Excel / CSV import */}
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(rows) =>
          void (async () => {
            try {
              const res = await productionService.importExcel({
                rows: rows as ExcelImportRow[],
                outlet_id: outletId,
              });
              toast.success(
                `Imported ${res.created} plan lines${res.skipped.length ? ` · ${res.skipped.length} skipped` : ""}`,
                {
                  description: res.skipped.length ? res.skipped.join(", ") : undefined,
                }
              );
              setImportOpen(false);
              await reload();
            } catch (e: unknown) {
              toast.error(e instanceof Error ? e.message : "Import failed");
            }
          })()
        }
      />
    </PageContainer>
  );
}

// ── Process master form ──────────────────────────────────────────────────────

interface MasterLineDraft {
  raw_item_name: string;
  qty: string;
  uom: string;
}

function ProcessMasterDialog({
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
  const [outputName, setOutputName] = useState("");
  const [outputQty, setOutputQty] = useState("1");
  const [outputUom, setOutputUom] = useState("units");
  const [lines, setLines] = useState<MasterLineDraft[]>([{ raw_item_name: "", qty: "", uom: "" }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setOutputName("");
      setOutputQty("1");
      setOutputUom("units");
      setLines([{ raw_item_name: "", qty: "", uom: "" }]);
    }
  }, [open]);

  const patchLine = (i: number, key: keyof MasterLineDraft, val: string) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [key]: val } : l)));

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Process name is required");
      return;
    }
    const cleanLines = lines
      .filter((l) => l.raw_item_name.trim() && parseFloat(l.qty) > 0)
      .map((l) => ({
        raw_item_name: l.raw_item_name.trim(),
        qty: parseFloat(l.qty),
        uom: l.uom.trim() || undefined,
      }));
    setSaving(true);
    try {
      await productionService.createProcess({
        name: name.trim(),
        outlet_id: outletId,
        output_item_name: outputName.trim() || null,
        output_qty: parseFloat(outputQty) || 0,
        output_uom: outputUom.trim() || null,
        lines: cleanLines,
      });
      toast.success(`Process "${name.trim()}" created`);
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create process");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" /> New process master
          </DialogTitle>
          <DialogDescription>Output item and raw material lines (qty + UOM).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Process name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Make Sambar" className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs font-semibold">Output item name</Label>
              <Input value={outputName} onChange={(e) => setOutputName(e.target.value)} placeholder="e.g. Sambar (per batch)" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Output qty</Label>
              <Input value={outputQty} onChange={(e) => setOutputQty(e.target.value)} type="number" min="0" className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Output UOM</Label>
            <Input value={outputUom} onChange={(e) => setOutputUom(e.target.value)} placeholder="units / kg / L" className="h-8 text-xs" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Raw material lines</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setLines((ls) => [...ls, { raw_item_name: "", qty: "", uom: "" }])}
              >
                <Plus className="size-3" /> Add line
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_64px_64px_32px] items-center gap-2">
                  <Input
                    value={l.raw_item_name}
                    onChange={(e) => patchLine(i, "raw_item_name", e.target.value)}
                    placeholder="Ingredient / raw item"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={l.qty}
                    onChange={(e) => patchLine(i, "qty", e.target.value)}
                    placeholder="Qty"
                    type="number"
                    min="0"
                    step="0.1"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={l.uom}
                    onChange={(e) => patchLine(i, "uom", e.target.value)}
                    placeholder="UOM"
                    className="h-8 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-critical"
                    onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                    disabled={lines.length <= 1}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void submit()}>
            <FlaskConical className="size-3.5" /> Create process
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StartRunForm({
  process,
  busy,
  onStart,
}: {
  process: ProductionProcess | null;
  busy: boolean;
  onStart: (qty: number) => void;
}) {
  const [qty, setQty] = useState("1");
  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1">
        <Label className="text-xs font-semibold">Planned quantity</Label>
        <Input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min="0" className="h-8 text-xs" />
      </div>
      <DialogFooter>
        <Button
          size="sm"
          disabled={busy || !(parseFloat(qty) > 0)}
          onClick={() => onStart(parseFloat(qty))}
        >
          <Play className="size-3.5" /> Start run
        </Button>
      </DialogFooter>
    </div>
  );
}

function CompleteRunForm({
  run,
  busy,
  onComplete,
}: {
  run: ProductionRun | null;
  busy: boolean;
  onComplete: (qty: string) => void;
}) {
  const [qty, setQty] = useState("0");
  useEffect(() => {
    setQty(String(run?.planned_qty ?? 0));
  }, [run?.id]);
  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1">
        <Label className="text-xs font-semibold">Actual output quantity</Label>
        <Input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min="0" step="0.1" className="h-8 text-xs" />
        <div className="text-[11px] text-muted-foreground">
          Planned {run?.planned_qty} — actuals drive stock deduction and cost.
        </div>
      </div>
      <DialogFooter>
        <Button size="sm" disabled={busy || !(parseFloat(qty) >= 0)} onClick={() => onComplete(qty)}>
          <CheckCircle2 className="size-3.5" /> Complete run
        </Button>
      </DialogFooter>
    </div>
  );
}

// ── Excel / CSV import (posts rows to /runs/import-excel) ───────────────────

function ImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (rows: ExcelImportRow[]) => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    if (open) {
      setText("");
      setFile(null);
    }
  }, [open]);

  // Read a CSV/xlsx-pasted text blob into process_name,planned_qty[,target_date] rows.
  const parseRows = (raw: string): ExcelImportRow[] => {
    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const cols = line.split(/[\t,;]/).map((c) => c.trim());
        const name = cols[0] || "";
        const qty = parseFloat(cols[1] || "");
        const date = cols[2] || "";
        return {
          process_name: name,
          planned_qty: Number.isFinite(qty) ? qty : 0,
          target_date: date || null,
        };
      })
      .filter((r) => r.process_name && r.planned_qty > 0);
  };

  const loadFile = async (f: File) => {
    setFile(f);
    if (f.name.toLowerCase().endsWith(".csv") || f.name.toLowerCase().endsWith(".txt")) {
      const content = await f.text();
      setText(content);
    } else {
      // xlsx — parse client-side with the bundled `xlsx` package if present, else paste fallback.
      try {
        const mod = await import("xlsx");
        const buf = await f.arrayBuffer();
        const wb = mod.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
        const rows: ExcelImportRow[] = [];
        if (sheet) {
          const data = mod.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
          for (const r of data) {
            const keys = Object.keys(r);
            const key = keys.find((k) => /process|name/i.test(k)) ?? keys[0];
            const qkey = keys.find((k) => /qty|quantity/i.test(k));
            const dkey = keys.find((k) => /date/i.test(k));
            const name = key ? String(r[key] ?? "").trim() : "";
            const qty = qkey ? parseFloat(String(r[qkey] ?? "")) : NaN;
            if (name && Number.isFinite(qty) && qty > 0) {
              rows.push({
                process_name: name,
                planned_qty: qty,
                target_date: qkey ? String(dkey ? r[dkey] : "") || null : null,
              });
            }
          }
        }
        setText("");
        if (rows.length) {
          onImported(rows);
          return;
        }
        toast.error("Could not find process/qty columns in that sheet");
      } catch {
        toast.info("Paste the rows below (process_name, qty[, date]) to import");
      }
    }
  };

  const submit = () => {
    const rows = parseRows(text);
    if (rows.length === 0) {
      toast.error("No valid rows — expected: process_name, qty[, target_date]");
      return;
    }
    setParsing(true);
    try {
      onImported(rows);
    } finally {
      setParsing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4 text-primary" /> Import Excel / CSV
          </DialogTitle>
          <DialogDescription>
            Posts rows to <code className="font-mono text-[10px]">/production/runs/import-excel</code> —
            each row names a process and a planned quantity; unmatched names are skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".csv,.txt,.xlsx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFile(f);
              }}
              className="h-8 flex-1 text-xs"
            />
            {file && <span className="text-xs text-muted-foreground">{file.name}</span>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Or paste rows</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Make Sambar, 12\nGrill Naan, 6, 2025-02-01"}
              rows={5}
              className="font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={parsing || !text.trim()} onClick={submit}>
            <FileUp className="size-3.5" /> Import rows
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
