import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, Plus, Building2, Edit2, Trash, Star, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { inventoryApi } from "../../lib/api-client";
import { SupplierForm } from "./SupplierForm";
import { AddVendorModal } from "./AddVendorModal";
import { useCurrency } from "@/hooks/use-currency";
import { PaginationControl } from "@/components/ui/PaginationControl";

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
  const { currency, formatCurrency } = useCurrency();
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Full-page form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  const handleMergeDuplicates = async () => {
    setIsMerging(true);
    const toastId = toast.loading("Checking and consolidating duplicate vendors...");
    try {
      const res = await inventoryApi.mergeDuplicateSuppliers();
      if (res.merged_count > 0) {
        toast.success(res.message || `Consolidated ${res.merged_count} duplicate vendor(s).`, { id: toastId });
        await fetchSuppliers();
      } else {
        toast.info("No duplicate vendors found. Master directory is clean!", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to consolidate duplicate vendors", { id: toastId });
    } finally {
      setIsMerging(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

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

  useEffect(() => {
    fetchSuppliers();
  }, [search, statusFilter]);

  const handleOpenNew = () => {
    setSelectedSupplierId(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (s: SupplierItem) => {
    setSelectedSupplierId(s.id);
    setIsFormOpen(true);
  };
  if (isFormOpen) {
    return (
      <SupplierForm
        supplierId={selectedSupplierId}
        onClose={() => setIsFormOpen(false)}
        onSaved={fetchSuppliers}
      />
    );
  }

  const handleDelete = async (supplier: SupplierItem) => {
    if (deletingId) return;
    if (!confirm(`Are you sure you want to delete supplier "${supplier.name}"?`)) return;

    setDeletingId(supplier.id);
    const toastId = toast.loading(`Deleting supplier "${supplier.name}"...`);

    try {
      await inventoryApi.deleteSupplier(supplier.id);
      toast.success("Supplier deleted successfully", { id: toastId });
      await fetchSuppliers();
    } catch (err: any) {
      const errMsg = err?.message || err?.detail || "Failed to delete supplier";
      if (
        errMsg.toLowerCase().includes("force") ||
        errMsg.toLowerCase().includes("bills") ||
        errMsg.toLowerCase().includes("purchase")
      ) {
        toast.dismiss(toastId);
        if (
          confirm(
            `${errMsg}\n\nDo you want to force delete this supplier (unlinks cancelled purchase bills)?`
          )
        ) {
          const forceToastId = toast.loading("Force deleting supplier...");
          try {
            await inventoryApi.deleteSupplier(supplier.id, true);
            toast.success("Supplier deleted successfully", { id: forceToastId });
            await fetchSuppliers();
          } catch (forceErr: any) {
            toast.error(forceErr?.message || "Failed to force delete supplier", { id: forceToastId });
          }
        }
      } else {
        toast.error(errMsg, { id: toastId });
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Suppliers & Vendors
          </h2>
          <p className="text-sm text-muted-foreground">Manage your master supplier directory, tax GSTINs, credit limits, and bank accounts.</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleMergeDuplicates}
            variant="outline"
            disabled={isMerging}
            className="border-amber-200 text-amber-700 bg-amber-50/50 hover:bg-amber-100 font-semibold rounded-lg shadow-sm"
            title="Consolidate duplicate vendors with same GSTIN or name"
          >
            {isMerging ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Building2 className="size-4 mr-2" />}
            Consolidate Duplicates
          </Button>
          <Button onClick={() => setIsQuickAddOpen(true)} variant="outline" className="border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-100 font-semibold rounded-lg shadow-sm">
            <Plus className="size-4 mr-2" /> Quick Add Vendor
          </Button>
          <Button onClick={handleOpenNew} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
            <Plus className="size-4 mr-2" /> Onboard Supplier Party
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
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
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
                    No suppliers onboarded yet. Click "+ Onboard Supplier Party" to add one.
                  </td>
                </tr>
              ) : (
                suppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((supplier) => (
                  <tr 
                    key={supplier.id} 
                    className={`hover:bg-muted/30 transition-colors ${
                      deletingId === supplier.id ? "opacity-50 pointer-events-none bg-rose-50/20" : ""
                    }`}
                  >
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
                        {supplier.category_name || "General Supplier"}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-bold">
                      {currency.symbol}{supplier.credit_limit.toLocaleString("en-IN")}
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
                          disabled={Boolean(deletingId)}
                          className="h-8 w-8 text-primary hover:bg-muted disabled:opacity-40"
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        <Button 
                          onClick={() => handleDelete(supplier)} 
                          variant="ghost" 
                          size="icon" 
                          disabled={Boolean(deletingId)}
                          title={deletingId === supplier.id ? "Deleting supplier..." : "Delete Supplier"}
                          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          {deletingId === supplier.id ? (
                            <Loader2 className="size-4 animate-spin text-rose-600" />
                          ) : (
                            <Trash className="size-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationControl
          currentPage={currentPage}
          totalPages={Math.max(1, Math.ceil(suppliers.length / pageSize))}
          totalItems={suppliers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="suppliers"
        />
      </div>

      {/* Quick Add Vendor Modal */}
      <AddVendorModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onVendorCreated={() => {
          fetchSuppliers();
        }}
      />
    </div>
  );
}
