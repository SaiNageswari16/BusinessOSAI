import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Package, Search, Filter, ShieldCheck, DollarSign, Star, Store, Plus, Tag, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { marketplaceApi } from "@/lib/marketplace-api";

export function MarketplaceProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [newProduct, setNewProduct] = useState({
    title: "",
    sku: "",
    vendorName: "",
    category: "Electronics & Computing",
    price: 99.0,
    stock: 25,
    hsn_code: "HSN-847130",
  });

  const fetchProductList = async () => {
    try {
      setLoading(true);
      const data = await marketplaceApi.getProducts();
      if (data.products) {
        setProducts(data.products.map((p: any) => ({
          id: p.id,
          name: p.title,
          vendorName: p.vendorName || "Marketplace Vendor",
          category: p.category || "General",
          price: Number(p.price || 0),
          stock: Number(p.stock || 0),
          status: p.status || "Approved",
          image: p.image || "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=150&auto=format&fit=crop&q=80",
          salesCount: 142
        })));
      }
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductList();
    marketplaceApi.getVendors().then(v => {
      if (v.vendors && v.vendors.length > 0) {
        setVendorsList(v.vendors);
        setNewProduct(prev => ({ ...prev, vendorName: v.vendors[0].name }));
      }
    }).catch(() => {});
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.title || !newProduct.sku) return;
    try {
      await marketplaceApi.createProduct(newProduct);
      await fetchProductList();
    } catch {
      await fetchProductList();
    }
    setNewProduct({
      title: "",
      sku: "",
      vendorName: vendorsList[0]?.name || "",
      category: "Electronics & Computing",
      price: 99.0,
      stock: 25,
      hsn_code: "HSN-847130",
    });
    setShowAddModal(false);
  };

  const handleApproveProduct = async (id: string) => {
    try {
      await marketplaceApi.approveRejectProduct(id, "approve");
      setProducts(prev => prev.map(p => p.id === id ? { ...p, status: "Approved" } : p));
    } catch (err) {
      console.error("Failed to approve product:", err);
    }
  };

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Products</h1>
          <p className="text-sm text-muted-foreground">Manage and approve products listed by vendors across the marketplace.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products or vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="size-4" /> Add Product Listing
          </button>
        </div>
      </div>

      <div className="glass-panel border border-border/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-muted/30 border-b border-border/50">
                <th className="px-6 py-4 font-semibold text-muted-foreground">Product</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Vendor</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Category</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Price</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Stock</th>
                <th className="px-6 py-4 font-semibold text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-right font-semibold text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map((product, i) => (
                <motion.tr 
                  key={product.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="hover:bg-accent/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                        <Package className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground truncate max-w-[200px]" title={product.name}>{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Store className="size-3.5 text-muted-foreground" />
                      <span className="text-foreground truncate max-w-[150px]" title={product.vendorName}>{product.vendorName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <Tag className="size-3.5 text-primary" />
                      {product.category}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-foreground">
                    ${product.price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2 py-1 rounded text-xs font-medium", 
                      product.stock > 100 ? "bg-emerald-500/10 text-emerald-600" :
                      product.stock > 0 ? "bg-amber-500/10 text-amber-600" :
                      "bg-red-500/10 text-red-600"
                    )}>
                      {product.stock} units
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide uppercase",
                      product.status === "Approved" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                      product.status === "Pending" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                      "bg-red-500/10 text-red-600 border border-red-500/20"
                    )}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {product.status === "Pending" ? (
                      <button 
                        onClick={() => handleApproveProduct(product.id)}
                        className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ml-auto"
                      >
                        <ShieldCheck className="size-3.5" /> Approve
                      </button>
                    ) : (
                      <button className="px-3 py-1 text-xs font-medium bg-background border border-border hover:bg-accent rounded-md transition-colors">
                        Edit
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-background border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="border-b border-border/50 pb-3">
              <h2 className="text-xl font-bold text-foreground">Add Marketplace Product Listing</h2>
              <p className="text-xs text-muted-foreground">Submit a new SKU to the multi-vendor marketplace catalog.</p>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Product Title *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Wireless Noise-Cancelling Headphones"
                  value={newProduct.title}
                  onChange={e => setNewProduct({ ...newProduct, title: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">SKU Code *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. SKU-WH-1000"
                    value={newProduct.sku}
                    onChange={e => setNewProduct({ ...newProduct, sku: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase font-mono text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Selling Vendor *</label>
                  <select
                    value={newProduct.vendorName}
                    onChange={e => setNewProduct({ ...newProduct, vendorName: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  >
                    {vendorsList.map(v => (
                      <option key={v.id} value={v.name}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Category</label>
                  <select
                    value={newProduct.category}
                    onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  >
                    <option value="Electronics & Computing">Electronics & Computing</option>
                    <option value="Industrial Hardware">Industrial Hardware</option>
                    <option value="Home & Furniture">Home & Furniture</option>
                    <option value="Fashion & Lifestyle">Fashion & Lifestyle</option>
                    <option value="Plant-based foods and beverages">Plant-based foods and beverages</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">HSN / Tax Code</label>
                  <input 
                    type="text" 
                    value={newProduct.hsn_code}
                    onChange={e => setNewProduct({ ...newProduct, hsn_code: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Price ($) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={newProduct.price}
                    onChange={e => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Initial Stock Units *</label>
                  <input 
                    type="number" 
                    required
                    value={newProduct.stock}
                    onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium transition-colors text-foreground"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Publish Product Listing
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
