import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { useAuth } from "@/contexts/auth-context";
import { TenantProvider } from "@/contexts/tenant-context";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { isAuthed, authReady, user } = useAuth();
  const navigate = useNavigate();

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
  }, [authReady, isAuthed, user, navigate]);

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
      <div className="min-h-screen flex bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppTopbar />
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </TenantProvider>
  );
}
