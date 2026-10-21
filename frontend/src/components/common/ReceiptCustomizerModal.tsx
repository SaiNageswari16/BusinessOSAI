import { useState } from "react";
import {
  Check,
  Eye,
  Layers,
  Palette,
  Printer,
  QrCode,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Store,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_RECEIPT_TEMPLATE,
  ReceiptTemplate,
  receiptTemplateService,
} from "@/services/receiptTemplateService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReceiptCustomizerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug?: string;
  onTemplateUpdated?: (template: ReceiptTemplate) => void;
}

export function ReceiptCustomizerModal({
  open,
  onOpenChange,
  orgSlug = "spice9",
  onTemplateUpdated,
}: ReceiptCustomizerModalProps) {
  const [template, setTemplate] = useState<ReceiptTemplate>(() =>
    receiptTemplateService.getActiveTemplate(orgSlug)
  );
  const [activeTab, setActiveTab] = useState<"header" | "content" | "taxes" | "footer">("header");

  const updateField = <K extends keyof ReceiptTemplate>(key: K, value: ReceiptTemplate[K]) => {
    setTemplate((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    receiptTemplateService.saveActiveTemplate(template, orgSlug);
    toast.success("Receipt Template Saved Successfully!", {
      description: `Active print format for organization "${template.orgName}" updated to ${template.paperWidth}.`,
    });
    onTemplateUpdated?.(template);
    onOpenChange(false);
  };

  const handleReset = () => {
    setTemplate(DEFAULT_RECEIPT_TEMPLATE);
    toast.info("Reset to Petpooja & MyBillBook standard preset");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 border-b bg-slate-50/80">
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="size-5 text-indigo-600" /> Petpooja & MyBillBook Thermal Receipt Designer
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Configure 80mm & 58mm ESC/POS thermal receipts, tax breakdowns, branding, and customer loyalty sections.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => updateField("paperWidth", "80mm")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                  template.paperWidth === "80mm"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                80mm (3.15")
              </button>
              <button
                type="button"
                onClick={() => updateField("paperWidth", "58mm")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                  template.paperWidth === "58mm"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                58mm (2.28")
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Main Content: Split Editor & Live Thermal Preview */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-0 flex-1 overflow-hidden">
          {/* Left Side: Customization Form */}
          <div className="md:col-span-7 p-5 overflow-y-auto space-y-4 border-r">
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="header" className="text-xs">Branding</TabsTrigger>
                <TabsTrigger value="content" className="text-xs">Fields</TabsTrigger>
                <TabsTrigger value="taxes" className="text-xs">GST & Totals</TabsTrigger>
                <TabsTrigger value="footer" className="text-xs">QR & Footer</TabsTrigger>
              </TabsList>

              {/* 1. Header & Identity */}
              <TabsContent value="header" className="space-y-3.5 pt-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Restaurant / Organization Name</Label>
                  <Input
                    value={template.orgName}
                    onChange={(e) => updateField("orgName", e.target.value)}
                    placeholder="e.g. Spice9 Restaurant & Bar"
                    className="h-8 text-xs font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Tagline / Category</Label>
                    <Input
                      value={template.tagline}
                      onChange={(e) => updateField("tagline", e.target.value)}
                      placeholder="e.g. Hyderabadi & Coastal Dining"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Branch / Outlet Name</Label>
                    <Input
                      value={template.branchName}
                      onChange={(e) => updateField("branchName", e.target.value)}
                      placeholder="e.g. Banjara Hills Flagship"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Outlet Full Address</Label>
                  <Input
                    value={template.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="Road, Area, City, Pincode"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Phone / WhatsApp</Label>
                    <Input
                      value={template.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="+91 98765 43210"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Email / Website</Label>
                    <Input
                      value={template.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="dine@spice9.com"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">GSTIN / Tax ID</Label>
                    <Input
                      value={template.gstin}
                      onChange={(e) => updateField("gstin", e.target.value)}
                      placeholder="36AABCU9603R1ZM"
                      className="h-8 text-xs font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">FSSAI License No.</Label>
                    <Input
                      value={template.fssai}
                      onChange={(e) => updateField("fssai", e.target.value)}
                      placeholder="13622011000452"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* 2. Content & Service Fields */}
              <TabsContent value="content" className="space-y-3 pt-3">
                <div className="rounded-xl border p-3 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Show Customer Name & Phone</div>
                      <div className="text-[11px] text-slate-500">Prints guest contact on the invoice</div>
                    </div>
                    <Switch
                      checked={template.showCustomerInfo}
                      onCheckedChange={(v) => updateField("showCustomerInfo", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t pt-2.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Show Customer GSTIN (B2B Tax Invoices)</div>
                      <div className="text-[11px] text-slate-500">Prints customer corporate tax identifier</div>
                    </div>
                    <Switch
                      checked={template.showCustomerGstin}
                      onCheckedChange={(v) => updateField("showCustomerGstin", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t pt-2.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Customer Loyalty Rewards Summary</div>
                      <div className="text-[11px] text-slate-500">Prints points earned & remaining loyalty balance</div>
                    </div>
                    <Switch
                      checked={template.showLoyaltyPoints}
                      onCheckedChange={(v) => updateField("showLoyaltyPoints", v)}
                    />
                  </div>
                  {template.showLoyaltyPoints && (
                    <div className="pl-4 border-l-2 border-indigo-500 pt-1 space-y-1">
                      <Label className="text-[11px] font-semibold text-indigo-900">Loyalty Earn Rate (% of bill)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        value={template.loyaltyEarnRatePct}
                        onChange={(e) => updateField("loyaltyEarnRatePct", Number(e.target.value) || 5)}
                        className="h-7 w-28 text-xs"
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-xl border p-3 space-y-2.5 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">Print Table & Section Name</span>
                    <Switch
                      checked={template.showTable}
                      onCheckedChange={(v) => updateField("showTable", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-xs font-semibold text-slate-900">Print Waiter / Captain Name</span>
                    <Switch
                      checked={template.showWaiter}
                      onCheckedChange={(v) => updateField("showWaiter", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-xs font-semibold text-slate-900">Print Cashier Name</span>
                    <Switch
                      checked={template.showCashier}
                      onCheckedChange={(v) => updateField("showCashier", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-xs font-semibold text-slate-900">Print KOT Token Number</span>
                    <Switch
                      checked={template.showTokenNo}
                      onCheckedChange={(v) => updateField("showTokenNo", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-xs font-semibold text-slate-900">Print Dish Preparation Modifiers & Notes</span>
                    <Switch
                      checked={template.showItemNotes}
                      onCheckedChange={(v) => updateField("showItemNotes", v)}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* 3. GST & Totals */}
              <TabsContent value="taxes" className="space-y-3 pt-3">
                <div className="rounded-xl border p-3 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Detailed GST Tax Breakdown</div>
                      <div className="text-[11px] text-slate-500">Prints explicit CGST 2.5% + SGST 2.5% lines</div>
                    </div>
                    <Switch
                      checked={template.showTaxBreakup}
                      onCheckedChange={(v) => updateField("showTaxBreakup", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t pt-2.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Show Service Charge (5%)</div>
                      <div className="text-[11px] text-slate-500">Prints discretionary restaurant service charge</div>
                    </div>
                    <Switch
                      checked={template.showServiceCharge}
                      onCheckedChange={(v) => updateField("showServiceCharge", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t pt-2.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Show Round-Off Adjustment</div>
                      <div className="text-[11px] text-slate-500">Rounds to nearest whole Indian Rupee</div>
                    </div>
                    <Switch
                      checked={template.showRoundOff}
                      onCheckedChange={(v) => updateField("showRoundOff", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between border-t pt-2.5">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Show Tender & Payment Mode Stamp</div>
                      <div className="text-[11px] text-slate-500">Prints "Paid via UPI / Cash / Card"</div>
                    </div>
                    <Switch
                      checked={template.showPaymentMode}
                      onCheckedChange={(v) => updateField("showPaymentMode", v)}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* 4. QR & Footer */}
              <TabsContent value="footer" className="space-y-3.5 pt-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Footer Greeting Message</Label>
                  <Input
                    value={template.footerMessage}
                    onChange={(e) => updateField("footerMessage", e.target.value)}
                    placeholder="e.g. Thank you for dining with us! Visit again."
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Guest WiFi Credentials</Label>
                  <Input
                    value={template.wifiDetails || ""}
                    onChange={(e) => updateField("wifiDetails", e.target.value)}
                    placeholder="Guest WiFi: Network | Pass: password"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Legal / Terms Notice</Label>
                  <Input
                    value={template.termsNotice || ""}
                    onChange={(e) => updateField("termsNotice", e.target.value)}
                    placeholder="Computer generated invoice. No refund on prepared food."
                    className="h-8 text-xs"
                  />
                </div>
                <div className="rounded-xl border p-3 space-y-2.5 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Print UPI Payment / Feedback QR Code</div>
                      <div className="text-[11px] text-slate-500">Thermal barcode / QR code block</div>
                    </div>
                    <Switch
                      checked={template.showQrCode}
                      onCheckedChange={(v) => updateField("showQrCode", v)}
                    />
                  </div>
                  {template.showQrCode && (
                    <div className="pt-2 border-t space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">UPI VPA ID for Dynamic QR</Label>
                        <Input
                          value={template.upiId}
                          onChange={(e) => updateField("upiId", e.target.value)}
                          placeholder="e.g. restaurant@icici or 9876543210@paytm"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Side: Live Thermal Paper ESC/POS Preview */}
          <div className="md:col-span-5 bg-slate-100 p-4 flex flex-col items-center justify-start overflow-y-auto border-t md:border-t-0">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Eye className="size-3.5" /> Live {template.paperWidth} Thermal Preview
            </div>

            {/* Thermal Receipt Paper */}
            <div
              className={cn(
                "bg-white shadow-xl border border-slate-300 p-4 font-mono text-slate-900 transition-all select-none",
                template.paperWidth === "80mm" ? "w-[310px] text-xs" : "w-[240px] text-[10px]"
              )}
              style={{
                boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              {/* Header */}
              <div className="text-center border-b border-dashed border-slate-400 pb-2.5 space-y-0.5">
                <div className="font-extrabold text-sm tracking-tight uppercase leading-snug">
                  {template.orgName || "RESTAURANT NAME"}
                </div>
                {template.tagline && (
                  <div className="text-[10px] text-slate-600 font-medium">{template.tagline}</div>
                )}
                <div className="text-[10px] text-slate-700">{template.branchName}</div>
                <div className="text-[9px] text-slate-500 leading-tight">{template.address}</div>
                <div className="text-[10px] text-slate-700 font-semibold">Ph: {template.phone}</div>
                <div className="pt-1 text-[9px] text-slate-600 flex justify-center gap-2">
                  <span>GSTIN: {template.gstin}</span>
                </div>
                <div className="text-[9px] text-slate-600">FSSAI: {template.fssai}</div>
                {template.showHeaderGreeting && (
                  <div className="mt-1.5 py-0.5 bg-slate-900 text-white font-bold text-[9px] uppercase tracking-wider">
                    {template.headerGreetingText || "TAX INVOICE"}
                  </div>
                )}
              </div>

              {/* Bill Meta Details */}
              <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Bill No: <strong className="font-bold">INV-9042</strong></span>
                  <span>Date: 21/10/2026</span>
                </div>
                <div className="flex justify-between">
                  <span>Time: 07:15 PM</span>
                  {template.showTable && <span>Table: <strong className="font-bold">T-4 (AC Hall)</strong></span>}
                </div>
                {template.showCustomerInfo && (
                  <div className="border-t border-dotted border-slate-300 pt-1 mt-1 text-[10px]">
                    <div>Customer: <strong className="font-bold">Vikram Sharma</strong></div>
                    <div>Phone: +91 98765 01234</div>
                    {template.showCustomerGstin && <div>Cust GSTIN: 36ABCDE1234F1Z5</div>}
                  </div>
                )}
                {(template.showWaiter || template.showCashier) && (
                  <div className="flex justify-between text-[9px] text-slate-500 pt-0.5">
                    {template.showWaiter && <span>Captain: Suresh</span>}
                    {template.showCashier && <span>Cashier: Admin</span>}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="py-2 border-b border-dashed border-slate-400">
                <div className="flex justify-between font-bold text-[10px] uppercase border-b border-slate-900 pb-1">
                  <span className="w-6">Qty</span>
                  <span className="flex-1 px-1">Item</span>
                  <span className="w-12 text-right">Price</span>
                  <span className="w-14 text-right">Amt</span>
                </div>
                <div className="space-y-1.5 pt-1 text-[10px]">
                  <div>
                    <div className="flex justify-between">
                      <span className="w-6 font-bold">2</span>
                      <span className="flex-1 px-1 font-semibold">Chicken Dum Biryani</span>
                      <span className="w-12 text-right">380.00</span>
                      <span className="w-14 text-right font-bold">760.00</span>
                    </div>
                    {template.showItemNotes && (
                      <div className="text-[9px] text-slate-500 pl-6 italic">Extra Mirchi ka Salan</div>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="w-6 font-bold">1</span>
                    <span className="flex-1 px-1 font-semibold">Paneer Tikka Kebab</span>
                    <span className="w-12 text-right">320.00</span>
                    <span className="w-14 text-right font-bold">320.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="w-6 font-bold">2</span>
                    <span className="flex-1 px-1 font-semibold">Fresh Lime Soda</span>
                    <span className="w-12 text-right">90.00</span>
                    <span className="w-14 text-right font-bold">180.00</span>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal (3 items)</span>
                  <span className="font-semibold">₹1,260.00</span>
                </div>
                {template.showTaxBreakup ? (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST (2.5%)</span>
                      <span>₹31.50</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST (2.5%)</span>
                      <span>₹31.50</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-slate-600">
                    <span>Total GST (5%)</span>
                    <span>₹63.00</span>
                  </div>
                )}
                {template.showServiceCharge && (
                  <div className="flex justify-between text-slate-600">
                    <span>Service Charge (5%)</span>
                    <span>₹63.00</span>
                  </div>
                )}
                {template.showRoundOff && (
                  <div className="flex justify-between text-slate-500 text-[9px]">
                    <span>Round Off</span>
                    <span>₹0.00</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm border-t-2 border-slate-900 pt-1.5 mt-1">
                  <span>GRAND TOTAL</span>
                  <span>₹1,386.00</span>
                </div>
              </div>

              {/* Payment Stamp */}
              {template.showPaymentMode && (
                <div className="py-1.5 text-center font-bold text-[10px] border-b border-dashed border-slate-400 bg-slate-50 my-1">
                  ✓ PAID VIA UPI · ₹1,386.00
                </div>
              )}

              {/* Loyalty Reward Summary */}
              {template.showLoyaltyPoints && (
                <div className="py-1.5 border-b border-dashed border-slate-400 text-[9px] text-center bg-indigo-50/60 rounded my-1 text-indigo-950">
                  <div className="font-bold">⭐ LOYALTY REWARDS SUMMARY ⭐</div>
                  <div>Points Earned on this Bill: <strong className="font-bold">+63 Pts</strong></div>
                  <div>Total Loyalty Balance: <strong className="font-bold">245 Pts</strong> (₹245 Value)</div>
                </div>
              )}

              {/* QR Code Placeholder */}
              {template.showQrCode && (
                <div className="py-2 text-center border-b border-dashed border-slate-400">
                  <div className="size-20 border-2 border-slate-900 mx-auto grid place-items-center bg-white p-1">
                    <QrCode className="size-16 text-slate-900" />
                  </div>
                  <div className="text-[9px] font-bold text-slate-700 mt-1">
                    SCAN TO PAY VIA UPI
                  </div>
                  <div className="text-[8px] text-slate-500 font-mono">{template.upiId}</div>
                </div>
              )}

              {/* Footer */}
              <div className="pt-2 text-center text-[9px] text-slate-600 space-y-0.5">
                <div className="font-bold text-slate-800">{template.footerMessage}</div>
                {template.wifiDetails && <div>{template.wifiDetails}</div>}
                {template.termsNotice && (
                  <div className="text-[8px] text-slate-400 pt-0.5">{template.termsNotice}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-slate-50 flex items-center justify-between sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="text-xs text-slate-600 gap-1.5">
            <RotateCcw className="size-3.5" /> Reset to Standard Petpooja Format
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-semibold">
              <Save className="size-3.5" /> Save as Active Org Template
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
