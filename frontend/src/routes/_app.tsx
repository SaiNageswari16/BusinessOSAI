import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppTopbar } from "@/components/layout/app-topbar";
import { RibbonNavigation } from "@/components/layout/ribbon-navigation";
import { useAuth } from "@/contexts/auth-context";
import { TenantProvider } from "@/contexts/tenant-context";
import { useRbac } from "@/contexts/rbac-context";
import { isRouteAllowed, getDefaultAllowedRoute } from "@/data/modules-config";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { isAuthed, authReady, user } = useAuth();
  const { allowedModules } = useRbac();
  const navigate = useNavigate();
  const routerState = useRouterState();
  
  const searchParams = new URLSearchParams(routerState.location.searchStr);
  const isPosTerminal = routerState.location.pathname.startsWith("/pos") && searchParams.get("tab") === "terminal";
  const activeRouteKey = routerState.location.pathname + (searchParams.get("tab") ? `?tab=${searchParams.get("tab")}` : "");

  useEffect(() => {
    if (!authReady) return;

    if (!isAuthed) {
      const stored = localStorage.getItem("bos-auth");
      if (!stored) navigate({ to: "/" });
      return;
    }

    if (user?.mustChangePassword && window.location.pathname !== "/change-password") {
      navigate({ to: "/change-password" });
      return;
    }

    // Module visibility route guard (frontend gating)
    const currentPath = routerState.location.pathname;
    if (currentPath && currentPath !== "/" && !isRouteAllowed(currentPath, allowedModules)) {
      const fallback = getDefaultAllowedRoute(allowedModules);
      const [path, searchStr] = fallback.split("?");
      const search: Record<string, string> = {};
      if (searchStr) {
        new URLSearchParams(searchStr).forEach((val, key) => {
          search[key] = val;
        });
      }
      void navigate({ to: path, search });
    }
  }, [isAuthed, authReady, navigate, user, routerState.location.pathname, allowedModules]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <div className="text-lg font-semibold">Loading authentication…</div>
          <div className="mt-2 text-sm">Please wait while we restore your session.</div>
        </div>
      </div>
    );
  }

  return (
    <TenantProvider>
      <div className="h-screen overflow-hidden flex flex-col bg-background">
        {!isPosTerminal && (
          <>
            {/* Top bar */}
            <AppTopbar />
            
            {/* 3-Tier Ribbon Navigation */}
            <RibbonNavigation />
          </>
        )}

        {/* Main Content with Smooth Page Transition */}
        <main className="flex-1 min-h-0 overflow-y-auto bg-background">
          <motion.div
            key={activeRouteKey}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="w-full h-full min-h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </TenantProvider>
  );
}
