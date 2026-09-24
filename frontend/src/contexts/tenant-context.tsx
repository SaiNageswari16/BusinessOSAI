import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { companies as mockCompanies } from "@/data/mock";
import { companiesApi, branchesApi, clearApiCache, type Company as RealCompany, type Branch as RealBranch } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";

export interface TenantCompany {
  id: string;
  name: string;
  industry: string;
  logo: string;
  logo_url?: string | null;
  isReal?: boolean;
  raw?: RealCompany;
}

export interface TenantBranch {
  id: string;
  name: string;
  code: string;
  isReal?: boolean;
  raw?: RealBranch;
}

interface TenantContextType {
  tenant: TenantCompany; // Selected active company
  setTenant: (c: TenantCompany) => void;
  activeBranch: TenantBranch | null; // Selected active branch
  setActiveBranch: (b: TenantBranch | null) => void;
  companiesList: TenantCompany[]; // List of available companies
  branchesList: TenantBranch[]; // List of available branches
  loading: boolean;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

function getAuthToken(): string | null {
  try {
    const stored = localStorage.getItem("bos-auth");
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { accessToken?: string };
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
}

function getAuthUserSlug(): string | null {
  try {
    const stored = localStorage.getItem("bos-auth");
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { user?: { tenantSlug?: string } };
    return parsed.user?.tenantSlug ?? null;
  } catch {
    return null;
  }
}

function getAuthIsPlatformAdmin(): boolean {
  try {
    const stored = localStorage.getItem("bos-auth");
    if (!stored) return false;
    const parsed = JSON.parse(stored) as { user?: any };
    const u = parsed.user;
    if (!u) return false;
    return Boolean(u.isPlatformAdmin === true || u.is_platform_admin === true);
  } catch {
    return false;
  }
}

function getAuthUserTenantId(): string | null {
  try {
    const stored = localStorage.getItem("bos-auth");
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { user?: { tenantId?: string; tenant_id?: string } };
    return parsed.user?.tenantId || (parsed.user as any)?.tenant_id || null;
  } catch {
    return null;
  }
}

function getAuthUserTenantName(): string | null {
  try {
    const stored = localStorage.getItem("bos-auth");
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { user?: { tenantName?: string; tenant_name?: string } };
    return parsed.user?.tenantName || (parsed.user as any)?.tenant_name || null;
  } catch {
    return null;
  }
}

function getAuthUserCompanyId(): string | null {
  try {
    const stored = localStorage.getItem("bos-auth");
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { user?: any };
    return parsed.user?.companyId || parsed.user?.company_id || null;
  } catch {
    return null;
  }
}

function getAuthUserCompanyName(): string | null {
  try {
    const stored = localStorage.getItem("bos-auth");
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { user?: any };
    return parsed.user?.companyName || parsed.user?.company_name || null;
  } catch {
    return null;
  }
}

function getAuthCanSwitchWorkspaces(): boolean {
  try {
    const stored = localStorage.getItem("bos-auth");
    if (!stored) return true;
    const parsed = JSON.parse(stored) as { user?: any };
    const u = parsed.user;
    if (!u) return true;
    if (u.isPlatformAdmin || u.isTenantOwner) return true;
    if (u.canSwitchWorkspaces !== undefined) return Boolean(u.canSwitchWorkspaces);
    return true;
  } catch {
    return true;
  }
}

export function TenantProvider({ children }: { children: ReactNode }) {
    const { currency, formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [companiesList, setCompaniesList] = useState<TenantCompany[]>([]);
  const [branchesList, setBranchesList] = useState<TenantBranch[]>([]);

  const [tenant, setTenantState] = useState<TenantCompany>(() => {
    try {
      const authUserCompanyId = getAuthUserCompanyId();
      const authUserCompanyName = getAuthUserCompanyName();
      const canSwitch = getAuthCanSwitchWorkspaces();
      const stored = localStorage.getItem("bos-tenant");

      // For restricted non-admin employees, lock to their company
      if (authUserCompanyId && !canSwitch) {
        return {
          id: authUserCompanyId,
          name: authUserCompanyName || "My Workspace",
          industry: "General",
          logo: (authUserCompanyName || "WS").slice(0, 2).toUpperCase(),
          logo_url: null,
          isReal: true,
        };
      }

      if (stored) {
        const parsed = JSON.parse(stored) as TenantCompany;
        if (parsed?.id) {
          return parsed;
        }
      }

      const authUserTenantId = getAuthUserTenantId();
      const authUserTenantName = getAuthUserTenantName();
      if (authUserCompanyId || authUserTenantId) {
        return {
          id: authUserCompanyId || authUserTenantId!,
          name: authUserCompanyName || authUserTenantName || "My Workspace",
          industry: "Retail / Wholesale",
          logo: (authUserCompanyName || authUserTenantName || "WS").slice(0, 2).toUpperCase(),
          logo_url: null,
          isReal: true,
        };
      }
    } catch {
      // ignore
    }
    return {
      id: mockCompanies[0].id,
      name: mockCompanies[0].name,
      industry: mockCompanies[0].industry,
      logo: mockCompanies[0].logo,
      logo_url: null,
    };
  });

  const [activeBranch, setActiveBranchState] = useState<TenantBranch | null>(() => {
    try {
      const stored = localStorage.getItem("bos-branch");
      if (stored) return JSON.parse(stored) as TenantBranch;
    } catch {
      // ignore
    }
    return null;
  });

  let queryClient: any = null;
  try {
    queryClient = useQueryClient();
  } catch {}

  const setTenant = useCallback((c: TenantCompany) => {
    setTenantState(c);
    localStorage.setItem("bos-tenant", JSON.stringify(c));
    localStorage.setItem("bos_active_company", c.id);
    clearApiCache();
    // Trigger storage event and bos-tenant-changed for other components/tabs
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent("bos-tenant-changed", { detail: c }));
    if (queryClient) {
      try {
        queryClient.invalidateQueries();
      } catch {}
    }
  }, [queryClient]);

  const setActiveBranch = useCallback((b: TenantBranch | null) => {
    setActiveBranchState(b);
    if (b) {
      localStorage.setItem("bos-branch", JSON.stringify(b));
    } else {
      localStorage.removeItem("bos-branch");
    }
    window.dispatchEvent(new Event("storage"));
  }, []);

  const loadData = useCallback(async () => {
    const token = getAuthToken();
    const slug = getAuthUserSlug();
    const authTenantId = getAuthUserTenantId();
    const authTenantName = getAuthUserTenantName();
    const isPlatformAdminUser = getAuthIsPlatformAdmin();

    if (!token) {
      const mappedMocks = mockCompanies.map(c => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        logo: c.logo,
      }));
      setCompaniesList(mappedMocks);
      setBranchesList([]);
      return;
    }

    setLoading(true);
    try {
      let mappedCompanies: TenantCompany[] = [];
      const isPlatformAdmin = isPlatformAdminUser;

      if (isPlatformAdmin) {
        try {
          const sysRes = await fetch(`${API_BASE_URL}/system/tenants`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (sysRes.ok) {
            const sysTenants = await sysRes.json();
            if (Array.isArray(sysTenants) && sysTenants.length > 0) {
              mappedCompanies = sysTenants.map((t: any) => ({
                id: t.id,
                name: t.name,
                industry: "Client Workspace",
                logo: (t.name || "WS").slice(0, 2).toUpperCase(),
                logo_url: t.logo_url || null,
                isReal: true,
                raw: {
                  id: t.id,
                  tenant_id: t.id,
                  name: t.name,
                  slug: t.slug,
                  logo_initials: (t.name || "WS").slice(0, 2).toUpperCase(),
                  logo_url: t.logo_url || null,
                  ...(t.settings || {}),
                } as any
              }));
            }
          }
        } catch (sysErr) {
          console.warn("Could not fetch system tenants:", sysErr);
        }
      }

      const [coResult, brResult] = await Promise.allSettled([
        mappedCompanies.length === 0 ? companiesApi.list(1, 100) : Promise.resolve({ items: [] }),
        branchesApi.list(1, 100)
      ]);

      if (mappedCompanies.length === 0 && coResult.status === "fulfilled" && coResult.value?.items) {
        mappedCompanies = coResult.value.items.map(c => ({
          id: c.id,
          name: c.name,
          industry: c.industry ?? "General",
          logo: c.logo_url || c.logo_initials || c.name.slice(0, 2).toUpperCase(),
          logo_url: c.logo_url || null,
          isReal: true,
          raw: c,
        }));
      }

      let mappedBranches: TenantBranch[] = [];
      if (brResult.status === "fulfilled" && brResult.value?.items) {
        mappedBranches = brResult.value.items.map(b => ({
          id: b.id,
          name: b.name,
          code: b.code,
          isReal: true,
          raw: b,
        }));
      }

      // If user is a restricted employee, filter companies to only their company
      const authUserCompanyId = getAuthUserCompanyId();
      const canSwitch = getAuthCanSwitchWorkspaces();
      if (!isPlatformAdmin && authUserCompanyId && !canSwitch) {
        const filtered = mappedCompanies.filter(c => c.id === authUserCompanyId);
        if (filtered.length > 0) {
          mappedCompanies = filtered;
        }
      }

      setCompaniesList(mappedCompanies);
      setBranchesList(mappedBranches);

      // Check existing stored workspace selection in localStorage
      let storedTenantId: string | null = null;
      try {
        const storedStr = localStorage.getItem("bos-tenant");
        if (storedStr) {
          const parsed = JSON.parse(storedStr);
          storedTenantId = parsed?.id || null;
        }
      } catch {}

      // Keep user's active/stored workspace if it exists in mappedCompanies
      const activeMatch = mappedCompanies.find(c => c.id === storedTenantId || c.id === tenant?.id);
      if (activeMatch) {
        if (tenant?.id !== activeMatch.id || tenant?.name !== activeMatch.name || tenant?.logo_url !== activeMatch.logo_url) {
          setTenantState(activeMatch);
          localStorage.setItem("bos-tenant", JSON.stringify(activeMatch));
          localStorage.setItem("bos_active_company", activeMatch.id);
        }
      } else if (mappedCompanies.length > 0) {
        // Fallback to first company in list
        const defaultMatch = mappedCompanies.find(
          c => (authUserCompanyId && c.id === authUserCompanyId) ||
               (authTenantId && c.id === authTenantId) ||
               (slug && (c.raw as any)?.slug === slug) ||
               (authTenantName && c.name.toLowerCase() === authTenantName.toLowerCase())
        ) || mappedCompanies[0];
        setTenantState(defaultMatch);
        localStorage.setItem("bos-tenant", JSON.stringify(defaultMatch));
        localStorage.setItem("bos_active_company", defaultMatch.id);
      }

      // Auto-select first branch if none selected
      const branchIsValid = mappedBranches.some(b => b.id === activeBranch?.id);
      if (!branchIsValid && mappedBranches.length > 0) {
        setActiveBranch(mappedBranches[0]);
      }
    } catch (err) {
      console.error("Failed to load tenant workspace list:", err);
      setCompaniesList([]);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, tenant?.logo_url, tenant?.name, activeBranch?.id, setActiveBranch]);

  useEffect(() => {
    void loadData();

    // Listen for auth changes from other tabs or login events
    const handleStorageChange = () => {
      void loadData();
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("bos-auth-changed", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("bos-auth-changed", handleStorageChange);
    };
  }, [loadData]);

  return (
    <TenantContext.Provider
      value={{
        tenant,
        setTenant,
        activeBranch,
        setActiveBranch,
        companiesList,
        branchesList,
        loading,
        refresh: loadData,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
