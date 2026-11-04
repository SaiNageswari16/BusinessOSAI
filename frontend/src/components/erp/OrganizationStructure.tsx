import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/contexts/i18n-context";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Network, Building2, Store, Users, MapPin, Layers, Briefcase, RefreshCw } from "lucide-react";
import { companiesApi, businessUnitsApi, branchesApi, departmentsApi, type Company, type BusinessUnit, type Branch, type Department } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export function OrganizationStructure() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, buRes, brRes, deptRes] = await Promise.all([
        companiesApi.list(1, 50),
        businessUnitsApi.list(1, 100),
        branchesApi.list(1, 100),
        departmentsApi.list(1, 100),
      ]);
      setCompanies(compRes.items || []);
      setBusinessUnits(buRes.items || []);
      setBranches(brRes.items || []);
      setDepartments(deptRes.items || []);
    } catch (err) {
      console.error("Failed to load organization hierarchy:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeCompany = companies[0];

  return (
    <div className="p-4 space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight">{t("Organization Structure", "Organization Structure")}</h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            {t("Visual hierarchy of companies, business units, branches, and departments.", "Visual hierarchy of companies, business units, branches, and departments.")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("Refresh", "Refresh")}
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-6 py-10">
          <Skeleton className="h-28 w-64 rounded-2xl" />
          <div className="h-8 w-px bg-border" />
          <div className="flex gap-8">
            <Skeleton className="h-24 w-52 rounded-xl" />
            <Skeleton className="h-24 w-52 rounded-xl" />
            <Skeleton className="h-24 w-52 rounded-xl" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          {/* Level 1: Company Node */}
          <Card className="p-5 bg-gradient-to-br from-primary/10 via-background to-primary/5 border-primary/30 flex flex-col items-center w-72 shadow-md z-10 transition-transform hover:scale-105">
            <div className="size-12 rounded-xl gradient-brand text-white grid place-items-center shadow-sm mb-2.5">
              <Building2 className="size-6" />
            </div>
            <h3 className="font-bold text-center text-sm text-foreground">
              {activeCompany?.name || t("Enterprise Operating Company", "Enterprise Operating Company")}
            </h3>
            <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-widest mt-1 bg-primary/10 px-2 py-0.5 rounded-full">
              {t("Holding Enterprise", "Holding Enterprise")}
            </span>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2 border-t pt-2 w-full justify-center">
              <span>{businessUnits.length} {t("Units", "Units")}</span>
              <span>•</span>
              <span>{branches.length} {t("Branches", "Branches")}</span>
              <span>•</span>
              <span>{departments.length} {t("Depts", "Depts")}</span>
            </div>
          </Card>

          <div className="h-8 w-px bg-border" />

          {/* Level 2: Business Units Level */}
          <div className="w-full">
            <div className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t("Strategic Business Units", "Strategic Business Units")}
            </div>

            {businessUnits.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground">
                {t("No business units registered yet.", "No business units registered yet.")}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 justify-center max-w-4xl mx-auto">
                {businessUnits.map((bu, idx) => (
                  <Card key={bu.id || idx} className="p-4 border hover:border-primary/50 transition-all hover:shadow-xs flex flex-col items-center text-center">
                    <div className="size-9 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 grid place-items-center mb-2">
                      <Network className="size-5" />
                    </div>
                    <h4 className="font-semibold text-xs text-foreground">{bu.name}</h4>
                    <span className="text-[9.5px] text-muted-foreground mt-0.5 capitalize">{bu.status || "Active"} Unit</span>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="h-8 w-px bg-border" />

          {/* Level 3: Branches & Locations */}
          <div className="w-full">
            <div className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t("Operating Branches & Facilities", "Operating Branches & Facilities")}
            </div>

            {branches.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground">
                {t("No branches created yet.", "No branches created yet.")}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 justify-center max-w-4xl mx-auto">
                {branches.map((b, idx) => (
                  <Card key={b.id || idx} className="p-3 border hover:border-emerald-300 transition-colors flex flex-col items-center text-center">
                    <div className="size-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 grid place-items-center mb-1.5">
                      <MapPin className="size-4" />
                    </div>
                    <span className="text-xs font-semibold text-foreground truncate w-full">{b.name}</span>
                    <span className="text-[9.5px] text-muted-foreground mt-0.5">{b.city || b.region_name || "Operational Hub"}</span>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="h-8 w-px bg-border" />

          {/* Level 4: Departments */}
          <div className="w-full">
            <div className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t("Functional Departments", "Functional Departments")}
            </div>

            {departments.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground">
                {t("No departments created yet.", "No departments created yet.")}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 justify-center max-w-4xl mx-auto">
                {departments.map((dept, idx) => (
                  <Card key={dept.id || idx} className="p-3 border hover:border-purple-300 transition-colors flex flex-col items-center text-center">
                    <div className="size-8 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 grid place-items-center mb-1.5">
                      <Briefcase className="size-4" />
                    </div>
                    <span className="text-xs font-semibold text-foreground truncate w-full">{dept.name}</span>
                    <span className="text-[9px] font-mono text-muted-foreground mt-0.5">{dept.code || "DEPT"}</span>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
