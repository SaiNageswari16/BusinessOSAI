import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { useRbac } from "@/contexts/rbac-context";
import { toast } from "sonner";
import {
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  XCircle,
  Sparkles,
  Copy,
  ShieldCheck,
  UserCheck,
  Users,
  Search,
  Loader2,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

interface OrgUser {
  id: string;
  email: string;
  full_name: string;
  status: string;
  roles?: { id: string; name: string }[];
  is_tenant_owner?: boolean;
}

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
  width: string;
} {
  if (password.length === 0) {
    return { score: 0, label: "", color: "bg-muted", width: "w-0" };
  }
  if (password.length < 6) {
    return { score: 1, label: "Too short (min 6 chars)", color: "bg-red-500", width: "w-1/4" };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const criteriaCount = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;

  if (password.length >= 8 && criteriaCount >= 3) {
    return { score: 4, label: "Very Strong", color: "bg-emerald-500", width: "w-full" };
  }
  if (criteriaCount >= 2 && password.length >= 7) {
    return { score: 3, label: "Good", color: "bg-blue-500", width: "w-3/4" };
  }
  return { score: 2, label: "Fair", color: "bg-amber-500", width: "w-2/4" };
}

export function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
  const { user, accessToken, changePassword } = useAuth();
  const { activeRole, hasPermission } = useRbac();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Per-user selection for privileged actors
  const isPrivileged = useMemo(() => {
    return Boolean(
      user?.isPlatformAdmin ||
      user?.isTenantOwner ||
      hasPermission("manage:users") ||
      hasPermission("manage:access_control") ||
      activeRole?.name?.toLowerCase().includes("admin")
    );
  }, [user, hasPermission, activeRole]);

  const [targetType, setTargetType] = useState<"self" | "other">("self");
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // Load organization users if privileged
  useEffect(() => {
    if (!open || !isPrivileged || !accessToken) return;

    let isMounted = true;
    setLoadingUsers(true);

    fetch(`${API_BASE_URL}/erp/users?all_workspaces=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Could not fetch user list");
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          const list: OrgUser[] = Array.isArray(data)
            ? data
            : Array.isArray(data.items)
            ? data.items
            : [];
          setOrgUsers(list);
          if (list.length > 0 && !selectedUserId) {
            setSelectedUserId(list[0].id);
          }
        }
      })
      .catch(() => {
        // Fallback silently if ERP user list endpoint not accessible
      })
      .finally(() => {
        if (isMounted) setLoadingUsers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, isPrivileged, accessToken, selectedUserId]);

  // Reset fields when modal is closed
  useEffect(() => {
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setTargetType("self");
      setUserSearch("");
      setSaving(false);
    }
  }, [open]);

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);
  const isMatching =
    confirmPassword.length > 0 && newPassword === confirmPassword;
  const isMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    newPassword.length >= 6 &&
    newPassword === confirmPassword &&
    !saving &&
    (targetType === "self" || Boolean(selectedUserId));

  const targetUserObj = useMemo(() => {
    if (targetType === "self") return null;
    return orgUsers.find((u) => u.id === selectedUserId) || null;
  }, [targetType, orgUsers, selectedUserId]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return orgUsers;
    const q = userSearch.toLowerCase();
    return orgUsers.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [orgUsers, userSearch]);

  const handleGeneratePassword = () => {
    const charsUpper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const charsLower = "abcdefghijkmnpqrstuvwxyz";
    const charsNum = "23456789";
    const charsSym = "@#$%&*";
    let gen = "Pass@";
    for (let i = 0; i < 4; i++) {
      gen += charsUpper.charAt(Math.floor(Math.random() * charsUpper.length));
      gen += charsLower.charAt(Math.floor(Math.random() * charsLower.length));
    }
    gen += charsNum.charAt(Math.floor(Math.random() * charsNum.length));
    gen += charsSym.charAt(Math.floor(Math.random() * charsSym.length));

    setNewPassword(gen);
    setConfirmPassword(gen);
    setShowNewPassword(true);
    setShowConfirmPassword(true);

    try {
      navigator.clipboard.writeText(gen);
      toast.success("Generated strong password and copied to clipboard!");
    } catch {
      toast.success("Generated strong password!");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    try {
      if (targetType === "self") {
        // Change password for current logged-in user
        await changePassword({
          new_password: newPassword,
        });
        toast.success("Your password has been updated successfully!");
        onOpenChange(false);
      } else {
        // Change/reset password for another user
        if (!selectedUserId) {
          toast.error("Please select a target user.");
          return;
        }

        const res = await fetch(
          `${API_BASE_URL}/erp/users/${selectedUserId}/reset-password`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              password: newPassword,
              must_change_password: false,
            }),
          }
        );

        if (!res.ok) {
          const body = await res.text();
          let errMsg = "Failed to update user password";
          try {
            const parsed = JSON.parse(body);
            if (typeof parsed.detail === "string") errMsg = parsed.detail;
            else if (typeof parsed.message === "string") errMsg = parsed.message;
          } catch {}
          throw new Error(errMsg);
        }

        const targetName = targetUserObj?.full_name || targetUserObj?.email || "User";
        toast.success(`Password successfully changed for ${targetName}!`);
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl shadow-2xl border bg-card">
        {/* Header with vibrant subtle gradient */}
        <div className="relative bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white p-6 pb-5">
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center ring-1 ring-white/30 shrink-0">
                <KeyRound className="size-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Change Password
                </DialogTitle>
                <DialogDescription className="text-xs text-white/80">
                  Update or reset password credentials at any time
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Decorative ambient ring */}
          <div className="absolute -top-10 -right-10 size-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* ─── User Context / Selector ─── */}
          {isPrivileged && orgUsers.length > 1 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Account To Update
                </Label>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setTargetType("self")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      targetType === "self"
                        ? "bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Myself
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("other")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      targetType === "other"
                        ? "bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    Select User
                  </button>
                </div>
              </div>

              {targetType === "self" ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="size-9 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {user?.avatar || (user?.name ? user.name.slice(0, 2).toUpperCase() : "ME")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                      {user?.name || "Your Account"}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                        Current User
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user?.email}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search member by name or email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-900/50"
                    />
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 border rounded-xl p-1.5 bg-slate-50/50 dark:bg-slate-900/30">
                    {loadingUsers ? (
                      <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
                        <Loader2 className="size-3.5 animate-spin text-purple-600" />
                        Loading organization users...
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="text-center py-3 text-xs text-slate-400">
                        No team members found
                      </div>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSelected = selectedUserId === u.id;
                        return (
                          <div
                            key={u.id}
                            onClick={() => setSelectedUserId(u.id)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                              isSelected
                                ? "bg-purple-100/70 dark:bg-purple-950/50 border border-purple-300 dark:border-purple-800 font-semibold"
                                : "hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-slate-800 dark:text-slate-200">
                                {u.full_name || u.email}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                                {u.email}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="size-4 text-purple-600 shrink-0 ml-2" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="size-9 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                {user?.avatar || (user?.name ? user.name.slice(0, 2).toUpperCase() : "ME")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                  {user?.name || "Your Account"}
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                    {activeRole?.name || "User"}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user?.email}
                </div>
              </div>
            </div>
          )}

          {/* ─── New Password Input ─── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="new-pwd"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                New Password *
              </Label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="inline-flex items-center gap-1 text-[11px] text-purple-700 dark:text-purple-300 hover:text-purple-900 font-semibold cursor-pointer transition hover:underline"
              >
                <Sparkles className="size-3 text-purple-600" />
                Generate Secure Password
              </button>
            </div>
            <div className="relative">
              <Input
                id="new-pwd"
                type={showNewPassword ? "text" : "password"}
                placeholder="Enter new password (min. 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="pr-10 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNewPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            {/* Strength bar */}
            {newPassword.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color} ${strength.width}`}
                  />
                </div>
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-500">Strength:</span>
                  <span
                    className={`font-semibold ${
                      strength.score >= 3
                        ? "text-emerald-600 dark:text-emerald-400"
                        : strength.score === 2
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-500"
                    }`}
                  >
                    {strength.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ─── Confirm Password Input ─── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="confirm-pwd"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Confirm Password *
              </Label>
              {isMatching && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" /> Passwords match
                </span>
              )}
              {isMismatch && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500">
                  <XCircle className="size-3" /> Passwords do not match
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="confirm-pwd"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter new password to confirm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className={`pr-10 text-sm font-mono ${
                  isMismatch
                    ? "border-red-400 focus-visible:ring-red-400"
                    : isMatching
                    ? "border-emerald-400 focus-visible:ring-emerald-400"
                    : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* ─── Footer Buttons ─── */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
              className="bg-purple-700 hover:bg-purple-800 text-white font-semibold cursor-pointer shadow-sm min-w-32"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Lock className="size-4 mr-1.5" />
                  Update Password
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
