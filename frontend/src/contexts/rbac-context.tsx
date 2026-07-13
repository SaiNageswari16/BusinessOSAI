import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./auth-context";
import type { AuthRole } from "./auth-context";

interface RbacContextType {
  activeRole: AuthRole | null;
  setActiveRole: (role: AuthRole) => void;
  hasPermission: (permission: string) => boolean;
  availableRoles: AuthRole[];
}

const RbacContext = createContext<RbacContextType | undefined>(undefined);

export function RbacProvider({ children }: { children: React.ReactNode }) {
  const { user, selectRole } = useAuth();
  const [activeRole, setActiveRoleState] = useState<AuthRole | null>(null);

  // All available roles come directly from the authenticated user's real roles
  const availableRoles: AuthRole[] = React.useMemo(() => {
    return user?.roles ?? [];
  }, [user]);

  useEffect(() => {
    if (user && availableRoles.length > 0) {
      const storedRoleId = localStorage.getItem("bos-active-role");
      let initialRole = availableRoles.find((r) => r.id === storedRoleId);

      if (!initialRole) {
        // Fall back to the default role, then the first one
        initialRole =
          availableRoles.find((r) => r.is_default) ??
          availableRoles.find((r) => r.id === user.defaultRole) ??
          availableRoles[0];
      }

      setActiveRoleState(initialRole ?? null);
    } else {
      setActiveRoleState(null);
    }
  }, [user, availableRoles]);

  const setActiveRole = async (role: AuthRole) => {
    try {
      await selectRole(role.id);
    } catch (err) {
      console.error("Failed to switch role active session", err);
      setActiveRoleState(role);
      localStorage.setItem("bos-active-role", role.id);
    }
  };

  // hasPermission uses the flat permissions list on the user (aggregated across all roles by /auth/me)
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return user.permissions.includes(permission);
  };

  return (
    <RbacContext.Provider value={{ activeRole, setActiveRole, hasPermission, availableRoles }}>
      {children}
    </RbacContext.Provider>
  );
}

export function useRbac() {
  const context = useContext(RbacContext);
  if (context === undefined) {
    throw new Error("useRbac must be used within an RbacProvider");
  }
  return context;
}
