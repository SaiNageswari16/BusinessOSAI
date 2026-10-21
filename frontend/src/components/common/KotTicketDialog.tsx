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

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[92vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-slate-50 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Utensils className="size-4 text-amber-600" />
              Kitchen Order Ticket (KOT)
            </DialogTitle>
          </DialogHeader>

          {/* Printable ESC/POS KOT Container */}
          <div className="p-5 overflow-y-auto bg-slate-100/70 flex justify-center">
            <div
              id="thermal-kot-printable"
              className="w-[305px] bg-white shadow-md border border-slate-300 p-4 font-mono text-slate-900 text-xs select-none"
            >
              <div className="border-b-2 border-dashed border-slate-900 pb-2 text-center">
                <div className="text-base font-black tracking-wider uppercase">
                  *** KITCHEN ORDER TICKET ***
                </div>
                <div className="text-[11px] font-bold text-slate-600 mt-0.5">
                  STATIONS: {stations.join(", ").toUpperCase()}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] font-bold border-t border-dotted border-slate-300 pt-1">
                  <span>KOT #{order.id}</span>
                  <span>
                    {new Date(order.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 border-b border-dashed border-slate-400 py-2 text-[11px]">
                <div>
                  <span className="text-slate-500">TYPE: </span>
                  <span className="font-extrabold">{order.type.toUpperCase()}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">TABLE: </span>
                  <span className="font-black text-sm">{order.table ?? "COUNTER"}</span>
                </div>
                <div>
                  <span className="text-slate-500">CAPTAIN: </span>
                  <span className="font-semibold">{order.waiter || "Suresh M."}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">GUEST: </span>
                  <span className="font-semibold">{order.customer || "Walk-in"}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="py-2.5">
                <div className="mb-1.5 flex justify-between font-bold text-[11px] uppercase tracking-wider border-b border-slate-900 pb-1">
                  <span>Dishes & Prep Instructions</span>
                  <span className="w-10 text-right">Qty</span>
                </div>
                <ul className="space-y-2 pt-1">
                  {order.lines.map((line) => (
                    <li
                      key={line.id}
                      className="flex justify-between border-b border-dotted border-slate-300 pb-1.5 last:border-0"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-extrabold text-sm text-slate-900 leading-snug">
                          {line.name}
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                          Station: {line.station}
                        </div>
                        {(line.modifiers.length > 0 || line.note) && (
                          <div className="mt-0.5 text-[11px] font-black text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 inline-block">
                            ★ {[...line.modifiers, line.note].filter(Boolean).join(" | ")}
                          </div>
                        )}
                      </div>
                      <span className="w-10 text-right font-black text-base tabular text-slate-900">
                        {line.qty}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t-2 border-dashed border-slate-900 pt-2 text-center text-[10px] font-bold text-slate-500">
                PUNCHED FROM POS TERMINAL #1
              </div>
            </div>
          </div>

          <DialogFooter className="p-3 border-t bg-slate-50 flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800 font-semibold"
            >
              <Printer className="size-3.5" /> Print KOT Slip
            </Button>
            <div className="flex gap-2">
              {onGoToKitchen && (
                <Button size="sm" variant="outline" onClick={onGoToKitchen}>
                  Open KDS
                </Button>
              )}
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embedded Print CSS for KOT */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-kot-printable, #thermal-kot-printable * {
            visibility: visible !important;
          }
          #thermal-kot-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 4mm !important;
            border: none !important;
            box-shadow: none !important;
            font-size: 12px !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>
    </>
  );
}
