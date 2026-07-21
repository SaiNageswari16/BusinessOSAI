import { useState, useEffect, useRef } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Package, Edit2, MoreHorizontal, Download, Upload, Copy, Archive, X } from "lucide-react";
import { inventoryApi, InventoryProduct, InventoryCategory, type Warehouse } from "../../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export function Products() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "", brand: "", sku: "", barcode: "", category_id: "",
    uom_id: "", warehouse: "", supplier: "",
    purchase_price: 0, mrp: 0, selling_price: 0, tax_percent: 0,
    discount_limit: 0, initial_stock: 0, reorder_level: 0, safety_stock: 0,
    image_url: "", short_description: "", long_description: "",
    status: "active"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultFormData = {
    name: "", brand: "", sku: "", barcode: "", category_id: "",
    uom_id: "", warehouse: "", supplier: "",
    purchase_price: 0, mrp: 0, selling_price: 0, tax_percent: 0,
    discount_limit: 0, initial_stock: 0, reorder_level: 0, safety_stock: 0,
    image_url: "", short_description: "", long_description: "", status: "active"
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodsRes, catsRes, uomsRes, whsRes] = await Promise.all([
        inventoryApi.getProducts(),
        inventoryApi.getCategories(),
        inventoryApi.getUOMs(),
        inventoryApi.getWarehouses()
      ]);
      setProducts(prodsRes.items || []);
      setCategories(catsRes.items || []);
      setUoms(uomsRes.items || []);
      setWarehouses(whsRes || []);
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Ensure category_id is null if empty string
      const payload = {
        ...formData,
        category_id: formData.category_id || null
      };

      if (editingProductId) {
        await inventoryApi.updateProduct(editingProductId, payload);
      } else {
        await inventoryApi.createProduct(payload);
      }

      setIsModalOpen(false);
      setEditingProductId(null);
      // Reset form
      setFormData(defaultFormData);
      // Reload products
      await loadData();
    } catch (error) {
      console.error("Failed to save product:", error);
      alert("Failed to save product. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (product: any) => {
    setFormData({
      name: product.name, brand: product.brand || "", sku: product.sku || "",
      barcode: product.barcode || "", category_id: product.category_id || "",
      uom_id: product.uom_id || "", warehouse: product.warehouse || "", supplier: product.supplier || "",
      purchase_price: product.purchase_price || 0, mrp: product.mrp || 0,
      selling_price: product.selling_price || 0, tax_percent: product.tax_percent || 0,
      discount_limit: product.discount_limit || 0, initial_stock: product.initial_stock || 0,
      reorder_level: product.reorder_level || 0, safety_stock: product.safety_stock || 0,
      image_url: product.image_url || "", short_description: product.short_description || "",
      long_description: product.long_description || "",
      status: product.status || "active"
    });
    setEditingProductId(product.id);
    setIsModalOpen(true);
  };

  const handleDuplicate = (product: any) => {
    setFormData({
      name: product.name + " (Copy)", brand: product.brand || "", sku: (product.sku || "") + "-COPY",
      barcode: "", category_id: product.category_id || "",
      uom_id: product.uom_id || "", warehouse: product.warehouse || "", supplier: product.supplier || "",
      purchase_price: product.purchase_price || 0, mrp: product.mrp || 0,
      selling_price: product.selling_price || 0, tax_percent: product.tax_percent || 0,
      discount_limit: product.discount_limit || 0, initial_stock: product.initial_stock || 0,
      reorder_level: product.reorder_level || 0, safety_stock: product.safety_stock || 0,
      image_url: product.image_url || "", short_description: product.short_description || "",
      long_description: product.long_description || "",
      status: product.status || "active"
    });
    setEditingProductId(null); // It's a new product
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await inventoryApi.deleteProduct(id);
      await loadData();
    } catch (err: any) {
      alert("Failed to delete product: " + (err.detail || err.message));
    }
  };

  const openCreateModal = () => {
    setFormData(defaultFormData);
    setEditingProductId(null);
    setIsModalOpen(true);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val || 0);

  const handleExport = () => {
    if (filtered.length === 0) return alert("No products to export.");

    const headers = [
      "name", "brand", "sku", "barcode", "description",
      "purchase_price", "mrp", "selling_price", "tax_percent",
      "discount_limit", "initial_stock", "reorder_level", "status"
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.join(","),
      ...filtered.map(p => headers.map(h => escapeCsv((p as any)[h])).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `products_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    const processData = async (rows: any[]) => {
      try {
        if (!rows || rows.length === 0) {
          throw new Error("File is empty or invalid format.");
        }

        const items = rows.map((row: any) => {
          const getVal = (keys: string[]) => {
            for (const k of keys) {
              if (row[k] !== undefined && row[k] !== null) return String(row[k]).trim();
            }
            return "";
          };

          const isActiveRaw = getVal(["is_active", "Active", "Status"]);
          const isActive = isActiveRaw === "" ? true : (isActiveRaw.toLowerCase() === 'true' || isActiveRaw === '1' || isActiveRaw.toLowerCase() === 'active');

          return {
            name: getVal(["Product Name", "name", "ProductName", "Product_Name"]) || "Unnamed",
            sku: getVal(["SKU", "sku"]) || "",
            barcode: getVal(["Barcode (EAN/UPC)", "barcode", "Barcode", "EAN", "UPC"]) || "",
            short_description: getVal(["Description", "description"]) || "",
            
            // Pricing & Stock fields
            purchase_price: parseFloat(getVal(["Purchase Price", "purchase_price", "PurchasePrice", "Cost Price"])) || 0,
            mrp: parseFloat(getVal(["MRP", "mrp"])) || 0,
            selling_price: parseFloat(getVal(["Selling Price", "selling_price", "SellingPrice", "Base Price"])) || 0,
            tax_percent: parseFloat(getVal(["Tax (%)", "tax_percent", "Tax"])) || 0,
            discount_limit: parseFloat(getVal(["Discount Limit (%)", "discount_limit", "Discount Limit"])) || 0,
            initial_stock: parseInt(getVal(["Quantity", "quantity", "stock", "initial_stock", "Stock"]), 10) || 0,
            reorder_level: parseInt(getVal(["Reorder Level", "reorder_level", "ReorderLevel"]), 10) || 10,
            
            status: isActive ? "active" : "inactive",
            
            // Master importer specific fields
            brand_name: getVal(["Brand", "brand", "Brand Name"]),
            category_name: getVal(["Category", "category", "Category Name"]),
            sub_category_name: getVal(["Sub Category", "sub_category", "Sub Category Name"]),
            uom_name: getVal(["UOM", "uom", "Unit", "unit", "Unit of Measure", "Unit of Measure (UoM)"]),
          };
        });

        const res = await inventoryApi.masterImportProducts(items);
        alert(`Master Import Complete!\n\nProducts Created: ${res.products_created}\nBrands Created: ${res.brands_created}\nCategories Created: ${res.categories_created}\nUOMs Created: ${res.uoms_created}\nDuplicates Skipped: ${res.skipped_count}`);
        await loadData();
      } catch (error: any) {
        console.error("Import failed:", error);
        alert("Import failed: " + (error.detail || error.message || "Unknown error"));
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    if (file.name.endsWith(".csv")) {
      const rawText = await file.text();
      const text = rawText.replace(/^\uFEFF/, '');
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processData(results.data),
        error: (err: any) => {
          setIsImporting(false);
          alert("Failed to parse CSV: " + err.message);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      });
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
          processData(data);
        } catch (error: any) {
          setIsImporting(false);
          alert("Failed to parse Excel file: " + error.message);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setIsImporting(false);
      alert("Unsupported file format. Please upload a .csv or .xlsx file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-sm text-muted-foreground">Manage your master product catalog, SKUs, and stock rules.</p>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" ref={fileInputRef} onChange={handleImport} className="hidden" />
          <Button variant="outline" className="hidden lg:flex" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <Upload className="size-4 mr-2" />
            {isImporting ? "Importing..." : "Import File"}
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="size-4 mr-2" /> Export
          </Button>
          <Button onClick={openCreateModal} className="gradient-brand text-white border-0"><Plus className="size-4 mr-2" /> Create Product</Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30"
            placeholder="Search by name, SKU, or Barcode..."
          />
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Product Details</th>
                <th className="px-6 py-4">SKU / Barcode</th>
                <th className="px-6 py-4">Category & Brand</th>
                <th className="px-6 py-4">Price (MRP)</th>
                <th className="px-6 py-4">Stock Availability</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Loading products...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No products found.</td>
                </tr>
              ) : filtered.map((product) => (
                <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="size-10 rounded-lg object-cover border bg-white" />
                      ) : (
                        <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="size-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="font-bold">{product.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-mono font-bold text-xs">{product.sku || '-'}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{product.barcode || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-xs">{product.category_name || '-'}</div>
                    <div className="text-xs text-muted-foreground">{product.brand_name || '-'}</div>
                  </td>
                  <td className="px-6 py-4 font-bold">{formatCurrency(product.mrp)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-muted rounded-full h-1.5 max-w-[80px]">
                        <div className={`h-1.5 rounded-full ${(product.stock ?? product.initial_stock) <= product.reorder_level ? 'bg-rose-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, ((product.stock ?? product.initial_stock) / (product.reorder_level > 0 ? product.reorder_level * 3 : 100)) * 100)}%` }}></div>
                      </div>
                      <span className="font-bold">{product.stock ?? product.initial_stock}</span>
                    </div>
                    {(product.stock ?? product.initial_stock) <= product.reorder_level && <div className="text-[10px] text-rose-500 font-bold mt-1">Low Stock!</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${product.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                      }`}>
                      <span className={`size-1.5 rounded-full ${product.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {product.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleDuplicate(product)}><Copy className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleDelete(product.id)}><Archive className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEdit(product)}><Edit2 className="size-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE PRODUCT MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

              <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-600" />
                  {editingProductId ? "Edit Product" : "Create New Product"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                <form id="create-product-form" onSubmit={handleSubmit} className="space-y-6">

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Product Name *</label>
                      <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" placeholder="e.g. Wireless Noise-Cancelling Headphones" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SKU</label>
                      <input type="text" name="sku" value={formData.sku} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-mono" placeholder="e.g. SONY-WH-1000XM4" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Barcode (EAN/UPC)</label>
                      <input type="text" name="barcode" value={formData.barcode} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-mono" placeholder="e.g. 888462000000" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                      <select name="category_id" value={formData.category_id} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm bg-white">
                        <option value="">Select Category...</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Brand</label>
                      <input type="text" name="brand" value={formData.brand} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" placeholder="e.g. Sony" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Unit</label>
                      <input type="text" name="unit" value={formData.unit} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" placeholder="e.g. Box, Kg, Pcs" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Product Image URL</label>
                      <input type="url" name="image_url" value={formData.image_url} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" placeholder="https://..." />
                    </div>
                  </div>

                  <hr className="border-slate-100" />
                  <h4 className="text-sm font-bold text-slate-900">Pricing & Tax</h4>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Purchase Price</label>
                      <input type="number" min="0" step="0.01" name="purchase_price" value={formData.purchase_price} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">MRP</label>
                      <input required type="number" min="0" step="0.01" name="mrp" value={formData.mrp} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Selling Price *</label>
                      <input required type="number" min="0" step="0.01" name="selling_price" value={formData.selling_price} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm font-bold text-emerald-600 bg-emerald-50/50" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tax (%)</label>
                      <input type="number" min="0" max="100" step="0.1" name="tax_percent" value={formData.tax_percent} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Discount Limit (%)</label>
                      <input type="number" min="0" step="0.01" name="discount_limit" value={formData.discount_limit} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" />
                    </div>
                  </div>

                  <hr className="border-slate-100" />
                  <h4 className="text-sm font-bold text-slate-900">Inventory & Supply Chain</h4>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Warehouse</label>
                      <select name="warehouse" value={formData.warehouse} onChange={handleInputChange}
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm bg-white">
                        <option value="">Select Warehouse...</option>
                        {warehouses.map(wh => (
                          <option key={wh.id} value={wh.name}>{wh.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Supplier</label>
                      <input type="text" name="supplier" value={formData.supplier} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" placeholder="e.g. Supplier XYZ" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Initial Stock</label>
                      <input type="number" min="0" name="initial_stock" value={formData.initial_stock} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reorder Level</label>
                      <input type="number" min="0" name="reorder_level" value={formData.reorder_level} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Safety Stock</label>
                      <input type="number" min="0" name="safety_stock" value={formData.safety_stock} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" />
                    </div>
                  </div>

                  <hr className="border-slate-100" />
                  <h4 className="text-sm font-bold text-slate-900">Descriptions</h4>

                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Short Description</label>
                    <textarea name="short_description" value={formData.short_description} onChange={handleInputChange} rows={2} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" placeholder="Brief summary..."></textarea>
                  </div>
                  
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Long Description</label>
                    <textarea name="long_description" value={formData.long_description} onChange={handleInputChange} rows={4} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm" placeholder="Detailed product specifications..."></textarea>
                  </div>

                  <div className="flex items-center gap-3">
                    <input type="checkbox" name="status" id="status" checked={formData.status === 'active'} onChange={(e) => setFormData(prev => ({...prev, status: e.target.checked ? 'active' : 'inactive'}))} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                    <label htmlFor="status" className="text-sm font-medium text-slate-700">Active (Available for Sale)</label>
                  </div>

                </form>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                <button type="submit" form="create-product-form" disabled={isSubmitting} className="px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm shadow-indigo-600/20 transition-all flex items-center gap-2">
                  {isSubmitting ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Saving...</>
                  ) : (
                    'Save Product'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
