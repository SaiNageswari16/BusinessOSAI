import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./auth-context";
import { mockRoles, Role } from "@/data/mockRbacData";

interface RbacContextType {
  activeRole: Role | null;
  setActiveRole: (role: Role) => void;
  hasPermission: (permission: string) => boolean;
  availableRoles: Role[];
}

const RbacContext = createContext<RbacContextType | undefined>(undefined);

export function RbacProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeRole, setActiveRoleState] = useState<Role | null>(null);

  const availableRoles = React.useMemo(() => {
    if (!user) return [];
    return user.assignedRoles.map(rid => mockRoles.find(r => r.id === rid)).filter(Boolean) as Role[];
  }, [user]);

  useEffect(() => {
    if (user && availableRoles.length > 0) {
      const storedRoleId = localStorage.getItem("bos-active-role");
      let initialRole = availableRoles.find(r => r.id === storedRoleId);
      
      if (!initialRole) {
        initialRole = availableRoles.find(r => r.id === user.defaultRole) || availableRoles[0];
      }
      
      setActiveRoleState(initialRole);
    } else {
      setActiveRoleState(null);
    }
  }, [user, availableRoles]);

  const setActiveRole = (role: Role) => {
    setActiveRoleState(role);
    localStorage.setItem("bos-active-role", role.id);
  };

  const hasPermission = (permission: string) => {
    if (!activeRole) return false;
    return activeRole.permissions.includes(permission);
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
