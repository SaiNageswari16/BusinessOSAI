import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PlatformShell } from "@/components/layout/PlatformShell";
import { getPlatformToken, setPlatformToken } from "@/lib/auth-tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, KeyRound } from "lucide-react";
import { platformService } from "@/services/platformService";
import { toast } from "sonner";

export const Route = createFileRoute("/platform")({
  head: () => ({
    meta: [
      { title: "Platform Super Admin — BusinessOS" },
      { name: "description", content: "Enterprise Super Admin Control Plane for BusinessOS." },
    ],
  }),
  component: PlatformLayout,
});

function PlatformLayout() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("superadmin@businessos.test");
  const [password, setPassword] = useState("SuperAdmin123!");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setToken(getPlatformToken());
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await platformService.login(email, password);
      setToken(getPlatformToken());
      toast.success("Authenticated to Platform Super Admin");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading...</div>;
  }

  // If not authenticated to platform realm, show dedicated Super Admin Gate
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="size-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 mx-auto flex items-center justify-center shadow-md shadow-indigo-500/25">
              <Shield className="size-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Platform Super Admin</h1>
            <p className="text-xs text-slate-500">
              Isolated Control Plane (<code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded font-mono">auth_realm: platform</code>).
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700">Super Admin Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs focus-visible:ring-indigo-500"
                placeholder="superadmin@businessos.test"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-700">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs focus-visible:ring-indigo-500"
                placeholder="••••••••••••"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs h-9 shadow-xs"
            >
              <KeyRound className="size-3.5 mr-2" />
              {loading ? "Authenticating..." : "Sign in to Control Plane"}
            </Button>
          </form>

          <div className="text-center pt-2 border-t border-slate-200">
            <p className="text-[11px] text-slate-500">
              Enterprise Root Control • Zero Shared DB Base • RBAC Tier 5
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PlatformShell>
      <Outlet />
    </PlatformShell>
  );
}
