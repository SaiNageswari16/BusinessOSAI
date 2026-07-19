import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppTopbar } from "@/components/layout/app-topbar";
import { RibbonNavigation } from "@/components/layout/ribbon-navigation";
import { useAuth } from "@/contexts/auth-context";
import { TenantProvider } from "@/contexts/tenant-context";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { isAuthed, authReady, user } = useAuth();
  const navigate = useNavigate();
  const routerState = useRouterState();
  
  const searchParams = new URLSearchParams(routerState.location.searchStr);
  const isPosTerminal = routerState.location.pathname.startsWith("/pos") && searchParams.get("tab") === "terminal";

  useEffect(() => {
    if (!authReady) return;

    if (!isAuthed) {
      const stored = localStorage.getItem("bos-auth");
      if (!stored) navigate({ to: "/" });
      return;
    }

    if (user?.mustChangePassword && window.location.pathname !== "/change-password") {
      navigate({ to: "/change-password" });
    }
  }, [isAuthed, authReady, navigate, user]);

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

        {/* Main Content */}
        <main className="flex-1 min-h-0 overflow-y-auto bg-slate-50 dark:bg-background">
          <Outlet />
        </main>
      </div>
    </TenantProvider>
  );
}
