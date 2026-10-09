import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Edit2,
  Trash2,
  ShieldCheck,
  Mail,
  CheckCircle,
  XCircle,
  UserPlus,
  X,
  Save,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  Zap,
  Smartphone,
  Send,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useAuth, canAssignSuperAdmin } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { useRbac } from "@/contexts/rbac-context";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/i18n-context";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";
import { ModuleSelector } from "./ModuleSelector";
import {
  getStoredUserModules,
  setStoredUserModules,
  getStoredUserTabs,
  setStoredUserTabs,
  getStoredRoleModules,
  getStoredRoleTabs,
  ALL_MODULE_IDS,
  SYSTEM_MODULES,
  DEFAULT_STANDARD_MODULES,
} from "@/data/modules-config";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

type UserStatus = "Active" | "Inactive";
type ActivationMode = "direct" | "otp" | "invite";

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface RoleSummary {
  id: string;
  name: string;
  is_default: boolean;
  company_id?: string | null;
  company_name?: string | null;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  status: UserStatus;
  roles: RoleSummary[];
  must_change_password: boolean;
  is_verified?: boolean;
  verification_code?: string | null;
  avatar_initials: string | null;
  is_tenant_owner?: boolean;
  company_id?: string | null;
  company_name?: string | null;
  enabled_modules?: string[];
  enabled_tabs?: string[];
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface UserFormPayload {
  email: string;
  full_name: string;
  status: string;
  role_ids: string[];
  default_role_id: string | null;
  company_id?: string | null;
  must_change_password?: boolean;
  activation_mode?: ActivationMode;
  password?: string;
  send_invite?: boolean;
  is_tenant_owner?: boolean;
  is_verified?: boolean;
  enabled_modules?: string[];
  enabled_tabs?: string[];
}

interface CreatedUserResult {
  user: User;
  password?: string;
  verification_code?: string | null;
  activation_mode: ActivationMode;
  tenantSlug?: string;
}

function StatusBadge({ status, isVerified = true }: { status: UserStatus; isVerified?: boolean }) {
  if (!isVerified) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-700 border border-amber-500/20">
        <Smartphone className="size-3" />
        OTP / Pending
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
        status === "Active" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
      )}
    >
      {status === "Active" ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
      {status}
    </span>
  );
}

function UserFormModal({
  user,
  roles,
  canAssignSuperAdminRole,
  companiesList = [],
  activeTenantId,
  tenantSlug,
  onClose,
  onSave,
}: {
  user?: User;
  roles: Role[];
  canAssignSuperAdminRole: boolean;
  companiesList?: any[];
  activeTenantId?: string;
  tenantSlug?: string;
  onClose: () => void;
  onSave: (payload: UserFormPayload) => Promise<void>;
}) {
  const { t } = useI18n();
  const isEdit = Boolean(user);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [status, setStatus] = useState<UserStatus>(user?.status ?? "Active");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user?.roles.map((role) => role.id) ?? []);
  const [defaultRoleId, setDefaultRoleId] = useState<string>(user?.roles.find((role) => role.is_default)?.id ?? "");
  const [assignedCompanyId, setAssignedCompanyId] = useState<string>(user?.company_id || activeTenantId || "");
  
  // Activation mode: 'direct' (instant login), 'otp' (validation OTP), 'invite' (SMTP/WhatsApp)
  const [activationMode, setActivationMode] = useState<ActivationMode>("direct");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(user?.must_change_password ?? false);
  const [isTenantOwner, setIsTenantOwner] = useState(user?.is_tenant_owner ?? false);

  const [selectedModules, setSelectedModules] = useState<string[]>(() => {
    if (user?.enabled_modules && user.enabled_modules.length > 0) {
      return user.enabled_modules;
    }
    if (user?.id) {
      const stored = getStoredUserModules(user.id);
      if (stored && stored.length > 0) return stored;
    }
    const primaryRoleId = user?.roles?.[0]?.id || (roles.length > 0 ? roles[0].id : null);
    if (primaryRoleId) {
      const pickedRole = roles.find((r) => r.id === primaryRoleId);
      const roleMod = (pickedRole?.enabled_modules && pickedRole.enabled_modules.length > 0)
        ? pickedRole.enabled_modules
        : (getStoredRoleModules(primaryRoleId) || (pickedRole?.name ? getStoredRoleModules(pickedRole.name) : null));
      if (roleMod && roleMod.length > 0) return roleMod;
    }
    return DEFAULT_STANDARD_MODULES;
  });

  const [selectedTabs, setSelectedTabs] = useState<string[]>(() => {
    if (user?.enabled_tabs && user.enabled_tabs.length > 0) {
      return user.enabled_tabs;
    }
    if (user?.id) {
      const stored = getStoredUserTabs(user.id);
      if (stored && stored.length > 0) return stored;
    }
    const primaryRoleId = user?.roles?.[0]?.id || (roles.length > 0 ? roles[0].id : null);
    if (primaryRoleId) {
      const pickedRole = roles.find((r) => r.id === primaryRoleId);
      const roleTabs = (pickedRole?.enabled_tabs && pickedRole.enabled_tabs.length > 0)
        ? pickedRole.enabled_tabs
        : (getStoredRoleTabs(primaryRoleId) || (pickedRole?.name ? getStoredRoleTabs(pickedRole.name) : null));
      if (roleTabs && roleTabs.length > 0) return roleTabs;
    }
    return [];
  });

  const generateAutoPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let res = "BOS@";
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    res += "!26";
    setPassword(res);
    setShowPassword(true);
  };

  const assignableRoles = useMemo(
    () =>
      roles.filter(
        (role) => canAssignSuperAdminRole || role.name.toLowerCase() !== "super admin"
      ),
    [roles, canAssignSuperAdminRole]
  );

  useEffect(() => {
    if (!isEdit && selectedRoles.length && !defaultRoleId) {
      setDefaultRoleId(selectedRoles[0]);
    }
  }, [isEdit, selectedRoles, defaultRoleId]);

  const toggleRole = (id: string) => {
    setSelectedRoles((prev) => {
      const next = prev.includes(id) ? prev.filter((roleId) => roleId !== id) : [...prev, id];
      if (!isEdit && next.length > 0) {
        const pickedRole = assignableRoles.find((r) => r.id === id);
        const roleMod = (pickedRole?.enabled_modules && pickedRole.enabled_modules.length > 0)
          ? pickedRole.enabled_modules
          : (getStoredRoleModules(id) || (pickedRole?.name ? getStoredRoleModules(pickedRole.name) : null));
        const roleTabs = (pickedRole?.enabled_tabs && pickedRole.enabled_tabs.length > 0)
          ? pickedRole.enabled_tabs
          : (getStoredRoleTabs(id) || (pickedRole?.name ? getStoredRoleTabs(pickedRole.name) : null));
        if (roleMod && roleMod.length > 0) {
          setSelectedModules(roleMod);
        } else if (pickedRole?.name.toLowerCase().includes("pos") || pickedRole?.name.toLowerCase().includes("cashier")) {
          setSelectedModules(["dashboard", "pos", "inventory", "operations"]);
        } else {
          setSelectedModules(DEFAULT_STANDARD_MODULES);
        }
        if (roleTabs && roleTabs.length > 0) {
          setSelectedTabs(roleTabs);
        }
      }
      return next;
    });
  };

  const canSubmit =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    selectedRoles.length > 0 &&
    (isEdit || activationMode === "invite" || password.length >= 8 || password.length === 0);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    let finalPassword = password.trim();
    if (!isEdit && !finalPassword && (activationMode === "direct" || activationMode === "otp")) {
      // Auto-generate if blank
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
      let res = "BOS@";
      for (let i = 0; i < 6; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      res += "!26";
      finalPassword = res;
    }

    await onSave({
      email,
      full_name: fullName,
      status: status.toLowerCase(),
      role_ids: selectedRoles,
      default_role_id: defaultRoleId || null,
      company_id: assignedCompanyId || null,
      must_change_password: mustChangePassword,
      is_tenant_owner: isTenantOwner,
      enabled_modules: selectedModules,
      enabled_tabs: selectedTabs,
      activation_mode: activationMode,
      send_invite: activationMode === "invite",
      password: finalPassword || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-card z-10">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="size-5 text-primary" />
                {isEdit ? "Edit User Account" : "Create & Onboard User"}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isEdit
                  ? "Update user details, status, workspace assignment, and role permissions."
                  : "Choose direct active creation, OTP validation, or email/WhatsApp invite."}
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition">
              <X className="size-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Mail className="size-4 text-primary" /> Identity & Workspace
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Full Name *</label>
                  <input
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="e.g. John Smith"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Work Email / Username *</label>
                  <input
                    type="email"
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="john@company.com"
                    disabled={isEdit}
                    required
                  />
                </div>
              </div>

              {/* Workspace Assignment */}
              <div className="mt-3">
                <label className="text-xs text-muted-foreground mb-1 block">Assigned Workspace / Company</label>
                <select
                  className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  value={assignedCompanyId}
                  onChange={(e) => setAssignedCompanyId(e.target.value)}
                >
                  <option value="">🏢 Organization-wide (All Workspaces)</option>
                  {companiesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.industry || "Workspace"})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t("Assign this user to a specific workspace to isolate data and privileges.", "Assign this user to a specific workspace to isolate data and privileges.")}
                </p>
              </div>

              <div className="mt-3">
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <div className="flex gap-2">
                  {["Active", "Inactive"].map((statusOption) => (
                    <button
                      key={statusOption}
                      type="button"
                      onClick={() => setStatus(statusOption as UserStatus)}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm font-medium border transition cursor-pointer",
                        status === statusOption
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-background border-border hover:bg-muted text-muted-foreground"
                      )}
                    >
                      {statusOption}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Activation / Onboarding Mode Selection (When Creating New User) */}
            {!isEdit && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="size-4 text-amber-500" /> Account Activation & Verification Mode
                  </h3>
                  <span className="text-[11px] text-muted-foreground">Select how this user will be onboarded</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Option 1: Direct Active User */}
                  <button
                    type="button"
                    onClick={() => setActivationMode("direct")}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition relative flex flex-col justify-between cursor-pointer",
                      activationMode === "direct"
                        ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="size-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                          <Zap className="size-4" />
                        </span>
                        {activationMode === "direct" && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-xs text-foreground">Direct Active User</div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        Immediate login without OTP or external SMTP/WhatsApp blockers. Ideal for POS staff & fast onboarding.
                      </p>
                    </div>
                  </button>

                  {/* Option 2: OTP Validation */}
                  <button
                    type="button"
                    onClick={() => setActivationMode("otp")}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition relative flex flex-col justify-between cursor-pointer",
                      activationMode === "otp"
                        ? "bg-indigo-500/10 border-indigo-500 ring-2 ring-indigo-500/20"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="size-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          <Smartphone className="size-4" />
                        </span>
                        {activationMode === "otp" && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-xs text-foreground">OTP Validation</div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        Generates a 6-digit OTP displayed on-screen for manual/SMS verification on first login.
                      </p>
                    </div>
                  </button>

                  {/* Option 3: Email / WhatsApp Invite */}
                  <button
                    type="button"
                    onClick={() => setActivationMode("invite")}
                    className={cn(
                      "p-3.5 rounded-xl border text-left transition relative flex flex-col justify-between cursor-pointer",
                      activationMode === "invite"
                        ? "bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/20"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="size-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          <Send className="size-4" />
                        </span>
                        {activationMode === "invite" && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-xs text-foreground">Email / WA Invite</div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                        Dispatches automated invitation via connected SMTP & WhatsApp sessions.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Password input for Direct & OTP modes */}
                {(activationMode === "direct" || activationMode === "otp") && (
                  <div className="p-4 rounded-xl border bg-muted/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold">User Password</label>
                      <button
                        type="button"
                        onClick={generateAutoPassword}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="size-3" /> Auto-Generate Strong Password
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        className="w-full h-10 rounded-lg border bg-background pl-3 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password (leave blank to auto-generate)"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {activationMode === "direct"
                        ? "The user will be immediately verified and can sign in straight away with these credentials."
                        : "The user will log in with this password and will be prompted to enter the 6-digit OTP code shown to you after creation."}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Assign Roles *
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {assignableRoles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRole(role.id)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border text-left transition cursor-pointer",
                      selectedRoles.includes(role.id)
                        ? "bg-primary/5 border-primary/40"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "size-4 mt-0.5 rounded border-2 shrink-0 flex items-center justify-center transition",
                        selectedRoles.includes(role.id) ? "bg-primary border-primary" : "border-border"
                      )}
                    >
                      {selectedRoles.includes(role.id) && <span className="size-2 bg-white rounded-sm" />}
                    </span>
                    <div>
                      <div className="text-sm font-medium">{role.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{role.description ?? "Role access and permissions."}</div>
                    </div>
                  </button>
                ))}
              </div>
              {selectedRoles.length > 0 && (
                <div className="mt-4">
                  <label className="text-xs text-muted-foreground mb-1 block">Default Active Role</label>
                  <select
                    className="w-full h-10 rounded-lg border bg-background px-3 text-sm outline-none"
                    value={defaultRoleId}
                    onChange={(event) => setDefaultRoleId(event.target.value)}
                  >
                    {selectedRoles.map((roleId) => {
                      const found = assignableRoles.find((role) => role.id === roleId);
                      return (
                        <option key={roleId} value={roleId}>
                          {found?.name ?? roleId}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* Module Visibility & UI Permissions */}
            <div>
              <ModuleSelector
                selectedModules={selectedModules}
                onChange={setSelectedModules}
                title="Allowed Portal Modules (UI Visibility)"
                subtitle="Only the selected modules will be visible in this user's topbar and ribbon navigation. Background APIs (e.g., POS querying CRM or posting ledger entries) remain fully operational."
              />
            </div>

            <div className="rounded-2xl border p-4 bg-orange-500/5 text-sm space-y-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mustChangePassword}
                  onChange={(event) => setMustChangePassword(event.target.checked)}
                  className="h-4 w-4 rounded border-muted-foreground text-primary focus:ring-primary"
                />
                <span className="font-medium text-foreground">Require user to change password upon next sign-in</span>
              </label>
              <p className="text-xs text-muted-foreground pl-7">
                Forces the user to create a private permanent password immediately after their initial login.
              </p>
            </div>
          </div>

          <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-card">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-muted text-sm cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer shadow-xs",
                canSubmit
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Save className="size-4" /> {isEdit ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// Modal showing created credentials and/or OTP validation code
function CreatedUserCredentialsModal({
  data,
  onClose,
}: {
  data: CreatedUserResult;
  onClose: () => void;
}) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(true);

  const loginUrl = `${window.location.origin}/login${data.tenantSlug ? `?tenant=${data.tenantSlug}` : ""}`;

  const copyFullMessage = () => {
    let msg = `🎉 User Account Created\n`;
    msg += `---------------------------------\n`;
    msg += `👤 Name: ${data.user.full_name}\n`;
    msg += `📧 Email: ${data.user.email}\n`;
    if (data.password) msg += `🔑 Password: ${data.password}\n`;
    if (data.verification_code) msg += `📱 6-Digit OTP Code: ${data.verification_code}\n`;
    msg += `🌐 Portal Login URL: ${loginUrl}\n`;
    msg += `---------------------------------`;

    navigator.clipboard.writeText(msg);
    setCopiedAll(true);
    toast.success("All credentials copied to clipboard!");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const copyPasswordOnly = () => {
    if (data.password) {
      navigator.clipboard.writeText(data.password);
      setCopiedPwd(true);
      toast.success("Password copied!");
      setTimeout(() => setCopiedPwd(false), 2000);
    }
  };

  const copyOtpOnly = () => {
    if (data.verification_code) {
      navigator.clipboard.writeText(data.verification_code);
      setCopiedOtp(true);
      toast.success("OTP code copied!");
      setTimeout(() => setCopiedOtp(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle className="size-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">User Created Successfully</h2>
              <p className="text-xs text-muted-foreground">Credentials & Access Information</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* User Overview */}
          <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Details</div>
            <div className="text-sm font-bold text-foreground">{data.user.full_name}</div>
            <div className="text-xs font-mono text-muted-foreground">{data.user.email}</div>
          </div>

          {/* Activation Mode Indicator */}
          {data.activation_mode === "direct" && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <Zap className="size-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <strong>Direct Active User:</strong> This user has been activated and verified immediately. They can log in straight away without needing external OTP or email delivery.
              </div>
            </div>
          )}

          {data.activation_mode === "otp" && (
            <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 flex items-start gap-2.5 text-xs text-indigo-800 dark:text-indigo-300">
              <Smartphone className="size-4 shrink-0 mt-0.5 text-indigo-600" />
              <div>
                <strong>OTP Validation Mode:</strong> Provide the 6-digit OTP code below to the user (via SMS, verbal, or chat) to complete their first-time login validation.
              </div>
            </div>
          )}

          {/* 6-Digit OTP Card (if present) */}
          {data.verification_code && (
            <div className="p-4 rounded-xl border-2 border-indigo-500/40 bg-indigo-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Smartphone className="size-4" /> 6-Digit Verification OTP Code
                </span>
                <button
                  type="button"
                  onClick={copyOtpOnly}
                  className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedOtp ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  {copiedOtp ? "Copied" : "Copy OTP"}
                </button>
              </div>
              <div className="bg-background rounded-lg border p-3 flex items-center justify-center font-mono text-2xl font-black tracking-widest text-indigo-600">
                {data.verification_code}
              </div>
            </div>
          )}

          {/* Password Card */}
          {data.password && (
            <div className="p-4 rounded-xl border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <KeyRound className="size-3.5 text-primary" /> Login Password
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? "Hide" : "Reveal"}
                  </button>
                  <button
                    type="button"
                    onClick={copyPasswordOnly}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedPwd ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    {copiedPwd ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="bg-background rounded-lg border px-3 py-2 text-sm font-mono select-all">
                {showPassword ? data.password : "••••••••••••"}
              </div>
            </div>
          )}

          {/* Portal Link */}
          <div className="text-xs text-muted-foreground flex items-center justify-between bg-muted/20 p-3 rounded-lg">
            <span className="truncate max-w-[300px]">🌐 Login: {loginUrl}</span>
            <a
              href={loginUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline flex items-center gap-1 shrink-0 font-medium"
            >
              Open <ExternalLink className="size-3" />
            </a>
          </div>
        </div>

        <div className="p-6 border-t bg-muted/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={copyFullMessage}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            {copiedAll ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copiedAll ? "Copied All Details!" : "Copy Full Message"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl border hover:bg-muted cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Modal for viewing or generating OTP for existing user
function OtpDisplayModal({
  user,
  onClose,
  onActivated,
}: {
  user: User;
  onClose: () => void;
  onActivated: () => void;
}) {
  const { accessToken } = useAuth();
  const [otpCode, setOtpCode] = useState<string | null>(user.verification_code || null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateNewOtp = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/erp/users/${user.id}/generate-otp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to generate OTP");
      const data = await res.json();
      setOtpCode(data.verification_code);
      toast.success("New 6-digit OTP code generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate OTP");
    } finally {
      setLoading(false);
    }
  };

  const directActivate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/erp/users/${user.id}/direct-activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to direct activate user");
      toast.success(`User "${user.full_name}" is now directly activated and verified!`);
      onActivated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to activate user");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (otpCode) {
      navigator.clipboard.writeText(otpCode);
      setCopied(true);
      toast.success("OTP code copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="size-5 text-indigo-600" />
            <h2 className="text-base font-bold">User OTP Verification</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl border bg-muted/20">
            <div className="text-xs text-muted-foreground uppercase font-semibold">User</div>
            <div className="text-sm font-bold text-foreground">{user.full_name}</div>
            <div className="text-xs font-mono text-muted-foreground">{user.email}</div>
          </div>

          <div className="p-4 rounded-xl border-2 border-indigo-500/40 bg-indigo-500/5 text-center space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">6-Digit Verification OTP</div>
            {otpCode ? (
              <div className="bg-background rounded-lg border p-3 font-mono text-3xl font-black tracking-widest text-indigo-600">
                {otpCode}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic py-2">
                No active OTP code generated yet.
              </div>
            )}
            {otpCode && (
              <button
                type="button"
                onClick={copyCode}
                className="text-xs font-semibold text-indigo-600 hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                {copied ? "Copied!" : "Copy OTP Code"}
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={generateNewOtp}
              disabled={loading}
              className="flex-1 py-2 rounded-xl border text-xs font-semibold hover:bg-muted flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Generate New OTP
            </button>
            <button
              type="button"
              onClick={directActivate}
              disabled={loading}
              className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Zap className="size-3.5" />
              Direct Activate
            </button>
          </div>
        </div>

        <div className="p-4 border-t bg-muted/10 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-semibold rounded-lg border hover:bg-muted cursor-pointer">
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PasswordResetModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const { accessToken } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let res = "Org@";
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    res += "!2026";
    setPassword(res);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/erp/users/${user.id}/reset-password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const body = await res.text();
        let msg = "Failed to reset password";
        try {
          const json = JSON.parse(body);
          if (typeof json.detail === "string") msg = json.detail;
          else if (typeof json.message === "string") msg = json.message;
        } catch {}
        throw new Error(msg);
      }

      toast.success(`Password reset notification dispatched for ${user.email}!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b bg-muted/20">
          <h2 className="font-bold text-base flex items-center gap-2">
            <KeyRound className="size-5 text-indigo-500" />
            Reset User Password
          </h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900 border border-border rounded-xl p-3.5 space-y-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target User Account</div>
            <div className="text-sm font-bold text-foreground">{user.full_name}</div>
            <div className="text-xs text-muted-foreground font-mono">{user.email}</div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">New Temporary Password *</label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                ⚡ Auto-Generate
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter at least 8 characters..."
                className="w-full h-10 pl-3 pr-10 rounded-xl border bg-background text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800 dark:text-indigo-300">
              <Mail className="size-3.5 text-indigo-600" />
              Organization Mail Service Dispatch
            </div>
            <p className="text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
              A temporary password credential notification will be sent to <strong>{user.email}</strong> using your organization's configured mail service.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl border hover:bg-muted cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !password || password.length < 8}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Resetting..." : "Reset & Save"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function UserManagement({ tab = "users" }: { tab?: string }) {
  const { t } = useI18n();
  const { currency, formatCurrency } = useCurrency();
  const { accessToken, user: currentUser } = useAuth();
  const { hasPermission } = useRbac();
  const canManageUsers = Boolean(
    currentUser?.isPlatformAdmin ||
    currentUser?.isTenantOwner ||
    hasPermission("manage:users") ||
    hasPermission("manage:access_control") ||
    hasPermission("manage:erp") ||
    hasPermission("manage:settings")
  );
  const { tenant, companiesList } = useTenant();
  const canAssignSuperAdminRole = canAssignSuperAdmin(currentUser);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCompany, setFilterCompany] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | undefined>(undefined);
  const [resetUser, setResetUser] = useState<User | undefined>(undefined);
  const [otpModalUser, setOtpModalUser] = useState<User | undefined>(undefined);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedUserResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = accessToken
    ? { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
    : undefined;

  const loadUsers = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const userRes = await fetch(`${API_BASE_URL}/erp/users?all_workspaces=true`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userRes.ok) {
        const body = await userRes.text();
        throw new Error(body || "Failed to load users");
      }
      const userData: PaginatedResponse<User> = await userRes.json();
      setUsers(
        userData.items.map((user) => ({
          ...user,
          status: (user.status as unknown as string) === "active" ? "Active" : "Inactive",
        }))
      );

      const roleRes = await fetch(`${API_BASE_URL}/erp/roles`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!roleRes.ok) {
        const body = await roleRes.text();
        throw new Error(body || "Failed to load roles");
      }
      const roleData: PaginatedResponse<Role> = await roleRes.json();
      setRoles(roleData.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load user management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tenant?.id]);

  const saveUser = async (payload: UserFormPayload) => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);

    try {
      let savedUser: any = null;
      if (editUser) {
        const response = await fetch(`${API_BASE_URL}/erp/users/${editUser.id}`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({
            full_name: payload.full_name,
            status: payload.status,
            role_ids: payload.role_ids,
            default_role_id: payload.default_role_id,
            company_id: payload.company_id,
            must_change_password: payload.must_change_password,
            is_tenant_owner: payload.is_tenant_owner,
            enabled_modules: payload.enabled_modules,
            enabled_tabs: payload.enabled_tabs,
          }),
        });
        if (!response.ok) {
          let message = `Failed to save user (Status ${response.status})`;
          try {
            const text = await response.text();
            try {
              const json = JSON.parse(text);
              if (typeof json.detail === "string") message = json.detail;
              else if (Array.isArray(json.detail)) message = json.detail.map((d: any) => d.msg || d).join(", ");
              else if (json.message) message = json.message;
            } catch {
              if (text) message = text;
            }
          } catch {}
          throw new Error(message);
        }
        savedUser = await response.json().catch(() => null);
        toast.success("User updated successfully");
      } else {
        const response = await fetch(`${API_BASE_URL}/erp/users`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          let message = `Failed to create user (Status ${response.status})`;
          try {
            const text = await response.text();
            try {
              const json = JSON.parse(text);
              if (typeof json.detail === "string") message = json.detail;
              else if (Array.isArray(json.detail)) message = json.detail.map((d: any) => d.msg || d).join(", ");
              else if (json.message) message = json.message;
            } catch {
              if (text) message = text;
            }
          } catch {}
          throw new Error(message);
        }
        savedUser = await response.json().catch(() => null);

        // Show credentials popup if newly created
        if (savedUser) {
          setCreatedCredentials({
            user: savedUser,
            password: payload.password || savedUser.temp_password,
            verification_code: savedUser.verification_code,
            activation_mode: payload.activation_mode || "direct",
            tenantSlug: tenant?.slug,
          });
        }
      }

      const targetUserId = savedUser?.id || editUser?.id;
      if (targetUserId) {
        if (payload.enabled_modules) {
          setStoredUserModules(targetUserId, payload.enabled_modules);
        }
        if (payload.enabled_tabs) {
          setStoredUserTabs(targetUserId, payload.enabled_tabs);
        }
      }

      await loadUsers();
      setEditUser(undefined);
      setShowModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unable to save user");
      setError(err instanceof Error ? err.message : "Unable to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleDirectActivate = async (user: User) => {
    try {
      const res = await fetch(`${API_BASE_URL}/erp/users/${user.id}/direct-activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to directly activate user");
      toast.success(`User "${user.full_name}" is now directly verified and active!`);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to activate user");
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const searchMatch =
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const statusMatch = filterStatus === "All" || user.status === filterStatus;
      const roleMatch = filterRole === "All" || user.roles.some((role) => role.id === filterRole);
      const companyMatch =
        filterCompany === "All" ||
        (filterCompany === "org" && !user.company_id) ||
        user.company_id === filterCompany;
      return searchMatch && statusMatch && roleMatch && companyMatch;
    });
  }, [users, searchTerm, filterRole, filterStatus, filterCompany]);

  const pendingInvites = users.filter((user) => user.must_change_password || user.is_verified === false).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Members & Access Control</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage company users, workspace roles, on-screen OTP verification, and portal permissions.
          </p>
        </div>
        {canManageUsers && (
          <button
            onClick={() => {
              setEditUser(undefined);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-xs hover:bg-primary/90 transition cursor-pointer"
          >
            <UserPlus className="size-4" /> Add User / Onboard
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card shadow-2xs">
          <div className="text-xs text-muted-foreground">Total Users</div>
          <div className="text-2xl font-bold mt-1">{users.length}</div>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-2xs">
          <div className="text-xs text-muted-foreground">Active Accounts</div>
          <div className="text-2xl font-bold mt-1 text-emerald-600">
            {users.filter((user) => user.status === "Active").length}
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-2xs">
          <div className="text-xs text-muted-foreground">Pending Verification / OTP</div>
          <div className="text-2xl font-bold mt-1 text-amber-600">{pendingInvites}</div>
        </div>
        <div className="p-4 rounded-xl border bg-card shadow-2xs">
          <div className="text-xs text-muted-foreground">Defined Roles</div>
          <div className="text-2xl font-bold mt-1 text-primary">{roles.length}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-xl border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by full name or email..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {companiesList && companiesList.length > 0 && (
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="h-9 px-3 rounded-lg border bg-background text-xs outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="All">All Workspaces</option>
            <option value="org">🌐 Organization-wide</option>
            {companiesList.map((c) => (
              <option key={c.id} value={c.id}>
                🏢 {c.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-lg border bg-background text-xs outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="h-9 px-3 rounded-lg border bg-background text-xs outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="All">All Roles</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border overflow-hidden bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/60 border-b text-slate-600 dark:text-slate-400 text-xs uppercase font-semibold">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workspace Company</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roles</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visible Modules</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status / Verification</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-center text-muted-foreground">
                  Loading users…
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-center text-muted-foreground">
                  No users found matching filters.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="border-b last:border-0 hover:bg-muted/20 transition"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary text-white text-xs font-bold grid place-items-center shrink-0">
                        {user.avatar_initials || user.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-1.5">
                          {user.full_name}
                          {user.is_tenant_owner && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-700 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                              👑 Main Admin
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {user.company_name ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 font-semibold">
                        🏢 {user.company_name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 font-medium">
                        🌐 All Workspaces
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span key={role.id} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {role.name}{role.is_default ? " • Default" : ""}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const userCustom = (user.enabled_modules && user.enabled_modules.length > 0) ? user.enabled_modules : getStoredUserModules(user.id);
                      const roleCustom = user.roles?.[0]?.id ? getStoredRoleModules(user.roles[0].id) : null;
                      const effective = userCustom || roleCustom || ALL_MODULE_IDS;
                      if (effective.length === ALL_MODULE_IDS.length) {
                        return (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                            ✨ All Modules
                          </span>
                        );
                      }
                      const labels = SYSTEM_MODULES.filter((m) => effective.includes(m.id)).map((m) => m.shortLabel);
                      return (
                        <div className="flex flex-wrap gap-1 max-w-[200px]" title={labels.join(", ")}>
                          {labels.slice(0, 3).map((lbl) => (
                            <span
                              key={lbl}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/60 font-semibold"
                            >
                              {lbl}
                            </span>
                          ))}
                          {labels.length > 3 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                              +{labels.length - 3}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={user.status} isVerified={user.is_verified ?? true} />
                    </div>
                    {user.is_verified === false && canManageUsers && (
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => handleDirectActivate(user)}
                          className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 cursor-pointer"
                          title="Instantly activate and verify without requiring OTP or email"
                        >
                          <Zap className="size-3" /> Activate
                        </button>
                        <button
                          onClick={() => setOtpModalUser(user)}
                          className="text-[10px] px-2 py-0.5 rounded border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer"
                          title="View or generate 6-digit OTP code"
                        >
                          <Smartphone className="size-3" /> OTP Code
                        </button>
                      </div>
                    )}
                    {user.must_change_password && (
                      <div className="text-[10px] text-orange-600 font-medium">
                        Reset password on login
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManageUsers ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setOtpModalUser(user)}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 transition text-muted-foreground hover:text-indigo-600 cursor-pointer"
                          title="View / Generate OTP"
                        >
                          <Smartphone className="size-4" />
                        </button>
                        <button
                          onClick={() => setResetUser(user)}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 transition text-muted-foreground hover:text-indigo-600 cursor-pointer"
                          title="Reset Password"
                        >
                          <KeyRound className="size-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditUser(user);
                            setShowModal(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Edit User"
                        >
                          <Edit2 className="size-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (currentUser?.id === user.id) {
                              toast.error("You cannot delete your own logged-in user account.");
                              return;
                            }
                            if (!confirm(`Permanently delete user "${user.full_name}" (${user.email})? This action cannot be undone.`)) return;
                            try {
                              const res = await fetch(`${API_BASE_URL}/erp/users/${user.id}`, {
                                method: "DELETE",
                                headers: { Authorization: `Bearer ${accessToken}` },
                              });
                              if (!res.ok) {
                                const body = await res.text();
                                let msg = "Failed to delete user";
                                try {
                                  const json = JSON.parse(body);
                                  if (typeof json.detail === "string") msg = json.detail;
                                } catch {}
                                toast.error(msg);
                                return;
                              }
                              toast.success(`User "${user.full_name}" permanently deleted.`);
                              window.dispatchEvent(new CustomEvent("bos-tenant-changed"));
                              window.dispatchEvent(new Event("storage"));
                              await loadUsers();
                            } catch (err: any) {
                              toast.error(err.message || "Failed to delete user");
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition text-muted-foreground hover:text-destructive cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Read-only</span>
                    )}
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <AnimatePresence>
        {showModal && (
          <UserFormModal
            user={editUser}
            roles={roles}
            canAssignSuperAdminRole={canAssignSuperAdminRole}
            companiesList={companiesList}
            activeTenantId={tenant?.id}
            tenantSlug={tenant?.slug}
            onClose={() => setShowModal(false)}
            onSave={saveUser}
          />
        )}
        {createdCredentials && (
          <CreatedUserCredentialsModal
            data={createdCredentials}
            onClose={() => setCreatedCredentials(null)}
          />
        )}
        {otpModalUser && (
          <OtpDisplayModal
            user={otpModalUser}
            onClose={() => setOtpModalUser(undefined)}
            onActivated={loadUsers}
          />
        )}
        {resetUser && (
          <PasswordResetModal
            user={resetUser}
            onClose={() => setResetUser(undefined)}
            onSuccess={loadUsers}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
