import React, { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, CheckCircle2, XCircle, Clock, Search, Package, Store, Tag, AlertTriangle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface PendingProduct {
  id: string;
  name: string;
  vendorName: string;
  category: string;
  price: number;
  mrp: number;
  barcode: string;
  submittedDate: string;
  status: "Pending Review" | "Approved" | "Rejected";
  rejectionReason?: string;
}

export function MarketplaceProductApprovals() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [products, setProducts] = useState<PendingProduct[]>([
    {
      id: "PROD-SUB-801",
      name: "Ergonomic Mesh Gaming Chair with Lumbar Support",
      vendorName: "Urban Retail Group",
      category: "Furniture",
      price: 219.00,
      mrp: 279.00,
      barcode: "8901234567891",
      submittedDate: "2026-08-15",
      status: "Pending Review",
    },
    {
      id: "PROD-SUB-802",
      name: "Wireless Mechanical Keyboard RGB Hot-Swappable",
      vendorName: "Apex Tech Solutions",
      category: "Electronics",
      price: 115.00,
      mrp: 149.00,
      barcode: "8901234567892",
      submittedDate: "2026-08-14",
      status: "Approved",
    },
    {
      id: "PROD-SUB-803",
      name: "Heavy-Duty Hydraulic Jack 5-Ton",
      vendorName: "Nexus Supply Chain",
      category: "Industrial Tools",
      price: 185.00,
      mrp: 220.00,
      barcode: "8901234567893",
      submittedDate: "2026-08-13",
      status: "Pending Review",
    },
  ]);

  React.useEffect(() => {
    import("@/lib/marketplace-api").then(({ marketplaceApi }) => {
      marketplaceApi.getProductApprovals().then(data => {
        if (data.approvals && data.approvals.length > 0) {
          setProducts(data.approvals.map((p: any) => ({
            id: p.id,
            name: p.title,
            vendorName: p.vendorName || "Marketplace Seller",
            category: p.category || "General",
            price: p.price || 99.0,
            mrp: (p.price || 99.0) * 1.25,
            barcode: `8901234${p.id.slice(-6)}`,
            submittedDate: "2026-08-15",
            status: p.status === "Approved" ? "Approved" : (p.status === "Rejected" ? "Rejected" : "Pending Review"),
          })));
        }
      }).catch(() => {});
    });
  }, []);

  const updateStatus = async (id: string, newStatus: PendingProduct["status"]) => {
    try {
      const { marketplaceApi } = await import("@/lib/marketplace-api");
      const action = newStatus === "Approved" ? "approve" : "reject";
      await marketplaceApi.approveRejectProduct(id, action);
      setProducts(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    } catch {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    }
  };

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace Product Submission Approvals</h1>
          <p className="text-sm text-muted-foreground">Review incoming vendor product listings, verify compliance, pricing integrity, and publish to storefront.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm font-medium focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="pending review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((prod, i) => (
          <motion.div
            key={prod.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-panel p-5 rounded-xl border border-border/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-primary/20 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="size-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0 border border-primary/20">
                <Package className="size-7" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{prod.id}</span>
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                    prod.status === "Approved" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                    prod.status === "Pending Review" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" :
                    "bg-red-500/10 text-red-600 border border-red-500/20"
                  )}>
                    {prod.status}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground text-base leading-snug">{prod.name}</h3>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Vendor: <strong className="text-foreground">{prod.vendorName}</strong></span>
                  <span>Category: <strong className="text-foreground">{prod.category}</strong></span>
                  <span>Submitted: <strong className="text-foreground">{prod.submittedDate}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-border/40">
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground uppercase block">List Price / MRP</span>
                <span className="font-bold text-foreground text-base font-mono text-emerald-500">${prod.price.toFixed(2)}</span>
                <span className="text-xs line-through text-muted-foreground ml-1 font-mono">${prod.mrp.toFixed(2)}</span>
              </div>

              <div className="flex items-center gap-2">
                {prod.status !== "Approved" && (
                  <button 
                    onClick={() => updateStatus(prod.id, "Approved")}
                    className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <CheckCircle2 className="size-3.5" /> Approve
                  </button>
                )}
                {prod.status !== "Rejected" && (
                  <button 
                    onClick={() => updateStatus(prod.id, "Rejected")}
                    className="px-3.5 py-1.5 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-red-500/20"
                  >
                    <XCircle className="size-3.5" /> Reject
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
