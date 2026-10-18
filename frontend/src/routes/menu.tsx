import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { BookOpen, ChefHat, Layers, Plus, Scale, Sparkles } from "lucide-react";
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
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    price: "",
    category: "Starters",
    station: "Main" as KitchenStation,
    prepMins: "12",
    veg: true,
  });

  const list = items.filter(
    (i) => (cat === "All" || i.category === cat) && i.name.toLowerCase().includes(q.toLowerCase()),
  );

  const save = () => {
    if (!draft.name || !Number(draft.price)) return toast.error("Name and price are required");
    const created = addMenuItem({
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
        /* Recipes & Food Costing View */
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recipes.map((rec) => {
              const menuItem = items.find((m) => m.id === rec.itemId);
              const sellingPrice = menuItem?.price || 1;
              const costMargin = Math.round(((sellingPrice - rec.cost) / sellingPrice) * 100);
              const costPct = Math.round((rec.cost / sellingPrice) * 100);

              return (
                <div key={rec.itemId} className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-base">{rec.itemName}</div>
                      <div className="text-xs text-muted-foreground">
                        Selling: <b>{money(sellingPrice)}</b> · Prep cost: <b>{money(rec.cost)}</b>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-semibold tabular",
                        costPct <= 30 ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
                      )}
                    >
                      {costPct}% Cost ({costMargin}% Margin)
                    </span>
                  </div>

                  <div className="space-y-1.5 border-t pt-2.5">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      Constituent Ingredients (Per Portion)
                    </div>
                    <ul className="divide-y text-xs">
                      {rec.ingredients.map((ing, idx) => (
                        <li key={idx} className="flex justify-between py-1">
                          <span>{ing.name}</span>
                          <span className="font-mono text-muted-foreground tabular">
                            {ing.qty} {ing.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {rec.prepInstructions && (
                    <div className="border-t pt-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                      <span className="font-semibold text-foreground">Chef method: </span>
                      {rec.prepInstructions}
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
