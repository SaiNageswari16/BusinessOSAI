import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Building2, Edit2, Trash, Star, Loader2, X } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

interface SupplierItem {
  id: string;
  name: string;
  code: string;
  type: string;
  products_desc?: string;
  credit_limit: number;
  rating: number;
  status: string;
  company_name?: string;
  category_id?: string;
  category_name?: string;
}

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Dialog state
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("Manufacturer");
  const [companyName, setCompanyName] = useState("");
  const [creditLimit, setCreditLimit] = useState(1000000);
  const [rating, setRating] = useState(5.0);
  const [productsDesc, setProductsDesc] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [statusVal, setStatusVal] = useState("Active");

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getSuppliers({
        search: search.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined
      });
      setSuppliers(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch suppliers");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await inventoryApi.getSupplierCategories();
      setCategories(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [search, statusFilter]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenNew = () => {
    setIsEditing(false);
    setEditingId(null);
    setName("");
    setCode(`VEN-${Math.floor(100 + Math.random() * 900)}`);
    setType("Manufacturer");
    setCompanyName("");
    setCreditLimit(1000000);
    setRating(5.0);
    setProductsDesc("");
    setCategoryId(categories[0]?.id || "");
    setStatusVal("Active");
    setIsOpen(true);
  };

  const handleOpenEdit = (s: SupplierItem) => {
    setIsEditing(true);
    setEditingId(s.id);
    setName(s.name);
    setCode(s.code);
    setType(s.type);
    setCompanyName(s.company_name || "");
    setCreditLimit(s.credit_limit);
    setRating(s.rating);
    setProductsDesc(s.products_desc || "");
    setCategoryId(s.category_id || "");
    setStatusVal(s.status);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Supplier name is required");
    
    try {
      const payload = {
        name,
        code,
        type,
        company_name: companyName || name,
        credit_limit: Number(creditLimit),
        rating: Number(rating),
        products_desc: productsDesc,
        category_id: categoryId || undefined,
        status: statusVal
      };

      if (isEditing && editingId) {
        await inventoryApi.updateSupplier(editingId, payload);
        toast.success("Supplier updated successfully");
      } else {
        await inventoryApi.createSupplier(payload);
        toast.success("Supplier onboarded successfully");
      }
      setIsOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message || "Failed to save supplier");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    try {
      await inventoryApi.deleteSupplier(id);
      toast.success("Supplier deleted successfully");
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete supplier");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="text-primary size-6" /> Suppliers
          </h2>
          <p className="text-sm text-muted-foreground">Manage your master supplier list, profiles, and credit limits.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOpenNew} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
            <Plus className="size-4 mr-2" /> Onboard Supplier
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30" 
            placeholder="Search suppliers by name or code..." 
          />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-card border rounded-lg text-xs text-foreground py-2 px-4 focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Data Grid */}
      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                <th className="py-4 px-6">Supplier Profile</th>
                <th className="py-4 px-6">Supplier Code</th>
                <th className="py-4 px-6">Type & Category</th>
                <th className="py-4 px-6">Credit Limit</th>
                <th className="py-4 px-6">Rating</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-foreground">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground font-semibold">
                    No suppliers onboarded yet. Click "Onboard Supplier" to add one.
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                          <Building2 className="size-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-bold">{supplier.name}</div>
                          {supplier.company_name && (
                            <div className="text-xs text-muted-foreground mt-0.5">{supplier.company_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-mono font-bold text-xs text-primary">{supplier.code}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-xs bg-muted px-2 py-0.5 rounded w-fit mb-1">
                        {supplier.type}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                        {supplier.category_name || "General"}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-bold">
                      ₹{supplier.credit_limit.toLocaleString("en-IN")}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1 font-bold text-amber-500">
                        <Star className="size-3 fill-amber-500" /> {Number(supplier.rating).toFixed(1)}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        supplier.status === "Active" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                      }`}>
                        <span className={`size-1.5 rounded-full ${supplier.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {supplier.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          onClick={() => handleOpenEdit(supplier)} 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-primary hover:bg-muted"
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        <Button 
                          onClick={() => handleDelete(supplier.id)} 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <Trash className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4 text-foreground">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                {isEditing ? "Modify Supplier Profile" : "Onboard New Supplier"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-muted-foreground">Supplier / Vendor Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Acme Industries Ltd"
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Supplier Code *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Supplier Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="Manufacturer">Manufacturer</option>
                    <option value="Distributor">Distributor</option>
                    <option value="Service Provider">Service Provider</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Credit Limit (₹)</label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Initial Rating (1-5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Status</label>
                  <select
                    value={statusVal}
                    onChange={(e) => setStatusVal(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-muted-foreground">Products & Brands Supplied</label>
                  <textarea
                    value={productsDesc}
                    onChange={(e) => setProductsDesc(e.target.value)}
                    placeholder="e.g. FMCG products, soaps, Colgate, Detergents..."
                    rows={3}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm resize-none focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" onClick={() => setIsOpen(false)} variant="outline" className="rounded-lg">
                  Cancel
                </Button>
                <Button type="submit" className="gradient-brand text-white border-0 font-semibold rounded-lg">
                  {isEditing ? "Apply Changes" : "Confirm Onboard"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
