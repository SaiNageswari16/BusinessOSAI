import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Search, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle,
  Network, ChevronRight, Building2,
} from "lucide-react";
import { departmentsApi, companiesApi, type Department, type Company } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
      status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground",
    )}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function DepartmentFormModal({
  dept, companies, allDepts, onClose, onSaved,
}: {
  dept: Department | null;
  companies: Company[];
  allDepts: Department[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!dept;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_id: dept?.company_id ?? (companies[0]?.id ?? ""),
    name: dept?.name ?? "",
    code: dept?.code ?? "",
    parent_id: dept?.parent_id ?? "",
    status: dept?.status ?? "active",
  });
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, parent_id: form.parent_id || null };
      if (isEdit) { await departmentsApi.update(dept.id, payload); toast.success("Department updated"); }
      else { await departmentsApi.create(payload); toast.success("Department created"); }
      onSaved(); onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save department");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Network className="size-5 text-primary" />{isEdit ? "Edit Department" : "Add Department"}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Company *</label>
            <select value={form.company_id} onChange={set("company_id")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Name *</label>
              <input value={form.name} onChange={set("name")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Engineering" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Code *</label>
              <input value={form.code} onChange={set("code")} required
                className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                placeholder="ENG" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Parent Department</label>
            <select value={form.parent_id} onChange={set("parent_id")}
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">None (Root department)</option>
              {allDepts.filter((d) => d.id !== dept?.id).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Status</label>
            <select value={form.status} onChange={set("status")}
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
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

export function DepartmentManagement() {
  const [depts, setDepts] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, cRes] = await Promise.all([departmentsApi.list(1, 100), companiesApi.list(1, 100)]);
      setDepts(dRes.items);
      setCompanies(cRes.items);
    } catch (err) { console.error(err instanceof Error ? err.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, []);

  const filtered = depts.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.code.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async () => {
    if (!deleteDept) return;
    setDeleting(true);
    try {
      await departmentsApi.delete(deleteDept.id);
      toast.success("Department deleted");
      setDeleteDept(null);
      void load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete"); }
    finally { setDeleting(false); }
  };

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));
  const deptMap = Object.fromEntries(depts.map((d) => [d.id, d.name]));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold tracking-tight">Department Management</h2>
          <p className="text-muted-foreground text-xs mt-0.5">Manage organizational departments and their hierarchies.</p>
        </div>
        <Button size="sm" className="h-8 gradient-brand text-white border-0 gap-1.5 text-xs font-semibold"
          onClick={() => { setEditDept(null); setShowForm(true); }}>
          <Plus className="size-3.5" /> Add Department
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-9 pr-3 text-xs rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="Search departments..." />
        </div>
        <span className="text-xs text-muted-foreground">{depts.length} total</span>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-xl border bg-muted/30 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Network className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No departments yet</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditDept(null); setShowForm(true); }}>
            <Plus className="size-4 mr-1" /> Create First Department
          </Button>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Department</th>
                <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Company</th>
                <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Parent</th>
                <th className="px-6 py-3 text-left font-semibold text-muted-foreground text-xs">Status</th>
                <th className="px-6 py-3 text-right font-semibold text-muted-foreground text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((dept) => (
                <tr key={dept.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
                        <Network className="size-4" />
                      </div>
                      <div>
                        <div className="font-semibold">{dept.name}</div>
                        <div className="text-xs font-mono text-muted-foreground">{dept.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="size-3.5" />{companyMap[dept.company_id] ?? "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {dept.parent_id ? (
                      <div className="flex items-center gap-1.5"><ChevronRight className="size-3.5" />{deptMap[dept.parent_id] ?? dept.parent_id.slice(0, 8)}</div>
                    ) : <span className="text-xs">Root</span>}
                  </td>
                  <td className="px-6 py-4"><StatusBadge status={dept.status} /></td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => { setEditDept(dept); setShowForm(true); }}><Edit2 className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600" onClick={() => setDeleteDept(dept)}><Trash2 className="size-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <AnimatePresence>
        {showForm && (
          <DepartmentFormModal
            dept={editDept} companies={companies} allDepts={depts}
            onClose={() => { setShowForm(false); setEditDept(null); }}
            onSaved={load}
          />
        )}
        {deleteDept && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">Delete Department</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Delete <span className="font-semibold text-foreground">{deleteDept.name}</span>? Sub-departments may be affected.</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteDept(null)}>Cancel</Button>
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
