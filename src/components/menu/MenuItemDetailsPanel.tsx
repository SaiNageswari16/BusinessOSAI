import {
  Check,
  Clock,
  ConciergeBell,
  Copy,
  History,
  Layers,
  Pencil,
  Plus,
  ReceiptText,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { useState } from "react";

import {
  calculateRecipeCost,
  getMenuAddons,
  getMenuCategoryDisplay,
  getMenuDisplayName,
  getMenuFullDescription,
  getMenuItemTypeDisplay,
  getMenuModifiers,
  getMenuPrepTimeMins,
  getMenuServingSize,
  getMenuShortSubtitle,
  getMenuTags,
  getTagBadgeStyle,
} from "@/components/menu/menu-utils";
import { getDishImage } from "@/lib/images";
import { MODIFIERS } from "@/lib/seed";
import type { Addon, Ingredient, MenuItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export type MenuDetailsTab = "details" | "modifiers" | "addons" | "recipe" | "history";

interface MenuItemDetailsPanelProps {
  item: MenuItem | undefined;
  gstPct: number;
  ingredients: Ingredient[];
  onClose?: () => void;
  onEditItem: (item: MenuItem) => void;
  onDuplicateItem: (item: MenuItem) => void;
  onDeleteItem: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
  onUpdateItemPatch: (item: MenuItem, patch: Partial<MenuItem>) => void;
}

export function MenuItemDetailsPanel({
  item,
  gstPct,
  ingredients,
  onClose,
  onEditItem,
  onDuplicateItem,
  onDeleteItem,
  onToggleAvailability,
  onUpdateItemPatch,
}: MenuItemDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<MenuDetailsTab>("details");
  const [newModifierText, setNewModifierText] = useState("");
  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("40");

  if (!item) {
    return (
      <aside className="flex w-full shrink-0 flex-col items-center justify-center rounded-2xl border border-[#E1E9F4] bg-white p-6 text-center shadow-2xs xl:w-[376px]">
        <p className="text-[14px] font-extrabold text-[#102344]">No Menu Item Selected</p>
        <p className="mt-1 text-[12px] text-[#64748B]">
          Click any dish card from the menu grid to inspect details, modifiers, recipe, and pricing.
        </p>
      </aside>
    );
  }

  const displayName = getMenuDisplayName(item);
  const modifiers = getMenuModifiers(item);
  const addons = getMenuAddons(item);
  const tags = getMenuTags(item);
  const { cost, marginPct } = calculateRecipeCost(item, ingredients);

  const handleToggleModifier = (mod: string) => {
    const exists = modifiers.includes(mod);
    const next = exists ? modifiers.filter((m) => m !== mod) : [...modifiers, mod];
    onUpdateItemPatch(item, { modifiers: next });
  };

  const handleAddCustomModifier = () => {
    const clean = newModifierText.trim();
    if (!clean) return;
    if (!modifiers.includes(clean)) {
      onUpdateItemPatch(item, { modifiers: [...modifiers, clean] });
    }
    setNewModifierText("");
  };

  const handleAddAddon = () => {
    const clean = newAddonName.trim();
    const price = Number(newAddonPrice);
    if (!clean || !Number.isFinite(price) || price <= 0) return;
    const next: Addon[] = [...addons, { name: clean, price: Math.round(price) }];
    onUpdateItemPatch(item, { addons: next });
    setNewAddonName("");
    setNewAddonPrice("40");
  };

  const handleRemoveAddon = (name: string) => {
    onUpdateItemPatch(item, { addons: addons.filter((a) => a.name !== name) });
  };

  return (
    <aside className="flex w-full shrink-0 flex-col justify-between rounded-2xl border border-[#E1E9F4] bg-white p-4 shadow-2xs xl:w-[376px]">
      <div>
        {/* 1. Selected Item Header */}
        <div className="flex gap-3.5">
          <img
            src={getDishImage(item.name, item.category)}
            alt={displayName}
            className="h-[116px] w-[116px] shrink-0 rounded-2xl border border-[#E2EBF6] object-cover shadow-xs"
          />

          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div>
              {/* Badges + Close button */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.bestseller && (
                    <span className="rounded-md bg-[#EF4444] px-2 py-0.5 text-[10px] font-extrabold text-white">
                      Bestseller
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-extrabold",
                      item.available
                        ? "bg-[#DCFCE7] text-[#059669]"
                        : "bg-[#FEE2E2] text-[#DC2626]",
                    )}
                  >
                    {item.available ? "Available" : "Sold Out"}
                  </span>
                </div>

                {onClose && (
                  <button
                    type="button"
                    aria-label="Close item details"
                    onClick={onClose}
                    className="rounded-lg p-1 text-[#64748B] transition-colors hover:bg-slate-100 hover:text-[#102344]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Item Name */}
              <h3 className="mt-1.5 truncate text-[17px] font-extrabold leading-tight text-[#102344]">
                {displayName}
              </h3>

              {/* Dietary Badge */}
              <div className="mt-1">
                {item.veg ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-bold text-[#16A34A]">
                    <span className="flex h-3 w-3 items-center justify-center rounded-xs border border-[#16A34A]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                    </span>
                    Veg
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#FFF1F2] px-1.5 py-0.5 text-[10px] font-bold text-[#E11D48]">
                    <span className="flex h-3 w-3 items-center justify-center rounded-xs border border-[#E11D48]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#E11D48]" />
                    </span>
                    Non-Veg
                  </span>
                )}
              </div>

              {/* Short Subtitle */}
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#526581]">
                {getMenuShortSubtitle(item)}
              </p>
            </div>

            {/* Price + Edit Item Button */}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[19px] font-extrabold text-[#102344] tabular">
                ₹{item.price}
              </span>
              <button
                type="button"
                onClick={() => onEditItem(item)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0866F5] px-3 py-1.5 text-[11.5px] font-extrabold text-white shadow-xs transition-colors hover:bg-[#0756D0]"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit Item</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Tabs Bar */}
        <div className="mt-4 flex items-center justify-between border-b border-[#E2EBF6]">
          {(
            [
              { id: "details", label: "Details" },
              { id: "modifiers", label: `Modifiers (${modifiers.length})` },
              { id: "addons", label: `Add-ons (${addons.length})` },
              { id: "recipe", label: "Recipe" },
              { id: "history", label: "History" },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative pb-2.5 text-[11.5px] font-bold transition-colors",
                  active
                    ? "text-[#0866F5] font-extrabold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2.5px] after:rounded-full after:bg-[#0866F5]"
                    : "text-[#526581] hover:text-[#102344]",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 3. Tab Content */}
        {activeTab === "details" && (
          <div className="mt-3 space-y-3.5">
            {/* Metadata Table Card */}
            <div className="divide-y divide-[#E9F0F8] rounded-2xl border border-[#E4EDF8] bg-[#F8FAFE] px-3.5">
              <div className="flex items-center justify-between py-2.5 text-[12px]">
                <span className="flex items-center gap-2 font-medium text-[#526581]">
                  <Layers className="h-3.5 w-3.5 text-[#3B82F6]" />
                  Category
                </span>
                <span className="font-extrabold text-[#102344]">
                  {getMenuCategoryDisplay(item)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 text-[12px]">
                <span className="flex items-center gap-2 font-medium text-[#526581]">
                  <Utensils className="h-3.5 w-3.5 text-[#3B82F6]" />
                  Item Type
                </span>
                <span className="font-extrabold text-[#102344]">
                  {getMenuItemTypeDisplay(item)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 text-[12px]">
                <span className="flex items-center gap-2 font-medium text-[#526581]">
                  <Clock className="h-3.5 w-3.5 text-[#3B82F6]" />
                  Preparation Time
                </span>
                <span className="font-extrabold text-[#102344]">
                  {getMenuPrepTimeMins(item)} mins
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 text-[12px]">
                <span className="flex items-center gap-2 font-medium text-[#526581]">
                  <ConciergeBell className="h-3.5 w-3.5 text-[#3B82F6]" />
                  Serving Size
                </span>
                <span className="font-extrabold text-[#102344]">
                  {getMenuServingSize(item)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 text-[12px]">
                <span className="flex items-center gap-2 font-medium text-[#526581]">
                  <ReceiptText className="h-3.5 w-3.5 text-[#3B82F6]" />
                  Tax Rate
                </span>
                <span className="font-extrabold text-[#102344]">{gstPct}% GST</span>
              </div>

              <div className="flex items-center justify-between py-2.5 text-[12px]">
                <span className="flex items-center gap-2 font-medium text-[#526581]">
                  <Sparkles className="h-3.5 w-3.5 text-[#3B82F6]" />
                  Availability
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.available}
                  aria-label={`Toggle availability for ${displayName}`}
                  onClick={() => onToggleAvailability(item)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                    item.available ? "bg-[#0866F5]" : "bg-[#CBD5E1]",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition-transform",
                      item.available ? "translate-x-5.5" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Description Block */}
            <div>
              <h4 className="text-[13px] font-extrabold text-[#102344]">Description</h4>
              <p className="mt-1 text-[12px] leading-relaxed text-[#475569]">
                {getMenuFullDescription(item)}
              </p>
            </div>

            {/* Tags Block */}
            <div>
              <h4 className="text-[13px] font-extrabold text-[#102344]">Tags</h4>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[11px] font-bold",
                      getTagBadgeStyle(tag),
                    )}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "modifiers" && (
          <div className="mt-3 space-y-3">
            <p className="text-[11.5px] text-[#526581]">
              Select kitchen preparation modifiers available in POS for{" "}
              <span className="font-bold text-[#102344]">{displayName}</span>:
            </p>
            <div className="space-y-1.5">
              {Array.from(new Set([...MODIFIERS, ...modifiers])).map((mod) => {
                const active = modifiers.includes(mod);
                return (
                  <button
                    key={mod}
                    type="button"
                    onClick={() => handleToggleModifier(mod)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-[12px] font-bold transition-all",
                      active
                        ? "border-[#BFDBFE] bg-[#EDF4FF] text-[#0866F5]"
                        : "border-[#E2E8F0] bg-[#FAFBFD] text-[#475569] hover:bg-slate-50",
                    )}
                  >
                    <span>{mod}</span>
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md border",
                        active
                          ? "border-[#0866F5] bg-[#0866F5] text-white"
                          : "border-[#CBD5E1] bg-white",
                      )}
                    >
                      {active && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={newModifierText}
                onChange={(e) => setNewModifierText(e.target.value)}
                placeholder="Add custom modifier (e.g. Bone-in)..."
                className="h-9 flex-1 rounded-xl border border-[#DCE6F2] bg-[#FAFBFD] px-3 text-[12px] focus:border-[#0866F5] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomModifier}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-[#0866F5] px-3 text-[11.5px] font-bold text-white hover:bg-[#0756D0]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>
        )}

        {activeTab === "addons" && (
          <div className="mt-3 space-y-3">
            <p className="text-[11.5px] text-[#526581]">
              Paid add-ons offered at POS checkout for{" "}
              <span className="font-bold text-[#102344]">{displayName}</span>:
            </p>
            <div className="space-y-1.5">
              {addons.map((addon) => (
                <div
                  key={addon.name}
                  className="flex items-center justify-between rounded-xl border border-[#E2EBF6] bg-[#F8FAFE] px-3 py-2 text-[12px]"
                >
                  <div>
                    <div className="font-extrabold text-[#102344]">{addon.name}</div>
                    <div className="text-[10.5px] text-[#64748B]">Optional extra portion</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-extrabold text-[#059669] tabular">
                      +₹{addon.price}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAddon(addon.name)}
                      className="rounded-lg p-1 text-[#64748B] hover:bg-rose-50 hover:text-[#E11D48]"
                      aria-label={`Remove ${addon.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={newAddonName}
                onChange={(e) => setNewAddonName(e.target.value)}
                placeholder="Add-on name..."
                className="h-9 flex-1 rounded-xl border border-[#DCE6F2] bg-[#FAFBFD] px-2.5 text-[12px] focus:border-[#0866F5] focus:outline-none"
              />
              <input
                type="number"
                value={newAddonPrice}
                onChange={(e) => setNewAddonPrice(e.target.value)}
                placeholder="₹"
                className="h-9 w-16 rounded-xl border border-[#DCE6F2] bg-[#FAFBFD] px-2 text-[12px] tabular focus:border-[#0866F5] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddAddon}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-[#0866F5] px-3 text-[11.5px] font-bold text-white hover:bg-[#0756D0]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>
        )}

        {activeTab === "recipe" && (
          <div className="mt-3 space-y-3">
            {/* Cost & Margin Summary */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#E4EDF8] bg-[#F8FAFE] p-2.5 text-center">
              <div>
                <div className="text-[10px] font-semibold text-[#64748B]">Food Cost</div>
                <div className="mt-0.5 text-[14px] font-extrabold text-[#102344] tabular">
                  ₹{cost}
                </div>
              </div>
              <div className="border-x border-[#E2EBF6]">
                <div className="text-[10px] font-semibold text-[#64748B]">Selling Price</div>
                <div className="mt-0.5 text-[14px] font-extrabold text-[#0866F5] tabular">
                  ₹{item.price}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#64748B]">Gross Margin</div>
                <div className="mt-0.5 text-[14px] font-extrabold text-[#059669] tabular">
                  {marginPct}%
                </div>
              </div>
            </div>

            {/* Ingredients List */}
            <div className="space-y-1.5">
              <div className="text-[11.5px] font-extrabold text-[#102344]">
                BOM Ingredients (Auto-deducted on KOT)
              </div>
              {item.recipe.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] p-3 text-center text-[11.5px] text-[#64748B]">
                  No raw ingredients linked yet. Click Edit Item to configure BOM recipe.
                </div>
              ) : (
                item.recipe.map((r) => {
                  const ing = ingredients.find((i) => i.id === r.ingredientId);
                  if (!ing) return null;
                  const lineCost = Math.round(ing.cost * r.qty);
                  return (
                    <div
                      key={r.ingredientId}
                      className="flex items-center justify-between rounded-xl border border-[#E2EBF6] bg-white px-3 py-2 text-[12px]"
                    >
                      <div>
                        <div className="font-bold text-[#102344]">{ing.name}</div>
                        <div className="text-[10.5px] text-[#64748B]">
                          Stock: {ing.stock} {ing.unit}
                        </div>
                      </div>
                      <div className="text-right tabular">
                        <div className="font-extrabold text-[#102344]">
                          {r.qty} {ing.unit}
                        </div>
                        <div className="text-[10.5px] font-semibold text-[#059669]">
                          ₹{lineCost}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="mt-3 space-y-2.5">
            <div className="flex items-start gap-2.5 rounded-xl border border-[#E2EBF6] bg-[#F8FAFE] p-2.5 text-[11.5px]">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-[#0866F5]" />
              <div>
                <div className="font-extrabold text-[#102344]">
                  Synced with POS & Kitchen Station ({item.station})
                </div>
                <div className="text-[10.5px] text-[#64748B]">
                  Current price ₹{item.price} • {item.available ? "Available" : "Sold Out"}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border border-[#E2EBF6] bg-white p-2.5 text-[11.5px]">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
              <div>
                <div className="font-bold text-[#102344]">Menu Verification Audit</div>
                <div className="text-[10.5px] text-[#64748B]">
                  Verified by Ananya (Manager) • {gstPct}% GST slab active
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border border-[#E2EBF6] bg-white p-2.5 text-[11.5px]">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]" />
              <div>
                <div className="font-bold text-[#102344]">Recipe BOM Costing Check</div>
                <div className="text-[10.5px] text-[#64748B]">
                  Portion cost ₹{cost} ({marginPct}% gross margin)
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Bottom Action Buttons */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-[#EEF3F9] pt-3.5">
        <button
          type="button"
          onClick={() => onDuplicateItem(item)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D5E0EE] bg-white px-3 py-2.5 text-[12.5px] font-extrabold text-[#102344] shadow-2xs transition-colors hover:border-blue-300 hover:bg-[#F8FAFC]"
        >
          <Copy className="h-3.5 w-3.5 text-[#334155]" />
          <span>Duplicate Item</span>
        </button>

        <button
          type="button"
          onClick={() => onDeleteItem(item)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-[#FECDD3] bg-[#FFF1F2]/70 px-3 py-2.5 text-[12.5px] font-extrabold text-[#E11D48] shadow-2xs transition-colors hover:bg-[#FFE4E6]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete Item</span>
        </button>
      </div>
    </aside>
  );
}
