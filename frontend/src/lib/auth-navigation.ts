/**
 * Environment-aware Authentication & App Navigation
 * 
 * Ensures that:
 * - When developing or working on a local system (localhost, 127.0.0.1, local ports),
 *   navigation stays within the local environment (e.g. `/login` and `/login?mode=register`).
 * - When running on the production server (e.g. lazymonkeyai.com),
 *   navigation redirects to the production server login/app (`https://lazymonkeyai.com/login` and `https://lazymonkeyai.com/login?mode=register`).
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

  if (isLocalEnvironment()) {
    return normalizedPath;
  }

  return `https://lazymonkeyai.com${normalizedPath}`;
}

export function getAuthUrls() {
  return {
    signIn: getAuthUrl("/login"),
    signUp: getAuthUrl("/login?mode=register"),
    dashboard: getAuthUrl("/dashboard"),
  };
}
