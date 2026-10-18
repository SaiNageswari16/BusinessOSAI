import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Clock,
  Minus,
  PauseCircle,
  Plus,
  Search,
  Send,
  SplitSquareHorizontal,
  Trash2,
  User,
  Wallet,
  Leaf,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { menuCategories, modifiersForCategory } from "@/data/menu";
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

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "POS — RestaurantOS" },
      {
        name: "description",
        content: "Fast restaurant point of sale for dine-in, takeaway and delivery orders.",
      },
      { property: "og:title", content: "POS — RestaurantOS" },
      {
        property: "og:description",
        content: "Fast restaurant point of sale for dine-in, takeaway and delivery orders.",
      },
    ],
  }),
  component: Pos,
});

function Pos() {
  const navigate = useNavigate();
  const tables = useTables();
  const menuItems = useMenu();
  const customers = useCustomers();
  const settings = useSettings();

  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");
  const [type, setType] = useState<OrderType>("Dine-in");
  const [table, setTable] = useState("T7");
  const [customer, setCustomer] = useState("Walk-in");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [held, setHeld] = useState<OrderLine[][]>([]);

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
  const bill = computeBill(lines, {
    taxRate: settings.taxRate,
    serviceCharge: settings.serviceCharge,
    discountPct: discount,
    dineIn: type === "Dine-in",
  });

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

  const submit = (paid: boolean, method: PaymentMethod = "UPI") => {
    if (!lines.length) return toast.error("Please add dishes to order first");
    const o = createOrder({
      type,
      table: type === "Dine-in" ? table : undefined,
      customer,
      lines,
      paid,
      paymentMethod: method,
    });

    if (paid) {
      toast.success(`${o.id} settled via ${method} · ${money(bill.total)}`);
      setReceiptOrder(o);
      setReceiptBill(bill);
      setReceiptPayMethod(method);
      setReceiptOpen(true);
      setPayOpen(false);
    } else {
      toast.success(`${o.id} sent to kitchen`, {
        description: `KOT printed for ${new Set(lines.map((l) => l.station)).size} station(s)`,
      });
      setKotOrder(o);
      setKotOpen(true);
    }

    setLines([]);
    setDiscount(0);
  };

  const freeTables = tables.filter((t) => t.status === "Available" || t.id === table);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:h-[calc(100vh-6rem)]">
      {/* POS top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2 text-xs">
        <span className="font-medium">{settings.register}</span>
        <span className="text-muted-foreground">Cashier: Ananya R.</span>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search menu…"
            className="h-8 pl-8 text-xs"
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
        >
          Held ({held.length})
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Categories */}
        <aside className="flex shrink-0 gap-1 overflow-x-auto border-b bg-surface p-2 md:w-44 md:flex-col md:border-b-0 md:border-r">
          {["All", ...menuCategories].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors",
                c === cat
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {c}
              <span className="ml-1 text-[10px] opacity-70">
                {c === "All" ? menuItems.length : menuItems.filter((m) => m.category === c).length}
              </span>
            </button>
          ))}
        </aside>

        {/* Grid */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((m) => (
              <button
                key={m.id}
                onClick={() => onItem(m)}
                className={cn(
                  "panel group flex flex-col p-3 text-left transition hover:border-primary/50 hover:shadow-pop",
                  !m.available && "opacity-50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "grid size-4 place-items-center rounded-sm border",
                      m.veg ? "border-success text-success" : "border-critical text-critical",
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                  </span>
                  {m.popular && (
                    <span className="rounded bg-warning/15 px-1.5 text-[10px] font-medium text-warning">
                      Popular
                    </span>
                  )}
                </div>
                <div className="mt-2 text-sm font-semibold leading-tight">{m.name}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {m.description}
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="text-sm font-semibold tabular">{money(m.price)}</span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="size-3" />
                    {m.available ? `${m.prepMins} min` : "Sold out"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <aside className="flex max-h-[55vh] w-full shrink-0 flex-col border-t bg-card md:max-h-none md:w-[360px] md:border-l md:border-t-0">
          <div className="space-y-2 border-b p-3">
            <div className="grid grid-cols-4 gap-1 rounded-md bg-muted p-0.5">
              {(["Dine-in", "Takeaway", "Delivery", "Online"] as OrderType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "rounded py-1 text-xs",
                    t === type ? "bg-card font-medium shadow-card" : "text-muted-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {type === "Dine-in" && (
                <Select value={table} onValueChange={setTable}>
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {freeTables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.id} · {t.seats}p
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={customer} onValueChange={setCustomer}>
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <User className="size-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Walk-in">Walk-in customer</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name} · {c.tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!lines.length ? (
              <div className="grid h-full place-items-center p-8 text-center text-sm text-muted-foreground">
                No items yet.
                <br />
                Tap a dish to start the order.
              </div>
            ) : (
              <ul className="divide-y">
                {lines.map((l) => (
                  <li key={l.id} className="flex gap-2 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{l.name}</div>
                      {(l.modifiers.length > 0 || l.note) && (
                        <div className="text-[11px] text-muted-foreground">
                          {[...l.modifiers, l.note].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground tabular">
                        {money(l.unitPrice)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => qty(l.id, -1)}
                        className="grid size-6 place-items-center rounded border hover:bg-accent"
                      >
                        {l.qty === 1 ? <Trash2 className="size-3" /> : <Minus className="size-3" />}
                      </button>
                      <span className="w-5 text-center text-sm tabular">{l.qty}</span>
                      <button
                        onClick={() => qty(l.id, 1)}
                        className="grid size-6 place-items-center rounded border hover:bg-accent"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <div className="w-16 text-right text-sm font-medium tabular">
                      {money(l.qty * l.unitPrice)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1 border-t bg-surface p-3 text-sm">
            <Row k="Subtotal" v={money(bill.subtotal)} />
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Discount</span>
              <div className="flex gap-1">
                {[0, 5, 10, 15].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDiscount(d)}
                    className={cn(
                      "rounded px-1.5 text-[11px]",
                      d === discount ? "bg-primary text-primary-foreground" : "border",
                    )}
                  >
                    {d}%
                  </button>
                ))}
              </div>
            </div>
            {bill.discount > 0 && <Row k="" v={`− ${money(bill.discount)}`} />}
            {type === "Dine-in" && <Row k="Service charge 5%" v={money(bill.service)} />}
            <Row k="GST 5%" v={money(bill.tax)} />
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular">{money(bill.total)}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t p-3">
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
              className="col-span-2"
              onClick={() => (lines.length ? setPayOpen(true) : toast.error("Add items first"))}
            >
              <Wallet /> Pay {money(bill.total)}
            </Button>
          </div>
        </aside>
      </div>

      <ModifierDialog
        item={picking}
        onClose={() => setPicking(null)}
        onAdd={(mods, extra, note) => {
          if (picking) addLine(picking, mods, extra, note);
          setPicking(null);
        }}
      />

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Collect payment</DialogTitle>
          </DialogHeader>
          <div className="text-center">
            <div className="eyebrow">Amount due</div>
            <div className="text-3xl font-semibold tabular">{money(bill.total)}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["Cash", "UPI", "Card", "Wallet"] as const).map((p) => (
              <Button
                key={p}
                variant="outline"
                className="h-14 flex flex-col items-center justify-center gap-1 hover:border-primary"
                onClick={() => submit(true, p)}
              >
                <span className="font-semibold text-sm">{p}</span>
                <span className="text-[10px] text-muted-foreground">{money(bill.total)}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <KotTicketDialog
        order={kotOrder}
        open={kotOpen}
        onOpenChange={setKotOpen}
        onGoToKitchen={() => {
          setKotOpen(false);
          navigate({ to: "/kitchen" });
        }}
      />

      <ReceiptDialog
        order={receiptOrder}
        bill={receiptBill}
        paymentMethod={receiptPayMethod}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
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
            {item?.veg && <Leaf className="size-4 text-success" />}
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
                        "rounded-md border px-3 py-1.5 text-sm",
                        cur.includes(o.id)
                          ? "border-primary bg-primary/10 font-medium text-primary"
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
              placeholder="e.g. no onions, extra gravy"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            className="w-full"
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
