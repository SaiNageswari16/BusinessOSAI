import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Images,
  Loader2,
  Minus,
  PackageSearch,
  Plus,
  Save,
  Search,
  ShoppingCart,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { KpiCard, PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  menuService,
  type AiReconcileLine,
  type AiReconcileResult,
  type AiReorderResponse,
  type AiRecipeResult,
  type RecipeBreakdown,
  type RecipeSearchResult,
} from "@/services/menuService";
import {
  inventoryService,
  type StockTransferResult,
} from "@/services/inventoryService";
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
          "Find a recipe, check live stock, save it to the menu, order what's missing, and pull stock into the kitchen.",
      },
    ],
  }),
  component: Recipes,
});

/** An inventory item as returned by /api/v1/inventory/items. */
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

/** Where the kitchen physically pulls ingredients from. */
type KitchenLocation = {
  location_id: string;
  location_name: string;
  available: number;
  has_stock: boolean;
};

/** A joined breakdown line with a kitchen-transfer recommendation. */
type JoinedLine = {
  inventory_item_id: string;
  name: string;
  code: string;
  qty_per_portion: number;
  wastage_pct: number;
  required: number;
  available: number;
  sufficient: boolean;
  shortfall: number;
  standard_cost: number | null;
  line_cost: number | null;
  /** The central warehouse (or other non-kitchen location) to transfer from. */
  transfer_from: KitchenLocation | null;
  /** How much of the shortfall this location can cover. */
  transferable: number;
  /** How much still has to be ordered after a transfer. */
  order_qty: number;
};

function Recipes() {
  // ── catalog search + selection state ──────────────────────────────────────
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<RecipeSearchResult | null>(null);

  // ── breakdown / scale state (shared by catalog and AI flows) ─────────────
  const [portions, setPortions] = useState(4);
  const [breakdown, setBreakdown] = useState<RecipeBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  // ── inventory join data + locations for kitchen transfer ─────────────────
  const [invItems, setInvItems] = useState<InvItem[]>([]);
  const [locations, setLocations] = useState<StorageLocationInfo[]>([]);
  const [transferMap, setTransferMap] = useState<Record<string, number>>({});
  const invById = useMemo(
    () => new Map(invItems.map((i) => [i.id, i])),
    [invItems],
  );

  useEffect(() => {
    inventoryService
      .getItems()
      .then((items) => setInvItems(items as InvItem[]))
      .catch(() => {
        /* inventory offline — breakdown still shows ids, transfer degrades */
      });
    inventoryService
      .getLocations()
      .then((locs) => setLocations(locs))
      .catch(() => {
        /* locations offline — transfer step disabled gracefully */
      });
  }, []);

  // ── catalog search (debounced) ────────────────────────────────────────────
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

  // Open a catalog recipe → fetch its breakdown at the current scale.
  const openRecipe = useCallback(
    async (r: RecipeSearchResult) => {
      setSelected(r);
      setLoading(true);
      setReconciled(null);
      setReorderResult(null);
      setTransferred(null);
      try {
        const bd = await menuService.getRecipeBreakdown(r.item_id, portions);
        setBreakdown(bd);
      } catch {
        toast.error("Could not load recipe breakdown");
        setBreakdown(null);
      } finally {
        setLoading(false);
      }
    },
    [portions],
  );

  // Re-fetch the breakdown whenever the scale changes for an open recipe.
  useEffect(() => {
    if (selected) openRecipe(selected);
  }, [portions, selected, openRecipe]);

  // ── inventory join + kitchen transfer recommendation ──────────────────────
  // For each line: how much of the shortfall can come from the central
  // warehouse (a non-kitchen location with stock), and how much must be
  // ordered. The kitchen location is "the one" that already holds module
  // stock; the central warehouse tops it up.
  const kitchenLoc = useMemo(
    () =>
      locations.find((l) => l.module === "restaurant") ??
      locations.find((l) => l.module === "kitchen") ??
      null,
    [locations],
  );

  const joinedLines: JoinedLine[] = useMemo(() => {
    if (!breakdown) return [];
    return breakdown.lines.map((ln) => {
      const inv = invById.get(ln.inventory_item_id);
      const required = inv
        ? ln.qty_per_portion * portions * (1 + ln.wastage_pct / 100)
        : ln.required_for_n;
      const available = inv?.total_available ?? 0;
      const sufficient = inv ? available >= required : false;
      const shortfall = sufficient ? 0 : required - available;
      const cost = inv?.standard_cost ?? null;

      // Find the best non-kitchen source with stock to cover the shortfall.
      // Prefer the central warehouse; otherwise any non-kitchen location.
      let transferFrom: KitchenLocation | null = null;
      let transferable = 0;
      if (shortfall > 0) {
        const candidates = locations
          .filter((l) => !kitchenLoc || l.id !== kitchenLoc.id)
          .map((l) => ({
            location_id: l.id,
            location_name: l.name,
            is_central: l.is_central,
            available: transferMap[l.id] ?? 0,
          }))
          .filter((c) => c.available > 0)
          .sort((a, b) => (b.is_central ? 1 : 0) - (a.is_central ? 1 : 0));
        // Use the first candidate with enough stock.
        for (const c of candidates) {
          const give = Math.min(c.available, shortfall);
          if (give > 0) {
            transferFrom = {
              location_id: c.location_id,
              location_name: c.location_name,
              available: c.available,
              has_stock: true,
            };
            transferable = give;
            break;
          }
        }
      }
      const orderQty = Math.max(0, shortfall - transferable);
      return {
        inventory_item_id: ln.inventory_item_id,
        name: inv?.name ?? ln.name ?? "Unresolved ingredient",
        code: inv?.code ?? ln.code ?? "",
        qty_per_portion: ln.qty_per_portion,
        wastage_pct: ln.wastage_pct,
        required,
        available,
        sufficient,
        shortfall,
        standard_cost: cost,
        line_cost: cost !== null ? required * cost : null,
        transfer_from: transferFrom,
        transferable,
        order_qty: orderQty,
      };
    });
  }, [breakdown, invById, portions, locations, kitchenLoc, transferMap]);

  const totalCost = joinedLines.reduce((sum, ln) => sum + (ln.line_cost ?? 0), 0);
  const hasShortage = joinedLines.some((ln) => !ln.sufficient);
  const transferableCount = joinedLines.filter((ln) => ln.transferable > 0).length;
  const orderableCount = joinedLines.filter((ln) => ln.order_qty > 0).length;

  // ── save the recipe to the live menu ──────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const saveToMenu = async () => {
    if (!selected || !breakdown) return;
    setSaving(true);
    const lines = joinedLines.map((ln) => ({
      inventory_item_id: ln.inventory_item_id,
      qty: ln.qty_per_portion,
      uom_id: null,
      wastage_pct: ln.wastage_pct,
      is_optional: false,
    }));
    try {
      await menuService.createRecipe(selected.item_id, {
        name: selected.name,
        yield_qty: selected.yield_qty,
        instructions: selected.instructions ?? undefined,
        lines,
      });
      toast.success(`${selected.name} saved to the live menu`);
    } catch {
      toast.error("Could not save the recipe to the menu");
    } finally {
      setSaving(false);
    }
  };

  // ── kitchen transfer (central warehouse → kitchen) ───────────────────────
  const [transferring, setTransferring] = useState(false);
  const [transferred, setTransferred] = useState<StockTransferResult[] | null>(null);
  const transferToKitchen = async () => {
    if (!kitchenLoc) {
      toast.error("No kitchen storage location found. Run location bootstrap first.");
      return;
    }
    const targets = joinedLines.filter((ln) => ln.transferable > 0);
    if (!targets.length) {
      toast.info("Nothing to transfer — all gaps need a new purchase order");
      return;
    }
    setTransferring(true);
    setTransferred([]);
    let ok = 0;
    for (const ln of targets) {
      const src = ln.transfer_from;
      if (!src) continue;
      try {
        const res = await inventoryService.transferStock({
          outlet_id: getActiveOutlet() ?? "",
          inventory_item_id: ln.inventory_item_id,
          source_location_id: src.location_id,
          destination_location_id: kitchenLoc.id,
          qty: Math.ceil(ln.transferable),
          notes: `Recipe pull: ${selected?.name ?? "recipe"} (${portions} portions)`,
        });
        ok += 1;
        setTransferred((prev) => [...(prev ?? []), res]);
        // Recompute available for subsequent lines in the same pass.
        setTransferMap((prev) => ({
          ...prev,
          [src.location_id]: (prev[src.location_id] ?? 0) - Math.ceil(ln.transferable),
        }));
      } catch {
        /* keep going — one failed transfer shouldn't block the rest */
      }
    }
    setTransferring(false);
    if (ok > 0) {
      toast.success(
        `Transferred ${ok} ingredient${ok === 1 ? "" : "s"} from central to kitchen`,
      );
    } else {
      toast.warning("No transfers completed — check stock availability");
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // AI global search (text + optional image, multimodal)
  // ═══════════════════════════════════════════════════════════════════════
  const [aiQuery, setAiQuery] = useState("");
  const [aiImageB64, setAiImageB64] = useState<string | null>(null);
  const [aiImageName, setAiImageName] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<AiRecipeResult[]>([]);
  const [aiMeta, setAiMeta] = useState<{
    provider_used: string | null;
    error: string | null;
  } | null>(null);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiSelected, setAiSelected] = useState<AiRecipeResult | null>(null);
  const [reconciled, setReconciled] = useState<AiReconcileResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [reorderResult, setReorderResult] = useState<AiReorderResponse | null>(
    null,
  );

  const runAiSearch = useCallback(
    async (q: string, imgB64: string | null) => {
      setAiSearching(true);
      try {
        const res = await menuService.aiRecipeSearch({
          query: q,
          image_b64: imgB64,
          portions,
          limit: 6,
          provider: "auto",
        });
        setAiResults(res.results ?? []);
        setAiMeta({
          provider_used: res.provider_used ?? null,
          error: res.error ?? null,
        });
      } catch {
        setAiResults([]);
        setAiMeta(null);
      } finally {
        setAiSearching(false);
      }
    },
    [portions],
  );

  // Debounced AI text search (400 ms); a photo alone is also a valid search.
  useEffect(() => {
    if (!aiQuery.trim() && !aiImageB64) return;
    const t = setTimeout(() => runAiSearch(aiQuery, aiImageB64), 400);
    return () => clearTimeout(t);
  }, [aiQuery, aiImageB64, runAiSearch]);

  // Opening an AI result → reconcile it against CURRENT inventory.
  const openAiRecipe = useCallback(
    async (r: AiRecipeResult) => {
      setAiSelected(r);
      setReconciled(null);
      setReorderResult(null);
      setTransferred(null);
      setAiLoading(true);
      try {
        const rec = await menuService.aiRecipeReconcile({
          recipe_id: r.recipe_id,
          portions,
          outlet_id: getActiveOutlet(),
        });
        setReconciled(rec);
      } catch {
        toast.error("Could not reconcile recipe against inventory");
      } finally {
        setAiLoading(false);
      }
    },
    [portions],
  );

  // Re-reconcile live when the portions stepper changes for an open AI recipe.
  useEffect(() => {
    if (aiSelected) openAiRecipe(aiSelected);
  }, [portions, aiSelected, openAiRecipe]);

  // Image picker → base64 for the multimodal LLM call.
  const onAiImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const b64 = dataUrl.split(",")[1];
      if (!b64) return;
      setAiImageB64(b64);
      setAiImageName(file.name);
      runAiSearch(aiQuery, b64);
    };
    reader.readAsDataURL(file);
  };

  const clearAiImage = () => {
    setAiImageB64(null);
    setAiImageName(null);
  };

  // Save an LLM / global recipe to the menu: it's not a catalog item, so
  // create a fresh menu item + its BOM in one step.
  const saveAiToMenu = async () => {
    if (!aiSelected || !reconciled) return;
    setSaving(true);
    try {
      const item = await menuService.createItem({
        name: aiSelected.name,
        code: `AI-${aiSelected.recipe_id.slice(0, 8)}`,
        base_price: aiSelected.base_price ?? 0,
        item_type: (aiSelected.item_type as "dish") || "dish",
        description: aiSelected.description ?? "Created from AI recipe search",
        outlet_id: getActiveOutlet() ?? undefined,
      });
      const lines = reconciled.lines
        .filter((l) => l.inventory_item_id != null)
        .map((l) => ({
          inventory_item_id: l.inventory_item_id!,
          qty: Math.ceil(l.required_for_n / Math.max(1, portions)),
          uom_id: null,
          wastage_pct: 0,
          is_optional: false,
        }));
      await menuService.createRecipe(item.id, {
        name: aiSelected.name,
        yield_qty: 1,
        instructions: aiSelected.description ?? undefined,
        lines,
      });
      toast.success(`${aiSelected.name} created on the menu with its BOM`);
      setAiSelected(null);
      setReconciled(null);
      // Now find it in the catalog for the full flow.
      setQuery(aiSelected.name);
    } catch {
      toast.error("Could not save the recipe to the menu");
    } finally {
      setSaving(false);
    }
  };

  // A line is reorderable when it's matched to a live inventory item AND not
  // fully in stock.
  const reorderable = (l: AiReconcileLine) =>
    l.inventory_item_id != null && l.status !== "in_stock";

  const lowCount =
    reconciled?.lines.filter((l) => l.status === "low").length ?? 0;
  const missingCount =
    reconciled?.lines.filter((l) => l.status === "missing").length ?? 0;

  // "Reorder" one row, or batch "Create PO/PR" across all missing/low lines.
  const reorderLines = (line?: AiReconcileLine) => {
    if (!reconciled || !aiSelected) return;
    const target = line ? [line] : reconciled.lines.filter(reorderable);
    const lines = target
      .filter(
        (l): l is AiReconcileLine & { inventory_item_id: string } =>
          l.inventory_item_id != null,
      )
      .map((l) => ({
        inventory_item_id: l.inventory_item_id,
        name: l.name,
        status: l.status,
        suggested_po_qty: Math.max(
          1,
          Math.ceil(l.suggested_po_qty ?? l.shortfall),
        ),
        shortfall: l.shortfall,
        reorder_level: l.reorder_level ?? 0,
        available_stock: l.available_stock,
        required_for_n: l.required_for_n,
      }));
    if (!lines.length) {
      toast.info("No reorderable ingredients (none matched live inventory)");
      return;
    }
    setReorderBusy(true);
    menuService
      .aiRecipeReorder({
        recipe_name_or_id: aiSelected.name,
        portions,
        lines,
        outlet_id: getActiveOutlet(),
        recipe_name: aiSelected.name,
      })
      .then((res) => {
        setReorderResult(res);
        const created =
          (res.po_created?.length ?? 0) + (res.pr_created?.length ?? 0);
        toast.success(
          created > 0
            ? `Created ${created} purchase document${created === 1 ? "" : "s"} for the missing/low lines`
            : res.note || "No new POs needed — all lines already covered",
        );
        if (res.idempotent?.length) {
          toast.warning(
            `${res.idempotent.length} line${res.idempotent.length === 1 ? "" : "s"} already had an open PO/PR — skipped`,
          );
        }
      })
      .catch(() => toast.error("Could not create purchase orders"))
      .finally(() => setReorderBusy(false));
  };

  const statusTone: Record<string, "success" | "warning" | "critical"> = {
    in_stock: "success",
    low: "warning",
    missing: "critical",
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Recipe Studio"
        title="Recipes"
        description="Find a recipe, check live stock, save it to your menu, order what's missing, and pull stock into the kitchen."
        actions={
          selected ? (
            <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
              <X className="size-3.5 mr-1" /> Close recipe
            </Button>
          ) : null
        }
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* ── Catalog search (RAG retrieval) ────────────────────────────────── */}
        <Panel
          title="Recipe catalog"
          bodyClass="p-0 flex flex-col"
          className="min-h-[400px]"
        >
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search: chicken, biryani, veg starter…"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {searching
                ? "Searching…"
                : `${results.length} recipe${results.length === 1 ? "" : "s"} found`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {results.map((r) => {
              const active = selected?.item_id === r.item_id;
              return (
                <button
                  key={r.item_id}
                  onClick={() => openRecipe(r)}
                  className={cn(
                    "block w-full border-b px-3 py-2.5 text-left transition-colors",
                    active ? "bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{r.name}</span>
                    {r.ingredient_count > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {r.ingredient_count} ingredients
                      </span>
                    )}
                  </div>
                  {query && r.match_reasons.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.match_reasons.slice(0, 3).map((reason, i) => (
                        <span
                          key={i}
                          className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Suggested price {money(r.base_price)}
                  </div>
                </button>
              );
            })}
            {!searching && results.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No recipes match “{query}”.
              </div>
            )}
          </div>
        </Panel>

        {/* ── AI global search (LLM + multimodal) ───────────────────────────── */}
        <Panel
          title="AI recipe search"
          bodyClass="p-0 flex flex-col"
          className="min-h-[200px]"
        >
          <div className="border-b p-3">
            <div className="relative">
              <Sparkles className="absolute left-2.5 top-2.5 size-3.5 text-ai" />
              <Input
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="AI search: “a spicy biryani”, or snap a photo…"
                className="h-8 pl-8 pr-16 text-xs"
              />
              <label className="absolute right-2 top-1.5 flex cursor-pointer items-center gap-1 rounded bg-ai/10 px-2 py-1 text-[10px] font-medium text-ai">
                <Images className="size-3" />
                {aiImageB64 ? "Photo ✓" : "Photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onAiImagePick}
                />
              </label>
            </div>

            {aiImageB64 && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-ai/5 px-2 py-1 text-[11px] text-ai">
                <Images className="size-3" />
                <span className="truncate">{aiImageName ?? "photo"}</span>
                <button
                  className="ml-auto text-muted-foreground hover:text-foreground"
                  onClick={clearAiImage}
                  aria-label="Remove photo"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}

            {aiMeta?.error && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                <span>{aiMeta.error} — showing catalog results where possible.</span>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {aiMeta?.provider_used
                  ? `via ${aiMeta.provider_used}`
                  : aiResults.length
                    ? "catalog"
                    : "text or photo"}
              </span>
              {aiSearching && <Loader2 className="size-3.5 animate-spin" />}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {aiResults.map((r) => (
              <button
                key={r.recipe_id || r.name}
                onClick={() => openAiRecipe(r)}
                className={cn(
                  "block w-full border-b px-3 py-2.5 text-left transition-colors",
                  aiSelected?.recipe_id === r.recipe_id
                    ? "bg-ai/5"
                    : "hover:bg-muted/50",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{r.name}</span>
                  <StatusBadge
                    status={r.source === "llm" ? "AI" : "Catalog"}
                    tone={r.source === "llm" ? "ai" : "neutral"}
                  />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {r.ingredients.length} ingredient
                  {r.ingredients.length === 1 ? "" : "s"}
                  {typeof r.confidence === "number" &&
                    r.confidence > 0 &&
                    ` · ${Math.round(r.confidence * 100)}% match`}
                  {r.base_price != null && ` · ${money(r.base_price)}`}
                </div>
              </button>
            ))}
            {!aiSearching && aiResults.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No AI matches yet. Type a dish or pick a photo.
              </div>
            )}
          </div>
        </Panel>

        {/* ── The action pipeline ─────────────────────────────────────────── */}
        <div className="space-y-4">
          {reconciled && aiSelected ? (
            /* ── AI reconcile view: detail + save + PO + transfer ─────────── */
            <>
              <Panel title={reconciled.name}>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <span className="text-xs text-muted-foreground">
                    Reconciled against live inventory for {reconciled.portions}{" "}
                    portion{reconciled.portions === 1 ? "" : "s"}.
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">
                      Portions
                    </Label>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        onClick={() => setPortions((p) => Math.max(1, p - 1))}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={portions}
                        onChange={(e) =>
                          setPortions(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="h-7 w-16 text-center text-sm tabular"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        onClick={() => setPortions((p) => p + 1)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                {aiLoading && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Reconciling…
                  </div>
                )}
                {/* Save-to-menu step for an LLM / global recipe */}
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    Not on your menu yet? Save it as a new menu item with this
                    BOM, then order what's missing.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={saveAiToMenu}
                  >
                    <Save className="size-3.5 mr-1" />
                    {saving ? "Saving…" : "Save to menu"}
                  </Button>
                </div>
              </Panel>

              <div className="grid grid-cols-3 gap-3">
                <KpiCard
                  label="Total ingredient cost"
                  value={
                    reconciled.total_cost != null
                      ? money(reconciled.total_cost)
                      : "—"
                  }
                  sub={`for ${reconciled.portions} portions`}
                />
                <KpiCard
                  label="Low ingredients"
                  value={String(lowCount)}
                  sub="at/below reorder"
                />
                <KpiCard
                  label="Missing ingredients"
                  value={String(missingCount)}
                  sub="not in stock"
                />
              </div>

              <Panel
                title="Ingredient detail — stock vs required"
                bodyClass="p-0"
                action={
                  lowCount > 0 || missingCount > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={reorderBusy}
                      onClick={() => reorderLines()}
                    >
                      <ShoppingCart className="size-3.5 mr-1" />
                      {reorderBusy
                        ? "Creating…"
                        : `Create PO / PR · ${lowCount + missingCount}`}
                    </Button>
                  ) : null
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Ingredient</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Required ({reconciled.portions})
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Stock
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Shortfall
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Unit cost
                        </th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 text-right font-medium">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciled.lines.map((ln) => (
                        <tr
                          key={ln.inventory_item_id ?? ln.name}
                          className="border-b last:border-0"
                        >
                          <td className="px-4 py-2">
                            <div className="font-medium">
                              {ln.name || "Unresolved ingredient"}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {ln.unit && `${ln.unit} · `}
                              {!ln.inventory_item_id
                                ? "no inventory match"
                                : "matched to live stock"}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular">
                            {Math.round(ln.required_for_n)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular">
                            {ln.inventory_item_id != null
                              ? ln.available_stock
                              : "—"}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right font-mono text-xs tabular",
                              ln.shortfall > 0
                                ? "text-critical"
                                : "text-muted-foreground",
                            )}
                          >
                            {ln.shortfall > 0 ? Math.ceil(ln.shortfall) : 0}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular">
                            {ln.standard_cost != null
                              ? money(ln.standard_cost)
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge
                              status={
                                ln.status === "in_stock"
                                  ? "In stock"
                                  : ln.status === "low"
                                    ? "Low"
                                    : "Missing"
                              }
                              tone={statusTone[ln.status] ?? "neutral"}
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            {reorderable(ln) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs"
                                disabled={reorderBusy}
                                onClick={() => reorderLines(ln)}
                              >
                                Reorder
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {reorderResult && (
                  <div className="space-y-1.5 border-t p-3 text-xs">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="size-3.5 text-success" />
                      {(reorderResult.po_created?.length ?? 0) +
                        (reorderResult.pr_created?.length ?? 0)}{" "}
                      document(s) created
                    </div>
                    {reorderResult.po_created?.map((c) => (
                      <div key={c.id} className="font-mono text-[11px] text-muted-foreground">
                        PO {c.number} — {c.lines} line(s)
                      </div>
                    ))}
                    {reorderResult.pr_created?.map((c) => (
                      <div key={c.id} className="font-mono text-[11px] text-muted-foreground">
                        PR {c.number} — {c.lines} line(s)
                      </div>
                    ))}
                    {reorderResult.note && (
                      <div className="text-muted-foreground">
                        {reorderResult.note}
                      </div>
                    )}
                    {reorderResult.idempotent?.length > 0 && (
                      <div className="text-warning">
                        {reorderResult.idempotent.length} line(s) already
                        covered by an open PO/PR — skipped.
                      </div>
                    )}
                  </div>
                )}
              </Panel>
            </>
          ) : !selected ? (
            <Panel>
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <ChefHat className="size-10 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium">Select a recipe to begin</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pick a predefined recipe from the catalog, or use the AI
                    search to pull a global recipe. Then scale it, check stock,
                    save to the menu, order what's missing, and pull stock into
                    the kitchen.
                  </p>
                </div>
              </div>
            </Panel>
          ) : (
            /* ── Catalog recipe: the full 4-step pipeline ─────────────────── */
            <>
              {/* Step 1: recipe header + scale control */}
              <Panel title={`① ${selected.name}`}>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">
                      {selected.description || "Predefined recipe"}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">
                      Portions
                    </Label>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        onClick={() => setPortions((p) => Math.max(1, p - 1))}
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={portions}
                        onChange={(e) =>
                          setPortions(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="h-7 w-16 text-center text-sm tabular"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        onClick={() => setPortions((p) => p + 1)}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                {selected.instructions && (
                  <p className="mt-3 rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
                    <Sparkles className="mr-1 inline size-3.5 text-primary" />
                    {selected.instructions}
                  </p>
                )}
              </Panel>

              {/* Live KPIs */}
              {breakdown && (
                <div className="grid grid-cols-4 gap-3">
                  <KpiCard
                    label="Total ingredient cost"
                    value={totalCost ? money(totalCost) : "—"}
                    sub={`for ${portions} portions`}
                  />
                  <KpiCard
                    label="Ingredients"
                    value={String(joinedLines.length)}
                    sub="in this recipe"
                  />
                  <KpiCard
                    label="Transfer from central"
                    value={String(transferableCount)}
                    sub="can top up kitchen"
                  />
                  <KpiCard
                    label="Need to order"
                    value={String(orderableCount)}
                    sub="after transfer"
                  />
                </div>
              )}

              {/* Step 2: the scaled, live breakdown table with transfer plan */}
              <Panel
                title={`② Ingredient breakdown & kitchen transfer plan — ${portions} portion${portions === 1 ? "" : "s"}`}
                action={
                  loading ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : null
                }
                bodyClass="p-0"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Ingredient</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Per portion
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Required
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          In stock
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Transfer
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Order
                        </th>
                        <th className="px-4 py-2 text-right font-medium">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {joinedLines.map((ln) => (
                        <tr
                          key={ln.inventory_item_id}
                          className="border-b last:border-0"
                        >
                          <td className="px-4 py-2">
                            <div className="font-medium">
                              {ln.name || "Unresolved"}
                            </div>
                            {ln.code && (
                              <div className="text-[11px] text-muted-foreground">
                                {ln.code}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular">
                            {ln.qty_per_portion}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular">
                            {Math.round(ln.required)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular">
                            {ln.available}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {ln.transfer_from ? (
                              <div className="text-[11px]">
                                <span className="font-mono tabular">
                                  {Math.ceil(ln.transferable)}
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  from {ln.transfer_from.location_name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {ln.order_qty > 0 ? (
                              <span className="font-mono text-xs tabular text-critical">
                                {Math.ceil(ln.order_qty)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {!invById.has(ln.inventory_item_id) ? (
                              <StatusBadge status="Unknown" tone="neutral" />
                            ) : ln.sufficient ? (
                              <StatusBadge status="In stock" tone="success" />
                            ) : ln.order_qty > 0 ? (
                              <StatusBadge
                                status={`Order ${Math.ceil(ln.order_qty)}`}
                                tone="critical"
                              />
                            ) : (
                              <StatusBadge
                                status="Transfer"
                                tone="warning"
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {breakdown && hasShortage && (
                  <div className="flex items-center gap-2 border-t bg-critical/5 px-4 py-2 text-xs text-critical">
                    <AlertTriangle className="size-3.5" />
                    {joinedLines.filter((ln) => !ln.sufficient).length}{" "}
                    ingredient(s) below required level for {portions} portions.
                  </div>
                )}
              </Panel>

              {/* Step 3: save to menu */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Save className="size-4 text-primary" />
                    ③ Save to menu
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Saves <b>{selected.name}</b> with this BOM to the live menu
                    so the POS and kitchen can sell and track it.
                  </p>
                </div>
                <Button onClick={saveToMenu} disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-3.5 mr-1 animate-spin" />
                  ) : null}
                  Save to menu
                </Button>
              </div>

              {/* Step 4: transfer from central warehouse into the kitchen */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Upload className="size-4 text-info" />
                    ④ Pull into kitchen
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Transfers what the central warehouse can cover into the
                    kitchen storage location. The rest becomes a purchase
                    order.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={transferToKitchen}
                  disabled={transferring || transferableCount === 0}
                >
                  {transferring ? (
                    <Loader2 className="size-3.5 mr-1 animate-spin" />
                  ) : (
                    <PackageSearch className="size-3.5 mr-1.5" />
                  )}
                  Transfer {transferableCount} line{transferableCount === 1 ? "" : "s"}
                </Button>
              </div>

              {(transferred?.length ?? 0) > 0 && transferred && (
                <Panel title="Kitchen transfer completed" bodyClass="p-0">
                  <div className="space-y-1.5 p-3 text-xs">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="size-3.5 text-success" />
                      {transferred.length} transfer
                      {transferred.length === 1 ? "" : "s"} posted
                    </div>
                    {transferred.map((t, i) => (
                      <div
                        key={i}
                        className="font-mono text-[11px] text-muted-foreground"
                      >
                        {t.item_id.slice(0, 8)} · {t.qty} from{" "}
                        {t.source_location_name} → {t.destination_location_name}
                      </div>
                    ))}
                    {orderableCount > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 text-critical">
                        <ShoppingCart className="size-3.5" />
                        {orderableCount} line(s) still need a purchase order —
                        run the AI reorder for the remainder.
                      </div>
                    )}
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
