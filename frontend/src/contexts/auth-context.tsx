import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export interface AuthRole {
  id: string;
  name: string;
  is_default: boolean;
  description?: string;
  permissions?: string[];
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  status: "Active" | "Inactive";
  tenantId: string | null;
  tenantSlug: string | null;
  isTenantOwner: boolean;
  permissions: string[];
  roles: AuthRole[];
  assignedRoles: string[];
  defaultRole: string;
  activeRoleId: string | null;
  mustChangePassword: boolean;
}


interface LoginPayload {
  email: string;
  password: string;
  tenant_slug?: string;
}

interface RegisterPayload {
  tenant_name: string;
  tenant_slug?: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
  company_name: string;
}

interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  must_change_password?: boolean;
  requires_role_selection?: boolean;
  active_role_id?: string | null;
}

interface StoredAuth {
  user: AppUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthCtx {
  user: AppUser | null;
  accessToken: string | null;
  isAuthed: boolean;
  authReady: boolean;
  login: (payload: LoginPayload) => Promise<{ user: AppUser; token: TokenResponse }>;
  register: (payload: RegisterPayload) => Promise<{ user: AppUser; token: TokenResponse }>;
  selectRole: (roleId: string) => Promise<{ user: AppUser; token: TokenResponse }>;
  changePassword: (payload: ChangePasswordPayload) => Promise<{ user: AppUser; token: TokenResponse }>;
  applySession: (user: AppUser, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

async function parseError(response: Response) {
  let detail = response.statusText;
  try {
    const json = await response.json();
    if (typeof json.detail === "string") detail = json.detail;
    else if (Array.isArray(json.detail)) detail = json.detail.map((item: { msg?: string }) => item.msg).join(", ");
    else if (json.message) detail = json.message;
  } catch {
    /* ignore */
  }
  return detail;
}

function buildAvatar(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function mapUser(json: Record<string, unknown>): AppUser {
  const roles = (json.roles as AuthRole[] | undefined) ?? [];
  return {
    id: String(json.id),
    tenantId: json.tenant_id ? String(json.tenant_id) : null,
    tenantSlug: json.tenant_slug ? String(json.tenant_slug) : null,
    name: String(json.full_name ?? ""),
    email: String(json.email ?? ""),
    avatar: String(json.avatar_initials || buildAvatar(String(json.full_name ?? json.email ?? ""))),
    status: json.status === "active" ? "Active" : "Inactive",
    isTenantOwner: Boolean(json.is_tenant_owner),
    permissions: (json.permissions as string[] | undefined) ?? [],
    roles,
    assignedRoles: roles.map((role) => role.id),
    defaultRole: roles.find((role) => role.is_default)?.id ?? roles[0]?.id ?? "",
    activeRoleId: json.active_role_id ? String(json.active_role_id) : null,
    mustChangePassword: Boolean(json.must_change_password),
  };
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const persistAuth = (nextUser: AppUser, nextAccessToken: string, nextRefreshToken: string) => {
    const stored: StoredAuth = { user: nextUser, accessToken: nextAccessToken, refreshToken: nextRefreshToken };
    localStorage.setItem("bos-auth", JSON.stringify(stored));
  };

  const applySession = (nextUser: AppUser, nextAccessToken: string, nextRefreshToken: string) => {
    setUser(nextUser);
    setAccessToken(nextAccessToken);
    setRefreshToken(nextRefreshToken);
    persistAuth(nextUser, nextAccessToken, nextRefreshToken);
  };

  const clearAuthQueryParams = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("access_token");
    url.searchParams.delete("refresh_token");
    url.searchParams.delete("expires_in");
    window.history.replaceState({}, "", url.pathname + url.search);
  };

  const fetchUser = async (token: string): Promise<AppUser> => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await parseError(response));
    return mapUser(await response.json());
  };

  const hydrateFromTokens = async (tokenData: TokenResponse) => {
    const currentUser = await fetchUser(tokenData.access_token);
    // Merge must_change_password from token (more up to date than /me during password change)
    const merged: AppUser = {
      ...currentUser,
      mustChangePassword: tokenData.must_change_password ?? currentUser.mustChangePassword,
    };
    applySession(merged, tokenData.access_token, tokenData.refresh_token);
    return { user: merged, token: tokenData };
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthAccessToken = params.get("access_token");
    const oauthRefreshToken = params.get("refresh_token");

    const loadStoredAuth = async () => {
      const stored = localStorage.getItem("bos-auth");
      if (!stored) return;
      
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      
      try {
        const parsed: StoredAuth = JSON.parse(stored);
        
        // Fast fail if token is locally known to be expired
        if (parsed.accessToken) {
          try {
            const payload = JSON.parse(atob(parsed.accessToken.split('.')[1]));
            if (payload.exp && payload.exp * 1000 < Date.now()) {
              throw new Error("Token expired");
            }
          } catch (e) {
            // Ignore parse errors and just try the backend
          }
        }
        
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 500); // reduced from 1500ms to 500ms
        
        // Custom fetch with abort signal just for this initial load
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${parsed.accessToken}` },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error("Invalid session");
        const currentUser = mapUser(await response.json());
        
        applySession(currentUser, parsed.accessToken, parsed.refreshToken);
      } catch (err) {
        clearTimeout(timeoutId);
        localStorage.removeItem("bos-auth");
        localStorage.removeItem("bos-active-role");
      }
    };

    if (oauthAccessToken && oauthRefreshToken) {
      void hydrateFromTokens({
        access_token: oauthAccessToken,
        refresh_token: oauthRefreshToken,
        token_type: "bearer",
        expires_in: 0,
      })
        .catch(() => localStorage.removeItem("bos-auth"))
        .finally(() => {
          clearAuthQueryParams();
          setAuthReady(true);
        });
      return;
    }

    void loadStoredAuth().finally(() => setAuthReady(true));
  }, []);

  const login = async (payload: LoginPayload) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await parseError(response));
    return hydrateFromTokens(await response.json());
  };

  const register = async (payload: RegisterPayload) => {
    const response = await fetch(`${API_BASE_URL}/auth/register-tenant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await parseError(response));
    return hydrateFromTokens(await response.json());
  };

  const selectRole = async (roleId: string) => {
    if (!accessToken) throw new Error("Not authenticated");
    const response = await fetch(`${API_BASE_URL}/auth/select-role`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role_id: roleId }),
    });
    if (!response.ok) throw new Error(await parseError(response));
    const tokenData: TokenResponse = await response.json();
    const currentUser = await fetchUser(tokenData.access_token);
    applySession(currentUser, tokenData.access_token, tokenData.refresh_token);
    localStorage.setItem("bos-active-role", roleId);
    return { user: currentUser, token: tokenData };
  };

  const changePassword = async (payload: ChangePasswordPayload) => {
    if (!accessToken) throw new Error("Not authenticated");
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await parseError(response));
    const tokenData: TokenResponse = await response.json();
    return hydrateFromTokens(tokenData);
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem("bos-auth");
    localStorage.removeItem("bos-active-role");
  };

  // Inactivity timeout of 30 minutes (30 * 60 * 1000 ms)
  useEffect(() => {
    if (!user) return;

    let lastActive = Date.now();

    const handleActivity = () => {
      lastActive = Date.now();
    };

    // Events that count as user activity
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach(event => window.addEventListener(event, handleActivity));

    // Check inactivity every 10 seconds
    const interval = setInterval(() => {
      const inactiveMs = Date.now() - lastActive;
      if (inactiveMs >= 30 * 60 * 1000) {
        console.log("Session expired due to inactivity");
        logout();
        window.location.href = "/"; // Redirect back to login screen
      }
    }, 10000);

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      clearInterval(interval);
    };
  }, [user]);

  return (
    <Ctx.Provider
      value={{
        user,
        accessToken,
        isAuthed: !!user,
        authReady,
        login,
        register,
        selectRole,
        changePassword,
        applySession,
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

export function resolvePostAuthRoute(user: AppUser, token?: TokenResponse): "/change-password" | "/role-select" | "/dashboard" {
  if (user.mustChangePassword || token?.must_change_password) return "/change-password";
  if (token?.requires_role_selection || (user.roles.length > 1 && !token?.active_role_id && !user.activeRoleId)) {
    return "/role-select";
  }
  return "/dashboard";
}

export function canAssignSuperAdmin(user: AppUser | null): boolean {
  return user?.isTenantOwner ?? false;
}
