import { Printer, Utensils } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Order } from "@/lib/types";

interface KotTicketDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoToKitchen?: () => void;
}

export function KotTicketDialog({
  order,
  open,
  onOpenChange,
  onGoToKitchen,
}: KotTicketDialogProps) {
  if (!order) return null;

  const stations = Array.from(new Set(order.lines.map((l) => l.station)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Utensils className="size-4 text-primary" />
            Kitchen Order Ticket (KOT)
          </DialogTitle>
        </DialogHeader>

        {/* Paper Ticket Style */}
        <div className="rounded-lg border bg-surface p-4 font-mono text-xs shadow-inner">
          <div className="border-b border-dashed pb-3 text-center">
            <div className="text-sm font-bold tracking-wider">SUNRISE RESTAURANT</div>
            <div className="text-[11px] text-muted-foreground">KITCHEN DISPLAY SYSTEM</div>
            <div className="mt-1 flex items-center justify-between text-[11px] font-semibold">
              <span>TICKET: {order.id}</span>
              <span>
                {new Date(order.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-b border-dashed py-2 text-[11px]">
            <div>
              <span className="text-muted-foreground">TYPE: </span>
              <span className="font-bold">{order.type}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">TABLE: </span>
              <span className="font-bold">{order.table ?? "COUNTER"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">SERVER: </span>
              <span>{order.waiter}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">GUEST: </span>
              <span>{order.customer}</span>
            </div>
          </div>

          <div className="py-2.5">
            <div className="mb-1.5 flex justify-between font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>Item & Prep Notes</span>
              <span className="w-10 text-right">Qty</span>
            </div>
            <ul className="space-y-2">
              {order.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex justify-between border-b border-muted/50 pb-1.5 last:border-0"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-semibold text-foreground text-xs">{line.name}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      Station: {line.station}
                    </div>
                    {(line.modifiers.length > 0 || line.note) && (
                      <div className="mt-0.5 text-[11px] font-bold text-warning">
                        *** {[...line.modifiers, line.note].filter(Boolean).join(" | ")} ***
                      </div>
                    )}
                  </div>
                  <span className="w-10 text-right font-bold text-sm tabular">{line.qty}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-dashed pt-2 text-[11px] text-muted-foreground">
            <div>Stations Notified: {stations.join(", ")}</div>
            <div className="mt-0.5">
              Total Portions: {order.lines.reduce((s, l) => s + l.qty, 0)}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5 mr-1" /> Print Slip
          </Button>
          <div className="flex gap-2">
            {onGoToKitchen && (
              <Button size="sm" variant="secondary" onClick={onGoToKitchen}>
                Kitchen KDS
              </Button>
            )}
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
