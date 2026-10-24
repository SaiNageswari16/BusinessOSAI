/**
 * Utility to resolve Sign In, Sign Up, and Dashboard URLs seamlessly for both local development and live servers.
 * - Sign In: navigates to `/login` (on local) or `https://lazymonkeyai.com/login` (on production server).
 * - Sign Up: navigates to `/login?mode=register` (on local) or `https://lazymonkeyai.com/login?mode=register` (on production server).
 * - Dashboard: navigates to `/dashboard` (on local) or `https://lazymonkeyai.com/dashboard` (on production server).
 */
export { isLocalEnvironment, getAuthUrl, getAuthUrls } from "./auth-navigation";
