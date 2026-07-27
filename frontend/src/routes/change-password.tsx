import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Sparkles, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, resolvePostAuthRoute } from "@/contexts/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/change-password")({
  component: ChangePasswordPage,
});

function strengthLabel(password: string): { label: string; color: string; width: string } {
  if (password.length === 0) return { label: "", color: "bg-border", width: "w-0" };
  if (password.length < 8) return { label: "Too short", color: "bg-red-500", width: "w-1/4" };
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const score = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
  if (score <= 2) return { label: "Weak", color: "bg-orange-500", width: "w-2/4" };
  if (score === 3) return { label: "Good", color: "bg-yellow-500", width: "w-3/4" };
  return { label: "Strong", color: "bg-emerald-500", width: "w-full" };
}

function ChangePasswordPage() {
  const { user, authReady, changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const isFirstLogin = user?.mustChangePassword ?? false;
  const strength = strengthLabel(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    newPassword.length >= 8 &&
    passwordsMatch &&
    (isFirstLogin || currentPassword.length > 0);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      navigate({ to: "/" });
    }
  }, [authReady, user, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !canSubmit) return;
    setSaving(true);
    try {
      const result = await changePassword({
        current_password: isFirstLogin ? "" : currentPassword,
        new_password: newPassword,
      });
      toast.success("Password updated successfully!");
      navigate({ to: resolvePostAuthRoute(result.user, result.token) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update password";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen grid items-stretch lg:grid-cols-2 bg-background">
      {/* Left panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden gradient-brand text-white">
        <div className="relative z-10 flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-white/15 backdrop-blur grid place-items-center ring-1 ring-white/30">
            <Sparkles className="size-6" />
          </div>
          <div>
            <div className="font-bold text-lg tracking-tight">IOTRONCS Retail</div>
            <div className="text-xs text-white/70">Secure workspace access</div>
          </div>
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight">
            {isFirstLogin ? "Set your password to get started." : "Update your password securely."}
          </h1>
          <p className="text-white/80 text-lg leading-relaxed">
            {isFirstLogin
              ? "This is your first login. Please choose a strong password to secure your account before continuing."
              : "Keep your account secure by updating your password regularly."}
          </p>

          <div className="space-y-3">
            {[
              "At least 8 characters",
              "Mix of uppercase & lowercase",
              "Include numbers and symbols for strength",
            ].map((tip) => (
              <div key={tip} className="flex items-center gap-2 text-sm text-white/80">
                <CheckCircle2 className="size-4 text-white/60 shrink-0" />
                {tip}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} IOTRONCS Retail. All rights reserved.
        </div>

        {/* decorative blobs */}
        <div className="absolute -bottom-24 -right-24 size-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-1/4 -left-12 size-48 rounded-full bg-white/5 blur-2xl" />
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl bg-card p-8 shadow-xl ring-1 ring-border"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="size-10 rounded-xl gradient-brand grid place-items-center text-white">
              <Sparkles className="size-5" />
            </div>
            <span className="font-bold text-lg">IOTRONCS Retail</span>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {isFirstLogin ? "Create your password" : "Change password"}
              </h2>
            </div>
          </div>

          <p className="text-muted-foreground text-sm mb-8">
            {isFirstLogin
              ? `Hi ${user?.name ?? "there"}, set a secure password to activate your account.`
              : "Enter your current password, then choose a new one."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current password — only shown when NOT first login */}
            {!isFirstLogin && (
              <div className="space-y-2">
                <Label htmlFor="current_password">Current password</Label>
                <div className="relative">
                  <Input
                    id="current_password"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-11 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* New password */}
            <div className="space-y-2">
              <Label htmlFor="new_password">New password</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {/* Strength meter */}
              {newPassword.length > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                  </div>
                  <p className="text-xs text-muted-foreground">{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`h-11 ${confirmPassword.length > 0 && !passwordsMatch ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  autoComplete="new-password"
                />
                {confirmPassword.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {passwordsMatch
                      ? <CheckCircle2 className="size-4 text-emerald-500" />
                      : <span className="text-xs text-red-500">✕</span>
                    }
                  </div>
                )}
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-500">Passwords don't match</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={saving || !canSubmit}
              className="w-full h-11 gradient-brand text-white border-0 font-semibold"
            >
              {saving ? "Saving…" : isFirstLogin ? "Activate account" : "Update password"}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
