import { useEffect, useState, useCallback } from "react";
import {
  clearAuth,
  getAccessToken,
  getActiveOutlet,
  getActiveTenant,
  getUserProfile,
  setAccessToken,
  setActiveOutlet,
  setActiveTenant,
  setRefreshToken,
  setUserProfile,
} from "@/lib/auth-tokens";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  roles: string[];
  permissions: string[];
  isTenantOwner: boolean;
  tenantId: string;
  tenantSlug: string;
  activeOutletId?: string;
  allowedOutletIds: string[];
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => getUserProfile<AuthUser>());
  const [token, setTokenState] = useState<string | null>(() => getAccessToken());
  const [loading, setLoading] = useState<boolean>(true);

  const syncUserFromToken = useCallback((jwt: string) => {
    const payload = decodeJwtPayload(jwt);
    if (!payload) return null;

    const authUser: AuthUser = {
      id: String(payload.sub || ""),
      email: String(payload.email || ""),
      fullName: String(payload.full_name || payload.email || "User"),
      role: Array.isArray(payload.roles) && payload.roles[0] ? String(payload.roles[0]) : "member",
      roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
      permissions: Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [],
      isTenantOwner: Boolean(payload.is_tenant_owner),
      tenantId: String(payload.tenant_id || ""),
      tenantSlug: String(payload.tenant_slug || ""),
      activeOutletId: payload.active_outlet_id ? String(payload.active_outlet_id) : undefined,
      allowedOutletIds: Array.isArray(payload.allowed_outlet_ids)
        ? (payload.allowed_outlet_ids as string[])
        : [],
    };

    setUser(authUser);
    setUserProfile(authUser);
    if (authUser.tenantId) setActiveTenant(authUser.tenantId);
    if (authUser.activeOutletId) setActiveOutlet(authUser.activeOutletId);

    return authUser;
  }, []);

  useEffect(() => {
    const currentToken = getAccessToken();
    if (currentToken) {
      setTokenState(currentToken);
      syncUserFromToken(currentToken);
    }
    setLoading(false);
  }, [syncUserFromToken]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await apiClient.post<{
        access_token: string;
        refresh_token?: string;
        user: { id: string; email: string; full_name: string };
      }>("/api/v1/auth/login", { email, password }, { skipAuth: true });

      setAccessToken(data.access_token);
      setTokenState(data.access_token);
      if (data.refresh_token) {
        setRefreshToken(data.refresh_token);
      }

      const authUser = syncUserFromToken(data.access_token);
      toast.success("Welcome back!", {
        description: `Signed in as ${authUser?.fullName || email}`,
      });
      return authUser;
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || "Invalid email or password";
      toast.error("Login failed", { description: errorMsg });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setTokenState(null);
    toast.info("Signed out");
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  const switchOutlet = (outletId: string) => {
    setActiveOutlet(outletId);
    if (user) {
      const updated = { ...user, activeOutletId: outletId };
      setUser(updated);
      setUserProfile(updated);
    }
    toast.success("Switched active branch");
  };

  return {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    logout,
    switchOutlet,
  };
}
