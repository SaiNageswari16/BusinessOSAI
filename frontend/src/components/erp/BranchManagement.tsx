import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search, Filter, Plus, MapPin, Users, Building2, ExternalLink,
  Edit2, Trash2, X, Save, Loader2, AlertCircle, Phone, Mail, CheckCircle,
} from "lucide-react";
import { branchesApi, companiesApi, type Branch, type Company } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/hooks/use-currency";

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium",
      active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground",
    )}>
      <span className={cn("size-1.5 rounded-full", active ? "bg-emerald-500" : "bg-muted-foreground")} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function BranchFormModal({
  branch, companies, onClose, onSaved,
}: {
  branch: Branch | null;
  companies: Company[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!branch;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_id: branch?.company_id ?? (companies[0]?.id ?? ""),
    code: branch?.code ?? "",
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    city: branch?.city ?? "",
    state: branch?.state ?? "",
    country: branch?.country ?? "India",
    phone: branch?.phone ?? "",
    email: branch?.email ?? "",
    has_warehouse: branch?.has_warehouse ?? false,
    working_hours: branch?.working_hours ?? "",
    status: branch?.status ?? "active",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await branchesApi.update(branch.id, form);
        toast.success("Branch updated");
      } else {
        await branchesApi.create(form);
        toast.success("Branch created");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save branch");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Building2 className="size-5 text-primary" />{isEdit ? "Edit Branch" : "Add Branch"}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Company *</label>
              <select value={form.company_id} onChange={set("company_id")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Branch Code *</label>
              <input value={form.code} onChange={set("code")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                placeholder="BLR-001" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Branch Name *</label>
              <input value={form.name} onChange={set("name")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Bangalore HQ" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Phone</label>
              <input value={form.phone} onChange={set("phone")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={set("email")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="branch@company.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">City</label>
              <input value={form.city} onChange={set("city")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">State</label>
              <input value={form.state} onChange={set("state")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Working Hours</label>
              <input value={form.working_hours} onChange={set("working_hours")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="9am - 6pm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Status</label>
              <select value={form.status} onChange={set("status")}
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5">Address</label>
              <textarea value={form.address} onChange={set("address")} rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <input type="checkbox" id="has_warehouse" checked={form.has_warehouse}
                onChange={(e) => setForm((p) => ({ ...p, has_warehouse: e.target.checked }))}
                className="size-4 rounded" />
              <label htmlFor="has_warehouse" className="text-sm font-medium">Has Warehouse</label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gradient-brand text-white border-0 min-w-[100px]">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-4 mr-1.5" />{isEdit ? "Update" : "Create"}</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function BranchManagement() {
    const { currency, formatCurrency } = useCurrency();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [deleteBranch, setDeleteBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [brRes, coRes] = await Promise.all([
        branchesApi.list(1, 50, search || undefined),
        companiesApi.list(1, 100),
      ]);
      setBranches(brRes.items);
      setTotal(brRes.total);
      setCompanies(coRes.items);
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { void load(); }, []);

  const handleDelete = async () => {
    if (!deleteBranch) return;
    setDeleting(true);
    try {
      await branchesApi.delete(deleteBranch.id);
      toast.success("Branch deleted");
      setDeleteBranch(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Branch Management</h2>
          <p className="text-muted-foreground text-xs mt-0.5">Manage physical locations, warehouses, and branch-level settings.</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 gradient-brand text-white border-0 text-xs font-semibold"
          onClick={() => { setEditBranch(null); setShowForm(true); }}>
          <Plus className="size-3.5" /> Add Branch
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-9 pr-3 text-xs rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="Search branches..." />
        </div>
        <Button variant="outline" className="h-10 gap-2"><Filter className="size-4" /> Filters</Button>
        <span className="text-xs text-muted-foreground">{total} branches</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-48 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : branches.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Building2 className="size-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">No branches yet</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0"
            onClick={() => { setEditBranch(null); setShowForm(true); }}>
            <Plus className="size-4 mr-1" /> Create First Branch
          </Button>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Branch Name</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Code</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Company</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Address & City</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Contact</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">Warehouse</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Working Hours</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 font-medium">
                {branches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-xl bg-purple-50 text-purple-700 font-bold flex items-center justify-center shrink-0 border border-purple-100">
                          <Building2 className="size-4" />
                        </div>
                        <div className="font-bold text-foreground text-sm">{branch.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-700">{branch.code}</td>
                    <td className="px-6 py-4 text-slate-800 font-medium">{companyMap[branch.company_id] ?? "—"}</td>
                    <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">
                      {branch.address ? `${branch.address}${branch.city ? `, ${branch.city}` : ""}` : "—"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div>{branch.phone || "—"}</div>
                      {branch.email && <div className="text-[11px] text-slate-400">{branch.email}</div>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {branch.has_warehouse ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          <CheckCircle className="size-3" /> Yes
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{branch.working_hours || "—"}</td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={branch.status} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-700 hover:bg-purple-50"
                          onClick={() => { setEditBranch(branch); setShowForm(true); }}>
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                          onClick={() => setDeleteBranch(branch)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <BranchFormModal
            branch={editBranch}
            companies={companies}
            onClose={() => { setShowForm(false); setEditBranch(null); }}
            onSaved={load}
          />
        )}
        {deleteBranch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete Branch</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Delete <span className="font-semibold text-foreground">{deleteBranch.name}</span>? This cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteBranch(null)}>Cancel</Button>
                <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                  {deleting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Trash2 className="size-4 mr-1" />} Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
