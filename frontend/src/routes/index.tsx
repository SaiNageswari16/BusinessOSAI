import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Sparkles, ShieldCheck, Zap, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const { login, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("alexandra.chen@businessos.ai");
  const [password, setPassword] = useState("••••••••••");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthed) navigate({ to: "/role-select" });
  }, [isAuthed, navigate]);

  const handle = (provider?: string) => {
    setLoading(true);
    setTimeout(() => {
      login(email);
      toast.success(provider ? `Signed in with ${provider}` : "Welcome back");
      navigate({ to: "/role-select" });
    }, 700);
  };

  return (
    <div className="min-h-screen grid items-stretch lg:grid-cols-2 bg-background">
      {/* Left — brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden gradient-brand text-white">
        <div className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 80%, white 0, transparent 35%)" }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-white/15 backdrop-blur grid place-items-center ring-1 ring-white/30">
            <Sparkles className="size-6" />
          </div>
          <div>
            <div className="font-bold text-lg tracking-tight">BusinessOS AI</div>
            <div className="text-xs text-white/70">Enterprise Operating System</div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight">
            One platform. Every part of your business.
          </h1>
          <p className="mt-5 text-white/80 text-lg leading-relaxed">
            ERP, POS, Inventory, CRM, HRMS, IoT and Accounting — unified by an AI copilot that thinks across your entire operation.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-3 max-w-md">
            {[
              { icon: Zap, t: "AI Copilot trained on your data" },
              { icon: BarChart3, t: "Realtime analytics across 350+ KPIs" },
              { icon: ShieldCheck, t: "SOC 2 Type II • ISO 27001 • GDPR" },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur px-4 py-3 ring-1 ring-white/20">
                <f.icon className="size-5 shrink-0" />
                <span className="text-sm">{f.t}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="relative z-10 text-xs text-white/60">
          Trusted by 8,200+ companies across 47 countries.
        </div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-3xl bg-card p-8 shadow-xl ring-1 ring-border">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="size-10 rounded-xl gradient-brand grid place-items-center text-white">
              <Sparkles className="size-5" />
            </div>
            <span className="font-bold text-lg">BusinessOS AI</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-muted-foreground">Sign in to your enterprise workspace.</p>

          <form onSubmit={(e) => { e.preventDefault(); handle(); }} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => toast.info("Password reset link sent.")}>
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input id="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="remember" defaultChecked />
              <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">Remember me on this device</Label>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-11 gradient-brand text-white hover:opacity-90 border-0">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            OR CONTINUE WITH
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-11" onClick={() => handle("Google")}>
              <svg className="size-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" /></svg>
              Google
            </Button>
            <Button variant="outline" className="h-11" onClick={() => handle("Microsoft")}>
              <svg className="size-4 mr-2" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z" /><path fill="#7FBA00" d="M13 1h10v10H13z" /><path fill="#00A4EF" d="M1 13h10v10H1z" /><path fill="#FFB900" d="M13 13h10v10H13z" /></svg>
              Microsoft
            </Button>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            By signing in you agree to our Terms of Service & Privacy Policy.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
