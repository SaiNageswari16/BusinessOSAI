import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  ShieldCheck,
  ArrowRight,
  LayoutDashboard,
  Truck,
  Package,
  Calculator,
  Store,
  Loader2,
} from "lucide-react";
import { useAuth, resolvePostAuthRoute } from "@/contexts/auth-context";
import type { AuthRole } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/role-select")({
  component: RoleSelectPage,
});

function getIconForRole(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("admin")) return ShieldCheck;
  if (lower.includes("warehouse")) return Package;
  if (lower.includes("sales") || lower.includes("branch")) return Store;
  if (lower.includes("vendor") || lower.includes("procurement")) return Truck;
  if (lower.includes("accounting") || lower.includes("finance")) return Calculator;
  return LayoutDashboard;
}

function RoleSelectPage() {
  const { user, isAuthed, selectRole } = useAuth();
  const navigate = useNavigate();
  const [selecting, setSelecting] = useState<string | null>(null);

  const availableRoles: AuthRole[] = user?.roles ?? [];

  useEffect(() => {
    if (!isAuthed) {
      navigate({ to: "/" });
      return;
    }
    // If only 1 role, auto-select and go straight to dashboard
    if (availableRoles.length === 1) {
      handleSelect(availableRoles[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  const handleSelect = async (role: AuthRole) => {
    setSelecting(role.id);
    try {
      const result = await selectRole(role.id);
      navigate({ to: resolvePostAuthRoute(result.user, result.token) });
    } catch {
      // selectRole endpoint may not exist — fall back to client-side role switch
      localStorage.setItem("bos-active-role", role.id);
      navigate({ to: "/dashboard" });
    } finally {
      setSelecting(null);
    }
  };

  if (!user) return null;

  if (availableRoles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-2xl rounded-3xl bg-card p-10 shadow-xl ring-1 ring-border text-center">
          <h1 className="text-3xl font-bold">No roles assigned</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your account has not been assigned any roles yet. Please contact your administrator.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button className="h-11" onClick={() => navigate({ to: "/dashboard" })}>
              Continue to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (availableRoles.length === 1) return null; // auto-selecting, show nothing

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 bg-card rounded-3xl p-8 border shadow-sm">

        {/* Left Side */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-8">
            <div className="size-10 rounded-xl gradient-brand grid place-items-center text-white">
              <Sparkles className="size-5" />
            </div>
            <span className="font-bold text-lg text-foreground">LazyMonkeyAI</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">Select your workspace</h1>
          <p className="mt-2 text-muted-foreground text-lg">
            Welcome back, <strong>{user.name}</strong>. You have access to{" "}
            <strong>{availableRoles.length} roles</strong> in this organization. Pick one to continue.
          </p>

          <div className="mt-6 p-4 rounded-xl bg-muted/40 border text-sm text-muted-foreground">
            <ShieldCheck className="size-4 inline mr-2 text-primary" />
            You can switch roles at any time from the top navigation bar.
          </div>
        </div>

        {/* Right Side - Roles list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Available Roles
          </h2>
          {availableRoles.map((role, i) => {
            const Icon = getIconForRole(role.name);
            const isLoading = selecting === role.id;
            return (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <button
                  onClick={() => handleSelect(role)}
                  disabled={selecting !== null}
                  className="w-full flex items-start gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all text-left group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 group-hover:scale-110 transition-transform">
                    {isLoading ? <Loader2 className="size-5 animate-spin" /> : <Icon className="size-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{role.name}</h3>
                      {role.is_default && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {role.description ?? "Access your workspace with this role"}
                    </p>
                  </div>
                  <ArrowRight className="size-5 text-muted-foreground self-center opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
