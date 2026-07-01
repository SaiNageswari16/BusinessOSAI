import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, User as UserIcon, ArrowRight, LayoutDashboard, Truck, Package, Calculator, Store } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useRbac } from "@/contexts/rbac-context";
import { Role } from "@/data/mockRbacData";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/role-select")({
  component: RoleSelectPage,
});

function RoleSelectPage() {
  const { user, isAuthed } = useAuth();
  const { availableRoles, setActiveRole } = useRbac();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthed) {
      navigate({ to: "/" });
      return;
    }
    // If only 1 role, auto select and go
    if (availableRoles.length === 1) {
      setActiveRole(availableRoles[0]);
      navigate({ to: "/dashboard" });
    }
  }, [isAuthed, availableRoles, navigate, setActiveRole]);

  const handleSelect = (role: Role) => {
    setActiveRole(role);
    navigate({ to: "/dashboard" });
  };

  const getIconForRole = (id: string) => {
    if (id.includes("admin")) return ShieldCheck;
    if (id.includes("warehouse")) return Package;
    if (id.includes("sales") || id.includes("branch")) return Store;
    if (id.includes("vendor")) return Truck;
    if (id.includes("accounting")) return Calculator;
    return LayoutDashboard;
  };

  if (!user || availableRoles.length <= 1) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 bg-card rounded-3xl p-8 border shadow-sm">
        
        {/* Left Side */}
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-8">
            <div className="size-10 rounded-xl gradient-brand grid place-items-center text-white">
              <Sparkles className="size-5" />
            </div>
            <span className="font-bold text-lg text-foreground">BusinessOS AI</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">Select your workspace</h1>
          <p className="mt-2 text-muted-foreground text-lg">
            Welcome back, {user.name}. You have access to multiple roles within the organization. Which portal do you want to enter?
          </p>
        </div>

        {/* Right Side - Roles list */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Available Roles</h2>
          {availableRoles.map((role, i) => {
            const Icon = getIconForRole(role.id);
            return (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <button
                  onClick={() => handleSelect(role)}
                  className="w-full flex items-start gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors text-left group"
                >
                  <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 group-hover:scale-110 transition-transform">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{role.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">{role.description}</p>
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
