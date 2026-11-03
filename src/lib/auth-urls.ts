/**
 * Utility to resolve Sign In, Sign Up, and Dashboard URLs seamlessly for both local development and live servers.
 * - Sign In: navigates to `/login` (or http://localhost:8080/login) on local, or `https://lazymonkeyai.com/login` on production server.
 * - Sign Up: navigates to `/login?mode=register` (or http://localhost:8080/login?mode=register) on local, or `https://lazymonkeyai.com/login?mode=register` on production server.
 * - Dashboard: navigates to `/dashboard` (or http://localhost:8080/dashboard) on local, or `https://lazymonkeyai.com/dashboard` on production server.
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

export function getAuthUrls() {
  const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  const envBase = (env && env["VITE_AUTH_URL"]) as string | undefined;
  if (envBase) {
    const cleanBase = envBase.replace(/\/+$/, "");
    return {
      signIn: `${cleanBase}/login`,
      signUp: `${cleanBase}/login?mode=register`,
      dashboard: `${cleanBase}/dashboard`,
    };
  }

  if (isLocalEnvironment()) {
    const isAlready8080 = typeof window !== "undefined" && window.location.port === "8080";
    const appBase = isAlready8080 ? "" : "http://localhost:8080";
    return {
      signIn: `${appBase}/login`,
      signUp: `${appBase}/login?mode=register`,
      dashboard: `${appBase}/dashboard`,
    };
  }

  return {
    signIn: "https://lazymonkeyai.com/login",
    signUp: "https://lazymonkeyai.com/login?mode=register",
    dashboard: "https://lazymonkeyai.com/dashboard",
  };
}
