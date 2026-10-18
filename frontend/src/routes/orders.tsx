import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, CheckCircle, ChefHat, Clock, Printer, Search, Wallet } from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { PageHeader, Panel } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setOrderStatus, settleOrder, useOrders, useSettings } from "@/services/orderService";
import { computeBill, orderTotal } from "@/lib/billing";
import { minsAgo, money } from "@/lib/format";
import type { OrderStatus, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ReceiptDialog } from "@/components/common/ReceiptDialog";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders — RestaurantOS" },
      {
        name: "description",
        content: "Track, filter and manage every dine-in, takeaway, delivery and online order.",
      },
      { property: "og:title", content: "Orders — RestaurantOS" },
      {
        property: "og:description",
        content: "Track, filter and manage every dine-in, takeaway, delivery and online order.",
      },
    ],
  }),
  component: Orders,
});

const filters: ("All" | OrderStatus)[] = [
  "All",
  "New",
  "Preparing",
  "Ready",
  "Served",
  "Completed",
  "Cancelled",
];

function Orders() {
  const orders = useOrders();
  const settings = useSettings();
  const [f, setF] = useState<(typeof filters)[number]>("All");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  // Bill & Settle states
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [payPickerOpen, setPayPickerOpen] = useState(false);
  const [activePaymentMethod, setActivePaymentMethod] = useState<PaymentMethod>("UPI");

  const list = orders.filter(
    (o) =>
      (f === "All" || o.status === f) &&
      `${o.id} ${o.customer} ${o.table ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  const o = orders.find((x) => x.id === sel);
  const bill = o
    ? computeBill(o.lines, {
        taxRate: settings.taxRate,
        serviceCharge: settings.serviceCharge,
        discountPct: 0,
        dineIn: o.type === "Dine-in",
      })
    : null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Order management"
        title="Orders"
        description={`${orders.length} orders today`}
        actions={
          <Button asChild>
            <Link to="/pos">New order</Link>
          </Button>
        }
      />
      <Panel bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          {filters.map((s) => (
            <button
              key={s}
              onClick={() => setF(s)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs",
                s === f
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {s}{" "}
              <span className="opacity-70">
                {s === "All" ? orders.length : orders.filter((x) => x.status === s).length}
              </span>
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Order, customer, table"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="font-medium">Customer</th>
                <th className="font-medium">Type</th>
                <th className="font-medium">Items</th>
                <th className="font-medium">Waiter</th>
                <th className="font-medium">Age</th>
                <th className="font-medium">Payment</th>
                <th className="text-right font-medium">Amount</th>
                <th className="px-4 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr
                  key={x.id}
                  onClick={() => setSel(x.id)}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                >
                  <td className="px-4 py-2.5 font-mono text-xs font-medium">{x.id}</td>
                  <td>{x.customer}</td>
                  <td className="text-muted-foreground">
                    {x.type}
                    {x.table ? ` · ${x.table}` : ""}
                  </td>
                  <td className="tabular text-muted-foreground">
                    {x.lines.reduce((s, l) => s + l.qty, 0)}
                  </td>
                  <td className="text-muted-foreground">{x.waiter}</td>
                  <td className="tabular text-muted-foreground">{minsAgo(x.createdAt)}m</td>
                  <td>
                    <StatusBadge
                      status={x.paid ? "Paid" : "Unpaid"}
                      tone={x.paid ? "success" : "neutral"}
                    />
                  </td>
                  <td className="text-right font-medium tabular">{money(orderTotal(x.lines))}</td>
                  <td className="px-4 text-right">
                    <StatusBadge status={x.status} />
                  </td>
                </tr>
              ))}
              {!list.length && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    No orders match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Sheet open={!!o} onOpenChange={(v) => !v && setSel(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {o && bill && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3 font-mono">
                  {o.id} <StatusBadge status={o.status} />
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4 text-sm">
                <div className="text-muted-foreground">
                  {o.customer} · {o.type}
                  {o.table ? ` · ${o.table}` : ""} · {minsAgo(o.createdAt)} min ago
                </div>
                <ul className="divide-y rounded-lg border">
                  {o.lines.map((l) => (
                    <li key={l.id} className="flex justify-between px-3 py-2">
                      <span>
                        {l.qty}× {l.name}
                        {l.modifiers.length > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {l.modifiers.join(", ")}
                          </span>
                        )}
                      </span>
                      <span className="tabular">{money(l.qty * l.unitPrice)}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="tabular">{money(bill.subtotal)}</span>
                  </div>
                  {bill.service > 0 && (
                    <div className="flex justify-between">
                      <span>Service 5%</span>
                      <span className="tabular">{money(bill.service)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>GST 5%</span>
                    <span className="tabular">{money(bill.tax)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-semibold text-foreground">
                    <span>Total</span>
                    <span className="tabular">{money(bill.total)}</span>
                  </div>
                </div>
                {/* Order Status Progress Actions */}
                {!["Completed", "Cancelled"].includes(o.status) && (
                  <div className="rounded-lg border bg-surface p-3 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Kitchen & Service Progress
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {o.status === "New" && (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setOrderStatus(o.id, "Preparing");
                            toast.success(`${o.id} moved to Preparing`);
                          }}
                        >
                          <ChefHat className="size-3.5 mr-1" /> Start prep
                        </Button>
                      )}
                      {o.status === "Preparing" && (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setOrderStatus(o.id, "Ready");
                            toast.success(`${o.id} is ready at pass`);
                          }}
                        >
                          <CheckCircle className="size-3.5 mr-1" /> Mark ready
                        </Button>
                      )}
                      {o.status === "Ready" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1"
                          onClick={() => {
                            setOrderStatus(o.id, "Served");
                            toast.success(`${o.id} marked as served`);
                          }}
                        >
                          <ArrowRight className="size-3.5 mr-1" /> Mark served
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2">
                  {!o.paid && o.status !== "Cancelled" && (
                    <Button onClick={() => setPayPickerOpen(true)}>
                      <Wallet className="size-4 mr-1.5" /> Settle payment
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setReceiptOpen(true)}>
                    <Printer className="size-4 mr-1.5" /> View / Print bill
                  </Button>
                  {!["Completed", "Cancelled"].includes(o.status) && (
                    <Button
                      variant="outline"
                      className="col-span-2 text-critical hover:bg-critical/10"
                      onClick={() => {
                        setOrderStatus(o.id, "Cancelled");
                        toast(`${o.id} cancelled`);
                      }}
                    >
                      Cancel order
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Settle Payment Method Picker */}
      <Dialog open={payPickerOpen} onOpenChange={setPayPickerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Settle {o?.id}</DialogTitle>
          </DialogHeader>
          {bill && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="eyebrow">Amount Due</div>
                <div className="text-3xl font-semibold tabular">{money(bill.total)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["Cash", "UPI", "Card", "Wallet"] as const).map((method) => (
                  <Button
                    key={method}
                    variant="outline"
                    className="h-14 font-semibold hover:border-primary"
                    onClick={() => {
                      if (o) {
                        settleOrder(o.id, method);
                        setActivePaymentMethod(method);
                        setPayPickerOpen(false);
                        setReceiptOpen(true);
                        toast.success(`${o.id} settled via ${method}`);
                      }
                    }}
                  >
                    {method}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt / Invoice Dialog */}
      <ReceiptDialog
        order={o ?? null}
        bill={bill}
        paymentMethod={activePaymentMethod}
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
      />
    </PageContainer>
  );
}
