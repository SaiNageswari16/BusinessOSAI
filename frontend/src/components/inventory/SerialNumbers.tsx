import { useState, useEffect, useMemo, useRef } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Search,
  Barcode,
  Edit2,
  Trash2,
  X,
  Loader2,
  Plus,
  Package,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Wrench,
  Printer,
  Sparkles,
  Layers,
  Calendar,
  CheckCircle2,
  Info,
  Download,
  Building,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  inventoryApi,
  type InventorySerial,
  type Warehouse,
  type InventoryProduct as Product,
} from "../../lib/api-client";
import { RealBarcodeSvg } from "../../lib/barcode-svg";
import { useCurrency } from "@/hooks/use-currency";

const STATUS_STYLES: Record<string, string> = {
  "In Stock": "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  Reserved: "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20",
  Sold: "bg-blue-500/10 text-blue-600 border border-blue-500/20",
  "In Transit": "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  Returned: "bg-violet-500/10 text-violet-600 border border-violet-500/20",
  Damaged: "bg-rose-500/10 text-rose-600 border border-rose-500/20",
  "Written-off": "bg-slate-500/10 text-slate-600 border border-slate-500/20",
};

const STATUS_OPTS = Object.keys(STATUS_STYLES);

const STATUS_ICONS: Record<string, any> = {
  "In Stock": Package,
  Reserved: ShieldCheck,
  Sold: Package,
  "In Transit": AlertTriangle,
  Returned: RotateCcw,
  Damaged: Wrench,
  "Written-off": Trash2,
};

// ─────────────────────────────────────────────────────────────
// 1. THERMAL PRINT MODAL FOR INDIVIDUAL SERIAL NUMBER STICKER
// ─────────────────────────────────────────────────────────────
function SerialPrintModal({
  serial,
  onClose,
}: {
  serial: InventorySerial;
  onClose: () => void;
}) {
  const [copies, setCopies] = useState<number>(1);
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Print Serial Barcode Label</h3>
              <p className="text-xs text-slate-500 font-mono">SN: {serial.serial_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Copies to Print
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Number(e.target.value)))}
              className="w-20 h-9 border border-slate-300 rounded-xl px-3 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Live Scannable Code-128 Serial Sticker */}
          <div
            ref={printAreaRef}
            className="border-2 border-dashed border-slate-300 bg-slate-50 p-4 rounded-2xl flex flex-col items-center justify-center"
          >
            <div className="bg-white border border-slate-300 rounded-xl p-3.5 w-full shadow-sm space-y-2 text-left">
              <div className="text-center font-black text-[11px] uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-1">
                LAZYMONKEY AI SERIAL TRACKER
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-extrabold text-xs text-slate-900 leading-tight">
                    {serial.product_name || "Serialized Item"}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    SKU: {serial.sku || "N/A"}
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {serial.status}
                </span>
              </div>

              {/* Hardware-Scannable Code-128 Barcode */}
              <div className="pt-1 pb-1 flex flex-col items-center">
                <RealBarcodeSvg
                  code={serial.serial_number}
                  width={220}
                  height={46}
                  unitPx={2}
                />
              </div>

              <div className="grid grid-cols-2 text-[9px] text-slate-600 border-t border-slate-100 pt-1.5 gap-0.5 font-medium">
                <div>
                  <span className="font-bold">LOC:</span> {serial.warehouse_name || "Main Warehouse"}
                </div>
                <div className="text-right">
                  <span className="font-bold">MFG:</span> {serial.manufacturing_date || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
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
            <Printer className="w-4 h-4" /> Print Sticker ({copies})
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. BULK SERIAL GENERATION MODAL
// ─────────────────────────────────────────────────────────────
function BulkSerialModal({
  warehouses,
  products,
  onClose,
  onBulkCreate,
  saving,
}: {
  warehouses: Warehouse[];
  products: Product[];
  onClose: () => void;
  onBulkCreate: (serials: Partial<InventorySerial>[]) => void;
  saving: boolean;
}) {
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [prefix, setPrefix] = useState(`SN-${new Date().getFullYear()}-`);
  const [startNum, setStartNum] = useState(1);
  const [quantity, setQuantity] = useState(10);
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [mfgDate, setMfgDate] = useState(new Date().toISOString().slice(0, 10));

  const onSelectProduct = (prodId: string) => {
    setProductId(prodId);
    const p = products.find((x) => x.id === prodId);
    if (p) {
      setProductName(p.name);
      setSku(p.sku);
      setPrefix(`SN-${p.sku.slice(0, 4).toUpperCase()}-`);
    }
  };

  const onSelectWarehouse = (wId: string) => {
    setWarehouseId(wId);
    const w = warehouses.find((x) => x.id === wId);
    setWarehouseName(w?.name || "");
  };

  const previewSerials = useMemo(() => {
    const list: string[] = [];
    const count = Math.min(quantity, 5);
    for (let i = 0; i < count; i++) {
      list.push(`${prefix}${String(startNum + i).padStart(4, "0")}`);
    }
    return list;
  }, [prefix, startNum, quantity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) return alert("Please select or enter a Product Name");
    if (quantity < 1 || quantity > 500) return alert("Quantity must be between 1 and 500");

    const batchList: Partial<InventorySerial>[] = [];
    for (let i = 0; i < quantity; i++) {
      const sNum = `${prefix}${String(startNum + i).padStart(4, "0")}`;
      batchList.push({
        serial_number: sNum,
        product_name: productName,
        sku: sku || "SKU-GEN",
        product_id: productId || null,
        warehouse_id: warehouseId || null,
        warehouse_name: warehouseName || "Main Warehouse",
        manufacturing_date: mfgDate || null,
        status: "In Stock",
        notes: `Bulk generated batch of ${quantity} units`,
      });
    }

    onBulkCreate(batchList);
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
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Bulk Generate Serial Numbers</h3>
              <p className="text-xs text-slate-500">
                Register up to 500 individual serialized units in 1 click.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="bulk-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Select Product Catalog Item *
            </label>
            <select
              value={productId}
              onChange={(e) => onSelectProduct(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">— Select Product from Catalog —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (SKU: {p.sku})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Serial Prefix *
              </label>
              <input
                required
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="SN-2026-"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Quantity to Generate *
              </label>
              <input
                required
                type="number"
                min={1}
                max={500}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Starting Number
              </label>
              <input
                required
                type="number"
                min={1}
                value={startNum}
                onChange={(e) => setStartNum(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Warehouse
              </label>
              <select
                value={warehouseId}
                onChange={(e) => onSelectWarehouse(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">— Select Warehouse —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sequence Preview Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Sequence Generation Preview ({quantity} Serials):
            </span>
            <div className="flex flex-wrap gap-2">
              {previewSerials.map((s, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-indigo-700 shadow-sm"
                >
                  {s}
                </span>
              ))}
              {quantity > 5 && (
                <span className="text-xs text-slate-500 self-center font-bold">
                  ... +{quantity - 5} more
                </span>
              )}
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="bulk-form"
            disabled={saving}
            className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/20 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Generate {quantity} Serials
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. SINGLE SERIAL MODAL (CREATE / EDIT)
// ─────────────────────────────────────────────────────────────
function SerialModal({
  serial,
  warehouses,
  products,
  onClose,
  onSave,
  saving,
}: {
  serial: Partial<InventorySerial> | null;
  warehouses: Warehouse[];
  products: Product[];
  onClose: () => void;
  onSave: (s: Partial<InventorySerial>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<InventorySerial>>(
    serial || {
      serial_number: `SN-${Date.now().toString().slice(-6)}`,
      product_name: "",
      sku: "",
      warehouse_name: "",
      manufacturing_date: new Date().toISOString().slice(0, 10),
      expiry_date: null,
      notes: "",
      status: "In Stock",
    }
  );
  const isEditing = !!serial?.id;
  const set = (k: keyof InventorySerial, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const onSelectProduct = (prodId: string) => {
    const p = products.find((x) => x.id === prodId);
    if (p) {
      setForm((f) => ({
        ...f,
        product_id: prodId,
        product_name: p.name,
        sku: p.sku,
      }));
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.serial_number?.trim()) return alert("Serial number is required");
    onSave(form);
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
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <h3 className="text-xl font-bold text-slate-900">
            {isEditing ? "Edit Serial Record" : "Register New Serial Number"}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="serial-form" onSubmit={submit} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Serial Number *
              </label>
              <input
                required
                type="text"
                value={form.serial_number || ""}
                onChange={(e) => set("serial_number", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="SN-2026-0001"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Product Catalog Item
              </label>
              <select
                value={form.product_id || ""}
                onChange={(e) => onSelectProduct(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">— Select Product from Catalog —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (SKU: {p.sku})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Product Display Name *
              </label>
              <input
                required
                type="text"
                value={form.product_name || ""}
                onChange={(e) => set("product_name", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Product Name"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                SKU Code
              </label>
              <input
                type="text"
                value={form.sku || ""}
                onChange={(e) => set("sku", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="SKU-1001"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Warehouse Storage
              </label>
              <select
                value={form.warehouse_id || ""}
                onChange={(e) => onSelectWarehouse(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
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
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Lifecycle Status
              </label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {STATUS_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Manufacturing Date
              </label>
              <input
                type="date"
                value={form.manufacturing_date || ""}
                onChange={(e) => set("manufacturing_date", e.target.value || null)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Warranty Expiry Date
              </label>
              <input
                type="date"
                value={form.expiry_date || ""}
                onChange={(e) => set("expiry_date", e.target.value || null)}
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Audit Notes / Warranty Specs
              </label>
              <textarea
                value={form.notes || ""}
                onChange={(e) => set("notes", e.target.value)}
                rows={2}
                placeholder="e.g. 2-Year OEM Warranty, Checked by Inspector #4"
                className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="serial-form"
            disabled={saving}
            className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-600/20 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isEditing ? "Update Serial" : "Register Serial"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. MAIN SERIAL NUMBERS MODULE
// ─────────────────────────────────────────────────────────────
export function SerialNumbers() {
    const { currency, formatCurrency } = useCurrency();
  const [serials, setSerials] = useState<InventorySerial[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<InventorySerial> | null>(null);
  const [printingSerial, setPrintingSerial] = useState<InventorySerial | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, w, p, b] = await Promise.all([
        inventoryApi.getSerials().catch(() => []),
        inventoryApi.getWarehouses().catch(() => []),
        inventoryApi.getProducts({ page_size: 300 }).catch(() => ({ results: [] } as any)),
        inventoryApi.getBatches().catch(() => []),
      ]);
      setSerials(s || []);
      setWarehouses(w || []);

      let prodList: Product[] =
        (p as any)?.results ||
        (p as any)?.data ||
        (Array.isArray(p) ? p : []);

      const existingNames = new Set(prodList.map((x) => (x.name || "").toLowerCase()));
      if (Array.isArray(b)) {
        b.forEach((item: any) => {
          if (item.product_name && !existingNames.has(item.product_name.toLowerCase())) {
            existingNames.add(item.product_name.toLowerCase());
            prodList.push({
              id: item.product_id || `prod-${item.id}`,
              name: item.product_name,
              sku: item.sku || `SKU-${item.batch_number}`,
            } as any);
          }
        });
      }
      setProducts(prodList);
    } catch (e: any) {
      setError(e?.detail ?? "Failed to load serials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return serials.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.serial_number.toLowerCase().includes(q) ||
        (s.product_name || "").toLowerCase().includes(q) ||
        (s.warehouse_name || "").toLowerCase().includes(q) ||
        (s.sku || "").toLowerCase().includes(q)
      );
    });
  }, [serials, search, statusFilter]);

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    serials.forEach((s) => {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    });
    return {
      total: serials.length,
      inStock: byStatus["In Stock"] || 0,
      sold: byStatus["Sold"] || 0,
      transit: byStatus["In Transit"] || 0,
    };
  }, [serials]);

  const handleSave = async (s: Partial<InventorySerial>) => {
    try {
      setSaving(true);
      if (s.id) {
        const updated = await inventoryApi.updateSerial(s.id, s);
        setSerials((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
      } else {
        const created = await inventoryApi.createSerial(s as Record<string, unknown>);
        setSerials((prev) => [created, ...prev]);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e: any) {
      alert(`Save failed: ${e?.detail ?? e?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkCreate = async (batchList: Partial<InventorySerial>[]) => {
    try {
      setSaving(true);
      for (const item of batchList) {
        await inventoryApi.createSerial(item as Record<string, unknown>);
      }
      setBulkModalOpen(false);
      await load();
    } catch (e: any) {
      alert(`Bulk creation failed: ${e?.detail ?? e?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this serial number?")) return;
    try {
      await inventoryApi.deleteSerial(id);
      setSerials((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      alert(`Delete failed: ${e?.detail ?? e?.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Explanation & Action Buttons */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Serial Numbers & Individual Item Tracking
          </h2>
          <p className="text-sm text-muted-foreground">
            Unique 1-to-1 identifiers for high-value items, electronics, warranties, and RMA audits.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setBulkModalOpen(true)}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <Sparkles className="size-4 mr-2" /> Bulk Generate
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="gradient-brand text-white border-0"
          >
            <Plus className="size-4 mr-2" /> New Serial
          </Button>
        </div>
      </div>

      {/* Info Banner: Batch vs Serial Explanation */}
      <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 flex items-start gap-3.5 text-xs text-indigo-950">
        <Info className="size-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold text-indigo-900 block text-sm mb-0.5">
            Module Guide: Batch Numbers vs Serial Numbers
          </strong>
          <span className="text-indigo-800">
            • <strong>Batch/Lot Number</strong>: Identifies a group of items made together (e.g. 500 bottles of Batch #173 expiring 10/2028).<br />
            • <strong>Serial Number</strong>: A unique barcode assigned to <em>one single physical unit</em> (e.g. SN-001) for warranty claims, customer invoices, and repair history.
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
          <button onClick={load} className="ml-3 underline">
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-white shadow-sm border-slate-200">
            <div className="text-[10px] uppercase font-bold text-slate-500">Total Registered Units</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-slate-200">
            <div className="text-[10px] uppercase font-bold text-slate-500">In Stock Available</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{stats.inStock}</div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-slate-200">
            <div className="text-[10px] uppercase font-bold text-slate-500">Sold to Customers</div>
            <div className="text-2xl font-black text-blue-600 mt-1">{stats.sold}</div>
          </Card>
          <Card className="p-4 bg-white shadow-sm border-slate-200">
            <div className="text-[10px] uppercase font-bold text-slate-500">In Transit / Branch Transfer</div>
            <div className="text-2xl font-black text-amber-600 mt-1">{stats.transit}</div>
          </Card>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
            placeholder="Search by serial number, product, SKU, warehouse..."
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-semibold"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={load}
            className="h-10 border-slate-200 text-slate-600"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="size-8 animate-spin text-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-slate-50/50 border-dashed border-slate-300">
          <Barcode className="size-12 mx-auto text-slate-400 mb-3" />
          <h3 className="text-lg font-bold text-slate-800">
            No serial numbers {search || statusFilter ? "match this filter" : "found"}
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Register individual item serials or bulk generate a batch.
          </p>
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => setBulkModalOpen(true)}
              className="border-indigo-300 text-indigo-700"
            >
              <Sparkles className="size-4 mr-2" /> Bulk Generate Serials
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="gradient-brand text-white border-0"
            >
              <Plus className="size-4 mr-2" /> Create Single Serial
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border border-slate-200 shadow-sm rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Serial Number</th>
                  <th className="px-5 py-3.5">Product Name & SKU</th>
                  <th className="px-5 py-3.5">Warehouse Storage</th>
                  <th className="px-5 py-3.5">Mfg Date</th>
                  <th className="px-5 py-3.5">Warranty Expiry</th>
                  <th className="px-5 py-3.5">Lifecycle Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((serial) => {
                  const Icon = STATUS_ICONS[serial.status] || Package;
                  return (
                    <tr key={serial.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-indigo-700 text-sm">
                            {serial.serial_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">
                          {serial.product_name || "Unassigned"}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          SKU: {serial.sku || "N/A"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-700">
                        {serial.warehouse_name || "Main Warehouse"}
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-slate-600">
                        {serial.manufacturing_date ? String(serial.manufacturing_date).slice(0, 10) : "—"}
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-slate-600">
                        {serial.expiry_date ? String(serial.expiry_date).slice(0, 10) : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            STATUS_STYLES[serial.status] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          <Icon className="size-3" /> {serial.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPrintingSerial(serial)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition"
                            title="Print Scannable Barcode Sticker"
                          >
                            <Printer className="size-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditing(serial);
                              setModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                            title="Edit"
                          >
                            <Edit2 className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(serial.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Delete"
                          >
                            <Trash2 className="size-4" />
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

      {/* Single Serial Modal */}
      <AnimatePresence>
        {modalOpen && (
          <SerialModal
            serial={editing}
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

      {/* Bulk Serial Generator Modal */}
      <AnimatePresence>
        {bulkModalOpen && (
          <BulkSerialModal
            warehouses={warehouses}
            products={products}
            onClose={() => setBulkModalOpen(false)}
            onBulkCreate={handleBulkCreate}
            saving={saving}
          />
        )}
      </AnimatePresence>

      {/* Thermal Print Modal */}
      <AnimatePresence>
        {printingSerial && (
          <SerialPrintModal
            serial={printingSerial}
            onClose={() => setPrintingSerial(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
