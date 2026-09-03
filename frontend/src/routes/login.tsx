import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Sparkles, ShieldCheck, Zap, BarChart3, ArrowLeft, Fingerprint, ScanFace, Usb, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, resolvePostAuthRoute } from "@/contexts/auth-context";
import { passkeysApi, fingerprintsApi } from "@/lib/api-client";
import { isBiometricsSupported, getBiometricAssertion } from "@/lib/webauthn";
import { discoverRDService, captureFingerprint } from "@/lib/rd-service";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, register, loginWithToken, isAuthed, user } = useAuth();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as { mode?: string };
  const initialRedirectTriedRef = useRef(false);
  const [mode, setMode] = useState<"login" | "register">(searchParams?.mode === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>(["inventory", "pos"]);
  const [registrationSuccess, setRegistrationSuccess] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(true);

  useEffect(() => {
    isBiometricsSupported().then(setBiometricsAvailable);
  }, []);

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
      if (mode === "login") {
        const result = await login({ email, password, tenant_slug: tenantSlug || undefined });
        toast.success("Signed in successfully");
        navigate({ to: resolvePostAuthRoute(result.user, result.token) });
      } else {
        const res = await fetch(`${API_BASE_URL}/auth/register-tenant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_name: tenantName,
            tenant_slug: tenantSlug || undefined,
            admin_name: adminName,
            admin_email: email,
            admin_password: password,
            company_name: companyName,
            requested_modules: selectedModules,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Registration failed");
        }

        const json = await res.json();
        setRegistrationSuccess(json.message || "Registration submitted for System Admin approval.");
        toast.success("Registration submitted for approval!");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };


  const handleBiometricLogin = async () => {
    if (!email) {
      toast.error("Please enter your work email to initiate biometric login.");
      return;
    }
    setLoading(true);
    try {
      const options = await passkeysApi.getLoginOptions(email, tenantSlug || undefined);
      toast.info("Please scan your fingerprint or Face ID on your device sensor...");
      const assertion = await getBiometricAssertion(options);
      const token = await passkeysApi.verifyLogin({
        email,
        credential_id: assertion.credential_id,
        client_data_json: assertion.client_data_json,
        authenticator_data: assertion.authenticator_data,
        signature: assertion.signature,
        tenant_slug: tenantSlug || undefined,
      });
      toast.success("Biometric verification successful! Logging you in...");
      const result = await loginWithToken(token);
      navigate({ to: resolvePostAuthRoute(result.user, result.token) });
    } catch (error: any) {
      console.error("Biometric login error:", error);
      const message = error?.message || "Biometric authentication was cancelled or failed.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpticalFingerprintLogin = async () => {
    setLoading(true);
    try {
      toast.info("Discovering connected USB Fingerprint Scanner (Mantra / Morpho / SecuGen)...");
      const device = await discoverRDService();

      toast.info(`Please place your registered finger firmly on the ${device.model} scanner glass...`);
      const capture = await captureFingerprint(device);

      if (!capture.success) {
        toast.error(capture.error || "Fingerprint capture failed. Please try again.");
        return;
      }

      toast.info(`Fingerprint captured (${capture.quality}% match quality). Authenticating...`);
      const token = await fingerprintsApi.verifyLogin({
        email: email ? email.trim() : undefined,
        template_iso: capture.templateIso,
        tenant_slug: tenantSlug ? tenantSlug.trim() : undefined,
      });

      toast.success("Fingerprint verified! Logging into your workspace...");
      const result = await loginWithToken(token);
      navigate({ to: resolvePostAuthRoute(result.user, result.token) });
    } catch (error: any) {
      console.error("Optical fingerprint login error:", error);
      toast.error(error?.message || "Fingerprint verification failed. Please check scanner connection.");
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
    <div className="min-h-screen grid items-stretch lg:grid-cols-2 bg-white relative">
      {/* Top Left Navigation Back to Public Site */}
      <button 
        onClick={() => navigate({ to: "/" })}
        className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 bg-white/90 backdrop-blur-md rounded-xl border border-slate-200 shadow-xs hover:bg-slate-50 transition"
      >
        <ArrowLeft className="size-4 text-purple-700" />
        Back to Website
      </button>

      {/* Left — brand panel */}
      <div className="relative hidden lg:flex flex-col p-12 lg:px-16 xl:px-24 overflow-hidden bg-slate-50 text-slate-900 border-r border-slate-200/60">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-purple-400/25 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[0%] right-[0%] w-[70%] h-[70%] rounded-full bg-emerald-400/25 blur-[120px] pointer-events-none" />
        <div className="absolute top-[40%] right-[10%] w-[40%] h-[40%] rounded-full bg-amber-400/20 blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col flex-1 justify-center">
          <div className="flex items-center gap-5 mb-12 cursor-pointer" onClick={() => navigate({ to: "/" })}>
            <div className="size-20 shrink-0 flex items-center justify-center transition-transform hover:scale-105">
              <img src="/Logo.png" alt="LazyMonkeyAI Logo" className="size-full object-contain drop-shadow-sm" />
            </div>
            <div>
              <div className="font-extrabold text-3xl tracking-tight text-slate-900"><span className="text-purple-700">Lazy</span>Monkey<span className="text-emerald-600">AI</span></div>
              <div className="text-xs font-semibold mt-1 flex items-center gap-1">
                <span className="text-slate-600 font-medium">Smart</span>
                <span className="text-emerald-600 font-extrabold">AI</span>
                <span className="text-slate-600 font-medium">for</span>
                <span className="text-amber-600 font-bold">Lazy Geniuses</span>
              </div>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-4xl xl:text-5xl font-bold leading-[1.15] tracking-tight">
              One platform.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-700 via-purple-600 to-emerald-600">Every part of your business.</span>
            </h1>
            <p className="mt-6 text-slate-600 text-base xl:text-lg leading-relaxed max-w-md">
              ERP, POS, Inventory, CRM, HRMS, IoT and Accounting — unified by an AI copilot that thinks across your entire operation.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-4 max-w-md">
              {[
                { icon: Zap, t: "AI Copilot trained on your data" },
                { icon: BarChart3, t: "Realtime analytics across 350+ KPIs" },
                { icon: ShieldCheck, t: "SOC 2 Type II • ISO 27001 • GDPR" },
              ].map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-4 rounded-xl bg-white/80 backdrop-blur-md px-5 py-4 ring-1 ring-slate-200/50 shadow-xs hover:bg-white transition-colors">
                  <f.icon className="size-5 shrink-0 text-purple-700" />
                  <span className="text-sm font-medium text-slate-700">{f.t}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 text-xs font-medium text-slate-500 mt-8">
          Trusted by 8,200+ companies across 47 countries.
        </div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center p-6 sm:p-12 relative bg-white">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[400px]">
          {/* Mobile Logo */}
          <div className="flex lg:hidden flex-col items-center justify-center text-center space-y-3 mb-8 cursor-pointer" onClick={() => navigate({ to: "/" })}>
            <div className="size-24 shrink-0 flex items-center justify-center">
              <img src="/Logo.png" alt="LazyMonkeyAI Logo" className="size-full object-contain drop-shadow-sm" />
            </div>
            <span className="font-bold text-3xl tracking-tight text-slate-900">LazyMonkey<span className="text-emerald-600">AI</span></span>
          </div>

          <div className="text-center lg:text-left mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">{mode === "login" ? "Welcome back" : "Create workspace"}</h2>
            <p className="mt-2 text-slate-500 text-sm">
              {mode === "login"
                ? "Sign in to your enterprise workspace."
                : "Register a tenant admin account and get started."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "register" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tenant_name" className="text-sm font-medium text-slate-700">Workspace name</Label>
                  <Input id="tenant_name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-purple-600" placeholder="e.g. Acme Enterprise" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant_slug" className="text-sm font-medium text-slate-700">Workspace slug <span className="text-slate-400 font-normal">(optional)</span></Label>
                  <Input id="tenant_slug" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-purple-600" placeholder="e.g. acme-corp" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name" className="text-sm font-medium text-slate-700">Company name</Label>
                  <Input id="company_name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-purple-600" placeholder="Acme Corporation Ltd." required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin_name" className="text-sm font-medium text-slate-700">Admin full name</Label>
                  <Input id="admin_name" value={adminName} onChange={(e) => setAdminName(e.target.value)} className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-purple-600" placeholder="John Doe" required />
                </div>

                {/* Module Entitlement Selector */}
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Select modules for workspace</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[
                      { id: "inventory", label: "Inventory & RAG" },
                      { id: "pos", label: "POS & Checkout" },
                      { id: "erp", label: "Core ERP" },
                      { id: "accounting", label: "Accounting" },
                      { id: "crm", label: "CRM & Support" },
                      { id: "hrms", label: "HRMS & Payroll" },
                      { id: "procurement", label: "Procurement" },
                      { id: "iot", label: "IoT & Hardware" },
                    ].map((mod) => {
                      const isChecked = selectedModules.includes(mod.id);
                      return (
                        <div
                          key={mod.id}
                          onClick={() => {
                            setSelectedModules((prev) =>
                              isChecked ? prev.filter((m) => m !== mod.id) : [...prev, mod.id]
                            );
                          }}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                            isChecked
                              ? "bg-purple-50 border-purple-300 text-purple-900 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Checkbox checked={isChecked} className="data-[state=checked]:bg-purple-700 data-[state=checked]:border-purple-700" />
                          <span>{mod.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="tenant_slug" className="text-sm font-medium text-slate-700">Workspace / Tenant ID <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input id="tenant_slug" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-purple-600" placeholder="e.g. acme-corp" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">Work email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-purple-600" placeholder="you@company.com" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
                {mode === "login" ? (
                  <button type="button" className="text-sm font-medium text-purple-700 hover:text-purple-800" onClick={() => toast.info("Password reset link sent.")}>
                    Forgot password?
                  </button>
                ) : null}
              </div>
              <div className="relative">
                <Input id="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 pr-10 bg-slate-50/50 border-slate-200 focus-visible:ring-purple-600" placeholder="••••••••" required />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            
            {mode === "login" ? (
              <div className="flex items-center gap-2 pt-1">
                <Checkbox id="remember" defaultChecked className="border-slate-300 data-[state=checked]:bg-purple-700 data-[state=checked]:border-purple-700" />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer text-slate-600">Remember me for 30 days</Label>
              </div>
            ) : (
              <div className="flex items-start space-x-2 pt-2">
                <Checkbox id="terms" required className="mt-0.5 border-slate-300 data-[state=checked]:bg-purple-700 data-[state=checked]:border-purple-700" />
                <Label htmlFor="terms" className="text-sm font-normal text-slate-600 leading-snug">
                  I agree to the <a href="#" className="font-medium text-purple-700 hover:text-purple-800">Terms of Service</a> and <a href="#" className="font-medium text-purple-700 hover:text-purple-800">Privacy Policy</a>.
                </Label>
              </div>
            )}

            <Button type="submit" disabled={loading || (mode === "register" && selectedModules.length === 0)} className="w-full h-11 text-base gradient-brand hover:opacity-95 text-white shadow-xs transition-all font-semibold mt-2 border-0">
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Please wait...
                </div>
              ) : mode === "login" ? (
                "Sign in with Password"
              ) : (
                "Submit Registration for Approval"
              )}
            </Button>

            {mode === "login" && (
              <div className="space-y-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBiometricLogin}
                  disabled={loading}
                  className="w-full h-10 text-xs font-semibold border-purple-300/80 bg-purple-50/70 hover:bg-purple-100 text-purple-900 shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Fingerprint className="size-4 text-purple-700 animate-pulse" />
                  Sign in with Touch ID / Face ID / Windows Hello
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpticalFingerprintLogin}
                  disabled={loading}
                  className="w-full h-10 text-xs font-semibold border-emerald-300/80 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Usb className="size-4 text-emerald-600 animate-bounce" />
                  Login with USB Scanner (Mantra / Morpho / SecuGen)
                </Button>
              </div>
            )}
          </form>

          <div className="relative my-8">

            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-500 font-medium tracking-wider">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleOAuthLogin}
            disabled={!googleOAuthEnabled}
            className="w-full h-11 font-medium bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm"
          >
            <svg className="mr-2 size-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleButtonLabel}
          </Button>

          <p className="mt-8 text-center text-sm text-slate-600">
            {mode === "login" ? "Don't have a workspace? " : "Already have a workspace? "}
            <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="font-semibold text-purple-700 hover:text-purple-800 hover:underline transition-colors">
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>

      {registrationSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border rounded-2xl shadow-2xl p-6 max-w-md text-center space-y-4">
            <div className="size-14 rounded-full bg-amber-100 text-amber-600 grid place-items-center mx-auto text-2xl font-bold">
              ⏳
            </div>
            <h2 className="text-xl font-bold text-slate-900">Registration Submitted!</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {registrationSuccess}
            </p>
            <div className="p-3 rounded-lg bg-slate-50 text-xs text-slate-500 font-mono text-left">
              <strong>Requested Modules:</strong> {selectedModules.join(", ").toUpperCase()}
            </div>
            <Button
              onClick={() => {
                setRegistrationSuccess(null);
                setMode("login");
              }}
              className="w-full h-10 gradient-brand text-white font-bold"
            >
              Return to Login
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

