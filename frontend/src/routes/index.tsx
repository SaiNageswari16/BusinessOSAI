import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Sparkles, ShieldCheck, Zap, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, resolvePostAuthRoute } from "@/contexts/auth-context";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const { login, register, isAuthed, user } = useAuth();
  const navigate = useNavigate();
  const initialRedirectTriedRef = useRef(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);
  const [oauthConfigLoading, setOAuthConfigLoading] = useState(true);

  useEffect(() => {
    if (!initialRedirectTriedRef.current && isAuthed && user) {
      initialRedirectTriedRef.current = true;
      navigate({ to: resolvePostAuthRoute(user) });
    }
  }, [isAuthed, navigate, user]);

  useEffect(() => {
    let isMounted = true;
    const loadOAuthConfig = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/oauth/config`);
        if (!response.ok) return;
        const json = await response.json();
        if (isMounted) setGoogleOAuthEnabled(Boolean(json.google_oauth_enabled));
      } catch {
        // ignore
      } finally {
        if (isMounted) setOAuthConfigLoading(false);
      }
    };
    void loadOAuthConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const result = mode === "login"
        ? await login({ email, password, tenant_slug: tenantSlug || undefined })
        : await register({
            tenant_name: tenantName,
            tenant_slug: tenantSlug || undefined,
            admin_name: adminName,
            admin_email: email,
            admin_password: password,
            company_name: companyName,
          });

      toast.success(mode === "login" ? "Signed in successfully" : "Workspace created and signed in");
      navigate({ to: resolvePostAuthRoute(result.user, result.token) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = () => {
    if (!googleOAuthEnabled) {
      toast.error("Google OAuth is not configured. Use email login instead.");
      return;
    }

    const params: string[] = [];
    if (tenantSlug) params.push(`tenant_slug=${encodeURIComponent(tenantSlug)}`);
    if (tenantName) params.push(`tenant_name=${encodeURIComponent(tenantName)}`);
    params.push(`mode=${mode === "register" ? "register" : "login"}`);

    const query = params.length ? `?${params.join("&")}` : "";
    window.location.href = `${API_BASE_URL}/auth/oauth/google/login${query}`;
  };

  const googleButtonLabel = mode === "login" ? "Continue with Google" : "Register with Google";

  return (
    <div className="min-h-screen grid items-stretch lg:grid-cols-2 bg-background">
      {/* Left — brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-slate-950 text-white">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-indigo-600/40 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[0%] right-[0%] w-[70%] h-[70%] rounded-full bg-emerald-600/20 blur-[120px] pointer-events-none" />
        <div className="absolute top-[40%] right-[10%] w-[40%] h-[40%] rounded-full bg-violet-600/30 blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="size-12 rounded-2xl bg-white/10 backdrop-blur-md grid place-items-center ring-1 ring-white/20 shadow-xl">
            <Sparkles className="size-6 text-indigo-300" />
          </div>
          <div>
            <div className="font-bold text-xl tracking-tight text-white">BusinessOS AI</div>
            <div className="text-xs text-indigo-200/80 uppercase tracking-wider font-semibold mt-0.5">Enterprise Operating System</div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-bold leading-[1.1] tracking-tight">
            One platform.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-emerald-300">Every part of your business.</span>
          </h1>
          <p className="mt-6 text-slate-300 text-lg leading-relaxed">
            ERP, POS, Inventory, CRM, HRMS, IoT and Accounting — unified by an AI copilot that thinks across your entire operation.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 max-w-md">
            {[
              { icon: Zap, t: "AI Copilot trained on your data" },
              { icon: BarChart3, t: "Realtime analytics across 350+ KPIs" },
              { icon: ShieldCheck, t: "SOC 2 Type II • ISO 27001 • GDPR" },
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-4 rounded-xl bg-white/5 backdrop-blur-sm px-5 py-3.5 ring-1 ring-white/10 shadow-lg hover:bg-white/10 transition-colors">
                <f.icon className="size-5 shrink-0 text-indigo-300" />
                <span className="text-sm font-medium text-slate-200">{f.t}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="relative z-10 text-xs font-medium text-slate-400">
          Trusted by 8,200+ companies across 47 countries.
        </div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center p-6 sm:p-10 relative">
        {/* Subtle background glow for the right panel */}
        <div className="absolute inset-0 bg-slate-50/50 dark:bg-slate-950/50 -z-10" />
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-2xl bg-card p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-border/60">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="size-10 rounded-xl bg-indigo-600 grid place-items-center text-white shadow-md shadow-indigo-600/20">
              <Sparkles className="size-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">BusinessOS AI</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-foreground">{mode === "login" ? "Welcome back" : "Create your workspace"}</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            {mode === "login"
              ? "Sign in to your enterprise workspace."
              : "Register a tenant admin account and get started."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "register" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tenant_name">Workspace name</Label>
                  <Input id="tenant_name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant_slug">Workspace slug (optional)</Label>
                  <Input id="tenant_slug" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company name</Label>
                  <Input id="company_name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin_name">Admin full name</Label>
                  <Input id="admin_name" value={adminName} onChange={(e) => setAdminName(e.target.value)} className="h-11" />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="tenant_slug">Workspace slug (optional)</Label>
                <Input id="tenant_slug" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} className="h-11" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "login" ? (
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => toast.info("Password reset link sent.")}> 
                    Forgot password?
                  </button>
                ) : null}
              </div>
              <div className="relative">
                <Input id="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
                        {mode === "login" ? (
              <div className="flex items-center gap-2 mt-2">
                <Checkbox id="remember" defaultChecked />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer text-muted-foreground">Remember me on this device</Label>
              </div>
            ) : (
              <div className="flex items-center space-x-2 mt-4">
                <Checkbox id="terms" required />
                <Label htmlFor="terms" className="text-sm font-normal text-muted-foreground leading-snug">
                  I agree to the <a href="#" className="text-indigo-600 hover:underline">Terms of Service</a> and <a href="#" className="text-indigo-600 hover:underline">Privacy Policy</a>.
                </Label>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11 text-base bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all font-medium mt-4">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Please wait...
                </div>
              ) : mode === "login" ? (
                "Sign in"
              ) : (
                "Create workspace"
              )}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground font-medium">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleOAuthLogin}
            disabled={!googleOAuthEnabled}
            className="w-full h-11 font-medium bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900 border-border"
          >
            <svg className="mr-2 size-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleButtonLabel}
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Don't have a workspace? " : "Already have a workspace? "}
            <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline">
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            By signing in you agree to our Terms of Service &amp; Privacy Policy.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
