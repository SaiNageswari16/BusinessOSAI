# Complete script to update Products.tsx
import re

target_file = r"c:\Users\abhil\Desktop\businessosai\BusinessOSAI\frontend\src\components\inventory\Products.tsx"
with open(target_file, "r", encoding="utf-8") as f:
    orig = f.read()

# ==========================================
# 1. NEW LOCAL_COLUMNS, defaultFormData, ColumnMenu
# ==========================================
part1_target = orig[orig.find("const LOCAL_COLUMNS = ["):orig.find("// ══════════════════════════════════════════════════════════════════════\n//  INLINE CREATE POPOVER")]

part1_replacement = """const LOCAL_COLUMNS = [
  // 1. Identity & Core
  { id: "image", label: "Image", group: "Identity" },
  { id: "name", label: "Item Name", group: "Identity" },
  { id: "unique_item_name", label: "Unique Item Name", group: "Identity" },
  { id: "sku", label: "SKU", group: "Identity" },
  { id: "barcode", label: "BarCode", group: "Identity" },
  { id: "secondary_barcode", label: "Secondary BarCode (BarCode.1)", group: "Identity" },
  { id: "item_code", label: "Item CODE", group: "Identity" },
  { id: "category", label: "Category", group: "Identity" },
  { id: "sub_category", label: "Sub Category", group: "Identity" },
  { id: "brand", label: "Brand", group: "Identity" },
  { id: "uom", label: "Unit (UOM)", group: "Identity" },
  { id: "sales_measuring_unit", label: "Sales Measuring Unit", group: "Identity" },
  { id: "purchase_measuring_unit", label: "Purchase Measuring Unit", group: "Identity" },

  // 2. Asian Paints & Colorant
  { id: "base_name", label: "Base Code/Name (Col C)", group: "Asian Paints" },
  { id: "product_base_code", label: "Product Base Code (Col D)", group: "Asian Paints" },
  { id: "size_l_kg", label: "Size (L/Kg) (Col E)", group: "Asian Paints" },

  // 3. Pricing & Tax
  { id: "mrp", label: "MRP", group: "Pricing" },
  { id: "selling_price", label: "Sales Price (Before Tax)", group: "Pricing" },
  { id: "sales_tax_type", label: "Sales Tax Mode", group: "Pricing" },
  { id: "sales_tax_name", label: "Sales Tax Name", group: "Pricing" },
  { id: "tax_percent", label: "Sales Tax (%)", group: "Pricing" },
  { id: "sales_price_after_tax", label: "Sales Price After Tax", group: "Pricing" },
  { id: "discount_limit", label: "Disc1(%)", group: "Pricing" },
  { id: "discount_amount", label: "Disc1(Rs)", group: "Pricing" },
  { id: "wholesale_price", label: "Wholesale Price", group: "Pricing" },
  { id: "min_wholesale_qty", label: "Min Wholesale Qty", group: "Pricing" },
  { id: "b2b_price", label: "B2B Price", group: "Pricing" },
  { id: "min_b2b_qty", label: "Min B2B Qty", group: "Pricing" },
  { id: "distributor_price", label: "Distributor Price", group: "Pricing" },
  { id: "min_distributor_qty", label: "Min Distributor Qty", group: "Pricing" },
  { id: "hsn_code", label: "HSN Code", group: "Pricing" },

  // 4. Purchasing & Supplier
  { id: "purchase_price", label: "Purchase Price", group: "Purchasing" },
  { id: "purchase_tax_type", label: "Purchase Tax Mode", group: "Purchasing" },
  { id: "purchase_tax_name", label: "Purchase Tax Name", group: "Purchasing" },
  { id: "purchase_tax_percent", label: "Purchase Tax (%)", group: "Purchasing" },
  { id: "purchase_price_after_tax", label: "Purchase Price After Tax", group: "Purchasing" },
  { id: "supplier", label: "Supplier Name", group: "Purchasing" },
  { id: "preferred_supplier", label: "Preferred Supplier", group: "Purchasing" },
  { id: "supplier_invoice_number", label: "Supplier Invoice #", group: "Purchasing" },
  { id: "supplier_invoice_date", label: "Supplier Invoice Date", group: "Purchasing" },
  { id: "item_received_date", label: "Item Received Date", group: "Purchasing" },

  // 5. Inventory & Warehouse & Batches
  { id: "initial_stock", label: "Opening Stock", group: "Inventory" },
  { id: "stock", label: "Current Stock", group: "Inventory" },
  { id: "reorder_level", label: "Stock Alert", group: "Inventory" },
  { id: "safety_stock", label: "Safety Stock", group: "Inventory" },
  { id: "mfg_date", label: "Manufacturing Date", group: "Inventory" },
  { id: "expiry_date", label: "Expiry Date", group: "Inventory" },
  { id: "warehouse", label: "Warehouse Name", group: "Inventory" },
  { id: "location_in_warehouse", label: "Location in Warehouse", group: "Inventory" },
  { id: "has_manual_batch", label: "Has Manual Batch", group: "Inventory" },
  { id: "stock_batch_number", label: "Stock Batch #", group: "Inventory" },
  { id: "stock_batch_expiry_date", label: "Stock Batch Expiry", group: "Inventory" },
  { id: "opening_stock_batch_number", label: "Opening Stock Batch #", group: "Inventory" },
  { id: "opening_stock_batch_expiry_date", label: "Opening Stock Batch Expiry", group: "Inventory" },

  // 6. Flags & Operations
  { id: "status", label: "Is Active / Status", group: "Operations" },
  { id: "has_label", label: "Has Label", group: "Operations" },
  { id: "label_headings", label: "Label Headings", group: "Operations" },
  { id: "need_to_print_barcode_sticker", label: "Print Barcode Sticker", group: "Operations" },
  { id: "is_service_item", label: "Is Service Item", group: "Operations" },
  { id: "not_for_sale", label: "Not For Sale", group: "Operations" },
  { id: "only_for_portal", label: "Only For Portal", group: "Operations" },
  { id: "not_for_portal", label: "Not For Portal", group: "Operations" },
  { id: "conversion_factor", label: "Conversion Factor", group: "Operations" },
  { id: "weighing_scale_code", label: "Weighing Scale Code", group: "Operations" },
  { id: "display_index", label: "Display Index", group: "Operations" },
  { id: "keywords", label: "Keywords", group: "Operations" },
  { id: "accessories_keyword", label: "Accessories Keyword", group: "Operations" },
  { id: "short_description", label: "Description", group: "Details" },
  { id: "description_html", label: "Description HTML", group: "Details" },
  { id: "source", label: "Source", group: "Details" },
];

const MASTER_COLUMNS = [
  { id: "image", label: "Image" },
  { id: "name", label: "Product Name" },
  { id: "sku", label: "SKU" },
  { id: "barcode", label: "Barcode" },
  { id: "base_name", label: "Base Code/Name" },
  { id: "product_base_code", label: "Product Base Code" },
  { id: "size_l_kg", label: "Size (L/Kg)" },
  { id: "category", label: "Category" },
  { id: "brand", label: "Brand" },
  { id: "mrp", label: "MRP" },
  { id: "selling_price", label: "Retail Price" },
  { id: "wholesale_price", label: "Wholesale Price" },
  { id: "b2b_price", label: "B2B Price" },
  { id: "specifications", label: "Specifications" },
  { id: "source", label: "Source" },
];

// ── Helpers ──────────────────────────────────────────────────────────
const esc = (v: any) => {
  if (v == null) return '""';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\\n') ? `"${s.replace(/"/g, '""')}"` : s;
};

const defaultFormData = () => ({
  // 1. Basic & Identification
  name: "",
  unique_item_name: "",
  brand: "",
  brand_id: "",
  sku: "",
  barcode: "",
  secondary_barcode: "",
  category_id: "",
  sub_category: "",
  item_code: "",
  uom_id: "",
  display_index: "" as any,
  image_url: "",
  category_image: "",

  // Asian Paints & Hardware Specific
  base_name: "",
  product_base_code: "",
  size_l_kg: "",

  // 2. Pricing, Tax & Tiers
  selling_price: "" as any,
  is_tax_inclusive: true,
  sales_tax_name: "GST",
  tax_percent: 0,
  sales_price_after_tax: "" as any,
  mrp: "" as any,
  discount_limit: "" as any, // Disc1(%)
  discount_amount: "" as any, // Disc1(Rs)
  sales_measuring_unit: "",
  hsn_code: "",

  // Multi-tier rates
  wholesale_price: "" as any,
  min_wholesale_qty: "" as any,
  wholesale_is_tax_inclusive: true,

  b2b_price: "" as any,
  min_b2b_qty: "" as any,
  b2b_is_tax_inclusive: true,

  distributor_price: "" as any,
  min_distributor_qty: "" as any,
  distributor_is_tax_inclusive: true,

  // 3. Purchase & Sourcing
  purchase_price: "" as any,
  is_purchase_tax_inclusive: true,
  purchase_tax_name: "GST",
  purchase_tax_percent: 0,
  purchase_price_after_tax: "" as any,
  purchase_measuring_unit: "",
  supplier: "",
  preferred_supplier: "",
  supplier_invoice_number: "",
  supplier_invoice_date: "",
  item_received_date: "",

  // 4. Stock, Warehouse & Batch Management
  initial_stock: "" as any, // Opening Stock
  stock: "" as any, // Current Stock
  reorder_level: "" as any, // Stock Alert
  safety_stock: "" as any,
  warehouse: "",
  location_in_warehouse: "",
  mfg_date: "",
  expiry_date: "",
  has_manual_batch: false,
  stock_batch_number: "",
  stock_batch_expiry_date: "",
  opening_stock_batch_number: "",
  opening_stock_batch_expiry_date: "",

  // 5. Flags & Portal Operations
  status: "active",
  is_service_item: false,
  not_for_sale: false,
  only_for_portal: false,
  not_for_portal: false,
  has_label: true,
  label_headings: "",
  need_to_print_barcode_sticker: true,
  weighing_scale_code: "",
  conversion_factor: "1",
  keywords: "",
  accessories_keyword: "",

  // 6. Descriptions & Custom Specs
  short_description: "",
  long_description: "",
  description_html: "",
  custom_fields: [] as Array<{ key: string; value: string }>
});

const localVisibleDefault = [
  "image", "name", "sku", "barcode", "base_name", "product_base_code", "size_l_kg",
  "category", "brand", "mrp", "selling_price", "wholesale_price", "b2b_price",
  "min_wholesale_qty", "tax_percent", "initial_stock", "status"
];
const masterVisibleDefault = ["image", "name", "sku", "barcode", "base_name", "product_base_code", "size_l_kg", "category", "brand", "mrp", "selling_price", "source"];

// ── Column menu sub-component with Search & Instant Presets ───────────
function ColumnMenu({
  columns, visible, onToggle, onToggleAll, onSave, onReset, onClose, onApplyPreset
}: {
  columns: typeof LOCAL_COLUMNS;
  visible: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
  onApplyPreset?: (cols: string[]) => void;
}) {
  const [searchCol, setSearchCol] = useState("");

  const filteredColumns = useMemo(() => {
    if (!searchCol.trim()) return columns;
    const q = searchCol.toLowerCase();
    return columns.filter(c => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || ((c as any).group || "").toLowerCase().includes(q));
  }, [columns, searchCol]);

  const presets = [
    { label: "Default", ids: localVisibleDefault },
    { label: "All 65 Excel Cols", ids: columns.map(c => c.id) },
    { label: "Pricing & GST", ids: ["image", "name", "mrp", "selling_price", "sales_tax_type", "sales_tax_name", "tax_percent", "sales_price_after_tax", "discount_limit", "discount_amount", "wholesale_price", "b2b_price", "distributor_price", "hsn_code"] },
    { label: "Purchasing", ids: ["image", "name", "purchase_price", "purchase_tax_type", "purchase_tax_name", "purchase_tax_percent", "purchase_price_after_tax", "supplier", "preferred_supplier", "supplier_invoice_number", "item_received_date"] },
    { label: "Stock & Batch", ids: ["image", "name", "initial_stock", "stock", "reorder_level", "safety_stock", "warehouse", "location_in_warehouse", "mfg_date", "expiry_date", "has_manual_batch", "stock_batch_number", "stock_batch_expiry_date"] },
    { label: "Asian Paints", ids: ["image", "name", "base_name", "product_base_code", "size_l_kg", "category", "sub_category", "brand", "mrp", "selling_price"] },
  ];

  return (
    <div className="absolute right-0 mt-2 w-84 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3.5 flex flex-col max-h-[500px]">
      <div className="flex items-center justify-between border-b pb-2 shrink-0">
        <div>
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">Columns Customizer</span>
          <span className="text-[10px] text-slate-500 font-semibold">{visible.length} of {columns.length} columns active</span>
        </div>
        <button
          type="button"
          onClick={onToggleAll}
          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase cursor-pointer"
        >
          {visible.length === columns.length ? "Deselect All" : "Select All"}
        </button>
      </div>

      {/* Preset Quick Selectors */}
      <div className="py-2 border-b shrink-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Quick Presets:</span>
        <div className="flex flex-wrap gap-1">
          {presets.map(pr => (
            <button
              key={pr.label}
              type="button"
              onClick={() => onApplyPreset ? onApplyPreset(pr.ids) : pr.ids.forEach(id => { if (!visible.includes(id)) onToggle(id); })}
              className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 transition-colors cursor-pointer"
            >
              {pr.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search columns */}
      <div className="pt-2 shrink-0">
        <input
          type="text"
          placeholder="Filter columns (e.g. price, batch, gst, paint)..."
          value={searchCol}
          onChange={(e) => setSearchCol(e.target.value)}
          className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Column Checkboxes */}
      <div className="divide-y divide-slate-100 overflow-y-auto my-2 py-1 pr-1 flex-1 max-h-64">
        {filteredColumns.map(col => (
          <label key={col.id} className="flex items-center justify-between gap-2.5 py-1.5 px-1 hover:bg-slate-50 rounded cursor-pointer text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={visible.includes(col.id)}
                onChange={() => onToggle(col.id)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 size-3.5 cursor-pointer"
              />
              {col.label}
            </span>
            {(col as any).group && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                {(col as any).group}
              </span>
            )}
          </label>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t mt-auto shrink-0">
        <Button size="sm" onClick={onSave} className="flex-1 text-[11px] h-8 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg border-0 shadow-sm">
          Save View Preset
        </Button>
        <Button size="sm" variant="outline" onClick={onReset} className="flex-1 text-[11px] h-8 font-bold rounded-lg text-slate-700 hover:bg-slate-50">
          Reset Default
        </Button>
      </div>
    </div>
  );
}

"""

new_text = orig.replace(part1_target, part1_replacement)
print("Part 1 replaced successfully, delta:", len(new_text) - len(orig))
