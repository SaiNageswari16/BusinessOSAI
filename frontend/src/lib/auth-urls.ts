/**
 * Utility to resolve Sign In, Sign Up, and Dashboard URLs seamlessly for both local development and live servers.
 * - Sign In: navigates to `/login` (relative to active origin).
 * - Sign Up: navigates to `/login?mode=register` (relative to active origin).
 * - Dashboard: navigates to `/dashboard` (relative to active origin).
 */
export { isLocalEnvironment, getAuthUrl, getAuthUrls } from "./auth-navigation";
