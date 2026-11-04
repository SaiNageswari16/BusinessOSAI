import { useState, useEffect, useCallback, useMemo, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Search, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle,
  Network, ChevronRight, Building2, Calendar, Clock, RefreshCw, CheckCircle2
} from "lucide-react";
import { departmentsApi, companiesApi, type Department, type Company } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/i18n-context";

function StatusBadge({ status }: { status: string }) {
  const active = (status || "").toLowerCase() === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide",
        active
          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
          : "bg-muted text-muted-foreground border border-border/50"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
        )}
      />
      {status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "Active"}
    </span>
  );
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function DepartmentFormModal({
  dept,
  companies,
  allDepts,
  onClose,
  onSaved,
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
      if (isEdit) {
        await departmentsApi.update(dept.id, payload);
        toast.success("Department updated successfully");
      } else {
        await departmentsApi.create(payload);
        toast.success("Department created successfully");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save department");
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
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="font-bold text-base flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Network className="size-4" />
            </div>
            {isEdit ? "Edit Department" : "Add Department"}
          </h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Operating Company *</label>
            <select
              value={form.company_id}
              onChange={set("company_id")}
              required
              className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-medium outline-none focus:ring-2 focus:ring-primary/20"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Name *</label>
              <input
                value={form.name}
                onChange={set("name")}
                required
                className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-medium outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Engineering"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Code *</label>
              <input
                value={form.code}
                onChange={set("code")}
                required
                className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-mono font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="ENG"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Parent Department</label>
            <select
              value={form.parent_id}
              onChange={set("parent_id")}
              className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-medium outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">None (Root Department)</option>
              {allDepts
                .filter((d) => d.id !== dept?.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={set("status")}
              className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-semibold outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gradient-brand text-white border-0 h-9 text-xs font-semibold min-w-[110px]">
              {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
              {isEdit ? "Update Department" : "Create Department"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function DepartmentManagement() {
  const { t } = useI18n();
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
      const [dRes, cRes] = await Promise.all([
        departmentsApi.list(1, 100),
        companiesApi.list(1, 100).catch(() => ({ items: [] })),
      ]);
      setDepts(dRes.items || []);
      setCompanies(cRes.items || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load departments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const companyMap = useMemo(() => {
    return Object.fromEntries(companies.map((c) => [c.id, c.name]));
  }, [companies]);

  const deptMap = useMemo(() => {
    return Object.fromEntries(depts.map((d) => [d.id, d.name]));
  }, [depts]);

  const filtered = useMemo(() => {
    return depts.filter(
      (d) =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.code.toLowerCase().includes(search.toLowerCase()) ||
        (companyMap[d.company_id] || "").toLowerCase().includes(search.toLowerCase())
    );
  }, [depts, search, companyMap]);

  const handleDelete = async () => {
    if (!deleteDept) return;
    setDeleting(true);
    try {
      await departmentsApi.delete(deleteDept.id);
      toast.success("Department deleted successfully");
      setDeleteDept(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete department");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Network className="size-4.5 text-primary" />
            {t("Department Management", "Department Management")}
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            {t("Manage organizational departments and hierarchical reporting lines.", "Manage organizational departments and hierarchical reporting lines.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load()}
            className="h-8 gap-1.5 text-xs font-semibold"
            title="Refresh"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="h-8 gradient-brand text-white border-0 gap-1.5 text-xs font-semibold shadow-xs"
            onClick={() => {
              setEditDept(null);
              setShowForm(true);
            }}
          >
            <Plus className="size-3.5" /> {t("Add Department", "Add Department")}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8.5 pl-9 pr-3 text-xs rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder={t("Search departments by name, code...", "Search departments by name, code...")}
          />
        </div>
        <span className="text-xs text-muted-foreground font-semibold">{depts.length} departments</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border rounded-2xl">
          <Network className="size-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-semibold text-foreground">{t("No departments yet", "No departments yet")}</p>
          <Button
            size="sm"
            className="mt-4 gradient-brand text-white border-0 text-xs font-bold"
            onClick={() => {
              setEditDept(null);
              setShowForm(true);
            }}
          >
            <Plus className="size-3.5 mr-1" /> {t("Create First Department", "Create First Department")}
          </Button>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-border/70 text-muted-foreground text-[11px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Department & Code</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Operating Company</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Parent Hierarchy</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Created Date</th>
                  <th className="px-5 py-3.5 text-center whitespace-nowrap">Status</th>
                  <th className="px-5 py-3.5 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {filtered.map((dept) => (
                  <tr key={dept.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="size-8.5 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 flex items-center justify-center font-bold shrink-0">
                          <Network className="size-4" />
                        </div>
                        <div>
                          <div className="font-bold text-foreground text-xs">{dept.name}</div>
                          <div className="font-mono text-[10px] text-purple-700 dark:text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 inline-block mt-0.5">
                            {dept.code}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                        <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                        {companyMap[dept.company_id] ?? "Primary Company"}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {dept.parent_id ? (
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                          <span>{deptMap[dept.parent_id] ?? dept.parent_id.slice(0, 8)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground font-normal">Root Department</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                        <span>{formatDateTime(dept.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <StatusBadge status={dept.status} />
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7.5 w-7.5 text-purple-700 hover:bg-purple-50"
                          onClick={() => {
                            setEditDept(dept);
                            setShowForm(true);
                          }}
                          title="Edit Department"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7.5 w-7.5 text-rose-500 hover:bg-rose-50"
                          onClick={() => setDeleteDept(dept)}
                          title="Delete Department"
                        >
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
          <DepartmentFormModal
            dept={editDept}
            companies={companies}
            allDepts={depts}
            onClose={() => {
              setShowForm(false);
              setEditDept(null);
            }}
            onSaved={load}
          />
        )}
        {deleteDept && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center">
                  <AlertCircle className="size-5" />
                </div>
                <h3 className="font-bold">{t("Delete Department", "Delete Department")}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Delete <span className="font-semibold text-foreground">{deleteDept.name}</span>? Sub-departments may be affected.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteDept(null)}>
                  Cancel
                </Button>
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
