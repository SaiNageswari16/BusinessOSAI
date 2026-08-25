import React, { useState, useEffect, useMemo, useRef } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import {
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  X,
  Package,
  Edit2,
  ImagePlus,
  Link as LinkIcon,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Plus,
  Eye,
  Check,
  FileCheck,
  Zap,
} from "lucide-react";
import { inventoryApi, ProductImage, InventoryProduct } from "../../lib/api-client";
import { ProductPicker } from "./ProductPicker";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

export function ProductImages() {
  const { currency, formatCurrency } = useCurrency();
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [galleryImages, setGalleryImages] = useState<ProductImage[]>([]);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "missing" | "has_image">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  // Single Upload / Edit Modal
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [selectedProductForUpload, setSelectedProductForUpload] = useState<InventoryProduct | null>(null);
  const [singleUploadMode, setSingleUploadMode] = useState<"file" | "url">("file");
  const [singleImageUrl, setSingleImageUrl] = useState("");
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [isPrimaryImage, setIsPrimaryImage] = useState(true);
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);

  // Bulk Barcode Upload Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ total: number; matched: number; unmatched: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gallery Multi-Image View Modal
  const [viewGalleryProduct, setViewGalleryProduct] = useState<InventoryProduct | null>(null);

  // AI Sourcing Loading Set
  const [aiLoadingIds, setAiLoadingIds] = useState<Set<string>>(new Set());

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodsRes, imgsRes] = await Promise.all([
        inventoryApi.getProducts({ page_size: 500 }).catch(() => ({ items: [] as InventoryProduct[] })),
        inventoryApi.getProductImages().catch(() => [] as ProductImage[]),
      ]);
      setProducts(prodsRes.items || []);
      setGalleryImages(imgsRes || []);
    } catch (err) {
      console.error("Failed loading product images:", err);
      toast.error("Failed to load inventory products");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map product gallery images
  const galleryByProductId = useMemo(() => {
    const map = new Map<string, ProductImage[]>();
    galleryImages.forEach((img) => {
      const list = map.get(img.product_id) || [];
      list.push(img);
      map.set(img.product_id, list);
    });
    return map;
  }, [galleryImages]);

  // Unique Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const cat = (p as any).category?.name || p.category_name;
      if (cat) set.add(cat);
    });
    return Array.from(set);
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const nameMatch =
        !search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()));

      const catName = (p as any).category?.name || p.category_name || "";
      const catMatch = selectedCategory === "all" || catName === selectedCategory;

      const hasImg = Boolean(p.image_url && p.image_url.trim() && !p.image_url.includes("placeholder"));
      const statusMatch =
        filterMode === "all" ||
        (filterMode === "missing" && !hasImg) ||
        (filterMode === "has_image" && hasImg);

      return nameMatch && catMatch && statusMatch;
    });
  }, [products, search, selectedCategory, filterMode]);

  // Stats
  const totalProducts = products.length;
  const productsWithImages = products.filter(
    (p) => p.image_url && p.image_url.trim() && !p.image_url.includes("placeholder")
  ).length;
  const productsMissingImages = totalProducts - productsWithImages;
  const coveragePercent = totalProducts > 0 ? Math.round((productsWithImages / totalProducts) * 100) : 0;

  // Single Upload Action
  const handleOpenSingleUpload = (product: InventoryProduct) => {
    setSelectedProductForUpload(product);
    setSingleImageUrl(product.image_url || "");
    setSingleFile(null);
    setSingleUploadMode("file");
    setIsPrimaryImage(true);
    setIsSingleModalOpen(true);
  };

  const handleSaveSingleImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForUpload) return;
    setIsSubmittingSingle(true);

    try {
      if (singleUploadMode === "file" && singleFile) {
        await inventoryApi.uploadSingleProductImage(selectedProductForUpload.id, singleFile, isPrimaryImage);
        toast.success(`Image uploaded for "${selectedProductForUpload.name}"!`);
      } else if (singleImageUrl.trim()) {
        if (isPrimaryImage) {
          await inventoryApi.updateProduct(selectedProductForUpload.id, { image_url: singleImageUrl.trim() });
        }
        await inventoryApi.createProductImage({
          product_id: selectedProductForUpload.id,
          image_url: singleImageUrl.trim(),
          is_primary: isPrimaryImage,
          display_order: 0,
        });
        toast.success(`Image URL assigned to "${selectedProductForUpload.name}"!`);
      } else {
        toast.error("Please provide a file or image URL");
        setIsSubmittingSingle(false);
        return;
      }

      setIsSingleModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.detail || err.message || "Failed to save image");
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  // Bulk Upload File Handler
  const handleBulkFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArr = Array.from(e.target.files);
      setBulkFiles(filesArr);
    }
  };

  // Preview matching for bulk files
  const bulkPreviewMatches = useMemo(() => {
    const productBarcodeMap = new Map<string, InventoryProduct>();
    products.forEach((p) => {
      if (p.barcode) productBarcodeMap.set(p.barcode.trim().toLowerCase(), p);
      if (p.sku) productBarcodeMap.set(p.sku.trim().toLowerCase(), p);
    });

    return bulkFiles.map((file) => {
      const rawName = file.name;
      const stem = rawName.substring(0, rawName.lastIndexOf(".")).trim().toLowerCase();
      const matchedProd = productBarcodeMap.get(stem);
      return {
        file,
        rawName,
        stem,
        matchedProduct: matchedProd || null,
        previewUrl: URL.createObjectURL(file),
      };
    });
  }, [bulkFiles, products]);

  const matchedBulkCount = bulkPreviewMatches.filter((m) => m.matchedProduct !== null).length;
  const unmatchedBulkCount = bulkPreviewMatches.length - matchedBulkCount;

  const handleExecuteBulkUpload = async () => {
    if (bulkFiles.length === 0) {
      toast.error("Please select image files to upload");
      return;
    }
    setIsBulkUploading(true);
    try {
      const res = await inventoryApi.bulkUploadImagesByBarcode(bulkFiles);
      setBulkProgress({
        total: res.total_files,
        matched: res.matched_count,
        unmatched: res.unmatched_count,
      });
      toast.success(`Bulk Upload Complete! ${res.matched_count} product images assigned successfully.`);
      await loadData();
      setTimeout(() => {
        setIsBulkModalOpen(false);
        setBulkFiles([]);
        setBulkProgress(null);
      }, 1500);
    } catch (err: any) {
      toast.error(err.detail || err.message || "Bulk upload failed");
    } finally {
      setIsBulkUploading(false);
    }
  };

  // AI Image Sourcing for a single product
  const handleAiSourceImage = async (product: InventoryProduct) => {
    const query = product.barcode || product.name;
    if (!query) return;

    try {
      setAiLoadingIds((prev) => new Set(prev).add(product.id));
      toast.info(`Sourcing image for "${product.name}"...`);
      const results = await inventoryApi.searchMasterCatalog(query, true, "auto");
      if (results && results.length > 0 && results[0].image_url) {
        const foundUrl = results[0].image_url;
        await inventoryApi.updateProduct(product.id, { image_url: foundUrl });
        await inventoryApi.createProductImage({
          product_id: product.id,
          image_url: foundUrl,
          is_primary: true,
          display_order: 0,
        });
        toast.success(`Authentic image found & assigned to "${product.name}"!`);
        await loadData();
      } else {
        toast.error(`No public product image found for "${product.name}". Please upload manually.`);
      }
    } catch (err: any) {
      toast.error(err.detail || err.message || "AI image search failed");
    } finally {
      setAiLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  // Delete Image
  const handleDeleteProductImage = async (product: InventoryProduct) => {
    if (!confirm(`Remove primary image from "${product.name}"?`)) return;
    try {
      await inventoryApi.updateProduct(product.id, { image_url: "" });
      toast.success("Image removed from product");
      await loadData();
    } catch (err: any) {
      toast.error(err.detail || err.message || "Failed to remove image");
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-800">
      {/* Top Header & Bulk Upload Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Product Media & Image Management</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage high-res product photos, multi-angle gallery shots, and bulk match images by Barcode/SKU.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={loadData}
            variant="outline"
          >
            <RefreshCw className={`size-4 mr-2 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>

          <Button
            onClick={() => {
              setBulkFiles([]);
              setBulkProgress(null);
              setIsBulkModalOpen(true);
            }}
            className="gradient-brand text-white border-0"
          >
            <Zap className="size-4 mr-2 text-amber-300" /> Bulk Upload by Barcode / SKU
          </Button>
        </div>
      </div>

      {/* Media Coverage Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Catalog Products</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{totalProducts}</span>
            <span className="text-xs text-slate-500 font-semibold">SKUs in Store</span>
          </div>
        </Card>

        <Card className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded-xl shadow-sm">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">With High-Res Photos</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-emerald-700">{productsWithImages}</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{coveragePercent}% Ready</span>
          </div>
        </Card>

        <Card className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-xl shadow-sm">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Missing Photos</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-amber-700">{productsMissingImages}</span>
            <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Action Needed</span>
          </div>
        </Card>

        <Card className="p-4 bg-indigo-50/50 border border-indigo-200/60 rounded-xl shadow-sm">
          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">Multi-Angle Gallery Photos</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-indigo-700">{galleryImages.length}</span>
            <span className="text-xs text-indigo-600 font-semibold">Extra Views</span>
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === "all" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Products ({totalProducts})
            </button>
            <button
              onClick={() => setFilterMode("missing")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                filterMode === "missing" ? "bg-white text-amber-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Missing Images ({productsMissingImages})
            </button>
            <button
              onClick={() => setFilterMode("has_image")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                filterMode === "has_image" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Has Image ({productsWithImages})
            </button>
          </div>

          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Product Name, Barcode, or SKU..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:bg-white transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Product Media Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
          <p className="font-bold text-sm text-slate-600">Loading Product Catalog Media Library...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-16 text-center bg-white border border-dashed border-slate-200 rounded-2xl p-8">
          <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="font-bold text-slate-800 text-base">No Products Found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {search ? `No products match "${search}".` : "Your inventory catalog has no products in this view."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {filteredProducts.map((product) => {
            const hasImage = Boolean(product.image_url && product.image_url.trim() && !product.image_url.includes("placeholder"));
            const gallery = galleryByProductId.get(product.id) || [];
            const isAiLoading = aiLoadingIds.has(product.id);

            return (
              <Card
                key={product.id}
                className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col group relative"
              >
                {/* Image Preview / Placeholder */}
                <div className="aspect-square bg-slate-50 relative flex items-center justify-center p-3 border-b border-slate-100 overflow-hidden">
                  {hasImage ? (
                    <img
                      src={product.image_url || undefined}
                      alt={product.name}
                      onError={(e) => {
                        e.currentTarget.src = "https://placehold.co/300x300/f8fafc/94a3b8?text=Image+Error";
                      }}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-300 space-y-2 text-center p-4">
                      <ImageIcon className="w-10 h-10 stroke-[1.5]" />
                      <span className="text-[11px] font-bold text-slate-400">No Image Uploaded</span>
                    </div>
                  )}

                  {/* Status Badges */}
                  <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
                    {hasImage ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600/90 backdrop-blur-sm text-white text-[9px] font-bold rounded-full shadow-sm">
                        <Check className="w-2.5 h-2.5" /> High-Res
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/90 backdrop-blur-sm text-white text-[9px] font-bold rounded-full shadow-sm">
                        <AlertCircle className="w-2.5 h-2.5" /> Missing
                      </span>
                    )}

                    {gallery.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-600/90 backdrop-blur-sm text-white text-[9px] font-bold rounded-full shadow-sm">
                        +{gallery.length} Views
                      </span>
                    )}
                  </div>

                  {/* Hover Overlay Action Bar */}
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3 backdrop-blur-[2px]">
                    <Button
                      size="sm"
                      onClick={() => handleOpenSingleUpload(product)}
                      className="bg-white text-slate-800 hover:bg-slate-100 text-xs font-bold rounded-xl shadow"
                    >
                      <UploadCloud className="w-3.5 h-3.5 mr-1" /> {hasImage ? "Replace" : "Upload"}
                    </Button>

                    <Button
                      size="sm"
                      disabled={isAiLoading}
                      onClick={() => handleAiSourceImage(product)}
                      className="bg-indigo-600 text-white hover:bg-indigo-500 text-xs font-bold rounded-xl shadow"
                      title="AI Auto-Source High-Res Photo"
                    >
                      {isAiLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                    </Button>

                    {hasImage && (
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => handleDeleteProductImage(product)}
                        className="h-8 w-8 rounded-xl shadow"
                        title="Remove Image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Product Metadata Info */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2" title={product.name}>
                      {product.name}
                    </h4>

                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      {product.barcode && (
                        <span className="text-[9.5px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200/60 font-bold">
                          {product.barcode}
                        </span>
                      )}
                      {product.sku && (
                        <span className="text-[9.5px] font-mono text-slate-500 font-semibold">
                          SKU: {product.sku}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Price / MRP</span>
                      <span className="text-xs font-extrabold text-slate-900">
                        ₹{Number(product.selling_price || product.mrp || 0).toFixed(2)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenSingleUpload(product)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline"
                    >
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: Single Product Image Upload / Replace                           */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSingleModalOpen && selectedProductForUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSingleModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden z-10"
            >
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <ImagePlus className="w-5 h-5 text-indigo-400" />
                    Upload / Replace Product Image
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">{selectedProductForUpload.name}</p>
                </div>
                <button onClick={() => setIsSingleModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSingleImage} className="p-6 space-y-4">
                {/* Product Barcode & SKU Reference */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Barcode Number</span>
                    <span className="font-mono font-bold text-slate-800">{selectedProductForUpload.barcode || "No Barcode Assigned"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Product SKU</span>
                    <span className="font-mono font-bold text-slate-800">{selectedProductForUpload.sku || "N/A"}</span>
                  </div>
                </div>

                {/* Upload Mode Selector */}
                <div className="flex p-1 bg-slate-100 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setSingleUploadMode("file")}
                    className={`flex-1 py-2 rounded-lg transition ${
                      singleUploadMode === "file" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <UploadCloud className="w-3.5 h-3.5 inline mr-1" /> Upload Image File
                  </button>
                  <button
                    type="button"
                    onClick={() => setSingleUploadMode("url")}
                    className={`flex-1 py-2 rounded-lg transition ${
                      singleUploadMode === "url" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5 inline mr-1" /> Paste Public Image URL
                  </button>
                </div>

                {singleUploadMode === "file" ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Select Image File</label>
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-400 transition bg-slate-50/50">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        onChange={(e) => setSingleFile(e.target.files?.[0] || null)}
                        className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:text-white file:font-semibold file:cursor-pointer cursor-pointer"
                      />
                      {singleFile && (
                        <div className="mt-3 flex items-center justify-center gap-3">
                          <img
                            src={URL.createObjectURL(singleFile)}
                            alt="Preview"
                            className="w-16 h-16 object-contain rounded-lg border bg-white p-1"
                          />
                          <div className="text-left text-xs">
                            <span className="font-bold text-slate-800 block">{singleFile.name}</span>
                            <span className="text-slate-400">{(singleFile.size / 1024).toFixed(0)} KB</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Image Direct URL</label>
                    <input
                      type="url"
                      value={singleImageUrl}
                      onChange={(e) => setSingleImageUrl(e.target.value)}
                      placeholder="https://example.com/products/photo.jpg"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 focus:bg-white"
                    />
                    {singleImageUrl && (
                      <div className="mt-2 flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200">
                        <img src={singleImageUrl} alt="Preview" className="w-14 h-14 object-contain rounded bg-white p-1" />
                        <span className="text-xs text-slate-500 truncate">{singleImageUrl}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="setPrimary"
                    checked={isPrimaryImage}
                    onChange={(e) => setIsPrimaryImage(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                  />
                  <label htmlFor="setPrimary" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Set as Primary Display Image for POS & Catalog
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button type="button" variant="outline" onClick={() => setIsSingleModalOpen(false)} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingSingle}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-6"
                  >
                    {isSubmittingSingle ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : null}
                    Save Image
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: ⚡ Bulk Upload Images by Barcode / SKU                           */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isBulkUploading && setIsBulkModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col"
            >
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-6 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    ⚡ Bulk Upload Images by Barcode / SKU
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Drop a folder of image files. Files named after barcodes (e.g. <code className="text-amber-300 font-mono font-bold">8901030383123.jpg</code> or <code className="text-amber-300 font-mono font-bold">SKU-1002.png</code>) are automatically mapped and assigned!
                  </p>
                </div>
                <button onClick={() => setIsBulkModalOpen(false)} disabled={isBulkUploading} className="text-slate-400 hover:text-white p-1 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-5">
                {/* Drag and drop selection zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50/80 transition rounded-2xl p-8 text-center cursor-pointer space-y-2 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={handleBulkFilesSelected}
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-800">
                    Click to select multiple images or drag & drop files here
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Supported formats: PNG, JPG, JPEG, WEBP. Filenames matching Barcode numbers or SKUs will be auto-linked.
                  </p>
                </div>

                {/* Match Summary Bar */}
                {bulkFiles.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Selected Files</span>
                      <span className="text-lg font-black text-slate-900">{bulkFiles.length}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Matched to Inventory</span>
                      <span className="text-lg font-black text-emerald-700">{matchedBulkCount}</span>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Unmatched</span>
                      <span className="text-lg font-black text-amber-700">{unmatchedBulkCount}</span>
                    </div>
                  </div>
                )}

                {/* File Match Preview List */}
                {bulkPreviewMatches.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Image Matching Breakdown:
                    </span>
                    <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                      {bulkPreviewMatches.map((item, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                            item.matchedProduct
                              ? "bg-white border-emerald-200 shadow-sm"
                              : "bg-amber-50/50 border-amber-200 text-amber-900"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img src={item.previewUrl} alt={item.rawName} className="w-9 h-9 object-contain rounded border bg-white p-0.5 shrink-0" />
                            <div className="min-w-0">
                              <span className="font-mono font-bold block truncate">{item.rawName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Barcode/SKU: {item.stem}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0 ml-3">
                            {item.matchedProduct ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {item.matchedProduct.name.slice(0, 24)}...
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                <AlertCircle className="w-3 h-3 text-amber-600" /> No Barcode Match
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setIsBulkModalOpen(false)}
                  disabled={isBulkUploading}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>

                <Button
                  onClick={handleExecuteBulkUpload}
                  disabled={isBulkUploading || bulkFiles.length === 0 || matchedBulkCount === 0}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl px-6 shadow-md"
                >
                  {isBulkUploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      Uploading & Assigning Images...
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4 mr-1.5 text-emerald-300" />
                      Upload & Link {matchedBulkCount} Matched Images
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}