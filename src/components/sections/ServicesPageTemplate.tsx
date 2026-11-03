"use client";

import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Globe,
  Smartphone,
  BrainCircuit,
  BarChart3,
  ShieldCheck,
  Server,
  Users,
  Cloud,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Cpu,
  Database,
  CodeXml,
  Layers,
  Workflow,
  Boxes,
  Bot,
  Zap,
  Building2,
  Factory,
  Stethoscope,
  GraduationCap,
  Truck,
  Store,
  Dumbbell,
  Scissors,
  Utensils,
  Mail,
  Phone,
  MapPin,
  Check,
  Calendar,
  Lock,
  Search,
  MessageSquare,
  Network,
  FileText,
  Mic,
  Compass,
  Briefcase,
  Headphones,
  Send,
  X,
  Flame,
  Award,
} from "lucide-react";

// ============================================================================
// DATA: 10 Core Technology Expertise Areas
// ============================================================================
const technologyExpertise = [
  {
    id: "web-app-dev",
    title: "Web Application Development",
    icon: Globe,
    badge: "Full-Stack Web",
    color: "from-blue-500/20 to-indigo-500/10 text-blue-600 border-blue-200",
    description:
      "Build powerful, scalable, and secure web applications tailored to your business requirements. From customer-facing portals to enterprise management platforms, we develop high-performance digital experiences.",
    highlights: ["SaaS & Multi-Tenant Portals", "Responsive PWAs & SPAs", "Sub-Second API Backends"],
  },
  {
    id: "mobile-app-dev",
    title: "Mobile Application Development",
    icon: Smartphone,
    badge: "iOS & Android",
    color: "from-purple-500/20 to-pink-500/10 text-purple-600 border-purple-200",
    description:
      "Transform your business ideas into powerful mobile experiences with native and cross-platform applications. Deliver seamless functionality, secure authentication, and real-time connectivity across devices.",
    highlights: ["Flutter & React Native", "Offline-First Data Sync", "Biometric Authentication"],
  },
  {
    id: "ai-genai",
    title: "AI & Generative AI Solutions",
    icon: BrainCircuit,
    badge: "Next-Gen AI",
    color: "from-fuchsia-500/20 to-rose-500/10 text-fuchsia-600 border-fuchsia-200",
    description:
      "Integrate intelligence into your business with custom AI assistants, LLM-powered applications, RAG architectures, intelligent agents, predictive models, and automated workflows.",
    highlights: ["Custom LLM Fine-Tuning", "Autonomous AI Agents", "Retrieval-Augmented Gen (RAG)"],
  },
  {
    id: "data-analytics",
    title: "Data Analytics & Business Intelligence",
    icon: BarChart3,
    badge: "Telemetry & BI",
    color: "from-cyan-500/20 to-blue-500/10 text-cyan-600 border-cyan-200",
    description:
      "Turn complex business data into meaningful insights. Build intelligent reporting systems, real-time dashboards, performance analytics, and predictive intelligence for better business decisions.",
    highlights: ["Live Telemetry Pipelines", "Executive KPI Cockpits", "Forecasting & Predictive ML"],
  },
  {
    id: "cybersecurity",
    title: "Cybersecurity Services",
    icon: ShieldCheck,
    badge: "Zero-Trust",
    color: "from-emerald-500/20 to-teal-500/10 text-emerald-600 border-emerald-200",
    description:
      "Protect your digital infrastructure with enterprise-grade security solutions, vulnerability assessments, identity management, access controls, compliance support, and continuous security monitoring.",
    highlights: ["Vulnerability Audits", "SOC-2 & ISO Compliance", "Zero-Trust Identity & RBAC"],
  },
  {
    id: "sap-cloud",
    title: "SAP Cloud Services",
    icon: Server,
    badge: "Enterprise ERP",
    color: "from-amber-500/20 to-orange-500/10 text-amber-600 border-amber-200",
    description:
      "Modernize enterprise operations with SAP implementation, SAP S/4HANA migration, ABAP development, workflow automation, system integration, and enterprise resource management.",
    highlights: ["SAP S/4HANA Migration", "Custom ABAP & Fiori Apps", "Two-Way Legacy ERP Sync"],
  },
  {
    id: "salesforce",
    title: "Salesforce Services",
    icon: Users,
    badge: "CRM Architecture",
    color: "from-indigo-500/20 to-purple-500/10 text-indigo-600 border-indigo-200",
    description:
      "Optimize customer relationships and business processes through Salesforce implementation, customization, Lightning development, CRM automation, and intelligent customer lifecycle management.",
    highlights: ["Sales & Service Cloud", "Custom Lightning UI", "Automated Lead Routing"],
  },
  {
    id: "cloud-devops",
    title: "Cloud & DevOps Engineering",
    icon: Cloud,
    badge: "Multi-Cloud CI/CD",
    color: "from-sky-500/20 to-blue-500/10 text-sky-600 border-sky-200",
    description:
      "Build reliable cloud infrastructure with AWS, Microsoft Azure, and Google Cloud. Streamline development and deployment through CI/CD automation, containerization, infrastructure management, and cloud optimization.",
    highlights: ["AWS, Azure & GCP Architectures", "Kubernetes & Docker Pipelines", "99.99% Uptime Engineering"],
  },
  {
    id: "testing-qa",
    title: "Testing & Quality Assurance",
    icon: CheckCircle2,
    badge: "Automated QA",
    color: "from-teal-500/20 to-emerald-500/10 text-teal-600 border-teal-200",
    description:
      "Ensure application reliability through comprehensive software testing, functional validation, API testing, automation testing, performance testing, and security assessments.",
    highlights: ["Automated Regression Suites", "Load & Stress Simulation", "API Contract Validation"],
  },
  {
    id: "digital-marketing-seo",
    title: "Digital Marketing & SEO",
    icon: TrendingUp,
    badge: "Growth Engine",
    color: "from-rose-500/20 to-pink-500/10 text-rose-600 border-rose-200",
    description:
      "Strengthen your digital presence through search engine optimization, performance marketing, conversion optimization, content strategies, analytics, and customer acquisition campaigns.",
    highlights: ["Technical & Local SEO", "Conversion Rate Optimization", "Data-Driven Ad Campaigns"],
  },
];

// ============================================================================
// DATA: Custom Software Development Capabilities
// ============================================================================
const customDevCapabilities = [
  { title: "Custom Enterprise Software Development", icon: Building2, desc: "Bespoke core systems engineered precisely around unique operational workflows." },
  { title: "Business Management Systems", icon: Briefcase, desc: "Unified operational backbones coordinating operations, teams, and assets." },
  { title: "ERP & CRM Development", icon: Workflow, desc: "Customized resource planning and client lifecycle management systems." },
  { title: "SaaS Platform Development", icon: Globe, desc: "Cloud-native, multi-tenant digital products built for scale and velocity." },
  { title: "Multi-Tenant Application Architecture", icon: Boxes, desc: "Isolated tenant workspaces, custom schemas, and shared infrastructure." },
  { title: "API Development & Integration", icon: CodeXml, desc: "High-throughput REST and GraphQL endpoints linking internal & external tools." },
  { title: "Third-Party System Integration", icon: Network, desc: "Flawless bidirectional connectors with payment gateways, logistics, and CRMs." },
  { title: "Legacy Application Modernization", icon: Zap, desc: "Refactoring legacy monolithic apps into cloud-native microservices." },
  { title: "Enterprise Workflow Automation", icon: Cpu, desc: "Automate repetitive approvals, handoffs, notifications, and ledger updates." },
  { title: "Custom Admin Panels & Management Portals", icon: Layers, desc: "High-speed dashboards for admins, managers, and operational staff." },
];

// ============================================================================
// DATA: AI & Automation Capabilities
// ============================================================================
const aiCapabilities = [
  { title: "Generative AI Application Development", icon: Sparkles, desc: "Custom LLM applications built on modern foundation models." },
  { title: "AI Chatbots & Virtual Assistants", icon: MessageSquare, desc: "Context-aware conversational assistants for 24/7 client & staff support." },
  { title: "Retrieval-Augmented Generation (RAG)", icon: Database, desc: "Ground AI responses in your company's proprietary document databases." },
  { title: "AI Agent Development", icon: Bot, desc: "Autonomous agents capable of reasoning, planning, and executing tasks." },
  { title: "Multi-Agent Orchestration", icon: Network, desc: "Coordinated swarms of specialized agents executing complex workflows." },
  { title: "Large Language Model Integration", icon: BrainCircuit, desc: "Seamless deployment of OpenAI, Gemini, Anthropic, and open-weights models." },
  { title: "AI-Powered Business Automation", icon: Zap, desc: "Eliminate manual tasks with intelligent triggers and rule-free automation." },
  { title: "Predictive Analytics & Forecasting", icon: BarChart3, desc: "Anticipate customer demand, inventory stock-outs, and sales trends." },
  { title: "Intelligent Document Processing", icon: FileText, desc: "Extract and structure data from invoices, receipts, contracts, and scans." },
  { title: "Custom AI Model Integration", icon: Cpu, desc: "Train, fine-tune, and self-host custom domain-specific AI models." },
  { title: "Voice AI & Conversational Systems", icon: Mic, desc: "Natural-sounding voice interfaces for phone ordering and desk operations." },
  { title: "Knowledge Management Systems", icon: Layers, desc: "Centralized internal knowledge bases queryable in plain English." },
];

// ============================================================================
// DATA: Cloud & Enterprise Infrastructure Services
// ============================================================================
const infrastructureServices = [
  { title: "Cloud Architecture & Migration", icon: Cloud, desc: "Plan, architect, and migrate workloads to resilient cloud environments." },
  { title: "AWS, Azure & Google Cloud Solutions", icon: Server, desc: "Certified engineering across all 3 major public cloud providers." },
  { title: "Server & Database Management", icon: Database, desc: "High-performance provisioning, clustering, tuning, and monitoring." },
  { title: "Cloud Security & Optimization", icon: ShieldCheck, desc: "Cut cloud waste, enforce least privilege, and encrypt data at rest." },
  { title: "DevOps & CI/CD Implementation", icon: Workflow, desc: "Automated test-build-deploy pipelines for frictionless code releases." },
  { title: "Docker & Kubernetes Deployment", icon: Boxes, desc: "Containerized environments with auto-scaling and zero-downtime rollouts." },
  { title: "Microservices Architecture", icon: Network, desc: "Decoupled, modular services enabling independent scaling and resilience." },
  { title: "Database Design & Optimization", icon: CodeXml, desc: "Relational, document, and vector databases optimized for throughput." },
  { title: "Infrastructure Monitoring", icon: BarChart3, desc: "24/7 observability, telemetry alerts, log aggregation, and health metrics." },
  { title: "Backup & Disaster Recovery", icon: Lock, desc: "Automated snapshotting, multi-region replication, and rapid RTO/RPO." },
  { title: "High Availability Architecture", icon: Zap, desc: "Fault-tolerant multi-zone deployments guaranteeing continuous uptime." },
  { title: "Enterprise System Integration", icon: Building2, desc: "Bridge on-premise hardware, ERPs, and cloud SaaS into one ecosystem." },
];

// ============================================================================
// DATA: 10 Industry Sectors
// ============================================================================
const industrySectors = [
  {
    title: "Retail & Supermarkets",
    icon: Store,
    desc: "Smart retail management, POS systems, inventory management, billing automation, customer engagement, and multi-store operations.",
    tag: "Retail & POS",
  },
  {
    title: "Gyms & Fitness Centers",
    icon: Dumbbell,
    desc: "Membership management, subscription automation, attendance tracking, biometric integrations, workout management, and performance analytics.",
    tag: "Fitness & Studios",
  },
  {
    title: "Salons & Spas",
    icon: Scissors,
    desc: "Appointment scheduling, customer management, service billing, staff management, loyalty programs, and business analytics.",
    tag: "Beauty & Wellness",
  },
  {
    title: "Restaurants & Cloud Kitchens",
    icon: Utensils,
    desc: "Restaurant POS, digital menus, QR ordering, kitchen management, table reservations, delivery management, and food inventory tracking.",
    tag: "Food & Hospitality",
  },
  {
    title: "Manufacturing & Industrial Operations",
    icon: Factory,
    desc: "Production planning, inventory tracking, supply chain management, equipment monitoring, quality control, and operational intelligence.",
    tag: "Industrial & Manufacturing",
  },
  {
    title: "Healthcare & Pharmacy",
    icon: Stethoscope,
    desc: "Patient management, appointment scheduling, pharmacy inventory, billing systems, operational workflows, and secure information management.",
    tag: "Health & Pharma",
  },
  {
    title: "Wholesale & Distribution",
    icon: Building2,
    desc: "Warehouse management, procurement, stock transfers, distributor management, order processing, and supply chain visibility.",
    tag: "B2B & Distribution",
  },
  {
    title: "Education & Training",
    icon: GraduationCap,
    desc: "Learning management systems, student administration, attendance tracking, assessments, and educational automation.",
    tag: "EdTech & Academies",
  },
  {
    title: "Logistics & Transportation",
    icon: Truck,
    desc: "Fleet management, shipment tracking, delivery optimization, warehouse coordination, and real-time operational monitoring.",
    tag: "Logistics & Fleet",
  },
  {
    title: "Enterprise & Multi-Branch Organizations",
    icon: Network,
    desc: "Centralized business management, multi-location operations, workforce management, consolidated reporting, and enterprise automation.",
    tag: "Multi-Location Enterprise",
  },
];

// ============================================================================
// DATA: Tech Stack Categories
// ============================================================================
const techStackCategories = [
  {
    title: "Frontend Development",
    icon: Globe,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    technologies: ["React.js", "Next.js", "JavaScript", "HTML5", "CSS3", "Responsive UI Development", "Tailwind CSS", "TypeScript"],
  },
  {
    title: "Backend Engineering",
    icon: CodeXml,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    technologies: ["Python", "FastAPI", "Node.js", "REST APIs", "Microservices Architecture", "GraphQL", "Django"],
  },
  {
    title: "Artificial Intelligence",
    icon: BrainCircuit,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    technologies: ["OpenAI", "GPT Models", "Gemini", "Claude", "LangChain", "LlamaIndex", "RAG", "AI Agents"],
  },
  {
    title: "Databases & Data Engineering",
    icon: Database,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    technologies: ["PostgreSQL", "MongoDB", "Redis", "SQL", "Data Pipelines", "Database Optimization", "Vector DBs"],
  },
  {
    title: "Cloud & Infrastructure",
    icon: Cloud,
    color: "text-sky-600 bg-sky-50 border-sky-200",
    technologies: ["AWS", "Microsoft Azure", "Google Cloud", "Docker", "Kubernetes", "CI/CD", "Terraform"],
  },
  {
    title: "Enterprise Platforms",
    icon: Server,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    technologies: ["SAP", "Salesforce", "ERP Integrations", "CRM Integrations", "Third-Party APIs", "SAP S/4HANA"],
  },
  {
    title: "Testing & Security",
    icon: ShieldCheck,
    color: "text-rose-600 bg-rose-50 border-rose-200",
    technologies: ["Pytest", "API Testing", "Automation Testing", "Performance Testing", "Application Security", "OWASP"],
  },
];

// ============================================================================
// DATA: Delivery Approach
// ============================================================================
const deliverySteps = [
  {
    step: "01",
    name: "Discover & Understand",
    desc: "We begin by understanding your business, existing infrastructure, operational challenges, and project objectives.",
    icon: Compass,
  },
  {
    step: "02",
    name: "Plan & Architect",
    desc: "Our engineering team defines the solution architecture, technology stack, development roadmap, and implementation strategy.",
    icon: Layers,
  },
  {
    step: "03",
    name: "Design & Develop",
    desc: "We transform requirements into intuitive digital experiences and robust software solutions using modern engineering practices.",
    icon: CodeXml,
  },
  {
    step: "04",
    name: "Integrate & Validate",
    desc: "We integrate the solution with your existing systems and conduct comprehensive functional, performance, and security testing.",
    icon: CheckCircle2,
  },
  {
    step: "05",
    name: "Deploy & Launch",
    desc: "We manage deployment, infrastructure configuration, production readiness, and system optimization.",
    icon: Zap,
  },
  {
    step: "06",
    name: "Support & Scale",
    desc: "Our engagement continues with ongoing maintenance, technical support, performance improvements, and future enhancements.",
    icon: TrendingUp,
  },
];

// ============================================================================
// DATA: Why Choose IOTRONICS?
// ============================================================================
const whyChooseReasons = [
  {
    title: "Business-Driven Engineering",
    desc: "Every solution is designed around real business requirements, operational challenges, and measurable outcomes.",
    icon: Briefcase,
  },
  {
    title: "AI-First Innovation",
    desc: "We integrate intelligent technologies to automate processes, improve productivity, and unlock new opportunities.",
    icon: BrainCircuit,
  },
  {
    title: "Scalable Architecture",
    desc: "Our solutions are engineered to support business expansion, increasing workloads, and evolving requirements.",
    icon: Boxes,
  },
  {
    title: "End-to-End Development",
    desc: "From initial consultation and architecture to development, deployment, and ongoing support, we manage the complete technology lifecycle.",
    icon: Workflow,
  },
  {
    title: "Seamless Integration",
    desc: "We connect applications, databases, enterprise platforms, and third-party services into unified digital ecosystems.",
    icon: Network,
  },
  {
    title: "Security & Reliability",
    desc: "We prioritize secure development practices, data protection, system reliability, and infrastructure resilience.",
    icon: ShieldCheck,
  },
  {
    title: "Flexible Engagement Models",
    desc: "We support project-based development, dedicated engineering teams, consulting, and long-term technology partnerships.",
    icon: Users,
  },
];

// ============================================================================
// MAIN SERVICES PAGE TEMPLATE
// ============================================================================
export function ServicesPageTemplate() {
  const [consultModalOpen, setConsultModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState("Web Application Development");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    requirements: "",
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setTimeout(() => {
      setFormSubmitted(false);
      setConsultModalOpen(false);
      setFormData({ name: "", email: "", phone: "", company: "", requirements: "" });
    }, 2800);
  };

  return (
    <div className="w-full bg-[#f8fafd] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      
      {/* ===================================================================
          1. HERO SECTION
          =================================================================== */}
      <section className="relative overflow-hidden pt-10 sm:pt-14 md:pt-18 pb-14 sm:pb-20 px-4 sm:px-6 2xl:px-12 bg-gradient-to-b from-[#fbf9fe] via-[#f4edfd] to-[#f8fafd] border-b border-purple-100/80">
        {/* Soft Ambient Radial Lights */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-purple-200/50 via-indigo-100/30 to-transparent rounded-full blur-[130px]" />
        <div className="pointer-events-none absolute top-1/3 right-10 w-[450px] h-[450px] bg-pink-300/20 rounded-full blur-[100px]" />

        <div className="relative mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            
            {/* Left Hero Content */}
            <div className="lg:col-span-7 flex flex-col items-start z-10">
              {/* Eyebrow Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/90 bg-white/95 px-3.5 py-1 text-xs font-bold shadow-2xs backdrop-blur-md">
                <span className="grid size-4 place-items-center rounded-sm bg-purple-100 text-purple-700">
                  <Sparkles className="size-2.5 text-purple-700" />
                </span>
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-purple-800 font-mono">
                  ENTERPRISE SERVICES &amp; SOLUTIONS
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="mt-4 text-3xl sm:text-5xl lg:text-[46px] xl:text-[54px] 2xl:text-[60px] font-black tracking-tight text-slate-950 leading-[1.12]">
                End-to-End Technology Services for{" "}
                <span className="relative inline-block bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-900 bg-clip-text text-transparent">
                  Modern Businesses.
                  {/* Purple Brush Underline */}
                  <svg
                    className="absolute -bottom-2 sm:-bottom-2.5 left-0 w-full h-3 sm:h-4 text-purple-600 pointer-events-none"
                    viewBox="0 0 250 24"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M4 18C75 7 175 6 246 17"
                      stroke="currentColor"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>

              {/* Description Paragraphs */}
              <p className="mt-6 text-sm sm:text-base 2xl:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl">
                From intelligent application development to enterprise automation, cloud infrastructure, and AI-powered transformation, IOTRONICS delivers technology solutions that help businesses operate smarter, scale faster, and innovate confidently.
              </p>
              <p className="mt-3 text-xs sm:text-sm 2xl:text-base text-slate-600 leading-relaxed font-normal max-w-2xl">
                We combine engineering expertise, artificial intelligence, and modern digital technologies to transform complex business challenges into scalable solutions.
              </p>

              {/* CTAs */}
              <div className="mt-7 flex flex-wrap items-center gap-3.5">
                <a
                  href="#expertise"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/35 cursor-pointer"
                >
                  <span>Explore Our Services</span>
                  <ArrowRight className="size-4" />
                </a>

                <button
                  type="button"
                  onClick={() => setConsultModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white/90 hover:bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-xs transition-all hover:border-purple-300 hover:text-purple-700 cursor-pointer"
                >
                  <Calendar className="size-4 text-purple-600" />
                  <span>Schedule a Consultation</span>
                </button>
              </div>

              {/* Tagline / Trust Badges */}
              <div className="mt-8 pt-6 border-t border-purple-200/60 w-full flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5 bg-white/80 border border-purple-100 rounded-lg px-3 py-1.5 shadow-2xs">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>Trusted Technology</span>
                </span>
                <span className="flex items-center gap-1.5 bg-white/80 border border-purple-100 rounded-lg px-3 py-1.5 shadow-2xs">
                  <Sparkles className="size-3.5 text-purple-600" />
                  <span>Intelligent Solutions</span>
                </span>
                <span className="flex items-center gap-1.5 bg-white/80 border border-purple-100 rounded-lg px-3 py-1.5 shadow-2xs">
                  <TrendingUp className="size-3.5 text-indigo-600" />
                  <span>Measurable Business Impact</span>
                </span>
              </div>
            </div>

            {/* Right Hero Visual: Architectural Overview Grid */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-[500px] w-full rounded-3xl bg-white/90 backdrop-blur-xl border border-purple-200/90 p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full bg-rose-500" />
                    <span className="size-3 rounded-full bg-amber-500" />
                    <span className="size-3 rounded-full bg-emerald-500" />
                  </div>
                  <span className="text-[11px] font-bold text-purple-700 font-mono uppercase tracking-wider">
                    IOTRONICS Core Services
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4 transition-all hover:bg-purple-50">
                    <div className="size-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <BrainCircuit className="size-4.5" />
                    </div>
                    <div className="mt-2 text-xs font-bold text-slate-900">AI &amp; Automation</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Autonomous agents &amp; RAG</div>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 transition-all hover:bg-blue-50">
                    <div className="size-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <Globe className="size-4.5" />
                    </div>
                    <div className="mt-2 text-xs font-bold text-slate-900">Custom Engineering</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Full-stack web &amp; mobile</div>
                  </div>

                  <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 transition-all hover:bg-sky-50">
                    <div className="size-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
                      <Cloud className="size-4.5" />
                    </div>
                    <div className="mt-2 text-xs font-bold text-slate-900">Cloud &amp; DevOps</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">AWS, Azure &amp; K8s clusters</div>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 transition-all hover:bg-emerald-50">
                    <div className="size-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <ShieldCheck className="size-4.5" />
                    </div>
                    <div className="mt-2 text-xs font-bold text-slate-900">Security &amp; QA</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Zero-trust &amp; SOC-2 grade</div>
                  </div>
                </div>

                <div className="rounded-2xl bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-4 shadow-md flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider font-mono">
                      Enterprise Grade SLA
                    </span>
                    <div className="text-base font-extrabold text-white mt-0.5">
                      99.99% Uptime &amp; 24/7 Ops
                    </div>
                  </div>
                  <Sparkles className="size-6 text-purple-300 animate-pulse" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===================================================================
          2. OUR TECHNOLOGY EXPERTISE (10 Core Services)
          =================================================================== */}
      <section id="expertise" className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-white border-b border-slate-200/80 scroll-mt-24">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          {/* Header */}
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">
              <Sparkles className="size-3" /> OUR TECHNOLOGY EXPERTISE
            </span>
            <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Everything Your Business Needs to{" "}
              <span className="bg-gradient-to-r from-purple-700 to-indigo-600 bg-clip-text text-transparent">
                Innovate and Scale.
              </span>
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              We bring together software engineering, AI innovation, enterprise platforms, and digital infrastructure to support your complete technology journey.
            </p>
          </div>

          {/* 10 Technology Services Grid */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 2xl:gap-5">
            {technologyExpertise.map((srv) => {
              const IconComp = srv.icon;
              return (
                <div
                  key={srv.id}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-lg hover:border-purple-300/80 hover:-translate-y-1 transition-all duration-300"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className={`size-10 rounded-xl bg-gradient-to-br ${srv.color} flex items-center justify-center border shadow-2xs group-hover:scale-105 transition-transform`}>
                        <IconComp className="size-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                        {srv.badge}
                      </span>
                    </div>

                    <h3 className="mt-4 text-base font-bold text-slate-950 group-hover:text-purple-700 transition-colors">
                      {srv.title}
                    </h3>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                      {srv.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <ul className="space-y-1 mb-3">
                      {srv.highlights.map((h) => (
                        <li key={h} className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <Check className="size-3 text-purple-600 shrink-0" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedService(srv.title);
                        setConsultModalOpen(true);
                      }}
                      className="text-xs font-bold text-purple-700 hover:text-purple-800 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
                    >
                      <span>Consult on this</span>
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ===================================================================
          3. CUSTOM SOFTWARE DEVELOPMENT (10 Capabilities)
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-[#f6f3fb]/60 border-b border-purple-100/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">
              CUSTOM SOFTWARE DEVELOPMENT
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Technology Built Around Your Business.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              Your business deserves more than off-the-shelf software. We develop customized digital solutions that align with your workflows, operational requirements, and long-term business objectives.
            </p>
          </div>

          <div className="mt-8">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 font-mono mb-4">
              Our Development Capabilities
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {customDevCapabilities.map((cap) => {
                const Icon = cap.icon;
                return (
                  <div
                    key={cap.title}
                    className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all group"
                  >
                    <div className="size-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <Icon className="size-4.5" />
                    </div>
                    <h4 className="mt-3 text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                      {cap.title}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {cap.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </section>

      {/* ===================================================================
          4. ARTIFICIAL INTELLIGENCE & AUTOMATION (12 Capabilities)
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-white border-b border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-fuchsia-700 uppercase tracking-wider font-mono">
              ARTIFICIAL INTELLIGENCE &amp; AUTOMATION
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Make Your Business Intelligent with AI.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              Move beyond traditional software with intelligent systems that understand, analyze, automate, and continuously improve business operations. We help organizations adopt practical AI solutions that deliver measurable operational value.
            </p>
          </div>

          <div className="mt-8">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 font-mono mb-4">
              Our AI Capabilities
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {aiCapabilities.map((ai) => {
                const Icon = ai.icon;
                return (
                  <div
                    key={ai.title}
                    className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-2xs hover:shadow-md hover:border-fuchsia-300 transition-all group"
                  >
                    <div className="size-9 rounded-xl bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200/60 flex items-center justify-center group-hover:bg-fuchsia-600 group-hover:text-white transition-colors">
                      <Icon className="size-4.5" />
                    </div>
                    <h4 className="mt-3 text-sm font-bold text-slate-900 group-hover:text-fuchsia-700 transition-colors">
                      {ai.title}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {ai.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </section>

      {/* ===================================================================
          5. CLOUD & ENTERPRISE INFRASTRUCTURE (12 Services)
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-[#f8fafd] border-b border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-sky-700 uppercase tracking-wider font-mono">
              CLOUD &amp; ENTERPRISE INFRASTRUCTURE
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Build a Strong Foundation for Digital Growth.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              Create secure, scalable, and highly available technology infrastructure that supports your business today and prepares it for tomorrow.
            </p>
          </div>

          <div className="mt-8">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 font-mono mb-4">
              Our Infrastructure Services
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {infrastructureServices.map((infra) => {
                const Icon = infra.icon;
                return (
                  <div
                    key={infra.title}
                    className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-2xs hover:shadow-md hover:border-sky-300 transition-all group"
                  >
                    <div className="size-9 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/60 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors">
                      <Icon className="size-4.5" />
                    </div>
                    <h4 className="mt-3 text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                      {infra.title}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {infra.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </section>

      {/* ===================================================================
          6. OUR INDUSTRY EXPERIENCE (10 Sectors)
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-white border-b border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">
              OUR INDUSTRY EXPERIENCE
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Technology Solutions for Every Business Sector.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              We understand that every industry has unique operational challenges. Our solutions are designed to adapt to different business models, workflows, and industry requirements.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {industrySectors.map((sec) => {
              const Icon = sec.icon;
              return (
                <div
                  key={sec.title}
                  className="rounded-2xl border border-slate-200/90 bg-[#fafbfe] p-5 shadow-2xs hover:bg-white hover:border-purple-300 hover:shadow-md transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="size-10 rounded-xl bg-purple-100/70 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Icon className="size-5" />
                      </div>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded-md font-mono">
                        {sec.tag}
                      </span>
                    </div>

                    <h3 className="mt-4 text-base font-bold text-slate-950 group-hover:text-purple-700 transition-colors">
                      {sec.title}
                    </h3>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed font-normal">
                      {sec.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ===================================================================
          7. OUR TECHNOLOGY STACK (7 Tech Categories)
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-[#f8fafd] border-b border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider font-mono">
              OUR TECHNOLOGY STACK
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Powered by Modern Technologies. Built for the Future.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              We leverage proven technologies and modern development frameworks to create reliable, scalable, and intelligent digital solutions.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {techStackCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.title}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`size-8 rounded-lg flex items-center justify-center border shadow-2xs ${cat.color}`}>
                      <Icon className="size-4.5" />
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{cat.title}</h3>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {cat.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-lg bg-slate-50 border border-slate-200/90 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ===================================================================
          8. OUR DELIVERY APPROACH (6 Phases)
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-white border-b border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">
              OUR DELIVERY APPROACH
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              From Business Challenges to Intelligent Solutions.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              We follow a structured engineering approach to ensure every solution is aligned with business goals and technical requirements.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {deliverySteps.map((st) => {
              const Icon = st.icon;
              return (
                <div
                  key={st.step}
                  className="rounded-2xl border border-slate-200/90 bg-[#fafbfe] p-5 shadow-2xs hover:bg-white hover:border-purple-300 hover:shadow-md transition-all group flex flex-col justify-between"
                >
                  <div>
                    <span className="text-2xl font-black text-purple-600 font-mono">
                      {st.step}
                    </span>
                    <div className="mt-3 size-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Icon className="size-4.5" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-slate-950 group-hover:text-purple-700 transition-colors">
                      {st.name}
                    </h3>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed font-normal">
                      {st.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ===================================================================
          9. WHY CHOOSE IOTRONICS? (7 Pillars)
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-gradient-to-b from-[#fbf9fe] via-[#f7f2fc] to-white border-b border-purple-100/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">
              WHY CHOOSE IOTRONICS?
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Your Technology Partner for Long-Term Growth.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              We combine technical expertise, business understanding, and intelligent engineering to deliver solutions that create lasting value.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {whyChooseReasons.map((rc) => {
              const Icon = rc.icon;
              return (
                <div
                  key={rc.title}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all group"
                >
                  <div className="size-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-950 group-hover:text-purple-700 transition-colors">
                    {rc.title}
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed font-normal">
                    {rc.desc}
                  </p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ===================================================================
          10. BUSINESS TRANSFORMATION & 11. FINAL CTA
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-white border-b border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="rounded-3xl bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-950 text-white p-8 sm:p-12 2xl:p-16 shadow-2xl relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="pointer-events-none absolute -top-20 -right-20 size-96 rounded-full bg-purple-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 size-96 rounded-full bg-indigo-500/20 blur-3xl" />

            <div className="relative z-10 max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-200 uppercase tracking-wider font-mono">
                <Sparkles className="size-3 text-purple-300" /> BUSINESS TRANSFORMATION
              </span>

              <h2 className="mt-4 text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.15]">
                Transform Your Ideas into Powerful Digital Solutions.
              </h2>

              <p className="mt-4 text-sm sm:text-base text-purple-100/90 leading-relaxed font-normal">
                Whether you are building a new product, modernizing existing systems, integrating AI, or transforming enterprise operations, IOTRONICS is ready to help.
              </p>
              <p className="mt-2 text-xs sm:text-sm text-purple-200/80 leading-relaxed font-normal">
                Let's discuss your requirements and create a technology roadmap that moves your business forward.
              </p>

              <div className="mt-6 font-extrabold text-white text-base sm:text-lg">
                Let's Build Something Intelligent Together.
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => setConsultModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-purple-900 hover:bg-purple-50 px-6 py-3 text-sm font-bold shadow-lg transition-all hover:scale-105 cursor-pointer"
                >
                  <span>Talk to Our Experts</span>
                  <ArrowRight className="size-4" />
                </button>

                <a
                  href="#contact"
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-400/40 bg-purple-800/40 hover:bg-purple-800/70 text-white px-5 py-3 text-sm font-bold shadow-xs transition-all cursor-pointer backdrop-blur-sm"
                >
                  <Calendar className="size-4 text-purple-300" />
                  <span>Schedule a Consultation</span>
                </a>
              </div>

              <div className="mt-10 pt-6 border-t border-purple-800/60 text-xs text-purple-300/90 font-mono tracking-wider">
                IOTRONICS – Engineering Intelligence. Empowering Businesses.
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ===================================================================
          12. CONTACT SECTION
          =================================================================== */}
      <section id="contact" className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-[#f8fafd] scroll-mt-24">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            
            {/* Left Column: Direct Info */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">
                  CONTACT SECTION
                </span>
                <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
                  Let's Talk About Your Project.
                </h2>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed font-normal">
                  Have a business challenge, a technology requirement, or an innovative idea? Our team is ready to understand your needs and explore the right solution.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                  <div className="size-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center justify-center shrink-0">
                    <Mail className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">Email</div>
                    <a
                      href="mailto:contact@iotronics.io"
                      className="text-sm font-semibold text-purple-700 hover:underline"
                    >
                      contact@iotronics.io
                    </a>
                    <div className="text-xs text-slate-500 mt-0.5">Contact our technical team directly</div>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                  <div className="size-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center justify-center shrink-0">
                    <Phone className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">Phone</div>
                    <a
                      href="tel:+18005550199"
                      className="text-sm font-semibold text-indigo-700 hover:underline"
                    >
                      +1 (800) 555-0199 / +91 98765 43210
                    </a>
                    <div className="text-xs text-slate-500 mt-0.5">Get in touch with our solutions architects</div>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
                  <div className="size-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/60 flex items-center justify-center shrink-0">
                    <MapPin className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">Location</div>
                    <div className="text-sm font-semibold text-slate-900">
                      Silicon Valley • London • Bengaluru • Singapore
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Connect with IOTRONICS global delivery centers</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Requirements Form */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-lg">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">Send Us Your Requirements</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tell us about your project scope, timeline, and goals.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-mono">
                    Fast Response (&lt; 24h)
                  </span>
                </div>

                {formSubmitted ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="mx-auto size-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <CheckCircle2 className="size-7" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-900">Requirements Received!</h4>
                    <p className="text-xs text-slate-600 max-w-md mx-auto">
                      Thank you for contacting IOTRONICS. Our enterprise solutions team has received your inquiry and will reach out with a technical roadmap within 24 hours.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Jane Doe"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Work Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="jane@company.com"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+1 (555) 000-0000"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Company / Organization
                        </label>
                        <input
                          type="text"
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          placeholder="Acme Enterprises Ltd"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Primary Service of Interest
                      </label>
                      <select
                        value={selectedService}
                        onChange={(e) => setSelectedService(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
                      >
                        {technologyExpertise.map((srv) => (
                          <option key={srv.id} value={srv.title}>
                            {srv.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Project Overview &amp; Requirements *
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={formData.requirements}
                        onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                        placeholder="Describe your operational goals, existing systems, expected timelines, or technical requirements..."
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 px-6 py-3 text-xs font-bold text-white shadow-md shadow-purple-500/25 hover:shadow-lg transition-all hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="size-4" />
                      <span>Submit Project Requirements</span>
                    </button>
                  </form>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===================================================================
          CONSULTATION MODAL
          =================================================================== */}
      {consultModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setConsultModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase font-mono tracking-wider">
              <Calendar className="size-4" /> Schedule a Consultation
            </div>
            <h3 className="mt-1 text-xl font-extrabold text-slate-950">
              Speak with a Principal Solutions Architect
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Select your service area and we'll connect you with a specialist to review architecture and scoping.
            </p>

            <form onSubmit={handleFormSubmit} className="mt-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Alex Morgan"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  placeholder="alex@enterprise.com"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Area</label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-purple-600 focus:outline-none bg-white"
                >
                  {technologyExpertise.map((srv) => (
                    <option key={srv.id} value={srv.title}>
                      {srv.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Brief Description</label>
                <textarea
                  rows={3}
                  placeholder="What is your primary project goal or business challenge?"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-purple-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white py-2.5 text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Confirm Consultation Request
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default ServicesPageTemplate;

