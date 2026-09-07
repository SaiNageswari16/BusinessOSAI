import React, { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/auth-context";
import { useRbac } from "@/contexts/rbac-context";
import { TenantProvider } from "@/contexts/tenant-context";
import { Unauthorized } from "@/components/unauthorized";
import { PlatformAdminDashboard } from "@/components/admin/PlatformAdminDashboard";
import { ArrowLeft, ShieldAlert, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/platform-admin")({
  component: StandalonePlatformAdminPage,
});

function StandalonePlatformAdminPage() {
  const { user, isAuthed, authReady, logout } = useAuth();
  const { hasPermission } = useRbac();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authReady) return;
    if (!isAuthed) {
      navigate({ to: "/login" });
    }
  }, [authReady, isAuthed, navigate]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="text-center">
          <div className="text-lg font-semibold text-white">Loading God Mode Security Context…</div>
          <div className="mt-2 text-xs text-slate-500">Authenticating Platform Super Admin credentials</div>
        </div>
      </div>
    );
  }

  const isPlatformAdmin =
    Boolean(user?.isPlatformAdmin) ||
    user?.email === "venaticfungus@gmail.com" ||
    hasPermission("all") ||
    hasPermission("manage:all") ||
    hasPermission("super_admin");

  if (!isPlatformAdmin) {
    return <Unauthorized />;
  }

  return (
    <TenantProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-150">
        {/* Supreme God Mode Standalone Topbar - Themed with LazyMonkey AI */}
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border/80 px-4 sm:px-8 py-2.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl gradient-brand text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold tracking-tight text-foreground">
                  LazyMonkey <span className="text-purple-700 dark:text-purple-400">OS</span>
                </span>
                <span className="px-2 py-0.5 text-[9.5px] font-extrabold uppercase rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800 tracking-wider">
                  ⚡ GOD MODE ROOT
                </span>
              </div>
              <div className="text-[10.5px] text-muted-foreground">
                Platform Super Admin & Cross-Tenant Oversight
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/dashboard" })}
              className="h-8 text-xs font-semibold border-border bg-background hover:bg-muted text-foreground"
            >
              <LayoutDashboard className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
              Exit to Workspace Dashboard
            </Button>

            <div className="h-5 w-px bg-border hidden sm:block" />

            <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-muted/40 border border-border/50">
              <div className="size-7 rounded-full gradient-brand text-white font-bold flex items-center justify-center text-xs shadow-xs">
                {user?.avatar || "V"}
              </div>
              <div className="hidden md:block text-left text-xs">
                <div className="font-bold text-foreground leading-tight">{user?.name || "Platform Admin"}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{user?.email}</div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                navigate({ to: "/" });
              }}
              title="Sign Out"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Main Console Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <PlatformAdminDashboard />
        </main>
      </div>
    </TenantProvider>
  );
}
