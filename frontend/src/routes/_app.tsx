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
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // demo: auto-login if not authed so deep links work
    if (!isAuthed) {
      const stored = localStorage.getItem("bos-auth");
      if (!stored) navigate({ to: "/" });
    }
  }, [isAuthed, navigate]);

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
