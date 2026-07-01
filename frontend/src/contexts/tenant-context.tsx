import React, { createContext, useContext, useState, useEffect } from "react";
import { companies } from "@/data/mock";

export type Company = typeof companies[0];

interface TenantContextType {
  tenant: Company;
  setTenant: (c: Company) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenantState] = useState<Company>(() => {
    try {
      const stored = localStorage.getItem("bos-tenant");
      if (stored) {
        const parsed = JSON.parse(stored);
        const match = companies.find(c => c.id === parsed.id);
        if (match) return match;
      }
    } catch (e) {
      // ignore
    }
    return companies[0];
  });

  const setTenant = (c: Company) => {
    setTenantState(c);
    localStorage.setItem("bos-tenant", JSON.stringify(c));
  };

  return (
    <TenantContext.Provider value={{ tenant, setTenant }}>
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
