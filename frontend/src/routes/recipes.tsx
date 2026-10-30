import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChefHat,
  Circle,
  Coins,
  Images,
  Loader2,
  Minus,
  PackagePlus,
  PackageSearch,
  Percent,
  Plus,
  Save,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, Panel } from "@/components/common/PageHeader";
import { StatusBadge, type Tone } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  menuService,
  type AiRecipeResult,
  type AiReorderLine,
  type AiReorderResponse,
  type RecipeSearchResult,
} from "@/services/menuService";
import {
  inventoryService,
  type StockTransferResult,
} from "@/services/inventoryService";
import { initRestaurantStore } from "@/services/orderService";
import { getActiveOutlet } from "@/lib/auth-tokens";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recipes")({
  head: () => ({
    meta: [
      { title: "Recipes — RestaurantOS" },
      {
        name: "description",
        content:
          "Find any recipe, then fully control it: ingredients, scale, pricing, stock, orders and kitchen transfers.",
      },
    ],
  }),
  component: Recipes,
});

/* ── domain types ─────────────────────────────────────────────────────────── */
type InvItem = {
  id: string;
  name: string;
  code: string;
  standard_cost: number;
  total_available: number;
};

type StorageLocationInfo = {
  id: string;
  name: string;
  module: string;
  is_central: boolean;
};

/** One editable ingredient line in the studio. */
type StudioLine = {
  key: string;
  /** Live inventory item, when resolved; null = the chef must resolve it. */
  inventory_item_id: string | null;
  name: string;
  /** Qty per recipe batch (before dividing by the yield). */
  qty: number;
  wastage_pct: number;
  is_optional: boolean;
};

/** The working recipe the chef is manipulating — from the catalog or from a
 *  global AI/web search. Both shapes edit identically. */
type Studio = {
  kind: "catalog" | "ai";
  /** Catalog: the existing menu item this recipe upserts onto. */
  item_id: string | null;
  name: string;
  instructions: string;
  base_price: number | null;
  yield_qty: number;
  lines: StudioLine[];
};

/** A studio line with live-inventory math joined on. */
type ComputedLine = StudioLine & {
  per_portion: number;
  required: number;
  available: number;
  unit_cost: number | null;
  line_cost: number | null;
  status: "in_stock" | "low" | "missing" | "unknown";
  inv_name: string;
  inv_code: string;
};

/* ── small presentational helpers ─────────────────────────────────────────── */

function StepBadge({ n, tone = "primary" }: { n: number; tone?: "primary" | "info" }) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ring-2",
        tone === "primary"
          ? "bg-primary text-primary-foreground ring-primary/20"
          : "bg-info text-primary-foreground ring-info/20",
      )}
    >
      {n}
    </span>
  );
}

function StockBar({
  required,
  available,
  status,
}: {
  required: number;
  available: number;
  status: "in_stock" | "low" | "missing" | "unknown";
}) {
  const pct = required > 0 ? Math.min(100, (available / required) * 100) : 0;
  const color =
    status === "in_stock"
      ? "bg-success"
      : status === "low"
        ? "bg-warning"
        : status === "missing"
          ? "bg-critical"
          : "bg-muted-foreground/40";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PortionsStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-muted/60 p-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-7 rounded-full"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Fewer portions"
      >
        <Minus className="size-3.5" />
      </Button>
      <Input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="h-7 w-14 border-0 bg-transparent text-center shadow-none"
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-7 rounded-full"
        onClick={() => onChange(value + 1)}
        aria-label="More portions"
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

const statusTone: Record<string, Tone> = {
  in_stock: "success",
  low: "warning",
  missing: "critical",
  unknown: "neutral",
};
const statusLabel: Record<string, string> = {
  in_stock: "In stock",
  low: "Low",
  missing: "Missing",
  unknown: "Unresolved",
};

function slug(name: string) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || "ITEM";
}

/* ── main component ───────────────────────────────────────────────────────── */

function Recipes() {
  // ── search (catalog RAG is instant; the 3-source fan-out streams in below) ─
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // ── inventory join data + locations for kitchen transfer ─────────────────
  const [invItems, setInvItems] = useState<InvItem[]>([]);
  const [locations, setLocations] = useState<StorageLocationInfo[]>([]);
  const [transferMap, setTransferMap] = useState<Record<string, number>>({});
  const invById = useMemo(() => new Map(invItems.map((i) => [i.id, i])), [invItems]);

  useEffect(() => {
    inventoryService.getItems().then((items) => setInvItems(items as InvItem[])).catch(() => {});
    inventoryService.getLocations().then((locs) => setLocations(locs)).catch(() => {});
  }, []);

  // ── catalog RAG (debounced) ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      menuService
        .searchRecipes(query)
        .then((r) => {
          if (!cancelled) setResults(r);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // ── the studio: the working recipe the chef manipulates ──────────────────
  const [studio, setStudio] = useState<Studio | null>(null);
  const [loading, setLoading] = useState(false);
  const [portions, setPortions] = useState(4);
  const [margin, setMargin] = useState(40); // desired gross margin, %

  // ── kitchen transfer (central warehouse → kitchen) ───────────────────────
  const [transferring, setTransferring] = useState(false);
  const [transferred, setTransferred] = useState<StockTransferResult[] | null>(null);

  // ── reorder result ───────────────────────────────────────────────────────
  const [reorderBusy, setReorderBusy] = useState(false);
  const [reorderResult, setReorderResult] = useState<AiReorderResponse | null>(null);

  const kitchenLoc = useMemo(
    () =>
      locations.find((l) => l.module === "restaurant") ??
      locations.find((l) => l.module === "kitchen") ??
      null,
    [locations],
  );

  /* ═══════════════ OPEN RECIPES INTO THE STUDIO ═══════════════ */

  const openCatalogRecipe = useCallback(
    async (r: RecipeSearchResult) => {
      setLoading(true);
      setReorderResult(null);
      setTransferred(null);
      try {
        const bd = await menuService.getRecipeBreakdown(r.item_id, 1);
        // Breakdown lines are per-portion; the studio works per-batch, so
        // restore the batch qty against the recipe's yield.
        const yieldQ = bd.yield_qty || 1;
        setStudio({
          kind: "catalog",
          item_id: r.item_id,
          name: r.name,
          instructions: r.instructions ?? "",
          base_price: r.base_price ?? null,
          yield_qty: yieldQ,
          lines: bd.lines.map((l, i) => ({
            key: String(i),
            inventory_item_id: l.inventory_item_id,
            name: invById.get(l.inventory_item_id)?.name ?? l.name ?? `Ingredient ${i + 1}`,
            qty: l.qty_per_portion * yieldQ,
            wastage_pct: l.wastage_pct,
            is_optional: l.is_optional,
          })),
        });
      } catch {
        toast.error("Could not load recipe breakdown");
      } finally {
        setLoading(false);
      }
    },
    [invById],
  );

  const openAiRecipe = useCallback(
    async (r: AiRecipeResult) => {
      setLoading(true);
      setReorderResult(null);
      setTransferred(null);
      try {
        // Reconcile first: it resolves every ingredient to a live inventory
        // item (code / word-match) so the studio opens already mapped.
        const rec = await menuService.aiRecipeReconcile({
          recipe: r,
          portions: 1,
          outlet_id: getActiveOutlet(),
        });
        setStudio({
          kind: "ai",
          item_id: null,
          name: r.name,
          instructions: r.instructions ?? r.description ?? "",
          base_price: r.base_price ?? null,
          yield_qty: 1,
          lines: (rec.lines ?? []).map((l, i) => ({
            key: String(i),
            inventory_item_id: l.inventory_item_id ?? null,
            name: l.name || `Ingredient ${i + 1}`,
            qty: l.qty_per_portion ?? 0,
            wastage_pct: l.wastage_pct ?? 0,
            is_optional: false,
          })),
        });
      } catch {
        // Reconcile down (inventory service offline): open with raw LLM
        // ingredients, unresolved — the chef maps them in the studio.
        setStudio({
          kind: "ai",
          item_id: null,
          name: r.name,
          instructions: r.instructions ?? r.description ?? "",
          base_price: r.base_price ?? null,
          yield_qty: 1,
          lines: r.ingredients.map((l, i) => ({
            key: String(i),
            inventory_item_id: l.inventory_item_id ?? null,
            name: l.name,
            qty: l.qty_per_portion ?? 0,
            wastage_pct: l.wastage_pct ?? 0,
            is_optional: false,
          })),
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /* ═══════════════ STUDIO EDITS ═══════════════ */

  const patch = (p: Partial<Studio>) => setStudio((s) => (s ? { ...s, ...p } : s));

  const patchLine = (key: string, p: Partial<StudioLine>) =>
    setStudio((s) =>
      s
        ? { ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, ...p } : l)) }
        : s,
    );

  const removeLine = (key: string) =>
    setStudio((s) => (s ? { ...s, lines: s.lines.filter((l) => l.key !== key) } : s));

  const addLineFromInventory = (iid: string) => {
    const inv = invById.get(iid);
    if (!inv) return;
    setStudio((s) =>
      s
        ? {
            ...s,
            lines: [
              ...s.lines,
              {
                key: `add-${Date.now()}`,
                inventory_item_id: inv.id,
                name: inv.name,
                qty: 1,
                wastage_pct: 0,
                is_optional: false,
              },
            ],
          }
        : s,
    );
  };

  /** Create a brand-new inventory item for an unresolved line, then map it. */
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState({ cost: "", reorder: "" });
  const [creating, setCreating] = useState(false);

  const createInventoryItem = async (line: StudioLine) => {
    const name = line.name.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await inventoryService.createItem({
        name,
        code: slug(name),
        standard_cost: Number(createDraft.cost) || 0,
        reorder_level: Number(createDraft.reorder) || 0,
        item_type: "ingredient",
        outlet_id: getActiveOutlet() ?? undefined,
      });
      const iid: string | undefined = created?.id;
      if (iid) {
        setInvItems((prev) => [
          ...prev,
          {
            id: iid,
            name,
            code: created?.code ?? slug(name),
            standard_cost: Number(createDraft.cost) || 0,
            total_available: 0,
          },
        ]);
        patchLine(line.key, { inventory_item_id: iid, name });
        void initRestaurantStore();
        toast.success(`“${name}” created in inventory and mapped to this line`);
      }
      setCreatingKey(null);
    } catch {
      toast.error("Could not create the inventory item");
    } finally {
      setCreating(false);
    }
  };

  /* ═══════════════ LIVED COMPUTATION ═══════════════ */

  const computed: ComputedLine[] = useMemo(() => {
    if (!studio) return [];
    const y = Math.max(0.0001, studio.yield_qty || 1);
    return studio.lines.map((l) => {
      const inv = l.inventory_item_id ? invById.get(l.inventory_item_id) : undefined;
      const per_portion = l.qty / y;
      const required = per_portion * portions * (1 + (l.wastage_pct || 0) / 100);
      const available = inv?.total_available ?? 0;
      const unit_cost = inv ? inv.standard_cost : null;
      let status: ComputedLine["status"];
      if (!inv) status = "unknown";
      else if (available >= required) status = "in_stock";
      else if (available <= 0) status = "missing";
      else status = "low";
      return {
        ...l,
        per_portion,
        required,
        available,
        unit_cost,
        line_cost: unit_cost != null ? required * unit_cost : null,
        status,
        inv_name: inv?.name ?? l.name,
        inv_code: inv?.code ?? "",
      };
    });
  }, [studio, invById, portions]);

  const totalCost = computed.reduce((s, l) => s + (l.line_cost ?? 0), 0);
  const costPerPortion = portions > 0 ? totalCost / portions : 0;
  const suggestedPrice = margin < 100 ? costPerPortion / (1 - margin / 100) : 0;
  const unknownCount = computed.filter((l) => l.status === "unknown").length;
  const lowCount = computed.filter((l) => l.status === "low").length;
  const missingCount = computed.filter((l) => l.status === "missing").length;
  const gapCount = lowCount + missingCount;

  /* ═══════════════ ACTIONS ═══════════════ */

  const [saving, setSaving] = useState(false);

  /** Save (upsert) the studio's recipe onto the live menu. */
  const saveToMenu = async () => {
    if (!studio) return;
    if (unknownCount > 0) {
      toast.warning(
        `${unknownCount} ingredient(s) still unmapped to inventory — map or create them first`,
      );
      return;
    }
    setSaving(true);
    try {
      const lines = studio.lines.map((l) => ({
        inventory_item_id: l.inventory_item_id!,
        qty: l.qty,
        uom_id: null,
        wastage_pct: l.wastage_pct,
        is_optional: l.is_optional,
      }));
      const payload = {
        name: studio.name,
        yield_qty: studio.yield_qty,
        instructions: studio.instructions || undefined,
        lines,
      };
      if (studio.kind === "catalog" && studio.item_id) {
        // Upsert onto the existing catalog item.
        await menuService.createRecipe(studio.item_id, payload);
        void initRestaurantStore();
        toast.success(`${studio.name} saved to the live menu`);
      } else {
        // Global/AI recipe: create the menu item, then its BOM.
        const item = await menuService.createItem({
          name: studio.name,
          code: `AI-${slug(studio.name).slice(0, 12)}`,
          base_price: studio.base_price ?? suggestedPrice ?? 0,
          item_type: "dish",
          description: studio.instructions || "Created from recipe studio",
          outlet_id: getActiveOutlet() ?? undefined,
        });
        await menuService.createRecipe(item.id, payload);
        setStudio((s) => (s ? { ...s, kind: "catalog", item_id: item.id } : s));
        void initRestaurantStore();
        toast.success(`${studio.name} created on the menu with its BOM`);
      }
    } catch {
      toast.error("Could not save the recipe to the menu");
    } finally {
      setSaving(false);
    }
  };

  /** Draft POs (missing) + PRs (low) for every line that's short. */
  const createOrders = async () => {
    if (!studio) return;
    const lines: AiReorderLine[] = computed
      .filter((l) => l.status === "low" || l.status === "missing")
      .map((l) => ({
        inventory_item_id: l.inventory_item_id,
        name: l.inv_name,
        status: l.status === "missing" ? "missing" : "low",
        suggested_po_qty: Math.max(1, Math.ceil(l.required - l.available)),
        shortfall: Math.max(0, l.required - l.available),
        available_stock: l.available,
        required_for_n: l.required,
      }));
    if (!lines.length) {
      toast.info("Everything is in stock — nothing to order");
      return;
    }
    setReorderBusy(true);
    setReorderResult(null);
    menuService
      .aiRecipeReorder({
        recipe_name_or_id: studio.item_id ?? studio.name,
        recipe_name: studio.name,
        portions,
        lines,
        outlet_id: getActiveOutlet(),
      })
      .then((res) => {
        setReorderResult(res);
        const created = (res.po_created?.length ?? 0) + (res.pr_created?.length ?? 0);
        if (created > 0) {
          toast.success(
            `Created ${created} purchase document${created === 1 ? "" : "s"} (${
              res.po_created?.length ?? 0
            } PO, ${res.pr_created?.length ?? 0} PR)`,
          );
        } else {
          toast.info(res.reason ?? res.note ?? "No purchase documents created");
        }
      })
      .catch(() => toast.error("Could not create purchase orders"))
      .finally(() => setReorderBusy(false));
  };

  /** Pull central-warehouse stock into the kitchen for short lines. */
  const transferToKitchen = async () => {
    if (!studio || !kitchenLoc) {
      toast.error("No kitchen storage location found. Run location bootstrap first.");
      return;
    }
    const targets = computed.filter(
      (l) => (l.status === "low" || l.status === "missing") && l.inventory_item_id != null,
    );
    if (!targets.length) {
      toast.info("Nothing to transfer — all gaps need a new purchase order");
      return;
    }
    setTransferring(true);
    setTransferred([]);
    let ok = 0;
    for (const ln of targets) {
      if (!ln.inventory_item_id) continue;
      // Best source: central warehouse first, then any non-kitchen location.
      const candidates = locations
        .filter((l) => l.id !== kitchenLoc.id)
        .map((l) => ({
          id: l.id,
          name: l.name,
          is_central: l.is_central,
          available: transferMap[l.id] ?? 0,
        }))
        .filter((c) => c.available > 0)
        .sort((a, b) => (b.is_central ? 1 : 0) - (a.is_central ? 1 : 0));
      const src = candidates[0];
      if (!src) continue;
      const give = Math.min(src.available, Math.ceil(ln.required - ln.available));
      if (give <= 0) continue;
      try {
        const res = await inventoryService.transferStock({
          outlet_id: getActiveOutlet() ?? "",
          inventory_item_id: ln.inventory_item_id,
          source_location_id: src.id,
          destination_location_id: kitchenLoc.id,
          qty: give,
          notes: `Recipe pull: ${studio.name} (${portions} portions)`,
        });
        ok += 1;
        setTransferred((prev) => [...(prev ?? []), res]);
        setTransferMap((prev) => ({ ...prev, [src.id]: (prev[src.id] ?? 0) - give }));
      } catch {
        /* keep going — one failed transfer shouldn't block the rest */
      }
    }
    setTransferring(false);
    if (ok > 0) {
      toast.success(`Transferred ${ok} ingredient${ok === 1 ? "" : "s"} into the kitchen`);
    } else {
      toast.warning("No transfers completed — check central stock availability");
    }
  };

  /* ═══════════════ AI SEARCH (3-source fan-out) ═══════════════ */

  const [aiImageB64, setAiImageB64] = useState<string | null>(null);
  const [aiImageName, setAiImageName] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<AiRecipeResult[]>([]);
  const [aiMeta, setAiMeta] = useState<{
    provider_used: string | null;
    error: string | null;
  } | null>(null);
  const [aiSearching, setAiSearching] = useState(false);

  const runAiSearch = useCallback(
    async (q: string, imgB64: string | null) => {
      setAiSearching(true);
      try {
        const res = await menuService.aiRecipeSearch({
          query: q,
          image_b64: imgB64,
          portions: 1,
          limit: 6,
          provider: "auto",
        });
        setAiResults(res.results ?? []);
        setAiMeta({ provider_used: res.provider_used ?? null, error: res.error ?? null });
      } catch {
        setAiResults([]);
        setAiMeta(null);
      } finally {
        setAiSearching(false);
      }
    },
    [],
  );

  // The 3-source fan-out runs in the background off the SAME search box:
  // catalog lands instantly, then LLM → Zomato/Swiggy → catalog floor merges in.
  useEffect(() => {
    if (!query.trim() && !aiImageB64) return;
    const t = setTimeout(() => runAiSearch(query, aiImageB64), 600);
    return () => clearTimeout(t);
  }, [query, aiImageB64, runAiSearch]);

  const onAiImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      if (!b64) return;
      setAiImageB64(b64);
      setAiImageName(file.name);
      runAiSearch(query, b64);
    };
    reader.readAsDataURL(file);
  };

  /* ═══════════════ UI ═══════════════ */

  const closeAll = () => {
    setStudio(null);
    setAiResults([]);
    setReorderResult(null);
    setTransferred(null);
  };

  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <PageContainer>
      {/* ── Themed banner header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/12 via-ai/8 to-transparent p-5 ring-1 ring-inset ring-primary/10">
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-card">
            <ChefHat className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Recipe Studio</div>
            <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              Find any dish — from your catalog or the web — then fully control it: ingredients,
              scale, pricing, stock, orders and kitchen transfers.
            </p>
          </div>
          {studio && (
            <Button variant="outline" size="sm" className="shrink-0 bg-card" onClick={closeAll}>
              <X className="size-3.5 mr-1" /> Close recipe
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[400px_1fr]">
        {/* ═══════════ LEFT — ONE SEARCH BOX, THREE SOURCES ═══════════ */}
        <Panel bodyClass="p-0 flex flex-col" className="min-h-[420px]">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any recipe: “boneless chicken biryani”, or snap a photo…"
                className="h-9 pl-9 pr-20 text-sm"
              />
              <label className="absolute right-2 top-1.5 flex cursor-pointer items-center gap-1 rounded-md bg-ai/10 px-2 py-1.5 text-[11px] font-medium text-ai hover:bg-ai/20">
                <Images className="size-3.5" />
                {aiImageB64 ? "Photo ✓" : "Photo"}
                <input type="file" accept="image/*" className="hidden" onChange={onAiImagePick} />
              </label>
            </div>

            {aiImageB64 && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-ai/5 px-2.5 py-1.5 text-[11px] text-ai ring-1 ring-inset ring-ai/20">
                <Images className="size-3.5" />
                <span className="truncate">{aiImageName ?? "photo"}</span>
                <button
                  className="ml-auto text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setAiImageB64(null);
                    setAiImageName(null);
                  }}
                  aria-label="Remove photo"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {aiMeta?.error && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-2 text-[11px] text-warning ring-1 ring-inset ring-warning/20">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{aiMeta.error}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {/* ── Source 1: your catalog (instant RAG) ── */}
            <div className="px-1 pb-1 pt-1">
              <div className="flex items-center justify-between">
                <span className="eyebrow flex items-center gap-1.5">
                  <BookOpen className="size-3.5" /> Your catalog
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {searching ? "…" : `${results.length} match${results.length === 1 ? "" : "es"}`}
                </span>
              </div>
            </div>
            {results.map((r) => {
              const active = studio?.item_id === r.item_id;
              return (
                <button
                  key={r.item_id}
                  onClick={() => openCatalogRecipe(r)}
                  className={cn(
                    "mb-1.5 flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
                    active
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                      : "border-transparent hover:border-border hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-lg",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Utensils className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{r.name}</span>
                      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                        {r.ingredient_count} items
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] font-medium text-primary">
                        {money(r.base_price)}
                      </span>
                      {query &&
                        r.match_reasons.slice(0, 2).map((reason, i) => (
                          <span
                            key={i}
                            className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {reason}
                          </span>
                        ))}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* ── Source 2: global AI + web (LLM → aggregators) in background ── */}
            {(aiResults.length > 0 || aiSearching || (query.trim() !== "" && !results.length)) && (
              <div className="mt-2 border-t pt-2">
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="eyebrow flex items-center gap-1.5">
                    <Sparkles className="size-3.5" /> Global · AI &amp; web
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {aiMeta?.provider_used && (
                      <StatusBadge status={`via ${aiMeta.provider_used}`} tone="ai" />
                    )}
                    {aiSearching && (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" /> searching…
                      </span>
                    )}
                  </span>
                </div>
                {aiResults.map((r) => {
                  const isLlm = r.source === "llm";
                  return (
                    <button
                      key={r.recipe_id || r.name}
                      onClick={() => openAiRecipe(r)}
                      className={cn(
                        "mb-1.5 flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
                        studio?.kind === "ai" && studio.name === r.name
                          ? "border-ai/40 bg-ai/5 ring-1 ring-ai/20"
                          : "border-transparent hover:border-border hover:bg-muted/50",
                      )}
                    >
                      <div
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-lg",
                          isLlm
                            ? "bg-ai text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isLlm ? <Sparkles className="size-4" /> : <Utensils className="size-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{r.name}</span>
                          <StatusBadge
                            status={
                              isLlm
                                ? "AI"
                                : r.source === "zomato"
                                  ? "Zomato"
                                  : r.source === "swiggy"
                                    ? "Swiggy"
                                    : "Catalog"
                            }
                            tone={isLlm ? "ai" : "neutral"}
                          />
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{r.ingredients.length} ingredients</span>
                          {typeof r.confidence === "number" && r.confidence > 0 && (
                            <span>{Math.round(r.confidence * 100)}% match</span>
                          )}
                          {r.base_price != null && (
                            <span className="font-medium text-primary">{money(r.base_price)}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {!searching && !aiSearching && results.length === 0 && aiResults.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Search className="size-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">
                  {query
                    ? `No catalog or web matches for “${query}”.`
                    : "Type a dish to search the catalog and the web."}
                </p>
              </div>
            )}
          </div>
        </Panel>

        {/* ═══════════ RIGHT — THE RECIPE STUDIO ═══════════ */}
        <div className="space-y-4">
          {!studio ? (
            <div className="grid place-items-center rounded-2xl border border-dashed bg-card/50 px-6 py-20 text-center">
              <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-ai/15 text-primary">
                <ChefHat className="size-8" />
              </div>
              <h2 className="mt-4 text-base font-semibold">Pick a recipe to begin</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Choose from your catalog or a global dish. Everything you see is editable — the
                chef drives scale, ingredients, price and stock.
              </p>
            </div>
          ) : (
            <>
              {/* ① — recipe details, fully editable */}
              <Panel>
                <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <StepBadge n={1} />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <Label className="text-[11px]">Dish name</Label>
                        <Input
                          value={studio.name}
                          onChange={(e) => patch({ name: e.target.value })}
                          className="mt-1 h-9 text-sm font-medium"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px]">Method / instructions</Label>
                        <textarea
                          value={studio.instructions}
                          onChange={(e) => patch({ instructions: e.target.value })}
                          rows={2}
                          placeholder="Cooking method, plating notes, prep steps…"
                          className="mt-1 w-full resize-none rounded-md border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-[260px] flex-col gap-3 sm:min-w-[320px]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Portions</Label>
                        <PortionsStepper value={portions} onChange={setPortions} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Yield</Label>
                        <Input
                          type="number"
                          min={0.001}
                          step={1}
                          value={studio.yield_qty}
                          onChange={(e) =>
                            patch({ yield_qty: Math.max(0.001, Number(e.target.value) || 1) })
                          }
                          className="h-7 w-20 text-center text-sm tabular"
                        />
                      </div>
                    </div>

                    {/* pricing controls */}
                    <div className="rounded-xl border bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Coins className="size-3.5" /> Selling price
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={studio.base_price ?? 0}
                          onChange={(e) => patch({ base_price: num(e.target.value) })}
                          className="h-7 w-24 text-right text-sm tabular"
                        />
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <Label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <SlidersHorizontal className="size-3.5" /> Target margin
                        </Label>
                        <input
                          type="range"
                          min={0}
                          max={80}
                          step={5}
                          value={margin}
                          onChange={(e) => setMargin(Number(e.target.value))}
                          className="flex-1 accent-[var(--color-primary)]"
                        />
                        <span className="w-10 text-right text-xs font-semibold tabular">
                          {margin}%
                        </span>
                      </div>
                      <div className="mt-1.5 text-[11px] text-muted-foreground">
                        Suggested price at this margin:{" "}
                        <span className="font-semibold text-foreground tabular">
                          {money(suggestedPrice)}
                        </span>
                        {studio.base_price != null && (
                          <span
                            className={cn(
                              "ml-2",
                              studio.base_price >= suggestedPrice ? "text-success" : "text-critical",
                            )}
                          >
                            {studio.base_price >= suggestedPrice
                              ? `· ${money(studio.base_price - suggestedPrice)} above cost+margin`
                              : `· ${money(suggestedPrice - studio.base_price)} below suggested`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <KpiCard
                  label="Total ingredient cost"
                  value={totalCost ? money(totalCost) : "—"}
                  sub={`for ${portions} portions`}
                  icon={<Coins />}
                />
                <KpiCard
                  label="Cost / portion"
                  value={costPerPortion ? money(costPerPortion) : "—"}
                  sub={`suggested ${money(suggestedPrice)}`}
                  icon={<Percent />}
                />
                <KpiCard
                  label="Stock status"
                  value={gapCount ? "Gaps" : "Ready"}
                  sub={`${lowCount} low · ${missingCount} missing`}
                  icon={<PackageSearch />}
                />
                <KpiCard
                  label="Unmapped lines"
                  value={String(unknownCount)}
                  sub="map or create in inventory"
                  icon={<AlertTriangle />}
                />
              </div>

              {/* ② — ingredient manager: the chef's full control surface */}
              <Panel bodyClass="p-0">
                <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
                  <StepBadge n={2} tone="info" />
                  <h2 className="text-sm font-semibold">Ingredients — {computed.length}</h2>
                  <div className="ml-auto flex items-center gap-2">
                    <select
                      value=""
                      onChange={(e) => e.target.value && addLineFromInventory(e.target.value)}
                      className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">+ Add ingredient…</option>
                      {invItems.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Ingredient</th>
                        <th className="px-3 py-2.5 text-right font-medium">Qty / batch</th>
                        <th className="px-3 py-2.5 text-right font-medium">Wastage</th>
                        <th className="px-3 py-2.5 text-center font-medium">Optional</th>
                        <th className="px-3 py-2.5 text-right font-medium">Required</th>
                        <th className="px-3 py-2.5 font-medium">Stock</th>
                        <th className="px-3 py-2.5 text-right font-medium">Cost</th>
                        <th className="px-4 py-2.5 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computed.map((ln) => (
                        <tr key={ln.key} className="group border-b last:border-0">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() => removeLine(ln.key)}
                                aria-label="Remove ingredient"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                              <div className="min-w-0">
                                <div className="font-medium">
                                  {ln.status === "unknown" ? ln.name : ln.inv_name}
                                </div>
                                {ln.status === "unknown" ? (
                                  <div className="text-[11px] text-critical">
                                    not in inventory — map or create
                                  </div>
                                ) : (
                                  ln.inv_code && (
                                    <div className="text-[11px] text-muted-foreground">
                                      {ln.inv_code}
                                    </div>
                                  )
                                )}
                              </div>
                            </div>

                            {/* unresolved-line controls: re-map or create in inventory */}
                            {ln.status === "unknown" && (
                              <div className="mt-2 space-y-2 pl-8">
                                <div className="flex items-center gap-2">
                                  <select
                                    value=""
                                    onChange={(e) => {
                                      const iid = e.target.value;
                                      if (iid) patchLine(ln.key, { inventory_item_id: iid });
                                    }}
                                    className="h-7 rounded-md border bg-background px-2 text-[11px] outline-none focus:ring-1 focus:ring-ring"
                                  >
                                    <option value="">Map to an existing item…</option>
                                    {invItems.map((i) => (
                                      <option key={i.id} value={i.id}>
                                        {i.name} ({i.code}) · {i.total_available} in stock
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-[11px]"
                                    onClick={() => {
                                      setCreatingKey(creatingKey === ln.key ? null : ln.key);
                                      setCreateDraft({ cost: "", reorder: "" });
                                    }}
                                  >
                                    <PackagePlus className="mr-1 size-3" />
                                    Create in inventory
                                  </Button>
                                </div>
                                {creatingKey === ln.key && (
                                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      placeholder="Std cost"
                                      value={createDraft.cost}
                                      onChange={(e) =>
                                        setCreateDraft((d) => ({ ...d, cost: e.target.value }))
                                      }
                                      className="h-7 w-24 text-xs"
                                    />
                                    <Input
                                      type="number"
                                      min={0}
                                      placeholder="Reorder level"
                                      value={createDraft.reorder}
                                      onChange={(e) =>
                                        setCreateDraft((d) => ({ ...d, reorder: e.target.value }))
                                      }
                                      className="h-7 w-24 text-xs"
                                    />
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs"
                                      disabled={creating}
                                      onClick={() => createInventoryItem(ln)}
                                    >
                                      {creating ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="size-3.5 mr-1" />
                                      )}
                                      Create
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Input
                              type="number"
                              min={0}
                              step={0.1}
                              value={ln.qty}
                              onChange={(e) =>
                                patchLine(ln.key, { qty: Math.max(0, Number(e.target.value) || 0) })
                              }
                              className="h-7 w-16 text-right text-xs tabular"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={ln.wastage_pct}
                                onChange={(e) =>
                                  patchLine(ln.key, {
                                    wastage_pct: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                                  })
                                }
                                className="h-7 w-12 text-right text-xs tabular"
                              />
                              <span className="text-[10px] text-muted-foreground">%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={() =>
                                patchLine(ln.key, { is_optional: !ln.is_optional })
                              }
                              aria-label="Toggle optional"
                              className={cn(
                                "grid size-5 place-items-center rounded border transition-colors",
                                ln.is_optional
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border",
                              )}
                            >
                              {ln.is_optional && <CheckCircle2 className="size-3.5" />}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="font-mono text-xs tabular">
                              {Math.round(ln.required)}
                            </span>
                          </td>
                          <td className="w-40 px-3 py-2.5">
                            <div className="mb-1 flex items-center justify-between text-[11px] tabular text-muted-foreground">
                              <span>
                                {ln.available} / {Math.round(ln.required)}
                              </span>
                              {ln.available < ln.required && ln.status !== "unknown" && (
                                <span className="text-critical">
                                  −{Math.ceil(ln.required - ln.available)}
                                </span>
                              )}
                            </div>
                            <StockBar
                              required={ln.required}
                              available={ln.available}
                              status={ln.status}
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs tabular">
                            {ln.line_cost != null ? money(ln.line_cost) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <StatusBadge
                              status={statusLabel[ln.status] ?? "Unknown"}
                              tone={statusTone[ln.status] ?? "neutral"}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {computed.length === 0 && (
                  <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
                    <AlertTriangle className="size-3.5" /> No ingredients yet — add one from your
                    inventory above.
                  </div>
                )}
                {unknownCount > 0 && (
                  <div className="flex items-center gap-2 border-t bg-critical/5 px-4 py-2.5 text-xs text-critical">
                    <AlertTriangle className="size-3.5" />
                    {unknownCount} ingredient(s) not yet in your inventory — map them or create
                    them before saving.
                  </div>
                )}
              </Panel>

              {/* ③ — actions */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <StepBadge n={3} />
                    <div>
                      <div className="text-sm font-semibold">Save to menu</div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {studio.kind === "catalog" ? "Upsert this BOM" : "Create menu item + BOM"}
                      </p>
                    </div>
                  </div>
                  <Button onClick={saveToMenu} disabled={saving || unknownCount > 0}>
                    {saving ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5 mr-1" />
                    )}
                    Save
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <StepBadge n={3} tone="info" />
                    <div>
                      <div className="text-sm font-semibold">Create orders</div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        PO for missing · PR for low ({gapCount} line
                        {gapCount === 1 ? "" : "s"})
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={createOrders}
                    disabled={reorderBusy || gapCount === 0}
                  >
                    {reorderBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ShoppingCart className="size-3.5 mr-1" />
                    )}
                    Order
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <StepBadge n={3} tone="info" />
                    <div>
                      <div className="text-sm font-semibold">Pull into kitchen</div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Transfer central stock to the kitchen
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={transferToKitchen}
                    disabled={transferring || !kitchenLoc}
                  >
                    {transferring ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <PackageSearch className="size-3.5 mr-1" />
                    )}
                    Transfer
                  </Button>
                </div>
              </div>

              {/* order + transfer results */}
              {(reorderResult?.po_created?.length ?? 0) > 0 ||
              (reorderResult?.pr_created?.length ?? 0) > 0 ? (
                <Panel>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="size-4 text-success" />
                      Purchase documents created
                    </div>
                    {reorderResult!.po_created!.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground"
                      >
                        <Circle className="size-2 text-primary" /> PO {c.number} — {c.lines} line(s)
                      </div>
                    ))}
                    {reorderResult!.pr_created!.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground"
                      >
                        <Circle className="size-2 text-info" /> PR {c.number} — {c.lines} line(s)
                      </div>
                    ))}
                    {reorderResult!.note && (
                      <div className="text-muted-foreground">{reorderResult!.note}</div>
                    )}
                  </div>
                </Panel>
              ) : null}

              {(transferred?.length ?? 0) > 0 && transferred && (
                <Panel>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="size-4 text-success" />
                      {transferred.length} transfer
                      {transferred.length === 1 ? "" : "s"} posted to kitchen
                    </div>
                    {transferred.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground"
                      >
                        <Circle className="size-2 text-success" />
                        {t.item_id.slice(0, 8)} · {t.qty} · {t.source_location_name} →{" "}
                        {t.destination_location_name}
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
