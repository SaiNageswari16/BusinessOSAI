import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Eye, EyeOff, Sparkles, Building2, Mail, Lock, Shield, Headset, ShieldCheck, Award, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, resolvePostAuthRoute } from "@/contexts/auth-context";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const { login, register, isAuthed, user, authReady } = useAuth();
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

  if (!authReady) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center relative bg-slate-900 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      >
        <div className="size-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col relative bg-slate-900 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      
      {/* Top Header Logo */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-8 flex items-center gap-3">
        <div className="size-8 sm:size-10 rounded-xl bg-white backdrop-blur-md grid place-items-center shadow-lg">
          <Sparkles className="size-5 sm:size-6 text-indigo-600" />
        </div>
        <div>
          <div className="font-bold text-base sm:text-lg tracking-tight text-white">BusinessOS AI</div>
          <div className="hidden sm:block text-[10px] text-blue-200 uppercase tracking-wider font-semibold">Enterprise Operating System</div>
        </div>
      </div>

      {/* Main Content Area - Centered Login Card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div 
          className="w-full max-w-[440px] rounded-3xl bg-white/95 backdrop-blur-xl p-8 sm:p-10 shadow-2xl border border-white/50 animate-in fade-in zoom-in-95 duration-500"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="size-12 text-indigo-600 grid place-items-center mb-2">
              <Sparkles className="size-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {mode === "login" ? "Welcome back" : "Create workspace"}
            </h2>
            <p className="mt-2 text-slate-500 text-sm font-medium">
              {mode === "login"
                ? "Sign in to your enterprise workspace"
                : "Register a tenant admin account"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" ? (
              <>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="size-4" />
                  </div>
                  <Input id="tenant_name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Workspace Name" className="h-11 pl-10 bg-slate-50 border-slate-200" />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="size-4" />
                  </div>
                  <Input id="tenant_slug" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} placeholder="workspace-slug" className="h-11 pl-10 bg-slate-50 border-slate-200" />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="size-4" />
                  </div>
                  <Input id="admin_name" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Admin full name" className="h-11 pl-10 bg-slate-50 border-slate-200" />
                </div>
              </>
            ) : (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="size-4" />
                </div>
                <Input id="tenant_slug" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} placeholder="your-workspace" className="h-11 pl-10 bg-slate-50 border-slate-200" />
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="size-4" />
              </div>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="h-11 pl-10 bg-slate-50 border-slate-200" />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="size-4" />
              </div>
              <Input id="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="h-11 pl-10 pr-10 bg-slate-50 border-slate-200" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {mode === "login" ? (
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <Checkbox id="remember" defaultChecked className="border-slate-300 data-[state=checked]:bg-indigo-600" />
                  <Label htmlFor="remember" className="text-sm font-medium cursor-pointer text-slate-600">Remember me</Label>
                </div>
                <button type="button" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline" onClick={() => toast.info("Password reset link sent.")}> 
                  Forgot password?
                </button>
              </div>
            ) : (
              <div className="flex items-start space-x-2 mt-4">
                <Checkbox id="terms" required className="border-slate-300 mt-0.5" />
                <Label htmlFor="terms" className="text-sm font-medium text-slate-600 leading-snug">
                  I agree to the <a href="#" className="text-indigo-600 hover:underline">Terms of Service</a> and <a href="#" className="text-indigo-600 hover:underline">Privacy Policy</a>.
                </Label>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11 text-base bg-[#2548C9] hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 transition-all font-medium mt-6 rounded-xl">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Please wait...
                </div>
              ) : mode === "login" ? (
                "Sign in →"
              ) : (
                "Create workspace →"
              )}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest text-slate-400">
              <span className="bg-white px-3">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Button type="button" variant="outline" onClick={handleOAuthLogin} disabled={!googleOAuthEnabled} className="h-11 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl">
              <svg className="size-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </Button>
            {/* Fake Microsoft, GitHub, Azure buttons for UI matching */}
            <Button type="button" variant="outline" className="h-11 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl" onClick={() => toast.info("Coming soon")}>
              <svg className="size-5" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
            </Button>
            <Button type="button" variant="outline" className="h-11 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl" onClick={() => toast.info("Coming soon")}>
              <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </Button>
            <Button type="button" variant="outline" className="h-11 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl" onClick={() => toast.info("Coming soon")}>
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </Button>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500 font-medium">
            {mode === "login" ? "Don't have a workspace? " : "Already have a workspace? "}
            <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="font-bold text-slate-700 hover:text-slate-900 hover:underline">
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>

          <p className="mt-4 text-center text-[11px] text-slate-400">
            By signing in, you agree to our <a href="#" className="font-medium hover:text-slate-600">Terms of Service</a> &amp; <a href="#" className="font-medium hover:text-slate-600">Privacy Policy</a>.
          </p>
        </div>
      </div>

    </div>
  );
}

