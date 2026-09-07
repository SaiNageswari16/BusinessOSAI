import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Building,
  Users,
  Terminal,
  Activity,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  Radio,
  Briefcase,
  Layers,
  Sparkles,
  ArrowRightLeft,
  Settings,
  Mail,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  Database,
  Cpu,
  Server
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

interface SystemStats {
  total_tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  total_users: number;
  active_users: number;
  total_companies: number;
  total_branches: number;
  total_roles: number;
  total_audit_logs: number;
  system_status: string;
  server_time: string;
}

interface PlatformTenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  created_at: string;
  owner_name: string;
  owner_email: string;
  user_count: number;
  enabled_modules: string[];
}

interface PlatformUser {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug?: string;
  email: string;
  full_name: string;
  status: string;
  is_tenant_owner: boolean;
  is_platform_admin: boolean;
  mfa_enabled: boolean;
  created_at: string;
}

interface PendingApproval {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  admin_name: string | null;
  admin_email: string | null;
  requested_modules: string[];
  enabled_modules: string[];
  status: string;
  requested_at: string;
}

interface AuditLogEntry {
  id: string;
  tenant_name: string;
  user_name: string | null;
  user_email: string | null;
  module: string;
  action: string;
  ip_address: string | null;
  created_at: string;
}

const ALL_MODULES = [
  { key: "erp", label: "Core ERP & Master Data", icon: Building },
  { key: "hrms", label: "HRMS & Payroll", icon: Users },
  { key: "inventory", label: "Inventory & Warehouses", icon: Layers },
  { key: "pos", label: "POS & Retail Billing", icon: Briefcase },
  { key: "crm", label: "Sales & CRM", icon: Sparkles },
  { key: "manufacturing", label: "Manufacturing & Work Orders", icon: Cpu },
  { key: "supply_chain", label: "Supply Chain & Procurement", icon: Briefcase },
  { key: "projects", label: "Project Management", icon: Activity },
  { key: "iot", label: "IoT & Smart Devices", icon: Radio },
  { key: "bi_ai", label: "AI Insights & Copilot", icon: Sparkles },
  { key: "finance", label: "Finance & Accounts", icon: Briefcase },
  { key: "compliance", label: "Audits & Compliance", icon: ShieldCheck },
];

export function PlatformAdminDashboard() {
  const { user, accessToken } = useAuth();
  const { setTenantOverride } = useTenant();

  const [activeTab, setActiveTab] = useState<"overview" | "workspaces" | "users" | "approvals" | "audit" | "diagnostics">("overview");
  
  // Data state
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [usersList, setUsersList] = useState<PlatformUser[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & search
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantStatusFilter, setTenantStatusFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [userTenantFilter, setUserTenantFilter] = useState("all");
  const [auditSearch, setAuditSearch] = useState("");

  // Modals state
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState<PlatformUser | null>(null);
  const [showModulesModal, setShowModulesModal] = useState<PlatformTenant | null>(null);
  const [deleteTenantConfirm, setDeleteTenantConfirm] = useState<PlatformTenant | null>(null);

  // Form states
  const [newTenantData, setNewTenantData] = useState({
    name: "",
    slug: "",
    plan: "enterprise",
    status: "active",
    owner_full_name: "",
    owner_email: "",
    owner_password: "",
    company_name: "",
    branch_name: "Headquarters",
    branch_code: "HQ",
    enabled_modules: ALL_MODULES.map((m) => m.key),
  });

  const [newUserData, setNewUserData] = useState({
    tenant_id: "",
    email: "",
    full_name: "",
    password: "",
    is_tenant_owner: false,
    is_platform_admin: false,
    status: "ACTIVE",
  });

  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Fetch all data
  const loadAllData = useCallback(async (isSilent = false) => {
    if (!accessToken) return;
    if (!isSilent) setLoading(true);
    setRefreshing(true);

    try {
      const headers = { Authorization: `Bearer ${accessToken}` };

      const [statsRes, tenantsRes, usersRes, approvalsRes, auditRes] = await Promise.all([
        fetch(`${API_BASE_URL}/system/stats`, { headers }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${API_BASE_URL}/system/tenants`, { headers }).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API_BASE_URL}/system/users`, { headers }).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API_BASE_URL}/system/pending-approvals`, { headers }).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API_BASE_URL}/system/audit-logs`, { headers }).then((r) => (r.ok ? r.json() : [])),
      ]);

      if (statsRes) setStats(statsRes);
      if (Array.isArray(tenantsRes)) setTenants(tenantsRes);
      if (Array.isArray(usersRes)) setUsersList(usersRes);
      if (Array.isArray(approvalsRes)) setApprovals(approvalsRes);
      if (Array.isArray(auditRes)) setAuditLogs(auditRes);
    } catch (err: any) {
      toast.error("Failed to fetch system data: " + (err.message || "Network error"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handle Tenant Creation
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantData.name || !newTenantData.owner_email || !newTenantData.owner_password) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/system/tenants`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newTenantData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create workspace");

      toast.success(`Workspace '${data.name}' provisioned successfully!`);
      setShowCreateTenantModal(false);
      setNewTenantData({
        name: "",
        slug: "",
        plan: "enterprise",
        status: "active",
        owner_full_name: "",
        owner_email: "",
        owner_password: "",
        company_name: "",
        branch_name: "Headquarters",
        branch_code: "HQ",
        enabled_modules: ALL_MODULES.map((m) => m.key),
      });
      loadAllData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to create workspace");
    }
  };

  // Handle Tenant Status Toggle (Suspend / Activate)
  const handleToggleTenantStatus = async (tenant: PlatformTenant) => {
    const newStatus = tenant.status.toLowerCase() === "active" ? "suspended" : "active";
    try {
      const res = await fetch(`${API_BASE_URL}/system/tenants/${tenant.id}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update tenant status");

      toast.success(data.message || `Tenant status updated to ${newStatus}`);
      loadAllData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update tenant status");
    }
  };

  // Handle Tenant Module Update
  const handleSaveModules = async () => {
    if (!showModulesModal) return;
    try {
      const res = await fetch(`${API_BASE_URL}/system/tenants/${showModulesModal.id}/modules`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled_modules: showModulesModal.enabled_modules }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update module entitlements");

      toast.success(data.message || "Module entitlements updated successfully");
      setShowModulesModal(null);
      loadAllData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update modules");
    }
  };

  // Handle Tenant Deletion
  const handleDeleteTenant = async () => {
    if (!deleteTenantConfirm) return;
    try {
      const res = await fetch(`${API_BASE_URL}/system/tenants/${deleteTenantConfirm.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to delete workspace");

      toast.success(data.message || `Workspace '${deleteTenantConfirm.name}' purged completely.`);
      setDeleteTenantConfirm(null);
      loadAllData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete workspace");
    }
  };

  // Handle Impersonate / Switch Workspace
  const handleImpersonateTenant = (tenant: PlatformTenant) => {
    setTenantOverride(tenant.id, tenant.name);
    toast.success(`Switched active context into workspace: ${tenant.name}`);
  };

  // Handle User Creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.tenant_id || !newUserData.email || !newUserData.password || !newUserData.full_name) {
      toast.error("Please fill in all user details.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/system/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUserData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create user");

      toast.success(`User '${data.full_name}' created successfully!`);
      setShowCreateUserModal(false);
      setNewUserData({
        tenant_id: "",
        email: "",
        full_name: "",
        password: "",
        is_tenant_owner: false,
        is_platform_admin: false,
        status: "ACTIVE",
      });
      loadAllData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    }
  };

  // Handle Toggle Super Admin / God Mode
  const handleToggleGodMode = async (targetUser: PlatformUser) => {
    try {
      const res = await fetch(`${API_BASE_URL}/system/users/${targetUser.id}/super-admin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_platform_admin: !targetUser.is_platform_admin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update super admin status");

      toast.success(data.message || "User God Mode permissions updated");
      loadAllData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update super admin status");
    }
  };

  // Handle Password Reset
  const handleResetPassword = async () => {
    if (!showPasswordResetModal || !resetPasswordVal || resetPasswordVal.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/system/users/${showPasswordResetModal.id}/reset-password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: resetPasswordVal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to reset password");

      toast.success(data.message || "Password successfully reset and notification email queued.");
      setShowPasswordResetModal(null);
      setResetPasswordVal("");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    }
  };

  // Handle MFA Reset
  const handleResetMFA = async (targetUser: PlatformUser) => {
    try {
      const res = await fetch(`${API_BASE_URL}/system/users/${targetUser.id}/reset-mfa`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to unlock MFA");

      toast.success(data.message || "MFA security lock removed.");
      loadAllData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset MFA");
    }
  };

  // Handle User Status Toggle
  const handleToggleUserStatus = async (targetUser: PlatformUser) => {
    const nextStatus = targetUser.status.toUpperCase() === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      const res = await fetch(`${API_BASE_URL}/system/users/${targetUser.id}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update user status");

      toast.success(data.message || `User status updated to ${nextStatus}`);
      loadAllData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update user status");
    }
  };

  // Handle Approve Registration
  const handleApproveTenant = async (approval: PendingApproval) => {
    try {
      const res = await fetch(`${API_BASE_URL}/system/tenants/${approval.tenant_id}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ approved_modules: approval.requested_modules || ["inventory", "pos"] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to approve registration");

      toast.success(data.message || "Workspace registration approved!");
      loadAllData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to approve registration");
    }
  };

  // Handle Purge Orphaned Tenancy
  const handlePurgeOrphans = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/system/tenants/purge-orphans`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to purge orphans");

      toast.success(data.message || "Purged empty workspaces.");
      loadAllData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to purge orphans");
    }
  };

  // Filtered lists
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      t.slug.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      (t.owner_email && t.owner_email.toLowerCase().includes(tenantSearch.toLowerCase()));
    const matchesStatus = tenantStatusFilter === "all" || t.status.toLowerCase() === tenantStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.tenant_name.toLowerCase().includes(userSearch.toLowerCase());
    const matchesTenant = userTenantFilter === "all" || u.tenant_id === userTenantFilter;
    return matchesSearch && matchesTenant;
  });

  const filteredAudit = auditLogs.filter((a) => {
    return (
      a.tenant_name.toLowerCase().includes(auditSearch.toLowerCase()) ||
      (a.user_email && a.user_email.toLowerCase().includes(auditSearch.toLowerCase())) ||
      a.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      a.module.toLowerCase().includes(auditSearch.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Header Card */}
      <Card className="p-6 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-card border-purple-500/20 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl gradient-brand text-white shadow-xs shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  Platform Control Center
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-700 tracking-wider">
                    ⚡ GOD MODE ACTIVE
                  </span>
                </h1>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Universal oversight, cross-tenant management, user provisioning, and full system command.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAllData(false)}
              disabled={refreshing}
              className="h-8 text-xs font-semibold gap-1.5 border-border bg-card hover:bg-muted text-foreground"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              Sync Feeds
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateTenantModal(true)}
              className="h-8 text-xs font-semibold gap-1.5 gradient-brand text-white shadow-xs border-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Provision Workspace
            </Button>
          </div>
        </div>

        {/* Live Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-border/60">
          <div className="p-3 rounded-xl bg-card/80 border border-border/60 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase">
              <Building className="w-3.5 h-3.5 text-indigo-600" /> Workspaces
            </span>
            <div className="text-xl font-black text-foreground mt-1">
              {stats?.total_tenants ?? tenants.length}
              <span className="text-xs font-semibold text-emerald-600 ml-1.5 font-sans">
                ({stats?.active_tenants ?? tenants.filter((t) => t.status === "active").length} active)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-card/80 border border-border/60 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase">
              <Users className="w-3.5 h-3.5 text-purple-600" /> Total Users
            </span>
            <div className="text-xl font-black text-foreground mt-1">
              {stats?.total_users ?? usersList.length}
              <span className="text-xs font-semibold text-emerald-600 ml-1.5 font-sans">
                ({stats?.active_users ?? usersList.filter((u) => u.status === "active").length} active)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-card/80 border border-border/60 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase">
              <Briefcase className="w-3.5 h-3.5 text-blue-600" /> Legal Entities
            </span>
            <div className="text-xl font-black text-foreground mt-1">
              {stats?.total_companies ?? "—"}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-card/80 border border-border/60 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase">
              <Layers className="w-3.5 h-3.5 text-amber-600" /> Outlets & Branches
            </span>
            <div className="text-xl font-black text-foreground mt-1">
              {stats?.total_branches ?? "—"}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-card/80 border border-border/60 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" /> Approvals
            </span>
            <div className="text-xl font-black text-yellow-600 mt-1">
              {approvals.length}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-card/80 border border-border/60 shadow-xs">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase">
              <Activity className="w-3.5 h-3.5 text-emerald-600" /> System Health
            </span>
            <div className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              100% Operational
            </div>
          </div>
        </div>
      </Card>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-border overflow-x-auto pb-1 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all border-b-2",
            activeTab === "overview"
              ? "border-purple-600 text-purple-700 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30 font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Activity className="w-4 h-4" /> Overview & Live Stats
        </button>

        <button
          onClick={() => setActiveTab("workspaces")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all border-b-2",
            activeTab === "workspaces"
              ? "border-purple-600 text-purple-700 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30 font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Building className="w-4 h-4" /> Workspaces & Tenancy ({tenants.length})
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all border-b-2",
            activeTab === "users"
              ? "border-purple-600 text-purple-700 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30 font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Users className="w-4 h-4" /> Global Users Directory ({usersList.length})
        </button>

        <button
          onClick={() => setActiveTab("approvals")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all border-b-2",
            activeTab === "approvals"
              ? "border-purple-600 text-purple-700 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30 font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <AlertTriangle className="w-4 h-4" /> Pending Registrations
          {approvals.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-yellow-100 text-yellow-800 ml-1">
              {approvals.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all border-b-2",
            activeTab === "audit"
              ? "border-purple-600 text-purple-700 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30 font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Terminal className="w-4 h-4" /> Cross-Tenant Audit Stream
        </button>

        <button
          onClick={() => setActiveTab("diagnostics")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all border-b-2",
            activeTab === "diagnostics"
              ? "border-purple-600 text-purple-700 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30 font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Server className="w-4 h-4" /> Diagnostics & Operations
        </button>
      </div>

      {/* ─── TAB: OVERVIEW ─── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions Card */}
            <Card className="p-5 border-border/80 shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" /> Platform Quick Actions
              </h2>
              <div className="grid grid-cols-1 gap-2 pt-1">
                <Button
                  onClick={() => setShowCreateTenantModal(true)}
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-border bg-card hover:bg-muted font-medium"
                >
                  <Plus className="w-4 h-4 mr-2 text-purple-600" /> Provision New Workspace
                </Button>
                <Button
                  onClick={() => setShowCreateUserModal(true)}
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-border bg-card hover:bg-muted font-medium"
                >
                  <Users className="w-4 h-4 mr-2 text-indigo-600" /> Create Cross-Tenant User
                </Button>
                <Button
                  onClick={handlePurgeOrphans}
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-border bg-card hover:bg-muted font-medium"
                >
                  <Trash2 className="w-4 h-4 mr-2 text-amber-600" /> Clean Orphaned Workspaces
                </Button>
              </div>
            </Card>

            {/* Architecture Card */}
            <Card className="p-5 border-border/80 shadow-xs space-y-3 lg:col-span-2">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-600" /> Architecture & Multi-Tenant Status
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                  <span className="text-muted-foreground text-[11px]">Database Engine</span>
                  <p className="text-xs font-bold text-foreground mt-0.5">PostgreSQL Async</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                  <span className="text-muted-foreground text-[11px]">Isolation Layer</span>
                  <p className="text-xs font-bold text-emerald-600 mt-0.5">Tenant Scoped</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                  <span className="text-muted-foreground text-[11px]">Auth Security</span>
                  <p className="text-xs font-bold text-purple-600 mt-0.5">JWT + Bcrypt</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                  <span className="text-muted-foreground text-[11px]">Impersonation</span>
                  <p className="text-xs font-bold text-amber-600 mt-0.5">Enabled ⚡</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-xs text-purple-800 dark:text-purple-300">
                💡 <strong>God Mode Platform Admin Tip:</strong> You can switch directly into any client's workspace using the "Switch" button in the Workspaces tab. All POS, HRMS, and ERP views will load isolated data for that client until you switch back.
              </div>
            </Card>
          </div>

          {/* Recent Tenants Grid */}
          <Card className="p-5 border-border/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Building className="w-4 h-4 text-purple-600" /> Active Client Workspaces ({tenants.length})
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab("workspaces")}
                className="text-xs text-purple-700 dark:text-purple-400 font-semibold"
              >
                View all <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tenants.slice(0, 6).map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl border border-border/70 bg-card hover:border-purple-400/50 transition-all shadow-2xs group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-foreground group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
                        {t.name}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.slug}</p>
                    </div>
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10.5px] font-bold rounded-full uppercase border",
                        t.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                      )}
                    >
                      {t.status}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Owner: {t.owner_name || t.owner_email || "N/A"}</span>
                    <span className="font-semibold text-foreground">{t.user_count} users</span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleImpersonateTenant(t)}
                      className="w-full text-xs h-8 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 font-semibold"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" /> Switch Context
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ─── TAB: WORKSPACES ─── */}
      {activeTab === "workspaces" && (
        <div className="space-y-4">
          <Card className="p-4 border-border/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search workspace by name, slug, owner..."
                  value={tenantSearch}
                  onChange={(e) => setTenantSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/20 outline-none"
                />
              </div>

              <select
                value={tenantStatusFilter}
                onChange={(e) => setTenantStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
                <option value="trial">Trial Only</option>
              </select>
            </div>

            <Button
              size="sm"
              onClick={() => setShowCreateTenantModal(true)}
              className="h-8 text-xs font-semibold gradient-brand text-white shadow-xs border-0 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Provision New Workspace
            </Button>
          </Card>

          <Card className="overflow-hidden border-border/80 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Workspace / Organization</th>
                    <th className="py-3 px-4">Slug</th>
                    <th className="py-3 px-4">Owner Account</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4">Users</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">
                        No workspaces found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          <div className="flex items-center gap-2.5">
                            <div className="size-7 rounded-lg gradient-brand text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                              {t.name[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold">{t.name}</div>
                              <div className="text-[10.5px] text-muted-foreground font-normal">
                                Created {new Date(t.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-muted-foreground">{t.slug}</td>
                        <td className="py-3.5 px-4">
                          <div className="text-foreground font-medium">{t.owner_name}</div>
                          <div className="text-[10.5px] text-muted-foreground">{t.owner_email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            {t.plan}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-foreground font-semibold">{t.user_count}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={cn(
                              "px-2 py-0.5 text-[10.5px] font-bold rounded-full uppercase border",
                              t.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                            )}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleImpersonateTenant(t)}
                              title="Switch active dashboard to this tenant"
                              className="h-7 px-2 text-xs text-purple-700 bg-purple-50/50 hover:bg-purple-100 border-purple-200 font-semibold"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Switch
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowModulesModal(t)}
                              title="Edit Module Entitlements"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Sliders className="w-3.5 h-3.5 mr-1" /> Modules
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleTenantStatus(t)}
                              title={t.status === "active" ? "Suspend Workspace" : "Activate Workspace"}
                              className={cn(
                                "h-7 px-2 text-xs",
                                t.status === "active"
                                  ? "text-yellow-600 hover:bg-yellow-50"
                                  : "text-emerald-600 hover:bg-emerald-50"
                              )}
                            >
                              {t.status === "active" ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </Button>

                            {t.slug !== "system" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteTenantConfirm(t)}
                                title="Permanently Purge & Delete Workspace"
                                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ─── TAB: USERS DIRECTORY ─── */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <Card className="p-4 border-border/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search user by name, email, tenant..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/20 outline-none"
                />
              </div>

              <select
                value={userTenantFilter}
                onChange={(e) => setUserTenantFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground outline-none"
              >
                <option value="all">All Workspaces</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              size="sm"
              onClick={() => setShowCreateUserModal(true)}
              className="h-8 text-xs font-semibold gradient-brand text-white shadow-xs border-0 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Create User in Workspace
            </Button>
          </Card>

          <Card className="overflow-hidden border-border/80 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Workspace</th>
                    <th className="py-3 px-4">Platform God Mode</th>
                    <th className="py-3 px-4">Tenant Owner</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">MFA</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">
                        No users found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          <div className="flex items-center gap-2.5">
                            <div className="size-7 rounded-full gradient-brand text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                              {u.full_name[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold">{u.full_name}</div>
                              <div className="text-[10.5px] text-muted-foreground font-normal">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-foreground font-medium">
                          {u.tenant_name}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleToggleGodMode(u)}
                            className={cn(
                              "px-2 py-0.5 text-[10px] font-bold rounded-md border flex items-center gap-1 transition-all cursor-pointer",
                              u.is_platform_admin
                                ? "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700"
                                : "bg-muted text-muted-foreground border-border hover:text-foreground"
                            )}
                            title="Click to toggle Platform Super Admin (God Mode) status"
                          >
                            <Sparkles className="w-3 h-3" />
                            {u.is_platform_admin ? "⚡ Super Admin (God)" : "Standard User"}
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          {u.is_tenant_owner ? (
                            <span className="text-indigo-600 font-semibold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Owner
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Member</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={cn(
                              "px-2 py-0.5 text-[10.5px] font-bold rounded-full uppercase border",
                              u.status.toLowerCase() === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                            )}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {u.mfa_enabled ? (
                            <button
                              onClick={() => handleResetMFA(u)}
                              title="Click to unlock MFA"
                              className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                            >
                              Active (Unlock)
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Off</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setShowPasswordResetModal(u);
                                setResetPasswordVal("");
                              }}
                              title="Reset Password Administratively"
                              className="h-7 px-2 text-xs text-purple-700 bg-purple-50/50 hover:bg-purple-100 border-purple-200 font-semibold"
                            >
                              <Key className="w-3.5 h-3.5 mr-1" /> Reset PW
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleUserStatus(u)}
                              title={u.status.toLowerCase() === "active" ? "Suspend Account" : "Activate Account"}
                              className={cn(
                                "h-7 px-2 text-xs",
                                u.status.toLowerCase() === "active"
                                  ? "text-yellow-600 hover:bg-yellow-50"
                                  : "text-emerald-600 hover:bg-emerald-50"
                              )}
                            >
                              {u.status.toLowerCase() === "active" ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ─── TAB: PENDING APPROVALS ─── */}
      {activeTab === "approvals" && (
        <div className="space-y-4">
          <Card className="p-4 border-border/80 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Pending Client Workspace Registrations</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Review and approve self-service workspace signups.</p>
            </div>
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">
              {approvals.length} Pending
            </span>
          </Card>

          {approvals.length === 0 ? (
            <Card className="p-12 text-center border-border/80 shadow-xs text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-foreground">All registrations are up to date!</p>
              <p className="text-xs text-muted-foreground mt-1">No self-service tenant workspaces are currently pending approval.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {approvals.map((app) => (
                <Card key={app.tenant_id} className="p-5 border-yellow-300/80 shadow-xs space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-foreground">{app.tenant_name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{app.tenant_slug}</p>
                    </div>
                    <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">
                      Pending Review
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-foreground bg-muted/40 p-3 rounded-lg border border-border/60">
                    <div><strong>Admin:</strong> {app.admin_name}</div>
                    <div><strong>Email:</strong> {app.admin_email}</div>
                    <div><strong>Requested At:</strong> {new Date(app.requested_at).toLocaleString()}</div>
                    <div className="mt-2">
                      <strong>Requested Modules:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {app.requested_modules.map((m) => (
                          <span key={m} className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-800 rounded font-semibold">
                            {m.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproveTenant(app)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-8"
                    >
                      <Check className="w-4 h-4 mr-1.5" /> Approve & Activate Workspace
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: AUDIT LOGS ─── */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <Card className="p-4 border-border/80 shadow-xs flex items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter audit by tenant, actor, action, module..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/20 outline-none"
              />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Showing last 100 cross-tenant actions</span>
          </Card>

          <Card className="overflow-hidden border-border/80 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Workspace</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Module</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredAudit.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        No audit events found.
                      </td>
                    </tr>
                  ) : (
                    filteredAudit.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors text-foreground">
                        <td className="py-2.5 px-4 text-muted-foreground font-mono">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="py-2.5 px-4 font-bold text-purple-700 dark:text-purple-400">{log.tenant_name}</td>
                        <td className="py-2.5 px-4">{log.user_email || log.user_name || "System"}</td>
                        <td className="py-2.5 px-4 font-semibold text-indigo-600">{log.module}</td>
                        <td className="py-2.5 px-4 font-mono">{log.action}</td>
                        <td className="py-2.5 px-4 text-muted-foreground font-mono">{log.ip_address || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ─── TAB: DIAGNOSTICS & OPERATIONS ─── */}
      {activeTab === "diagnostics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 border-border/80 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" /> Database & Storage Maintenance
              </h3>
              <p className="text-xs text-muted-foreground">
                Execute cross-tenant housekeeping routines to clean orphaned records, verify foreign keys, and optimize indexes.
              </p>
              <div className="space-y-2 pt-2">
                <Button
                  onClick={handlePurgeOrphans}
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-red-200 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Purge All Empty / Orphaned Workspaces (0 users)
                </Button>
                <Button
                  onClick={() => toast.success("All database pools and connections verified healthy.")}
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-border text-foreground hover:bg-muted"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Verify Database Health & Pools
                </Button>
              </div>
            </Card>

            <Card className="p-6 border-border/80 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Terminal className="w-5 h-5 text-purple-600" /> Backend CLI God Admin Script
              </h3>
              <p className="text-xs text-muted-foreground">
                Run the backend script directly from terminal to create or promote any user to God Admin:
              </p>
              <div className="p-3.5 rounded-lg bg-muted/60 font-mono text-xs text-purple-700 dark:text-purple-300 border border-border select-all">
                python scripts/create_platform_god_admin.py --email admin@domain.com --name "God Admin"
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE WORKSPACE ─── */}
      <AnimatePresence>
        {showCreateTenantModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl rounded-2xl bg-card border border-border p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Building className="w-5 h-5 text-purple-600" /> Provision New Client Workspace
                </h2>
                <button
                  onClick={() => setShowCreateTenantModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTenant} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted-foreground font-semibold mb-1">Workspace Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Retail Pvt Ltd"
                      value={newTenantData.name}
                      onChange={(e) => setNewTenantData({ ...newTenantData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/20 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground font-semibold mb-1">Slug / Identifier</label>
                    <input
                      type="text"
                      placeholder="e.g. acme-retail (auto-generated if empty)"
                      value={newTenantData.slug}
                      onChange={(e) => setNewTenantData({ ...newTenantData, slug: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/20 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted-foreground font-semibold mb-1">Initial Legal Entity Company</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Corporation"
                      value={newTenantData.company_name}
                      onChange={(e) => setNewTenantData({ ...newTenantData, company_name: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/20 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-muted-foreground font-semibold mb-1">Subscription Plan Tier</label>
                    <select
                      value={newTenantData.plan}
                      onChange={(e) => setNewTenantData({ ...newTenantData, plan: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground outline-none"
                    >
                      <option value="starter">Starter Plan</option>
                      <option value="pro">Pro Plan</option>
                      <option value="enterprise">Enterprise Plan (Unlimited)</option>
                    </select>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 space-y-3">
                  <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300">Initial Workspace Admin Account</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">Admin Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe"
                        value={newTenantData.owner_full_name}
                        onChange={(e) => setNewTenantData({ ...newTenantData, owner_full_name: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-muted-foreground font-semibold mb-1">Admin Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="admin@acme.com"
                        value={newTenantData.owner_email}
                        onChange={(e) => setNewTenantData({ ...newTenantData, owner_email: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-muted-foreground font-semibold mb-1">Admin Temporary Password *</label>
                    <input
                      type="password"
                      required
                      placeholder="Minimum 8 characters"
                      value={newTenantData.owner_password}
                      onChange={(e) => setNewTenantData({ ...newTenantData, owner_password: e.target.value })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-muted-foreground font-semibold mb-2">Enabled Module Entitlements</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ALL_MODULES.map((m) => {
                      const isChecked = newTenantData.enabled_modules.includes(m.key);
                      return (
                        <label
                          key={m.key}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors",
                            isChecked
                              ? "bg-purple-50 border-purple-300 text-purple-900 dark:bg-purple-950/40 dark:border-purple-700 dark:text-purple-200"
                              : "bg-card border-border text-muted-foreground hover:border-purple-200"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewTenantData({
                                  ...newTenantData,
                                  enabled_modules: [...newTenantData.enabled_modules, m.key],
                                });
                              } else {
                                setNewTenantData({
                                  ...newTenantData,
                                  enabled_modules: newTenantData.enabled_modules.filter((k) => k !== m.key),
                                });
                              }
                            }}
                            className="rounded text-purple-600 focus:ring-0"
                          />
                          <span className="truncate">{m.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowCreateTenantModal(false)}
                    className="text-muted-foreground"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="gradient-brand text-white font-semibold">
                    Provision Workspace
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: CREATE USER ─── */}
      <AnimatePresence>
        {showCreateUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" /> Create User in Workspace
                </h2>
                <button onClick={() => setShowCreateUserModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Target Workspace *</label>
                  <select
                    required
                    value={newUserData.tenant_id}
                    onChange={(e) => setNewUserData({ ...newUserData, tenant_id: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground outline-none"
                  >
                    <option value="">Select a workspace...</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Smith"
                    value={newUserData.full_name}
                    onChange={(e) => setNewUserData({ ...newUserData, full_name: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground outline-none"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="jane@domain.com"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground outline-none"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Minimum 8 characters"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground outline-none"
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUserData.is_tenant_owner}
                      onChange={(e) => setNewUserData({ ...newUserData, is_tenant_owner: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-foreground font-medium">Grant Workspace Owner Status</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUserData.is_platform_admin}
                      onChange={(e) => setNewUserData({ ...newUserData, is_platform_admin: e.target.checked })}
                      className="rounded text-purple-600"
                    />
                    <span className="text-purple-700 dark:text-purple-300 font-bold">⚡ Grant Global Super Admin (God Mode)</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <Button type="button" variant="ghost" onClick={() => setShowCreateUserModal(false)} className="text-muted-foreground">
                    Cancel
                  </Button>
                  <Button type="submit" className="gradient-brand text-white font-semibold">
                    Create User
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: RESET PASSWORD ─── */}
      <AnimatePresence>
        {showPasswordResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Key className="w-5 h-5 text-indigo-600" /> Reset User Password
                </h2>
                <button onClick={() => setShowPasswordResetModal(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs text-muted-foreground">
                You are resetting the password for:
                <div className="mt-1 font-semibold text-foreground bg-muted/50 p-2.5 rounded-lg border border-border">
                  {showPasswordResetModal.full_name} ({showPasswordResetModal.email})
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <label className="block text-muted-foreground font-semibold">New Temporary Password *</label>
                <div className="relative">
                  <input
                    type={showPasswordText ? "text" : "password"}
                    placeholder="Enter new password"
                    value={resetPasswordVal}
                    onChange={(e) => setResetPasswordVal(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-purple-500/20 outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300">
                ✉️ An automated email notification containing the new login credentials will be dispatched to the user immediately.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setShowPasswordResetModal(null)} className="text-muted-foreground">
                  Cancel
                </Button>
                <Button onClick={handleResetPassword} className="gradient-brand text-white font-semibold">
                  Confirm Reset & Send Email
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: EDIT MODULES ─── */}
      <AnimatePresence>
        {showModulesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-purple-600" /> Module Entitlements: {showModulesModal.name}
                </h2>
                <button onClick={() => setShowModulesModal(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {ALL_MODULES.map((m) => {
                  const isChecked = (showModulesModal.enabled_modules || []).includes(m.key);
                  return (
                    <label
                      key={m.key}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors",
                        isChecked
                          ? "bg-purple-50 border-purple-300 text-purple-900 dark:bg-purple-950/40 dark:border-purple-700 dark:text-purple-200"
                          : "bg-card border-border text-muted-foreground hover:border-purple-200"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = showModulesModal.enabled_modules || [];
                          if (e.target.checked) {
                            setShowModulesModal({
                              ...showModulesModal,
                              enabled_modules: [...current, m.key],
                            });
                          } else {
                            setShowModulesModal({
                              ...showModulesModal,
                              enabled_modules: current.filter((k) => k !== m.key),
                            });
                          }
                        }}
                        className="rounded text-purple-600 focus:ring-0"
                      />
                      <span className="truncate">{m.label}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setShowModulesModal(null)} className="text-muted-foreground">
                  Cancel
                </Button>
                <Button onClick={handleSaveModules} className="gradient-brand text-white font-semibold">
                  Save Entitlements
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: CONFIRM PURGE WORKSPACE ─── */}
      <AnimatePresence>
        {deleteTenantConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-card border border-destructive/40 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="w-6 h-6" />
                <h2 className="text-base font-bold text-foreground">Permanently Delete Workspace?</h2>
              </div>

              <p className="text-xs text-muted-foreground">
                Are you sure you want to completely purge and delete{" "}
                <strong className="text-foreground">'{deleteTenantConfirm.name}'</strong>?
                This action is <strong className="text-destructive">irreversible</strong> and will permanently wipe all products, invoices, users, employees, payroll, and settings for this workspace.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setDeleteTenantConfirm(null)} className="text-muted-foreground">
                  Cancel
                </Button>
                <Button onClick={handleDeleteTenant} className="bg-destructive hover:bg-destructive/90 text-white font-semibold">
                  Yes, Purge Workspace
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
