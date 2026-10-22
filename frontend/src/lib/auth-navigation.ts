/**
 * Environment-aware Authentication & App Navigation
 * 
 * Ensures that:
 * - When developing or working on a local system (localhost, 127.0.0.1, local ports),
 *   navigation stays within the local environment (e.g. `/login`).
 * - When running on the production server (e.g. lazymonkeyai.com),
 *   navigation redirects to the production server login/app (`https://lazymonkeyai.com/login`).
 */

export function isLocalEnvironment(): boolean {
  if (typeof window === "undefined") return true;
  const { hostname, port } = window.location;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    port === "8080" ||
    port === "5173" ||
    port === "3000"
  );
}

export function getAuthUrl(path: string = "/login"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (isLocalEnvironment()) {
    return normalizedPath;
  }
  return `https://lazymonkeyai.com${normalizedPath}`;
}
