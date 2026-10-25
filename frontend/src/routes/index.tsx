import { useState, useMemo, useRef, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BedDouble,
  Building2,
  Check,
  Dumbbell,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  Mail,
  Plus,
  Scissors,
  Shield,
  ShoppingBag,
  Sparkles,
  Store,
  UtensilsCrossed,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { platformService } from "@/services/platformService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BusinessOS — Unified Enterprise Portal Gateway" },
      {
        name: "description",
        content:
          "Single unified login gateway for all integrated business verticals: RestaurantOS, Salon & Spa, Gym & Fitness, Retail, Hotel, and Platform Super Admin.",
      },
    ],
  }),
  component: UnifiedGatewayPage,
});

export interface BusinessPortal {
  id: string;
  title: string;
  shortLabel: string;
  icon: typeof Shield;
  colorClass: string;
  activePillBg: string;
  glowClass: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  tagline: string;
  description: string;
  realm: "platform" | "auth";
  targetRoute: string;
  buttonLabel: string;
}

export const INTEGRATED_PORTALS: BusinessPortal[] = [
  {
    id: "super_admin",
    title: "Super Admin",
    shortLabel: "Super Admin",
    icon: Shield,
    colorClass: "text-red-600",
    activePillBg: "bg-[#991b1b] text-white shadow-xl shadow-red-900/20",
    glowClass: "from-[#991b1b] to-red-600 text-white",
    badgeBg: "bg-red-50/80",
    badgeBorder: "border-red-200/80",
    badgeText: "text-red-800",
    tagline: "Complete system control & administration",
    description:
      "Enterprise fleet oversight, multi-tenant provisioning, cross-vertical integration manifests, security policies, and global audit logs.",
    realm: "platform",
    targetRoute: "/platform",
    buttonLabel: "Sign In as Super Admin",
  },
  {
    id: "restaurant",
    title: "RestaurantOS",
    shortLabel: "Restaurant",
    icon: UtensilsCrossed,
    colorClass: "text-amber-600",
    activePillBg: "bg-amber-600 text-white shadow-xl shadow-amber-600/20",
    glowClass: "from-amber-600 to-orange-500 text-white",
    badgeBg: "bg-amber-50/80",
    badgeBorder: "border-amber-200/80",
    badgeText: "text-amber-800",
    tagline: "Dining, kitchen KDS, table floorplans & POS",
    description:
      "Full food service operating system with table floorplans, instant KOT dispatch, recipe BOMs, bar billing, and master inventory.",
    realm: "auth",
    targetRoute: "/dashboard",
    buttonLabel: "Sign In to RestaurantOS",
  },
  {
    id: "salon",
    title: "Salon & Spa OS",
    shortLabel: "Salon & Spa",
    icon: Scissors,
    colorClass: "text-violet-600",
    activePillBg: "bg-violet-600 text-white shadow-xl shadow-violet-600/20",
    glowClass: "from-violet-600 to-fuchsia-600 text-white",
    badgeBg: "bg-violet-50/80",
    badgeBorder: "border-violet-200/80",
    badgeText: "text-violet-800",
    tagline: "Stylist chairs, appointment booking & beauty care",
    description:
      "Real-time chair occupancy, appointments calendar, stylist commissions, and client treatment regimens.",
    realm: "auth",
    targetRoute: "/salon",
    buttonLabel: "Sign In to SalonOS",
  },
  {
    id: "gym",
    title: "Gym & Fitness OS",
    shortLabel: "Gym & Fitness",
    icon: Dumbbell,
    colorClass: "text-emerald-600",
    activePillBg: "bg-emerald-600 text-white shadow-xl shadow-emerald-600/20",
    glowClass: "from-emerald-600 to-teal-600 text-white",
    badgeBg: "bg-emerald-50/80",
    badgeBorder: "border-emerald-200/80",
    badgeText: "text-emerald-800",
    tagline: "Memberships, biometric access & workout schedules",
    description:
      "Live biometric turnstiles, trainer schedule booking, locker assignments, and membership subscriptions.",
    realm: "auth",
    targetRoute: "/gym",
    buttonLabel: "Sign In to GymOS",
  },
  {
    id: "retail",
    title: "Retail & Commerce OS",
    shortLabel: "Retail & Mart",
    icon: Store,
    colorClass: "text-indigo-600",
    activePillBg: "bg-indigo-600 text-white shadow-xl shadow-indigo-600/20",
    glowClass: "from-indigo-600 to-blue-600 text-white",
    badgeBg: "bg-indigo-50/80",
    badgeBorder: "border-indigo-200/80",
    badgeText: "text-indigo-800",
    tagline: "Barcode scanning, cash registers & supply chain",
    description:
      "High-speed barcode scanning, multi-lane checkout terminals, price-drop campaigns, and wholesale stock replenishments.",
    realm: "auth",
    targetRoute: "/retail",
    buttonLabel: "Sign In to RetailOS",
  },
  {
    id: "hotel",
    title: "Hotel & Hospitality OS",
    shortLabel: "Hotel & Resort",
    icon: BedDouble,
    colorClass: "text-sky-600",
    activePillBg: "bg-sky-600 text-white shadow-xl shadow-sky-600/20",
    glowClass: "from-sky-600 to-blue-500 text-white",
    badgeBg: "bg-sky-50/80",
    badgeBorder: "border-sky-200/80",
    badgeText: "text-sky-800",
    tagline: "Room reservations, front desk PMS & guest concierge",
    description:
      "Property Management System (PMS), keycard provisioning, housekeeping status, room service billing, and banquet booking.",
    realm: "auth",
    targetRoute: "/hotel",
    buttonLabel: "Sign In to HotelOS",
  },
];

const defaultPortal = INTEGRATED_PORTALS[0]!;

export function UnifiedGatewayPage() {
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);
  const [rotationOffset, setRotationOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ angle: number; currentOffset: number } | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const activePortal: BusinessPortal = INTEGRATED_PORTALS[selectedRoleIndex] ?? defaultPortal;
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();

  // Radial positioning: radius = 150px, center = 195px
  const dialRadius = 150;
  const centerPos = 195;

  const portalPositions = useMemo(() => {
    const total = INTEGRATED_PORTALS.length;
    return INTEGRATED_PORTALS.map((portal, idx) => {
      // Offset so the selected item sits on the right (0 deg)
      const baseAngle = (idx / total) * 360;
      const angleDeg = baseAngle + rotationOffset;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = centerPos + dialRadius * Math.cos(angleRad);
      const y = centerPos + dialRadius * Math.sin(angleRad);
      return { ...portal, idx, x, y, angleDeg };
    });
  }, [rotationOffset]);

  const selectPortal = (idx: number) => {
    setSelectedRoleIndex(idx);
    // Smoothly rotate the selected portal to the prominent right side (0 degrees)
    const total = INTEGRATED_PORTALS.length;
    const targetOffset = -((idx / total) * 360);
    setRotationOffset(targetOffset);
  };

  // Drag interaction for wheel
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    dragStartRef.current = { angle: startAngle, currentOffset: rotationOffset };
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current || !wheelRef.current) return;
      const rect = wheelRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const currentAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
      const delta = currentAngle - dragStartRef.current.angle;
      setRotationOffset(dragStartRef.current.currentOffset + delta);
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      setIsDragging(false);
      dragStartRef.current = null;
      // Snap to closest portal node
      const total = INTEGRATED_PORTALS.length;
      const step = 360 / total;
      const normalized = ((-rotationOffset % 360) + 360) % 360;
      const closestIdx = Math.round(normalized / step) % total;
      setSelectedRoleIndex(closestIdx);
      setRotationOffset(-(closestIdx * step));
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, rotationOffset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setSubmitting(true);
    try {
      if (activePortal.realm === "platform") {
        await platformService.login(email.trim(), password);
        toast.success(`Welcome to ${activePortal.title}`);
        navigate({ to: "/platform" });
      } else {
        await authLogin(email.trim(), password);
        toast.success(`Signed in to ${activePortal.title}`);
        navigate({ to: activePortal.targetRoute as any });
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        "Invalid login credentials for the selected portal";
      toast.error("Authentication Failed", {
        description: String(detail),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const ActiveIcon = activePortal.icon;

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] text-slate-900 flex flex-col justify-between selection:bg-slate-200">
      {/* Top Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="size-5" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Business<span className="text-indigo-600 font-black">OS</span>
            </span>
            <span className="ml-2 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-2xs">
              Universal Platform
            </span>
          </div>
        </div>

        <button
          onClick={() =>
            toast.info("Add New Industry Integration", {
              description:
                "Connect custom industry verticals: Pharmacy, Car Detailing, Education, Coworking.",
            })
          }
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
        >
          <Plus className="size-3.5 text-indigo-600" />
          <span>Add New Integration</span>
        </button>
      </header>

      {/* Main Stage */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-2 lg:py-6 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* ─────────────────────────────────────────────────────────────
              LEFT COLUMN: Circular Integrated Verticals Wheel
              ───────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start space-y-6">
            <div className="space-y-1 text-center lg:text-left">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Select Your Business Portal
              </h1>
              <p className="text-sm text-slate-500">
                Drag the wheel to select your portal
              </p>
            </div>

            {/* Circular Dial Wheel Stage */}
            <div
              ref={wheelRef}
              onMouseDown={handleMouseDown}
              className="relative size-[390px] sm:size-[420px] flex items-center justify-center select-none py-2 cursor-grab active:cursor-grabbing"
            >
              {/* Outer Circular Track */}
              <div className="absolute inset-4 rounded-full border-2 border-dashed border-slate-200/90 pointer-events-none" />
              <div className="absolute inset-16 rounded-full border border-slate-100 pointer-events-none" />

              {/* Center Wheel Hub */}
              <div className="absolute size-24 sm:size-28 rounded-full bg-white border border-slate-200/90 shadow-md flex flex-col items-center justify-center text-center p-2 z-10 pointer-events-none">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  BusinessOS
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Platform 360</span>
                <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-indigo-600">
                  <Sparkles className="size-2.5" /> All Modules
                </div>
              </div>

              {/* Radially Positioned Integration Nodes */}
              {portalPositions.map((node) => {
                const isSelected = node.idx === selectedRoleIndex;
                const NodeIcon = node.icon;

                return (
                  <div
                    key={node.id}
                    style={{
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      transform: "translate(-50%, -50%)",
                    }}
                    onClick={() => selectPortal(node.idx)}
                    className={cn(
                      "absolute transition-all duration-300 cursor-pointer z-20",
                      isSelected
                        ? "scale-105 z-30"
                        : "hover:scale-105 opacity-80 hover:opacity-100"
                    )}
                  >
                    {isSelected ? (
                      /* Active Selected Node Capsule with Indicator Pip */
                      <div
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-2xl px-4 py-3 font-semibold transition-all shadow-xl",
                          node.activePillBg
                        )}
                      >
                        <NodeIcon className="size-5 shrink-0" />
                        <span className="text-sm tracking-tight whitespace-nowrap">
                          {node.shortLabel}
                        </span>

                        {/* Visual indicator pip touching the outer ring */}
                        <span className="absolute -right-1.5 top-1/2 -translate-y-1/2 size-3 rounded-full bg-white border-2 border-current shadow-sm" />
                      </div>
                    ) : (
                      /* Inactive Clean Node Pill */
                      <div className="flex flex-col items-center justify-center size-14 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:border-slate-300 hover:shadow-md transition">
                        <NodeIcon className={cn("size-5", node.colorClass)} />
                        <span className="text-[10px] font-medium text-slate-600 mt-1 whitespace-nowrap">
                          {node.shortLabel}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected Integration Info Card at Bottom Left */}
            <div
              className={cn(
                "w-full max-w-md rounded-2xl border p-4 transition-all duration-300 flex items-start gap-3.5 shadow-xs",
                activePortal.badgeBg,
                activePortal.badgeBorder
              )}
            >
              <div className="size-10 rounded-xl bg-white/90 border border-current/20 flex items-center justify-center shrink-0 shadow-2xs">
                <ActiveIcon className={cn("size-5", activePortal.badgeText)} />
              </div>
              <div className="space-y-0.5 text-xs flex-1">
                <div className={cn("font-bold text-sm tracking-tight", activePortal.badgeText)}>
                  {activePortal.title}
                </div>
                <div className="text-slate-600 font-medium">{activePortal.tagline}</div>
                <p className="text-slate-500 leading-relaxed text-[11px] mt-0.5">
                  {activePortal.description}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-400 pl-1">
              Need help?{" "}
              <a href="mailto:support@businessos.local" className="hover:underline text-slate-600">
                Contact Support
              </a>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              RIGHT COLUMN: Dedicated Floating Login Card
              ───────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-[420px] rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-9 shadow-xl shadow-slate-200/50 space-y-6">
              {/* Header with Portal Icon Badge */}
              <div className="text-center space-y-2">
                <div
                  className={cn(
                    "mx-auto size-14 rounded-2xl bg-gradient-to-tr flex items-center justify-center shadow-lg transition-all duration-300",
                    activePortal.glowClass
                  )}
                >
                  <ActiveIcon className="size-7" />
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    {activePortal.title} Login
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter your credentials to access your portal
                  </p>
                </div>
              </div>

              {/* Clean Login Form (No Exposed Credentials) */}
              <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                {/* Email Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="portal-email" className="text-xs font-semibold text-slate-700">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 size-4 text-slate-400" />
                    <Input
                      id="portal-email"
                      type="email"
                      placeholder="name@business.com"
                      className="pl-10 h-10 text-sm bg-slate-50/70 border-slate-200 focus:bg-white"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="portal-password"
                      className="text-xs font-semibold text-slate-700"
                    >
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() =>
                        toast.info("Password Recovery", {
                          description:
                            "Contact your business administrator to reset credentials.",
                        })
                      }
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 size-4 text-slate-400" />
                    <Input
                      id="portal-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      className="pl-10 pr-10 h-10 text-sm bg-slate-50/70 border-slate-200 focus:bg-white"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600/25"
                    />
                    Remember me
                  </label>

                  <span className="text-[11px] font-mono text-slate-400">
                    Realm: {activePortal.realm === "platform" ? "platform" : "tenant_auth"}
                  </span>
                </div>

                {/* Submit Action Button */}
                <Button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    "w-full h-11 text-sm font-semibold transition-all shadow-md mt-2 flex items-center justify-center gap-2",
                    activePortal.activePillBg
                  )}
                >
                  {submitting ? (
                    "Authenticating..."
                  ) : (
                    <>
                      <span>{activePortal.buttonLabel}</span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Bottom Support & Access Links */}
              <div className="border-t border-slate-100 pt-3 text-center space-y-2 text-xs text-slate-500">
                <p>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() =>
                      toast("Request Portal Access", {
                        description:
                          "Contact your company administrator to obtain module login credentials.",
                      })
                    }
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    Request Access
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
        <div>© 2026 BusinessOS & RestaurantOS. Universal Multi-Vertical Operating System.</div>
        <div className="flex items-center gap-4">
          <span>Enterprise Security</span>
          <span>Privacy Policy</span>
          <span>Documentation</span>
        </div>
      </footer>
    </div>
  );
}
