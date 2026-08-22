import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FolderTree, Plus, Search, Layers, Package, Store } from "lucide-react";
import { marketplaceApi } from "@/lib/marketplace-api";

export function VendorCategoryManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [categories, setCategories] = useState([
    { id: "cat-1", name: "Electronics & Gadgets", code: "ELEC", vendorCount: 42, productCount: 612, description: "Smartphones, laptops, accessories and consumer tech." },
    { id: "cat-2", name: "Fashion & Apparel", code: "FASH", vendorCount: 28, productCount: 480, description: "Men, women and kids clothing, footwear and bags." },
    { id: "cat-3", name: "Home & Office Furniture", code: "FURN", vendorCount: 19, productCount: 210, description: "Desks, ergonomic chairs, home decor and lighting." },
    { id: "cat-4", name: "Industrial & Heavy Tools", code: "TOOL", vendorCount: 15, productCount: 118, description: "Manufacturing equipment, hardware tools and safety gear." },
    { id: "cat-5", name: "Beauty & Personal Care", code: "CARE", vendorCount: 22, productCount: 340, description: "Skincare, haircare, cosmetics and wellness products." },
  ]);

  const fetchCategories = async () => {
    try {
      const data = await marketplaceApi.getVendorCategories();
      if (data.categories && data.categories.length > 0) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error("Failed to load vendor categories:", err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const [newCat, setNewCat] = useState({ name: "", code: "", description: "" });

  const filtered = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.name || !newCat.code) return;
    try {
      const res = await marketplaceApi.createVendorCategory({
        name: newCat.name,
        code: newCat.code.toUpperCase(),
        description: newCat.description,
      });
      setCategories([
        {
          id: res.id || `cat-${Date.now()}`,
          name: newCat.name,
          code: newCat.code.toUpperCase(),
          vendorCount: 0,
          productCount: 0,
          description: newCat.description || "Vendor category description",
        },
        ...categories,
      ]);
    } catch {
      setCategories([
        {
          id: `cat-${Date.now()}`,
          name: newCat.name,
          code: newCat.code.toUpperCase(),
          vendorCount: 0,
          productCount: 0,
          description: newCat.description || "Vendor category description",
        },
        ...categories,
      ]);
    }
    setNewCat({ name: "", code: "", description: "" });
    setShowAddModal(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendor Categories</h1>
          <p className="text-sm text-muted-foreground">Classify marketplace vendors and streamline catalog management.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="size-4" /> Add Category
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cat, i) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-panel p-5 rounded-xl border border-border/50 hover:border-primary/20 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <div className="size-10 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold">
                  <FolderTree className="size-5" />
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-accent text-muted-foreground border border-border">
                  {cat.code}
                </span>
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-1">{cat.name}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{cat.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border/50">
              <div className="bg-background/50 p-2.5 rounded-lg text-center">
                <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Vendors</p>
                <p className="font-semibold text-foreground text-sm flex items-center justify-center gap-1">
                  <Store className="size-3.5 text-primary" />
                  {cat.vendorCount}
                </p>
              </div>
              <div className="bg-background/50 p-2.5 rounded-lg text-center">
                <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Products</p>
                <p className="font-semibold text-foreground text-sm flex items-center justify-center gap-1">
                  <Package className="size-3.5 text-emerald-500" />
                  {cat.productCount}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-background border border-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4"
          >
            <h2 className="text-xl font-bold text-foreground">Create Vendor Category</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Category Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Healthcare & Medical Supplies"
                  value={newCat.name}
                  onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Category Code</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. HLTH"
                  value={newCat.code}
                  onChange={e => setNewCat({ ...newCat, code: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
                <textarea 
                  placeholder="Category scope and details..."
                  value={newCat.description}
                  onChange={e => setNewCat({ ...newCat, description: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 h-20 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Save Category
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
