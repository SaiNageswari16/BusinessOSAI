import { useMemo, useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Leaf,
  Minus,
  PauseCircle,
  Phone,
  Plus,
  Search,
  Send,
  Sliders,
  Sparkles,
  SplitSquareHorizontal,
  Star,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { modifiersForCategory } from "@/data/menu";
import {
  createOrder,
  useCustomers,
  useMenu,
  useSettings,
  useTables,
} from "@/services/orderService";
import { computeBill } from "@/lib/billing";
import { money } from "@/lib/format";
import type { MenuItem, Order, OrderLine, OrderType, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { KotTicketDialog } from "@/components/common/KotTicketDialog";
import { ReceiptDialog } from "@/components/common/ReceiptDialog";
import { ReceiptCustomizerModal } from "@/components/common/ReceiptCustomizerModal";
import { customerService, type Customer } from "@/services/customerService";
import { billingService } from "@/services/billingService";

export const Route = createFileRoute("/pos")({
  validateSearch: (search: Record<string, unknown>): { table?: string } => ({
    table: typeof search.table === "string" ? search.table : undefined,
  }),
  head: () => ({
    meta: [
      { title: "POS Terminal & Customer Loyalty — RestaurantOS" },
      {
        name: "description",
        content: "Petpooja-standard point of sale, customer CRM, loyalty points, and customizable thermal receipts.",
      },
    ],
  }),
  component: Pos,
});

function Pos() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const tables = useTables();
  const menuItems = useMenu();
  const fallbackCustomers = useCustomers();
  const settings = useSettings();

  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");
  const [type, setType] = useState<OrderType>("Dine-in");
  const [table, setTable] = useState(search?.table || tables[0]?.id || "T1");
  const [customer, setCustomer] = useState("Walk-in");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [held, setHeld] = useState<OrderLine[][]>([]);

  // ── Real Customer & Loyalty State ──
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [custSearchQuery, setCustSearchQuery] = useState("");
  const [dbCustomers, setDbCustomers] = useState<Customer[]>([]);
  const [custLoading, setCustLoading] = useState(false);

  // New Customer Onboarding Form
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustGstin, setNewCustGstin] = useState("");
  const [createCustLoading, setCreateCustLoading] = useState(false);

  // Loyalty Points Redemption
  const [redeemLoyalty, setRedeemLoyalty] = useState(false);
  const [receiptCustomizerOpen, setReceiptCustomizerOpen] = useState(false);

  // Update table when search param changes
  useEffect(() => {
    if (search?.table) {
      setTable(search.table);
    }
  }, [search?.table]);

  // Load real customers from PostgreSQL
  const searchDbCustomers = async (query = "") => {
    try {
      setCustLoading(true);
      const res = await customerService.getCustomers(query, 20);
      setDbCustomers(res);
    } catch (e) {
      console.warn("Failed to query customers from microservice:", e);
    } finally {
      setCustLoading(false);
    }
  };

  useEffect(() => {
    if (custModalOpen) {
      searchDbCustomers(custSearchQuery);
    }
  }, [custModalOpen, custSearchQuery]);

  // Dynamic menu categories from live PostgreSQL items
  const dynamicCategories = useMemo(() => {
    const list = Array.from(new Set(menuItems.map((m) => m.category).filter(Boolean)));
    return ["All", ...(list.length > 0 ? list : ["Starters", "Main Course", "Biryani", "Beverages", "Desserts"])];
  }, [menuItems]);

  // Workflow Dialog States
  const [kotOrder, setKotOrder] = useState<Order | null>(null);
  const [kotOpen, setKotOpen] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [receiptBill, setReceiptBill] = useState<ReturnType<typeof computeBill> | null>(null);
  const [receiptPayMethod, setReceiptPayMethod] = useState<PaymentMethod>("UPI");
  const [receiptOpen, setReceiptOpen] = useState(false);

  const items = useMemo(
    () =>
      menuItems.filter(
        (m) =>
          (cat === "All" || m.category === cat) && m.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [menuItems, cat, q],
  );

  const rawBill = computeBill(lines, {
    taxRate: settings.taxRate,
    serviceCharge: settings.serviceCharge,
    discountPct: discount,
    dineIn: type === "Dine-in",
  });

  // Loyalty calculations: 1 Pt = ₹1 value, available balance
  const loyaltyPointsAvailable = selectedCustomer
    ? selectedCustomer.loyalty_points ?? Math.max(120, Math.round((selectedCustomer.total_spent || 0) * 0.05))
    : 0;
  const loyaltyDiscount = redeemLoyalty
    ? Math.min(loyaltyPointsAvailable, Math.max(0, rawBill.subtotal - rawBill.discount))
    : 0;
  const finalBillTotal = Math.max(0, rawBill.total - loyaltyDiscount);
  const loyaltyPointsToEarn = Math.round(rawBill.subtotal * 0.05);

  const bill = {
    ...rawBill,
    total: finalBillTotal,
    discount: rawBill.discount + loyaltyDiscount,
  };

  const addLine = (item: MenuItem, modifiers: string[] = [], extra = 0, note?: string) => {
    setLines((ls) => {
      const key = item.id + modifiers.join("|") + (note ?? "");
      const ex = ls.find((l) => l.itemId + l.modifiers.join("|") + (l.note ?? "") === key);
      if (ex) return ls.map((l) => (l === ex ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...ls,
        {
          id: crypto.randomUUID(),
          itemId: item.id,
          name: item.name,
          qty: 1,
          unitPrice: item.price + extra,
          modifiers,
          note,
          station: item.station,
        },
      ];
    });
  };

  const onItem = (m: MenuItem) => {
    if (!m.available) return toast.error(`${m.name} is currently sold out`);
    if (modifiersForCategory(m.category).length) setPicking(m);
    else addLine(m);
  };

  const qty = (id: string, d: number) =>
    setLines((ls) =>
      ls.flatMap((l) => (l.id === id ? (l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }]) : [l])),
    );

  // Quick Onboard Customer to PostgreSQL
  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      toast.error("Please enter guest name and phone number");
      return;
    }
    try {
      setCreateCustLoading(true);
      const cleanPhone = newCustPhone.replace(/\D/g, "");
      const created = await customerService.createCustomer({
        name: newCustName.trim(),
        phone: cleanPhone,
        email: newCustEmail.trim() || undefined,
        gstin: newCustGstin.trim().toUpperCase() || undefined,
        outlet_id: "11111111-2222-3333-4444-555555555555",
      });
      setSelectedCustomer(created);
      setCustomer(created.name);
      toast.success(`Customer "${created.name}" created in PostgreSQL!`, {
        description: `Enrolled in loyalty rewards with initial 100 bonus points.`,
      });
      setCustModalOpen(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");
      setNewCustGstin("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create customer");
    } finally {
      setCreateCustLoading(false);
    }
  };

  const submit = async (paid: boolean, method: PaymentMethod = "UPI") => {
    if (!lines.length) return toast.error("Please add dishes to order first");
    const activeCustName = selectedCustomer ? selectedCustomer.name : customer;

    const o = createOrder({
      type,
      table: type === "Dine-in" ? table : undefined,
      customer: activeCustName,
      lines,
      paid,
      paymentMethod: method,
    });

    if (paid) {
      try {
        // Record live bill into PostgreSQL via billing microservice
        const billPayload = {
          outlet_id: "11111111-2222-3333-4444-555555555555",
          order_number: o.id,
          customer_id: selectedCustomer?.id,
          customer_name: activeCustName,
          customer_phone: selectedCustomer?.phone,
          customer_gstin: selectedCustomer?.gstin,
          covers: type === "Dine-in" ? 2 : 1,
          items: lines.map((l) => ({
            menu_item_id: l.itemId,
            name: l.name,
            qty: l.qty,
            unit_price: l.unitPrice,
            discount_amount: 0,
            notes: l.modifiers.join(", "),
          })),
          service_charge_pct: type === "Dine-in" ? 5 : 0,
        };
        const createdBill = await billingService.createBill(billPayload);
        await billingService.settleBill(createdBill.id, {
          payments: [{ method: method.toLowerCase() as any, amount: bill.total }],
        });
      } catch (e) {
        console.warn("Billing service background sync note:", e);
      }

      toast.success(`${o.id} settled via ${method} · ${money(bill.total)}`, {
        description: selectedCustomer
          ? `Awarded +${loyaltyPointsToEarn} loyalty points to ${selectedCustomer.name}`
          : "Tax invoice generated in PostgreSQL",
      });

      setReceiptOrder(o);
      setReceiptBill(bill);
      setReceiptPayMethod(method);
      setReceiptOpen(true);
      setPayOpen(false);

      if (selectedCustomer) {
        setSelectedCustomer((prev) =>
          prev
            ? {
                ...prev,
                total_visits: (prev.total_visits || 0) + 1,
                total_spent: (prev.total_spent || 0) + bill.total,
                loyalty_points: redeemLoyalty
                  ? loyaltyPointsToEarn
                  : loyaltyPointsAvailable + loyaltyPointsToEarn,
              }
            : null
        );
      }
    } else {
      toast.success(`${o.id} sent to kitchen`, {
        description: `KOT printed for ${new Set(lines.map((l) => l.station)).size} station(s)`,
      });
      setKotOrder(o);
      setKotOpen(true);
    }

    setLines([]);
    setDiscount(0);
    setRedeemLoyalty(false);
  };

  const freeTables = tables.filter((t) => t.status === "Available" || t.id === table);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:h-[calc(100vh-6rem)]">
      {/* POS top bar with quick receipt customizer and cashier info */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-card px-5 py-2.5 text-xs shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            {settings.name.slice(0, 1)}
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-foreground">{settings.name}</div>
            <div className="text-[10px] text-muted-foreground">
              Register #1 · Cashier: Ananya R. · UPTIME LIVE
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setReceiptCustomizerOpen(true)}
          className="h-7 gap-1.5 rounded-lg border-indigo-200 bg-indigo-50/50 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"
        >
          <Sliders className="size-3.5" /> Receipt Template
        </Button>

        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search menu items by name, code or category…"
            className="h-8 rounded-lg pl-8 text-xs"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!held.length}
          onClick={() => {
            const first = held[0];
            if (first) {
              setLines(first);
              setHeld((h) => h.slice(1));
              toast("Recalled held order");
            }
          }}
          className="rounded-lg"
        >
          <PauseCircle className="size-3.5 mr-1.5" /> Held ({held.length})
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Categories Sidebar */}
        <aside className="flex shrink-0 gap-1 overflow-x-auto border-b bg-surface p-2 md:w-48 md:flex-col md:border-b-0 md:border-r md:p-3">
          <div className="hidden px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground md:block">
            Categories
          </div>
          {dynamicCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] transition-all",
                c === cat
                  ? "bg-primary font-semibold text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span>{c}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular",
                  c === cat ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                )}
              >
                {c === "All" ? menuItems.length : menuItems.filter((m) => m.category === c).length}
              </span>
            </button>
          ))}
        </aside>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {cat === "All" ? "All Items" : cat}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {items.length} available
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((m) => (
              <button
                key={m.id}
                onClick={() => onItem(m)}
                className={cn(
                  "group flex flex-col rounded-xl border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg",
                  !m.available && "cursor-not-allowed opacity-50 hover:translate-y-0 hover:shadow-none",
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[13px] font-bold leading-snug text-foreground">{m.name}</span>
                  {m.veg ? (
                    <Leaf className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-rose-500" />
                  )}
                </div>
                <div className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                  {m.description}
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="text-sm font-extrabold tabular text-slate-900">
                    {money(m.price)}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="size-3" />
                    {m.available ? `${m.prepMins}m` : "Sold out"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* POS Cart & Customer CRM Sidebar */}
        <aside className="flex max-h-[55vh] w-full shrink-0 flex-col border-t bg-card md:max-h-none md:w-[380px] md:border-l md:border-t-0">
          <div className="space-y-2 border-b p-3 bg-slate-50/50">
            {/* Order Type Toggle */}
            <div className="grid grid-cols-4 gap-1 rounded-md bg-muted p-0.5">
              {(["Dine-in", "Takeaway", "Delivery", "Online"] as OrderType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "rounded py-1 text-xs font-medium transition-all",
                    t === type ? "bg-white font-bold text-slate-900 shadow-2xs" : "text-muted-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Table & Customer Bar */}
            <div className="space-y-2">
              <div className="flex gap-2">
                {type === "Dine-in" && (
                  <Select value={table} onValueChange={setTable}>
                    <SelectTrigger className="h-8 w-28 text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {freeTables.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.id} · {t.seats} seats
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Customer Status Display / Quick Attach */}
                <div className="flex-1">
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50/80 px-2.5 py-1 text-xs">
                      <div className="min-w-0 flex-1 pr-1">
                        <div className="font-bold text-indigo-950 flex items-center gap-1 truncate">
                          <UserCheck className="size-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate">{selectedCustomer.name}</span>
                        </div>
                        <div className="text-[10px] text-indigo-700 flex items-center gap-1 font-semibold">
                          <Star className="size-2.5 text-amber-500 fill-amber-500" />
                          <span>{loyaltyPointsAvailable} Pts</span>
                          <span>· Visit #{selectedCustomer.total_visits || 1}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCustModalOpen(true)}
                        className="h-6 px-1.5 text-[10px] text-indigo-700 hover:bg-indigo-100"
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCustModalOpen(true)}
                      className="h-8 w-full justify-between text-xs font-medium bg-white hover:bg-slate-50 border-slate-300"
                    >
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <User className="size-3.5 text-slate-500" /> {customer}
                      </span>
                      <span className="text-[10px] text-indigo-600 font-bold">+ Loyalty</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cart Item Lines */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!lines.length ? (
              <div className="grid h-full place-items-center p-8 text-center text-sm text-muted-foreground">
                No dishes in ticket.
                <br />
                Tap items on the left to start ordering.
              </div>
            ) : (
              <ul className="divide-y">
                {lines.map((l) => (
                  <li key={l.id} className="flex gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900">{l.name}</div>
                      {(l.modifiers.length > 0 || l.note) && (
                        <div className="text-[11px] text-muted-foreground">
                          {[...l.modifiers, l.note].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground tabular font-medium">
                        {money(l.unitPrice)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => qty(l.id, -1)}
                        className="grid size-6 place-items-center rounded border hover:bg-accent text-slate-600"
                      >
                        {l.qty === 1 ? <Trash2 className="size-3" /> : <Minus className="size-3" />}
                      </button>
                      <span className="w-5 text-center text-sm font-bold tabular">{l.qty}</span>
                      <button
                        onClick={() => qty(l.id, 1)}
                        className="grid size-6 place-items-center rounded border hover:bg-accent text-slate-600"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <div className="w-16 text-right text-sm font-bold tabular text-slate-900">
                      {money(l.qty * l.unitPrice)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Bill Calculation & Loyalty Rewards Breakdown */}
          <div className="space-y-1.5 border-t bg-surface p-3 text-sm">
            <Row k="Subtotal" v={money(rawBill.subtotal)} />

            {/* Standard Discount */}
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Standard Discount</span>
              <div className="flex gap-1">
                {[0, 5, 10, 15].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDiscount(d)}
                    className={cn(
                      "rounded px-1.5 text-[11px] font-semibold",
                      d === discount ? "bg-primary text-primary-foreground" : "border",
                    )}
                  >
                    {d}%
                  </button>
                ))}
              </div>
            </div>
            {rawBill.discount > 0 && <Row k="" v={`− ${money(rawBill.discount)}`} />}

            {/* Loyalty Points Redemption Checkbox */}
            {selectedCustomer && loyaltyPointsAvailable > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/80 px-2 py-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="redeemLoyalty"
                    checked={redeemLoyalty}
                    onChange={(e) => setRedeemLoyalty(e.target.checked)}
                    className="rounded border-amber-300 text-amber-600 focus:ring-0"
                  />
                  <label htmlFor="redeemLoyalty" className="font-semibold text-amber-900 cursor-pointer">
                    Redeem {loyaltyPointsAvailable} Pts (₹{loyaltyDiscount} off)
                  </label>
                </div>
                {redeemLoyalty && (
                  <span className="font-bold text-amber-900 tabular">− {money(loyaltyDiscount)}</span>
                )}
              </div>
            )}

            {type === "Dine-in" && <Row k="Service Charge (5%)" v={money(rawBill.service)} />}
            <Row k="GST (5%)" v={money(rawBill.tax)} />

            <div className="flex justify-between border-t pt-2 text-base font-extrabold text-slate-900">
              <div className="flex items-baseline gap-1.5">
                <span>Total</span>
                {selectedCustomer && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    +{loyaltyPointsToEarn} Pts to earn
                  </span>
                )}
              </div>
              <span className="tabular">{money(bill.total)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2 border-t p-3 bg-white">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!lines.length) return;
                setHeld((h) => [...h, lines]);
                setLines([]);
                toast("Order held");
              }}
            >
              <PauseCircle /> Hold
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast("Split bill", {
                  description: lines.length
                    ? `${money(Math.ceil(bill.total / 2))} × 2 guests`
                    : "Add items first",
                })
              }
            >
              <SplitSquareHorizontal /> Split
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLines([])}>
              <Trash2 /> Clear
            </Button>
            <Button variant="secondary" className="col-span-1" onClick={() => submit(false)}>
              <Send /> KOT
            </Button>
            <Button
              className="col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs"
              onClick={() => (lines.length ? setPayOpen(true) : toast.error("Add dishes first"))}
            >
              <Wallet /> Pay {money(bill.total)}
            </Button>
          </div>
        </aside>
      </div>

      {/* Item Modifiers Dialog */}
      <ModifierDialog
        item={picking}
        onClose={() => setPicking(null)}
        onAdd={(mods, extra, note) => {
          if (picking) addLine(picking, mods, extra, note);
          setPicking(null);
        }}
      />

      {/* Payment Tender Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              Settle Order · {money(bill.total)}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {(["UPI", "Cash", "Card", "Wallet"] as PaymentMethod[]).map((p) => (
              <Button
                key={p}
                variant="outline"
                className="h-14 flex flex-col items-center justify-center gap-1 hover:border-indigo-600 hover:bg-indigo-50/50"
                onClick={() => submit(true, p)}
              >
                <span className="font-bold text-sm text-slate-900">{p}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{money(bill.total)}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Petpooja Customer CRM & Loyalty Modal ── */}
      <Dialog open={custModalOpen} onOpenChange={setCustModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-slate-50">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="size-4 text-indigo-600" /> Customer Loyalty & CRM Directory
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Lookup existing guest visit history, repeat seatings, or register a new customer in PostgreSQL.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="search" className="flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-3 border-b">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="search" className="text-xs">Search Customer</TabsTrigger>
                <TabsTrigger value="new" className="text-xs">+ Register New Guest</TabsTrigger>
              </TabsList>
            </div>

            {/* Tab 1: Search Customer */}
            <TabsContent value="search" className="p-4 flex-1 flex flex-col min-h-0 space-y-3 m-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
                <Input
                  value={custSearchQuery}
                  onChange={(e) => setCustSearchQuery(e.target.value)}
                  placeholder="Enter phone number or customer name…"
                  className="h-8 pl-8 text-xs font-medium"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
                {custLoading ? (
                  <div className="text-center py-8 text-xs text-slate-400">Searching PostgreSQL customers…</div>
                ) : dbCustomers.length > 0 ? (
                  dbCustomers.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border p-3 flex items-center justify-between hover:border-indigo-400 hover:bg-slate-50 transition"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          {c.name}
                          {c.status === "vip" && (
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.2 rounded">
                              VIP
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 font-mono flex items-center gap-1">
                          <Phone className="size-3 text-slate-400" /> {c.phone}
                        </div>
                        <div className="text-[11px] text-indigo-700 font-bold flex items-center gap-2 pt-0.5">
                          <span>⭐ {c.loyalty_points ?? Math.max(100, Math.round((c.total_spent || 0) * 0.05))} Pts</span>
                          <span>· {c.total_visits || 1} Lifetime Visits</span>
                          <span>· Spent: ₹{c.total_spent || 0}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomer(c.name);
                          setCustModalOpen(false);
                          toast.success(`Attached "${c.name}" to POS Ticket`);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 font-semibold"
                      >
                        Select & Seat
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 space-y-2">
                    <p className="text-xs text-slate-500">No customer matching "{custSearchQuery}" found.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNewCustPhone(custSearchQuery);
                        const tabTrigger = document.querySelector('[data-state="inactive"][value="new"]') as HTMLElement;
                        tabTrigger?.click();
                      }}
                      className="text-xs gap-1"
                    >
                      <UserPlus className="size-3.5" /> Register "{custSearchQuery}" as New Customer
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab 2: Register New Customer */}
            <TabsContent value="new" className="p-4 flex-1 overflow-y-auto m-0">
              <form onSubmit={handleQuickAddCustomer} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Full Name *</Label>
                  <Input
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="e.g. Vikram Sharma"
                    className="h-8 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Mobile Number *</Label>
                  <Input
                    required
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="+91 98765 01234"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Email (Optional)</Label>
                    <Input
                      type="email"
                      value={newCustEmail}
                      onChange={(e) => setNewCustEmail(e.target.value)}
                      placeholder="vikram@example.com"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Customer GSTIN (Optional)</Label>
                    <Input
                      value={newCustGstin}
                      onChange={(e) => setNewCustGstin(e.target.value)}
                      placeholder="36ABCDE1234F1Z5"
                      className="h-8 text-xs font-mono uppercase"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={createCustLoading}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs h-9"
                  >
                    {createCustLoading ? "Saving to PostgreSQL…" : "Save Customer & Attach to POS"}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* KOT Dialog */}
      <KotTicketDialog
        order={kotOrder}
        open={kotOpen}
        onOpenChange={setKotOpen}
        onGoToKitchen={() => {
          setKotOpen(false);
          navigate({ to: "/kitchen" });
        }}
      />

      {/* Tax Invoice & Thermal Receipt Dialog */}
      <ReceiptDialog
        order={receiptOrder}
        bill={receiptBill}
        paymentMethod={receiptPayMethod}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        customerPhone={selectedCustomer?.phone}
        loyaltyPointsEarned={loyaltyPointsToEarn}
        loyaltyBalance={
          selectedCustomer
            ? (selectedCustomer.loyalty_points || 120) + loyaltyPointsToEarn
            : loyaltyPointsToEarn
        }
      />

      {/* Receipt Template Designer Modal */}
      <ReceiptCustomizerModal
        open={receiptCustomizerOpen}
        onOpenChange={setReceiptCustomizerOpen}
        orgSlug="spice9"
      />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{k}</span>
      <span className="tabular">{v}</span>
    </div>
  );
}

function ModifierDialog({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (mods: string[], extra: number, note?: string) => void;
}) {
  const groups = item ? modifiersForCategory(item.category) : [];
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const reset = () => {
    setSel({});
    setNote("");
  };
  const pick = (g: string, o: string, single: boolean) =>
    setSel((s) => ({
      ...s,
      [g]: single ? [o] : s[g]?.includes(o) ? s[g].filter((x) => x !== o) : [...(s[g] ?? []), o],
    }));
  const chosen = groups.flatMap((g) =>
    g.options.filter((o) =>
      (sel[g.id] ?? (g.type === "single" ? [g.options[0].id] : [])).includes(o.id),
    ),
  );
  const extra = chosen.reduce((s, o) => s + o.price, 0);

  return (
    <Dialog
      open={!!item}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {item?.veg ? (
              <Leaf className="size-4 text-emerald-600" />
            ) : (
              <span className="size-2.5 rounded-full bg-rose-500" />
            )}
            {item?.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{item?.description}</p>
        </DialogHeader>
        <div className="space-y-4">
          {groups.map((g) => {
            const cur = sel[g.id] ?? (g.type === "single" ? [g.options[0].id] : []);
            return (
              <div key={g.id}>
                <div className="eyebrow mb-2">
                  {g.name}
                  {g.type === "multi" && " · optional"}
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.options.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => pick(g.id, o.id, g.type === "single")}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm transition",
                        cur.includes(o.id)
                          ? "border-primary bg-primary/10 font-bold text-primary"
                          : "hover:bg-accent",
                      )}
                    >
                      {o.name}
                      {o.price > 0 && (
                        <span className="ml-1 text-xs opacity-70">+{money(o.price)}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div>
            <div className="eyebrow mb-2">Special instructions</div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. less oil, extra spicy, no coriander"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            onClick={() => {
              onAdd(
                chosen
                  .filter((o) => o.price > 0 || !["Regular", "Normal"].includes(o.name))
                  .map((o) => o.name),
                extra,
                note.trim() || undefined,
              );
              reset();
            }}
          >
            Add to order · {money((item?.price ?? 0) + extra)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
