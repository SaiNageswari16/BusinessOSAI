"use client";

import React, { useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  ArrowRight,
  Send,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  Cpu,
  Zap,
  Globe2,
  Laptop,
  Users,
  Activity,
  Headphones,
  Check,
  Code2,
  Dumbbell,
  Scissors,
  Store,
  UtensilsCrossed,
  BarChart3,
  HelpCircle,
  FileCheck,
  Rocket,
  ArrowUpRight,
  Clock,
  Briefcase,
  Sliders,
  Server,
  Lock,
} from "lucide-react";

export function ContactMainPageTemplate() {
  const formRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    workEmail: "",
    phoneNumber: "",
    companyName: "",
    industry: "Retail & Supermarkets",
    interestedApplication: "IOTRONICS Retail OS",
    businessSize: "11-50 Employees",
    numberOfBranches: "2-5 Branches",
    enquiryCategory: "Product Demonstrations",
    implementationTimeline: "1-3 Months",
    additionalRequirements: "",
    legacyIntegrations: "",
    selectedMultipleApps: [] as string[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const scrollToForm = (category?: string, application?: string) => {
    if (category) {
      setFormData((prev) => ({ ...prev, enquiryCategory: category }));
    }
    if (application) {
      setFormData((prev) => ({ ...prev, interestedApplication: application }));
    }
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.workEmail)) {
      setSubmitError("Please enter a valid work email address.");
      setIsSubmitting(false);
      return;
    }

    // Simulate reliable enterprise form submission
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 850);
  };

  const toggleMultipleApp = (appName: string) => {
    setFormData((prev) => {
      const exists = prev.selectedMultipleApps.includes(appName);
      return {
        ...prev,
        selectedMultipleApps: exists
          ? prev.selectedMultipleApps.filter((a) => a !== appName)
          : [...prev.selectedMultipleApps, appName],
      };
    });
  };

  // Section 2: Contact Categories
  const categories = [
    {
      id: "product-demos",
      title: "Product Demonstrations",
      icon: Laptop,
      categoryName: "Product Demonstrations",
      badge: "Guided Walkthrough",
      description:
        "Experience a customized 1-on-1 simulation using your exact inventory workflows, gym turnstiles, or salon matrices.",
      actionLabel: "Schedule Live Demo",
      toDemoPage: true,
    },
    {
      id: "sales-pricing",
      title: "Sales & Pricing Enquiries",
      icon: Briefcase,
      categoryName: "Sales & Pricing Enquiries",
      badge: "Commercials",
      description:
        "Speak with commercial licensing specialists about volume hardware bundles, multi-branch packages, and enterprise agreements.",
      actionLabel: "Request Pricing Model",
      toDemoPage: false,
    },
    {
      id: "enterprise-solutions",
      title: "Enterprise Solutions",
      icon: Building2,
      categoryName: "Enterprise Solutions",
      badge: "Large Scale",
      description:
        "Dedicated cloud infrastructure, multi-tenant databases, on-premise edge IoT deployments, and complex compliance frameworks.",
      actionLabel: "Consult Enterprise Team",
      toDemoPage: false,
    },
    {
      id: "custom-development",
      title: "Custom Development",
      icon: Code2,
      categoryName: "Custom Development",
      badge: "Engineering",
      description:
        "Bespoke algorithms, legacy ERP integrations (SAP/Oracle/Tally), custom hardware drivers, and proprietary AI copilots.",
      actionLabel: "Discuss Custom Scope",
      toDemoPage: false,
    },
    {
      id: "tech-partnerships",
      title: "Technology Partnerships",
      icon: Users,
      categoryName: "Technology Partnerships",
      badge: "Collaborate",
      description:
        "Join our partner network as a value-added reseller (VAR), hardware peripheral vendor, or system integration consultant.",
      actionLabel: "Explore Partnerships",
      toDemoPage: false,
    },
    {
      id: "technical-support",
      title: "Technical Support",
      icon: Headphones,
      categoryName: "Technical Support",
      badge: "24/7 SLA",
      description:
        "Existing clients can submit high-priority operational tickets, request hardware diagnostics, or review SLA status.",
      actionLabel: "Access Support Desk",
      toDemoPage: false,
    },
  ];

  // Section 3: Applications Showcase
  const applications = [
    {
      name: "IOTRONICS Retail",
      category: "Supermarkets & Multi-Store Commerce",
      icon: Store,
      badge: "Sub-12ms POS",
      desc: "High-speed billing, automated GST invoicing, multi-store stock reordering, and barcode scanner integration.",
      enquiryValue: "IOTRONICS Retail OS",
      specs: ["100k+ SKU capability", "Smart batch & expiry alerts", "Offline POS mode"],
    },
    {
      name: "IOTRONICS Gym",
      category: "Fitness & Health Club Management",
      icon: Dumbbell,
      badge: "Biometric Gates",
      desc: "Turnstile hardware sync, automated recurring dues, trainer booking, and real-time club capacity telemetry.",
      enquiryValue: "IOTRONICS Gym OS",
      specs: ["RFID/Biometric turnstiles", "WhatsApp attendance alerts", "Trainer commission ledger"],
    },
    {
      name: "IOTRONICS Luxury Salon",
      category: "Salons, Spas & Aesthetic Clinics",
      icon: Scissors,
      badge: "Chair Analytics",
      desc: "Chair-level utilization, stylist booking matrices, personalized client preference profiles, and inventory alerts.",
      enquiryValue: "IOTRONICS Luxury Salon OS",
      specs: ["Automated client rebooking", "Dynamic commission tiers", "VIP package management"],
    },
    {
      name: "IOTRONICS Restaurant",
      category: "Dine-In, Cafes & QSR Chains",
      icon: UtensilsCrossed,
      badge: "Kitchen Display",
      desc: "Instant table QR ordering, real-time Kitchen Display Systems (KDS), split billing, and recipe-level cost tracking.",
      enquiryValue: "IOTRONICS Restaurant OS",
      specs: ["Sub-second order routing", "Automated recipe depletion", "Aggregator menu sync"],
    },
    {
      name: "IOTRONICS Analytics",
      category: "Executive Business Intelligence",
      icon: BarChart3,
      badge: "AI Forecasting",
      desc: "Cross-platform data aggregation, multi-branch revenue telemetry, predictive footfall, and fraud prevention.",
      enquiryValue: "IOTRONICS Analytics OS",
      specs: ["Executive mobile view", "Predictive reorder curves", "Cross-branch comparisons"],
    },
    {
      name: "IOTRONICS Enterprise",
      category: "Unified IT Services & Cloud Modernization",
      icon: Cpu,
      badge: "Custom Cloud",
      desc: "Full-lifecycle enterprise software engineering, SAP S/4HANA migration, Salesforce CRM, and SOC-2 cybersecurity.",
      enquiryValue: "IOTRONICS Enterprise Services",
      specs: ["Dedicated delivery teams", "Enterprise SLA & 24/7 NOC", "Zero-trust architecture"],
    },
  ];

  // Section 5: Engagement Process (5-Step Visual Timeline)
  const processSteps = [
    {
      step: "01",
      title: "Understand Your Requirements",
      description:
        "We analyze your existing workflows, branch count, legacy software bottlenecks, and specific operational ambitions during an introductory discovery session.",
      highlight: "In-Depth Architectural Assessment",
    },
    {
      step: "02",
      title: "Discover the Right Solution",
      description:
        "Our solution architects map your requirements against our vertical operating systems and outline necessary hardware peripheral integrations.",
      highlight: "Tailored Architecture Blueprint",
    },
    {
      step: "03",
      title: "Schedule a Personalized Demo",
      description:
        "Experience a live sandbox environment populated with your industry data, showcasing billing velocity, turnstile triggers, or chair schedules.",
      highlight: "Interactive Hands-On Walkthrough",
    },
    {
      step: "04",
      title: "Plan Your Implementation",
      description:
        "We deliver a phased deployment roadmap covering data migration from your legacy system, staff onboarding, hardware testing, and go-live safeguards.",
      highlight: "Zero-Downtime Migration Strategy",
    },
    {
      step: "05",
      title: "Begin Your Transformation",
      description:
        "Seamless rollout across your branches backed by dedicated account managers, 24/7 technical monitoring, and continuous system updates.",
      highlight: "Measurable Operational ROI",
    },
  ];

  // Section 6: Why Connect
  const whyConnectPoints = [
    {
      title: "Personalized Product Demonstrations",
      desc: "See our operating systems perform under real-world conditions with your business workflows, catalogs, and staff roles simulated live.",
      icon: Laptop,
    },
    {
      title: "Industry-Specific Recommendations",
      desc: "Receive insights tailored precisely to your vertical—whether you manage high-throughput retail stores, gym turnstiles, or multi-salon franchises.",
      icon: Sliders,
    },
    {
      title: "AI & Automation Consultation",
      desc: "Identify concrete opportunities to eliminate manual administrative friction, automated ledger reconciliation, and predictive inventory reorders.",
      icon: Cpu,
    },
    {
      title: "Custom Enterprise Solutions",
      desc: "Beyond off-the-shelf software: we engineer dedicated cloud instances, bespoke APIs, and deep integrations with legacy SAP/Oracle infrastructure.",
      icon: Server,
    },
    {
      title: "Scalable Business Architecture",
      desc: "Our systems scale seamlessly from a single flagship location to 50+ nationwide branches without latency degradation or data fragmentation.",
      icon: Layers,
    },
    {
      title: "Implementation Guidance",
      desc: "Structured migration roadmaps, hands-on hardware pairing for POS peripherals, staff training workshops, and comprehensive SLA coverage.",
      icon: Rocket,
    },
  ];

  // Section 7: FAQs
  const faqs = [
    {
      question: "How quickly can we schedule a live product demonstration?",
      answer:
        "Demo requests are typically scheduled within 24 to 48 business hours. Our team prepares a custom sandbox instance tailored to your business vertical before the session so you can experience realistic workflows immediately.",
    },
    {
      question: "How is IOTRONICS pricing structured for multi-branch chains?",
      answer:
        "We offer flexible tiered pricing based on active locations, concurrent registers/terminals, and required software modules. Volume discounts apply automatically to multi-branch deployments, and all plans include platform upgrades, security patches, and cloud synchronization.",
    },
    {
      question: "Can IOTRONICS be customized to work with our existing hardware and POS peripherals?",
      answer:
        "Yes. IOTRONICS vertical operating systems support standard ESC/POS thermal receipt printers, barcode scanners, weighing scales, magnetic card readers, and biometric/RFID turnstile gates. We provide native drivers and plug-and-play hardware controllers.",
    },
    {
      question: "How does IOTRONICS integrate with existing ERP, accounting, and payment gateways?",
      answer:
        "We offer certified connectors and bi-directional RESTful APIs for popular ERP and accounting software (including Tally, SAP S/4HANA, Zoho Books, and QuickBooks) as well as major payment processors, UPI QR providers, and card terminals.",
    },
    {
      question: "Does IOTRONICS support centralized multi-branch and franchise administration?",
      answer:
        "Absolutely. Our architecture was designed from the ground up for multi-branch operations. Executives gain centralized visibility over sales, stock transfers, staff attendance, and customer loyalty across all branches, while individual store managers retain role-restricted local controls.",
    },
    {
      question: "What is the typical deployment timeline from consultation to go-live?",
      answer:
        "Single-store deployments can be fully operational in 3 to 7 business days, including hardware setup and staff training. Multi-branch enterprise rollouts typically take 2 to 4 weeks depending on the complexity of legacy database migration and customized workflow requirements.",
    },
    {
      question: "Are initial architecture and AI readiness consultations free of charge?",
      answer:
        "Yes. Our initial 30-minute discovery consultations and solution demonstrations are completely complimentary with zero financial obligation. We assess your operational bottlenecks and provide a concrete architecture proposal.",
    },
    {
      question: "What SLA tiers and technical support coverage do you provide after deployment?",
      answer:
        "All enterprise licenses include 24/7 automated cloud telemetry, regular software updates, and business-hours support. Enterprise tiers feature dedicated account engineers, 1-hour critical response SLAs, and on-site hardware support in major metropolitan areas.",
    },
  ];

  return (
    <div className="w-full bg-[#f8fafd] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      {/* Sticky Top Breadcrumb & Quick Access Bar */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 2xl:px-12 py-3 sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px] mx-auto flex items-center justify-between flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <Link to="/" className="hover:text-purple-700 transition-colors">
              Home
            </Link>
            <ChevronRight className="size-3.5 text-slate-400" />
            <span className="font-bold text-purple-700 font-mono">Contact &amp; Engagement</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-slate-500 text-[11px]">
              Want our original direct walkthrough form?
            </span>
            <Link
              to="/contact/request-demo"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 font-semibold transition-all text-xs shadow-xs"
            >
              <span>Go to Request Demo</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* SECTION 1: HERO SECTION */}
      <section className="relative py-8 sm:py-10 md:py-12 overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-purple-50/30 to-[#f8fafd]">
        {/* Glow Effects */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-indigo-300/15 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono shadow-xs">
                <Sparkles className="size-3.5 text-purple-600" />
                <span>ENTERPRISE ENGAGEMENT &bull; CONNECT WITH IOTRONICS</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl 2xl:text-6xl font-black text-slate-950 tracking-tight leading-[1.08]">
                Let&apos;s Turn Your Business Ideas Into{" "}
                <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 bg-clip-text text-transparent">
                  Intelligent Solutions.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl">
                Whether you&apos;re exploring AI-powered applications, modernizing business operations,
                or planning enterprise digital transformation, our team is ready to help you find the right solution.
              </p>

              {/* Engagement CTAs */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => scrollToForm("Enterprise Solutions")}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-700 text-white font-bold px-6 py-3.5 text-sm shadow-md shadow-purple-500/25 hover:bg-purple-800 transition-all hover:scale-105 cursor-pointer"
                >
                  <Send className="size-4" />
                  <span>Request a Consultation</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("applications-showcase");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold px-6 py-3.5 text-sm shadow-xs hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer"
                >
                  <Store className="size-4 text-purple-600" />
                  <span>Explore Applications</span>
                </button>

                <Link
                  to="/contact/request-demo"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 px-3 py-2 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  <span>Direct Demo Form</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>

              {/* Key Assurance Badges */}
              <div className="pt-6 border-t border-slate-200/90 grid grid-cols-3 gap-4 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Clock className="size-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">&lt; 2 Hours</div>
                    <div className="text-[10px] text-slate-500 font-normal">Typical Response Time</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <ShieldCheck className="size-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">SOC-2 Ready</div>
                    <div className="text-[10px] text-slate-500 font-normal">Enterprise Privacy</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Headphones className="size-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Direct Architects</div>
                    <div className="text-[10px] text-slate-500 font-normal">No Generic Call Centers</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Professional Technology & Connectivity Illustration */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 text-white p-7 sm:p-9 shadow-2xl border border-purple-800/40 overflow-hidden">
                {/* SVG Visual Node Network */}
                <div className="absolute inset-0 opacity-15 pointer-events-none">
                  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="contact-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#contact-grid)" />
                  </svg>
                </div>

                <div className="relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-[11px] font-mono font-bold">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>IOTRONICS TELEMETRY CORE</span>
                    </div>
                    <span className="text-[11px] font-mono text-purple-300 font-semibold">
                      v4.8 ACTIVE
                    </span>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      Intelligent Enterprise Connectivity
                    </h3>
                    <p className="text-xs text-purple-200/90 leading-relaxed font-normal">
                      Every inquiry connects directly with domain solutions engineers who understand
                      high-throughput retail registers, gym turnstiles, and automated salon appointments.
                    </p>
                  </div>

                  {/* Real-time System Metrics Demonstration */}
                  <div className="space-y-2.5 pt-2">
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Zap className="size-4 text-purple-400" />
                        <span className="font-semibold text-slate-200">Transaction Sync Latency</span>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold">&lt; 12ms</span>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Server className="size-4 text-indigo-400" />
                        <span className="font-semibold text-slate-200">Cross-Branch High Availability</span>
                      </div>
                      <span className="font-mono text-emerald-400 font-bold">99.99%</span>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Lock className="size-4 text-pink-400" />
                        <span className="font-semibold text-slate-200">Zero-Trust Encryption</span>
                      </div>
                      <span className="font-mono text-purple-300 font-bold">AES-256 GCM</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-purple-800/40 flex items-center justify-between text-xs">
                    <span className="text-purple-300 font-mono text-[11px]">Ready to integrate?</span>
                    <button
                      type="button"
                      onClick={() => scrollToForm("Enterprise Solutions")}
                      className="text-white hover:text-purple-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>Jump to Form</span>
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: CONTACT CATEGORIES */}
      <section className="py-8 sm:py-10 md:py-12 bg-white border-b border-slate-200/80">
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="max-w-3xl mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono mb-3">
              <Sliders className="size-3.5 text-purple-600" /> SPECIALIZED ENGAGEMENT CHANNELS
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
              Select Your Enquiry Category
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Route your request directly to the appropriate engineering or commercial division for accelerated turnaround.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.id}
                  className="bg-[#fcfdfe] rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="size-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Icon className="size-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 font-mono">
                        {cat.badge}
                      </span>
                    </div>

                    <h4 className="text-base sm:text-lg font-bold text-slate-950 tracking-tight">
                      {cat.title}
                    </h4>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                      {cat.description}
                    </p>
                  </div>

                  <div className="pt-5 mt-5 border-t border-slate-100">
                    {cat.toDemoPage ? (
                      <Link
                        to="/contact/request-demo"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors"
                      >
                        <span>{cat.actionLabel}</span>
                        <ArrowRight className="size-3.5" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => scrollToForm(cat.categoryName)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer"
                      >
                        <span>{cat.actionLabel}</span>
                        <ChevronRight className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 3: EXPLORE OUR APPLICATIONS */}
      <section
        id="applications-showcase"
        className="py-8 sm:py-10 md:py-12 bg-[#f8fafd] border-b border-slate-200/80 scroll-mt-20"
      >
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono mb-3">
                <Layers className="size-3.5 text-purple-600" /> APPLICATION SUITE
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
                Explore Our Applications &amp; Vertical Systems
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-2">
                Select an application to pre-populate your inquiry or request a specialized solution breakdown.
              </p>
            </div>

            <button
              type="button"
              onClick={() => scrollToForm(undefined, "Multiple Applications")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors shrink-0 cursor-pointer"
            >
              <span>Need Multiple Applications?</span>
              <ArrowRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {applications.map((app, idx) => {
              const Icon = app.icon;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="size-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                        <Icon className="size-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 font-mono">
                        {app.badge}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-950">{app.name}</h4>
                    <p className="text-[11px] font-semibold text-purple-700 mb-2">{app.category}</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal mb-4">
                      {app.desc}
                    </p>

                    <div className="space-y-1.5 border-t border-slate-100 pt-3 mb-4">
                      {app.specs.map((spec, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-2 text-[11px] text-slate-600">
                          <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                          <span>{spec}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollToForm("Product Demonstrations", app.enquiryValue)}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-purple-50 text-slate-800 hover:text-purple-800 border border-slate-200 hover:border-purple-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    <span>Enquire {app.name.replace("IOTRONICS ", "")}</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 4: ADVANCED CONTACT FORM */}
      <section
        id="enquiry-form"
        ref={formRef}
        className="py-8 sm:py-10 md:py-12 bg-white border-b border-slate-200/80 scroll-mt-20"
      >
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono mb-3">
                <Send className="size-3.5 text-purple-600" /> ADVANCED ENTERPRISE FORM
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
                Submit Your Business Enquiry
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-xl mx-auto">
                Fill out the specifications below. Our solutions engineering team will review your business requirements and reply with a tailored consultation plan.
              </p>
            </div>

            <div className="bg-[#fcfdfe] rounded-3xl p-6 sm:p-10 border border-purple-200/90 shadow-lg relative overflow-hidden">
              {submitted ? (
                <div className="text-center py-12 space-y-4">
                  <div className="size-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/30">
                    <CheckCircle2 className="size-9" />
                  </div>
                  <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 font-mono">
                    ENQUIRY CONFIRMED &bull; REF #IOT-{Math.floor(100000 + Math.random() * 900000)}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                    Thank You, {formData.fullName}!
                  </h3>
                  <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                    We have received your enquiry regarding{" "}
                    <strong className="text-purple-700 font-bold">{formData.interestedApplication}</strong>{" "}
                    for <strong className="text-slate-900">{formData.companyName || "your company"}</strong>.
                    A solutions architect will contact you at{" "}
                    <span className="font-semibold text-slate-900 font-mono">{formData.workEmail}</span> within 2 hours.
                  </p>

                  <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSubmitted(false)}
                      className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-800 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Submit Another Enquiry
                    </button>
                    <Link
                      to="/contact/request-demo"
                      className="px-5 py-2.5 rounded-xl bg-purple-700 text-white text-xs font-bold hover:bg-purple-800 transition-colors"
                    >
                      Request a 30-Min Demo
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-6">
                  {submitError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-center gap-2">
                      <HelpCircle className="size-4 text-rose-600 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Row 1: Full Name & Work Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase font-mono">
                        Full Name <span className="text-purple-600">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Siddhant Tiwari"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase font-mono">
                        Work Email <span className="text-purple-600">*</span>
                      </label>
                      <input
                        required
                        type="email"
                        placeholder="name@company.com"
                        value={formData.workEmail}
                        onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Row 2: Phone Number & Company Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase font-mono">
                        Phone Number <span className="text-purple-600">*</span>
                      </label>
                      <input
                        required
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase font-mono">
                        Company Name <span className="text-purple-600">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="Company Inc. / Franchise Name"
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Row 3: Industry & Interested Application */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase font-mono">
                        Industry Vertical <span className="text-purple-600">*</span>
                      </label>
                      <select
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 focus:outline-none transition-all"
                      >
                        <option value="Retail & Supermarkets">Retail &amp; Supermarket Chains</option>
                        <option value="Gyms & Fitness Centers">Commercial Gyms &amp; Fitness Clubs</option>
                        <option value="Luxury Salon & Spa">Luxury Salons, Spas &amp; Aesthetic Clinics</option>
                        <option value="Restaurant & Hospitality">Restaurants, Cafes &amp; QSR Franchises</option>
                        <option value="Healthcare & Wellness">Healthcare &amp; Diagnostics Centers</option>
                        <option value="Enterprise & Technology">Enterprise Technology &amp; Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase font-mono">
                        Interested Application <span className="text-purple-600">*</span>
                      </label>
                      <select
                        value={formData.interestedApplication}
                        onChange={(e) => setFormData({ ...formData, interestedApplication: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 focus:outline-none transition-all"
                      >
                        <option value="IOTRONICS Retail OS">IOTRONICS Retail OS</option>
                        <option value="IOTRONICS Gym OS">IOTRONICS Gym OS</option>
                        <option value="IOTRONICS Luxury Salon OS">IOTRONICS Luxury Salon OS</option>
                        <option value="IOTRONICS Restaurant OS">IOTRONICS Restaurant OS</option>
                        <option value="IOTRONICS Analytics OS">IOTRONICS Analytics OS</option>
                        <option value="IOTRONICS Enterprise Services">IOTRONICS Enterprise Services</option>
                        <option value="Multiple Applications">Multiple Applications (Platform License)</option>
                      </select>
                    </div>
                  </div>

                  {/* Conditional: Multiple Applications Selection */}
                  {formData.interestedApplication === "Multiple Applications" && (
                    <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2">
                      <span className="text-xs font-bold text-purple-900 uppercase font-mono">
                        Select All Applications of Interest:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {[
                          "Retail OS",
                          "Gym OS",
                          "Luxury Salon OS",
                          "Restaurant OS",
                          "Analytics OS",
                          "Enterprise IT Services",
                        ].map((app) => (
                          <label
                            key={app}
                            className="flex items-center gap-2 p-2 rounded-lg bg-white border border-purple-100 text-xs font-medium text-slate-800 cursor-pointer hover:border-purple-300"
                          >
                            <input
                              type="checkbox"
                              checked={formData.selectedMultipleApps.includes(app)}
                              onChange={() => toggleMultipleApp(app)}
                              className="rounded text-purple-600 focus:ring-purple-500"
                            />
                            <span>{app}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Row 4: Business Size & Number of Branches */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase font-mono">
                        Business Size (Staff / Users)
                      </label>
                      <select
                        value={formData.businessSize}
                        onChange={(e) => setFormData({ ...formData, businessSize: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 focus:outline-none transition-all"
                      >
                        <option value="1-10 Employees">1-10 Employees</option>
                        <option value="11-50 Employees">11-50 Employees</option>
                        <option value="51-200 Employees">51-200 Employees</option>
                        <option value="201-500 Employees">201-500 Employees</option>
                        <option value="500+ Enterprise">500+ Enterprise Scale</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase font-mono">
                        Number of Branches / Locations
                      </label>
                      <select
                        value={formData.numberOfBranches}
                        onChange={(e) => setFormData({ ...formData, numberOfBranches: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 focus:outline-none transition-all"
                      >
                        <option value="Single Location">Single Location Flagship</option>
                        <option value="2-5 Branches">2 - 5 Branches</option>
                        <option value="6-15 Branches">6 - 15 Branches</option>
                        <option value="16-50 Branches">16 - 50 Regional Chain</option>
                        <option value="50+ Multi-Branch">50+ Multi-Branch Enterprise</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 5: Enquiry Category & Expected Implementation Timeline */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase font-mono">
                        Enquiry Category <span className="text-purple-600">*</span>
                      </label>
                      <select
                        value={formData.enquiryCategory}
                        onChange={(e) => setFormData({ ...formData, enquiryCategory: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 focus:outline-none transition-all"
                      >
                        <option value="Product Demonstrations">Product Demonstrations</option>
                        <option value="Sales & Pricing Enquiries">Sales &amp; Pricing Enquiries</option>
                        <option value="Enterprise Solutions">Enterprise Solutions</option>
                        <option value="Custom Development">Custom Development</option>
                        <option value="Technology Partnerships">Technology Partnerships</option>
                        <option value="Technical Support">Technical Support</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase font-mono">
                        Expected Implementation Timeline
                      </label>
                      <select
                        value={formData.implementationTimeline}
                        onChange={(e) => setFormData({ ...formData, implementationTimeline: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 focus:outline-none transition-all"
                      >
                        <option value="Immediate / Under 30 Days">Immediate (Under 30 Days)</option>
                        <option value="1-3 Months">1 - 3 Months</option>
                        <option value="3-6 Months">3 - 6 Months</option>
                        <option value="Strategic Exploration">Strategic Exploration (Planning Phase)</option>
                      </select>
                    </div>
                  </div>

                  {/* Conditional: Legacy Integrations for Custom/Enterprise */}
                  {(formData.enquiryCategory === "Custom Development" ||
                    formData.enquiryCategory === "Enterprise Solutions") && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase font-mono">
                        Existing Software or ERP Systems to Integrate
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. SAP S/4HANA, Tally Prime, Salesforce, Biometric Turnstiles"
                        value={formData.legacyIntegrations}
                        onChange={(e) => setFormData({ ...formData, legacyIntegrations: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 focus:outline-none transition-all"
                      />
                    </div>
                  )}

                  {/* Row 6: Additional Requirements */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase font-mono">
                      Additional Requirements &amp; Scope Overview
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Describe your current bottlenecks (e.g. slow POS checkouts, turnstile disconnects, manual inventory counts, multi-branch reporting delays)..."
                      value={formData.additionalRequirements}
                      onChange={(e) => setFormData({ ...formData, additionalRequirements: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Submit Button & Security Note */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 py-4 text-sm font-bold text-white shadow-lg shadow-purple-600/25 hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="size-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          <span>Routing to Solutions Architect...</span>
                        </>
                      ) : (
                        <>
                          <Send className="size-4" />
                          <span>Submit Enterprise Enquiry</span>
                        </>
                      )}
                    </button>

                    <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Lock className="size-3 text-slate-400" /> End-to-End Encrypted
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="size-3 text-emerald-500" /> Non-Disclosure Protected
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3 text-purple-500" /> Response &lt; 2h
                      </span>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: OUR ENGAGEMENT PROCESS (ELEGANT VISUAL TIMELINE) */}
      <section className="py-8 sm:py-10 md:py-12 bg-[#f8fafd] border-b border-slate-200/80">
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="text-center max-w-3xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono mb-3">
              <Activity className="size-3.5 text-purple-600" /> STRUCTURED METHODOLOGY
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
              Our 5-Step Engagement Process
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              From first conversation to company-wide deployment, we execute with engineered predictability.
            </p>
          </div>

          {/* Connected Timeline */}
          <div className="relative">
            {/* Desktop connecting track line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-purple-200 via-indigo-300 to-purple-400 -translate-y-1/2 -z-0" />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
              {processSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Step Number Circle */}
                    <div className="size-12 rounded-2xl bg-purple-700 text-white font-mono font-extrabold text-base flex items-center justify-center mb-5 shadow-md shadow-purple-600/30">
                      {step.step}
                    </div>

                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 font-mono mb-2">
                      {step.highlight}
                    </span>

                    <h4 className="text-base font-bold text-slate-950 mb-2 leading-snug">
                      {step.title}
                    </h4>

                    <p className="text-xs text-slate-600 leading-relaxed font-normal">
                      {step.description}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-purple-700">
                    <Check className="size-3.5 text-emerald-600" />
                    <span>Phase Milestone</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: WHY CONNECT WITH IOTRONICS? */}
      <section className="py-8 sm:py-10 md:py-12 bg-white border-b border-slate-200/80">
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="text-center max-w-3xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono mb-3">
              <ShieldCheck className="size-3.5 text-purple-600" /> PARTNERSHIP VALUE
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
              Why Connect With IOTRONICS?
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              We stand apart from off-the-shelf software vendors through engineering depth and domain specialization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyConnectPoints.map((point, idx) => {
              const Icon = point.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#fcfdfe] rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all space-y-3"
                >
                  <div className="size-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Icon className="size-5" />
                  </div>
                  <h4 className="text-base font-bold text-slate-950">{point.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">{point.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 7: FREQUENTLY ASKED QUESTIONS */}
      <section className="py-8 sm:py-10 md:py-12 bg-[#f8fafd] border-b border-slate-200/80">
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="text-center max-w-3xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono mb-3">
              <HelpCircle className="size-3.5 text-purple-600" /> COMMON QUESTIONS
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Everything you need to know about demo scheduling, implementation timelines, and custom architecture.
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = expandedFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isOpen ? null : idx)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm sm:text-base font-bold text-slate-900">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`size-5 text-purple-600 shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 font-normal">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 8: FINAL CTA */}
      <section className="py-8 sm:py-10 md:py-12 bg-gradient-to-b from-white via-purple-50/40 to-[#f8fafd]">
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white p-8 sm:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-purple-500/20 to-transparent pointer-events-none" />

            <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/20 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-300 uppercase font-mono">
              <Sparkles className="size-3.5 text-purple-400" /> START YOUR JOURNEY
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl 2xl:text-5xl font-black text-white tracking-tight">
              Your Next Business Transformation Starts Here.
            </h2>

            <p className="text-sm sm:text-base text-purple-200/90 max-w-2xl mx-auto leading-relaxed font-normal">
              Tell us about your business goals. Let&apos;s explore how IOTRONICS can help you build
              smarter, more connected, and more efficient operations.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => scrollToForm("Enterprise Solutions")}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-purple-950 font-bold px-7 py-4 text-sm shadow-lg hover:bg-purple-50 transition-all hover:scale-105 cursor-pointer"
              >
                <Send className="size-4 text-purple-700" />
                <span>Talk to Our Team</span>
              </button>

              <Link
                to="/contact/request-demo"
                className="inline-flex items-center gap-2 rounded-xl border border-purple-400/40 bg-purple-900/30 text-white font-bold px-7 py-4 text-sm hover:bg-purple-800/40 transition-all"
              >
                <Laptop className="size-4 text-purple-300" />
                <span>Request a Demo</span>
                <ArrowRight className="size-4 text-purple-300" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ContactMainPageTemplate;

