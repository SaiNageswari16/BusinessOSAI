"use client";

import React, { useState } from "react";
import {
  Dumbbell,
  Users,
  UserCheck,
  Calendar,
  CreditCard,
  Fingerprint,
  Apple,
  Store,
  ShoppingCart,
  Share2,
  BarChart3,
  HeartPulse,
  Layers,
  Settings,
  Megaphone,
  Boxes,
  Crown,
  Building2,
  Building,
  Headphones,
  Smartphone,
  Sparkles,
  ArrowRight,
  Play,
  Coins,
  Trophy,
  Zap,
  CheckCircle2,
  X,
  Send,
  Cpu,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Clock,
  Scan,
  Activity,
  FileSpreadsheet,
  Lock,
  Wifi,
  SmartphoneNfc,
  Printer,
  Sparkle,
  Cloud,
  CalendarCheck,
  Flower2,
} from "lucide-react";
import { type ProductItem } from "@/data/products";

// 6 Floating Feature Cards for Hero Section (Custom dynamic sculpted tabs)
const heroFeatureCards = [
  {
    id: "memberships",
    title: "Memberships",
    subtitle: "Onboard, manage & retain members",
    icon: Users,
    badge: "Core",
    targetDomainIdx: 0,
    accentGrad: "from-purple-500 to-indigo-600",
  },
  {
    id: "workouts",
    title: "Workouts & Plans",
    subtitle: "Create programs & track progress",
    icon: CalendarCheck,
    badge: "AI Plan",
    targetDomainIdx: 1,
    accentGrad: "from-indigo-500 to-purple-600",
  },
  {
    id: "billing",
    title: "Billing & POS",
    subtitle: "Subscriptions, packages & payments",
    icon: CreditCard,
    badge: "Billing",
    targetDomainIdx: 3,
    accentGrad: "from-purple-600 to-pink-600",
  },
  {
    id: "access",
    title: "Access & Turnstiles",
    subtitle: "Secure, automated gym entry",
    icon: Smartphone,
    badge: "IoT Pass",
    targetDomainIdx: 2,
    accentGrad: "from-violet-600 to-indigo-600",
  },
  {
    id: "hrms",
    title: "HRMS",
    subtitle: "Staff, attendance & payroll",
    icon: UserCheck,
    badge: "Payroll",
    targetDomainIdx: 4,
    accentGrad: "from-indigo-600 to-purple-600",
  },
  {
    id: "nutrition",
    title: "Nutrition",
    subtitle: "Diet plans & wellness tracking",
    icon: Apple,
    badge: "Macros",
    targetDomainIdx: 1,
    accentGrad: "from-fuchsia-600 to-purple-600",
  },
];

// 4 Business Verticals for Hero bottom dark pill bar
const heroBusinessTypes = [
  { label: "Gyms", icon: Dumbbell },
  { label: "Fitness Studios", icon: Flower2 },
  { label: "Wellness Centers", icon: Activity },
  { label: "Multi-Branch Operations", icon: Layers },
];

// Stats Bar Data
const kpiStats = [
  {
    icon: Users,
    iconBg: "bg-purple-100 text-purple-700",
    value: "1,248+",
    label: "Active Members",
    subtext: "Live on Mobile & RFID",
    badge: "↑ +12%",
    badgeColor: "text-emerald-600",
  },
  {
    icon: Fingerprint,
    iconBg: "bg-blue-100 text-blue-700",
    value: "342",
    label: "Today's Check-ins",
    subtext: "Sub-second gate sync",
    badge: "↑ +8%",
    badgeColor: "text-emerald-600",
  },
  {
    icon: Coins,
    iconBg: "bg-pink-100 text-pink-700",
    value: "₹8,24,000",
    label: "Monthly Revenue",
    subtext: "Memberships & shake bar",
    badge: "↑ +15%",
    badgeColor: "text-emerald-600",
  },
  {
    icon: Building2,
    iconBg: "bg-purple-100 text-purple-700",
    value: "6",
    label: "Active Branches",
    subtext: "Centralized HQ oversight",
    badge: null,
  },
  {
    icon: Trophy,
    iconBg: "bg-amber-100 text-amber-700",
    value: "96%",
    label: "Member Retention",
    subtext: "Automated WhatsApp nudge",
    badge: "Top 2%",
    badgeColor: "text-purple-600",
  },
  {
    icon: Zap,
    iconBg: "bg-purple-100 text-purple-700",
    value: "99.9%",
    label: "System Uptime",
    subtext: "Real-time edge gateway",
    badge: "Enterprise",
    badgeColor: "text-purple-700",
  },
];

// 6 Connected Lifecycle Steps
const lifecycleSteps = [
  {
    num: "01",
    title: "Leads & Enquiries",
    subtitle: "Capture, nurture & track prospects via WhatsApp CRM",
    icon: Users,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    outcome: "40% faster conversion",
  },
  {
    num: "02",
    title: "Membership & Onboarding",
    subtitle: "Trial, KYC, digital agreements & payment gateway",
    icon: CreditCard,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    outcome: "Paperless enrollment",
  },
  {
    num: "03",
    title: "Check-in & Turnstiles",
    subtitle: "Biometric, Face ID, QR passes & smart locker sync",
    icon: Fingerprint,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    outcome: "Zero desk queues",
  },
  {
    num: "04",
    title: "Training & Nutrition",
    subtitle: "AI workout routines, macro food scanner & coach logs",
    icon: Dumbbell,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    outcome: "Personalized care",
  },
  {
    num: "05",
    title: "Billing & Supplements",
    subtitle: "POS counter, protein bar inventory & GST invoicing",
    icon: Store,
    color: "text-pink-600 bg-pink-50 border-pink-200",
    outcome: "Instant UPI receipts",
  },
  {
    num: "06",
    title: "Staff & Retention",
    subtitle: "Trainer commissions, staff payroll & renewal churn alerts",
    icon: UserCheck,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    outcome: "Maximized renewals",
  },
];

// Interactive Deep Dive Modules
const deepDiveDomains = [
  {
    id: "members-app",
    title: "Member Journey & Mobile Pass",
    badge: "Client Experience",
    headline: "Seamless Digital Onboarding & iOS/Android Member App",
    desc: "Empower members with branded mobile passes, turnstile entry QR codes, digital workout logs, and one-click renewal payments over WhatsApp.",
    bullets: [
      "Dynamic QR and digital NFC pass for turnstile door access",
      "Automated WhatsApp fee renewal reminders with UPI 1-click payment",
      "Personalized workout schedules, trainer bookings and slot reservation",
      "InBody body fat, BMI, muscle mass progress comparison charts",
    ],
    metricValue: "96%",
    metricLabel: "Member Retention Rate",
    mockupTitle: "Mobile Member Dashboard",
    mockupBadge: "Live App Sync",
    mockupStats: [
      { label: "Active Plan", val: "Annual Platinum VIP" },
      { label: "Expires in", val: "148 Days" },
      { label: "Check-in Streak", val: "18 Days" },
      { label: "Assigned Coach", val: "Vikram S." },
    ],
  },
  {
    id: "ai-workout-diet",
    title: "AI Workouts & Nutrition Vision",
    badge: "AI Powered",
    headline: "Instant Camera Food Scanning & Smart Training Engine",
    desc: "Members take a photo of their meals to instantly log calories, proteins, and carbs. Trainers create and assign custom regimens with an exercise video library.",
    bullets: [
      "Photo Food Scanner analyzes calories, macronutrients, and portions",
      "AI Workout Planner tailored to hypertrophy, fat loss, or strength",
      "Pre-loaded library of 650+ HD animated exercise demonstrations",
      "Trainer assignment with real-time feedback and adherence telemetry",
    ],
    metricValue: "< 3s",
    metricLabel: "AI Meal Recognition",
    mockupTitle: "Smart Food & Calorie Scan",
    mockupBadge: "Vision AI v2.4",
    mockupStats: [
      { label: "Detected Meal", val: "Grilled Chicken & Quinoa" },
      { label: "Calories", val: "480 kcal" },
      { label: "Protein", val: "42g Protein" },
      { label: "Accuracy", val: "99.2% Match" },
    ],
  },
  {
    id: "biometric-turnstile",
    title: "Biometric & Turnstiles",
    badge: "IoT Gateway",
    headline: "Hardware-Integrated Biometric Turnstile & Anti-Passback Gate Control",
    desc: "Connect seamlessly with eSSL, ZKTeco, and Hikvision turnstiles, face recognition cameras, and smart turnstiles to prevent unpaid gym access.",
    bullets: [
      "Direct integration with eSSL, ZKTeco, Hikvision, and RFID barriers",
      "Anti-passback prevention stops members from sharing passes or entry cards",
      "Live gym floor occupancy meter displays current crowd density",
      "Automated access lock when membership expires or payment is overdue",
    ],
    metricValue: "0.28s",
    metricLabel: "Gate Unlock Latency",
    mockupTitle: "Turnstile Access Controller",
    mockupBadge: "LAN / Cloud Sync",
    mockupStats: [
      { label: "Device Status", val: "Online (eSSL Flap-4)" },
      { label: "Today's Scans", val: "342 Successful" },
      { label: "Unpaid Rejected", val: "7 Passbacks Blocked" },
      { label: "Floor Occupancy", val: "46 / 80 Capacity" },
    ],
  },
  {
    id: "pos-supplements",
    title: "POS, Supplements & Billing",
    badge: "Revenue Engine",
    headline: "High-Speed Billing, Shake Bar Inventory & GST Invoicing",
    desc: "Run front-desk merchandise, supplements, energy drinks, and personal training sales with split payments (UPI, Cards, Cash) and automatic GST invoices.",
    bullets: [
      "Fast touch-friendly POS checkout with barcode scanner support",
      "Multi-warehouse supplement stock tracking with expiry batch alerts",
      "Split payments across Cash, PineLabs/EDC Card, and UPI QR",
      "Instant WhatsApp & thermal printed GST invoices with tax summary",
    ],
    metricValue: "100%",
    metricLabel: "GST & Tax Compliant",
    mockupTitle: "Front-Desk POS Terminal",
    mockupBadge: "PineLabs & UPI Ready",
    mockupStats: [
      { label: "Total Today", val: "₹48,500 Sales" },
      { label: "Top Product", val: "Whey Isolate 2kg" },
      { label: "Payment Split", val: "78% UPI • 22% Card" },
      { label: "Invoice Speed", val: "Under 6 Seconds" },
    ],
  },
  {
    id: "hrms-multibranch",
    title: "HRMS, Payroll & Multi-Branch HQ",
    badge: "Franchise Scale",
    headline: "Trainer Commission Splits, Shift Rosters & Consolidated HQ Analytics",
    desc: "Automate trainer payouts per personal training session, manage staff biometric shifts, and compare multi-branch performance from a central headquarters portal.",
    bullets: [
      "Automated trainer commission calculations based on completed sessions",
      "Biometric staff attendance with shift scheduling and leave tracking",
      "Multi-branch master control with centralized membership roaming",
      "Consolidated P&L, expense vouchers, and GSTR export sheets",
    ],
    metricValue: "10+",
    metricLabel: "Branches per Master Tenant",
    mockupTitle: "Multi-Branch HQ Control",
    mockupBadge: "Consolidated View",
    mockupStats: [
      { label: "Active Locations", val: "6 City Branches" },
      { label: "Total Members", val: "4,820 Across Network" },
      { label: "Trainer Payouts", val: "₹1,42,000 Calculated" },
      { label: "Top Branch", val: "Indiranagar (114% Goal)" },
    ],
  },
];

// 12 Comprehensive Modules & Features
const modulesList = [
  {
    title: "Member Management & CRM",
    category: "CRM & Retention",
    icon: Users,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    bullets: [
      "360° member digital profiles & history",
      "Flexible plans, freeze & renewal queues",
      "Automated lead capture & inquiry follow-ups",
      "Instant WhatsApp alerts & renewal links",
    ],
  },
  {
    title: "Workout & Training Engine",
    category: "Training Ops",
    icon: Dumbbell,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    bullets: [
      "AI workout plan generator by fitness goals",
      "Trainer slot scheduling & PT session booking",
      "Progress tracking, weight & PR milestone logs",
      "Exercise video library with 650+ routines",
    ],
  },
  {
    title: "Nutrition & AI Food Scanner",
    category: "AI Health",
    icon: Apple,
    color: "text-rose-600 bg-rose-50 border-rose-200",
    bullets: [
      "Photo food scan to detect calories & macros",
      "Custom diet plan builder with vegetarian options",
      "Daily water & calorie intake tracking reminders",
      "Targeted nutrition plans for cutting & bulking",
    ],
  },
  {
    title: "InBody & Health Metric Sync",
    category: "IoT Diagnostics",
    icon: HeartPulse,
    color: "text-pink-600 bg-pink-50 border-pink-200",
    bullets: [
      "OCR upload of InBody scan sheets (270 / 370)",
      "Body composition (muscle, visceral fat, BMI)",
      "Interactive progress comparison graphs",
      "Goal-based automated trainer recommendations",
    ],
  },
  {
    title: "Biometric & Access Control",
    category: "Hardware Gate",
    icon: Fingerprint,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    bullets: [
      "eSSL, ZKTeco, Hikvision turnstile gate sync",
      "Facial recognition, QR & RFID card check-in",
      "Anti-passback prevention & live capacity count",
      "Real-time attendance logs & unauthorized alerts",
    ],
  },
  {
    title: "POS & Supplements Counter",
    category: "Retail Billing",
    icon: Store,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    bullets: [
      "Fast checkout with barcode scanner support",
      "Sell protein powders, gear & apparel",
      "GST invoices, split UPI / Card payments",
      "PineLabs, PayTM EDC & thermal print ready",
    ],
  },
  {
    title: "HRMS & Trainer Payroll",
    category: "Workforce",
    icon: UserCheck,
    color: "text-pink-600 bg-pink-50 border-pink-200",
    bullets: [
      "Staff directory, shift rosters & biometric logs",
      "Automated trainer commissions per PT session",
      "Salary, PF, ESI, TDS calculations & payslips",
      "Leave approval workflows & duty rosters",
    ],
  },
  {
    title: "Multi-Branch & Franchise HQ",
    category: "Enterprise Scale",
    icon: Share2,
    color: "text-sky-600 bg-sky-50 border-sky-200",
    bullets: [
      "Centralized multi-gym master dashboard",
      "Cross-gym access & roaming membership rules",
      "Branch-wise revenue, attendance & P&L benchmarking",
      "Franchise fee, billing & quota management",
    ],
  },
  {
    title: "Analytics & Business Reports",
    category: "Business Intelligence",
    icon: BarChart3,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    bullets: [
      "Revenue, member growth & churn forecast",
      "Peak floor occupancy & equipment utilization",
      "Trainer performance, ratings & commission report",
      "P&L, cashbook & 1-click GSTR tax exports",
    ],
  },
  {
    title: "Inventory & Warehouse Stock",
    category: "Supply Chain",
    icon: Boxes,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    bullets: [
      "Supplements & retail stock batch/expiry alerts",
      "Multi-store & central warehouse stock transfers",
      "Purchase orders & vendor payment ledgers",
      "Auto-replenishment notifications at minimum levels",
    ],
  },
  {
    title: "Marketing & Engagement",
    category: "Growth & Retention",
    icon: Megaphone,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    bullets: [
      "Branded WhatsApp & SMS broadcast campaigns",
      "Member referral bonuses & reward points",
      "Automated birthday & milestone congratulations",
      "Fitness challenge leaderboard & gym events",
    ],
  },
  {
    title: "Settings & System Integrations",
    category: "Security & Cloud",
    icon: Settings,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    bullets: [
      "Flexible GST, SAC code & fee plan configuration",
      "Direct API connectors for eSSL, ZK & CCTV IoT",
      "Razorpay, Cashfree & Stripe payment gateways",
      "Granular RBAC role permissions & security logs",
    ],
  },
];

// 6 User Roles & Portals
const userRoles = [
  {
    title: "Super Admin",
    desc: "Platform configuration, multi-tenant operations, billing & system audits",
    icon: Crown,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    scope: "Global System Control",
  },
  {
    title: "Gym Owner",
    desc: "Full business control, revenue analytics, strategic pricing & bank reconciliation",
    icon: Building2,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    scope: "Executive Dashboard",
  },
  {
    title: "Branch Manager",
    desc: "Daily floor operations, staff rosters, trainer schedules & member grievance handling",
    icon: Building,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    scope: "Location Operations",
  },
  {
    title: "Front Desk / Staff",
    desc: "Rapid visitor check-in, walk-in inquiries, membership renewals & shake bar POS",
    icon: Headphones,
    color: "text-pink-600 bg-pink-50 border-pink-200",
    scope: "Desk & Billing",
  },
  {
    title: "Trainer / Coach",
    desc: "Conduct PT sessions, update workout plans, review member diet logs & track commission",
    icon: Dumbbell,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    scope: "Trainer Portal",
  },
  {
    title: "Member (App/Web)",
    desc: "Mobile QR turnstile entry, workout progress, calorie scanning & 1-click renewal",
    icon: Smartphone,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    scope: "iOS / Android App",
  },
];

// Hardware Matrix
const hardwareList = [
  {
    category: "Turnstiles & Barriers",
    icon: Fingerprint,
    brands: "eSSL, ZKTeco, Hikvision, Suprema",
    description: "Tripod turnstiles, flap barriers, and speed gates with LAN / Wi-Fi cloud sync.",
    badge: "Anti-Passback",
  },
  {
    category: "Body Composition",
    icon: HeartPulse,
    brands: "InBody (270 / 370 / 570), Tanita",
    description: "Instant OCR extraction of visceral fat, skeletal muscle mass, and BMI reports.",
    badge: "Direct OCR",
  },
  {
    category: "Smart Access & RFID",
    icon: SmartphoneNfc,
    brands: "Mifare, EM-Cards, Wristbands",
    description: "Touchless waterproof wristbands for swimming pools, turnstiles, and smart lockers.",
    badge: "13.56MHz RFID",
  },
  {
    category: "POS & Counter Billing",
    icon: Printer,
    brands: "PineLabs, PayTM, Epson, TVS",
    description: "Sub-second 3-inch thermal bill printing, USB/Bluetooth barcode scanners & EDC machines.",
    badge: "Fast Thermal",
  },
];

// Target Audiences
const targetAudiences = [
  {
    title: "Commercial Gyms",
    desc: "High-volume fitness centers with 500+ active members, turnstiles, and multi-tier memberships.",
    icon: Dumbbell,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    title: "Boutique Studios",
    desc: "Yoga, pilates, CrossFit boxes, and spin studios requiring strict class capacity and credit packages.",
    icon: Sparkles,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    title: "Multi-Branch Chains",
    desc: "City-wide fitness brands requiring centralized roaming passes, unified inventory, and staff rosters.",
    icon: Share2,
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    title: "Franchise Networks",
    desc: "National gym franchises seeking brand standardization, royalty compliance, and HQ auditing.",
    icon: Store,
    color: "text-purple-600 bg-purple-50 border-purple-200",
  },
  {
    title: "Wellness Centers",
    desc: "Holistic fitness centers combining personal training, nutrition counseling, and body scan tracking.",
    icon: HeartPulse,
    color: "text-pink-600 bg-pink-50 border-pink-200",
  },
  {
    title: "Corporate Gyms",
    desc: "Enterprise employee fitness centers with automated corporate email SSO and employee attendance.",
    icon: Building,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
  },
];

// FAQ Items
const faqItems = [
  {
    q: "Can I connect my existing eSSL or ZKTeco biometric turnstiles?",
    a: "Yes. IOTRONICS – Gym comes with a pre-configured Edge IoT Gateway that connects directly to all standard eSSL, ZKTeco, and Hikvision turnstile gates over your local network. It validates access in under 300ms and immediately blocks unpaid or expired memberships.",
  },
  {
    q: "How does the AI Food Scanner work for member diet tracking?",
    a: "Members simply take a picture of their meal inside the iOS / Android member app. Our Vision AI engine recognizes food items, estimates portion weight, and calculates calories, protein, carbs, and fats directly into their daily diet journal.",
  },
  {
    q: "Does the system support automated WhatsApp payment reminders?",
    a: "Yes. The platform automatically triggers customized WhatsApp messages 7 days, 3 days, and on the day of renewal. Each reminder includes an instant UPI / Card payment link that automatically updates the membership status and unlocks gate access the moment payment is received.",
  },
  {
    q: "Can members use one membership across multiple branches?",
    a: "Absolutely. With our Multi-Branch Roaming module, you can configure city-wide or tier-based passes. When a member visits any branch, their biometric or QR pass is verified against the central cloud database in real-time.",
  },
  {
    q: "How are trainer personal training (PT) commissions calculated?",
    a: "The system automatically tracks every personal training session verified by the member's biometric or OTP check-in. Trainer commissions are calculated automatically according to your custom tiered rules and exported cleanly for monthly payroll.",
  },
];

export function GymPageTemplate({ product }: { product?: ProductItem | undefined }) {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [activeDomainIdx, setActiveDomainIdx] = useState(0);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [activeHeroCard, setActiveHeroCard] = useState<string | null>(null);

  // Interactive ROI Calculator State
  const [memberCount, setMemberCount] = useState(600);
  const [branches, setBranches] = useState(1);

  const calculateHoursSaved = Math.round((memberCount / 100) * 3.5 * branches);
  const calculateRevenueSaved = Math.round((memberCount * 0.08 * 1800 * branches));

  const [demoForm, setDemoForm] = useState({
    name: "",
    gymName: "",
    phone: "",
    email: "",
    branches: "1",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setDemoModalOpen(false);
      setDemoForm({ name: "", gymName: "", phone: "", email: "", branches: "1" });
    }, 2500);
  };

  return (
    <div className="w-full bg-[#f8fafd] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900 pb-20">
      {/* =========================================================================
          1. HERO SECTION (REPLICATING 3-COLUMN 3D STAGE & FLOATING CARDS DESIGN)
          ========================================================================= */}
      <section className="relative overflow-hidden pt-4 sm:pt-6 md:pt-8 pb-10 sm:pb-14 px-4 sm:px-6 2xl:px-12 bg-gradient-to-b from-[#f8f5fe] via-[#f1e8fc] to-[#f8fafd]">
        {/* Ambient Lighting & Backdrop Radial Glows */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[1100px] h-[650px] bg-gradient-to-b from-purple-200/40 via-indigo-100/25 to-transparent rounded-full blur-[130px]" />
        <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[480px] h-[480px] bg-purple-400/15 rounded-full blur-[100px]" />

        <div className="relative mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          {/* 3-Column Grid matching reference */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.15fr_0.95fr] xl:grid-cols-[1.15fr_1.2fr_0.95fr] 2xl:grid-cols-[1.2fr_1.25fr_1fr] gap-8 lg:gap-6 xl:gap-8 items-center">
            
            {/* LEFT COLUMN: Badge, Title with Curved Swoosh, Paragraph, CTAs, 3 Micro Features */}
            <div className="flex flex-col items-start z-10">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/90 bg-white/95 px-3.5 py-1 text-xs font-bold shadow-xs backdrop-blur-md">
                <span className="flex items-center gap-1.5 text-slate-800">
                  <span className="grid size-4 place-items-center rounded-sm bg-purple-100 text-purple-700">
                    <Dumbbell className="size-2.5" />
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-700 font-mono">
                    APPLICATION
                  </span>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-purple-700 font-extrabold flex items-center gap-1.5">
                  IOTRONICS – Gym
                </span>
              </div>

              {/* Title: All-in-One Gym Management Platform with Purple Curved Swoosh */}
              <h1 className="mt-4 text-3xl sm:text-5xl lg:text-[44px] xl:text-[50px] 2xl:text-[54px] font-black tracking-tight text-slate-950 leading-[1.12]">
                All-in-One <br />
                Gym Management <br />
                <span className="relative inline-block">
                  Platform
                  {/* Purple Curved Brush/Swoosh Underline */}
                  <svg
                    className="absolute -bottom-2 sm:-bottom-3 left-0 w-full h-3.5 sm:h-5 text-purple-600 pointer-events-none"
                    viewBox="0 0 250 24"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M 3 16 C 65 3, 185 2, 247 15 C 190 7, 75 8, 3 16 Z"
                      fill="url(#gym-swoosh-grad)"
                    />
                    <defs>
                      <linearGradient id="gym-swoosh-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#9333ea" />
                        <stop offset="50%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#c084fc" />
                      </linearGradient>
                    </defs>
                  </svg>
                </span>
              </h1>

              {/* Description Paragraph */}
              <p className="mt-4 sm:mt-5 text-xs sm:text-sm 2xl:text-base text-slate-600 leading-relaxed max-w-lg">
                Manage members, workouts, billing, staff and operations for single or multi-branch gyms, fitness studios, and wellness centers — all on one intelligent platform.
              </p>

              {/* CTA Buttons */}
              <div className="mt-6 sm:mt-7 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => setDemoModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 px-6 sm:px-7 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-purple-500/30 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/40 cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setVideoModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300/90 bg-white/95 px-5 sm:px-6 py-3 text-xs sm:text-sm font-bold text-slate-800 shadow-xs hover:bg-slate-50 hover:border-purple-300 transition-all cursor-pointer"
                >
                  <Play className="size-3.5 fill-purple-700 text-purple-700" />
                  <span>Watch Demo</span>
                </button>
              </div>

              {/* 3 Micro-Feature Icons */}
              <div className="mt-8 pt-2 flex items-center gap-8 sm:gap-10">
                <div className="flex flex-col items-center gap-2 text-center group cursor-default">
                  <div className="grid size-10 place-items-center rounded-xl bg-purple-50/80 border border-purple-200/70 text-purple-600 shadow-2xs group-hover:scale-110 transition-transform">
                    <Zap className="size-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 tracking-tight">Quick Setup</span>
                </div>

                <div className="flex flex-col items-center gap-2 text-center group cursor-default">
                  <div className="grid size-10 place-items-center rounded-xl bg-purple-50/80 border border-purple-200/70 text-purple-600 shadow-2xs group-hover:scale-110 transition-transform">
                    <Cloud className="size-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 tracking-tight">Cloud Ready</span>
                </div>

                <div className="flex flex-col items-center gap-2 text-center group cursor-default">
                  <div className="grid size-10 place-items-center rounded-xl bg-purple-50/80 border border-purple-200/70 text-purple-600 shadow-2xs group-hover:scale-110 transition-transform">
                    <Layers className="size-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 tracking-tight">Multi-Branch</span>
                </div>
              </div>
            </div>

            {/* CENTER COLUMN: 3D Isometric Fitness Equipment Stage (Clean, Static, Seamlessly Blended) */}
            <div className="relative flex items-center justify-center py-2 lg:py-0">
              {/* Soft ambient atmospheric glow matching the lavender stage */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 md:w-[440px] h-80 sm:h-96 md:h-[440px] rounded-full bg-gradient-to-b from-purple-300/30 via-purple-200/20 to-transparent blur-3xl pointer-events-none" />

              {/* 3D Fitness Stage Composite - No frontend scale/hover/scroll effects, purely static & smooth */}
              <div className="relative w-full max-w-[440px] sm:max-w-[480px] lg:max-w-[500px] xl:max-w-[530px] flex items-center justify-center">
                <img
                  src="/images/gym-stage-3d.png"
                  alt="IOTRONICS Gym 3D Platform Stage"
                  className="w-full h-auto object-contain select-none pointer-events-none block"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>

            {/* RIGHT COLUMN: 6 Floating Dynamic Sculpted Tabs */}
            <div className="flex flex-col gap-2.5 sm:gap-3 z-10 w-full max-w-md mx-auto lg:max-w-none">
              {heroFeatureCards.map((card, idx) => {
                const IconComp = card.icon;
                const isHovered = activeHeroCard === card.id;
                // Stage-cradling subtle contour on desktop
                const staggerClasses = [
                  "lg:translate-x-0",
                  "lg:translate-x-1.5",
                  "lg:translate-x-3",
                  "lg:translate-x-2.5",
                  "lg:translate-x-1",
                  "lg:translate-x-0",
                ][idx] ?? "";

                return (
                  <div
                    key={card.id}
                    onMouseEnter={() => setActiveHeroCard(card.id)}
                    onMouseLeave={() => setActiveHeroCard(null)}
                    onClick={() => {
                      setActiveDomainIdx(card.targetDomainIdx);
                      const el = document.getElementById("deep-dive-section");
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }}
                    className={`relative rounded-tl-[28px] rounded-br-[28px] rounded-tr-[14px] rounded-bl-[14px] p-2.5 sm:p-3 sm:px-4 transition-all duration-300 flex items-center justify-between gap-3 cursor-pointer group select-none backdrop-blur-md ${staggerClasses} ${
                      isHovered
                        ? "bg-white border-purple-500 shadow-[0_12px_28px_-4px_rgba(147,51,234,0.22),0_4px_12px_rgba(0,0,0,0.04)] scale-[1.02] -translate-y-0.5"
                        : "bg-gradient-to-r from-white via-white/95 to-purple-50/50 border-purple-200/80 shadow-[0_4px_16px_rgba(147,51,234,0.06),0_1px_3px_rgba(0,0,0,0.02)] hover:border-purple-400 hover:shadow-[0_10px_24px_-4px_rgba(147,51,234,0.18)]"
                    } border`}
                  >
                    {/* Left glowing accent status indicator bar on hover */}
                    <div
                      className={`absolute left-1.5 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b ${card.accentGrad} transition-opacity duration-300 ${
                        isHovered ? "opacity-100 scale-y-105" : "opacity-0"
                      }`}
                    />

                    {/* Icon & Text Details */}
                    <div className="flex items-center gap-3 min-w-0 pl-1">
                      {/* Sculpted 3D Squircle Icon Pod */}
                      <div
                        className={`size-10 sm:size-11 rounded-2xl border transition-all duration-300 flex items-center justify-center shrink-0 ${
                          isHovered
                            ? `bg-gradient-to-br ${card.accentGrad} border-transparent text-white shadow-[0_0_16px_rgba(147,51,234,0.45)] scale-105`
                            : "bg-gradient-to-br from-purple-100/90 via-purple-50 to-white border-purple-200/90 text-purple-700 shadow-2xs group-hover:bg-purple-100"
                        }`}
                      >
                        <IconComp className="size-4.5 sm:size-5 transition-transform duration-300 group-hover:scale-110" />
                      </div>

                      {/* Title, Badge & Subtitle */}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-[13.5px] font-black text-slate-900 group-hover:text-purple-700 transition-colors leading-tight tracking-tight">
                            {card.title}
                          </span>
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-purple-100/80 text-purple-700 border border-purple-200/60 leading-none">
                            {card.badge}
                          </span>
                        </div>
                        <span className="text-[10.5px] sm:text-xs text-slate-500 font-medium leading-tight mt-0.5 truncate group-hover:text-slate-600">
                          {card.subtitle}
                        </span>
                      </div>
                    </div>

                    {/* Right Trailing Action Chevron Button */}
                    <div
                      className={`size-7.5 sm:size-8 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 ${
                        isHovered
                          ? `bg-gradient-to-r ${card.accentGrad} border-transparent text-white shadow-[0_0_12px_rgba(147,51,234,0.4)] translate-x-1`
                          : "bg-purple-50/80 border-purple-200/70 text-purple-500 group-hover:border-purple-300"
                      }`}
                    >
                      <ChevronRight className="size-4" />
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* BOTTOM FLOATING DARK PILL BAR (Built for Fitness Businesses) */}
          <div className="mt-10 sm:mt-12 w-full rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#170e2b] via-[#23123c] to-[#180e2d] border border-purple-500/20 px-5 sm:px-8 py-3.5 sm:py-4 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Left: 4 Business Verticals */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 sm:gap-10 text-white text-xs sm:text-sm font-bold">
              {heroBusinessTypes.map((item, idx) => {
                const IconComp = item.icon;
                return (
                  <div key={idx} className="flex items-center gap-2.5 group cursor-default">
                    <div className="grid size-7 place-items-center rounded-lg bg-purple-900/60 border border-purple-500/30 text-purple-300 group-hover:scale-110 transition-transform">
                      <IconComp className="size-3.5" />
                    </div>
                    <span className="text-slate-200 group-hover:text-purple-300 transition-colors">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Right: Built for Fitness Businesses Pill Button */}
            <div className="shrink-0">
              <div
                onClick={() => setDemoModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white shadow-[0_0_25px_rgba(168,85,247,0.45)] border border-purple-400/40 hover:scale-105 transition-transform cursor-pointer"
              >
                <Sparkles className="size-4 text-purple-200 animate-pulse" />
                <span>Built for Fitness Businesses</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          2. 6 KPI METRICS BAR
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 py-3">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {kpiStats.map((stat, idx) => {
              const IconComp = stat.icon;
              return (
                <div
                  key={idx}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs transition-all hover:border-purple-300 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`grid size-9 shrink-0 place-items-center rounded-xl ${stat.iconBg} shadow-2xs`}
                    >
                      <IconComp className="size-4.5" />
                    </div>
                    {stat.badge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 ${stat.badgeColor}`}>
                        {stat.badge}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
                      {stat.value}
                    </span>
                    <p className="text-xs font-bold text-slate-800 leading-tight truncate mt-0.5">
                      {stat.label}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">{stat.subtext}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. INTERACTIVE PLATFORM DOMAIN EXPLORER (Deep Dive Tabs)
          ========================================================================= */}
      <section id="deep-dive-section" className="relative px-4 sm:px-6 2xl:px-12 pt-12 pb-6">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 pb-6 border-b border-slate-200/80">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/70 px-2.5 py-0.5 rounded-full">
                Interactive Architecture
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mt-1.5">
                Explore the Core Capabilities of Gym OS
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">
              Click through the five core operational pillars engineered to streamline gym desk workloads, boost member retention, and maximize profitability.
            </p>
          </div>

          {/* Domain Tab Selector Buttons */}
          <div className="mt-6 flex flex-wrap gap-2.5 pb-2 border-b border-slate-200/60">
            {deepDiveDomains.map((domain, idx) => (
              <button
                key={domain.id}
                onClick={() => setActiveDomainIdx(idx)}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activeDomainIdx === idx
                    ? "bg-purple-700 text-white shadow-md shadow-purple-600/25 scale-[1.02]"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-purple-50 hover:border-purple-200"
                }`}
              >
                <span>{domain.title}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold uppercase ${
                    activeDomainIdx === idx ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {domain.badge}
                </span>
              </button>
            ))}
          </div>

          {/* Active Domain Spotlight Box */}
          {(() => {
            const current = deepDiveDomains[activeDomainIdx] ?? deepDiveDomains[0];
            if (!current) return null;
            return (
              <div className="mt-6 rounded-3xl border border-purple-200/80 bg-white p-6 sm:p-8 lg:p-10 shadow-sm grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
                <div>
                  <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-purple-700 bg-purple-50 border border-purple-200/70 px-3 py-1 rounded-full">
                    {current.badge}
                  </span>
                  <h3 className="mt-3 text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-snug">
                    {current.headline}
                  </h3>
                  <p className="mt-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {current.desc}
                  </p>

                  <div className="mt-5 space-y-2.5">
                    {current.bullets.map((b, bIdx) => (
                      <div key={bIdx} className="flex items-start gap-2.5">
                        <div className="size-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="size-3" />
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-slate-800 leading-snug">
                          {b}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-6">
                    <div>
                      <span className="text-2xl sm:text-3xl font-black text-purple-700">
                        {current.metricValue}
                      </span>
                      <p className="text-xs text-slate-500 font-semibold">{current.metricLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDemoModalOpen(true)}
                      className="ml-auto inline-flex items-center gap-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2 text-xs font-bold hover:bg-purple-100 transition-colors"
                    >
                      <span>Request 1-on-1 Deep Dive</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Mock UI Showcase Card */}
                <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-900 to-slate-950 p-5 sm:p-6 text-white shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-slate-200">{current.mockupTitle}</span>
                    </div>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-900/60 border border-purple-500/40 px-2 py-0.5 rounded-md">
                      {current.mockupBadge}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {current.mockupStats.map((st, sIdx) => (
                      <div key={sIdx} className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                          {st.label}
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-white mt-0.5">{st.val}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                    <span>Edge Telemetry: Latency 14ms</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Encrypted & Active
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* =========================================================================
          4. END-TO-END GYM BUSINESS LIFECYCLE
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-10 pb-6">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1.5 pb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                End-to-End Gym Business Lifecycle
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              A connected workflow that covers your entire gym operations.
            </p>
          </div>

          {/* Connected Steps Grid with Arrow Connectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5 relative">
            {lifecycleSteps.map((step, idx) => {
              const IconComp = step.icon;
              return (
                <div
                  key={step.num}
                  className="relative group rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Step Number & Icon */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-black text-purple-700">
                        {step.num}
                      </span>
                      <div
                        className={`grid size-7 place-items-center rounded-lg border ${step.color} shadow-2xs`}
                      >
                        <IconComp className="size-3.5" />
                      </div>
                    </div>

                    <h3 className="mt-3 text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-600 leading-snug font-normal">
                      {step.subtitle}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-purple-700">
                    <span>{step.outcome}</span>
                    <ChevronRight className="size-3" />
                  </div>

                  {/* Flow Arrow pointing to next (for larger screens) */}
                  {idx < lifecycleSteps.length - 1 && (
                    <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
                      <span className="grid size-5 place-items-center rounded-full bg-slate-100 text-slate-400 border border-slate-200 text-[10px] font-bold">
                        →
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. ENTERPRISE HARDWARE & IOT INTEGRATION ECOSYSTEM
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-10 pb-6">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 pb-5 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/70 px-2.5 py-0.5 rounded-full">
                  Zero Glue Code
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight mt-1">
                  Plug-and-Play Gym Hardware Ecosystem
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md">
                Pre-configured IoT edge drivers connect directly with your existing biometric gates, InBody machines, and counter thermal printers.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {hardwareList.map((hw, idx) => {
                const IconComp = hw.icon;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 hover:bg-white hover:border-purple-300 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="grid size-9 place-items-center rounded-xl bg-purple-100 text-purple-700 border border-purple-200">
                          <IconComp className="size-4.5" />
                        </div>
                        <span className="text-[9px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                          {hw.badge}
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-950">{hw.category}</h4>
                      <p className="text-[11px] font-bold text-purple-700 mt-0.5">{hw.brands}</p>
                      <p className="mt-1.5 text-xs text-slate-600 leading-relaxed font-normal">
                        {hw.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. COMPREHENSIVE MODULES & FEATURES (12 CARDS)
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-10 pb-6">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1.5 pb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                Comprehensive Modules & Features
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Everything you need to run a modern, scalable and profitable fitness business.
            </p>
          </div>

          {/* 12 Feature Cards Grid (4 columns x 3 rows) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modulesList.map((mod, idx) => {
              const IconComp = mod.icon;
              return (
                <div
                  key={idx}
                  className="group rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-4.5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Icon + Title + Category */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div
                        className={`grid size-8 shrink-0 place-items-center rounded-xl border ${mod.color} shadow-2xs transition-transform group-hover:scale-105`}
                      >
                        <IconComp className="size-4" />
                      </div>
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                        {mod.category}
                      </span>
                    </div>

                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-950 leading-tight mb-2.5">
                      {mod.title}
                    </h3>

                    {/* Bullet Points */}
                    <ul className="space-y-1.5 text-[11px] text-slate-600">
                      {mod.bullets.map((bullet, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-1.5 leading-snug">
                          <span className="text-purple-500 font-bold mt-0.5">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. INTERACTIVE ROI & EFFICIENCY CALCULATOR
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-10 pb-6">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="rounded-3xl border border-purple-200/90 bg-gradient-to-br from-purple-900 via-indigo-950 to-slate-950 p-6 sm:p-8 lg:p-10 text-white shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 items-center">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300 bg-white/10 px-3 py-1 rounded-full border border-white/15">
                  Business Impact Calculator
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-2.5">
                  Calculate Your Hours & Revenue Saved
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-purple-200/80 leading-relaxed">
                  See how much time automated turnstiles, WhatsApp payment renewals, and digital trainer rosters save your fitness business each month.
                </p>

                {/* Slider Controls */}
                <div className="mt-6 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-white mb-1.5">
                      <span>Total Active Members:</span>
                      <span className="text-purple-300 font-mono text-sm">{memberCount} Members</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={3000}
                      step={50}
                      value={memberCount}
                      onChange={(e) => setMemberCount(Number(e.target.value))}
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-white mb-1.5">
                      <span>Number of Branches:</span>
                      <span className="text-purple-300 font-mono text-sm">{branches} Location(s)</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={branches}
                      onChange={(e) => setBranches(Number(e.target.value))}
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Real-time Calculated ROI Output Cards */}
              <div className="grid grid-cols-2 gap-3.5 bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-md">
                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-200">
                    Hours Saved / Month
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-white mt-1">
                    {calculateHoursSaved} hrs
                  </p>
                  <span className="text-[10px] text-slate-300 mt-0.5 block">Front desk & admin automation</span>
                </div>

                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-200">
                    Revenue Leak Prevented
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
                    ₹{calculateRevenueSaved.toLocaleString("en-IN")}
                  </p>
                  <span className="text-[10px] text-slate-300 mt-0.5 block">Per month from auto renewals</span>
                </div>

                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-200">
                    Check-in Speed
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-white mt-1">&lt; 0.3s</p>
                  <span className="text-[10px] text-slate-300 mt-0.5 block">Sub-second gate unlock</span>
                </div>

                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-200">
                    Payback Period
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-purple-300 mt-1">&lt; 18 Days</p>
                  <span className="text-[10px] text-slate-300 mt-0.5 block">Immediate operational ROI</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. USER ROLES & PORTALS
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-10 pb-6">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1.5 pb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                User Roles & Portals
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Role-based access for every stakeholder in your gym business.
            </p>
          </div>

          {/* 6 Role Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {userRoles.map((role, idx) => {
              const IconComp = role.icon;
              return (
                <div
                  key={idx}
                  className="group rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 text-center shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md flex flex-col items-center justify-between"
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`grid size-10 place-items-center rounded-xl border ${role.color} shadow-2xs mb-2.5 transition-transform group-hover:scale-110`}
                    >
                      <IconComp className="size-5" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                      {role.title}
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-600 leading-snug">{role.desc}</p>
                  </div>
                  <span className="mt-3 text-[9px] font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded-full">
                    {role.scope}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          9. WHO CAN USE IOTRONICS – GYM?
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-10 pb-6">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1.5 pb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                Who Can Use IOTRONICS – Gym?
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              A flexible and scalable platform for every fitness business model.
            </p>
          </div>

          {/* 6 Target Audience Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
            {targetAudiences.map((aud, idx) => {
              const IconComp = aud.icon;
              return (
                <div
                  key={idx}
                  className="group rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 text-center shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 hover:shadow-md flex flex-col items-center justify-start"
                >
                  <div
                    className={`grid size-9 place-items-center rounded-xl border ${aud.color} shadow-2xs mb-2 transition-transform group-hover:scale-110`}
                  >
                    <IconComp className="size-4.5" />
                  </div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                    {aud.title}
                  </h3>
                  <p className="mt-1 text-[10.5px] sm:text-[11px] text-slate-600 leading-relaxed">
                    {aud.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          10. FREQUENTLY ASKED QUESTIONS (Accordion)
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-10 pb-6">
        <div className="mx-auto w-full max-w-4xl">
          <div className="text-center pb-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/70 px-2.5 py-0.5 rounded-full">
              Got Questions?
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mt-1.5">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Everything you need to know about hardware onboarding, biometric gates, and data migration.
            </p>
          </div>

          <div className="space-y-3">
            {faqItems.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-bold text-xs sm:text-sm text-slate-900 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`size-4 text-slate-400 transition-transform ${
                        isOpen ? "rotate-180 text-purple-600" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          11. BOTTOM GRADIENT CTA BANNER
          ========================================================================= */}
      <section className="relative px-4 sm:px-6 2xl:px-12 pt-6">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 p-6 sm:p-8 md:p-10 text-white shadow-xl shadow-purple-600/20">
            {/* Ambient Background Circles */}
            <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -left-20 -bottom-20 size-72 rounded-full bg-purple-400/20 blur-2xl" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start sm:items-center gap-4">
                <div className="grid size-12 sm:size-14 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-white shadow-inner">
                  <Dumbbell className="size-6 sm:size-7" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-2xl font-black tracking-tight text-white">
                    Transform Your Gym Business with IOTRONICS
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-purple-100 max-w-xl">
                    Get more members, higher retention, streamlined turnstile operations and complete business control.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDemoModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 sm:px-7 py-3 text-xs sm:text-sm font-extrabold text-purple-900 shadow-md hover:bg-purple-50 transition-all hover:scale-105 cursor-pointer whitespace-nowrap"
                >
                  <span>Book a Demo</span>
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          12. INTERACTIVE DEMO BOOKING MODAL
          ========================================================================= */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setDemoModalOpen(false)}
              className="absolute right-5 top-5 grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="grid size-10 place-items-center rounded-xl bg-purple-100 text-purple-700">
                <Dumbbell className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Book IOTRONICS Gym OS Demo</h3>
                <p className="text-xs text-slate-600">
                  Experience turnstile gate sync, AI food scanner & member billing live.
                </p>
              </div>
            </div>

            {submitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="size-6" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Demo Scheduled!</h4>
                <p className="text-xs text-slate-600 max-w-xs mx-auto">
                  Thank you! An enterprise fitness specialist will connect with you within 15 minutes.
                </p>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="space-y-3.5 mt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Your Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={demoForm.name}
                    onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">
                    Gym / Club Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. IronPulse Fitness & Spa"
                    value={demoForm.gymName}
                    onChange={(e) => setDemoForm({ ...demoForm, gymName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase">Phone</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={demoForm.phone}
                      onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase">
                      Number of Branches
                    </label>
                    <select
                      value={demoForm.branches}
                      onChange={(e) => setDemoForm({ ...demoForm, branches: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                    >
                      <option value="1">1 Club</option>
                      <option value="2-5">2 - 5 Clubs</option>
                      <option value="6-20">6 - 20 Locations</option>
                      <option value="20+">20+ Franchise Chain</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@gymclub.com"
                    value={demoForm.email}
                    onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-700 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-purple-800 transition-all cursor-pointer"
                >
                  <Send className="size-4" /> Confirm & Book Demo
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          13. VIDEO DEMO WALKTHROUGH MODAL
          ========================================================================= */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/20 bg-slate-900 shadow-2xl">
            <button
              onClick={() => setVideoModalOpen(false)}
              className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-full bg-white/20 text-white hover:bg-white/40 cursor-pointer"
            >
              <X className="size-5" />
            </button>
            <div className="p-4 sm:p-6 text-white border-b border-white/10">
              <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                VIDEO WALKTHROUGH
              </span>
              <h3 className="text-base sm:text-lg font-black mt-0.5">
                IOTRONICS Gym OS — Feature Tour & Demo
              </h3>
            </div>
            <div className="relative aspect-video w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <div className="grid size-16 place-items-center rounded-full bg-purple-600/30 text-purple-400 border border-purple-500/40 mb-3 shadow-lg">
                <Dumbbell className="size-8" />
              </div>
              <p className="text-sm font-bold text-slate-200">
                Interactive Gym OS Video Tour
              </p>
              <p className="text-xs text-slate-400 max-w-md mt-1">
                Featuring biometric turnstile integration, AI meal calorie scanning, personalized
                workout planner, shake bar POS billing, and trainer commission rosters.
              </p>
              <button
                onClick={() => {
                  setVideoModalOpen(false);
                  setDemoModalOpen(true);
                }}
                className="mt-4 rounded-full bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500 transition-all cursor-pointer"
              >
                Schedule Live 1-on-1 Walkthrough
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
