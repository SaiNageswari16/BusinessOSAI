import { createFileRoute, useRouterState, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import {
  Crown,
  Users,
  ShieldCheck,
  Building2,
  Building,
  Activity,
  History,
  Settings,
  Sparkles,
  CheckCircle2,
  Plus,
  ArrowRight,
  ShieldAlert,
  Search,
  LayoutDashboard,
  Layers,
  Key,
  Database,
  Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { useRbac } from "@/contexts/rbac-context";
import { cn } from "@/lib/utils";

// ERP Components
import { UserManagement } from "@/components/erp/UserManagement";
import { RolesPermissions } from "@/components/erp/RolesPermissions";
import { SuperAdminManagement } from "@/components/erp/SuperAdminManagement";
import { CompanyManagement } from "@/components/erp/CompanyManagement";
import { BranchManagement } from "@/components/erp/BranchManagement";
import { SystemHealth } from "@/components/erp/SystemHealth";
import { AuditLogs } from "@/components/erp/AuditLogs";
import { GlobalSettings } from "@/components/erp/GlobalSettings";

export const Route = createFileRoute("/_app/portfolio")({
  component: BusinessOwnerPortfolioPage,
});

type PortfolioTab = "overview" | "users" | "roles" | "organizations" | "company" | "system";

export function BusinessOwnerPortfolioPage() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { hasPermission } = useRbac();
  const routerState = useRouterState();
  const navigate = useNavigate();

  // Read ?tab= query parameter
  const activeTab: PortfolioTab = useMemo(() => {
    const searchStr = routerState.location.searchStr;
    if (searchStr.includes("tab=")) {
      const params = new URLSearchParams(searchStr);
      const tab = params.get("tab") as PortfolioTab;
      if (["overview", "users", "roles", "organizations", "company", "system"].includes(tab)) {
        return tab;
      }
    }
    return "overview";
  }, [routerState.location.searchStr]);

  const setTab = (tab: PortfolioTab) => {
    void navigate({
      to: "/portfolio",
      search: { tab },
    });
  };

  const isPlatformSuperAdmin = Boolean(
    user?.isPlatformAdmin ||
    user?.permissions.includes("super_admin") ||
    user?.permissions.includes("manage:system_admin")
  );

  return (
    <div className="min-h-full bg-background flex flex-col p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ─── Executive Banner ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-8 shadow-sm">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-gradient-to-br from-amber-500/10 via-primary/10 to-transparent blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="size-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold shadow-inner">
                <Crown className="size-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Business Owner Portfolio
              </h1>
              {isPlatformSuperAdmin ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                  <Sparkles className="size-3" /> GOD MODE SUPER ADMIN
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/15 text-primary border border-primary/30 inline-flex items-center gap-1">
                  <ShieldCheck className="size-3" /> BUSINESS OWNER
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Centralized executive control plane for <strong>{user?.name || "Business Owner"}</strong>. Manage your organisation workspaces, team members, roles & permissions, company profile, and platform health.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              size="sm"
              onClick={() => setTab("users")}
              className="gradient-brand text-white border-0 text-xs shadow-sm font-semibold"
            >
              <Plus className="size-3.5 mr-1.5" /> Add Team User
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTab("roles")}
              className="text-xs font-semibold"
            >
              <ShieldCheck className="size-3.5 mr-1.5" /> Create Role
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setTab("organizations")}
              className="text-xs font-semibold"
            >
              <Building2 className="size-3.5 mr-1.5" /> Workspaces
            </Button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t overflow-x-auto no-scrollbar">
          {[
            { id: "overview", label: "Executive Overview", icon: LayoutDashboard },
            { id: "users", label: "Users & Team", icon: Users },
            { id: "roles", label: "Roles & Permissions", icon: ShieldCheck },
            { id: "organizations", label: "Workspaces & Orgs", icon: Building2 },
            { id: "company", label: "Company & Branches", icon: Building },
            { id: "system", label: "System Health & Logs", icon: Activity },
          ].map((tabItem) => {
            const Icon = tabItem.icon;
            const isCurrent = activeTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                onClick={() => setTab(tabItem.id as PortfolioTab)}
                className={cn(
                  "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0",
                  isCurrent
                    ? "bg-primary text-primary-foreground shadow-sm scale-105"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                <span>{tabItem.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Tab Content ───────────────────────────────────────────────────── */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {/* Executive Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={() => setTab("users")}
                  className="bg-card p-5 rounded-2xl border shadow-sm hover:border-primary/50 transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                    <span>Team & Staff</span>
                    <div className="size-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Users className="size-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-foreground">{user?.roles?.length || 1}+ Roles</div>
                  <div className="text-xs text-primary flex items-center gap-1 font-medium">
                    Manage users and staff accounts <ArrowRight className="size-3" />
                  </div>
                </div>

                <div
                  onClick={() => setTab("roles")}
                  className="bg-card p-5 rounded-2xl border shadow-sm hover:border-primary/50 transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                    <span>Access Control</span>
                    <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ShieldCheck className="size-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-foreground">RBAC Engine</div>
                  <div className="text-xs text-primary flex items-center gap-1 font-medium">
                    Configure custom roles & permissions <ArrowRight className="size-3" />
                  </div>
                </div>

                <div
                  onClick={() => setTab("organizations")}
                  className="bg-card p-5 rounded-2xl border shadow-sm hover:border-primary/50 transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                    <span>Multi-Tenant Workspaces</span>
                    <div className="size-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Building2 className="size-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-foreground">{tenant?.name || "Global Platform"}</div>
                  <div className="text-xs text-primary flex items-center gap-1 font-medium">
                    Manage workspace organisations <ArrowRight className="size-3" />
                  </div>
                </div>

                <div
                  onClick={() => setTab("system")}
                  className="bg-card p-5 rounded-2xl border shadow-sm hover:border-primary/50 transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                    <span>Platform Telemetry</span>
                    <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Activity className="size-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="size-6" /> Healthy
                  </div>
                  <div className="text-xs text-emerald-600 font-medium">
                    All core systems operational
                  </div>
                </div>
              </div>

              {/* Action Launchpad Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-card rounded-2xl border p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Users className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">User & Staff Management</h3>
                      <p className="text-xs text-muted-foreground">Add and configure team members</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Create new administrative accounts, set role permissions, reset user credentials, and toggle account activation status.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setTab("users")}
                    className="w-full text-xs font-semibold"
                  >
                    Open User Control <ArrowRight className="size-3.5 ml-1.5" />
                  </Button>
                </div>

                <div className="bg-card rounded-2xl border p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                      <ShieldCheck className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">Roles & Permissions</h3>
                      <p className="text-xs text-muted-foreground">Granular security matrices</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Define custom roles (Manager, Cashier, Auditor, Org Admin), assign module access, and control read/write rights.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTab("roles")}
                    className="w-full text-xs font-semibold"
                  >
                    Configure Roles <ArrowRight className="size-3.5 ml-1.5" />
                  </Button>
                </div>

                <div className="bg-card rounded-2xl border p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <Building2 className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">Workspaces & Orgs</h3>
                      <p className="text-xs text-muted-foreground">Platform multi-tenancy</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Create child organisations, customize workspace subdomains, enable module packages, and review self-service registrations.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setTab("organizations")}
                    className="w-full text-xs font-semibold"
                  >
                    Manage Workspaces <ArrowRight className="size-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>

              {/* Embedded Quick Multi-Tenant SuperAdmin View */}
              <div className="bg-card rounded-2xl border p-6 shadow-sm">
                <div className="mb-4">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Crown className="size-4 text-amber-500" /> Platform Multi-Tenant Workspaces
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Live overview of registered organisations and global platform users
                  </p>
                </div>
                <SuperAdminManagement />
              </div>
            </motion.div>
          )}

          {activeTab === "users" && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <UserManagement />
            </motion.div>
          )}

          {activeTab === "roles" && (
            <motion.div
              key="roles"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <RolesPermissions />
            </motion.div>
          )}

          {activeTab === "organizations" && (
            <motion.div
              key="organizations"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <SuperAdminManagement />
            </motion.div>
          )}

          {activeTab === "company" && (
            <motion.div
              key="company"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <div className="bg-card rounded-2xl border p-6 shadow-sm">
                <CompanyManagement />
              </div>
              <div className="bg-card rounded-2xl border p-6 shadow-sm">
                <BranchManagement />
              </div>
            </motion.div>
          )}

          {activeTab === "system" && (
            <motion.div
              key="system"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <div className="bg-card rounded-2xl border p-6 shadow-sm">
                <SystemHealth />
              </div>
              <div className="bg-card rounded-2xl border p-6 shadow-sm">
                <AuditLogs />
              </div>
              <div className="bg-card rounded-2xl border p-6 shadow-sm">
                <GlobalSettings />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
