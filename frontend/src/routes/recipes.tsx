import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Images,
  Loader2,
  Minus,
  Plus,
  Save,
  Search,
  ShoppingCart,
  Sparkles,
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
  type RecipeBreakdown,
  type RecipeSearchResult,
  type AiRecipeResult,
  type AiReconcileLine,
  type AiReconcileResult,
  type AiReorderResponse,
} from "@/services/menuService";
import { inventoryService } from "@/services/inventoryService";
import { getActiveOutlet } from "@/lib/auth-tokens";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recipes")({
  head: () => ({
    meta: [
      { title: "Recipes — RestaurantOS" },
      {
        name: "description",
        content: "Author dishes from the recipe catalog, scale by customer count, and save to the live menu.",
      },
    ],
  }),
  component: Recipes,
});

/** An inventory item as returned by /api/v1/inventory/items — the join source
 *  for turning a recipe's bare inventory_item_ids into names + live stock. */
type InvItem = {
  id: string;
  name: string;
  code: string;
  standard_cost: number;
  total_available: number;
};

/** A breakdown line after the frontend has joined it with inventory data. */
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
  /** The chef's customized qty for this line (editable). */
  qty_custom: number;
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

  // ── inventory join data ───────────────────────────────────────────────────
  const [invItems, setInvItems] = useState<InvItem[]>([]);
  const invById = useMemo(
    () => new Map(invItems.map((i) => [i.id, i])),
    [invItems],
  );

  useEffect(() => {
    inventoryService
      .getItems()
      .then((items) => setInvItems(items as InvItem[]))
      .catch(() => {
        /* inventory offline — breakdown shows raw ids, still functional */
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

  // ── the join: merge breakdown lines with live inventory ───────────────────
  const joinedLines: JoinedLine[] = useMemo(() => {
    if (!breakdown) return [];
    return breakdown.lines.map((ln) => {
      const inv = invById.get(ln.inventory_item_id);
      const required = inv
        ? ln.qty_per_portion * portions * (1 + ln.wastage_pct / 100)
        : ln.required_for_n;
      const available = inv?.total_available ?? 0;
      const sufficient = inv ? available >= required : false;
      const cost = inv?.standard_cost ?? null;
      return {
        inventory_item_id: ln.inventory_item_id,
        name: inv?.name ?? "Unresolved ingredient",
        code: inv?.code ?? "",
        qty_per_portion: ln.qty_per_portion,
        wastage_pct: ln.wastage_pct,
        required,
        available,
        sufficient,
        shortfall: sufficient ? 0 : required - available,
        standard_cost: cost,
        line_cost: cost !== null ? required * cost : null,
        qty_custom: ln.qty_per_portion,
      };
    });
  }, [breakdown, invById, portions]);

  const totalCost = joinedLines.reduce((sum, ln) => sum + (ln.line_cost ?? 0), 0);
  const hasShortage = joinedLines.some((ln) => !ln.sufficient);

  // ── customization: edit a line's qty (per portion) ────────────────────────
  const [edits, setEdits] = useState<Record<string, number>>({});
  const effectiveQty = (ln: JoinedLine) =>
    edits[ln.inventory_item_id] ?? ln.qty_per_portion;

  const updateQty = (ln: JoinedLine, value: number) => {
    if (Number.isNaN(value) || value < 0) return;
    setEdits((prev) => ({ ...prev, [ln.inventory_item_id]: value }));
  };

  // ── save the (possibly customized) recipe to the live menu ───────────────
  const saveToMenu = async () => {
    if (!selected || !breakdown) return;
    const lines = joinedLines.map((ln) => ({
      inventory_item_id: ln.inventory_item_id,
      qty: effectiveQty(ln),
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
        // Defensive: backend may still return partial catalog results with an error.
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
      setAiLoading(true);
      try {
        const rec = await menuService.aiRecipeReconcile({
          recipe_id: r.recipe_id,
          portions,
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

  // A line is reorderable when it's matched to a live inventory item AND not
  // fully in stock.
  const reorderable = (l: AiReconcileLine) =>
    l.inventory_item_id != null && l.status !== "in_stock";

  const lowCount = reconciled?.lines.filter((l) => l.status === "low").length ?? 0;
  const missingCount =
    reconciled?.lines.filter((l) => l.status === "missing").length ?? 0;

  // "Reorder" one row, or batch "Create PO" across all missing/low lines.
  const reorderLines = (line?: AiReconcileLine) => {
    if (!reconciled) return;
    const target = line ? [line] : reconciled.lines.filter(reorderable);
    const lines = target
      .filter(
        (l): l is AiReconcileLine & { inventory_item_id: string } =>
          l.inventory_item_id != null,
      )
      .map((l) => ({
        inventory_item_id: l.inventory_item_id,
        suggested_qty: Math.max(1, Math.ceil(l.shortfall)),
        name: l.name,
      }));
    if (!lines.length) {
      toast.info("No reorderable ingredients (none matched live inventory)");
      return;
    }
    setReorderBusy(true);
    menuService
      .aiRecipeReorder({
        outlet_id: getActiveOutlet(),
        lines,
      })
      .then((res) => {
        setReorderResult(res);
        toast.success(
          `${res.created} purchase order${res.created === 1 ? "" : "s"} created`,
          {
            description:
              res.po_ids.length > 0
                ? `PO ids: ${res.po_ids.join(", ")}`
                : res.note || "No new POs needed",
          },
        );
        if (res.skipped?.length) {
          toast.warning(
            `${res.skipped.length} line${
              res.skipped.length === 1 ? "" : "s"
            } skipped: ${res.skipped.map((s) => s.reason).join("; ")}`,
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
        description="Pick a predefined recipe, scale it to your customer count, check live stock, customize, and save to your menu."
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

        {/* ── Breakdown / editor ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          {reconciled && aiSelected ? (
            /* ── AI reconcile view ─────────────────────────────────────────── */
            <>
              <Panel title={reconciled.name}>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <span className="text-xs text-muted-foreground">
                    Reconciled against live inventory for {reconciled.portions} portion
                    {reconciled.portions === 1 ? "" : "s"}.
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Portions</Label>
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
                        : `Create PO · ${lowCount + missingCount}`}
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
                        <th className="px-3 py-2 text-right font-medium">Stock</th>
                        <th className="px-3 py-2 text-right font-medium">Shortfall</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Unit cost
                        </th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciled.lines.map((ln) => (
                        <tr
                          key={ln.inventory_item_id ?? ln.name}
                          className="border-b last:border-0"
                        >
                          <td className="px-4 py-2">
                            <div className="font-medium">{ln.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {!ln.inventory_item_id && "no inventory match"}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular">
                            {Math.round(ln.required_for_n)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular">
                            {ln.inventory_item_id != null ? ln.available_stock : "—"}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right font-mono text-xs tabular",
                              ln.shortfall > 0
                                ? "text-critical"
                                : "text-muted-foreground",
                            )}
                          >
                            {ln.shortfall > 0 ? ln.shortfall : 0}
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
                      {reorderResult.created} PO
                      {reorderResult.created === 1 ? "" : "s"} created
                    </div>
                    {reorderResult.po_ids.length > 0 && (
                      <div className="font-mono text-[11px] text-muted-foreground">
                        PO ids: {reorderResult.po_ids.join(", ")}
                      </div>
                    )}
                    {reorderResult.note && (
                      <div className="text-muted-foreground">{reorderResult.note}</div>
                    )}
                    {reorderResult.skipped?.length > 0 && (
                      <div className="text-warning">
                        {reorderResult.skipped.map((s, i) => (
                          <span key={s.inventory_item_id || i}>
                            {i > 0 && "; "}
                            {s.reason}
                          </span>
                        ))}
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
                    Pick a predefined recipe from the catalog, or use the AI search to
                    pull a global recipe, then scale it, check stock, and save to the menu.
                  </p>
                </div>
              </div>
            </Panel>
          ) : (
            /* ── Catalog recipe detail view ───────────────────────────────── */
            <>
              {/* Recipe header + scale control */}
              <Panel title={selected.name}>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">
                      {selected.description || "Predefined recipe"}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Portions</Label>
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
                <div className="grid grid-cols-3 gap-3">
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
                    label="Stock status"
                    value={hasShortage ? "Shortage" : "Sufficient"}
                    sub={hasShortage ? "below required" : "all covered"}
                  />
                </div>
              )}

              {/* The scaled, live breakdown table */}
              <Panel
                title={`Ingredient breakdown — ${portions} portion${portions === 1 ? "" : "s"}`}
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
                        <th className="px-3 py-2 text-right font-medium">Per portion</th>
                        <th className="px-3 py-2 text-right font-medium">Required</th>
                        <th className="px-3 py-2 text-right font-medium">In stock</th>
                        <th className="px-3 py-2 text-right font-medium">Cost</th>
                        <th className="px-4 py-2 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {joinedLines.map((ln) => (
                        <tr key={ln.inventory_item_id} className="border-b last:border-0">
                          <td className="px-4 py-2">
                            <div className="font-medium">{ln.name}</div>
                            {ln.code && (
                              <div className="text-[11px] text-muted-foreground">
                                {ln.code}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={effectiveQty(ln)}
                                onChange={(e) => updateQty(ln, Number(e.target.value))}
                                className="h-7 w-20 text-right text-xs tabular"
                              />
                              <span className="text-[11px] text-muted-foreground">
                                ×{portions}
                              </span>
                            </div>
                            {ln.wastage_pct > 0 && (
                              <div className="mt-0.5 text-[10px] text-muted-foreground">
                                +{ln.wastage_pct}% wastage
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular">
                            {Math.round(
                              effectiveQty(ln) * portions * (1 + ln.wastage_pct / 100),
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular">
                            {invById.has(ln.inventory_item_id) ? ln.available : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular">
                            {ln.line_cost !== null ? money(ln.line_cost) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {!invById.has(ln.inventory_item_id) ? (
                              <StatusBadge status="Unknown" tone="neutral" />
                            ) : ln.sufficient ? (
                              <StatusBadge status="In stock" tone="success" />
                            ) : (
                              <StatusBadge
                                status={`Short ${Math.ceil(ln.shortfall)}`}
                                tone="critical"
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
                    {joinedLines.filter((ln) => !ln.sufficient).length} ingredient(s)
                    below required level for {portions} portions.
                  </div>
                )}
              </Panel>

              {/* Save action */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Saves the recipe{" "}
                  {Object.keys(edits).length > 0 ? "with your custom quantities " : ""}
                  to the live menu as <b>{selected.name}</b>.
                </p>
                <Button onClick={saveToMenu}>
                  <Save className="size-3.5 mr-1.5" /> Save to menu
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
