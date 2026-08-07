import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { companies as mockCompanies } from "@/data/mock";
import { companiesApi, branchesApi, type Company as RealCompany, type Branch as RealBranch } from "@/lib/api-client";

export interface TenantCompany {
  id: string;
  name: string;
  industry: string;
  logo: string;
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
    const parsed = JSON.parse(stored) as { user?: { isPlatformAdmin?: boolean; email?: string } };
    return Boolean(parsed.user?.isPlatformAdmin || parsed.user?.email === "venaticfungus@gmail.com");
  } catch {
    return false;
  }
}



export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [companiesList, setCompaniesList] = useState<TenantCompany[]>([]);
  const [branchesList, setBranchesList] = useState<TenantBranch[]>([]);

  const [tenant, setTenantState] = useState<TenantCompany>(() => {
    // Initial sync load from localStorage if possible, fallback to first mock
    try {
      const stored = localStorage.getItem("bos-tenant");
      if (stored) return JSON.parse(stored) as TenantCompany;
    } catch {
      // ignore
    }
    return {
      id: mockCompanies[0].id,
      name: mockCompanies[0].name,
      industry: mockCompanies[0].industry,
      logo: mockCompanies[0].logo,
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

  const setTenant = useCallback((c: TenantCompany) => {
    setTenantState(c);
    localStorage.setItem("bos-tenant", JSON.stringify(c));
    // Trigger storage event so other tabs/components listen
    window.dispatchEvent(new Event("storage"));
  }, []);

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
    const isPlatformAdminUser = getAuthIsPlatformAdmin();
    if (!token) {
      // Reset to mock data if not logged in
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
      // Platform admin = system slug OR any user explicitly promoted to Godmode (isPlatformAdmin)
      const isPlatformAdmin = slug === "system" || isPlatformAdminUser;



      if (isPlatformAdmin) {
        // Fetch all client tenant environments for SaaS impersonation switcher
        const sysRes = await fetch(`${API_BASE_URL}/system/tenants`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (sysRes.ok) {
          const sysTenants = await sysRes.json();
          mappedCompanies = sysTenants.map((t: any) => ({
            id: t.id,
            name: t.name,
            industry: "Client Workspace",
            logo: t.name.slice(0, 2).toUpperCase(),
            isReal: true,
            raw: {
              id: t.id,
              tenant_id: t.id,
              name: t.name,
              logo_initials: t.name.slice(0, 2).toUpperCase(),
            } as any
          }));
        }
      }

      // If we couldn't fetch system tenants, fall back to default scoped company API
      if (mappedCompanies.length === 0) {
        const coRes = await companiesApi.list(1, 100);
        mappedCompanies = coRes.items.map(c => ({
          id: c.id,
          name: c.name,
          industry: c.industry ?? "General",
          logo: c.logo_initials ?? c.name.slice(0, 2).toUpperCase(),
          isReal: true,
          raw: c,
        }));
      }

      // Fetch real branches
      const brRes = await branchesApi.list(1, 100);
      const mappedBranches: TenantBranch[] = brRes.items.map(b => ({
        id: b.id,
        name: b.name,
        code: b.code,
        isReal: true,
        raw: b,
      }));

      setCompaniesList(mappedCompanies.length > 0 ? mappedCompanies : mockCompanies);
      setBranchesList(mappedBranches);

      // Auto-select first real company if the current selected one is mock/invalid
      const currentIsValid = mappedCompanies.some(c => c.id === tenant.id);
      if (!currentIsValid && mappedCompanies.length > 0) {
        setTenant(mappedCompanies[0]);
      }

      // Auto-select first branch if none selected
      const branchIsValid = mappedBranches.some(b => b.id === activeBranch?.id);
      if (!branchIsValid && mappedBranches.length > 0) {
        setActiveBranch(mappedBranches[0]);
      }
    } catch (err) {
      console.error("Failed to load tenant workspace list:", err);
      // Fallback
      setCompaniesList(mockCompanies);
    } finally {
      setLoading(false);
    }
  }, [tenant.id, activeBranch?.id, setTenant, setActiveBranch]);

  useEffect(() => {
    void loadData();

    // Listen for auth storage changes (login/logout)
    const handleStorageChange = () => {
      void loadData();
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
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
