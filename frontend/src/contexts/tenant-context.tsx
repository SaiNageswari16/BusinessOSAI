import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { companies as mockCompanies } from "@/data/mock";
import { companiesApi, branchesApi, clearApiCache, type Company as RealCompany, type Branch as RealBranch } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";
import { safeSetItem, sanitizeForStorage } from "@/lib/safe-storage";

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
    // ── Purge stale state from the PREVIOUS tenant/workspace ──────────────────
    // Read the previously-active tenant id before overwriting it so we can
    // wipe its company-scoped keys (prevents cross-workspace bleed where a
    // stale bos_active_billing_gst_details_<prev_tid> survives the switch).
    let prevTid: string | null = null;
    let prevCid: string | null = null;
    try {
      const prevRaw = localStorage.getItem("bos-tenant");
      if (prevRaw) {
        const prevParsed = JSON.parse(prevRaw);
        prevTid = prevParsed?.raw?.tenant_id || prevParsed?.tenant_id || prevParsed?.id || null;
      }
      prevCid = localStorage.getItem("bos_active_company_id");
    } catch {}

    // Remove every tenant-scoped key belonging to the previous tenant
    try {
      localStorage.removeItem("bos-branch");
      localStorage.removeItem("bos_active_invoice_template_id");
      localStorage.removeItem("bos_default_inv_template_id");
      localStorage.removeItem("bos_pos_active_receipt_templates_v1");
      if (prevTid) {
        localStorage.removeItem(`bos_active_company_${prevTid}`);
        localStorage.removeItem(`bos_active_billing_gst_details_${prevTid}`);
        if (prevCid) localStorage.removeItem(`bos_active_company_${prevTid}_${prevCid}`);
        localStorage.removeItem(`bos_active_billing_gst_details_${prevTid}_${prevCid}`);
        localStorage.removeItem(`bos_active_receipt_template_id_${prevTid}`);
        localStorage.removeItem(`bos_active_thermal_template_id_${prevTid}`);
        localStorage.removeItem(`bos_active_invoice_template_id_${prevTid}`);
        localStorage.removeItem(`businessos_print_templates_v1_${prevTid}`);
        localStorage.removeItem(`user_active_print_templates_v1_${prevTid}`);
      }
      setActiveBranchState(null);
    } catch {}

    setTenantState(c);
    const sanitizedCompany = sanitizeForStorage(c.raw || c);
    safeSetItem("bos-tenant", JSON.stringify(c));
    safeSetItem("bos_active_company_id", c.id);
    safeSetItem("bos_active_company", JSON.stringify(sanitizedCompany));
    const tid = c.raw?.tenant_id || (c as any).tenant_id || c.id;
    if (tid && sanitizedCompany) {
      safeSetItem(`bos_active_company_${tid}`, JSON.stringify(sanitizedCompany));
      safeSetItem(`bos_active_company_${tid}_${c.id}`, JSON.stringify(sanitizedCompany));
    }
    // Synchronize active billing GST details snapshot so invoices and POS instantly show the right company
    try {
      const cRaw: any = c.raw || c;
      const primaryReg = cRaw.gst_registrations?.find((r: any) => r.is_primary) || cRaw.gst_registrations?.[0];
      const gstin = primaryReg?.gstin || cRaw.gst_number || cRaw.gstin || '';
      const address = primaryReg?.address || cRaw.address || '';
      const billingGst = sanitizeForStorage({
        trade_name: cRaw.name,
        legal_name: cRaw.legal_name || cRaw.name,
        gstin: gstin,
        address: address,
        phone: cRaw.phone || '',
        email: cRaw.email || '',
        logo_url: cRaw.logo_url || null,
        google_review_url: cRaw.google_review_url || null,
      });
      if (tid) {
        safeSetItem(`bos_active_billing_gst_details_${tid}`, JSON.stringify(billingGst));
        safeSetItem(`bos_active_billing_gst_details_${tid}_${c.id}`, JSON.stringify(billingGst));
      }
    } catch {}
    clearApiCache();
    // Trigger storage event and custom events for instant reactivity
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent("bos-tenant-changed", { detail: c }));
    window.dispatchEvent(new CustomEvent("bos-company-changed", { detail: c }));
    window.dispatchEvent(new CustomEvent("print_templates_updated"));
    window.dispatchEvent(new CustomEvent("bos_invoice_template_changed"));
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

  const tenantRef = React.useRef(tenant);
  tenantRef.current = tenant;
  const activeBranchRef = React.useRef(activeBranch);
  activeBranchRef.current = activeBranch;

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

      // 1. Always prioritize loading actual registered companies/organizations of this tenant
      const [coResult, brResult] = await Promise.allSettled([
        companiesApi.list(1, 100),
        branchesApi.list(1, 100)
      ]);

      if (coResult.status === "fulfilled" && coResult.value?.items && coResult.value.items.length > 0) {
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

      // 2. Fallback to platform tenants if no companies returned (or pure system view)
      if (mappedCompanies.length === 0 && isPlatformAdminUser) {
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
      if (!isPlatformAdminUser && authUserCompanyId && !canSwitch) {
        const filtered = mappedCompanies.filter(c => c.id === authUserCompanyId);
        if (filtered.length > 0) {
          mappedCompanies = filtered;
        }
      }

      setCompaniesList(mappedCompanies);
      setBranchesList(mappedBranches);

      // Check existing stored workspace selection in localStorage
      let storedCompanyId: string | null = null;
      try {
        storedCompanyId = localStorage.getItem("bos_active_company_id");
        if (!storedCompanyId) {
          const storedComp = localStorage.getItem("bos_active_company");
          if (storedComp) {
            const parsed = JSON.parse(storedComp);
            storedCompanyId = parsed?.id || null;
          }
        }
        if (!storedCompanyId) {
          const storedStr = localStorage.getItem("bos-tenant");
          if (storedStr) {
            const parsed = JSON.parse(storedStr);
            storedCompanyId = parsed?.id || null;
          }
        }
      } catch {}

      const currentTenant = tenantRef.current;
      // Keep user's active/stored workspace if it exists in mappedCompanies
      const activeMatch = mappedCompanies.find(c => c.id === storedCompanyId || c.id === currentTenant?.id);
      if (activeMatch) {
        setTenantState(activeMatch);
        const sanitizedMatch = sanitizeForStorage(activeMatch.raw || activeMatch);
        safeSetItem("bos-tenant", JSON.stringify(activeMatch));
        safeSetItem("bos_active_company_id", activeMatch.id);
        safeSetItem("bos_active_company", JSON.stringify(sanitizedMatch));
        const tid = activeMatch.raw?.tenant_id || (activeMatch as any).tenant_id || activeMatch.id;
        if (tid) {
          safeSetItem(`bos_active_company_${tid}`, JSON.stringify(sanitizedMatch));
          safeSetItem(`bos_active_company_${tid}_${activeMatch.id}`, JSON.stringify(sanitizedMatch));
        }
        // Immediately sync billing GST snapshot for this company to prevent stale cross-workspace bleed
        try {
          const cRaw: any = activeMatch.raw || activeMatch;
          const primaryReg = cRaw.gst_registrations?.find((r: any) => r.is_primary) || cRaw.gst_registrations?.[0];
          const gstin = primaryReg?.gstin || cRaw.gst_number || cRaw.gstin || '';
          const address = primaryReg?.address || cRaw.address || '';
          const billingGst = sanitizeForStorage({
            trade_name: cRaw.name,
            legal_name: cRaw.legal_name || cRaw.name,
            gstin: gstin,
            address: address,
            phone: cRaw.phone || '',
            email: cRaw.email || '',
            logo_url: cRaw.logo_url || null,
            google_review_url: cRaw.google_review_url || null,
          });
          if (tid) {
            safeSetItem(`bos_active_billing_gst_details_${tid}`, JSON.stringify(billingGst));
            safeSetItem(`bos_active_billing_gst_details_${tid}_${activeMatch.id}`, JSON.stringify(billingGst));
          }
          safeSetItem("bos_active_billing_gst_details", JSON.stringify(billingGst));
        } catch {}
      } else if (mappedCompanies.length > 0) {
        // Fallback to default company in list
        const defaultMatch = mappedCompanies.find(
          c => (authUserCompanyId && c.id === authUserCompanyId) ||
               (authTenantId && c.id === authTenantId) ||
               (slug && (c.raw as any)?.slug === slug) ||
               (authTenantName && c.name.toLowerCase() === authTenantName.toLowerCase())
        ) || mappedCompanies[0];
        setTenantState(defaultMatch);
        const sanitizedDefault = sanitizeForStorage(defaultMatch.raw || defaultMatch);
        safeSetItem("bos-tenant", JSON.stringify(defaultMatch));
        safeSetItem("bos_active_company_id", defaultMatch.id);
        safeSetItem("bos_active_company", JSON.stringify(sanitizedDefault));
        const tid = defaultMatch.raw?.tenant_id || (defaultMatch as any).tenant_id || defaultMatch.id;
        if (tid) {
          safeSetItem(`bos_active_company_${tid}`, JSON.stringify(sanitizedDefault));
          safeSetItem(`bos_active_company_${tid}_${defaultMatch.id}`, JSON.stringify(sanitizedDefault));
        }
        try {
          const cRaw: any = defaultMatch.raw || defaultMatch;
          const primaryReg = cRaw.gst_registrations?.find((r: any) => r.is_primary) || cRaw.gst_registrations?.[0];
          const gstin = primaryReg?.gstin || cRaw.gst_number || cRaw.gstin || '';
          const address = primaryReg?.address || cRaw.address || '';
          const billingGst = sanitizeForStorage({
            trade_name: cRaw.name,
            legal_name: cRaw.legal_name || cRaw.name,
            gstin: gstin,
            address: address,
            phone: cRaw.phone || '',
            email: cRaw.email || '',
            logo_url: cRaw.logo_url || null,
            google_review_url: cRaw.google_review_url || null,
          });
          if (tid) {
            safeSetItem(`bos_active_billing_gst_details_${tid}`, JSON.stringify(billingGst));
            safeSetItem(`bos_active_billing_gst_details_${tid}_${defaultMatch.id}`, JSON.stringify(billingGst));
          }
          safeSetItem("bos_active_billing_gst_details", JSON.stringify(billingGst));
        } catch {}
      }

      // Auto-select first branch if none selected
      const currentBranch = activeBranchRef.current;
      const branchIsValid = mappedBranches.some(b => b.id === currentBranch?.id);
      if (!branchIsValid && mappedBranches.length > 0) {
        setActiveBranchState(mappedBranches[0]);
        safeSetItem("bos-branch", JSON.stringify(mappedBranches[0]));
      }
    } catch (err) {
      console.error("Failed to load tenant workspace list:", err);
      setCompaniesList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();

    // Listen for auth changes from login events
    const handleAuthChange = () => {
      void loadData();
    };
    window.addEventListener("bos-auth-changed", handleAuthChange);
    return () => {
      window.removeEventListener("bos-auth-changed", handleAuthChange);
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
