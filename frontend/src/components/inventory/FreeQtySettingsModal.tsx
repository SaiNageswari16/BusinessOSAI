import React, { useState, useEffect, useCallback } from "react";
import { Gift, Plus, Trash2, CheckCircle2, X, Search, Sparkles, Check, Boxes, ToggleLeft, ToggleRight, Layers, Tag } from "lucide-react";
import { posApi } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/hooks/use-currency";

export interface FreeQtyRule {
  id: string;
  name: string;
  rule_type: "min_cart_amount" | "min_product_qty" | "company_offer";
  threshold: number;
  trigger_product_id?: string;
  trigger_product_name?: string;
  free_product_id?: string;
  free_product_name?: string;
  free_qty: number;
  active: boolean;
}

interface FreeQtySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Array<{ id: string; name: string; sku?: string; mrp?: number; selling_price?: number; stock?: number }>;
  initialTriggerProductId?: string;
}

export function FreeQtySettingsModal({
  isOpen,
  onClose,
  products = [],
  initialTriggerProductId,
}: FreeQtySettingsModalProps) {
  const { formatCurrency } = useCurrency();
  const [rules, setRules] = useState<FreeQtyRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New Rule Form State
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<"min_product_qty" | "min_cart_amount" | "company_offer">("min_product_qty");
  const [triggerProductId, setTriggerProductId] = useState(initialTriggerProductId || "");
  const [triggerSearch, setTriggerSearch] = useState("");
  const [buyQty, setBuyQty] = useState<number>(2);
  const [cartThreshold, setCartThreshold] = useState<number>(2000);

  // Free Items Checklist Selection (support picking 1 or more products with individual free quantities)
  const [selectedFreeProducts, setSelectedFreeProducts] = useState<Record<string, number>>({});
  const [freeProductSearch, setFreeProductSearch] = useState("");

  const loadRules = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await posApi.getFreeQtyRules();
      setRules(Array.isArray(res) ? res : []);
    } catch {
      setRules([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadRules();
      if (initialTriggerProductId) {
        setTriggerProductId(initialTriggerProductId);
        const prod = products.find((p) => p.id === initialTriggerProductId);
        if (prod) {
          setRuleName(`Buy ${prod.name} Get Free Gift`);
        }
      }
    }
  }, [isOpen, initialTriggerProductId, products, loadRules]);

  if (!isOpen) return null;

  const triggerProduct = products.find((p) => p.id === triggerProductId);

  const filteredTriggerProducts = products.filter((p) => {
    if (!triggerSearch.trim()) return true;
    const q = triggerSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
  });

  const filteredFreeProducts = products.filter((p) => {
    if (!freeProductSearch.trim()) return true;
    const q = freeProductSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
  });

  const handleToggleFreeProduct = (productId: string) => {
    setSelectedFreeProducts((prev) => {
      const next = { ...prev };
      if (next[productId]) {
        delete next[productId];
      } else {
        next[productId] = 1;
      }
      return next;
    });
  };

  const handleUpdateFreeQty = (productId: string, qty: number) => {
    setSelectedFreeProducts((prev) => ({
      ...prev,
      [productId]: Math.max(1, qty),
    }));
  };

  const handleSetSameProductBOGO = () => {
    if (!triggerProductId) {
      toast.error("Please select a qualifying trigger product first.");
      return;
    }
    setSelectedFreeProducts({ [triggerProductId]: 1 });
    if (triggerProduct && !ruleName) {
      setRuleName(`Buy ${buyQty} ${triggerProduct.name} Get 1 Free (BOGO)`);
    }
    toast.success("Configured BOGO (Same item free)!");
  };

  const handleCreateScheme = async () => {
    if (ruleType === "min_product_qty" && !triggerProductId) {
      toast.error("Please select a qualifying trigger product.");
      return;
    }

    const freeProductIds = Object.keys(selectedFreeProducts);
    if (freeProductIds.length === 0) {
      toast.error("Please select at least one free product using the checkboxes.");
      return;
    }

    const firstFreeId = freeProductIds[0];
    const firstFreeProd = products.find((p) => p.id === firstFreeId);
    const firstFreeQty = selectedFreeProducts[firstFreeId] || 1;

    const finalRuleName =
      ruleName.trim() ||
      (ruleType === "min_product_qty"
        ? `Buy ${buyQty} ${triggerProduct?.name || "Item"} Get ${firstFreeQty} ${firstFreeProd?.name || "Free Item"}`
        : ruleType === "min_cart_amount"
          ? `Orders over ₹${cartThreshold} get Free ${firstFreeProd?.name || "Gift"}`
          : "Promotional Free Gift Scheme");

    const newRule: FreeQtyRule = {
      id: crypto.randomUUID(),
      name: finalRuleName,
      rule_type: ruleType,
      threshold: ruleType === "min_cart_amount" ? cartThreshold : buyQty,
      trigger_product_id: ruleType === "min_product_qty" ? triggerProductId : undefined,
      trigger_product_name: ruleType === "min_product_qty" ? triggerProduct?.name : undefined,
      free_product_id: firstFreeId,
      free_product_name: firstFreeProd?.name,
      free_qty: firstFreeQty,
      active: true,
    };

    const updatedRules = [...rules, newRule];

    try {
      setIsSaving(true);
      await posApi.saveFreeQtyRules(updatedRules);
      setRules(updatedRules);
      toast.success(`Promotional scheme "${finalRuleName}" created successfully!`);
      // Reset form
      setRuleName("");
      setSelectedFreeProducts({});
      setTriggerSearch("");
      setFreeProductSearch("");
    } catch (err: any) {
      toast.error("Failed to save scheme: " + (err.message || "Error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRuleStatus = async (ruleId: string) => {
    const updated = rules.map((r) => (r.id === ruleId ? { ...r, active: !r.active } : r));
    try {
      await posApi.saveFreeQtyRules(updated);
      setRules(updated);
      toast.success("Scheme status updated!");
    } catch (err: any) {
      toast.error("Failed to update status: " + (err.message || "Error"));
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    const updated = rules.filter((r) => r.id !== ruleId);
    try {
      await posApi.saveFreeQtyRules(updated);
      setRules(updated);
      toast.success("Promotional scheme deleted!");
    } catch (err: any) {
      toast.error("Failed to delete scheme: " + (err.message || "Error"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-indigo-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Promotional & Free Quantity Schemes
                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  {rules.length} Configured
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Configure "Buy X Get Y Free" rules and promotional gifts that apply automatically during billing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Active Schemes List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" /> Active Promotional Rules
              </span>
              <span className="text-xs text-slate-400">
                {rules.filter((r) => r.active).length} of {rules.length} active
              </span>
            </div>

            {rules.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Gift className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-slate-600">No promotional schemes configured yet</p>
                <p className="text-[11px] text-slate-400">Use the form below to create your first Free Item scheme.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      rule.active
                        ? "bg-white border-emerald-200 shadow-sm"
                        : "bg-slate-50/80 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{rule.name}</h4>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          {rule.rule_type === "min_product_qty"
                            ? "Product Quantity Scheme"
                            : rule.rule_type === "min_cart_amount"
                              ? "Cart Value Scheme"
                              : "Company Wide Offer"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleRuleStatus(rule.id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-emerald-700 transition"
                          title={rule.active ? "Pause Scheme" : "Activate Scheme"}
                        >
                          {rule.active ? (
                            <ToggleRight className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition"
                          title="Delete Scheme"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-2.5 text-xs space-y-1 border border-slate-100">
                      {rule.rule_type === "min_product_qty" ? (
                        <div className="text-slate-700">
                          <span className="font-semibold text-indigo-700">Buy: </span>
                          <span>
                            {rule.threshold}x {rule.trigger_product_name || "Trigger Item"}
                          </span>
                        </div>
                      ) : (
                        <div className="text-slate-700">
                          <span className="font-semibold text-indigo-700">Min Cart: </span>
                          <span>{formatCurrency(rule.threshold)}</span>
                        </div>
                      )}
                      <div className="text-emerald-700 font-bold flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5" />
                        <span>
                          Get {rule.free_qty}x {rule.free_product_name || "Free Gift"} FREE
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="border-slate-200/80" />

          {/* Create New Scheme Builder */}
          <div className="space-y-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" /> Create New Free Quantity Scheme
              </span>
              <button
                type="button"
                onClick={handleSetSameProductBOGO}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Quick BOGO (Same Item Free)
              </button>
            </div>

            {/* Scheme Name & Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Scheme Name / Title</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Buy 2 T-Shirts Get 1 Cap Free"
                  className="w-full h-9 px-3 text-xs font-semibold rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Offer Trigger Condition</label>
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value as any)}
                  className="w-full h-9 px-3 text-xs font-semibold rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="min_product_qty">🛒 Buy Specific Product (Quantity Trigger)</option>
                  <option value="min_cart_amount">💰 Minimum Cart Total (Order Value Trigger)</option>
                  <option value="company_offer">🎉 Storewide Company Offer (All Orders)</option>
                </select>
              </div>
            </div>

            {/* If Product Quantity Trigger */}
            {ruleType === "min_product_qty" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-slate-200">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Qualifying Product (Must be purchased)</label>
                  <select
                    value={triggerProductId}
                    onChange={(e) => setTriggerProductId(e.target.value)}
                    className="w-full h-9 px-3 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">— Select Qualifying Product —</option>
                    {filteredTriggerProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.sku ? `(${p.sku})` : ""} — {formatCurrency(p.selling_price || p.mrp || 0)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Buy Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={buyQty}
                    onChange={(e) => setBuyQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-9 px-3 text-xs font-bold text-slate-900 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="2"
                  />
                </div>
              </div>
            )}

            {/* If Cart Amount Trigger */}
            {ruleType === "min_cart_amount" && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Minimum Cart Subtotal Required (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={cartThreshold}
                  onChange={(e) => setCartThreshold(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full h-9 px-3 text-xs font-bold text-slate-900 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="2000"
                />
              </div>
            )}

            {/* Checkbox-based Free Gift Product Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-emerald-600" />
                  Select Free Product(s) & Quantity (Check to Give Free)
                </label>
                <div className="relative w-56">
                  <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={freeProductSearch}
                    onChange={(e) => setFreeProductSearch(e.target.value)}
                    placeholder="Search free products..."
                    className="w-full h-7 pl-7 pr-2 text-xs rounded-lg border border-slate-200 bg-white outline-none"
                  />
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
                {filteredFreeProducts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">No products match your search.</div>
                ) : (
                  filteredFreeProducts.map((p) => {
                    const isSelected = !!selectedFreeProducts[p.id];
                    const selectedQty = selectedFreeProducts[p.id] || 1;

                    return (
                      <div
                        key={p.id}
                        className={`p-2.5 flex items-center justify-between transition-colors ${
                          isSelected ? "bg-emerald-50/60" : "hover:bg-slate-50"
                        }`}
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0 pr-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleFreeProduct(p.id)}
                            className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="truncate">
                            <span className="text-xs font-bold text-slate-800 block truncate">{p.name}</span>
                            <span className="text-[10px] text-slate-400">
                              SKU: {p.sku || "-"} | MRP: {formatCurrency(p.mrp || 0)}
                            </span>
                          </div>
                        </label>

                        {isSelected && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-bold text-emerald-800">Free Qty:</span>
                            <input
                              type="number"
                              min="1"
                              value={selectedQty}
                              onChange={(e) => handleUpdateFreeQty(p.id, parseInt(e.target.value) || 1)}
                              className="w-16 h-7 text-xs font-bold text-center rounded-lg border border-emerald-300 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {Object.keys(selectedFreeProducts).length > 0 && (
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                  <span className="font-semibold">
                    ✓ {Object.keys(selectedFreeProducts).length} free product(s) selected
                  </span>
                  <span className="font-mono text-[11px]">
                    Total Free Qty: {Object.values(selectedFreeProducts).reduce((a, b) => a + b, 0)}
                  </span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={handleCreateScheme}
                disabled={isSaving || Object.keys(selectedFreeProducts).length === 0}
                className="gradient-brand text-white border-0 font-bold text-xs h-9 px-4 rounded-xl shadow-md"
              >
                {isSaving ? "Saving Scheme..." : <><Plus className="w-3.5 h-3.5 mr-1" /> Save & Activate Scheme</>}
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Rules apply automatically when eligible items are added to bills or carts.
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 px-4 text-xs font-bold rounded-xl"
          >
            Close Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
