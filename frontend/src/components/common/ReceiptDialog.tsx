import { CheckCircle2, Printer, ReceiptText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/services/orderService";
import { money } from "@/lib/format";
import type { Order, PaymentMethod } from "@/lib/types";

interface BillSummary {
  subtotal: number;
  discount: number;
  service: number;
  tax: number;
  total: number;
}

interface ReceiptDialogProps {
  order: Order | null;
  bill: BillSummary | null;
  paymentMethod?: PaymentMethod;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptDialog({
  order,
  bill,
  paymentMethod = "Cash",
  open,
  onOpenChange,
}: ReceiptDialogProps) {
  const settings = useSettings();

  if (!order || !bill) return null;

  const dateFormatted = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFormatted = new Date(order.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-foreground">
            <ReceiptText className="size-4 text-primary" />
            Tax Invoice / Payment Receipt
          </DialogTitle>
        </DialogHeader>

        {/* Thermal Receipt Paper Container */}
        <div className="rounded-lg border bg-surface p-5 font-mono text-xs shadow-inner">
          <div className="border-b border-dashed pb-3 text-center">
            <div className="text-base font-bold tracking-tight text-foreground">
              {settings.name}
            </div>
            <div className="text-[11px] text-muted-foreground">{settings.currentBranch}</div>
            <div className="text-[10px] text-muted-foreground">{settings.address}</div>
            <div className="text-[10px] text-muted-foreground">Phone: {settings.phone}</div>
            <div className="mt-1 flex justify-center gap-3 text-[10px] text-muted-foreground">
              <span>GSTIN: {settings.gstin}</span>
              <span>FSSAI: {settings.fssai}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 border-b border-dashed py-2.5 text-[11px]">
            <div>
              <span className="text-muted-foreground">Invoice No: </span>
              <span className="font-semibold">{order.id}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Date: </span>
              <span>{dateFormatted}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Customer: </span>
              <span>{order.customer}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Time: </span>
              <span>{timeFormatted}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Order Type: </span>
              <span className="font-semibold">{order.type}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Table: </span>
              <span className="font-bold">{order.table ?? "Counter"}</span>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="py-2.5">
            <div className="mb-2 flex justify-between border-b pb-1 text-[11px] font-bold text-muted-foreground">
              <span className="w-8">Qty</span>
              <span className="flex-1 px-2">Description</span>
              <span className="w-14 text-right">Rate</span>
              <span className="w-16 text-right">Amount</span>
            </div>
            <ul className="space-y-1.5">
              {order.lines.map((l) => (
                <li key={l.id} className="flex justify-between text-[11px]">
                  <span className="w-8 font-semibold">{l.qty}</span>
                  <div className="flex-1 px-2">
                    <span className="text-foreground">{l.name}</span>
                    {l.modifiers.length > 0 && (
                      <span className="block text-[10px] text-muted-foreground">
                        {l.modifiers.join(", ")}
                      </span>
                    )}
                  </div>
                  <span className="w-14 text-right tabular text-muted-foreground">
                    {l.unitPrice}
                  </span>
                  <span className="w-16 text-right font-semibold tabular">
                    {l.qty * l.unitPrice}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Calculation Breakdown */}
          <div className="border-t border-dashed pt-2.5 space-y-1 text-[11px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular">{money(bill.subtotal)}</span>
            </div>
            {bill.discount > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span className="tabular">− {money(bill.discount)}</span>
              </div>
            )}
            {bill.service > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Service Charge ({settings.serviceCharge * 100}%)</span>
                <span className="tabular">{money(bill.service)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>GST ({settings.taxRate * 100}%)</span>
              <span className="tabular">{money(bill.tax)}</span>
            </div>
            <div className="flex justify-between border-t border-dashed pt-2 text-sm font-bold text-foreground">
              <span>Grand Total</span>
              <span className="tabular">{money(bill.total)}</span>
            </div>
          </div>

          {/* Payment Status Stamp */}
          <div className="mt-3 flex items-center justify-between rounded border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
            <span className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="size-4" /> Paid via {paymentMethod}
            </span>
            <span className="font-mono text-[11px] tabular font-bold">{money(bill.total)}</span>
          </div>

          <div className="mt-3 text-center text-[10px] text-muted-foreground">
            <div>Thank you for dining with us!</div>
            <div>Please visit again · FSSAI Lic. {settings.fssai}</div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5 mr-1" /> Print Bill
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
