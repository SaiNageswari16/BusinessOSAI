import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BookOpen,
  ChefHat,
  Layers,
  Plus,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { menuCategories, modifierGroups } from "@/data/menu";
import {
  addMenuItem,
  toggleMenuItemAvailability,
  useInventory,
  useMenu,
  useRecipes,
} from "@/services/orderService";
import { menuService, type RecipeCost } from "@/services/menuService";
import { money } from "@/lib/format";
import type { KitchenStation, MenuItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu Management — RestaurantOS" },
      {
        name: "description",
        content: "Manage dishes, categories, pricing, availability and modifiers.",
      },
      { property: "og:title", content: "Menu Management — RestaurantOS" },
      {
        property: "og:description",
        content: "Manage dishes, categories, pricing, availability and modifiers.",
      },
    ],
  }),
  component: Menu,
});

function Menu() {
  const items = useMenu();
  const recipes = useRecipes();
  const inventory = useInventory();

  const [activeTab, setActiveTab] = useState<"items" | "recipes">("items");
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [costs, setCosts] = useState<Record<string, RecipeCost>>({});
  const [costLoading, setCostLoading] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    price: "",
    category: "Starters",
    station: "Main" as KitchenStation,
    prepMins: "12",
    veg: true,
  });

  const loadCosts = useCallback(
    async (itemList: MenuItem[]) => {
      setCostLoading(true);
      try {
        // Map over the sliced list directly so result index === item index.
        const targets = itemList.slice(0, 40);
        const results = await Promise.allSettled(
          targets.map((i) => menuService.getRecipeCost(i.id)),
        );
        const next: Record<string, RecipeCost> = {};
        results.forEach((r, idx) => {
          const target = targets[idx];
          if (target && r.status === "fulfilled" && r.value) next[target.id] = r.value;
        });
        setCosts((prev) => ({ ...prev, ...next }));
      } catch (e) {
        console.warn("Recipe cost load failed", e);
      } finally {
        setCostLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (items.length > 0) loadCosts(items);
  }, [items, loadCosts]);

  const list = items.filter(
    (i) => (cat === "All" || i.category === cat) && i.name.toLowerCase().includes(q.toLowerCase()),
  );

  const save = async () => {
    if (!draft.name || !Number(draft.price)) {
      toast.error("Name and price are required");
      return;
    }
    const created = await addMenuItem({
      name: draft.name,
      description: draft.description || "Freshly prepared specialty dish.",
      category: draft.category,
      price: Number(draft.price),
      prepMins: Number(draft.prepMins) || 12,
      veg: draft.veg,
      available: true,
      station: draft.station,
      costPct: 30,
    });
    toast.success(`${created.name} added to live menu`);
    setDraft({
      name: "",
      description: "",
      price: "",
      category: "Starters",
      station: "Main",
      prepMins: "12",
      veg: true,
    });
    setOpen(false);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Catalogue & Kitchen Costing"
        title="Menu & Recipes"
        description={`${items.length} items · ${items.filter((i) => !i.available).length} sold out`}
        actions={
          <div className="flex gap-2">
            <div className="flex rounded-md border p-0.5">
              <button
                onClick={() => setActiveTab("items")}
                className={cn(
                  "rounded px-3 py-1 text-xs",
                  activeTab === "items"
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                Dishes & Modifiers
              </button>
              <button
                onClick={() => setActiveTab("recipes")}
                className={cn(
                  "rounded px-3 py-1 text-xs",
                  activeTab === "recipes"
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                Recipe Costing ({recipes.length})
              </button>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4 mr-1.5" /> Add dish
            </Button>
          </div>
        }
      />

      {activeTab === "items" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <Panel bodyClass="p-0">
            <div className="flex flex-wrap items-center gap-1.5 border-b p-3">
              {["All", ...menuCategories].map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs",
                    c === cat
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {c}
                </button>
              ))}
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search items..."
                className="ml-auto h-8 w-full text-xs sm:w-56"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="font-medium">Category</th>
                    <th className="font-medium">Station</th>
                    <th className="text-right font-medium">Price</th>
                    <th className="text-right font-medium">Food cost</th>
                    <th className="px-4 text-right font-medium">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((i) => (
                    <tr key={i.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              i.veg ? "bg-success" : "bg-critical",
                            )}
                          />
                          <span className="font-medium">{i.name}</span>
                          {i.popular && <StatusBadge status="Popular" tone="warning" />}
                        </div>
                        <div className="pl-4 text-xs text-muted-foreground">{i.description}</div>
                      </td>
                      <td className="text-muted-foreground">{i.category}</td>
                      <td className="text-muted-foreground font-mono text-xs">{i.station}</td>
                      <td className="text-right font-semibold tabular">{money(i.price)}</td>
                      <td
                        className={cn(
                          "text-right tabular font-mono text-xs",
                          i.costPct > 35 ? "text-critical font-bold" : "text-muted-foreground",
                        )}
                      >
                        {i.costPct}%
                      </td>
                      <td className="px-4 text-right">
                        <Switch
                          checked={i.available}
                          onCheckedChange={(v) => {
                            toggleMenuItemAvailability(i.id, v);
                            toast.success(
                              `${i.name} is now ${v ? "available" : "marked sold out"}`,
                            );
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                  {!list.length && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                        No dishes found matching your query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Modifier Groups & Add-ons">
            <div className="space-y-4">
              {modifierGroups.map((g) => (
                <div key={g.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{g.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {g.type === "single" ? "Single select" : "Multi select"}
                    </span>
                  </div>
                  <ul className="mt-1.5 divide-y rounded-md border text-sm">
                    {g.options.map((o) => (
                      <li key={o.id} className="flex justify-between px-3 py-1.5">
                        <span>{o.name}</span>
                        <span className="tabular text-muted-foreground font-mono text-xs">
                          {o.price ? `+${money(o.price)}` : "Included"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      ) : (
        /* Recipes & Food Costing View — live computed from menu + inventory services */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Food cost computed live from recipe BOM × inventory standard cost.
              {costLoading && " Refreshing…"}
            </span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => loadCosts(items)}>
              <Scale className="size-3.5 mr-1" /> Recompute costs
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(costs).length > 0
              ? items.filter((i) => costs[i.id])
              : items.slice(0, 12)
            ).map((item) => {
              const live = costs[item.id];
              const sellingPrice = live?.selling_price ?? item.price;
              const foodCost = live?.food_cost;
              const foodCostPct = live?.food_cost_pct;
              const margin = live?.margin;
              const pctGood = foodCostPct !== null && foodCostPct !== undefined && foodCostPct <= 30;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border bg-card p-4 space-y-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-base flex items-center gap-2">
                        {item.name}
                        {item.veg && (
                          <span className="text-[10px] rounded bg-success/15 px-1.5 py-0.5 text-success">
                            VEG
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Selling <b className="text-foreground">{money(sellingPrice)}</b>
                        {margin !== null && margin !== undefined && (
                          <> · Prep cost <b className="text-foreground">{money(foodCost ?? 0)}</b></>
                        )}
                      </div>
                    </div>
                    {foodCostPct !== null && foodCostPct !== undefined ? (
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold tabular",
                          pctGood
                            ? "bg-success/15 text-success"
                            : "bg-warning/15 text-warning",
                        )}
                      >
                        {pctGood ? (
                          <TrendingUp className="size-3" />
                        ) : (
                          <TrendingDown className="size-3" />
                        )}
                        {foodCostPct}% Cost
                      </span>
                    ) : (
                      <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        No recipe yet
                      </span>
                    )}
                  </div>

                  {live && live.lines.length > 0 && (
                    <div className="space-y-1.5 border-t pt-2.5">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Constituent Ingredients (Per Portion)
                      </div>
                      <ul className="divide-y text-xs">
                        {live.lines.map((line) => (
                          <li key={line.inventory_item_id} className="flex justify-between py-1">
                            <span className="truncate">
                              {line.standard_cost === null ? "—" : ""}
                              {line.inventory_item_id.slice(0, 8)}
                            </span>
                            <span className="font-mono text-muted-foreground tabular">
                              {line.qty_per_portion} × {line.standard_cost ?? "…"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {live?.cost_known === false && (
                    <div className="border-t pt-2 text-[11px] text-warning bg-warning/10 p-2 rounded">
                      <Wallet className="inline size-3 mr-1" />
                      Cost data unavailable (inventory service offline) — totals withheld rather
                      than shown as zero.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Item Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Menu Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Dish Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Malai Kofta"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Cottage cheese dumplings in cashew gravy"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Selling Price (₹)</Label>
                <Input
                  type="number"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  placeholder="280"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(v) => setDraft({ ...draft, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {menuCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prep Station</Label>
                <Select
                  value={draft.station}
                  onValueChange={(v) => setDraft({ ...draft, station: v as KitchenStation })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      ["Tandoor", "Main", "Biryani", "Beverages", "Desserts"] as KitchenStation[]
                    ).map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Avg Prep (Minutes)</Label>
                <Input
                  type="number"
                  value={draft.prepMins}
                  onChange={(e) => setDraft({ ...draft, prepMins: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={draft.veg} onCheckedChange={(v) => setDraft({ ...draft, veg: v })} />
              <Label>Vegetarian Dish</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Add to Catalogue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
