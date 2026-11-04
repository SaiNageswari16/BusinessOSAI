import { useState, useEffect, useCallback, useMemo, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Search, Plus, Edit2, Trash2, X, Save, Loader2, AlertCircle,
  Globe, MapPin, Building2, Calendar, Clock, List, LayoutGrid,
  RefreshCw, CheckCircle2, Navigation
} from "lucide-react";
import { zonesApi, regionsApi, branchesApi, companiesApi, type Zone, type Region, type Branch, type Company } from "@/lib/api-client";
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

function ZoneFormModal({
  zone,
  regions,
  onClose,
  onSaved,
}: {
  zone: Zone | null;
  regions: Region[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const isEdit = !!zone;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    region_id: zone?.region_id ?? (regions[0]?.id ?? ""),
    name: zone?.name ?? "",
    status: zone?.status ?? "active",
  });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.region_id) {
      toast.error("Please fill in Region and Zone Name");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await zonesApi.update(zone.id, form);
        toast.success("Zone updated successfully");
      } else {
        await zonesApi.create(form);
        toast.success("Zone created successfully");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save zone");
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
              <Globe className="size-4" />
            </div>
            {isEdit ? "Edit Sub-Regional Zone" : "Add Sub-Regional Zone"}
          </h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Parent Geographic Region *</label>
            <select
              value={form.region_id}
              onChange={set("region_id")}
              required
              className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-medium outline-none focus:ring-2 focus:ring-primary/20"
            >
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Zone Name *</label>
            <input
              value={form.name}
              onChange={set("name")}
              required
              className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-medium outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. Hyderabad Metro Zone"
            />
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
              {isEdit ? "Update Zone" : "Create Zone"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function Zones() {
  const { t } = useI18n();
  const [zones, setZones] = useState<Zone[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [showForm, setShowForm] = useState(false);
  const [editZone, setEditZone] = useState<Zone | null>(null);
  const [deleteZone, setDeleteZone] = useState<Zone | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [zRes, rRes, bRes, cRes] = await Promise.all([
        zonesApi.list(1, 100),
        regionsApi.list(1, 100).catch(() => ({ items: [] })),
        branchesApi.list(1, 200).catch(() => ({ items: [] })),
        companiesApi.list(1, 100).catch(() => ({ items: [] })),
      ]);
      setZones(zRes.items || []);
      setRegions(rRes.items || []);
      setBranches(bRes.items || []);
      setCompanies(cRes.items || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load zones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const regionMap = useMemo(() => {
    return Object.fromEntries(regions.map((r) => [r.id, r]));
  }, [regions]);

  const companyMap = useMemo(() => {
    return Object.fromEntries(companies.map((c) => [c.id, c.name]));
  }, [companies]);

  // Map branches count and names by zone_id or matching zone_name
  const zoneBranchStats = useMemo(() => {
    const stats: Record<string, { count: number; names: string[] }> = {};
    branches.forEach((b) => {
      const zid = b.zone_id;
      if (zid) {
        if (!stats[zid]) stats[zid] = { count: 0, names: [] };
        stats[zid].count++;
        stats[zid].names.push(b.name);
      }
    });
    return stats;
  }, [branches]);

  const filtered = useMemo(() => {
    return zones.filter((z) => {
      const reg = regionMap[z.region_id];
      const matchesSearch =
        z.name.toLowerCase().includes(search.toLowerCase()) ||
        (reg?.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (reg?.code || "").toLowerCase().includes(search.toLowerCase());
      const matchesRegion = selectedRegionId === "all" || z.region_id === selectedRegionId;
      return matchesSearch && matchesRegion;
    });
  }, [zones, search, selectedRegionId, regionMap]);

  const stats = useMemo(() => {
    const total = zones.length;
    const active = zones.filter((z) => (z.status || "").toLowerCase() === "active").length;
    const uniqueRegions = new Set(zones.map((z) => z.region_id).filter(Boolean)).size;
    const totalBranchesInZones = branches.filter((b) => b.zone_id).length;
    return { total, active, uniqueRegions, totalBranchesInZones };
  }, [zones, branches]);

  const handleDelete = async () => {
    if (!deleteZone) return;
    setDeleting(true);
    try {
      await zonesApi.delete(deleteZone.id);
      toast.success("Zone deleted successfully");
      setDeleteZone(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete zone");
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
            <Globe className="size-4.5 text-primary" />
            {t("Sub-Regional Zones", "Sub-Regional Zones")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("Sub-regional operational territories mapped directly under geographic regions.", "Sub-regional operational territories mapped directly under geographic regions.")}
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
              setEditZone(null);
              setShowForm(true);
            }}
          >
            <Plus className="size-3.5" /> {t("Add Zone", "Add Zone")}
          </Button>
        </div>
      </div>

      {/* ─── Summary Metric KPI Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="p-3.5 bg-card/60 backdrop-blur-xs border shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 flex items-center justify-center font-bold shrink-0">
            <Globe className="size-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase">Total Zones</div>
            <div className="text-lg font-black text-foreground">{stats.total}</div>
          </div>
        </Card>

        <Card className="p-3.5 bg-card/60 backdrop-blur-xs border shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 className="size-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase">Active Zones</div>
            <div className="text-lg font-black text-foreground">{stats.active}</div>
          </div>
        </Card>

        <Card className="p-3.5 bg-card/60 backdrop-blur-xs border shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 flex items-center justify-center font-bold shrink-0">
            <MapPin className="size-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase">Regions Covered</div>
            <div className="text-lg font-black text-foreground">{stats.uniqueRegions}</div>
          </div>
        </Card>

        <Card className="p-3.5 bg-card/60 backdrop-blur-xs border shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 flex items-center justify-center font-bold shrink-0">
            <Navigation className="size-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase">Linked Branches</div>
            <div className="text-lg font-black text-foreground">{stats.totalBranchesInZones}</div>
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
              placeholder={t("Search zones, regions...", "Search zones, regions...")}
            />
          </div>

          <select
            value={selectedRegionId}
            onChange={(e) => setSelectedRegionId(e.target.value)}
            className="h-8 px-2.5 text-xs rounded-lg border bg-background font-medium shrink-0"
          >
            <option value="all">All Regions</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-muted-foreground font-semibold px-2">
            {filtered.length} {filtered.length === 1 ? "zone" : "zones"}
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
          <Globe className="size-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-semibold text-foreground">{t("No zones found", "No zones found")}</p>
          <p className="text-xs mt-1">Try adjusting your search filters or add a new zone.</p>
          <Button
            size="sm"
            className="mt-4 gradient-brand text-white border-0 text-xs font-bold"
            onClick={() => {
              setEditZone(null);
              setShowForm(true);
            }}
          >
            <Plus className="size-3.5 mr-1" /> {t("Add Zone", "Add Zone")}
          </Button>
        </div>
      ) : viewMode === "table" ? (
        <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-border/70 text-muted-foreground text-[11px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Zone Name</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Parent Region</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Operating Company</th>
                  <th className="px-5 py-3.5 text-center whitespace-nowrap">Linked Branches</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Created Date</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Last Updated</th>
                  <th className="px-5 py-3.5 text-center whitespace-nowrap">Status</th>
                  <th className="px-5 py-3.5 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {filtered.map((zone) => {
                  const reg = regionMap[zone.region_id];
                  const bInfo = zoneBranchStats[zone.id];
                  const branchCount = bInfo?.count || 0;
                  return (
                    <tr key={zone.id} className="hover:bg-muted/30 transition-colors group">
                      {/* Zone Name & Identifier */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="size-8.5 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 flex items-center justify-center font-bold shrink-0">
                            <Globe className="size-4" />
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-xs">{zone.name}</div>
                            <div className="font-mono text-[10px] text-muted-foreground font-semibold mt-0.5">
                              ID: {zone.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Parent Region */}
                      <td className="px-5 py-3.5 text-muted-foreground">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                            <MapPin className="size-3.5 text-primary shrink-0" />
                            <span>{reg?.name || "Unassigned Region"}</span>
                          </div>
                          {reg?.code && (
                            <span className="font-mono text-[10px] text-purple-700 dark:text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                              {reg.code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Operating Company */}
                      <td className="px-5 py-3.5 text-muted-foreground">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                          <span>{reg?.company_id ? (companyMap[reg.company_id] ?? "Primary Company") : "—"}</span>
                        </div>
                      </td>

                      {/* Linked Branches */}
                      <td className="px-5 py-3.5 text-center">
                        {branchCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            {branchCount} {branchCount === 1 ? "Branch" : "Branches"}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground font-normal">None attached</span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                          <span>{formatDateTime(zone.created_at)}</span>
                        </div>
                      </td>

                      {/* Last Updated */}
                      <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="size-3 text-muted-foreground shrink-0" />
                          <span>{formatDate(zone.updated_at || zone.created_at)}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 text-center">
                        <StatusBadge status={zone.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7.5 w-7.5 text-purple-700 hover:bg-purple-50"
                            onClick={() => {
                              setEditZone(zone);
                              setShowForm(true);
                            }}
                            title="Edit Zone"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7.5 w-7.5 text-rose-500 hover:bg-rose-50"
                            onClick={() => setDeleteZone(zone)}
                            title="Delete Zone"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid / Card View Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((zone) => {
            const reg = regionMap[zone.region_id];
            return (
              <Card key={zone.id} className="p-5 hover:shadow-md transition-shadow group flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 flex items-center justify-center">
                        <Globe className="size-4.5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground">{zone.name}</h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="size-3" />
                          {reg?.name ?? "—"}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => {
                          setEditZone(zone);
                          setShowForm(true);
                        }}
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-red-500"
                        onClick={() => setDeleteZone(zone)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 py-2.5 border-t border-b border-border/50 text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3" /> Company:
                      </span>
                      <span className="font-semibold text-foreground">{reg?.company_id ? companyMap[reg.company_id] : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" /> Created:
                      </span>
                      <span>{formatDate(zone.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <StatusBadge status={zone.status} />
                  <span className="font-mono text-[10px] text-muted-foreground">ID: {zone.id.slice(0, 6)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── Modals ─── */}
      <AnimatePresence>
        {showForm && (
          <ZoneFormModal
            zone={editZone}
            regions={regions}
            onClose={() => {
              setShowForm(false);
              setEditZone(null);
            }}
            onSaved={load}
          />
        )}

        {deleteZone && (
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
                <h3 className="font-bold">{t("Delete Zone", "Delete Zone")}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete <span className="font-semibold text-foreground">{deleteZone.name}</span>? Mapped branches and employee assignments may be affected.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteZone(null)}>
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
