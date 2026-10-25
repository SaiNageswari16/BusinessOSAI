import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Database,
  FileClock,
  Globe,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  ScrollText,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import { platformService, type FleetHealthReport } from "@/services/platformService";
import { clearPlatformToken, getPlatformToken } from "@/lib/auth-tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlatformShellProps {
  children: ReactNode;
}

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      {
        to: "/platform",
        label: "Fleet & Health",
        icon: Activity,
        badge: "14 Services",
      },
    ],
  },
  {
    label: "Tenants & Modules",
    items: [
      {
        to: "/platform/tenants",
        label: "Tenant Provisioning",
        icon: Users,
        badge: "Multitenancy",
      },
      {
        to: "/platform/modules",
        label: "Module Lifecycle",
        icon: Boxes,
        badge: "Kill-Switch",
      },
    ],
  },
  {
    label: "Access & Control",
    items: [
      {
        to: "/platform/permissions",
        label: "RBAC & Policies",
        icon: KeyRound,
        badge: "Granular",
      },
      {
        to: "/platform/admins",
        label: "Admin Users",
        icon: ShieldCheck,
        badge: "Control Plane",
      },
      {
        to: "/platform/audit",
        label: "Audit Trail",
        icon: FileClock,
        badge: "Immutable",
      },
    ],
  },
];

export function PlatformShell({ children }: PlatformShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fleetHealth, setFleetHealth] = useState<FleetHealthReport | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const loadHealth = async () => {
    try {
      setRefreshing(true);
      const data = await platformService.getFleetHealth();
      setFleetHealth(data);
    } catch {
      setFleetHealth({
        overall_status: "down",
        services_up: 0,
        services_total: 14,
        services: [],
        checked_at: new Date().toISOString(),
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    clearPlatformToken();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-800">
      {/* Top Banner / Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-6 h-16 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <Link to="/platform" className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20 ring-1 ring-black/5">
              <Shield className="size-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-slate-900">BusinessOS</span>
                <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 text-[10px] px-1.5 py-0 uppercase tracking-widest font-mono font-medium">
                  Control Plane
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">Platform Super Admin Portal</p>
            </div>
          </Link>
        </div>

        {/* Center Fleet Status */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "size-2 rounded-full animate-pulse",
              fleetHealth?.overall_status === "ok" ? "bg-emerald-500 shadow-xs shadow-emerald-500/40" : "bg-amber-500"
            )} />
            <span className="text-slate-700 font-medium">Fleet Mesh</span>
          </div>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500 font-mono text-[11px]">
            {fleetHealth?.services_up ?? 14}/{fleetHealth?.services_total ?? 14} Services Active
          </span>
          <button
            onClick={loadHealth}
            disabled={refreshing}
            className="text-slate-400 hover:text-slate-700 transition-transform active:rotate-180"
            title="Refresh Fleet Health"
          >
            <RefreshCw className={cn("size-3", refreshing && "animate-spin")} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Tenant Workspace</span>
          </Link>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold text-xs flex items-center justify-center">
              SA
            </div>
            <div className="hidden sm:block text-left text-xs">
              <p className="font-medium text-slate-900 leading-tight">Super Admin</p>
              <p className="text-[10px] text-slate-500">platform:superadmin</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Sign out of Platform"
            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 size-8"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside
          className={cn(
            "fixed inset-y-16 left-0 z-30 w-64 bg-white border-r border-slate-200 p-4 transition-transform duration-200 md:static md:translate-x-0 flex flex-col justify-between",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="space-y-6">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2 font-mono">
                  {group.label}
                </p>
                <nav className="space-y-1">
                  {group.items.map((item) => {
                    const isActive =
                      location.pathname === item.to ||
                      (item.to !== "/platform" && location.pathname.startsWith(item.to));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                          isActive
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-semibold shadow-xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={cn("size-4 transition-colors", isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")} />
                          <span>{item.label}</span>
                        </div>
                        <span className={cn(
                          "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                          isActive
                            ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                          {item.badge}
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}

            {/* Architecture Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex items-center gap-2 text-indigo-600 font-semibold">
                <Layers className="size-4" />
                <span>Isolated Schemas</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Zero shared declarative bases across 14 services. Each service owns its private database (<code className="text-slate-800 bg-slate-200/60 px-1 py-0.5 rounded">restaurantos_*</code>) and cross-service RPC traverses Gateway (:8000).
              </p>
            </div>
          </div>

          {/* Footer Version Info */}
          <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between px-2 font-mono">
            <span>Version 2.0-Enterprise</span>
            <span className="text-emerald-600 flex items-center gap-1 font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Online
            </span>
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-20 bg-slate-900/30 backdrop-blur-xs md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
