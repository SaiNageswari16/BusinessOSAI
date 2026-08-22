import React, { useState } from "react";
import { motion } from "framer-motion";
import { FolderTree, Plus, Search, Package, Hash, Tag, Edit, Trash2, Layers, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  taxCode: string;
  subcategoriesCount: number;
  productsCount: number;
  icon: string;
  status: "Active" | "Inactive";
}

export function MarketplaceCategories() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const [categories, setCategories] = useState<ProductCategory[]>([
    {
      id: "CAT-101",
      name: "Electronics & Computing",
      slug: "electronics-computing",
      taxCode: "HSN-8471",
      subcategoriesCount: 8,
      productsCount: 1420,
      icon: "💻",
      status: "Active",
    },
    {
      id: "CAT-102",
      name: "Office Furniture & Ergonomics",
      slug: "office-furniture",
      taxCode: "HSN-9403",
      subcategoriesCount: 5,
      productsCount: 480,
      icon: "🪑",
      status: "Active",
    },
    {
      id: "CAT-103",
      name: "Industrial Tools & Machinery",
      slug: "industrial-tools",
      taxCode: "HSN-8466",
      subcategoriesCount: 12,
      productsCount: 2150,
      icon: "⚙️",
      status: "Active",
    },
    {
      id: "CAT-104",
      name: "Logistics & Packaging Supplies",
      slug: "logistics-packaging",
      taxCode: "HSN-4819",
      subcategoriesCount: 6,
      productsCount: 690,
      icon: "📦",
      status: "Active",
    },
  ]);

  const [newCategory, setNewCategory] = useState({ name: "", slug: "", taxCode: "HSN-8471" });

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name) return;
    setCategories([
      {
        id: `CAT-${Date.now()}`,
        name: newCategory.name,
        slug: newCategory.slug || newCategory.name.toLowerCase().replace(/\s+/g, '-'),
        taxCode: newCategory.taxCode,
        subcategoriesCount: 0,
        productsCount: 0,
        icon: "📁",
        status: "Active",
      },
      ...categories,
    ]);
    setShowAddModal(false);
    setNewCategory({ name: "", slug: "", taxCode: "HSN-8471" });
  };

  const filtered = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.taxCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Product Categories</h1>
          <p className="text-sm text-muted-foreground">Manage product taxonomy tree, HSN/SAC tax codes, and category catalog items.</p>
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
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="size-4" /> Add Category
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map((cat, i) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-panel p-5 rounded-xl border border-border/50 space-y-4 hover:border-primary/20 transition-all"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-primary/10 text-2xl flex items-center justify-center border border-primary/20">
                  {cat.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-base leading-snug">{cat.name}</h3>
                  <span className="text-[10px] font-mono text-muted-foreground">{cat.taxCode}</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase">
                {cat.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="bg-background/50 p-2.5 rounded-lg border border-border/40 text-center">
                <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Subcategories</span>
                <span className="font-bold text-foreground text-sm flex items-center justify-center gap-1">
                  <Layers className="size-3.5 text-primary" /> {cat.subcategoriesCount}
                </span>
              </div>
              <div className="bg-background/50 p-2.5 rounded-lg border border-border/40 text-center">
                <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Products</span>
                <span className="font-bold text-foreground text-sm flex items-center justify-center gap-1">
                  <Package className="size-3.5 text-emerald-500" /> {cat.productsCount}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-background border border-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-bold text-foreground text-lg">Add New Product Category</h3>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Category Name</label>
                <input type="text" required placeholder="e.g. Consumer Electronics" value={newCategory.name} onChange={e => setNewCategory({ ...newCategory, name: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Tax Code (HSN/SAC)</label>
                <input type="text" required placeholder="e.g. HSN-8471" value={newCategory.taxCode} onChange={e => setNewCategory({ ...newCategory, taxCode: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">Add Category</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
