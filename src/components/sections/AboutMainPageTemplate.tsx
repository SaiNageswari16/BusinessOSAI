"use client";

import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  ArrowRight,
  Shield,
  Cpu,
  Globe2,
  CheckCircle2,
  Target,
  Eye,
  Layers,
  ChevronRight,
  Award,
  Users,
  Compass,
  ArrowUpRight,
  Database,
  BarChart3,
  Server,
  Zap,
  Building,
  HeartHandshake,
  Lock,
} from "lucide-react";

export function AboutMainPageTemplate() {
  const [activeHub, setActiveHub] = useState<string>("bengaluru");

  const hubs = [
    {
      id: "bengaluru",
      city: "Bengaluru",
      country: "India",
      role: "Core Engineering & Deep-Tech R&D Hub",
      focus: "Distributed systems, AI foundation models, and vertical OS kernels.",
      teamSize: "120+ Engineers & Researchers",
    },
    {
      id: "sanfrancisco",
      city: "San Francisco",
      country: "United States",
      role: "AI Architecture & Global Strategy",
      focus: "Generative AI research, venture partnerships, and global enterprise strategy.",
      teamSize: "35+ Architects & Product Leaders",
    },
    {
      id: "london",
      city: "London",
      country: "United Kingdom",
      role: "EMEA Enterprise Solutions & Compliance",
      focus: "Cross-border retail architecture, GDPR compliance, and financial frameworks.",
      teamSize: "25+ Enterprise Consultants",
    },
    {
      id: "singapore",
      city: "Singapore",
      country: "Singapore",
      role: "APAC Expansion & Cloud Operations",
      focus: "High-concurrency cloud delivery, multi-currency settlement, and 24/7 reliability.",
      teamSize: "30+ Cloud Reliability Engineers",
    },
  ];

  const values = [
    {
      icon: Cpu,
      title: "Precision Engineering",
      desc: "We reject bloated software. Every line of code, database query, and network handshake is optimized for sub-15ms execution and rock-solid fault tolerance.",
      badge: "Architecture",
    },
    {
      icon: Database,
      title: "Domain-Specific Intelligence",
      desc: "Generic AI is not enough. Our models understand inventory turns, peak gym rush patterns, stylist commission tiers, and complex tax jurisdictions out of the box.",
      badge: "AI & ML",
    },
    {
      icon: Lock,
      title: "Uncompromising Security",
      desc: "Security is engineered into the foundation, not bolted on. Zero-trust principles, automated encryption at rest, and immutable audit logs safeguard every byte.",
      badge: "Trust & Safety",
    },
    {
      icon: Zap,
      title: "Speed as a Feature",
      desc: "Friction kills customer satisfaction. We design real-time systems that keep enterprise checkouts, biometric gates, and staff schedules flowing instantly.",
      badge: "Performance",
    },
    {
      icon: HeartHandshake,
      title: "True Partnership Culture",
      desc: "We don't merely sell licenses; we stand beside enterprise leadership as strategic technology partners committed to measurable revenue and operational ROI.",
      badge: "Philosophy",
    },
    {
      icon: Target,
      title: "Outcome-Driven Delivery",
      desc: "We measure success not by lines of code deployed, but by operational hours saved, inventory shrinkage prevented, and bottom-line profit generated.",
      badge: "Accountability",
    },
  ];

  const pillars = [
    {
      title: "Retail OS",
      description: "Omnichannel inventory orchestration, smart billing, and autonomous multi-store sync.",
      stat: "< 12ms checkout latency",
      tag: "Commerce",
    },
    {
      title: "Gym OS",
      description: "Biometric turnstile integration, automated recurring billing, and trainer CRM.",
      stat: "100% check-in sync",
      tag: "Fitness",
    },
    {
      title: "Luxury Salon OS",
      description: "Chair-level utilization, commission splits, automated client rebooking, and VIP loyalty.",
      stat: "+38% retention rate",
      tag: "Wellness",
    },
    {
      title: "Restaurant & QSR OS",
      description: "Kitchen display orchestration, table turn analytics, recipe cost tracking, and fast ordering.",
      stat: "Zero order slippage",
      tag: "Hospitality",
    },
    {
      title: "Analytics & Intelligence Core",
      description: "Cross-platform data consolidation, automated forecasting, and predictive business alerts.",
      stat: "Real-time AI insights",
      tag: "Intelligence",
    },
    {
      title: "Enterprise Technology Services",
      description: "Custom cloud solutions, SAP/Salesforce modernization, cybersecurity, and DevOps engineering.",
      stat: "End-to-End Delivery",
      tag: "Enterprise",
    },
  ];

  return (
    <div className="w-full bg-[#f8fafd] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      {/* Top Breadcrumb & Company Overview Quick Access Bar */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 2xl:px-12 py-3 sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px] mx-auto flex items-center justify-between flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <Link to="/" className="hover:text-purple-700 transition-colors">
              Home
            </Link>
            <ChevronRight className="size-3.5 text-slate-400" />
            <span className="font-bold text-purple-700 font-mono">About Us</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-slate-500 text-[11px]">
              Looking for our detailed platform breakdown?
            </span>
            <Link
              to="/about/company-overview"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 font-semibold transition-all text-xs shadow-xs"
            >
              <span>View Company Overview</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative py-8 sm:py-10 md:py-12 overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-purple-50/30 to-[#f8fafd]">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-purple-300/20 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-indigo-300/15 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase mb-4 font-mono shadow-xs">
              <Sparkles className="size-3.5 text-purple-600" />
              <span>ABOUT IOTRONICS &bull; ENGINEERING INTELLIGENCE</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl 2xl:text-6xl font-black text-slate-950 tracking-tight leading-[1.08] mb-6">
              Architecting the Autonomous Enterprise.{" "}
              <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 bg-clip-text text-transparent">
                Powered by Domain Intelligence.
              </span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed font-normal mb-8 max-w-3xl">
              IOTRONICS is an enterprise technology powerhouse. We engineer vertical AI operating systems,
              intelligent automation platforms, and robust digital foundations that unify fragmented operations
              into high-performing, resilient business ecosystems.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <Link
                to="/about/company-overview"
                className="inline-flex items-center gap-2 rounded-xl bg-purple-700 text-white font-bold px-6 py-3.5 text-sm shadow-md shadow-purple-500/25 hover:bg-purple-800 transition-all hover:scale-105"
              >
                <span>Explore Company Overview</span>
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold px-6 py-3.5 text-sm shadow-xs hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                <span>Enterprise Services</span>
                <ArrowUpRight className="size-4 text-slate-500" />
              </Link>
            </div>
          </div>

          {/* Key Stat Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-16 pt-10 border-t border-slate-200/90">
            <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:border-purple-300 transition-colors">
              <div className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-purple-700 font-mono mb-1">
                50+
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                Enterprise Deployments
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Across 12 global geographies and vertical industries.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:border-purple-300 transition-colors">
              <div className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-indigo-700 font-mono mb-1">
                99.99%
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                Operational Uptime
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Mission-critical reliability for 24/7 business continuity.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:border-purple-300 transition-colors">
              <div className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-purple-700 font-mono mb-1">
                1.5M+
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                Daily Transactions
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Processed with sub-15 millisecond response times.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:border-purple-300 transition-colors">
              <div className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-indigo-700 font-mono mb-1">
                4 Hubs
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                Global Delivery Presence
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Bengaluru, San Francisco, London, and Singapore.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Prominent Company Overview Invitation Banner */}
      <section className="py-8 px-4 sm:px-6 2xl:px-12 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px] mx-auto rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 2xl:p-10 shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-purple-500/20 to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-3 py-0.5 rounded-full border border-purple-400/30 font-mono">
                <span>DEDICATED SHOWCASE</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Looking for the IOTRONICS Company Overview &amp; Product Showcase?
              </h3>
              <p className="text-xs sm:text-sm text-purple-200/90 leading-relaxed font-normal">
                Review our complete vertical operating matrix, live multi-role collaboration architecture,
                predictive analytics breakdowns, and client testimonials on our dedicated Company Overview page.
              </p>
            </div>

            <Link
              to="/about/company-overview"
              className="shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-purple-950 hover:bg-purple-50 font-bold text-xs sm:text-sm transition-all shadow-md hover:scale-105"
            >
              <span>Explore Company Overview</span>
              <ArrowRight className="size-4 text-purple-700" />
            </Link>
          </div>
        </div>
      </section>

      {/* Identity & Origin: The Zero-Fragmentation Thesis */}
      <section className="py-8 sm:py-10 md:py-12 bg-[#f8fafd] border-b border-slate-200/80">
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono">
                <Compass className="size-3.5 text-purple-600" /> OUR ORIGIN &amp; IDENTITY
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight leading-tight">
                Built at the Intersection of Systems Engineering and Vertical Intelligence.
              </h2>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                Enterprise technology was broken. Traditional businesses were forced to purchase dozens
                of disconnected SaaS applications—one for retail billing, another for gym attendance, a third
                for salon appointments, separate spreadsheets for inventory, and disconnected CRM databases.
              </p>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                The result was crippling data silos, revenue leakages, high licensing overheads, and fragile integrations
                that shattered during peak operational hours.
              </p>

              <div className="p-5 rounded-2xl bg-white border border-purple-200 shadow-xs">
                <h4 className="text-sm font-bold text-purple-900 mb-1 flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-purple-600" />
                  The IOTRONICS Thesis
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  We engineer unified digital nervous systems. When POS billing, inventory replenishment,
                  customer loyalty, access control, and financial reporting share a single real-time data core,
                  operations become autonomous, predictable, and remarkably profitable.
                </p>
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:border-purple-300 transition-all space-y-3">
                <div className="size-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <Layers className="size-5" />
                </div>
                <h4 className="text-base font-bold text-slate-950">Unified Architecture</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Eliminating fragile third-party middleware with a single native data spine.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:border-purple-300 transition-all space-y-3">
                <div className="size-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <Cpu className="size-5" />
                </div>
                <h4 className="text-base font-bold text-slate-950">Vertical Intelligence</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pre-trained AI algorithms engineered specifically for retail, fitness, and luxury service chains.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:border-purple-300 transition-all space-y-3">
                <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Shield className="size-5" />
                </div>
                <h4 className="text-base font-bold text-slate-950">Zero-Trust Security</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Military-grade encryption, role-based controls, and immutable operational audit logs.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:border-purple-300 transition-all space-y-3">
                <div className="size-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <Server className="size-5" />
                </div>
                <h4 className="text-base font-bold text-slate-950">Distributed Scale</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Multi-region cloud infrastructure delivering ultra-low latencies regardless of geographic distribution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-8 sm:py-10 md:py-12 bg-white border-b border-slate-200/80">
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="text-center max-w-3xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono mb-3">
              <Target className="size-3.5 text-purple-600" /> STRATEGIC PURPOSE
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
              Our Mission and Vision for Modern Commerce
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3">
              Guiding every system we architect, every algorithm we tune, and every customer relationship we cultivate.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Mission */}
            <div className="bg-gradient-to-br from-[#fbfaff] to-purple-50/50 rounded-3xl p-8 sm:p-10 border border-purple-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-4">
                <div className="size-12 rounded-2xl bg-purple-700 text-white flex items-center justify-center shadow-md shadow-purple-600/30">
                  <Target className="size-6" />
                </div>
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-purple-700 font-mono">
                  OUR MISSION
                </span>
                <h3 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                  To eliminate manual operational drag through intelligent, autonomous enterprise systems.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  We empower enterprises to operate with the velocity, precision, and intelligence of modern
                  tech giants. By automating routine ledger reconciliation, scheduling, inventory reordering,
                  and compliance monitoring, we unlock human potential to focus on strategic growth and customer delight.
                </p>
              </div>

              <div className="pt-6 border-t border-purple-200/60 mt-6 flex items-center gap-2 text-xs font-semibold text-purple-800">
                <CheckCircle2 className="size-4 text-purple-600" />
                <span>Zero-friction operational execution</span>
              </div>
            </div>

            {/* Vision */}
            <div className="bg-gradient-to-br from-[#fafbff] to-indigo-50/50 rounded-3xl p-8 sm:p-10 border border-indigo-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-4">
                <div className="size-12 rounded-2xl bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                  <Eye className="size-6" />
                </div>
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-indigo-700 font-mono">
                  OUR VISION
                </span>
                <h3 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                  An autonomous future where physical and digital operations synchronize seamlessly.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  We envision a global business landscape where vertical businesses operate as self-optimizing
                  engines. Whether managing 100 retail outlets, a nationwide chain of fitness centers, or an
                  international luxury salon franchise, business leaders possess instantaneous insight and predictive foresight.
                </p>
              </div>

              <div className="pt-6 border-t border-indigo-200/60 mt-6 flex items-center gap-2 text-xs font-semibold text-indigo-800">
                <CheckCircle2 className="size-4 text-indigo-600" />
                <span>Continuous predictive enterprise intelligence</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values & Guiding Principles */}
      <section className="py-8 sm:py-10 md:py-12 bg-[#f8fafd] border-b border-slate-200/80">
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="text-center max-w-3xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono mb-3">
              <Award className="size-3.5 text-purple-600" /> GUIDING PRINCIPLES
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
              The Engineering DNA That Sets Us Apart
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3">
              Six foundational commitments that define our products, code quality, and client engagements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((val, idx) => {
              const Icon = val.icon;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-xs hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="size-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Icon className="size-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 font-mono">
                        {val.badge}
                      </span>
                    </div>

                    <h4 className="text-lg font-bold text-slate-950 tracking-tight">
                      {val.title}
                    </h4>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                      {val.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* The IOTRONICS Vertical Platform Matrix */}
      <section className="py-8 sm:py-10 md:py-12 bg-white border-b border-slate-200/80">
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono mb-3">
                <Layers className="size-3.5 text-purple-600" /> ECOSYSTEM ARCHITECTURE
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
                Our Vertical Operating Matrix
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-2">
                Purpose-built operating systems crafted for high-volume physical businesses, seamlessly linked to our enterprise services layer.
              </p>
            </div>

            <Link
              to="/about/company-overview"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors shrink-0"
            >
              <span>See Live Interactive Showcase</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map((pillar, idx) => (
              <div
                key={idx}
                className="bg-[#fcfdfe] rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 font-mono">
                      {pillar.tag}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 font-mono">
                      {pillar.stat}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-slate-950 mb-2">
                    {pillar.title}
                  </h4>

                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {pillar.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-purple-700 font-semibold">
                  <span>Explore platform specs</span>
                  <ChevronRight className="size-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Global Delivery Presence & Innovation Hubs */}
      <section className="py-8 sm:py-10 md:py-12 bg-[#f8fafd] border-b border-slate-200/80">
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="text-center max-w-3xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono mb-3">
              <Globe2 className="size-3.5 text-purple-600" /> GLOBAL FOOTPRINT
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight">
              Worldwide Engineering &amp; Strategic Delivery
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3">
              Operating across key international technology centers to provide round-the-clock innovation, deployment, and customer success.
            </p>
          </div>

          {/* Hub Selector Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
            {hubs.map((hub) => (
              <button
                key={hub.id}
                onClick={() => setActiveHub(hub.id)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                  activeHub === hub.id
                    ? "bg-purple-700 text-white shadow-md shadow-purple-600/20"
                    : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {hub.city}, {hub.country}
              </button>
            ))}
          </div>

          {/* Active Hub Card */}
          {(() => {
            const current = hubs.find((h) => h.id === activeHub) ?? hubs[0];
            if (!current) return null;
            return (
              <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 sm:p-10 border border-purple-200/80 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 font-mono">
                      INNOVATION HUB &bull; {current.country.toUpperCase()}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-1">
                      {current.city}
                    </h3>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold font-mono">
                    {current.teamSize}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">
                      Strategic Role
                    </h5>
                    <p className="text-sm font-bold text-slate-900">
                      {current.role}
                    </p>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 font-mono">
                      Key Technical Focus
                    </h5>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                      {current.focus}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Leadership & Engineering Culture */}
      <section className="py-8 sm:py-10 md:py-12 bg-white border-b border-slate-200/80">
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono">
                <Users className="size-3.5 text-purple-600" /> LEADERSHIP &amp; CULTURE
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-950 tracking-tight leading-tight">
                Architects, Researchers, and Problem Solvers.
              </h2>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                At IOTRONICS, our culture is shaped by intellectual rigor and operational obsession.
                We bring together distributed systems specialists, machine learning researchers, and domain experts
                who have built software running at massive planetary scale.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="size-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium">
                    <strong className="text-slate-950 font-bold">Zero-Bloat Architecture:</strong> We prioritize lean, ultra-performant code over heavy layers of unnecessary abstraction.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="size-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium">
                    <strong className="text-slate-950 font-bold">First-Principles Problem Solving:</strong> We don&apos;t accept legacy industry assumptions; we reconstruct workflows for maximum efficiency.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="size-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="size-3.5" />
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium">
                    <strong className="text-slate-950 font-bold">Relentless Customer Focus:</strong> Every engineer spends direct hours understanding how store staff, coaches, and stylists interact with our software.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-3xl bg-slate-950 text-white p-8 sm:p-10 shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 font-mono">
                  OUR PHILOSOPHY
                </span>
                <blockquote className="mt-4 text-base sm:text-lg md:text-xl text-slate-200 leading-relaxed font-light italic">
                  &ldquo;Great enterprise software should not feel like an administrative burden.
                  It should feel like an invisible superpower—silently synchronizing data, automating complex rules,
                  and presenting leadership with instantaneous truth.&rdquo;
                </blockquote>
                <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">IOTRONICS Engineering Directorate</div>
                    <div className="text-xs text-purple-400 font-mono">Systems Architecture &amp; Applied AI</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dual Destination Callout: Company Overview vs Services */}
      <section className="py-8 sm:py-10 md:py-12 bg-gradient-to-b from-[#f8fafd] to-purple-50/40">
        <div className="container mx-auto px-4 sm:px-6 2xl:px-8 3xl:px-12 max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3.5 py-1 text-[11px] font-bold tracking-wider text-purple-700 uppercase font-mono">
              <Sparkles className="size-3.5 text-purple-600" /> TAKE THE NEXT STEP
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-950 tracking-tight">
              Ready to Accelerate Your Enterprise?
            </h2>

            <p className="text-sm sm:text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Whether you wish to inspect our detailed platform architecture in the Company Overview
              or discuss an enterprise transformation engagement, we are ready to assist.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                to="/about/company-overview"
                className="inline-flex items-center gap-2 rounded-xl bg-purple-700 text-white font-bold px-7 py-4 text-sm shadow-lg shadow-purple-600/30 hover:bg-purple-800 transition-all hover:scale-105"
              >
                <span>View Company Overview</span>
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold px-7 py-4 text-sm shadow-xs hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                <span>Explore Enterprise Services</span>
                <ArrowUpRight className="size-4 text-slate-500" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AboutMainPageTemplate;
