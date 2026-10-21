import { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";

export interface CanProps {
  permission?: string;
  anyPermission?: string[];
  allPermissions?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Declarative UI Authorization Guard.
 * Renders `children` only if the authenticated user possesses the required permission(s).
 *
 * Example:
 * <Can permission="pos:orders:discount" fallback={<span className="text-xs text-muted-foreground">Discount disabled</span>}>
 *   <Button onClick={applyDiscount}>Apply Discount</Button>
 * </Can>
 */
export function Can({
  permission,
  anyPermission,
  allPermissions,
  fallback = null,
  children,
}: CanProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  let allowed = true;

  if (permission && !hasPermission(permission)) {
    allowed = false;
  }

  if (anyPermission && anyPermission.length > 0 && !hasAnyPermission(...anyPermission)) {
    allowed = false;
  }

  if (allPermissions && allPermissions.length > 0 && !hasAllPermissions(...allPermissions)) {
    allowed = false;
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
