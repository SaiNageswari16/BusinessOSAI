import { useMemo } from "react";
import { useAuth } from "./use-auth";

export function usePermissions() {
  const { user } = useAuth();

  const permissionsSet = useMemo(() => {
    return new Set(user?.permissions || []);
  }, [user?.permissions]);

  const hasPermission = (permission: string): boolean => {
    // In local demo / unauthenticated preview mode, allow demo UI navigation
    if (!user) return true;
    if (user.isTenantOwner) return true;
    if (permissionsSet.has("*")) return true;
    if (permissionsSet.has(permission)) return true;

    // Check module wildcard (e.g. "pos:*" satisfies "pos:orders:create")
    const parts = permission.split(":");
    if (parts.length >= 2) {
      if (permissionsSet.has(`${parts[0]}:*`)) return true;
      if (permissionsSet.has(`${parts[0]}:${parts[1]}:*`)) return true;
    }

    return false;
  };

  const hasAnyPermission = (...perms: string[]): boolean => {
    return perms.some((p) => hasPermission(p));
  };

  const hasAllPermissions = (...perms: string[]): boolean => {
    return perms.every((p) => hasPermission(p));
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isTenantOwner: Boolean(user?.isTenantOwner),
    role: user?.role,
    roles: user?.roles || [],
  };
}
