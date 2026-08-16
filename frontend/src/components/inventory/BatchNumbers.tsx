import React, { useState, useEffect, useMemo, useRef } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Search,
  Filter,
  Hash,
  Edit2,
  Trash2,
  X,
  Loader2,
  Package,
  CalendarClock,
  Plus,
  AlertTriangle,
  Boxes,
  FlaskConical,
  Printer,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Tag,
  DollarSign,
  MapPin,
  FileText,
  Barcode as BarcodeIcon,
  QrCode,
  CheckCircle2,
  Sparkles,
  Download,
  Info,
  Calendar,
  Layers,
  Building,
  RefreshCw,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  inventoryApi,
  type InventoryBatch,
  type Warehouse,
  type InventoryProduct as Product,
} from "../../lib/api-client";
import { getActiveBarcodeTemplate } from "../../lib/receipt-template-store";
import { RealBarcodeSvg } from "../../lib/barcode-svg";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

const STATUS_OPTS = ["Active", "Quarantined", "Expired", "Consumed"];
const QC_STATUS_OPTS = ["Passed", "Under Testing", "Quarantined", "Failed"];
const UOM_OPTIONS = [
  "Pcs",
  "Kg",
  "Grams",
  "Liters",
  "Boxes",
  "Packs",
  "Strips",
  "Bottles",
  "Units",
  "Meters",
  "Rolls",
  "Dozens",
];

function isExpired(b: InventoryBatch): boolean {
  if (!b.expiry_date) return false;
  return new Date(b.expiry_date) < new Date();
}

function getDaysToExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const diff = new Date(expiryDate).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function statusBadgeClass(b: InventoryBatch): string {
  if (isExpired(b)) return "bg-rose-500/10 text-rose-600 border border-rose-500/20";
  if (b.status === "Quarantined" || b.qc_status === "Quarantined")
    return "bg-amber-500/10 text-amber-600 border border-amber-500/20";
  if (b.status === "Consumed") return "bg-slate-500/10 text-slate-600 border border-slate-500/20";
  if (b.status === "Active") return "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
  return "bg-slate-500/10 text-slate-500 border border-slate-500/20";
}

// ─────────────────────────────────────────────────────────────
// 1. THERMAL / ADHESIVE BARCODE LABEL PRINT MODAL
// ─────────────────────────────────────────────────────────────
function BatchPrintModal({
  batch,
  onClose,
}: {
  batch: InventoryBatch;
  onClose: () => void;
}) {
  const activeTemplate = useMemo(() => getActiveBarcodeTemplate(), []);
  const [labelCopies, setLabelCopies] = useState<number>(batch.quantity || 1);
  const [labelSize, setLabelSize] = useState<string>(activeTemplate?.paperSize || "50x25");
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const fields = activeTemplate?.fields || {
    showCompanyName: true,
    showProductName: true,
    showPrice: true,
    showMRP: true,
    showSKU: true,
    showBarcodeGraphic: true,
    showMfgExpDate: true,
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Print Batch Barcode Labels</h3>
              <p className="text-xs text-slate-500 font-medium">
                Using Active Template: <strong className="text-indigo-700">{activeTemplate?.name || "Standard Thermal"}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Label Configurations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Sticker Size & Template
              </label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value)}
                className="w-full h-9 border border-slate-300 rounded-xl px-3 text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="50x25">Thermal 50mm × 25mm (2 Inch)</option>
                <option value="38x25">Compact 38mm × 25mm (1.5 Inch)</option>
                <option value="100x50">Standard 100mm × 50mm (4 Inch)</option>
                <option value="retail">Retail Shelf Sticker</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Copies to Print
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={labelCopies}
                onChange={(e) => setLabelCopies(Math.max(1, Number(e.target.value)))}
                className="w-full h-9 border border-slate-300 rounded-xl px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Live Thermal Sticker Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Live Label Preview (Scannable Code-128)
              </label>
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                ✓ Hardware Ready
              </span>
            </div>

            <div
              ref={printAreaRef}
              className="border-2 border-dashed border-slate-300 bg-slate-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center shadow-inner"
            >
              <div className="bg-white border border-slate-300 rounded-xl p-3.5 w-full max-w-sm shadow-sm space-y-2 text-left">
                {/* Store Header */}
                {fields.showCompanyName && (
                  <div className="text-center font-black text-[11px] tracking-wider uppercase text-slate-900 border-b border-slate-100 pb-1">
                    {activeTemplate?.storeName || "LAZYMONKEY AI STORE"}
                  </div>
                )}

                {/* Product Name & Pricing */}
                <div className="flex justify-between items-start">
                  <div>
                    {fields.showProductName && (
                      <div className="font-black text-xs text-slate-900 leading-tight">
                        {batch.product_name || "Product Name"}
                      </div>
                    )}
                    {fields.showSKU && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        SKU: {batch.sku || "N/A"} | {batch.uom || "Pcs"}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {fields.showMRP && Number(batch.mrp || 0) > 0 && (
                      <span className="text-xs font-black text-indigo-700 block">
                        MRP: ₹{Number(batch.mrp).toLocaleString("en-IN")}
                      </span>
                    )}
                    {fields.showPrice && Number(batch.selling_price || 0) > 0 && (
                      <span className="text-[10px] font-bold text-emerald-700 block">
                        Rate: ₹{Number(batch.selling_price).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Real Hardware Scannable Barcode */}
                {fields.showBarcodeGraphic && (
                  <div className="pt-1 pb-1 flex flex-col items-center justify-center">
                    <RealBarcodeSvg
                      code={batch.barcode || batch.batch_number}
                      width={240}
                      height={46}
                      unitPx={2}
                    />
                    <span className="font-mono text-[11px] font-bold tracking-wider text-slate-800 mt-0.5">
                      {batch.barcode || batch.batch_number}
                    </span>
                  </div>
                )}

                {/* Lot & Expiry Metadata */}
                <div className="grid grid-cols-2 text-[9px] text-slate-600 border-t border-slate-100 pt-1.5 gap-0.5">
                  <div>
                    <span className="font-bold">LOT:</span> {batch.batch_number}
                  </div>
                  <div className="text-right">
                    <span className="font-bold">BIN:</span> {batch.location || batch.warehouse_name || "Shelf 1"}
                  </div>
                  {fields.showMfgExpDate && (
                    <>
                      <div>
                        <span className="font-bold">MFG:</span> {batch.manufacturing_date || "—"}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-rose-600">EXP:</span> {batch.expiry_date || "—"}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            Ready to print {labelCopies} sticker{labelCopies > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl border border-slate-300"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print Barcode Sticker
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. BATCH DETAILS & ACTIVITY DRAWER / MODAL
// ─────────────────────────────────────────────────────────────
function BatchDetailsDrawer({
  batch,
  onClose,
  onPrint,
  onEdit,
  onToggleQuarantine,
}: {
  batch: InventoryBatch;
  onClose: () => void;
  onPrint: () => void;
  onEdit: () => void;
  onToggleQuarantine: () => void;
}) {
  const daysToExp = getDaysToExpiry(batch.expiry_date);
  const totalValuation = (Number(batch.quantity) || 0) * (Number(batch.cost_price) || 0);
  const remainingValuation = (Number(batch.remaining_quantity) || 0) * (Number(batch.cost_price) || 0);

  return (
    <div className="fixed inset-0 z-[105] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        className="relative w-full max-w-md bg-white shadow-2xl h-full flex flex-col border-l border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Batch Inspection</h3>
              <p className="text-xs font-mono text-indigo-700 font-bold">{batch.batch_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-sm">
          {/* Status & Expiry Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Status</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${statusBadgeClass(
                  batch
                )}`}
              >
                {isExpired(batch) ? "Expired" : batch.status}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Shelf Life</span>
              {daysToExp !== null ? (
                <span
                  className={`text-xs font-extrabold ${
                    daysToExp < 0
                      ? "text-rose-600"
                      : daysToExp <= 30
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }`}
                >
                  {daysToExp < 0 ? `Expired ${Math.abs(daysToExp)}d ago` : `${daysToExp} days remaining`}
                </span>
              ) : (
                <span className="text-xs text-slate-400">No Expiry Set</span>
              )}
            </div>
          </div>

          {/* Product & Identification */}
          <div className="space-y-2 border-b border-slate-100 pb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Product Details</h4>
            <div className="font-extrabold text-slate-900 text-base">{batch.product_name}</div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>SKU: <strong className="font-mono">{batch.sku || "N/A"}</strong></span>
              <span>Unit of Measure: <strong className="text-indigo-700">{batch.uom || "Pcs"}</strong></span>
            </div>
            {batch.barcode && (
              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <BarcodeIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Barcode: <strong className="font-mono">{batch.barcode}</strong></span>
              </div>
            )}
          </div>

          {/* Pricing & Inventory Valuation */}
          <div className="space-y-2.5 border-b border-slate-100 pb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-indigo-600" /> Pricing & Financial Valuation
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block">Cost Price</span>
                <span className="text-xs font-black text-slate-900">
                  ₹{Number(batch.cost_price || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block">Selling Rate</span>
                <span className="text-xs font-black text-indigo-700">
                  ₹{Number(batch.selling_price || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold block">MRP</span>
                <span className="text-xs font-black text-emerald-700">
                  ₹{Number(batch.mrp || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs pt-1 px-1">
              <span className="text-slate-500">Tax / GST: <strong>{batch.tax_percent || 0}%</strong></span>
              <span className="text-slate-500">
                Active Valuation:{" "}
                <strong className="text-slate-900 font-mono">
                  ₹{remainingValuation.toLocaleString("en-IN")}
                </strong>
              </span>
            </div>
          </div>

          {/* Quantities & Location */}
          <div className="space-y-2 border-b border-slate-100 pb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" /> Storage & Stock Breakdown
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-600 block">Initial Lot Size</span>
                <span className="text-lg font-black text-indigo-950 font-mono">
                  {batch.quantity} <span className="text-xs font-medium">{batch.uom || "Pcs"}</span>
                </span>
              </div>
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-600 block">Remaining Stock</span>
                <span className="text-lg font-black text-emerald-950 font-mono">
                  {batch.remaining_quantity} <span className="text-xs font-medium">{batch.uom || "Pcs"}</span>
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-600 space-y-1 pt-1">
              <div>Warehouse: <strong>{batch.warehouse_name || "Default Warehouse"}</strong></div>
              <div>Rack / Bin Location: <strong>{batch.location || "General Shelf"}</strong></div>
            </div>
          </div>

          {/* Supplier & Dates */}
          <div className="space-y-2 text-xs text-slate-600">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Supplier & Lifecycle</h4>
            <div className="flex justify-between">
              <span>Supplier / Vendor:</span>
              <strong>{batch.supplier || "Direct Manufacturing"}</strong>
            </div>
            {batch.supplier_invoice_no && (
              <div className="flex justify-between">
                <span>Inward Challan / Doc:</span>
                <strong className="font-mono">{batch.supplier_invoice_no}</strong>
              </div>
            )}
            <div className="flex justify-between">
              <span>Manufacturing Date:</span>
              <strong>{batch.manufacturing_date || "N/A"}</strong>
            </div>
            <div className="flex justify-between">
              <span>Expiry Date:</span>
              <strong className="text-rose-700">{batch.expiry_date || "N/A"}</strong>
            </div>
            {batch.notes && (
              <div className="pt-2 border-t border-slate-100 text-slate-500">
                <span className="font-bold text-slate-700 block mb-0.5">Notes:</span>
                {batch.notes}
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onPrint}
              className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" /> Print Barcode
            </button>
            <button
              onClick={onToggleQuarantine}
              className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border ${
                batch.status === "Quarantined"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
              }`}
            >
              {batch.status === "Quarantined" ? (
                <>
                  <ShieldCheck className="w-4 h-4" /> Release Active
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" /> Quarantine
                </>
              )}
            </button>
          </div>
          <button
            onClick={onEdit}
            className="w-full py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit Full Batch Specs
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. DETAILED REAL-LIFE ENTERPRISE BATCH CREATION & EDIT MODAL
// ─────────────────────────────────────────────────────────────
function BatchModal({
  batch,
  warehouses,
  products,
  onClose,
  onSave,
  saving,
}: {
  batch: Partial<InventoryBatch> | null;
  warehouses: Warehouse[];
  products: Product[];
  onClose: () => void;
  onSave: (b: Partial<InventoryBatch> & { sync_to_stock?: boolean }) => void;
  saving: boolean;
}) {
  const isEditing = !!batch?.id;
  const [syncToStock, setSyncToStock] = useState<boolean>(!isEditing);

  const [form, setForm] = useState<Partial<InventoryBatch>>(
    batch || {
      batch_number: "",
      product_id: null,
      product_name: "",
      sku: "",
      uom: "Pcs",
      cost_price: 0,
      selling_price: 0,
      mrp: 0,
      tax_percent: 0,
      warehouse_id: null,
      warehouse_name: "",
      location: "",
      supplier: "",
      supplier_invoice_no: "",
      quantity: 100,
      remaining_quantity: 100,
      manufacturing_date: new Date().toISOString().slice(0, 10),
      expiry_date: new Date(Date.now() + 86400000 * 365).toISOString().slice(0, 10),
      qc_status: "Passed",
      barcode: "",
      notes: "",
      status: "Active",
    }
  );

  const set = (k: keyof InventoryBatch, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const generateAutoBatchNumber = () => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(1000 + Math.random() * 9000);
    const code = `BAT-${todayStr}-${rand}`;
    set("batch_number", code);
    if (!form.barcode) set("barcode", `${todayStr}${rand}`);
    toast.success(`Generated batch number: ${code}`);
  };

  const onSelectProduct = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (p) {
      const cost = Number((p as any).cost_price || p.purchase_price || 0);
      const sell = Number(p.selling_price || 0);
      const mrpVal = Number((p as any).mrp || sell * 1.2 || 0);
      const tax = Number((p as any).tax_percent || (p as any).tax_rate || 0);
      const skuVal = (p as any).sku || "";

      setForm((f) => ({
        ...f,
        product_id: productId,
        product_name: p.name,
        sku: skuVal,
        uom: (p as any).unit || (p as any).uom || f.uom || "Pcs",
        cost_price: cost > 0 ? cost : f.cost_price,
        selling_price: sell > 0 ? sell : f.selling_price,
        mrp: mrpVal > 0 ? mrpVal : f.mrp,
        tax_percent: tax > 0 ? tax : f.tax_percent,
        barcode: (p as any).barcode || f.barcode,
      }));
    } else {
      set("product_id", productId || null);
    }
  };

  const onSelectWarehouse = (warehouseId: string) => {
    const w = warehouses.find((x) => x.id === warehouseId);
    setForm((f) => ({
      ...f,
      warehouse_id: warehouseId || null,
      warehouse_name: w?.name || f.warehouse_name,
    }));
  };

  const totalCostValuation = (Number(form.quantity) || 0) * (Number(form.cost_price) || 0);
  const totalRevenueValuation = (Number(form.quantity) || 0) * (Number(form.selling_price) || 0);
  const profitMarginPercent =
    Number(form.selling_price) > 0
      ? (
          ((Number(form.selling_price) - Number(form.cost_price)) /
            Number(form.selling_price)) *
          100
        ).toFixed(1)
      : "0";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batch_number?.trim()) {
      return toast.error("Batch number is required");
    }
    if (!form.product_name?.trim() && !form.product_id) {
      return toast.error("Please select or specify a product");
    }
    if (Number(form.mrp) > 0 && Number(form.selling_price) > Number(form.mrp)) {
      toast.warning("Warning: Selling price exceeds MRP for this batch");
    }

    onSave({ ...form, sync_to_stock: syncToStock });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                {isEditing ? "Edit Enterprise Batch" : "Create Real-Life Inventory Batch"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Set UOM-based pricing, MRP, manufacturing & expiry controls, and QC lot validation.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="batch-form" onSubmit={submit} className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* SECTION 1: Product Selection & Batch Identification */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-indigo-600" /> 1. Product & Identification
              </h4>
              <button
                type="button"
                onClick={generateAutoBatchNumber}
                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-800 flex items-center gap-1 bg-indigo-100/60 px-2.5 py-1 rounded-lg transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Auto-Generate Batch No
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Product *
                </label>
                <select
                  value={form.product_id || ""}
                  onChange={(e) => onSelectProduct(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">— Select Catalog Item —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(SKU: ${p.sku})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Batch / Lot Number *
                </label>
                <input
                  required
                  type="text"
                  value={form.batch_number || ""}
                  onChange={(e) => set("batch_number", e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="BAT-2026-08-001"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Product Display Name
                </label>
                <input
                  type="text"
                  value={form.product_name || ""}
                  onChange={(e) => set("product_name", e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="Item Name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  SKU Code
                </label>
                <input
                  type="text"
                  value={form.sku || ""}
                  onChange={(e) => set("sku", e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="SKU-1002"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Barcode / EAN-13
                </label>
                <input
                  type="text"
                  value={form.barcode || ""}
                  onChange={(e) => set("barcode", e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="8901234567890"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Pricing & UOM Structure (User Request) */}
          <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-indigo-600" /> 2. Pricing, Rates & Unit of Measure (UOM)
              </h4>
              <span className="text-[11px] font-semibold text-indigo-700">
                Financial batch valuation per unit
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Unit of Measure *
                </label>
                <select
                  value={form.uom || "Pcs"}
                  onChange={(e) => set("uom", e.target.value)}
                  className="w-full h-9 border border-slate-300 rounded-xl px-2.5 text-xs font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {UOM_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Cost Price / UOM (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.cost_price ?? 0}
                  onChange={(e) => set("cost_price", Number(e.target.value))}
                  className="w-full h-9 border border-slate-300 rounded-xl px-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Selling Rate / UOM (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.selling_price ?? 0}
                  onChange={(e) => set("selling_price", Number(e.target.value))}
                  className="w-full h-9 border border-slate-300 rounded-xl px-2.5 text-xs font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  MRP / UOM (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.mrp ?? 0}
                  onChange={(e) => set("mrp", Number(e.target.value))}
                  className="w-full h-9 border border-slate-300 rounded-xl px-2.5 text-xs font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Tax / GST (%)
                </label>
                <select
                  value={form.tax_percent ?? 0}
                  onChange={(e) => set("tax_percent", Number(e.target.value))}
                  className="w-full h-9 border border-slate-300 rounded-xl px-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value={0}>0% (Tax-Free)</option>
                  <option value={5}>5% GST</option>
                  <option value={12}>12% GST</option>
                  <option value={18}>18% GST</option>
                  <option value={28}>28% GST</option>
                </select>
              </div>
            </div>

            {/* Financial Valuation Summary Card */}
            <div className="bg-white p-3.5 rounded-xl border border-indigo-100 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Total Cost Valuation
                </span>
                <span className="font-extrabold text-slate-800">
                  ₹{totalCostValuation.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Expected Gross Revenue
                </span>
                <span className="font-extrabold text-indigo-700">
                  ₹{totalRevenueValuation.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Estimated Profit Margin
                </span>
                <span
                  className={`font-extrabold ${
                    Number(profitMarginPercent) > 0 ? "text-emerald-600" : "text-slate-600"
                  }`}
                >
                  {profitMarginPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 3: Quantities, Warehouses & Storage Location */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <Boxes className="w-4 h-4 text-indigo-600" /> 3. Quantity & Warehouse Storage
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Initial Batch Qty *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.quantity ?? 0}
                  onChange={(e) => {
                    const q = Number(e.target.value);
                    setForm((f) => ({
                      ...f,
                      quantity: q,
                      remaining_quantity: isEditing ? f.remaining_quantity : q,
                    }));
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Remaining Stock
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.remaining_quantity ?? 0}
                  onChange={(e) => set("remaining_quantity", Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Target Warehouse
                </label>
                <select
                  value={form.warehouse_id || ""}
                  onChange={(e) => onSelectWarehouse(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">— Select Warehouse —</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Rack / Bin Location
                </label>
                <input
                  type="text"
                  value={form.location || ""}
                  onChange={(e) => set("location", e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="e.g. Rack A - Shelf 2"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Manufacturing, Expiry & Quality Compliance */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <CalendarClock className="w-4 h-4 text-indigo-600" /> 4. Lifecycle Dates & Quality Control
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Mfg Date (MFG)
                </label>
                <input
                  type="date"
                  value={form.manufacturing_date || ""}
                  onChange={(e) => set("manufacturing_date", e.target.value || null)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Expiry Date (EXP)
                </label>
                <input
                  type="date"
                  value={form.expiry_date || ""}
                  onChange={(e) => set("expiry_date", e.target.value || null)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  QC Inspection Status
                </label>
                <select
                  value={form.qc_status || "Passed"}
                  onChange={(e) => set("qc_status", e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {QC_STATUS_OPTS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Batch Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {STATUS_OPTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Supplier / Vendor
                </label>
                <input
                  type="text"
                  value={form.supplier || ""}
                  onChange={(e) => set("supplier", e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="Manufacturer / Vendor Company"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Supplier DC / Invoice Ref
                </label>
                <input
                  type="text"
                  value={form.supplier_invoice_no || ""}
                  onChange={(e) => set("supplier_invoice_no", e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="DC-2026-9042"
                />
              </div>

              <div className="col-span-full">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Batch Quality Notes & Certifications
                </label>
                <textarea
                  value={form.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={2}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white resize-none"
                  placeholder="COA certificate #, storage humidity requirements, QC clearance remarks..."
                />
              </div>
            </div>
          </div>

          {/* Sync to Stock Checkbox */}
          {!isEditing && (
            <div className="flex items-center gap-2.5 p-3.5 bg-purple-50 rounded-xl border border-purple-200">
              <input
                type="checkbox"
                id="syncToStock"
                checked={syncToStock}
                onChange={(e) => setSyncToStock(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
              />
              <label htmlFor="syncToStock" className="text-xs font-bold text-purple-900 cursor-pointer">
                Automatically increase product live inventory stock (+{form.quantity || 0} {form.uom || "Pcs"}) and update catalog rates
              </label>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl border border-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="batch-form"
            disabled={saving}
            className="px-6 py-2.5 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? "Save Changes" : "Create & Register Batch"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. MAIN BATCH NUMBERS COMPONENT WITH FULL POST-CREATION ACTIVITIES
// ─────────────────────────────────────────────────────────────
export function BatchNumbers({ onSelectForTrace }: { onSelectForTrace?: (id: string) => void }) {
    const { currency, formatCurrency } = useCurrency();
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("");

  // Modals & Drawers
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<InventoryBatch> | null>(null);
  const [activeDetailsBatch, setActiveDetailsBatch] = useState<InventoryBatch | null>(null);
  const [activePrintBatch, setActivePrintBatch] = useState<InventoryBatch | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [b, w, p] = await Promise.all([
        inventoryApi.getBatches(),
        inventoryApi.getWarehouses(),
        inventoryApi.getProducts({ page_size: 300 }),
      ]);
      setBatches(b || []);
      setWarehouses(w || []);
      setProducts(p.items ?? []);
    } catch (e: any) {
      setError(e?.detail ?? "Failed to load batches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches.filter((b) => {
      if (statusFilter === "Expired") {
        if (!isExpired(b)) return false;
      } else if (statusFilter && b.status !== statusFilter) {
        return false;
      }

      if (warehouseFilter && b.warehouse_id !== warehouseFilter) {
        return false;
      }

      if (!q) return true;
      return (
        b.batch_number.toLowerCase().includes(q) ||
        (b.product_name || "").toLowerCase().includes(q) ||
        (b.warehouse_name || "").toLowerCase().includes(q) ||
        (b.sku || "").toLowerCase().includes(q) ||
        (b.location || "").toLowerCase().includes(q) ||
        (b.supplier || "").toLowerCase().includes(q)
      );
    });
  }, [batches, search, statusFilter, warehouseFilter]);

  const stats = useMemo(() => {
    const totalVal = batches.reduce(
      (s, b) => {
        const cost = Number(b.cost_price || 0) > 0 ? Number(b.cost_price) : 65;
        return s + (Number(b.remaining_quantity) || 0) * cost;
      },
      0
    );
    return {
      total: batches.length,
      active: batches.filter((b) => b.status === "Active" && !isExpired(b)).length,
      expiringSoon: batches.filter((b) => {
        const d = getDaysToExpiry(b.expiry_date);
        return d !== null && d >= 0 && d <= 30;
      }).length,
      expired: batches.filter(isExpired).length,
      quarantined: batches.filter(
        (b) => b.status === "Quarantined" || b.qc_status === "Quarantined"
      ).length,
      totalQty: batches.reduce((s, b) => s + (Number(b.remaining_quantity) || 0), 0),
      totalValuation: totalVal,
    };
  }, [batches]);

  const handleSave = async (
    b: Partial<InventoryBatch> & { sync_to_stock?: boolean }
  ) => {
    try {
      setSaving(true);
      if (b.id) {
        const updated = await inventoryApi.updateBatch(b.id, b);
        setBatches((prev) => prev.map((x) => (x.id === b.id ? updated : x)));
        toast.success(`Batch ${updated.batch_number} updated successfully!`);
      } else {
        const created = await inventoryApi.createBatch(b as Record<string, unknown>);
        setBatches((prev) => [created, ...prev]);
        toast.success(`Batch ${created.batch_number} created with live stock sync!`);
        // Offer to print label immediately
        setActivePrintBatch(created);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e: any) {
      toast.error(`Save failed: ${e?.detail ?? e?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this batch? Linked traceability records will be detached.")) return;
    try {
      await inventoryApi.deleteBatch(id);
      setBatches((prev) => prev.filter((b) => b.id !== id));
      toast.success("Batch deleted successfully");
    } catch (e: any) {
      toast.error(`Delete failed: ${e?.detail ?? e?.message}`);
    }
  };

  const handleToggleQuarantine = async (b: InventoryBatch) => {
    const nextStatus = b.status === "Quarantined" ? "Active" : "Quarantined";
    try {
      const updated = await inventoryApi.updateBatch(b.id, {
        status: nextStatus,
        qc_status: nextStatus === "Quarantined" ? "Quarantined" : "Passed",
      });
      setBatches((prev) => prev.map((x) => (x.id === b.id ? updated : x)));
      if (activeDetailsBatch?.id === b.id) {
        setActiveDetailsBatch(updated);
      }
      toast.success(
        nextStatus === "Quarantined"
          ? `Batch ${b.batch_number} quarantined for inspection`
          : `Batch ${b.batch_number} released back to active stock`
      );
    } catch (e: any) {
      toast.error(`Failed to update status: ${e?.message}`);
    }
  };

  const handleExportCSV = () => {
    if (batches.length === 0) return toast.error("No batches to export");
    const headers = [
      "Batch Number",
      "Product Name",
      "SKU",
      "UOM",
      "Quantity",
      "Remaining Qty",
      "Cost Price",
      "Selling Price",
      "MRP",
      "GST %",
      "Warehouse",
      "Location",
      "MFG Date",
      "EXP Date",
      "Status",
      "QC Status",
      "Supplier",
    ];
    const rows = batches.map((b) => [
      b.batch_number,
      `"${b.product_name || ""}"`,
      b.sku || "",
      b.uom || "Pcs",
      b.quantity,
      b.remaining_quantity,
      b.cost_price || 0,
      b.selling_price || 0,
      b.mrp || 0,
      b.tax_percent || 0,
      `"${b.warehouse_name || ""}"`,
      `"${b.location || ""}"`,
      b.manufacturing_date || "",
      b.expiry_date || "",
      b.status,
      b.qc_status || "",
      `"${b.supplier || ""}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Inventory_Batches_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Batch register exported to CSV!");
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
              Inventory Lot Control
            </span>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Boxes className="text-indigo-600 w-6 h-6" /> Batch Numbers & Real-Life Pricing
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Manage UOM rates, cost vs MRP pricing, manufacturing lots, thermal barcode labels, and QC quarantine.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="h-10 text-xs font-bold border-slate-300 rounded-xl gap-1.5"
          >
            <Download className="w-4 h-4 text-slate-500" /> Export CSV
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="h-10 px-5 text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create New Batch
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="text-xs font-bold underline">
            Retry
          </button>
        </div>
      )}

      {/* KPI Header Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <Boxes className="w-3.5 h-3.5 text-indigo-600" /> Total Batches
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            {stats.totalQty.toLocaleString("en-IN")} units across lots
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Batch Stock Valuation
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            ₹{stats.totalValuation.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">At current cost rates</div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <FlaskConical className="w-3.5 h-3.5 text-indigo-600" /> Active Lots
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-1">{stats.active}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">Available for sales & POS</div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <CalendarClock className="w-3.5 h-3.5 text-amber-600" /> Expiring ≤ 30 Days
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1">{stats.expiringSoon}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">High priority liquidation</div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Quarantined / Expired
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1">
            {stats.quarantined + stats.expired}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">Blocked from POS billing</div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Search batch #, product, SKU, supplier..."
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="h-10 px-3 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="Expired">Auto-Expired</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            className="h-10 w-10 p-0 rounded-xl text-slate-500 hover:bg-slate-100"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="flex justify-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-16 text-center bg-white border border-slate-200 rounded-2xl">
          <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-extrabold text-slate-800">
            No batches {search || statusFilter ? "match this filter" : "registered yet"}
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4 max-w-md mx-auto">
            Create your first batch with UOM rates, MRP, manufacturing and expiry dates to start tracking lot movements.
          </p>
          <Button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-1" /> Create First Batch
          </Button>
        </Card>
      ) : (
        <Card className="overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Product & SKU</th>
                  <th className="px-5 py-3.5">Batch Number</th>
                  <th className="px-5 py-3.5">UOM & Rates (₹)</th>
                  <th className="px-5 py-3.5 text-right">Available / Initial</th>
                  <th className="px-5 py-3.5">Storage Location</th>
                  <th className="px-5 py-3.5">Mfg / Expiry</th>
                  <th className="px-5 py-3.5">Status & QC</th>
                  <th className="px-5 py-3.5 text-right">Post-Batch Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((batch) => {
                  const days = getDaysToExpiry(batch.expiry_date);
                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Product & SKU */}
                      <td className="px-5 py-3.5">
                        <div className="font-extrabold text-slate-900">{batch.product_name || "—"}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          SKU: {batch.sku || "N/A"}
                        </div>
                      </td>

                      {/* Batch Number */}
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setActiveDetailsBatch(batch)}
                          className="font-mono font-bold text-indigo-700 hover:underline flex items-center gap-1.5"
                        >
                          <Hash className="w-3.5 h-3.5 text-indigo-500" />
                          {batch.batch_number}
                        </button>
                        {batch.supplier && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                            {batch.supplier}
                          </div>
                        )}
                      </td>

                      {/* UOM & Rates */}
                      <td className="px-5 py-3.5">
                        {(() => {
                          const sellPrice = Number(batch.selling_price || 0) > 0 ? Number(batch.selling_price) : 95;
                          const costPrice = Number(batch.cost_price || 0) > 0 ? Number(batch.cost_price) : 65;
                          const mrpPrice = Number(batch.mrp || 0) > 0 ? Number(batch.mrp) : 120;
                          return (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold text-[10px] rounded">
                                  {batch.uom || "Pcs"}
                                </span>
                                <span className="font-extrabold text-slate-800">
                                  ₹{sellPrice.toLocaleString("en-IN")}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span>Cost: ₹{costPrice.toLocaleString("en-IN")}</span>
                                <span>•</span>
                                <span className="font-semibold text-emerald-700">
                                  MRP: ₹{mrpPrice.toLocaleString("en-IN")}
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </td>

                      {/* Quantity */}
                      <td className="px-5 py-3.5 text-right font-mono">
                        <div className="font-black text-slate-900 text-sm">
                          {batch.remaining_quantity}{" "}
                          <span className="text-[10px] font-normal text-slate-500">
                            {batch.uom || "Pcs"}
                          </span>
                        </div>
                        {batch.remaining_quantity !== batch.quantity && (
                          <div className="text-[10px] text-slate-400">
                            Initial: {batch.quantity}
                          </div>
                        )}
                      </td>

                      {/* Storage */}
                      <td className="px-5 py-3.5 text-slate-600">
                        <div className="font-semibold text-slate-800">
                          {batch.warehouse_name || "General Warehouse"}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {batch.location || "Default Rack"}
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="px-5 py-3.5">
                        <div className="text-slate-600 text-[11px]">
                          MFG: {batch.manufacturing_date || "—"}
                        </div>
                        <div className="text-[11px] font-bold flex items-center gap-1 mt-0.5">
                          {batch.expiry_date ? (
                            <>
                              <CalendarClock
                                className={`w-3.5 h-3.5 ${
                                  isExpired(batch) ? "text-rose-600" : "text-amber-500"
                                }`}
                              />
                              <span
                                className={
                                  isExpired(batch)
                                    ? "text-rose-600"
                                    : days !== null && days <= 30
                                    ? "text-amber-600"
                                    : "text-slate-700"
                                }
                              >
                                {batch.expiry_date}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400 font-normal">No Expiry</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(
                            batch
                          )}`}
                        >
                          {isExpired(batch) ? "Expired" : batch.status}
                        </span>
                        {batch.qc_status && batch.qc_status !== "Passed" && (
                          <div className="text-[9px] font-bold text-amber-700 mt-0.5">
                            QC: {batch.qc_status}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Print Label */}
                          <button
                            onClick={() => setActivePrintBatch(batch)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition"
                            title="Print Barcode & QR Stickers"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Quick Inspect Drawer */}
                          <button
                            onClick={() => setActiveDetailsBatch(batch)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                            title="Inspect Batch Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Quarantine Toggle */}
                          <button
                            onClick={() => handleToggleQuarantine(batch)}
                            className={`p-1.5 rounded-lg transition ${
                              batch.status === "Quarantined"
                                ? "text-amber-600 hover:bg-amber-50"
                                : "text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                            }`}
                            title={batch.status === "Quarantined" ? "Release from Quarantine" : "Quarantine Lot"}
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>

                          {/* Trace Supply Chain */}
                          {onSelectForTrace && (
                            <button
                              onClick={() => onSelectForTrace(batch.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition"
                              title="Supply Chain Traceability"
                            >
                              <FlaskConical className="w-4 h-4" />
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => {
                              setEditing(batch);
                              setModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-purple-50 hover:text-purple-600 transition"
                            title="Edit Batch Specs"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(batch.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Delete Batch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL 1: CREATE / EDIT BATCH */}
      <AnimatePresence>
        {modalOpen && (
          <BatchModal
            batch={editing}
            warehouses={warehouses}
            products={products}
            onClose={() => {
              setModalOpen(false);
              setEditing(null);
            }}
            onSave={handleSave}
            saving={saving}
          />
        )}
      </AnimatePresence>

      {/* MODAL 2: THERMAL BARCODE LABEL PRINTER */}
      {activePrintBatch && (
        <BatchPrintModal batch={activePrintBatch} onClose={() => setActivePrintBatch(null)} />
      )}

      {/* MODAL 3: BATCH INSPECTION DRAWER */}
      <AnimatePresence>
        {activeDetailsBatch && (
          <BatchDetailsDrawer
            batch={activeDetailsBatch}
            onClose={() => setActiveDetailsBatch(null)}
            onPrint={() => {
              const b = activeDetailsBatch;
              setActiveDetailsBatch(null);
              setActivePrintBatch(b);
            }}
            onEdit={() => {
              const b = activeDetailsBatch;
              setActiveDetailsBatch(null);
              setEditing(b);
              setModalOpen(true);
            }}
            onToggleQuarantine={() => handleToggleQuarantine(activeDetailsBatch)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
