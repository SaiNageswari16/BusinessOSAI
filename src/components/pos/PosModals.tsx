import {
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  ChefHat,
  CreditCard,
  GitMerge,
  Minus,
  Plus,
  Printer,
  Receipt,
  Search,
  Smartphone,
  Split,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { inr, totals } from "@/lib/calc";
import { ADDONS, MODIFIERS } from "@/lib/seed";
import type { PosDraft } from "@/lib/store";
import type {
  Addon,
  Area,
  Customer,
  DiningTable,
  Kot,
  MenuItem,
  OrderLine,
  Station,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* 1. TABLE SELECTOR MODAL                                                    */
/* -------------------------------------------------------------------------- */

interface TableSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tables: DiningTable[];
  selectedTableId: string | undefined;
  onSelectTable: (tableId: string) => void;
}

export function TableSelectorModal({
  open,
  onOpenChange,
  tables,
  selectedTableId,
  onSelectTable,
}: TableSelectorModalProps) {
  const [areaFilter, setAreaFilter] = useState<"All" | Area>("All");

  const filteredTables = tables.filter((t) => areaFilter === "All" || t.area === areaFilter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Dining Table</DialogTitle>
          <DialogDescription>
            Choose an available table to start a new order or select an occupied table to view/edit
            its active order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5 py-1">
          {(["All", "Main Hall", "Terrace", "Private Room"] as const).map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => setAreaFilter(area)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                areaFilter === area
                  ? "border-[#0866F5] bg-[#0866F5] text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
              )}
            >
              {area}
            </button>
          ))}
        </div>

        <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto py-1 sm:grid-cols-4">
          {filteredTables.map((t) => {
            const isSelected = t.id === selectedTableId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onSelectTable(t.id);
                  onOpenChange(false);
                }}
                className={cn(
                  "flex flex-col items-start justify-between rounded-xl border p-2.5 text-left transition-all",
                  isSelected
                    ? "border-[#0866F5] bg-[#EBF3FF] ring-2 ring-[#0866F5]/20"
                    : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-extrabold text-[#102344]">{t.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9.5px] font-bold capitalize",
                      t.status === "available" && "bg-emerald-100 text-emerald-700",
                      t.status === "occupied" && "bg-blue-100 text-blue-700",
                      t.status === "billing" && "bg-amber-100 text-amber-800",
                      t.status === "reserved" && "bg-purple-100 text-purple-700",
                      t.status === "cleaning" && "bg-slate-200 text-slate-700",
                    )}
                  >
                    {t.status}
                  </span>
                </div>
                <div className="mt-1.5 text-[10.5px] text-slate-500">
                  {t.area} • {t.capacity} Seats
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. CUSTOMER SEARCH & QUICK CREATE MODAL                                    */
/* -------------------------------------------------------------------------- */

interface CustomerSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  selectedCustomerId: string | undefined;
  onSelectCustomer: (customerId?: string) => void;
  onCreateCustomer: (cust: Omit<Customer, "id">) => string;
}

export function CustomerSelectorModal({
  open,
  onOpenChange,
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onCreateCustomer,
}: CustomerSelectorModalProps) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const filtered = customers.filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  const handleSaveNew = () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Please enter both customer name and phone number.");
      return;
    }
    const id = onCreateCustomer({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || `${name.trim().toLowerCase().replace(/\s+/g, ".")}@guest.in`,
      points: 50,
      tier: "Bronze",
      notes: notes.trim(),
    });
    onSelectCustomer(id);
    toast.success(`Registered and linked ${name.trim()}`);
    setCreating(false);
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{creating ? "Add New Customer" : "Select or Search Customer"}</DialogTitle>
          <DialogDescription>
            {creating
              ? "Enroll guest in Sunrise Loyalty CRM and link to this order."
              : "Search by guest name or mobile number, or create a new customer profile."}
          </DialogDescription>
        </DialogHeader>

        {creating ? (
          <div className="space-y-3 py-1 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Full Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Ravi Kumar"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Phone Number *</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Email (Optional)</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="guest@mail.in"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Preferences / Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Prefers less spicy, window table"
                className="h-8 text-xs"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button variant="outline" size="sm" onClick={() => setCreating(false)}>
                Back to Search
              </Button>
              <Button size="sm" onClick={handleSaveNew} className="bg-[#0866F5] text-white">
                Save & Link Customer
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreating(true)}
                className="h-8 gap-1 text-xs font-semibold text-[#0866F5]"
              >
                <UserPlus className="h-3.5 w-3.5" /> New
              </Button>
            </div>

            <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
              {filtered.map((c) => {
                const active = c.id === selectedCustomerId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelectCustomer(c.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors",
                      active ? "bg-[#EBF3FF]" : "hover:bg-slate-50",
                    )}
                  >
                    <div>
                      <div className="font-bold text-[#102344]">{c.name}</div>
                      <div className="text-[11px] text-slate-500 tabular">{c.phone}</div>
                    </div>
                    <div className="text-right">
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        {c.tier} • {c.points} pts
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. CUSTOM ITEM MODAL                                                       */
/* -------------------------------------------------------------------------- */

interface CustomItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddCustomItem: (input: {
    name: string;
    price: number;
    qty: number;
    veg: boolean;
    station: Station;
    category: string;
    note: string;
    saveToMenu: boolean;
  }) => { ok: boolean; error?: string };
}

export function CustomItemModal({ open, onOpenChange, onAddCustomItem }: CustomItemModalProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState(1);
  const [veg, setVeg] = useState(true);
  const [station, setStation] = useState<Station>("Curry");
  const [note, setNote] = useState("");
  const [saveToMenu, setSaveToMenu] = useState(false);

  const handleSubmit = () => {
    const res = onAddCustomItem({
      name,
      price: Number(price),
      qty,
      veg,
      station,
      category: station === "Tandoor" ? "Tandoor" : "Starters",
      note,
      saveToMenu,
    });
    if (!res.ok) {
      toast.error(res.error ?? "Invalid custom item details.");
      return;
    }
    toast.success(`Added custom item "${name.trim()}" to order`);
    setName("");
    setPrice("");
    setQty(1);
    setVeg(true);
    setNote("");
    setSaveToMenu(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Item</DialogTitle>
          <DialogDescription>
            Add an off-menu chef special or custom request directly to the current order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1 text-xs">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Item Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Special Jeera Rice Bowl"
              className="h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Price (₹) *</Label>
              <Input
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g., 220"
                className="h-8 text-xs tabular"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Quantity</Label>
              <div className="flex h-8 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center text-xs font-bold tabular">{qty}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setQty((q) => Math.min(99, q + 1))}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Dietary Type</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setVeg(true)}
                  className={cn(
                    "rounded-lg border py-1.5 text-xs font-bold transition-colors",
                    veg
                      ? "border-[#059669] bg-[#ECFDF5] text-[#059669]"
                      : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  ● Veg
                </button>
                <button
                  type="button"
                  onClick={() => setVeg(false)}
                  className={cn(
                    "rounded-lg border py-1.5 text-xs font-bold transition-colors",
                    !veg
                      ? "border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]"
                      : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  ● Non-Veg
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Kitchen Station</Label>
              <select
                value={station}
                onChange={(e) => setStation(e.target.value as Station)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-[#102344]"
              >
                {(["Curry", "Tandoor", "Biryani", "Beverages", "Desserts"] as const).map((st) => (
                  <option key={st} value={st}>
                    {st} Station
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Special Instructions</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., No garlic, medium spice, serve hot..."
              className="h-14 text-xs"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <Checkbox checked={saveToMenu} onCheckedChange={(v) => setSaveToMenu(Boolean(v))} />
            <span className="text-[11px] font-medium text-slate-700">
              Also save this custom dish to permanent restaurant menu
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} className="bg-[#0866F5] text-white">
            Add to Current Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. CUSTOMIZE MODIFIERS & ADD-ONS MODAL                                     */
/* -------------------------------------------------------------------------- */

interface CustomizeLineModalProps {
  open: boolean;
  item: MenuItem | null;
  editingLine: OrderLine | null;
  onClose: () => void;
  onConfirm: (data: { qty: number; modifiers: string[]; addons: Addon[]; note: string }) => void;
}

export function CustomizeLineModal({
  open,
  item,
  editingLine,
  onClose,
  onConfirm,
}: CustomizeLineModalProps) {
  const [qty, setQty] = useState(1);
  const [modifiers, setModifiers] = useState<string[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (editingLine) {
      setQty(editingLine.qty);
      setModifiers([...editingLine.modifiers]);
      setAddons([...editingLine.addons]);
      setNote(editingLine.note);
    } else if (item) {
      setQty(1);
      setModifiers([]);
      setAddons([]);
      setNote("");
    }
  }, [item, editingLine]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingLine ? `Edit ${editingLine.name}` : `Customize ${item?.name ?? "Dish"}`}
          </DialogTitle>
          <DialogDescription>
            Configure spice/dietary modifiers, paid add-ons, quantity, and chef instructions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 text-xs">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Quantity</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-8 text-center text-sm font-bold tabular">{qty}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Kitchen Modifiers</Label>
            <div className="flex flex-wrap gap-1.5">
              {MODIFIERS.map((mod) => {
                const active = modifiers.includes(mod);
                return (
                  <button
                    key={mod}
                    type="button"
                    onClick={() =>
                      setModifiers((prev) =>
                        active ? prev.filter((x) => x !== mod) : [...prev, mod],
                      )
                    }
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-[#0866F5] bg-[#0866F5] text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    {mod}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Paid Add-ons</Label>
            <div className="grid grid-cols-2 gap-2">
              {ADDONS.map((addon) => {
                const checked = addons.some((a) => a.name === addon.name);
                return (
                  <label
                    key={addon.name}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          setAddons((prev) =>
                            v ? [...prev, addon] : prev.filter((a) => a.name !== addon.name),
                          )
                        }
                      />
                      <span>{addon.name}</span>
                    </div>
                    <span className="font-semibold tabular">+{inr(addon.price)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Special Instructions for Chef</Label>
            <Textarea
              placeholder="e.g., Serve starter with main course, allergic to peanuts..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-14 text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm({ qty, modifiers, addons, note })}
            className="bg-[#0866F5] text-white"
          >
            {editingLine ? "Update Item" : "Add to Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. DISCOUNT DIALOG                                                         */
/* -------------------------------------------------------------------------- */

interface DiscountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDiscountPct: number;
  maxDiscountPct: number;
  subtotal: number;
  onApplyDiscount: (pct: number) => boolean;
}

export function DiscountModal({
  open,
  onOpenChange,
  currentDiscountPct,
  maxDiscountPct,
  subtotal,
  onApplyDiscount,
}: DiscountModalProps) {
  const [val, setVal] = useState(String(currentDiscountPct));

  useEffect(() => {
    setVal(String(currentDiscountPct));
  }, [currentDiscountPct, open]);

  const handleApply = (pct: number) => {
    const ok = onApplyDiscount(pct);
    if (!ok) {
      toast.error(`Discount must be between 0% and ${maxDiscountPct}%.`);
      return;
    }
    toast.success(pct > 0 ? `Applied ${pct}% discount` : "Removed order discount");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Apply Bill Discount</DialogTitle>
          <DialogDescription>
            Authorized manager discount limit: up to {maxDiscountPct}%.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1 text-xs">
          <div className="grid grid-cols-4 gap-2">
            {[0, 5, 10, 15, 20, 25, 30]
              .filter((p) => p <= maxDiscountPct)
              .map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handleApply(pct)}
                  className={cn(
                    "rounded-xl border py-2 text-center font-bold transition-colors",
                    currentDiscountPct === pct
                      ? "border-[#0866F5] bg-[#0866F5] text-white"
                      : "border-slate-200 bg-slate-50 text-[#102344] hover:bg-blue-50",
                  )}
                >
                  <div>{pct}%</div>
                  <div className="text-[9.5px] opacity-80">
                    -{inr(Math.round((subtotal * pct) / 100))}
                  </div>
                </button>
              ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">
              Custom Percentage (0% – {maxDiscountPct}%)
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                max={maxDiscountPct}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className="h-8 text-xs font-bold tabular"
              />
              <Button
                size="sm"
                onClick={() => handleApply(Number(val))}
                className="h-8 bg-[#0866F5] text-white"
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. TABLE TRANSFER / MERGE / MORE ACTIONS MODAL                             */
/* -------------------------------------------------------------------------- */

interface TableOperationsModalProps {
  mode: "transfer" | "merge" | "more" | null;
  onClose: () => void;
  currentTable: DiningTable | undefined;
  tables: DiningTable[];
  onTransfer: (toTableId: string) => void;
  onMerge: (secondaryTableId: string) => void;
  onClearCart: () => void;
}

export function TableOperationsModal({
  mode,
  onClose,
  currentTable,
  tables,
  onTransfer,
  onMerge,
  onClearCart,
}: TableOperationsModalProps) {
  const [targetTableId, setTargetTableId] = useState("");

  const candidateTables = tables.filter((t) => {
    if (!currentTable || t.id === currentTable.id) return false;
    if (mode === "transfer") return t.status === "available";
    return true;
  });
  const firstCandidateId = candidateTables[0]?.id ?? "";

  useEffect(() => {
    setTargetTableId(firstCandidateId);
  }, [mode, currentTable?.id, firstCandidateId]);

  return (
    <Dialog
      open={mode !== null}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "transfer"
              ? `Transfer Table ${currentTable?.name ?? ""}`
              : mode === "merge"
                ? `Merge Table ${currentTable?.name ?? ""}`
                : `Table ${currentTable?.name ?? ""} Actions`}
          </DialogTitle>
          <DialogDescription>
            {mode === "transfer"
              ? "Move the active order and guests to another available dining table."
              : mode === "merge"
                ? "Combine another table's order lines and guests into this table."
                : "Additional POS actions for the current order session."}
          </DialogDescription>
        </DialogHeader>

        {mode === "more" ? (
          <div className="space-y-2 py-1">
            <button
              type="button"
              onClick={() => {
                onClearCart();
                onClose();
              }}
              className="flex w-full items-center gap-2 rounded-xl border border-red-200 bg-red-50/70 p-3 text-left text-xs font-bold text-red-600 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear Current Draft Cart</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 py-1 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                {mode === "transfer" ? "Destination Available Table" : "Table to Merge With"}
              </Label>
              <select
                value={targetTableId}
                onChange={(e) => setTargetTableId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#102344]"
              >
                {candidateTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.area} ({t.capacity} Seats • {t.status})
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!targetTableId}
                onClick={() => {
                  if (mode === "transfer") onTransfer(targetTableId);
                  if (mode === "merge") onMerge(targetTableId);
                  onClose();
                }}
                className="gap-1.5 bg-[#0866F5] text-white"
              >
                {mode === "transfer" ? (
                  <>
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Confirm Transfer
                  </>
                ) : (
                  <>
                    <GitMerge className="h-3.5 w-3.5" /> Confirm Merge
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. KOT PRINT PREVIEW MODAL                                                 */
/* -------------------------------------------------------------------------- */

interface KotPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  tableLabel: string;
  kots: Kot[];
  note: string;
  onNavigateKitchen: () => void;
}

export function KotPreviewModal({
  open,
  onOpenChange,
  orderId,
  tableLabel,
  kots,
  note,
  onNavigateKitchen,
}: KotPreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-[#0866F5]" />
            <span>Kitchen Order Ticket (KOT) Dispatched</span>
          </DialogTitle>
          <DialogDescription>
            Order <strong>{orderId}</strong> ({tableLabel}) has been routed to Kitchen Display
            stations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 max-h-72 overflow-y-auto py-1 text-xs">
          {kots.map((kot) => (
            <div
              key={kot.id}
              className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 font-mono"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 font-sans">
                <span className="font-extrabold text-[#102344]">
                  {kot.id} • {kot.station} Station
                </span>
                <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-[#0866F5]">
                  {kot.status}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {kot.lines.map((l) => (
                  <div key={l.lineId} className="flex justify-between">
                    <span className="font-bold text-slate-900">
                      {l.qty} × {l.name}
                    </span>
                    {l.modifiers.length > 0 && (
                      <span className="text-[10.5px] text-amber-700">
                        [{l.modifiers.join(", ")}]
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {note && (
                <div className="mt-2 border-t border-slate-200 pt-1 text-[10.5px] text-slate-600">
                  Chef Note: {note}
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Print Slip
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onNavigateKitchen();
            }}
            className="gap-1.5 bg-[#0866F5] text-white"
          >
            <ChefHat className="h-3.5 w-3.5" /> Open Kitchen (KDS)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* 8. PAYMENT & CHECKOUT MODAL                                                */
/* -------------------------------------------------------------------------- */

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posDraft: PosDraft;
  gstPct: number;
  onConfirmPayment: (method: string, nextTableStatus: "available" | "cleaning") => void;
}

export function PaymentModal({
  open,
  onOpenChange,
  posDraft,
  gstPct,
  onConfirmPayment,
}: PaymentModalProps) {
  const bill = totals(posDraft.lines, posDraft.discountPct, gstPct);
  const [method, setMethod] = useState<"UPI" | "Card" | "Cash" | "Split">("UPI");
  const [cashTendered, setCashTendered] = useState(String(bill.total));
  const [splitUpiAmount, setSplitUpiAmount] = useState(String(Math.round(bill.total / 2)));
  const [nextTableStatus, setNextTableStatus] = useState<"available" | "cleaning">("cleaning");

  useEffect(() => {
    setCashTendered(String(bill.total));
    setSplitUpiAmount(String(Math.round(bill.total / 2)));
  }, [bill.total, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Payment & Generate Receipt</DialogTitle>
          <DialogDescription>
            Net Payable (incl. {gstPct}% GST):{" "}
            <strong className="text-[#0866F5]">{inr(bill.total)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 text-xs">
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                { id: "UPI", label: "UPI / QR", icon: Smartphone },
                { id: "Card", label: "Card", icon: CreditCard },
                { id: "Cash", label: "Cash", icon: Banknote },
                { id: "Split", label: "Split", icon: Split },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 font-bold transition-all",
                  method === id
                    ? "border-[#0866F5] bg-[#EBF3FF] text-[#0866F5]"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {method === "Cash" && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Cash Tendered (₹)</Label>
                <Input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  className="h-8 w-28 text-right text-xs font-bold tabular"
                />
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold">
                <span>Change to Return</span>
                <span className="text-[#059669] tabular">
                  {inr(Math.max(0, (Number(cashTendered) || 0) - bill.total))}
                </span>
              </div>
            </div>
          )}

          {method === "Split" && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">UPI Portion (₹)</Label>
                <Input
                  type="number"
                  value={splitUpiAmount}
                  onChange={(e) => setSplitUpiAmount(e.target.value)}
                  className="h-8 w-28 text-right text-xs font-bold tabular"
                />
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold">
                <span>Card Balance</span>
                <span className="text-[#0866F5] tabular">
                  {inr(Math.max(0, bill.total - (Number(splitUpiAmount) || 0)))}
                </span>
              </div>
            </div>
          )}

          {posDraft.orderType === "dine-in" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Table Status After Settlement</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNextTableStatus("cleaning")}
                  className={cn(
                    "rounded-lg border py-1.5 text-xs font-semibold",
                    nextTableStatus === "cleaning"
                      ? "border-[#0866F5] bg-[#EBF3FF] text-[#0866F5]"
                      : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  Mark Cleaning
                </button>
                <button
                  type="button"
                  onClick={() => setNextTableStatus("available")}
                  className={cn(
                    "rounded-lg border py-1.5 text-xs font-semibold",
                    nextTableStatus === "available"
                      ? "border-[#059669] bg-[#ECFDF5] text-[#059669]"
                      : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  Mark Available Immediately
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex justify-between">
              <span className="text-slate-500">Items Total</span>
              <span className="font-semibold tabular">{inr(bill.subtotal)}</span>
            </div>
            {bill.discount > 0 && (
              <div className="flex justify-between text-[#059669]">
                <span>Discount ({posDraft.discountPct}%)</span>
                <span className="font-semibold tabular">-{inr(bill.discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-semibold tabular">{inr(bill.taxable)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">GST ({gstPct}%)</span>
              <span className="font-semibold tabular">{inr(bill.gst)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-[#102344]">
              <span>Total Amount</span>
              <span className="text-[#0866F5] tabular">{inr(bill.total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirmPayment(method, nextTableStatus)}
            className="gap-1.5 bg-[#059669] text-white hover:bg-[#047857]"
          >
            <CheckCircle2 className="h-4 w-4" />
            <Receipt className="h-4 w-4" />
            <span>
              Confirm {method} ({inr(bill.total)})
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
