/**
 * Environment-aware Authentication & App Navigation
 * 
 * Ensures that:
 * - Navigation stays relative to the current environment and origin (/login, /login?mode=register, /dashboard).
 * - On localhost (e.g. http://localhost:8080), it opens http://localhost:8080/login.
 * - On production or custom domains, it preserves the active host.
 * - If an external SSO / Auth URL is explicitly configured via VITE_AUTH_URL, it uses that base URL.
 */

export function isLocalEnvironment(): boolean {
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
    ) {
      return true;
    }
  }

  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    return true;
  }

  return false;
}

export function getAuthUrl(path: string = "/login"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  const envBase = (env && env["VITE_AUTH_URL"]) as string | undefined;

  if (envBase) {
    const cleanBase = envBase.replace(/\/+$/, "");
    return `${cleanBase}${normalizedPath}`;
  }

  // Always use relative path so it routes directly to the current origin (localhost or production domain)
  return normalizedPath;
}

export function getAuthUrls() {
  return {
    signIn: getAuthUrl("/login?mode=login"),
    signUp: getAuthUrl("/login?mode=register"),
    dashboard: getAuthUrl("/dashboard"),
  };
}
