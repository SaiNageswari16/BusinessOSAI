import { useState, useEffect, useRef } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Filter, Plus, Package, Edit2, MoreHorizontal, Download, Upload, Copy, Archive, X, Sparkles, Globe, Loader2, Sliders } from "lucide-react";
import { inventoryApi, InventoryProduct, InventoryCategory, type Warehouse, resolveImageUrl } from "../../lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { MasterCatalogModal } from "./MasterCatalogModal";
import { toast } from "sonner";

const ALL_COLUMNS = [
  { id: "image", label: "Image" },
  { id: "name", label: "Product Name" },
  { id: "sku", label: "SKU" },
  { id: "barcode", label: "Barcode" },
  { id: "category", label: "Category" },
  { id: "brand", label: "Brand" },
  { id: "uom", label: "Unit (UOM)" },
  { id: "purchase_price", label: "Purchase Price" },
  { id: "mrp", label: "MRP" },
  { id: "selling_price", label: "Selling Price" },
  { id: "tax_percent", label: "Tax (%)" },
  { id: "discount_limit", label: "Discount Limit (%)" },
  { id: "initial_stock", label: "Initial Stock" },
  { id: "reorder_level", label: "Reorder Level" },
  { id: "safety_stock", label: "Safety Stock" },
  { id: "supplier", label: "Supplier" },
  { id: "warehouse", label: "Warehouse" },
  { id: "status", label: "Status" },
  
  // Extra columns from Master Catalog / AI search
  { id: "hsn_code", label: "HSN Code" },
  { id: "plu_no", label: "PLU No" },
  { id: "cost_price", label: "Cost Price" },
  { id: "sale_price", label: "Sale Price" },
  { id: "wholesale_price", label: "Wholesale Price" },
  { id: "special_price", label: "Special Price" },
  { id: "online_price", label: "Online Price" },
  { id: "weight", label: "Weight" },
  { id: "cess", label: "Cess (%)" },
  { id: "cess_on", label: "Cess On" },
  { id: "cess_type", label: "Cess Type" },
  { id: "tax_amount", label: "Tax Amount" },
  { id: "taxable_value", label: "Taxable Value" },
  { id: "cess_tax_amount", label: "Cess Tax Amt" },
  { id: "additional_cess_tax_amount", label: "Add. Cess Tax Amt" },
  { id: "discount_rs", label: "Discount (Rs)" },
  { id: "discount_percent", label: "Discount (%)" },
  { id: "actual_margin_rs", label: "Margin (Rs)" },
  { id: "margin_on_cp", label: "Margin on CP (%)" },
  { id: "margin_on_sp", label: "Margin on SP (%)" },
  { id: "short_description", label: "Short Description" },
  { id: "specifications", label: "Specifications" },
  { id: "source", label: "Source" }
];

export function Products() {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem("products_visible_columns");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return ["image", "name", "sku", "barcode", "category", "brand", "mrp", "initial_stock", "status"];
  });

  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isMasterCatalogOpen, setIsMasterCatalogOpen] = useState(false);
  const [masterResults, setMasterResults] = useState<any[]>([]);
  const [isSearchingMaster, setIsSearchingMaster] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [aiPaused, setAiPaused] = useState(false);

  const checkAiStatus = async () => {
    try {
      const res = await inventoryApi.getRAGEnrichmentStatus();
      setAiPaused(!!res.paused);
    } catch (e) {
      console.error("Failed to fetch RAG status:", e);
    }
  };

  useEffect(() => {
    checkAiStatus();
  }, []);

  const handleToggleAi = async () => {
    try {
      if (aiPaused) {
        await inventoryApi.resumeRAGEnrichment();
        toast.success("AI Search resumed (enabled)!");
        setAiPaused(false);
      } else {
        await inventoryApi.pauseRAGEnrichment();
        toast.success("AI Search paused (disabled)!");
        setAiPaused(true);
      }
    } catch (e) {
      toast.error("Failed to toggle AI search status.");
    }
  };

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search to query fast suggestions & local master catalog (NO automatic slow web search)
  useEffect(() => {
    const cleanSearch = search.trim();
    const isBarcode = /^\d{8,14}$/.test(cleanSearch);
    
    if (cleanSearch.length < 3 && !isBarcode) {
      setSuggestions([]);
      setMasterResults([]);
      setSearchError(null);
      return;
    }
    
    const timer = setTimeout(async () => {
      // 1. Fetch suggestions in background
      try {
        const sugs = await inventoryApi.getSearchSuggestions(cleanSearch);
        setSuggestions(sugs || []);
      } catch (err) {
        console.error("Suggestions fetch failed:", err);
      }

      // 2. Fetch local database matches instantly (searchWeb = false)
      setIsSearchingMaster(true);
      setSearchError(null);
      try {
        const res = await inventoryApi.searchMasterCatalog(cleanSearch, false, "auto");
        setMasterResults(res || []);
        
        // Automatic AI Web Sourcing Fallback for Barcodes!
        if (isBarcode && (!res || res.length === 0) && !aiPaused) {
          toast.info(`Barcode not found in local catalog. Sourcing details for barcode "${cleanSearch}" using AI...`);
          const aiRes = await inventoryApi.searchMasterCatalog(cleanSearch, true, "auto");
          setMasterResults(aiRes || []);
          if (aiRes && aiRes.length > 0) {
            toast.success(`Successfully sourced details for barcode "${cleanSearch}"!`);
          } else {
            toast.error(`Could not source details for barcode "${cleanSearch}".`);
          }
        }
      } catch (err: any) {
        console.error("Local master search failed:", err);
        setSearchError(err.detail || err.message || "Failed to search local master catalog.");
      } finally {
        setIsSearchingMaster(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search, aiPaused]);

  // Execute full targeted AI web search when user selects a suggestion
  const handleSelectSuggestion = async (sug: string) => {
    setSearch(sug);
    setShowSuggestions(false);
    setIsSearchingMaster(true);
    setSearchError(null);
    setMasterResults([]);
    try {
      if (aiPaused) {
        toast.info(`AI Search is paused. Searching local master database for "${sug}"...`);
        const res = await inventoryApi.searchMasterCatalog(sug, false, "auto");
        setMasterResults(res || []);
        return;
      }
      toast.info(`Sourcing specifications for "${sug}" using AI...`);
      // Call searchMasterCatalog with searchWeb = true
      const res = await inventoryApi.searchMasterCatalog(sug, true, "auto");
      setMasterResults(res || []);
      if (res && res.length > 0) {
        toast.success(`Successfully sourced specifications for "${sug}"!`);
      } else {
        toast.error("No specs found for this product.");
      }
    } catch (err: any) {
      console.error("AI Sourcing failed:", err);
      setSearchError(err.detail || err.message || "AI Sourcing failed.");
      toast.error("AI Sourcing failed. Check logs.");
    } finally {
      setIsSearchingMaster(false);
    }
  };

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
      // Ensure category_id and uom_id are null if empty string
      const payload = {
        ...formData,
        category_id: formData.category_id || null,
        uom_id: formData.uom_id || null
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
      toast.success(editingProductId ? "Product updated successfully!" : "Product created successfully!");
    } catch (error) {
      console.error("Failed to save product:", error);
      toast.error("Failed to save product. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (product: any) => {
    setFormData({
      name: product.name, brand: product.brand_name || "", sku: product.sku || "",
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
      name: product.name + " (Copy)", brand: product.brand_name || "", sku: (product.sku || "") + "-COPY",
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
      toast.success("Product deleted successfully!");
      await loadData();
    } catch (err: any) {
      toast.error("Failed to delete product: " + (err.detail || err.message));
    }
  };

  const handleImportToLocal = async (item: any) => {
    try {
      setIsLoading(true);
      await inventoryApi.importToLocalInventory({
        name: item.name,
        sku: item.sku_code || `SKU-${item.barcode || Math.random().toString(36).substr(2, 9)}`,
        barcode: item.barcode || "",
        brand_name: item.brand_name || item.brand || "General",
        category_name: item.category_name || item.category || "General",
        sub_category_name: item.sub_category_name || item.sub_category || "General",
        short_description: item.short_description || "",
        specifications: item.specifications || "",
        image_url: item.image_url || "",
        purchase_price: item.purchase_price || item.cost_price || 0.0,
        mrp: item.mrp || 0.0,
        selling_price: item.selling_price || item.sale_price || item.mrp || 0.0,
        tax_percent: item.tax || 18.0,
        initial_stock: 10,
        supplier: item.supplier || "Global Sourced",
        warehouse: warehouses[0]?.name || "Main Warehouse"
      });
      toast.success(`Successfully imported "${item.name}" to your local inventory!`);
      await loadData();
    } catch (error: any) {
      console.error("Failed to import product:", error);
      toast.error("Failed to import product: " + (error.detail || error.message || "Unknown error"));
    } finally {
      setIsLoading(false);
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
        complete: (results: any) => processData(results.data),
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

  const localBarcodes = new Set(products.map(p => p.barcode).filter(Boolean));
  const localNames = new Set(products.map(p => p.name.toLowerCase()));
  const uniqueMasterResults = masterResults.filter(m => 
    (!m.barcode || !localBarcodes.has(m.barcode)) && !localNames.has(m.name.toLowerCase())
  );

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
        <div className="relative flex-1 max-w-sm" ref={suggestionsRef}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            className="w-full h-10 pl-9 pr-4 text-sm rounded-lg border bg-card focus:ring-1 focus:ring-primary/30 outline-none"
            placeholder="Search by name, SKU, or Barcode..."
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="text-[10px] font-bold text-slate-400 px-3 py-1.5 bg-slate-50/50 uppercase border-b border-slate-100">
                Sourcing Suggestions (Select to source details)
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                {suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(sug)}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Sparkles className="size-3 text-indigo-500 shrink-0" />
                    <span className="truncate">{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <Button variant="outline"><Filter className="size-4 mr-2" /> Filters</Button>

        <Button
          variant="outline"
          onClick={handleToggleAi}
          className={
            "font-semibold text-xs h-10 px-3 flex items-center gap-2 transition-all duration-300 " +
            (aiPaused 
              ? "border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" 
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20")
          }
        >
          <Sparkles className={"size-4 shrink-0 " + (!aiPaused ? "animate-pulse" : "")} />
          <span>AI Search: {aiPaused ? "Paused" : "Active"}</span>
        </Button>
        <div className="relative">
          <Button variant="outline" onClick={() => setIsColumnsMenuOpen(!isColumnsMenuOpen)}>
            <Sliders className="size-4 mr-2" /> Columns
          </Button>
          {isColumnsMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border rounded-xl shadow-xl z-50 p-3 flex flex-col max-h-[420px]">
              <div className="flex items-center justify-between border-b pb-1.5 shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Columns</span>
                <button
                  type="button"
                  onClick={() => {
                    if (visibleColumns.length === ALL_COLUMNS.length) {
                      setVisibleColumns(["name"]); // Keep at least name visible
                    } else {
                      setVisibleColumns(ALL_COLUMNS.map(col => col.id));
                    }
                  }}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-500 transition-colors uppercase cursor-pointer"
                >
                  {visibleColumns.length === ALL_COLUMNS.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              
              <div className="divide-y divide-slate-100 overflow-y-auto my-2 py-1 pr-1 flex-1 max-h-64">
                {ALL_COLUMNS.map(col => (
                  <label key={col.id} className="flex items-center gap-2.5 py-1.5 hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setVisibleColumns(prev => [...prev, col.id]);
                        } else {
                          if (visibleColumns.length > 1) {
                            setVisibleColumns(prev => prev.filter(id => id !== col.id));
                          }
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 size-3.5 cursor-pointer"
                    />
                    {col.label}
                  </label>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t mt-auto shrink-0">
                <Button
                  size="sm"
                  onClick={() => {
                    localStorage.setItem("products_visible_columns", JSON.stringify(visibleColumns));
                    setIsColumnsMenuOpen(false);
                  }}
                  className="flex-1 text-[11px] h-7 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg border-0 shadow-sm"
                >
                  Save Preset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const defaults = ["image", "name", "sku", "barcode", "category", "brand", "mrp", "initial_stock", "status"];
                    setVisibleColumns(defaults);
                    localStorage.setItem("products_visible_columns", JSON.stringify(defaults));
                    setIsColumnsMenuOpen(false);
                  }}
                  className="flex-1 text-[11px] h-7 font-bold rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
              <tr>
                {visibleColumns.includes("image") && <th className="px-6 py-4">Image</th>}
                {visibleColumns.includes("name") && <th className="px-6 py-4">Product Name</th>}
                {visibleColumns.includes("sku") && <th className="px-6 py-4">SKU</th>}
                {visibleColumns.includes("barcode") && <th className="px-6 py-4">Barcode</th>}
                {visibleColumns.includes("category") && <th className="px-6 py-4">Category</th>}
                {visibleColumns.includes("brand") && <th className="px-6 py-4">Brand</th>}
                {visibleColumns.includes("uom") && <th className="px-6 py-4">UOM</th>}
                {visibleColumns.includes("purchase_price") && <th className="px-6 py-4">Purchase Price</th>}
                {visibleColumns.includes("mrp") && <th className="px-6 py-4">MRP</th>}
                {visibleColumns.includes("selling_price") && <th className="px-6 py-4">Selling Price</th>}
                {visibleColumns.includes("tax_percent") && <th className="px-6 py-4">Tax (%)</th>}
                {visibleColumns.includes("discount_limit") && <th className="px-6 py-4">Discount Limit (%)</th>}
                {visibleColumns.includes("initial_stock") && <th className="px-6 py-4">Stock</th>}
                {visibleColumns.includes("reorder_level") && <th className="px-6 py-4">Reorder Level</th>}
                {visibleColumns.includes("safety_stock") && <th className="px-6 py-4">Safety Stock</th>}
                {visibleColumns.includes("supplier") && <th className="px-6 py-4">Supplier</th>}
                {visibleColumns.includes("warehouse") && <th className="px-6 py-4">Warehouse</th>}
                {visibleColumns.includes("status") && <th className="px-6 py-4">Status</th>}

                {/* Extra dynamic columns from Master Catalog / RAG */}
                {visibleColumns.includes("hsn_code") && <th className="px-6 py-4">HSN Code</th>}
                {visibleColumns.includes("plu_no") && <th className="px-6 py-4">PLU No</th>}
                {visibleColumns.includes("cost_price") && <th className="px-6 py-4">Cost Price</th>}
                {visibleColumns.includes("sale_price") && <th className="px-6 py-4">Sale Price</th>}
                {visibleColumns.includes("wholesale_price") && <th className="px-6 py-4">Wholesale Price</th>}
                {visibleColumns.includes("special_price") && <th className="px-6 py-4">Special Price</th>}
                {visibleColumns.includes("online_price") && <th className="px-6 py-4">Online Price</th>}
                {visibleColumns.includes("weight") && <th className="px-6 py-4">Weight</th>}
                {visibleColumns.includes("cess") && <th className="px-6 py-4">Cess (%)</th>}
                {visibleColumns.includes("cess_on") && <th className="px-6 py-4">Cess On</th>}
                {visibleColumns.includes("cess_type") && <th className="px-6 py-4">Cess Type</th>}
                {visibleColumns.includes("tax_amount") && <th className="px-6 py-4">Tax Amount</th>}
                {visibleColumns.includes("taxable_value") && <th className="px-6 py-4">Taxable Value</th>}
                {visibleColumns.includes("cess_tax_amount") && <th className="px-6 py-4">Cess Tax Amt</th>}
                {visibleColumns.includes("additional_cess_tax_amount") && <th className="px-6 py-4">Add. Cess Tax Amt</th>}
                {visibleColumns.includes("discount_rs") && <th className="px-6 py-4">Discount (Rs)</th>}
                {visibleColumns.includes("discount_percent") && <th className="px-6 py-4">Discount (%)</th>}
                {visibleColumns.includes("actual_margin_rs") && <th className="px-6 py-4">Margin (Rs)</th>}
                {visibleColumns.includes("margin_on_cp") && <th className="px-6 py-4">Margin on CP (%)</th>}
                {visibleColumns.includes("margin_on_sp") && <th className="px-6 py-4">Margin on SP (%)</th>}
                {visibleColumns.includes("short_description") && <th className="px-6 py-4">Short Description</th>}
                {visibleColumns.includes("specifications") && <th className="px-6 py-4">Specifications</th>}
                {visibleColumns.includes("source") && <th className="px-6 py-4">Source</th>}

                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-6 py-8 text-center text-muted-foreground">Loading products...</td>
                </tr>
              ) : (
                <>
                  {filtered.length === 0 && uniqueMasterResults.length === 0 && (
                    <tr>
                      <td colSpan={visibleColumns.length + 1} className="px-6 py-8 text-center text-muted-foreground">No products found.</td>
                    </tr>
                  )}

                  {filtered.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                      {visibleColumns.includes("image") && (
                        <td className="px-6 py-4">
                          {product.image_url ? (
                            <img src={resolveImageUrl(product.image_url)} alt={product.name} className="size-10 rounded-lg object-cover border bg-white" />
                          ) : (
                            <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Package className="size-5 text-muted-foreground" />
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.includes("name") && <td className="px-6 py-4 font-bold">{product.name}</td>}
                      {visibleColumns.includes("sku") && <td className="px-6 py-4 font-mono font-bold text-xs">{product.sku || '-'}</td>}
                      {visibleColumns.includes("barcode") && <td className="px-6 py-4 font-mono text-xs">{product.barcode || '-'}</td>}
                      {visibleColumns.includes("category") && <td className="px-6 py-4 text-xs">{product.category_name || '-'}</td>}
                      {visibleColumns.includes("brand") && <td className="px-6 py-4 text-xs">{product.brand_name || '-'}</td>}
                      {visibleColumns.includes("uom") && <td className="px-6 py-4 text-xs">{product.uom_name || '-'}</td>}
                      {visibleColumns.includes("purchase_price") && <td className="px-6 py-4">{formatCurrency(product.purchase_price)}</td>}
                      {visibleColumns.includes("mrp") && <td className="px-6 py-4 font-bold">{formatCurrency(product.mrp)}</td>}
                      {visibleColumns.includes("selling_price") && <td className="px-6 py-4">{formatCurrency(product.selling_price)}</td>}
                      {visibleColumns.includes("tax_percent") && <td className="px-6 py-4 text-xs">{product.tax_percent}%</td>}
                      {visibleColumns.includes("discount_limit") && <td className="px-6 py-4 text-xs">{product.discount_limit}%</td>}
                      {visibleColumns.includes("initial_stock") && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-muted rounded-full h-1.5 max-w-[80px]">
                              <div className={`h-1.5 rounded-full ${(product.stock ?? product.initial_stock) <= product.reorder_level ? 'bg-rose-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, ((product.stock ?? product.initial_stock) / (product.reorder_level > 0 ? product.reorder_level * 3 : 100)) * 100)}%` }}></div>
                            </div>
                            <span className="font-bold">{product.stock ?? product.initial_stock}</span>
                          </div>
                          {(product.stock ?? product.initial_stock) <= product.reorder_level && <div className="text-[10px] text-rose-500 font-bold mt-1">Low Stock!</div>}
                        </td>
                      )}
                      {visibleColumns.includes("reorder_level") && <td className="px-6 py-4 text-xs">{product.reorder_level}</td>}
                      {visibleColumns.includes("safety_stock") && <td className="px-6 py-4 text-xs">{product.safety_stock}</td>}
                      {visibleColumns.includes("supplier") && <td className="px-6 py-4 text-xs">{product.supplier || '-'}</td>}
                      {visibleColumns.includes("warehouse") && <td className="px-6 py-4 text-xs">{product.warehouse || '-'}</td>}
                      {visibleColumns.includes("status") && (
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${product.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                            }`}>
                            <span className={`size-1.5 rounded-full ${product.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {product.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      )}

                      {/* Extra dynamically filled catalog columns for local products */}
                      {visibleColumns.includes("hsn_code") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("plu_no") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("cost_price") && <td className="px-6 py-4">{formatCurrency(product.purchase_price)}</td>}
                      {visibleColumns.includes("sale_price") && <td className="px-6 py-4">{formatCurrency(product.selling_price)}</td>}
                      {visibleColumns.includes("wholesale_price") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("special_price") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("online_price") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("weight") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("cess") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("cess_on") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("cess_type") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("tax_amount") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("taxable_value") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("cess_tax_amount") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("additional_cess_tax_amount") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("discount_rs") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("discount_percent") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("actual_margin_rs") && <td className="px-6 py-4">{formatCurrency(product.mrp - product.purchase_price)}</td>}
                      {visibleColumns.includes("margin_on_cp") && (
                        <td className="px-6 py-4 text-xs">
                          {product.purchase_price > 0 ? Math.round(((product.mrp - product.purchase_price) / product.purchase_price) * 100) + '%' : '-'}
                        </td>
                      )}
                      {visibleColumns.includes("margin_on_sp") && (
                        <td className="px-6 py-4 text-xs">
                          {product.mrp > 0 ? Math.round(((product.mrp - product.purchase_price) / product.mrp) * 100) + '%' : '-'}
                        </td>
                      )}
                      {visibleColumns.includes("short_description") && <td className="px-6 py-4 text-xs max-w-xs truncate">{product.short_description || '-'}</td>}
                      {visibleColumns.includes("specifications") && <td className="px-6 py-4 text-xs">-</td>}
                      {visibleColumns.includes("source") && <td className="px-6 py-4 text-xs">LOCAL_DB</td>}

                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleDuplicate(product)}><Copy className="size-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleDelete(product.id)}><Archive className="size-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleEdit(product)}><Edit2 className="size-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {isSearchingMaster && (
                    <tr>
                      <td colSpan={visibleColumns.length + 1} className="px-6 py-6 text-center text-indigo-600 font-semibold">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="size-4 animate-spin" /> Searching Global Master Catalog & AI RAG Sourcing...
                        </span>
                      </td>
                    </tr>
                  )}

                  {searchError && (
                    <tr>
                      <td colSpan={visibleColumns.length + 1} className="px-6 py-4 bg-rose-50 border-y select-none">
                        <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
                          <X className="size-4 text-rose-500 shrink-0" />
                          <span>{searchError}</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {uniqueMasterResults.length > 0 && (
                    <>
                      <tr className="bg-indigo-50/50 border-y select-none">
                        <td colSpan={visibleColumns.length + 1} className="px-6 py-3 font-bold text-xs uppercase text-indigo-700 tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="size-4 text-amber-500 animate-pulse" />
                            Suggestions from Global Master Catalog & AI Sourcing (Save to import locally)
                          </span>
                        </td>
                      </tr>
                      {uniqueMasterResults.map((item, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/20 bg-indigo-50/5 transition-colors border-b border-indigo-100/50">
                          {visibleColumns.includes("image") && (
                            <td className="px-6 py-4">
                              {item.image_url ? (
                                <img src={resolveImageUrl(item.image_url)} alt={item.name} className="size-10 rounded-lg object-cover border bg-white" />
                              ) : (
                                <div className="size-10 rounded-lg bg-indigo-100/30 flex items-center justify-center shrink-0">
                                  <Globe className="size-5 text-indigo-500" />
                                </div>
                              )}
                            </td>
                          )}
                          {visibleColumns.includes("name") && (
                            <td className="px-6 py-4 font-bold text-indigo-950">
                              <div>{item.name}</div>
                              <div className="text-[10px] text-indigo-500 font-semibold uppercase mt-0.5">
                                {item.source === "AI_WEB_SEARCH" ? "AI Web Sourced" : "Global Master DB"}
                              </div>
                            </td>
                          )}
                          {visibleColumns.includes("sku") && <td className="px-6 py-4 font-mono font-bold text-xs text-indigo-900">{item.sku_code || '-'}</td>}
                          {visibleColumns.includes("barcode") && <td className="px-6 py-4 font-mono text-xs text-indigo-750">{item.barcode || '-'}</td>}
                          {visibleColumns.includes("category") && <td className="px-6 py-4 text-xs text-indigo-800">{item.category || item.category_name || '-'}</td>}
                          {visibleColumns.includes("brand") && <td className="px-6 py-4 text-xs text-indigo-800">{item.brand || item.brand_name || '-'}</td>}
                          {visibleColumns.includes("uom") && <td className="px-6 py-4 text-xs text-indigo-800">-</td>}
                          {visibleColumns.includes("purchase_price") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.cost_price)}</td>}
                          {visibleColumns.includes("mrp") && <td className="px-6 py-4 font-bold text-indigo-950">{formatCurrency(item.mrp || item.sale_price)}</td>}
                          {visibleColumns.includes("selling_price") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.sale_price)}</td>}
                          {visibleColumns.includes("tax_percent") && <td className="px-6 py-4 text-xs text-indigo-800">{item.tax}%</td>}
                          {visibleColumns.includes("discount_limit") && <td className="px-6 py-4 text-xs text-indigo-800">-</td>}
                          {visibleColumns.includes("initial_stock") && (
                            <td className="px-6 py-4 text-indigo-500 italic text-xs">Not Imported</td>
                          )}
                          {visibleColumns.includes("reorder_level") && <td className="px-6 py-4 text-xs text-indigo-800">-</td>}
                          {visibleColumns.includes("safety_stock") && <td className="px-6 py-4 text-xs text-indigo-800">-</td>}
                          {visibleColumns.includes("supplier") && <td className="px-6 py-4 text-xs text-indigo-800">{item.supplier || '-'}</td>}
                          {visibleColumns.includes("warehouse") && <td className="px-6 py-4 text-xs text-indigo-800">-</td>}
                          {visibleColumns.includes("status") && (
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                                Available
                              </span>
                            </td>
                          )}

                          {/* Extra catalog search columns mapped directly for live web sourced suggestion items */}
                          {visibleColumns.includes("hsn_code") && <td className="px-6 py-4 text-xs text-indigo-800">{item.hsn_code || '-'}</td>}
                          {visibleColumns.includes("plu_no") && <td className="px-6 py-4 text-xs text-indigo-800">{item.plu_no || '-'}</td>}
                          {visibleColumns.includes("cost_price") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.cost_price)}</td>}
                          {visibleColumns.includes("sale_price") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.sale_price)}</td>}
                          {visibleColumns.includes("wholesale_price") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.wholesale_price)}</td>}
                          {visibleColumns.includes("special_price") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.special_price)}</td>}
                          {visibleColumns.includes("online_price") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.online_price)}</td>}
                          {visibleColumns.includes("weight") && <td className="px-6 py-4 text-xs text-indigo-800">{item.weight || '-'}</td>}
                          {visibleColumns.includes("cess") && <td className="px-6 py-4 text-xs text-indigo-800">{item.cess || 0}%</td>}
                          {visibleColumns.includes("cess_on") && <td className="px-6 py-4 text-xs text-indigo-800">{item.cess_on || '-'}</td>}
                          {visibleColumns.includes("cess_type") && <td className="px-6 py-4 text-xs text-indigo-800">{item.cess_type || '-'}</td>}
                          {visibleColumns.includes("tax_amount") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.tax_amount)}</td>}
                          {visibleColumns.includes("taxable_value") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.taxable_value)}</td>}
                          {visibleColumns.includes("cess_tax_amount") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.cess_tax_amount)}</td>}
                          {visibleColumns.includes("additional_cess_tax_amount") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.additional_cess_tax_amount)}</td>}
                          {visibleColumns.includes("discount_rs") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.discount_rs)}</td>}
                          {visibleColumns.includes("discount_percent") && <td className="px-6 py-4 text-xs text-indigo-800">{item.discount_percent || 0}%</td>}
                          {visibleColumns.includes("actual_margin_rs") && <td className="px-6 py-4 text-indigo-800">{formatCurrency(item.actual_margin_rs)}</td>}
                          {visibleColumns.includes("margin_on_cp") && <td className="px-6 py-4 text-xs text-indigo-800">{item.margin_on_cp || 0}%</td>}
                          {visibleColumns.includes("margin_on_sp") && <td className="px-6 py-4 text-xs text-indigo-800">{item.margin_on_sp || 0}%</td>}
                          {visibleColumns.includes("short_description") && <td className="px-6 py-4 text-xs max-w-xs truncate text-indigo-800">{item.short_description || '-'}</td>}
                          {visibleColumns.includes("specifications") && <td className="px-6 py-4 text-xs max-w-xs truncate text-indigo-800">{item.specifications || '-'}</td>}
                          {visibleColumns.includes("source") && <td className="px-6 py-4 text-xs text-indigo-800">{item.source || '-'}</td>}

                          <td className="px-6 py-4 text-right">
                            <Button 
                              size="sm" 
                              onClick={() => handleImportToLocal(item)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm font-semibold border-0 text-xs px-3 h-8 rounded-lg"
                            >
                              <Plus className="size-3.5 mr-1" /> Save to Inventory
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </>
              )}
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
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Unit of Measure</label>
                      <select name="uom_id" value={formData.uom_id} onChange={handleInputChange} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm bg-white">
                        <option value="">Select Unit...</option>
                        {uoms.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                        ))}
                      </select>
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
      <MasterCatalogModal
        isOpen={isMasterCatalogOpen}
        onClose={() => setIsMasterCatalogOpen(false)}
        onProductAdded={loadData}
      />
    </div>
  );
}
