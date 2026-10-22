import {
  Clock,
  ImagePlus,
  Maximize2,
  Minimize2,
  Move,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import floorPlanMainHall from "@/assets/floor-plan-bg.jpg";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { minutesSince } from "@/lib/calc";
import type { Area, DiningTable, Order, TableStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  clearCustomFloorBackground,
  type FloorBackgroundMap,
  loadCustomFloorBackgrounds,
  resolveTableCanvasPosition,
  resolveTableShape,
  saveCustomFloorBackground,
  TABLE_STATUS_CONFIG,
  validateFloorPlanFile,
} from "./operations-utils";

interface FloorPlanCanvasProps {
  allTables: DiningTable[];
  visibleTables: DiningTable[];
  orders: Order[];
  activeFloorArea: Area;
  selectedAreaFilter: "All" | Area;
  onSelectFloorArea: (area: Area) => void;
  onSelectAllAreas: () => void;
  selectedTableId: string;
  onSelectTable: (tableId: string) => void;
  onDoubleClickTable: (tableId: string) => void;
  // Layout Editor props
  isEditingLayout: boolean;
  onStartEditingLayout: () => void;
  onSaveLayout: (updatedTables: DiningTable[]) => void;
  onCancelEditingLayout: () => void;
  onDeleteTableFromStore: (tableId: string) => { ok: boolean; error?: string };
}

const FLOOR_AREAS: Area[] = ["Main Hall", "Terrace", "Private Room"];

function TableChairs({
  shape,
  status,
}: {
  shape: "round" | "rect";
  capacity: number;
  status: TableStatus;
}) {
  const cfg = TABLE_STATUS_CONFIG[status];
  const chairBase = cn(
    "pointer-events-none absolute border shadow-[0_2px_5px_rgba(15,23,42,0.28)] transition-colors",
    cfg.chairFill,
    cfg.chairBorder,
  );

  if (shape === "round") {
    // 6 radial 3D top-down chairs around circular table matching reference image
    const angles = [30, 90, 150, 210, 270, 330];
    return (
      <>
        {angles.map((deg) => (
          <span
            key={deg}
            style={{
              transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-54px)`,
            }}
            className={cn(
              chairBase,
              "left-1/2 top-1/2 h-3.5 w-7 rounded-t-full rounded-b-sm border-t-[3px]",
            )}
          />
        ))}
      </>
    );
  }

  // Rectangular / Square table: 2 chairs top, 2 chairs bottom, 1 chair left, 1 chair right
  return (
    <>
      {/* Top 2 chairs */}
      <span
        className={cn(
          chairBase,
          "-top-3 left-3.5 h-3 w-7 rounded-t-lg rounded-b-xs border-t-[3px]",
        )}
      />
      <span
        className={cn(
          chairBase,
          "-top-3 right-3.5 h-3 w-7 rounded-t-lg rounded-b-xs border-t-[3px]",
        )}
      />
      {/* Bottom 2 chairs */}
      <span
        className={cn(
          chairBase,
          "-bottom-3 left-3.5 h-3 w-7 rounded-b-lg rounded-t-xs border-b-[3px]",
        )}
      />
      <span
        className={cn(
          chairBase,
          "-bottom-3 right-3.5 h-3 w-7 rounded-b-lg rounded-t-xs border-b-[3px]",
        )}
      />
      {/* Left & Right side chairs */}
      <span
        className={cn(
          chairBase,
          "-left-3 top-1/2 -translate-y-1/2 h-7 w-3 rounded-l-lg rounded-r-xs border-l-[3px]",
        )}
      />
      <span
        className={cn(
          chairBase,
          "-right-3 top-1/2 -translate-y-1/2 h-7 w-3 rounded-r-lg rounded-l-xs border-r-[3px]",
        )}
      />
    </>
  );
}

export function FloorPlanCanvas({
  allTables,
  visibleTables,
  orders,
  activeFloorArea,
  selectedAreaFilter,
  onSelectFloorArea,
  onSelectAllAreas,
  selectedTableId,
  onSelectTable,
  onDoubleClickTable,
  isEditingLayout,
  onStartEditingLayout,
  onSaveLayout,
  onCancelEditingLayout,
  onDeleteTableFromStore,
}: FloorPlanCanvasProps) {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customBgs, setCustomBgs] = useState<FloorBackgroundMap>(() =>
    loadCustomFloorBackgrounds(),
  );

  // Draft tables when in Edit Layout mode
  const [draftTables, setDraftTables] = useState<DiningTable[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Add Table Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableCap, setNewTableCap] = useState("4");
  const [newTableShape, setNewTableShape] = useState<"round" | "rect">("rect");
  const [newTableArea, setNewTableArea] = useState<Area>(activeFloorArea);

  // Delete Confirmation Dialog state
  const [deleteConfirmTable, setDeleteConfirmTable] = useState<DiningTable | null>(null);

  // Initialize draft tables when entering Edit Layout mode
  useEffect(() => {
    if (isEditingLayout) {
      setDraftTables(
        allTables.map((t) => {
          const pos = resolveTableCanvasPosition(t, allTables);
          const shape = resolveTableShape(t, allTables);
          return {
            ...t,
            x: pos.x,
            y: pos.y,
            shape,
            scale: t.scale ?? 1,
            rotation: t.rotation ?? 0,
          };
        }),
      );
    }
  }, [isEditingLayout, allTables]);

  // Listen for browser fullscreen exit
  useEffect(() => {
    const onFsChange = () => {
      if (typeof document !== "undefined") {
        setIsFullscreen(Boolean(document.fullscreenElement));
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Handle pointer move/up during table drag in Edit Layout mode
  useEffect(() => {
    if (!isEditingLayout || !draggingId) return;

    const handlePointerMove = (e: PointerEvent) => {
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const rawX = (e.clientX - rect.left) / rect.width;
      const rawY = (e.clientY - rect.top) / rect.height;
      const clampedX = Math.max(0.08, Math.min(0.92, Math.round(rawX * 1000) / 1000));
      const clampedY = Math.max(0.1, Math.min(0.9, Math.round(rawY * 1000) / 1000));

      setDraftTables((prev) =>
        prev.map((t) => (t.id === draggingId ? { ...t, x: clampedX, y: clampedY } : t)),
      );
    };

    const handlePointerUp = () => {
      setDraggingId(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isEditingLayout, draggingId]);

  const handleZoomIn = () => setZoom((z) => Math.min(1.35, Math.round((z + 0.1) * 100) / 100));
  const handleZoomOut = () => setZoom((z) => Math.max(0.75, Math.round((z - 0.1) * 100) / 100));
  const handleZoomReset = () => setZoom(1);

  const handleToggleFullscreen = async () => {
    const el = workspaceRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        setIsFullscreen((prev) => !prev);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  const handleUploadFloorPlan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const validation = validateFloorPlanFile(file);
    if (!validation.ok) {
      toast.error(validation.error ?? "Invalid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        toast.error("Failed to read floor-plan image file.");
        return;
      }
      const saved = saveCustomFloorBackground(activeFloorArea, dataUrl);
      if (!saved) {
        toast.error("Image is too large for browser storage. Try a compressed JPG/WEBP.");
        return;
      }
      setCustomBgs(loadCustomFloorBackgrounds());
      toast.success(
        `Uploaded custom floor-plan background for ${activeFloorArea}. Table positions preserved.`,
      );
    };
    reader.onerror = () => {
      toast.error("Could not load the selected image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleResetFloorBackground = () => {
    const updated = clearCustomFloorBackground(activeFloorArea);
    setCustomBgs(updated);
    toast.info(`Restored default architectural floor plan for ${activeFloorArea}`);
  };

  const sourceTables = isEditingLayout ? draftTables : visibleTables;
  const canvasAreaTables = sourceTables.filter((t) => t.area === activeFloorArea);

  const selectedDraftTable = isEditingLayout
    ? draftTables.find((t) => t.id === selectedTableId)
    : undefined;

  const updateSelectedDraft = (patch: Partial<DiningTable>) => {
    if (!selectedDraftTable) return;
    setDraftTables((prev) =>
      prev.map((t) => (t.id === selectedDraftTable.id ? { ...t, ...patch } : t)),
    );
  };

  const handleOpenAddDialog = () => {
    const prefix =
      activeFloorArea === "Main Hall" ? "T" : activeFloorArea === "Terrace" ? "R" : "P";
    const existingNums = (isEditingLayout ? draftTables : allTables)
      .filter((t) => t.id.startsWith(prefix))
      .map((t) => Number.parseInt(t.id.slice(1), 10))
      .filter((n) => !Number.isNaN(n));
    const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
    setNewTableName(`${prefix}${nextNum}`);
    setNewTableCap("4");
    setNewTableShape("rect");
    setNewTableArea(activeFloorArea);
    setAddDialogOpen(true);
  };

  const handleConfirmAddTable = () => {
    const cleanName = newTableName.trim().toUpperCase();
    if (!cleanName) {
      toast.error("Please enter a Table ID (e.g., T13).");
      return;
    }
    const duplicate = draftTables.some(
      (t) => t.id.toUpperCase() === cleanName || t.name.toUpperCase() === cleanName,
    );
    if (duplicate) {
      toast.error(`Table ${cleanName} already exists.`);
      return;
    }
    const cap = Math.max(1, Math.min(20, Number.parseInt(newTableCap, 10) || 4));
    const created: DiningTable = {
      id: cleanName,
      name: cleanName,
      area: newTableArea,
      capacity: cap,
      status: "available",
      guests: 0,
      x: 0.48,
      y: 0.5,
      shape: newTableShape,
      scale: 1,
      rotation: 0,
    };
    setDraftTables((prev) => [...prev, created]);
    onSelectFloorArea(newTableArea);
    onSelectTable(created.id);
    setAddDialogOpen(false);
    toast.success(`Added Table ${created.name} to ${newTableArea}. Drag to position it.`);
  };

  const handleConfirmDeleteTable = () => {
    if (!deleteConfirmTable) return;
    const hasActiveOrder = orders.some(
      (o) =>
        (o.tableId === deleteConfirmTable.id || o.id === deleteConfirmTable.orderId) &&
        o.payment === "unpaid" &&
        o.status !== "cancelled" &&
        o.status !== "completed",
    );
    if (hasActiveOrder) {
      toast.error(
        `Table ${deleteConfirmTable.name} has an active unpaid order and cannot be deleted.`,
      );
      setDeleteConfirmTable(null);
      return;
    }

    if (isEditingLayout) {
      const remaining = draftTables.filter((t) => t.id !== deleteConfirmTable.id);
      setDraftTables(remaining);
      if (selectedTableId === deleteConfirmTable.id && remaining[0]) {
        onSelectTable(remaining[0].id);
      }
      toast.success(`Removed Table ${deleteConfirmTable.name} from layout draft`);
    } else {
      const res = onDeleteTableFromStore(deleteConfirmTable.id);
      if (!res.ok) {
        toast.error(res.error ?? "Could not delete table");
      } else {
        toast.success(`Deleted Table ${deleteConfirmTable.name}`);
      }
    }
    setDeleteConfirmTable(null);
  };

  const activeCustomBg = customBgs[activeFloorArea];

  return (
    <div
      ref={workspaceRef}
      className={cn(
        "surface flex flex-col overflow-hidden transition-all",
        isFullscreen && "fixed inset-3 z-50 rounded-2xl bg-card shadow-2xl",
      )}
    >
      {/* Top Workspace Control Bar: Area Tabs + Zoom/Reset/Editor/Fullscreen */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 bg-card">
        {/* Area Tabs */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="tablist"
          aria-label="Floor Areas"
        >
          {FLOOR_AREAS.map((area) => {
            const isTabActive = activeFloorArea === area;
            return (
              <button
                key={area}
                type="button"
                role="tab"
                aria-selected={isTabActive}
                onClick={() => onSelectFloorArea(area)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                  isTabActive
                    ? "bg-[#EBF3FF] text-[#1769E8] border border-[#BFDBFE] shadow-[0_1px_3px_rgba(23,105,232,0.1)] dark:bg-primary/20 dark:text-primary dark:border-primary/40"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-border/60 bg-background",
                )}
              >
                {area}
              </button>
            );
          })}

          <button
            type="button"
            onClick={onSelectAllAreas}
            className={cn(
              "ml-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              selectedAreaFilter === "All"
                ? "border-slate-200 bg-slate-100/80 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                : "border-transparent text-muted-foreground hover:bg-muted/50",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />3 areas
          </button>
        </div>

        {/* Canvas Controls: Zoom In, Zoom Out, Reset, Edit Layout, Fullscreen */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom In"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={handleZoomReset}
            className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Reset
          </button>

          {!isEditingLayout ? (
            <button
              type="button"
              onClick={onStartEditingLayout}
              title="Edit Floor Layout"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Move className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Edit Layout</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={() => onSaveLayout(draftTables)}
                className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 text-xs"
              >
                <Save className="h-3.5 w-3.5" />
                Save Layout
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onCancelEditingLayout}
                className="h-8 gap-1 text-xs"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          )}

          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Floor Plan"}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen Floor Plan"}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Floor-Plan Editor Toolbar (Visible when isEditingLayout is active) */}
      {isEditingLayout && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Floor-Plan Editor Mode — Drag tables on canvas to reposition</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleUploadFloorPlan}
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenAddDialog}
                className="h-7 gap-1 bg-background text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5 text-primary" />
                Add Table
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 gap-1 bg-background text-xs font-semibold"
              >
                <ImagePlus className="h-3.5 w-3.5 text-primary" />
                Upload Floor Plan
              </Button>
              {activeCustomBg && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleResetFloorBackground}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset Bg
                </Button>
              )}
            </div>
          </div>

          {selectedDraftTable && (
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 text-xs shadow-xs">
              <div className="flex items-center gap-1.5">
                <Label className="text-[11px] text-muted-foreground">ID:</Label>
                <Input
                  value={selectedDraftTable.name}
                  onChange={(e) => updateSelectedDraft({ name: e.target.value.toUpperCase() })}
                  className="h-7 w-18 text-xs font-bold"
                  aria-label="Edit Table ID"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Label className="text-[11px] text-muted-foreground">Seats:</Label>
                <Select
                  value={String(selectedDraftTable.capacity)}
                  onValueChange={(v) => updateSelectedDraft({ capacity: Number(v) })}
                >
                  <SelectTrigger className="h-7 w-20 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 4, 6, 8, 10, 12].map((cap) => (
                      <SelectItem key={cap} value={String(cap)}>
                        {cap} seats
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <Label className="text-[11px] text-muted-foreground">Shape:</Label>
                <div className="inline-flex rounded-md border border-border p-0.5">
                  <button
                    type="button"
                    onClick={() => updateSelectedDraft({ shape: "round" })}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-medium",
                      selectedDraftTable.shape === "round"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Round
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedDraft({ shape: "rect" })}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-medium",
                      selectedDraftTable.shape === "rect"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Rect
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Label className="text-[11px] text-muted-foreground">Area:</Label>
                <Select
                  value={selectedDraftTable.area}
                  onValueChange={(v) => {
                    const area = v as Area;
                    updateSelectedDraft({ area });
                    onSelectFloorArea(area);
                  }}
                >
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLOOR_AREAS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1">
                <Label className="text-[11px] text-muted-foreground">Size:</Label>
                <button
                  type="button"
                  onClick={() =>
                    updateSelectedDraft({
                      scale: Math.max(
                        0.75,
                        Math.round(((selectedDraftTable.scale ?? 1) - 0.1) * 100) / 100,
                      ),
                    })
                  }
                  className="h-6 w-6 rounded border border-border bg-background font-bold hover:bg-muted"
                  title="Decrease Table Size"
                >
                  -
                </button>
                <span className="w-9 text-center text-[11px] tabular">
                  {Math.round((selectedDraftTable.scale ?? 1) * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateSelectedDraft({
                      scale: Math.min(
                        1.35,
                        Math.round(((selectedDraftTable.scale ?? 1) + 0.1) * 100) / 100,
                      ),
                    })
                  }
                  className="h-6 w-6 rounded border border-border bg-background font-bold hover:bg-muted"
                  title="Increase Table Size"
                >
                  +
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    updateSelectedDraft({
                      rotation: ((selectedDraftTable.rotation ?? 0) - 45 + 360) % 360,
                    })
                  }
                  className="flex h-6 w-6 items-center justify-center rounded border border-border bg-background hover:bg-muted"
                  title="Rotate Counter-Clockwise"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateSelectedDraft({
                      rotation: ((selectedDraftTable.rotation ?? 0) + 45) % 360,
                    })
                  }
                  className="flex h-6 w-6 items-center justify-center rounded border border-border bg-background hover:bg-muted"
                  title="Rotate Clockwise"
                >
                  <RotateCw className="h-3 w-3" />
                </button>
              </div>

              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDeleteConfirmTable(selectedDraftTable)}
                className="ml-auto h-7 gap-1 px-2.5 text-[11px]"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main Photorealistic Floor-Plan Viewport */}
      <div className="relative flex-1 overflow-auto p-2.5 bg-card">
        <div
          ref={canvasRef}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center top",
          }}
          className="relative mx-auto w-full min-h-[550px] sm:min-h-[610px] lg:min-h-[650px] rounded-xl overflow-hidden select-none transition-transform duration-150 shadow-inner bg-[#23150D]"
        >
          {/* Layer 1: Photorealistic 3D Top-Down Architectural Floor-Plan Image */}
          <img
            src={activeCustomBg ?? floorPlanMainHall}
            alt={`${activeFloorArea} Architectural Floor Plan`}
            className={cn(
              "pointer-events-none absolute inset-0 h-full w-full object-cover",
              !activeCustomBg &&
                activeFloorArea === "Terrace" &&
                "hue-rotate-[12deg] saturate-[1.15] brightness-[1.03]",
              !activeCustomBg &&
                activeFloorArea === "Private Room" &&
                "sepia-[0.15] contrast-[1.06] brightness-[0.96]",
            )}
          />

          {/* Architectural Wayfinding Labels (Main Entrance, Host Stand, Terrace Access) */}
          {!activeCustomBg && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {/* Top Center: Main Entrance */}
              <div
                style={{ left: "47.5%", top: "2%" }}
                className="absolute -translate-x-1/2 flex flex-col items-center rounded-lg border border-slate-300/90 bg-white/92 px-3.5 py-1 text-[11px] font-bold text-slate-700 shadow-md backdrop-blur-xs"
              >
                <span className="text-[10px] leading-none text-slate-500">↑</span>
                <span>
                  {activeFloorArea === "Main Hall"
                    ? "Main Entrance"
                    : activeFloorArea === "Terrace"
                      ? "Main Hall Doors"
                      : "VIP Foyer Entrance"}
                </span>
              </div>

              {/* Top Right: Host Stand */}
              <div
                style={{ left: "62%", top: "7.5%" }}
                className="absolute -translate-x-1/2 rounded-lg border border-amber-200/30 bg-[#2C1B10]/85 px-3.5 py-1 text-[11px] font-semibold text-amber-50 shadow-md backdrop-blur-xs"
              >
                {activeFloorArea === "Main Hall"
                  ? "Host Stand"
                  : activeFloorArea === "Terrace"
                    ? "Sky Bar Counter"
                    : "Concierge Desk"}
              </div>

              {/* Bottom Center: Terrace Access */}
              <div
                style={{ left: "47.5%", bottom: "2%" }}
                className="absolute -translate-x-1/2 rounded-lg border border-slate-300/90 bg-white/92 px-3.5 py-1 text-[11px] font-bold text-slate-700 shadow-md backdrop-blur-xs"
              >
                {activeFloorArea === "Main Hall"
                  ? "Terrace Access"
                  : activeFloorArea === "Terrace"
                    ? "Garden Promenade"
                    : "Private Lounge"}
              </div>
            </div>
          )}

          {/* Layer 2: Interactive React Table Markers */}
          {canvasAreaTables.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <div className="rounded-2xl border border-slate-300/80 bg-white/95 p-6 shadow-lg max-w-sm">
                <p className="text-sm font-bold text-slate-800">
                  No tables match the active filters in {activeFloorArea}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Try toggling additional status switches or resetting capacity filters on the left.
                </p>
              </div>
            </div>
          ) : (
            canvasAreaTables.map((table) => {
              const pos = isEditingLayout
                ? { x: table.x, y: table.y }
                : resolveTableCanvasPosition(table, allTables);
              const shape = isEditingLayout ? table.shape : resolveTableShape(table, allTables);
              const scale = table.scale ?? 1;
              const rotation = table.rotation ?? 0;

              const cfg = TABLE_STATUS_CONFIG[table.status];
              const isSelected = selectedTableId === table.id;
              const activeOrd = orders.find(
                (o) =>
                  (o.id === table.orderId || o.tableId === table.id) &&
                  o.payment === "unpaid" &&
                  o.status !== "cancelled" &&
                  o.status !== "completed",
              );
              const elapsed = table.since
                ? minutesSince(table.since)
                : activeOrd
                  ? minutesSince(activeOrd.createdAt)
                  : 0;

              return (
                <div
                  key={table.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Table ${table.name}, ${table.capacity} seats, ${cfg.label}`}
                  aria-pressed={isSelected}
                  onPointerDown={(e) => {
                    onSelectTable(table.id);
                    if (isEditingLayout) {
                      e.stopPropagation();
                      setDraggingId(table.id);
                    }
                  }}
                  onClick={() => onSelectTable(table.id)}
                  onDoubleClick={() => {
                    if (!isEditingLayout) {
                      onDoubleClickTable(table.id);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectTable(table.id);
                    }
                  }}
                  style={{
                    left: `${pos.x * 100}%`,
                    top: `${pos.y * 100}%`,
                    transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
                  }}
                  className={cn(
                    "group absolute z-10 flex items-center justify-center transition-all focus:outline-none",
                    isEditingLayout ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                    isSelected && "z-20",
                  )}
                >
                  {/* 3D Perimeter Chairs */}
                  <TableChairs shape={shape} capacity={table.capacity} status={table.status} />

                  {/* Table Surface Body */}
                  <div
                    style={{
                      transform: rotation ? `rotate(${-rotation}deg)` : undefined,
                    }}
                    className={cn(
                      "relative flex flex-col items-center justify-center border-2 px-2.5 py-2 text-center transition-all backdrop-blur-[2px]",
                      shape === "round"
                        ? "h-[94px] w-[94px] sm:h-[104px] sm:w-[104px] rounded-full"
                        : table.capacity >= 6
                          ? "h-[90px] w-[106px] sm:h-[96px] sm:w-[114px] rounded-2xl"
                          : "h-[88px] w-[98px] sm:h-[94px] sm:w-[106px] rounded-2xl",
                      cfg.markerSurface,
                      cfg.markerBorder,
                      cfg.markerGlow,
                      isSelected
                        ? table.status === "billing"
                          ? "ring-3 ring-[#F59E0B] ring-offset-2 ring-offset-[#FFF7ED] scale-[1.06] shadow-[0_12px_32px_rgba(245,158,11,0.55)]"
                          : "ring-3 ring-[#1769E8] ring-offset-2 ring-offset-white scale-[1.06] shadow-[0_12px_32px_rgba(23,105,232,0.45)]"
                        : "hover:scale-[1.03]",
                    )}
                  >
                    {/* Table ID */}
                    <span className="text-[15px] sm:text-[17px] font-extrabold tracking-tight text-slate-900 leading-none">
                      {table.name}
                    </span>

                    {/* Seat Capacity */}
                    <span className="mt-1 text-[11px] font-medium text-slate-600 leading-none">
                      {table.capacity} seats
                    </span>

                    {/* Status or Elapsed Time Badge */}
                    <div className="mt-1.5 flex items-center justify-center">
                      {table.status === "occupied" ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold leading-none tabular",
                            cfg.pillBg,
                            cfg.pillText,
                          )}
                        >
                          {table.capacity <= 4 ? (
                            <Users className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {elapsed > 0 ? `${elapsed}m` : "Active"}
                        </span>
                      ) : table.status === "billing" ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold leading-none tabular",
                            cfg.pillBg,
                            cfg.pillText,
                          )}
                        >
                          <span className="relative inline-flex items-center">
                            <Clock className="h-3 w-3 text-[#D97706]" />
                            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                          </span>
                          {elapsed > 0 ? `${elapsed}m` : "Billing"}
                        </span>
                      ) : table.status === "reserved" ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-bold leading-none",
                            cfg.pillBg,
                            cfg.pillText,
                          )}
                        >
                          Reserved
                        </span>
                      ) : table.status === "cleaning" ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-semibold leading-none",
                            cfg.pillBg,
                            cfg.pillText,
                          )}
                        >
                          Cleaning
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold leading-none",
                            cfg.pillBg,
                            cfg.pillText,
                          )}
                        >
                          Available
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Table Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Dining Table</DialogTitle>
            <DialogDescription>
              Create a new interactive table marker on the floor plan. You can drag it to any
              position after adding.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-table-id" className="text-xs">
                  Table ID / Label
                </Label>
                <Input
                  id="new-table-id"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value.toUpperCase())}
                  placeholder="e.g. T13"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Seat Capacity</Label>
                <Select value={newTableCap} onValueChange={setNewTableCap}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 4, 6, 8, 10, 12].map((c) => (
                      <SelectItem key={c} value={String(c)}>
                        {c} seats
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Dining Area</Label>
                <Select value={newTableArea} onValueChange={(v) => setNewTableArea(v as Area)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLOOR_AREAS.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Table Shape</Label>
                <Select
                  value={newTableShape}
                  onValueChange={(v) => setNewTableShape(v as "round" | "rect")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round">Circular (Round)</SelectItem>
                    <SelectItem value="rect">Rectangular / Square</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmAddTable}>
              Add Table to Canvas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Table Confirmation Dialog */}
      <Dialog
        open={deleteConfirmTable !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmTable(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Table {deleteConfirmTable?.name}?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove Table {deleteConfirmTable?.name} (
              {deleteConfirmTable?.area}) from the floor plan?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmTable(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDeleteTable}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
