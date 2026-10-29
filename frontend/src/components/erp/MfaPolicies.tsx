import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, ShieldCheck, Plus, Smartphone, Fingerprint, Lock, X, Save, Loader2, AlertCircle, Trash2, RefreshCw, Mail, MessageSquare, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { getWorkspaceHeaders } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/i18n-context";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "@/hooks/use-currency";

import { BiometricPasskeySettings } from "./BiometricPasskeySettings";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

interface Role {
  id: string;
  name: string;
}

interface MfaPolicy {
  id: string;
  role_id: string | null;
  methods: string;
  timeout: string;
  restrict_ip: boolean;
  status: string;
  created_at: string;
}

interface FirstTimeOtpPolicy {
  enabled: boolean;
  channels: string;
  otp_expiry_days: number;
  admin_exempt_on_onboarding?: boolean;
}

function MfaPolicyModal({
  policy,
  roles,
  activeCompanyQuery,
  onClose,
  onSaved,
}: {
  policy: MfaPolicy | null;
  roles: Role[];
  activeCompanyQuery: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { accessToken } = useAuth();
  const isEdit = !!policy;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    role_id: policy?.role_id ?? "",
    methods: policy?.methods ?? "First-Time Login OTP (Email & WhatsApp)",
    timeout: policy?.timeout ?? "12 hours",
    restrict_ip: policy?.restrict_ip ?? false,
    status: policy?.status ?? "active",
  });

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        role_id: form.role_id || null,
      };
      const url = isEdit
        ? `${API_BASE_URL}/erp/mfa-policies/${policy.id}${activeCompanyQuery}`
        : `${API_BASE_URL}/erp/mfa-policies${activeCompanyQuery}`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: getWorkspaceHeaders(accessToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save MFA policy");
      toast.success(isEdit ? "MFA Policy updated" : "MFA Policy created");
      onSaved();
      onClose();
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed");
      toast.error("Failed to save MFA policy");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg flex items-center gap-2"><Lock className="size-5 text-primary" />{isEdit ? "Configure MFA Policy" : "Add MFA Policy"}</h2>
          <button onClick={onClose} className="size-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Target Role (or leave blank for Global)</label>
            <select value={form.role_id} onChange={set("role_id")}
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Global policy (Apply to all organization users)</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">MFA Verification Method *</label>
            <select value={form.methods} onChange={set("methods")} required
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              <option value="First-Time Login OTP (Email & WhatsApp)">First-Time Login OTP (Email & WhatsApp)</option>
              <option value="Authenticator">Authenticator App (TOTP)</option>
              <option value="Biometric">Biometrics (WebAuthn)</option>
              <option value="First-Time Login OTP, Authenticator">First-Time Login OTP & Authenticator</option>
              <option value="Authenticator, Biometric">Authenticator & Biometrics</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Session Re-auth Timeout</label>
            <select value={form.timeout} onChange={set("timeout")}
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              <option value="First Login Only">First Login Only (One-Time Activation)</option>
              <option value="1 hour">1 hour</option>
              <option value="12 hours">12 hours</option>
              <option value="24 hours">24 hours</option>
              <option value="7 days">7 days</option>
              <option value="30 days">30 days</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="restrict_ip" checked={form.restrict_ip}
              onChange={(e) => setForm((p) => ({ ...p, restrict_ip: e.target.checked }))}
              className="size-4 rounded" />
            <label htmlFor="restrict_ip" className="text-sm font-medium">Restrict access to trusted IPs only</label>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">Status</label>
            <select value={form.status} onChange={set("status")}
              className="w-full h-9 px-3 text-sm rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gradient-brand text-white border-0 min-w-[100px]">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-4 mr-1.5" />Save</>}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function MfaPolicies() {
  const { t } = useI18n();
  const { currency, formatCurrency } = useCurrency();
  const { accessToken } = useAuth();
  const { tenant } = useTenant();
  const [policies, setPolicies] = useState<MfaPolicy[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [firstTimeOtp, setFirstTimeOtp] = useState<FirstTimeOtpPolicy>({
    enabled: false,
    channels: "Email & WhatsApp",
    otp_expiry_days: 7,
    admin_exempt_on_onboarding: true,
  });
  const [savingOtpPolicy, setSavingOtpPolicy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editPolicy, setEditPolicy] = useState<MfaPolicy | null>(null);
  const [deletePolicy, setDeletePolicy] = useState<MfaPolicy | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeCid = tenant?.id || localStorage.getItem("bos_active_company_id") || "";
  const activeCompanyQuery = activeCid ? `?company_id=${encodeURIComponent(activeCid)}` : "";

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const wsHeaders = getWorkspaceHeaders(accessToken);
      const [pRes, rRes, otpRes] = await Promise.all([
        fetch(`${API_BASE_URL}/erp/mfa-policies${activeCompanyQuery}`, { headers: wsHeaders }),
        fetch(`${API_BASE_URL}/erp/roles?page=1&page_size=100${activeCid ? `&company_id=${encodeURIComponent(activeCid)}` : ""}`, { headers: wsHeaders }),
        fetch(`${API_BASE_URL}/erp/mfa-policies/first-time-otp${activeCompanyQuery}`, { headers: wsHeaders }),
      ]);
      if (!pRes.ok || !rRes.ok) throw new Error("Failed to load MFA metadata");
      const pData = await pRes.json();
      const rData = await rRes.json();
      setPolicies(pData);
      setRoles(rData.items || []);
      if (otpRes.ok) {
        const otpData = await otpRes.json();
        setFirstTimeOtp({
          enabled: Boolean(otpData.enabled),
          channels: otpData.channels || "Email & WhatsApp",
          otp_expiry_days: Number(otpData.otp_expiry_days || 7),
          admin_exempt_on_onboarding: true,
        });
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenant?.id, activeCid, activeCompanyQuery]);

  useEffect(() => { void load(); }, [load]);

  const saveFirstTimeOtpPolicy = async (nextState: FirstTimeOtpPolicy) => {
    if (!accessToken) return;
    setSavingOtpPolicy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/erp/mfa-policies/first-time-otp${activeCompanyQuery}`, {
        method: "PUT",
        headers: getWorkspaceHeaders(accessToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          enabled: nextState.enabled,
          channels: nextState.channels,
          otp_expiry_days: nextState.otp_expiry_days,
        }),
      });
      if (!res.ok) throw new Error("Failed to update First-Time Login OTP policy");
      const updated = await res.json();
      setFirstTimeOtp({
        enabled: Boolean(updated.enabled),
        channels: updated.channels || "Email & WhatsApp",
        otp_expiry_days: Number(updated.otp_expiry_days || 7),
        admin_exempt_on_onboarding: true,
      });
      toast.success(
        updated.enabled
          ? "First-Time Login OTP Policy enabled — new organization users will receive a 6-digit OTP for first-time login."
          : "First-Time Login OTP Policy disabled — organization users can log in directly with their credentials."
      );
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update policy");
    } finally {
      setSavingOtpPolicy(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePolicy || !accessToken) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/erp/mfa-policies/${deletePolicy.id}${activeCompanyQuery}`, {
        method: "DELETE",
        headers: getWorkspaceHeaders(accessToken),
      });
      if (!res.ok) throw new Error("Failed to delete policy");
      toast.success("MFA Policy deleted");
      setDeletePolicy(null);
      void load();
    } catch (err) {
      console.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setDeleting(false);
    }
  };

  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));

  const filtered = policies.filter((p) => {
    const roleName = p.role_id ? (roleMap[p.role_id] ?? "").toLowerCase() : "global";
    return roleName.includes(search.toLowerCase()) || (p.methods || "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold tracking-tight">{t("MFA & First-Time Login OTP Policies", "MFA & First-Time Login OTP Policies")}</h2>
          <p className="text-xs text-muted-foreground">
            {t(
              "Configure organization-wide first-time login OTP verification for users, role-based MFA rules, and device trust.",
              "Configure organization-wide first-time login OTP verification for users, role-based MFA rules, and device trust."
            )}
          </p>
        </div>
        <Button size="sm" className="h-8 gradient-brand text-white border-0 gap-1.5 text-xs font-semibold" onClick={() => { setEditPolicy(null); setShowModal(true); }}>
          <Plus className="size-3.5" /> {t("Add Role MFA Policy", "Add Role MFA Policy")}
        </Button>
      </div>

      {/* Organization First-Time User Login OTP Policy Card */}
      <Card className={cn(
        "p-5 border-2 transition-all",
        firstTimeOtp.enabled
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-border bg-card"
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                <Smartphone className="size-3.5" /> Organization Onboarding Policy
              </span>
              <span className={cn(
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold",
                firstTimeOtp.enabled
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : "bg-slate-500/15 text-slate-600 dark:text-slate-400"
              )}>
                {firstTimeOtp.enabled ? (
                  <><CheckCircle2 className="size-3" /> Active — OTP Required on First User Login</>
                ) : (
                  "Disabled — Direct Credential Login (Default)"
                )}
              </span>
            </div>
            <h3 className="text-sm font-bold text-foreground">
              First-Time Login OTP Verification for Organization Users
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Organization Admins are automatically activated during tenant onboarding without requiring an OTP.
              When you enable this policy, any new users or employees created in your workspace will receive a{" "}
              <strong>6-digit verification OTP</strong> alongside their login credentials and must verify it on their first login.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Delivery Channel</label>
              <select
                value={firstTimeOtp.channels}
                disabled={savingOtpPolicy}
                onChange={(e) => {
                  const next = { ...firstTimeOtp, channels: e.target.value };
                  setFirstTimeOtp(next);
                  void saveFirstTimeOtpPolicy(next);
                }}
                className="h-9 px-3 text-xs font-medium rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="Email & WhatsApp">Email & WhatsApp</option>
                <option value="Email Only">Email Only (SMTP)</option>
                <option value="WhatsApp Only">WhatsApp Only</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">OTP Validity</label>
              <select
                value={firstTimeOtp.otp_expiry_days}
                disabled={savingOtpPolicy}
                onChange={(e) => {
                  const next = { ...firstTimeOtp, otp_expiry_days: Number(e.target.value) };
                  setFirstTimeOtp(next);
                  void saveFirstTimeOtpPolicy(next);
                }}
                className="h-9 px-3 text-xs font-medium rounded-lg border bg-background outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value={1}>24 Hours (1 Day)</option>
                <option value={3}>3 Days</option>
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Policy Status</label>
              <Button
                type="button"
                size="sm"
                disabled={savingOtpPolicy}
                onClick={() => {
                  const next = { ...firstTimeOtp, enabled: !firstTimeOtp.enabled };
                  setFirstTimeOtp(next);
                  void saveFirstTimeOtpPolicy(next);
                }}
                className={cn(
                  "h-9 px-4 text-xs font-bold gap-2 cursor-pointer",
                  firstTimeOtp.enabled
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900"
                )}
              >
                {savingOtpPolicy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="size-3.5" />
                )}
                {firstTimeOtp.enabled ? "Disable First-Time OTP" : "Enable First-Time OTP for Users"}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Mail className="size-3.5 text-primary" />
            <span><strong>Org Admin Onboarding:</strong> Exempt from OTP (Direct Login with Credentials)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="size-3.5 text-primary" />
            <span>
              <strong>New Users & Employees:</strong>{" "}
              {firstTimeOtp.enabled
                ? `6-digit OTP sent via ${firstTimeOtp.channels} (valid ${firstTimeOtp.otp_expiry_days} day${firstTimeOtp.otp_expiry_days > 1 ? "s" : ""})`
                : "Credentials sent without OTP — users log in directly"}
            </span>
          </span>
        </div>
      </Card>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border bg-card focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder={t("Search target role...", "Search target role...")} />
        </div>
        <Button variant="outline" className="gap-2 h-10" onClick={load}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-44 rounded-xl border bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/10 rounded-2xl border border-dashed">
          <ShieldCheck className="size-10 mx-auto mb-3 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">{t("No custom role-based MFA policies configured", "No custom role-based MFA policies configured")}</p>
          <Button size="sm" className="mt-4 gradient-brand text-white border-0" onClick={() => { setEditPolicy(null); setShowModal(true); }}>
            <Plus className="size-4 mr-1" /> {t("Add Role MFA Policy", "Add Role MFA Policy")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {filtered.map((policy) => (
            <Card key={policy.id} className="p-6 border-t-4 border-t-primary relative group">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                    <ShieldCheck className="size-3" /> Target Role
                  </div>
                  <h3 className="font-bold text-base text-foreground">
                    {policy.role_id ? roleMap[policy.role_id] ?? "Unknown Role" : "Global Policy"}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${policy.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                    {policy.status}
                  </span>
                  <Button variant="ghost" size="icon" className="size-7 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setDeletePolicy(policy)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">Allowed Methods</div>
                  <div className="flex items-center gap-2 font-semibold text-xs text-foreground bg-muted p-2 rounded-lg">
                    {policy.methods.includes("Biometric") ? <Fingerprint className="size-4 text-primary" /> : <Smartphone className="size-4 text-primary" />}
                    <span>{policy.methods}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t text-xs">
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">Session Re-auth</div>
                    <div className="font-semibold flex items-center gap-1"><Lock className="size-3 text-primary" /> {policy.timeout}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground mb-0.5">IP Restrictions</div>
                    <div className="font-semibold">{policy.restrict_ip ? "Strict Only" : "None"}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setEditPolicy(policy); setShowModal(true); }}>
                  Configure Rules
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Native WebAuthn FIDO2 Biometrics & Passkeys Management */}
      <div className="pt-6 border-t border-border/50">
        <BiometricPasskeySettings />
      </div>

      <AnimatePresence>
        {showModal && (
          <MfaPolicyModal
            policy={editPolicy}
            roles={roles}
            activeCompanyQuery={activeCompanyQuery}
            onClose={() => setShowModal(false)}
            onSaved={load}
          />
        )}
        {deletePolicy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-red-500/10 text-red-500 grid place-items-center"><AlertCircle className="size-5" /></div>
                <h3 className="font-bold">{t("Delete MFA Policy", "Delete MFA Policy")}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete this MFA policy? Access verification for target roles will revert to global defaults.</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeletePolicy(null)}>Cancel</Button>
                <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                  {deleting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Trash2 className="size-4 mr-1" />} Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
