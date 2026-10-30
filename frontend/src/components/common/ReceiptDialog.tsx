import { useState } from "react";
import { Download, FileText, Printer, QrCode, ReceiptText, Sliders } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import type { Order, PaymentMethod } from "@/lib/types";
import {
  receiptTemplateService,
  useReceiptTemplate,
} from "@/services/receiptTemplateService";
import { ReceiptCustomizerModal } from "./ReceiptCustomizerModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onCustomize?: () => void;
  orgSlug?: string;
  customerPhone?: string;
  loyaltyPointsEarned?: number;
  loyaltyBalance?: number;
}

export function ReceiptDialog({
  order,
  bill,
  paymentMethod = "UPI",
  open,
  onOpenChange,
  onClose,
  onCustomize,
  orgSlug,
  customerPhone,
  loyaltyPointsEarned,
  loyaltyBalance,
}: ReceiptDialogProps) {
  const activeTemplate = useReceiptTemplate();
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  if (!order || !bill) return null;

  const template = activeTemplate;

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen);
    if (!nextOpen) onClose?.();
  };

  const dateFormatted = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeFormatted = new Date(order.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Calculate Loyalty: 5% of subtotal or configured earn rate
  const earnedPts =
    loyaltyPointsEarned !== undefined
      ? loyaltyPointsEarned
      : Math.round(bill.subtotal * ((template.loyaltyEarnRatePct || 5) / 100));
  const currentBalance =
    loyaltyBalance !== undefined ? loyaltyBalance : earnedPts + 120;

  // Split Tax: CGST 2.5% + SGST 2.5%
  const cgst = bill.tax / 2;
  const sgst = bill.tax / 2;

  const handlePrint = () => {
    window.print();
  };

  const handleBackendPdf = async () => {
    if (!order.backendBillId) {
      window.print();
      return;
    }
    try {
      setPdfBusy(true);
      await receiptTemplateService.openBackendThermalPdf(order.backendBillId, template.paperWidth);
    } catch (e: any) {
      toast.error("Could not generate backend PDF, opening browser print instead.");
      window.print();
    } finally {
      setPdfBusy(false);
    }
  };

  const handleBackendEscPos = async () => {
    if (!order.backendBillId) {
      toast.info("ESC/POS raw stream requires a settled backend bill ID.");
      return;
    }
    try {
      await receiptTemplateService.downloadBackendEscPos(
        order.backendBillId,
        order.billNumber || order.id,
        template.paperWidth
      );
      toast.success(`Downloaded ${template.paperWidth} ESC/POS stream`);
    } catch {
      toast.error("Failed to download ESC/POS bytes");
    }
  };

  const tokenDigits = order.id.replace(/\D/g, "").slice(-3) || "101";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[92vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-slate-50 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ReceiptText className="size-4 text-indigo-600" />
              Tax Invoice & Thermal Receipt ({template.paperWidth})
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (onCustomize) onCustomize();
                else setCustomizerOpen(true);
              }}
              className="h-7 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <Sliders className="size-3" /> Customize Format
            </Button>
          </DialogHeader>

          {/* Printable ESC/POS Thermal Receipt Container */}
          <div className="p-5 overflow-y-auto bg-slate-100/70 flex justify-center">
            <div
              id="thermal-receipt-printable"
              className={cn(
                "bg-white shadow-md border border-slate-300 p-4 font-mono text-slate-900 select-none",
                template.paperWidth === "80mm" ? "w-[305px] text-xs" : "w-[240px] text-[10px]"
              )}
            >
              {/* Header Branding */}
              <div className="border-b border-dashed border-slate-400 pb-2.5 text-center space-y-0.5">
                {template.showLogo && (
                  <div className="mx-auto mb-1 grid size-8 place-items-center rounded border border-slate-900 text-xs font-extrabold">
                    {(template.orgName || "R").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="font-extrabold text-sm tracking-tight uppercase leading-snug">
                  {template.orgName}
                </div>
                {template.tagline && (
                  <div className="text-[10px] text-slate-600 font-medium">{template.tagline}</div>
                )}
                {template.branchName && (
                  <div className="text-[10px] text-slate-700">{template.branchName}</div>
                )}
                {template.showAddress !== false && template.address && (
                  <div className="text-[9px] text-slate-500 leading-tight">{template.address}</div>
                )}
                {template.showPhone !== false && template.phone && (
                  <div className="text-[10px] text-slate-700 font-semibold">Ph: {template.phone}</div>
                )}
                {template.showGstin !== false && template.gstin && (
                  <div className="pt-0.5 text-[9px] text-slate-600 flex justify-center gap-2">
                    <span>GSTIN: {template.gstin}</span>
                  </div>
                )}
                {template.showFssai !== false && template.fssai && (
                  <div className="text-[9px] text-slate-600">FSSAI: {template.fssai}</div>
                )}
                {template.showHeaderGreeting && (
                  <div className="mt-1.5 py-0.5 bg-slate-900 text-white font-bold text-[9px] uppercase tracking-wider">
                    {template.headerGreetingText || "ORIGINAL TAX INVOICE"}
                  </div>
                )}
              </div>

              {/* Token Number Box */}
              {template.showTokenNo && (
                <div className="my-1.5 border border-slate-900 py-1 text-center">
                  <div className="text-[8px] uppercase tracking-widest text-slate-500">Token No</div>
                  <div className="text-base font-extrabold leading-tight">#{tokenDigits}</div>
                </div>
              )}

              {/* Bill Details */}
              <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 border-b border-dashed border-slate-400 py-2 text-[10px]">
                <div>
                  <span className="text-slate-500">Invoice: </span>
                  <span className="font-bold">{order.billNumber || order.id}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Date: </span>
                  <span>{dateFormatted}</span>
                </div>
                <div>
                  <span className="text-slate-500">Time: </span>
                  <span>{timeFormatted}</span>
                </div>
                <div className="text-right">
                  {template.showTable && (
                    <span>
                      Table: <strong className="font-bold">{order.table ?? "Counter"}</strong>
                    </span>
                  )}
                </div>
                {template.showCustomerInfo && (
                  <div className="col-span-2 pt-1 border-t border-dotted border-slate-300">
                    <div>
                      Customer:{" "}
                      <strong className="font-bold">{order.customer || "Walk-in Guest"}</strong>
                    </div>
                    {(customerPhone || order.phone) && (
                      <div>Phone: {customerPhone || order.phone}</div>
                    )}
                  </div>
                )}
                {template.showWaiter && (
                  <div className="col-span-2 text-[9px] text-slate-500">
                    Captain: {order.waiter || "Ananya"}
                  </div>
                )}
              </div>

              {/* Itemized Table */}
              <div className="py-2 border-b border-dashed border-slate-400">
                <div className="mb-1 flex justify-between border-b border-slate-900 pb-1 text-[10px] font-bold uppercase">
                  <span className="w-6">Qty</span>
                  <span className="flex-1 px-1">Item</span>
                  <span className="w-12 text-right">Rate</span>
                  <span className="w-14 text-right">Amt</span>
                </div>
                <ul className="space-y-1.5 pt-1 text-[10px]">
                  {order.lines.map((l) => (
                    <li key={l.id}>
                      <div className="flex justify-between">
                        <span className="w-6 font-bold">{l.qty}</span>
                        <span className="flex-1 px-1 font-semibold text-slate-900">{l.name}</span>
                        <span className="w-12 text-right tabular text-slate-600">{l.unitPrice}</span>
                        <span className="w-14 text-right font-bold tabular">
                          {l.qty * l.unitPrice}
                        </span>
                      </div>
                      {template.showItemModifiers !== false && l.modifiers && l.modifiers.length > 0 && (
                        <div className="text-[9px] text-slate-500 pl-6 italic">
                          + {l.modifiers.join(", ")}
                        </div>
                      )}
                      {template.showItemNotes && l.note && (
                        <div className="text-[9px] text-slate-500 pl-6 italic">
                          Note: {l.note}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Calculation Breakdown */}
              <div className="border-b border-dashed border-slate-400 py-2 space-y-1 text-[10px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="tabular">{money(bill.subtotal)}</span>
                </div>
                {bill.discount > 0 && template.showDiscountLine !== false && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Discount</span>
                    <span className="tabular">− {money(bill.discount)}</span>
                  </div>
                )}
                {template.showTaxBreakup ? (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST (2.5%)</span>
                      <span className="tabular">{money(cgst)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST (2.5%)</span>
                      <span className="tabular">{money(sgst)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-slate-600">
                    <span>GST ({template.gstin ? "5%" : "Included"})</span>
                    <span className="tabular">{money(bill.tax)}</span>
                  </div>
                )}
                {template.showServiceCharge && bill.service > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Service Charge (5%)</span>
                    <span className="tabular">{money(bill.service)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 border-slate-900 pt-1.5 text-sm font-extrabold text-slate-900">
                  <span>GRAND TOTAL</span>
                  <span className="tabular">{money(bill.total)}</span>
                </div>
              </div>

              {/* Payment Stamp */}
              {template.showPaymentMode && (
                <div className="my-1.5 border-b border-dashed border-slate-400 py-1 text-center font-bold text-[10px] bg-slate-50 text-slate-900">
                  ✓ PAID VIA {paymentMethod.toUpperCase()} · {money(bill.total)}
                </div>
              )}

              {/* Customer Loyalty Rewards */}
              {template.showLoyaltyPoints && (
                <div className="my-1.5 rounded border border-dashed border-indigo-300 bg-indigo-50/70 p-1.5 text-center text-[9px] text-indigo-950">
                  <div className="font-bold">⭐ CUSTOMER LOYALTY SUMMARY ⭐</div>
                  <div>
                    Points Earned on this Bill:{" "}
                    <strong className="font-bold">+{earnedPts} Pts</strong>
                  </div>
                  <div>
                    Total Loyalty Balance:{" "}
                    <strong className="font-bold">{currentBalance} Pts</strong> (₹{currentBalance} value)
                  </div>
                </div>
              )}

              {/* QR Code */}
              {template.showQrCode && (
                <div className="border-b border-dashed border-slate-400 py-2 text-center">
                  <div className="size-16 border border-slate-900 mx-auto grid place-items-center bg-white p-1">
                    <QrCode className="size-14 text-slate-900" />
                  </div>
                  <div className="mt-1 text-[8px] font-bold text-slate-600">
                    {template.qrNote || "SCAN TO PAY / REVIEW"}
                  </div>
                  <div className="text-[8px] text-slate-400 font-mono">{template.upiId}</div>
                </div>
              )}

              {/* Footer */}
              <div className="pt-2 text-center text-[9px] text-slate-500 space-y-0.5">
                <div className="font-semibold text-slate-800">{template.footerMessage}</div>
                {template.footerSubNote && <div>{template.footerSubNote}</div>}
                {template.wifiDetails && <div>{template.wifiDetails}</div>}
                {template.termsNotice && (
                  <div className="text-[8px] text-slate-400 pt-0.5">{template.termsNotice}</div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="p-3 border-t bg-slate-50 flex flex-wrap items-center justify-between gap-2 sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800 font-semibold shadow-xs"
              >
                <Printer className="size-3.5" /> Print Slip
              </Button>
              {order.backendBillId && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pdfBusy}
                    onClick={handleBackendPdf}
                    className="gap-1 text-xs"
                    title="Open server-rendered fpdf2 Thermal PDF"
                  >
                    <FileText className="size-3.5" /> Thermal PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBackendEscPos}
                    className="gap-1 text-xs"
                    title="Download raw ESC/POS byte stream for 9100 thermal printer"
                  >
                    <Download className="size-3.5" /> ESC/POS
                  </Button>
                </>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embedded Print CSS to enforce thermal 80mm/58mm output */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-printable, #thermal-receipt-printable * {
            visibility: visible !important;
          }
          #thermal-receipt-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${template.paperWidth === "80mm" ? "80mm" : "58mm"} !important;
            margin: 0 !important;
            padding: 4mm !important;
            border: none !important;
            box-shadow: none !important;
            font-size: ${template.paperWidth === "80mm" ? "12px" : "10px"} !important;
          }
          @page {
            size: ${template.paperWidth === "80mm" ? "80mm" : "58mm"} auto;
            margin: 0;
          }
        }
      `}</style>

      {/* Receipt Customizer Modal */}
      <ReceiptCustomizerModal
        open={customizerOpen}
        onOpenChange={setCustomizerOpen}
        orgSlug={orgSlug}
      />
    </>
  );
}
