import { useState, useEffect, useCallback, useMemo, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Search, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle,
  Briefcase, Building2, Calendar, Clock, List, LayoutGrid,
  RefreshCw, CheckCircle2, Award
} from "lucide-react";
import { designationsApi, companiesApi, type Designation, type Company } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/i18n-context";

const LEVEL_OPTIONS = ["C-Suite", "Director", "VP", "Senior Manager", "Manager", "Senior", "Mid", "Junior", "Intern", "Associate"];

const LEVEL_COLORS: Record<string, string> = {
  "C-Suite": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "Director": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "VP": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  "Senior Manager": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  "Manager": "bg-teal-500/10 text-teal-600 border-teal-500/20",
  "Senior": "bg-green-500/10 text-green-600 border-green-500/20",
  "Mid": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "Junior": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "Intern": "bg-rose-500/10 text-rose-600 border-rose-500/20",
  "Associate": "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

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

function DesignationFormModal({
  desig,
  companies,
  onClose,
  onSaved,
}: {
  desig: Designation | null;
  companies: Company[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const isEdit = !!desig;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_id: desig?.company_id ?? (companies[0]?.id ?? ""),
    name: desig?.name ?? "",
    level: desig?.level ?? "",
    status: desig?.status ?? "active",
  });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.company_id) {
      toast.error("Please fill in Company and Designation Name");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await designationsApi.update(desig.id, form);
        toast.success("Designation updated successfully");
      } else {
        await designationsApi.create(form);
        toast.success("Designation created successfully");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save designation");
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
              <Briefcase className="size-4" />
            </div>
            {isEdit ? "Edit Designation" : "Add Designation"}
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
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Designation Title *</label>
            <input
              value={form.name}
              onChange={set("name")}
              required
              className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-medium outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. Senior Accountant"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Seniority Level</label>
              <select
                value={form.level}
                onChange={set("level")}
                className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-medium outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select level</option>
                {LEVEL_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
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
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gradient-brand text-white border-0 h-9 text-xs font-semibold min-w-[110px]">
              {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
              {isEdit ? "Update Designation" : "Create Designation"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function DesignationManagement() {
  const { t } = useI18n();
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [showForm, setShowForm] = useState(false);
  const [editDesig, setEditDesig] = useState<Designation | null>(null);
  const [deleteDesig, setDeleteDesig] = useState<Designation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, cRes] = await Promise.all([
        designationsApi.list(1, 100),
        companiesApi.list(1, 100).catch(() => ({ items: [] })),
      ]);
      setDesignations(dRes.items || []);
      setCompanies(cRes.items || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load designations");
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

  const filtered = useMemo(() => {
    return designations.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.level || "").toLowerCase().includes(search.toLowerCase()) ||
        (companyMap[d.company_id] || "").toLowerCase().includes(search.toLowerCase());
      const matchesCompany = selectedCompanyId === "all" || d.company_id === selectedCompanyId;
      const matchesLevel = selectedLevel === "all" || d.level === selectedLevel;
      return matchesSearch && matchesCompany && matchesLevel;
    });
  }, [designations, search, selectedCompanyId, selectedLevel, companyMap]);

  const stats = useMemo(() => {
    const total = designations.length;
    const active = designations.filter((d) => (d.status || "").toLowerCase() === "active").length;
    const uniqueLevels = new Set(designations.map((d) => d.level).filter(Boolean)).size;
    const uniqueCompanies = new Set(designations.map((d) => d.company_id).filter(Boolean)).size;
    return { total, active, uniqueLevels, uniqueCompanies };
  }, [designations]);

  const handleDelete = async () => {
    if (!deleteDesig) return;
    setDeleting(true);
    try {
      await designationsApi.delete(deleteDesig.id);
      toast.success("Designation deleted successfully");
      setDeleteDesig(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete designation");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Top Header ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="size-4.5 text-primary" />
            {t("Designation & Role Management", "Designation & Role Management")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("Define organizational job titles, seniority levels, and corporate hierarchy.", "Define organizational job titles, seniority levels, and corporate hierarchy.")}
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
              setEditDesig(null);
              setShowForm(true);
            }}
          >
            <Plus className="size-3.5" /> {t("Add Designation", "Add Designation")}
          </Button>
        </div>
      </div>

      {/* ─── Summary Metric KPI Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="p-3.5 bg-card/60 backdrop-blur-xs border shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 flex items-center justify-center font-bold shrink-0">
            <Briefcase className="size-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase">Total Designations</div>
            <div className="text-lg font-black text-foreground">{stats.total}</div>
          </div>
        </Card>

        <Card className="p-3.5 bg-card/60 backdrop-blur-xs border shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 className="size-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase">Active Roles</div>
            <div className="text-lg font-black text-foreground">{stats.active}</div>
          </div>
        </Card>

        <Card className="p-3.5 bg-card/60 backdrop-blur-xs border shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 flex items-center justify-center font-bold shrink-0">
            <Award className="size-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase">Seniority Levels</div>
            <div className="text-lg font-black text-foreground">{stats.uniqueLevels}</div>
          </div>
        </Card>

        <Card className="p-3.5 bg-card/60 backdrop-blur-xs border shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 flex items-center justify-center font-bold shrink-0">
            <Building2 className="size-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase">Companies</div>
            <div className="text-lg font-black text-foreground">{stats.uniqueCompanies}</div>
          </div>
        </Card>
      </div>

      {/* ─── Search, Filter, and View Mode Bar ─── */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between p-3 rounded-xl bg-card border shadow-xs">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8.5 pr-3 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder={t("Search designations, levels...", "Search designations, levels...")}
            />
          </div>

          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="h-8 px-2.5 text-xs rounded-lg border bg-background font-medium shrink-0"
          >
            <option value="all">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="h-8 px-2.5 text-xs rounded-lg border bg-background font-medium shrink-0"
          >
            <option value="all">All Levels</option>
            {LEVEL_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-muted-foreground font-semibold px-2">
            {filtered.length} {filtered.length === 1 ? "designation" : "designations"}
          </span>

          <div className="flex items-center rounded-lg border bg-background p-0.5">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors",
                viewMode === "table" ? "bg-primary text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              title="Table View"
            >
              <List className="size-3.5" />
              <span className="hidden sm:inline text-[11px]">Table</span>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors",
                viewMode === "grid" ? "bg-primary text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              title="Grid / Card View"
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline text-[11px]">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Content: Table or Grid ─── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border rounded-2xl">
          <Briefcase className="size-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-semibold text-foreground">{t("No designations found", "No designations found")}</p>
          <p className="text-xs mt-1">Try adjusting your filters or add a new designation.</p>
          <Button
            size="sm"
            className="mt-4 gradient-brand text-white border-0 text-xs font-bold"
            onClick={() => {
              setEditDesig(null);
              setShowForm(true);
            }}
          >
            <Plus className="size-3.5 mr-1" /> {t("Add Designation", "Add Designation")}
          </Button>
        </div>
      ) : viewMode === "table" ? (
        <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-border/70 text-muted-foreground text-[11px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Designation Title</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Operating Company</th>
                  <th className="px-5 py-3.5 text-center whitespace-nowrap">Seniority Level</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Created Date</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Last Updated</th>
                  <th className="px-5 py-3.5 text-center whitespace-nowrap">Status</th>
                  <th className="px-5 py-3.5 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {filtered.map((desig) => (
                  <tr key={desig.id} className="hover:bg-muted/30 transition-colors group">
                    {/* Designation Title & Identifier */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="size-8.5 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 flex items-center justify-center font-bold shrink-0">
                          <Briefcase className="size-4" />
                        </div>
                        <div>
                          <div className="font-bold text-foreground text-xs">{desig.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground font-semibold mt-0.5">
                            ID: {desig.id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Operating Company */}
                    <td className="px-5 py-3.5 text-muted-foreground">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                        <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                        {companyMap[desig.company_id] ?? "Primary Company"}
                      </div>
                    </td>

                    {/* Seniority Level */}
                    <td className="px-5 py-3.5 text-center">
                      {desig.level ? (
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border",
                            LEVEL_COLORS[desig.level] || "bg-muted text-muted-foreground border-border/50"
                          )}
                        >
                          {desig.level}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                        <span>{formatDateTime(desig.created_at)}</span>
                      </div>
                    </td>

                    {/* Last Updated */}
                    <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Clock className="size-3 text-muted-foreground shrink-0" />
                        <span>{formatDate(desig.updated_at || desig.created_at)}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5 text-center">
                      <StatusBadge status={desig.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7.5 w-7.5 text-purple-700 hover:bg-purple-50"
                          onClick={() => {
                            setEditDesig(desig);
                            setShowForm(true);
                          }}
                          title="Edit Designation"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7.5 w-7.5 text-rose-500 hover:bg-rose-50"
                          onClick={() => setDeleteDesig(desig)}
                          title="Delete Designation"
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
      ) : (
        /* Grid / Card View Mode */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((desig) => (
            <Card key={desig.id} className="p-4 hover:shadow-md transition-shadow group flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="size-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 flex items-center justify-center">
                    <Briefcase className="size-4.5" />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => {
                        setEditDesig(desig);
                        setShowForm(true);
                      }}
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-red-500"
                      onClick={() => setDeleteDesig(desig)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-foreground mb-1">{desig.name}</h3>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <Building2 className="size-3" />
                  {companyMap[desig.company_id] ?? "—"}
                </div>

                <div className="py-2 border-t border-border/50 text-[11px] text-muted-foreground space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Created:</span>
                    <span className="font-medium text-foreground">{formatDate(desig.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                {desig.level ? (
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      LEVEL_COLORS[desig.level] || "bg-muted text-muted-foreground"
                    )}
                  >
                    {desig.level}
                  </span>
                ) : (
                  <span />
                )}
                <StatusBadge status={desig.status} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Modals ─── */}
      <AnimatePresence>
        {showForm && (
          <DesignationFormModal
            desig={editDesig}
            companies={companies}
            onClose={() => {
              setShowForm(false);
              setEditDesig(null);
            }}
            onSaved={load}
          />
        )}

        {deleteDesig && (
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
                <h3 className="font-bold">{t("Delete Designation", "Delete Designation")}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete <span className="font-semibold text-foreground">{deleteDesig.name}</span>?
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteDesig(null)}>
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
