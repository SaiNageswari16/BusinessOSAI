import { useState, useEffect, useCallback, useMemo, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search, Filter, Plus, MapPin, Users, Building2, ExternalLink,
  Edit2, Trash2, X, Save, Loader2, AlertCircle, Phone, Mail, CheckCircle,
  Globe, Navigation, Download, Upload, Sparkles, Check, ChevronDown, RefreshCw,
  Layers, ShieldCheck, FileSpreadsheet,
} from "lucide-react";
import { branchesApi, companiesApi, downloadCsv, type Branch, type Company } from "@/lib/api-client";
import {
  INDIA_REGIONS,
  INDIA_STATES_MASTER,
  getStatesByRegion,
  getRegionByState,
  getZonesByState,
  generateBranchCodeSuggestion,
  type IndiaStateMaster,
} from "@/data/india-hierarchy";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold",
      active ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-muted text-muted-foreground border border-border/50",
    )}>
      <span className={cn("size-1.5 rounded-full", active ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground")} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

const REGION_COLORS: Record<string, string> = {
  "North India": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "South India": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "East India": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "West India": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "Central India": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  "North-East India": "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

/* ─── Hierarchical Branch Form Modal ─── */
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

  // Form State
  const [companyId, setCompanyId] = useState(branch?.company_id ?? (companies[0]?.id ?? ""));
  const [country, setCountry] = useState(branch?.country ?? "India");
  const [regionName, setRegionName] = useState(branch?.region_name ?? (branch?.state ? getRegionByState(branch.state) : "South India") ?? "South India");
  const [stateName, setStateName] = useState(branch?.state ?? "Telangana");
  const [zoneName, setZoneName] = useState(branch?.zone_name ?? "Hyderabad Metro (GHMC/Cyberabad)");
  const [customZoneMode, setCustomZoneMode] = useState(false);
  const [district, setDistrict] = useState(branch?.district ?? "");
  const [districtCode, setDistrictCode] = useState(branch?.district_code ?? "");
  const [code, setCode] = useState(branch?.code ?? "");
  const [name, setName] = useState(branch?.name ?? "");
  const [city, setCity] = useState(branch?.city ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [phone, setPhone] = useState(branch?.phone ?? "");
  const [email, setEmail] = useState(branch?.email ?? "");
  const [workingHours, setWorkingHours] = useState(branch?.working_hours ?? "9:00 AM - 6:30 PM");
  const [hasWarehouse, setHasWarehouse] = useState(branch?.has_warehouse ?? false);
  const [status, setStatus] = useState(branch?.status ?? "active");
  const [latitude, setLatitude] = useState(branch?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(branch?.longitude?.toString() ?? "");
  const [geofenceRadius, setGeofenceRadius] = useState(branch?.geofence_radius_meters?.toString() ?? "500");
  const [enforceGeofence, setEnforceGeofence] = useState(branch?.enforce_geofence ?? true);

  // State search within combobox
  const [stateSearch, setStateSearch] = useState("");
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);

  // Derived available states for the selected region
  const availableStates = useMemo(() => {
    return getStatesByRegion(regionName);
  }, [regionName]);

  // Filtered states based on search query
  const filteredStates = useMemo(() => {
    if (!stateSearch.trim()) return availableStates;
    const q = stateSearch.toLowerCase();
    return INDIA_STATES_MASTER.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [stateSearch, availableStates]);

  // Suggested zones for the current state
  const suggestedZones = useMemo(() => {
    return getZonesByState(stateName);
  }, [stateName]);

  // Auto-fill logic when State changes
  const handleSelectState = (stateObj: IndiaStateMaster) => {
    setStateName(stateObj.name);
    setRegionName(stateObj.region);
    setStateDropdownOpen(false);
    setStateSearch("");

    // Set first suggested zone if available
    const zones = stateObj.zones || [];
    if (zones.length > 0) {
      setZoneName(zones[0]);
      setCustomZoneMode(false);
    }

    // Propose a branch code if creating new
    if (!isEdit && !code) {
      const suggested = generateBranchCodeSuggestion(stateObj.name, zones[0] || "");
      setCode(suggested);
    }
  };

  // When Region changes, ensure state belongs to it
  const handleSelectRegion = (rName: string) => {
    setRegionName(rName);
    const statesInRegion = getStatesByRegion(rName);
    if (statesInRegion.length > 0 && !statesInRegion.some(s => s.name === stateName)) {
      handleSelectState(statesInRegion[0]);
    }
  };

  const handleSuggestCode = () => {
    const suggested = generateBranchCodeSuggestion(stateName, zoneName, Math.floor(Math.random() * 90) + 10);
    setCode(suggested);
    toast.info(`Generated suggested branch code: ${suggested}`);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !companyId) {
      toast.error("Please fill in Company, Branch Name, and Branch Code");
      return;
    }

    setSaving(true);
    const payload = {
      company_id: companyId,
      code: code.trim(),
      name: name.trim(),
      country: country.trim(),
      region_name: regionName.trim(),
      state: stateName.trim(),
      zone_name: zoneName.trim(),
      district: district.trim() || null,
      district_code: districtCode.trim() || null,
      city: city.trim() || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      has_warehouse: hasWarehouse,
      working_hours: workingHours.trim() || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      geofence_radius_meters: geofenceRadius ? parseInt(geofenceRadius) : 500,
      enforce_geofence: enforceGeofence,
      status,
    };

    try {
      if (isEdit) {
        await branchesApi.update(branch.id, payload);
        toast.success("Branch hierarchy & settings updated!");
      } else {
        await branchesApi.create(payload);
        toast.success("New branch successfully created!");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl gradient-brand text-white flex items-center justify-center shadow-xs">
              <Building2 className="size-4.5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-foreground leading-tight">
                {isEdit ? "Edit Branch Hierarchy" : "Add Branch / Physical Location"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Configured with the official 6-Region, 36-State/UT, and multi-Zone India Hierarchy template.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Company Selection */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-muted-foreground uppercase">Operating Company *</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              required
              className="w-full h-9.5 px-3 text-xs rounded-lg border bg-background font-semibold"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.legal_name || "Primary Legal Entity"})</option>
              ))}
            </select>
          </div>

          {/* ─── Administrative Hierarchy Section ─── */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-border/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Globe className="size-3.5 text-primary" /> India Administrative Hierarchy
              </span>
              <span className="text-[10px] font-semibold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-full">
                Excel Model Verified
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Country */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-medium"
                  placeholder="India"
                />
              </div>

              {/* Region Selector */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase">Region (6 Standard) *</label>
                <select
                  value={regionName}
                  onChange={(e) => handleSelectRegion(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-bold text-primary"
                >
                  {INDIA_REGIONS.map((r) => (
                    <option key={r.code} value={r.name}>{r.name} ({r.code})</option>
                  ))}
                </select>
              </div>

              {/* State / UT Combobox with live search */}
              <div className="space-y-1 relative">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase">State / UT (36 Master) *</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setStateDropdownOpen(!stateDropdownOpen)}
                    className="w-full h-9 px-3 text-xs rounded-lg border bg-background flex items-center justify-between font-semibold text-left"
                  >
                    <span>{stateName || "-- Select State / UT --"}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </button>

                  {stateDropdownOpen && (
                    <div className="absolute left-0 right-0 top-10 z-50 bg-card border rounded-xl shadow-xl p-2 space-y-1.5 max-h-56 overflow-y-auto">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
                        <input
                          type="text"
                          value={stateSearch}
                          onChange={(e) => setStateSearch(e.target.value)}
                          placeholder="Search 36 states & UTs..."
                          autoFocus
                          className="w-full h-7 pl-7 pr-2 text-xs rounded border bg-background"
                        />
                      </div>
                      <div className="divide-y divide-border/30 max-h-40 overflow-y-auto">
                        {filteredStates.map((st) => (
                          <div
                            key={st.code}
                            onClick={() => handleSelectState(st)}
                            className={cn(
                              "px-2.5 py-1.5 text-xs rounded hover:bg-muted cursor-pointer flex items-center justify-between",
                              stateName === st.name && "bg-primary/10 text-primary font-bold"
                            )}
                          >
                            <span>{st.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{st.code} • {st.region}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Zone Selector & Custom write-in */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase">Zone *</label>
                  <button
                    type="button"
                    onClick={() => setCustomZoneMode(!customZoneMode)}
                    className="text-[10px] font-semibold text-primary hover:underline"
                  >
                    {customZoneMode ? "Select Suggested" : "+ Custom Zone"}
                  </button>
                </div>
                {customZoneMode ? (
                  <input
                    type="text"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    placeholder="Enter custom business zone"
                    className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-medium"
                  />
                ) : (
                  <select
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-medium"
                  >
                    {suggestedZones.map((z, idx) => (
                      <option key={idx} value={z}>{z}</option>
                    ))}
                    <option value="General Zone">General / Central Zone</option>
                  </select>
                )}
              </div>

              {/* District & District Code */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase">District *</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Warangal Urban / Rangareddy / Pune"
                  className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-muted-foreground uppercase">District Code (Optional)</label>
                <input
                  type="text"
                  value={districtCode}
                  onChange={(e) => setDistrictCode(e.target.value)}
                  placeholder="e.g. DST-506001"
                  className="w-full h-9 px-3 text-xs rounded-lg border bg-background font-mono"
                />
              </div>
            </div>
          </div>

          {/* ─── Branch Identity & Contact ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-muted-foreground uppercase">Branch Code *</label>
                <button
                  type="button"
                  onClick={handleSuggestCode}
                  className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                >
                  <Sparkles className="size-2.5" /> Auto-Suggest
                </button>
              </div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="w-full h-9.5 px-3 text-xs rounded-lg border bg-background font-mono font-bold text-primary"
                placeholder="TS-HYD-001"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Branch Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full h-9.5 px-3 text-xs rounded-lg border bg-background font-semibold"
                placeholder="e.g. Hanamkonda Main Hub / Bangalore HQ"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full h-9.5 px-3 text-xs rounded-lg border bg-background"
                placeholder="e.g. Warangal / Hyderabad / Mumbai"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Working Hours</label>
              <input
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                className="w-full h-9.5 px-3 text-xs rounded-lg border bg-background"
                placeholder="9:00 AM - 6:30 PM"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-9.5 px-3 text-xs rounded-lg border bg-background"
                placeholder="+91 98765 43210"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-9.5 px-3 text-xs rounded-lg border bg-background"
                placeholder="branch@company.com"
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Full Physical Address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-lg border bg-background resize-none"
                placeholder="Door No, Street Name, Landmark, Pin Code..."
              />
            </div>
          </div>

          {/* ─── Geolocation & Geofence Verification ─── */}
          <div className="p-3.5 rounded-xl border border-border/60 bg-muted/30 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-emerald-500" /> Geolocation Coordinates (For GPS Attendance)
              </span>
              <button
                type="button"
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setLatitude(pos.coords.latitude.toFixed(7));
                        setLongitude(pos.coords.longitude.toFixed(7));
                        toast.success("Current GPS location acquired!");
                      },
                      (err) => toast.error("Could not fetch GPS: " + err.message)
                    );
                  }
                }}
                className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Navigation className="size-3" /> Fetch Current GPS
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="Latitude (e.g. 17.9689)"
                className="h-8 px-2 text-xs rounded border bg-background font-mono"
              />
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="Longitude (e.g. 79.5941)"
                className="h-8 px-2 text-xs rounded border bg-background font-mono"
              />
              <input
                type="number"
                value={geofenceRadius}
                onChange={(e) => setGeofenceRadius(e.target.value)}
                placeholder="Radius (meters: 500)"
                className="h-8 px-2 text-xs rounded border bg-background"
              />
            </div>
          </div>

          {/* Checkbox Options */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasWarehouse}
                onChange={(e) => setHasWarehouse(e.target.checked)}
                className="size-4 rounded accent-primary"
              />
              <span className="text-xs font-medium">Attach Primary Warehouse to this Branch</span>
            </label>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-8 px-2.5 text-xs rounded-lg border bg-background font-bold"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Form Footer */}
          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gradient-brand text-white border-0 h-9 text-xs font-semibold min-w-[120px]">
              {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
              {isEdit ? "Update Branch" : "Create Branch"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Main Branch Management Component ─── */
export function BranchManagement() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>("all");
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>("all");

  const [showForm, setShowForm] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [deleteBranch, setDeleteBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [brRes, coRes] = await Promise.all([
        branchesApi.list(1, 200, search || undefined, selectedCompanyId !== "all" ? selectedCompanyId : undefined),
        companiesApi.list(1, 100),
      ]);
      setBranches(brRes.items);
      setTotal(brRes.total);
      setCompanies(coRes.items);
    } catch (err) {
      console.error("Failed to load branches:", err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCompanyId]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, selectedCompanyId]);

  useEffect(() => {
    void load();
  }, []);

  const handleDelete = async () => {
    if (!deleteBranch) return;
    setDeleting(true);
    try {
      await branchesApi.delete(deleteBranch.id);
      toast.success("Branch deleted successfully");
      setDeleteBranch(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete branch");
    } finally {
      setDeleting(false);
    }
  };

  // Filtered branches based on Region and State dropdowns
  const displayedBranches = useMemo(() => {
    return branches.filter((b) => {
      if (selectedRegionFilter !== "all" && b.region_name !== selectedRegionFilter) return false;
      if (selectedStateFilter !== "all" && b.state !== selectedStateFilter) return false;
      return true;
    });
  }, [branches, selectedRegionFilter, selectedStateFilter]);

  // Statistics KPI calculations
  const stats = useMemo(() => {
    const uniqueRegions = new Set(branches.map((b) => b.region_name).filter(Boolean));
    const uniqueStates = new Set(branches.map((b) => b.state).filter(Boolean));
    const geofenced = branches.filter((b) => b.latitude && b.longitude).length;
    const withWarehouse = branches.filter((b) => b.has_warehouse).length;
    return {
      total: branches.length,
      regionsCovered: uniqueRegions.size,
      statesCovered: uniqueStates.size,
      geofenced,
      withWarehouse,
    };
  }, [branches]);

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  // CSV Export matching India_Region_Zone_District_Branch_Hierarchy.xlsx structure
  const handleExportHierarchy = () => {
    const headers = [
      "Country", "Region", "State / UT", "Zone", "District", "District Code",
      "Branch", "Branch Code", "City", "Address", "Phone", "Email", "Status", "Has Warehouse"
    ];
    const rows = displayedBranches.map((b) => [
      b.country || "India",
      b.region_name || "",
      b.state || "",
      b.zone_name || "",
      b.district || "",
      b.district_code || "",
      b.name,
      b.code,
      b.city || "",
      b.address || "",
      b.phone || "",
      b.email || "",
      b.status,
      b.has_warehouse ? "Yes" : "No",
    ]);
    downloadCsv("India_Branches_Hierarchy_Export", headers, rows);
    toast.success("Exported branches matching India Hierarchy template!");
  };

  return (
    <div className="space-y-6">
      {/* ─── Header & Actions ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="size-5 text-primary" /> Branch & Location Hierarchy
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            Organized according to the standard 6-Region, 36-State/UT, Zone, and District Indian administrative model.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportHierarchy}
            className="h-8.5 gap-1.5 text-xs font-semibold"
          >
            <Download className="size-3.5" /> Export Hierarchy
          </Button>
          <Button
            size="sm"
            className="h-8.5 gap-1.5 gradient-brand text-white border-0 text-xs font-bold shadow-sm"
            onClick={() => { setEditBranch(null); setShowForm(true); }}
          >
            <Plus className="size-3.5" /> Add Branch
          </Button>
        </div>
      </div>

      {/* ─── Summary Metric Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="p-3.5 bg-card/60 backdrop-blur-xs border shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 flex items-center justify-center font-bold shrink-0">
            <Building2 className="size-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase">Total Branches</div>
            <div className="text-lg font-black text-foreground">{stats.total}</div>
          </div>
        </Card>

        <Card className="p-3.5 bg-card/60 backdrop-blur-xs border shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 flex items-center justify-center font-bold shrink-0">
            <Globe className="size-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase">Regions Covered</div>
            <div className="text-lg font-black text-foreground">{stats.regionsCovered} <span className="text-xs font-normal text-muted-foreground">/ 6</span></div>
          </div>
        </Card>

        <Card className="p-3.5 bg-card/60 backdrop-blur-xs border shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 flex items-center justify-center font-bold shrink-0">
            <Layers className="size-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase">States / UTs Active</div>
            <div className="text-lg font-black text-foreground">{stats.statesCovered} <span className="text-xs font-normal text-muted-foreground">/ 36</span></div>
          </div>
        </Card>

        <Card className="p-3.5 bg-card/60 backdrop-blur-xs border shadow-xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 flex items-center justify-center font-bold shrink-0">
            <MapPin className="size-4.5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase">GPS Geofenced</div>
            <div className="text-lg font-black text-foreground">{stats.geofenced}</div>
          </div>
        </Card>
      </div>

      {/* ─── Search & Hierarchy Filter Bar ─── */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between p-3 rounded-xl bg-card border shadow-xs">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8.5 pl-8.5 pr-3 text-xs rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="Search branches, codes, districts, cities..."
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* Company Filter */}
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="h-8.5 px-2.5 text-xs rounded-lg border bg-background font-medium shrink-0"
          >
            <option value="all">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Region Filter */}
          <select
            value={selectedRegionFilter}
            onChange={(e) => setSelectedRegionFilter(e.target.value)}
            className="h-8.5 px-2.5 text-xs rounded-lg border bg-background font-medium shrink-0"
          >
            <option value="all">All Regions (6)</option>
            {INDIA_REGIONS.map((r) => (
              <option key={r.code} value={r.name}>{r.name}</option>
            ))}
          </select>

          {/* State Filter */}
          <select
            value={selectedStateFilter}
            onChange={(e) => setSelectedStateFilter(e.target.value)}
            className="h-8.5 px-2.5 text-xs rounded-lg border bg-background font-medium shrink-0"
          >
            <option value="all">All States & UTs (36)</option>
            {INDIA_STATES_MASTER.map((st) => (
              <option key={st.code} value={st.name}>{st.name}</option>
            ))}
          </select>

          <span className="text-xs text-muted-foreground font-semibold shrink-0 pl-1">
            {displayedBranches.length} showing
          </span>
        </div>
      </div>

      {/* ─── Branches Table ─── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : displayedBranches.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border rounded-2xl">
          <Building2 className="size-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-semibold text-foreground">No branches found</p>
          <p className="text-xs mt-1">Try adjusting your filters or click below to add your first branch.</p>
          <Button
            size="sm"
            className="mt-4 gradient-brand text-white border-0 text-xs font-bold"
            onClick={() => { setEditBranch(null); setShowForm(true); }}
          >
            <Plus className="size-3.5 mr-1" /> Add Branch
          </Button>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-border/70 text-muted-foreground text-[11px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Branch & Code</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Region & State / UT</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">Zone & District</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">City & Address</th>
                  <th className="px-5 py-3.5 text-left whitespace-nowrap">GPS Geofence</th>
                  <th className="px-5 py-3.5 text-center whitespace-nowrap">Warehouse</th>
                  <th className="px-5 py-3.5 text-center whitespace-nowrap">Status</th>
                  <th className="px-5 py-3.5 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {displayedBranches.map((branch) => {
                  const regionBadgeClass = REGION_COLORS[branch.region_name || ""] || "bg-muted text-muted-foreground border-border/40";
                  return (
                    <tr key={branch.id} className="hover:bg-muted/30 transition-colors group">
                      {/* Branch Name & Code */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 font-bold flex items-center justify-center shrink-0">
                            <Building2 className="size-4" />
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-xs">{branch.name}</div>
                            <div className="font-mono text-[10px] text-muted-foreground font-semibold mt-0.5">
                              {branch.code} • {companyMap[branch.company_id] ?? "Primary"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Region & State */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border", regionBadgeClass)}>
                            {branch.region_name || "South India"}
                          </span>
                          <div className="text-[11px] font-semibold text-foreground">
                            {branch.state || "—"}
                          </div>
                        </div>
                      </td>

                      {/* Zone & District */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-foreground truncate max-w-[170px]">
                            {branch.zone_name || "—"}
                          </div>
                          <div className="text-[10.5px] text-muted-foreground truncate max-w-[170px]">
                            {branch.district ? `Dist: ${branch.district}` : "—"}
                          </div>
                        </div>
                      </td>

                      {/* City & Address */}
                      <td className="px-5 py-3.5 text-muted-foreground max-w-xs truncate">
                        <div className="font-semibold text-foreground text-xs">{branch.city || "—"}</div>
                        <div className="text-[10.5px] truncate">{branch.address || "—"}</div>
                      </td>

                      {/* GPS Geofence */}
                      <td className="px-5 py-3.5">
                        {branch.latitude && branch.longitude ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                            <MapPin className="size-3.5" />
                            <span>{branch.geofence_radius_meters || 500}m Radius</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Not set</span>
                        )}
                      </td>

                      {/* Warehouse */}
                      <td className="px-5 py-3.5 text-center">
                        {branch.has_warehouse ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <CheckCircle className="size-3" /> Yes
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 text-center">
                        <StatusBadge status={branch.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7.5 w-7.5 text-purple-700 hover:bg-purple-50"
                            onClick={() => { setEditBranch(branch); setShowForm(true); }}
                            title="Edit Branch"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7.5 w-7.5 text-rose-500 hover:bg-rose-50"
                            onClick={() => setDeleteBranch(branch)}
                            title="Delete Branch"
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
      )}

      {/* ─── Modals ─── */}
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
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center">
                  <AlertCircle className="size-5" />
                </div>
                <h3 className="font-bold text-base">Delete Branch Location</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete <span className="font-semibold text-foreground">{deleteBranch.name}</span> ({deleteBranch.code})? This will permanently remove its organizational hierarchy and attendance mappings.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteBranch(null)}>Cancel</Button>
                <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                  {deleting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Trash2 className="size-4 mr-1" />} Delete Branch
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

