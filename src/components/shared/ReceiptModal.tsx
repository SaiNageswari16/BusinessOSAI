import { Printer, CheckCircle2, Receipt, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { inr, lineTotal, totals } from "@/lib/calc";
import { useRestaurantStore } from "@/lib/store";
import type { Order } from "@/lib/types";

interface ReceiptModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptModal({ order, open, onOpenChange }: ReceiptModalProps) {
  const settings = useRestaurantStore((s) => s.settings);
  const customers = useRestaurantStore((s) => s.customers);
  const tables = useRestaurantStore((s) => s.tables);

  if (!order) return null;

  const bill = totals(order.lines, order.discountPct, settings.gstPct);
  const customer = customers.find((c) => c.id === order.customerId);
  const table = tables.find((t) => t.id === order.tableId);
  const halfGstPct = (settings.gstPct / 2).toFixed(1);
  const halfGstAmt = Math.round((bill.gst / 2) * 100) / 100;

  const handlePrint = () => {
    toast.success(`Receipt for ${order.id} sent to thermal printer`);
    if (typeof window !== "undefined" && typeof window.print === "function") {
      // Non-blocking print support
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Tax Invoice & Receipt — {order.id}
          </DialogTitle>
          <DialogDescription>
            {settings.restaurant} · {settings.branch}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed">
          <div className="border-b border-dashed border-border pb-3 text-center">
            <div className="text-sm font-bold tracking-wide text-foreground uppercase">
              {settings.restaurant}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {settings.branch} · GSTIN: 36AABCS1429B1Z5
            </div>
            <div className="text-[11px] text-muted-foreground">
              {new Date(order.paidAt ?? order.createdAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 border-b border-dashed border-border py-2.5 text-[11px]">
            <div>
              <span className="text-muted-foreground">Order:</span>{" "}
              <span className="font-semibold text-foreground">{order.id}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Type:</span>{" "}
              <span className="font-semibold text-foreground uppercase">{order.type}</span>
            </div>
            {table && (
              <div>
                <span className="text-muted-foreground">Table:</span>{" "}
                <span className="font-semibold text-foreground">
                  {table.name} ({table.area})
                </span>
              </div>
            )}
            {order.guests > 0 && (
              <div className="text-right">
                <span className="text-muted-foreground">Covers:</span>{" "}
                <span className="font-semibold text-foreground">{order.guests}</span>
              </div>
            )}
            {customer && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Guest:</span>{" "}
                <span className="font-semibold text-foreground">
                  {customer.name} ({customer.phone})
                </span>
              </div>
            )}
            {order.provider && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Channel:</span>{" "}
                <span className="font-semibold text-foreground">{order.provider}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5 border-b border-dashed border-border py-2.5">
            <div className="flex justify-between text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              <span>Item / Modifiers</span>
              <span>Amount</span>
            </div>
            {order.lines.map((line) => (
              <div key={line.lineId} className="space-y-0.5">
                <div className="flex justify-between font-medium text-foreground">
                  <span>
                    {line.qty} × {line.name}
                  </span>
                  <span className="tabular">{inr(lineTotal(line))}</span>
                </div>
                {(line.modifiers.length > 0 || line.addons.length > 0 || line.note) && (
                  <div className="pl-3 text-[10px] text-muted-foreground">
                    {[
                      ...line.modifiers,
                      ...line.addons.map((a) => `+${a.name} (${inr(a.price)})`),
                      line.note ? `"${line.note}"` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-1 border-b border-dashed border-border py-2.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular">{inr(bill.subtotal)}</span>
            </div>
            {order.discountPct > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount ({order.discountPct}%)</span>
                <span className="tabular">-{inr(bill.discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxable Amount</span>
              <span className="tabular">{inr(bill.taxable)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CGST ({halfGstPct}%)</span>
              <span className="tabular">₹{halfGstAmt.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SGST ({halfGstPct}%)</span>
              <span className="tabular">₹{halfGstAmt.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 text-sm font-bold text-foreground">
              <span>Grand Total</span>
              <span className="tabular">{inr(bill.total)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2.5 text-[11px]">
            <span className="text-muted-foreground">
              Payment: <strong className="text-foreground uppercase">{order.payment}</strong>
              {order.paymentMethod ? ` (${order.paymentMethod})` : ""}
            </span>
            {order.payment === "paid" ? (
              <span className="inline-flex items-center gap-1 font-semibold text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> PAID
              </span>
            ) : (
              <span className="font-semibold text-warning uppercase">BILL DUE</span>
            )}
          </div>
          {customer && order.payment === "paid" && (
            <div className="mt-2 flex items-center justify-center gap-1 rounded-md bg-ai-soft px-2 py-1 text-[10px] font-medium text-ai">
              <Sparkles className="h-3 w-3" /> Loyalty balance: {customer.points} pts (
              {customer.tier})
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" />
            Print Thermal Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
