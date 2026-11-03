"use client";

import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Lock,
  Key,
  Server,
  Cpu,
  Globe,
  Database,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Eye,
  Search,
  Zap,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  Send,
  X,
  Calendar,
  Building2,
  Store,
  Dumbbell,
  Scissors,
  Utensils,
  Stethoscope,
  Factory,
  Boxes,
  Network,
  Users,
  Compass,
  TrendingUp,
  FileText,
  Terminal,
  Radio,
} from "lucide-react";

// ============================================================================
// DATA: 6 Security Pillars
// ============================================================================
const securityPillars = [
  {
    title: "Application Security",
    icon: Globe,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    desc: "Protect applications throughout their development and deployment lifecycle with secure coding practices, vulnerability assessments, API protection, and application security testing.",
    bullets: ["Secure Coding & SAST/DAST", "API Gateways & Rate Limiting", "Web Application Firewall (WAF)"],
  },
  {
    title: "Infrastructure Security",
    icon: Server,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    desc: "Strengthen your cloud environments, servers, networks, and enterprise infrastructure through security architecture, configuration management, and continuous monitoring.",
    bullets: ["Cloud Hardening (AWS/Azure/GCP)", "Container & Kubernetes Security", "VPC Network Segmentation"],
  },
  {
    title: "Identity & Access Management",
    icon: Key,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    desc: "Ensure that the right people have the right access to the right resources through identity verification, role-based access control, and multi-factor authentication.",
    bullets: ["Role-Based Access Control (RBAC)", "Multi-Factor Authentication (MFA)", "SSO & Privileged Access (PAM)"],
  },
  {
    title: "Data Protection & Privacy",
    icon: Lock,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    desc: "Protect sensitive business information through encryption, secure data storage, access restrictions, backup strategies, and data governance.",
    bullets: ["AES-256 Encryption at Rest", "TLS 1.3 Encryption in Transit", "Automated Backup & Disaster Recovery"],
  },
  {
    title: "Threat Detection & Response",
    icon: Radio,
    color: "text-rose-600 bg-rose-50 border-rose-200",
    desc: "Identify suspicious activities, investigate potential threats, and support rapid incident response through intelligent monitoring and security analysis.",
    bullets: ["24/7 SIEM Threat Telemetry", "Automated Anomaly Alerts", "Rapid Incident Containment"],
  },
  {
    title: "Compliance & Governance",
    icon: FileCheck,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    desc: "Improve security governance through policy management, audit readiness, access reviews, risk assessments, and compliance-focused security practices.",
    bullets: ["SOC-2 & ISO 27001 Readiness", "GDPR & Data Privacy Policies", "Immutable Security Audit Logs"],
  },
];

// ============================================================================
// DATA: 10 Core Security Services
// ============================================================================
const coreSecurityServices = [
  {
    number: "01",
    title: "Cybersecurity Assessment",
    subtitle: "Identify security weaknesses before they become business risks.",
    icon: Search,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    items: [
      "Infrastructure Security Assessment",
      "Application Vulnerability Assessment",
      "Network Security Assessment",
      "Security Configuration Reviews",
      "Risk Identification & Analysis",
      "Security Recommendations",
    ],
  },
  {
    number: "02",
    title: "Vulnerability Assessment & Penetration Testing",
    subtitle: "Discover and address security weaknesses through controlled security testing.",
    icon: Terminal,
    color: "text-rose-600 bg-rose-50 border-rose-200",
    items: [
      "Web Application Penetration Testing",
      "API Security Testing",
      "Network Penetration Testing",
      "Infrastructure Vulnerability Scanning",
      "Security Misconfiguration Detection",
      "Remediation Guidance",
    ],
  },
  {
    number: "03",
    title: "Cloud Security",
    subtitle: "Protect your cloud infrastructure and enterprise workloads across modern cloud environments.",
    icon: Cloud,
    color: "text-sky-600 bg-sky-50 border-sky-200",
    items: [
      "AWS Security",
      "Microsoft Azure Security",
      "Google Cloud Security",
      "Cloud Identity & Access Management",
      "Cloud Configuration Assessment",
      "Infrastructure Security Monitoring",
      "Cloud Data Protection",
      "Secure Cloud Architecture",
    ],
  },
  {
    number: "04",
    title: "Application & API Security",
    subtitle: "Secure your applications, services, and integrations against unauthorized access and common security vulnerabilities.",
    icon: Globe,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    items: [
      "Secure Application Architecture",
      "API Authentication & Authorization",
      "API Security Testing",
      "Secure Coding Practices",
      "Web Application Firewall Integration",
      "Application Vulnerability Management",
      "Secure Development Lifecycle",
    ],
  },
  {
    number: "05",
    title: "Identity & Access Management",
    subtitle: "Manage digital identities and secure access across your organization.",
    icon: Key,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    items: [
      "Role-Based Access Control (RBAC)",
      "Multi-Factor Authentication (MFA)",
      "Single Sign-On (SSO)",
      "User Authentication",
      "Privileged Access Management",
      "Identity Lifecycle Management",
      "Access Monitoring & Auditing",
    ],
  },
  {
    number: "06",
    title: "Data Security & Encryption",
    subtitle: "Keep your business information protected throughout its lifecycle.",
    icon: Lock,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    items: [
      "Data Encryption at Rest",
      "Data Encryption in Transit",
      "Database Security",
      "Sensitive Data Protection",
      "Secure Data Access",
      "Data Backup & Recovery",
      "Data Loss Prevention Strategies",
    ],
  },
  {
    number: "07",
    title: "Network & Endpoint Security",
    subtitle: "Secure your business networks, devices, and connected systems.",
    icon: Network,
    color: "text-teal-600 bg-teal-50 border-teal-200",
    items: [
      "Network Security Architecture",
      "Firewall Configuration",
      "Endpoint Protection",
      "Intrusion Detection & Prevention",
      "Secure Remote Access",
      "Network Traffic Monitoring",
      "Device Security Management",
    ],
  },
  {
    number: "08",
    title: "Security Monitoring & Incident Response",
    subtitle: "Improve your ability to identify, investigate, and respond to security incidents.",
    icon: Radio,
    color: "text-amber-600 bg-amber-50 border-amber-200",
    items: [
      "Security Event Monitoring",
      "Log Management & Analysis",
      "Threat Detection",
      "Incident Investigation",
      "Security Alert Management",
      "Incident Response Planning",
      "Recovery & Remediation Support",
    ],
  },
  {
    number: "09",
    title: "Security Compliance & Governance",
    subtitle: "Establish security policies and controls that support enterprise governance and regulatory requirements.",
    icon: FileCheck,
    color: "text-fuchsia-600 bg-fuchsia-50 border-fuchsia-200",
    items: [
      "Security Policy Development",
      "Risk Management",
      "Security Audits",
      "Access Control Audits",
      "Compliance Readiness",
      "Security Documentation",
      "Governance & Control Assessments",
    ],
  },
  {
    number: "10",
    title: "DevSecOps & Security Automation",
    subtitle: "Integrate security into your software development and deployment pipelines.",
    icon: Cpu,
    color: "text-cyan-600 bg-cyan-50 border-cyan-200",
    items: [
      "Secure CI/CD Pipelines",
      "Automated Security Testing",
      "Dependency Vulnerability Scanning",
      "Container Security",
      "Infrastructure-as-Code Security",
      "Secrets Management",
      "Security Policy Automation",
    ],
  },
];

// ============================================================================
// DATA: 6 Enterprise Security Architecture Layers
// ============================================================================
const architectureLayers = [
  {
    layer: "01",
    title: "User & Identity Protection",
    desc: "Secure employee, administrator, and customer identities with controlled authentication and authorization.",
    icon: Users,
  },
  {
    layer: "02",
    title: "Application Protection",
    desc: "Protect web applications, mobile applications, APIs, and business platforms.",
    icon: Globe,
  },
  {
    layer: "03",
    title: "Network Protection",
    desc: "Monitor network activities, control access, and protect internal and external communication channels.",
    icon: Network,
  },
  {
    layer: "04",
    title: "Infrastructure Protection",
    desc: "Secure servers, cloud environments, databases, and connected enterprise systems.",
    icon: Server,
  },
  {
    layer: "05",
    title: "Data Protection",
    desc: "Safeguard business-critical information through encryption, access policies, and recovery mechanisms.",
    icon: Lock,
  },
  {
    layer: "06",
    title: "Continuous Security Monitoring",
    desc: "Monitor security events, investigate suspicious activities, and improve incident response readiness.",
    icon: Activity,
  },
];

// ============================================================================
// DATA: Security For Every Business (8 Sectors)
// ============================================================================
const businessSectors = [
  {
    title: "Retail & Supermarkets",
    icon: Store,
    desc: "Protect POS systems, customer information, payment integrations, inventory platforms, and multi-branch business applications.",
  },
  {
    title: "Gyms & Fitness Centers",
    icon: Dumbbell,
    desc: "Secure membership information, biometric integrations, employee accounts, payment records, and fitness management platforms.",
  },
  {
    title: "Salons & Spas",
    icon: Scissors,
    desc: "Protect customer profiles, appointment information, employee access, payment systems, and business records.",
  },
  {
    title: "Restaurants & Cloud Kitchens",
    icon: Utensils,
    desc: "Secure digital ordering systems, QR-based menus, POS applications, customer information, and payment integrations.",
  },
  {
    title: "Healthcare & Pharmacy",
    icon: Stethoscope,
    desc: "Strengthen access controls, protect sensitive records, secure healthcare applications, and support privacy-focused data management.",
  },
  {
    title: "Manufacturing & Industrial Operations",
    icon: Factory,
    desc: "Protect production systems, connected infrastructure, operational databases, industrial networks, and enterprise applications.",
  },
  {
    title: "Wholesale & Distribution",
    icon: Boxes,
    desc: "Secure supplier information, financial transactions, inventory records, warehouse systems, and business integrations.",
  },
  {
    title: "Enterprise & Multi-Branch Organizations",
    icon: Building2,
    desc: "Centralize security policies, identity management, access governance, infrastructure monitoring, and security reporting across locations.",
  },
];

// ============================================================================
// DATA: 6 Security Tech Capabilities
// ============================================================================
const securityTechnologies = [
  {
    category: "Application & API Security",
    icon: Globe,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    tags: ["OWASP Security Practices", "API Authentication", "OAuth 2.0", "JWT", "Secure Coding"],
  },
  {
    category: "Cloud Security",
    icon: Cloud,
    color: "text-sky-600 bg-sky-50 border-sky-200",
    tags: ["AWS Security", "Azure Security", "Google Cloud Security", "Cloud IAM"],
  },
  {
    category: "Identity & Access Management",
    icon: Key,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    tags: ["RBAC", "MFA", "SSO", "Identity Governance", "Privileged Access Controls"],
  },
  {
    category: "Infrastructure & Network Security",
    icon: Network,
    color: "text-teal-600 bg-teal-50 border-teal-200",
    tags: ["Firewalls", "VPN", "Network Segmentation", "Endpoint Protection", "Intrusion Detection"],
  },
  {
    category: "Security Automation",
    icon: Cpu,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    tags: ["DevSecOps", "CI/CD Security", "Automated Vulnerability Scanning", "Container Security"],
  },
  {
    category: "Data Protection",
    icon: Lock,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    tags: ["Encryption", "Secure Database Access", "Backup & Recovery", "Data Governance"],
  },
];

// ============================================================================
// DATA: 6 Security Lifecycle Phases
// ============================================================================
const lifecycleSteps = [
  {
    step: "01",
    name: "Discover",
    desc: "Understand your business environment, technology infrastructure, applications, and critical digital assets.",
    icon: Compass,
  },
  {
    step: "02",
    name: "Assess",
    desc: "Identify vulnerabilities, configuration weaknesses, access risks, and potential security gaps.",
    icon: Search,
  },
  {
    step: "03",
    name: "Protect",
    desc: "Implement appropriate security controls, authentication mechanisms, encryption, and infrastructure safeguards.",
    icon: ShieldCheck,
  },
  {
    step: "04",
    name: "Monitor",
    desc: "Establish security visibility through monitoring, logging, alerting, and threat analysis.",
    icon: Activity,
  },
  {
    step: "05",
    name: "Respond",
    desc: "Support incident investigation, containment, remediation, and recovery planning.",
    icon: Zap,
  },
  {
    step: "06",
    name: "Improve",
    desc: "Review security controls, strengthen policies, and continuously improve your security strategy.",
    icon: TrendingUp,
  },
];

// ============================================================================
// DATA: Why Choose IOTRONICS Security?
// ============================================================================
const whyChooseReasons = [
  {
    title: "Security-First Engineering",
    desc: "We consider security throughout the application development and infrastructure lifecycle.",
    icon: ShieldCheck,
  },
  {
    title: "Proactive Risk Management",
    desc: "Identify potential weaknesses and address security risks before they affect business operations.",
    icon: Eye,
  },
  {
    title: "Enterprise-Ready Architecture",
    desc: "Design security solutions that support growing businesses, complex infrastructure, and multi-branch environments.",
    icon: Building2,
  },
  {
    title: "Integrated Security Approach",
    desc: "Connect application, cloud, identity, network, and data protection into a unified security strategy.",
    icon: Layers,
  },
  {
    title: "Continuous Improvement",
    desc: "Help organizations strengthen their security posture through regular assessments and ongoing improvements.",
    icon: TrendingUp,
  },
  {
    title: "Business-Focused Solutions",
    desc: "Align security investments with business priorities, operational requirements, and technology goals.",
    icon: CheckCircle2,
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function SecurityPageTemplate() {
  const [assessmentModalOpen, setAssessmentModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState("Cybersecurity Assessment");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    concern: "",
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setTimeout(() => {
      setFormSubmitted(false);
      setAssessmentModalOpen(false);
      setFormData({ name: "", email: "", phone: "", company: "", concern: "" });
    }, 2800);
  };

  return (
    <div className="w-full bg-[#f8fafd] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      
      {/* ===================================================================
          1. HERO SECTION
          =================================================================== */}
      <section className="relative overflow-hidden pt-10 sm:pt-14 md:pt-18 pb-14 sm:pb-20 px-4 sm:px-6 2xl:px-12 bg-gradient-to-b from-[#fbf9fe] via-[#f3edf9] to-[#f8fafd] border-b border-purple-100/80">
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-purple-200/50 via-emerald-100/30 to-transparent rounded-full blur-[130px]" />
        <div className="pointer-events-none absolute top-1/3 right-10 w-[450px] h-[450px] bg-teal-200/20 rounded-full blur-[100px]" />

        <div className="relative mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-7 flex flex-col items-start z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/90 bg-white/95 px-3.5 py-1 text-xs font-bold shadow-2xs backdrop-blur-md">
                <span className="grid size-4 place-items-center rounded-sm bg-purple-100 text-purple-700">
                  <ShieldCheck className="size-3 text-purple-700" />
                </span>
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-purple-800 font-mono">
                  ENTERPRISE SECURITY &amp; DIGITAL TRUST
                </span>
              </div>

              <h1 className="mt-4 text-3xl sm:text-5xl lg:text-[46px] xl:text-[54px] 2xl:text-[60px] font-black tracking-tight text-slate-950 leading-[1.12]">
                Securing Your Digital World.{" "}
                <span className="relative inline-block bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-900 bg-clip-text text-transparent">
                  Protecting What Matters.
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

              <p className="mt-6 text-sm sm:text-base 2xl:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl">
                Protect your business, applications, infrastructure, and sensitive information with intelligent cybersecurity solutions designed for modern enterprises.
              </p>
              <p className="mt-3 text-xs sm:text-sm 2xl:text-base text-slate-600 leading-relaxed font-normal max-w-2xl">
                From proactive threat detection to enterprise access management, IOTRONICS helps organizations build secure, resilient, and trusted digital environments.
              </p>

              {/* CTAs */}
              <div className="mt-7 flex flex-wrap items-center gap-3.5">
                <a
                  href="#services"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/35 cursor-pointer"
                >
                  <span>Explore Security Solutions</span>
                  <ArrowRight className="size-4" />
                </a>

                <button
                  type="button"
                  onClick={() => setAssessmentModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white/90 hover:bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-xs transition-all hover:border-purple-300 hover:text-purple-700 cursor-pointer"
                >
                  <ShieldAlert className="size-4 text-purple-600" />
                  <span>Talk to a Security Expert</span>
                </button>
              </div>

              {/* Tagline Strip */}
              <div className="mt-8 pt-6 border-t border-purple-200/60 w-full flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5 bg-white/80 border border-purple-100 rounded-lg px-3 py-1.5 shadow-2xs">
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  <span>Intelligent Protection</span>
                </span>
                <span className="flex items-center gap-1.5 bg-white/80 border border-purple-100 rounded-lg px-3 py-1.5 shadow-2xs">
                  <Activity className="size-3.5 text-purple-600" />
                  <span>Continuous Monitoring</span>
                </span>
                <span className="flex items-center gap-1.5 bg-white/80 border border-purple-100 rounded-lg px-3 py-1.5 shadow-2xs">
                  <Lock className="size-3.5 text-indigo-600" />
                  <span>Trusted Operations</span>
                </span>
              </div>
            </div>

            {/* Right Hero Visual: Zero-Trust Defense Matrix */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-[480px] w-full rounded-3xl bg-white/95 backdrop-blur-xl border border-purple-200/90 p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-extrabold text-slate-900 font-mono">
                      ZERO-TRUST DEFENSE COCKPIT
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-mono">
                    STATUS: ACTIVE (100%)
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/60 border border-purple-100">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                        <Lock className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">Cryptographic Isolation</div>
                        <div className="text-[11px] text-slate-500">AES-256 + TLS 1.3 Strict</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200">
                      SECURED
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                        <Key className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">Identity &amp; RBAC Vault</div>
                        <div className="text-[11px] text-slate-500">MFA + Hardware Token Sync</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      VERIFIED
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-sky-50/60 border border-sky-100">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-sky-600 text-white flex items-center justify-center">
                        <Radio className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">SIEM Continuous Telemetry</div>
                        <div className="text-[11px] text-slate-500">24/7 Real-Time Anomaly Scan</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-sky-700 bg-white px-2 py-0.5 rounded border border-sky-200">
                      LIVE FEED
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-950 text-white p-4 shadow-md flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider font-mono">
                      Compliance Standards
                    </span>
                    <div className="text-sm font-extrabold text-white mt-0.5">
                      SOC-2 • ISO 27001 • OWASP Top 10
                    </div>
                  </div>
                  <ShieldCheck className="size-6 text-emerald-400" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===================================================================
          2. OUR SECURITY APPROACH (6 Pillars)
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-white border-b border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">
              <Shield className="size-3" /> OUR SECURITY APPROACH
            </span>
            <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Security Built Into Every Layer of Your Business.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              Modern businesses need more than traditional security tools. They need a connected security strategy that protects every application, user, device, and digital interaction.
            </p>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              IOTRONICS delivers integrated security solutions that help organizations identify vulnerabilities, minimize risks, protect critical assets, and maintain operational continuity.
            </p>
          </div>

          <div className="mt-10">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 font-mono mb-4">
              Our Security Pillars
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {securityPillars.map((pil) => {
                const Icon = pil.icon;
                return (
                  <div
                    key={pil.title}
                    className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-lg hover:border-purple-300 transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className={`size-10 rounded-xl flex items-center justify-center border shadow-2xs group-hover:scale-105 transition-transform ${pil.color}`}>
                          <Icon className="size-5" />
                        </div>
                      </div>

                      <h4 className="mt-4 text-base font-bold text-slate-950 group-hover:text-purple-700 transition-colors">
                        {pil.title}
                      </h4>
                      <p className="mt-2 text-xs text-slate-600 leading-relaxed font-normal">
                        {pil.desc}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <ul className="space-y-1">
                        {pil.bullets.map((b) => (
                          <li key={b} className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <CheckCircle2 className="size-3 text-purple-600 shrink-0" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </section>

      {/* ===================================================================
          3. CORE SECURITY SERVICES (10 Services)
          =================================================================== */}
      <section id="services" className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-[#f8fafd] border-b border-slate-200/80 scroll-mt-24">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">
              CORE SECURITY SERVICES
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Comprehensive Protection for Your Digital Infrastructure.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              We provide end-to-end security services designed to protect your business against evolving cyber threats and operational risks.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 2xl:gap-5">
            {coreSecurityServices.map((srv) => {
              const Icon = srv.icon;
              return (
                <div
                  key={srv.number}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black text-purple-600 font-mono">
                        {srv.number}
                      </span>
                      <div className={`size-8 rounded-lg flex items-center justify-center border shadow-2xs ${srv.color}`}>
                        <Icon className="size-4" />
                      </div>
                    </div>

                    <h3 className="mt-3 text-sm font-bold text-slate-950 group-hover:text-purple-700 transition-colors">
                      {srv.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                      {srv.subtitle}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <ul className="space-y-1">
                        {srv.items.map((item) => (
                          <li key={item} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                            <span className="size-1 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedService(srv.title);
                        setAssessmentModalOpen(true);
                      }}
                      className="text-xs font-bold text-purple-700 hover:text-purple-800 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
                    >
                      <span>Request Scope</span>
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
          4. ENTERPRISE SECURITY ARCHITECTURE (6 Layers)
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-white border-b border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider font-mono">
              ENTERPRISE SECURITY ARCHITECTURE
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Protection Across Your Entire Technology Ecosystem.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              A secure business environment requires multiple layers of protection working together.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {architectureLayers.map((arch) => {
              const Icon = arch.icon;
              return (
                <div
                  key={arch.layer}
                  className="rounded-2xl border border-slate-200/90 bg-[#fafbfe] p-5 shadow-2xs hover:bg-white hover:border-indigo-300 hover:shadow-md transition-all group flex flex-col justify-between"
                >
                  <div>
                    <span className="text-2xl font-black text-indigo-600 font-mono">
                      {arch.layer}
                    </span>
                    <div className="mt-3 size-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Icon className="size-4.5" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-slate-950 group-hover:text-indigo-700 transition-colors">
                      {arch.title}
                    </h3>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed font-normal">
                      {arch.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ===================================================================
          5. SECURITY FOR EVERY BUSINESS (8 Sectors)
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-[#f8fafd] border-b border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">
              SECURITY FOR EVERY BUSINESS
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Protecting Businesses Across Industries.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              Our security solutions adapt to different business environments, operational models, and technology requirements.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {businessSectors.map((sec) => {
              const Icon = sec.icon;
              return (
                <div
                  key={sec.title}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all group"
                >
                  <div className="size-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-950 group-hover:text-purple-700 transition-colors">
                    {sec.title}
                  </h3>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed font-normal">
                    {sec.desc}
                  </p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ===================================================================
          6. SECURITY TECHNOLOGIES & CAPABILITIES (6 Domains)
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-white border-b border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider font-mono">
              SECURITY TECHNOLOGIES &amp; CAPABILITIES
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Powered by Modern Security Technologies.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              We leverage modern security practices, platforms, and technologies to strengthen enterprise digital environments.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {securityTechnologies.map((tech) => {
              const Icon = tech.icon;
              return (
                <div
                  key={tech.category}
                  className="rounded-2xl border border-slate-200/90 bg-[#fafbfe] p-5 shadow-2xs hover:bg-white hover:border-teal-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`size-8 rounded-lg flex items-center justify-center border shadow-2xs ${tech.color}`}>
                      <Icon className="size-4" />
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{tech.category}</h3>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {tech.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-lg bg-white border border-slate-200/90 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-200 transition-colors shadow-2xs"
                      >
                        {tag}
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
          7. OUR SECURITY LIFECYCLE (6 Phases)
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-[#f8fafd] border-b border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">
              OUR SECURITY LIFECYCLE
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              A Proactive Approach to Managing Security Risks.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              We follow a structured security lifecycle to help organizations continuously improve their security posture.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {lifecycleSteps.map((st) => {
              const Icon = st.icon;
              return (
                <div
                  key={st.step}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:border-purple-300 hover:shadow-md transition-all group flex flex-col justify-between"
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
          8. WHY CHOOSE IOTRONICS SECURITY? (6 Pillars)
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-white border-b border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">
              WHY CHOOSE IOTRONICS SECURITY?
            </span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Building Digital Trust Through Intelligent Protection.
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {whyChooseReasons.map((rc) => {
              const Icon = rc.icon;
              return (
                <div
                  key={rc.title}
                  className="rounded-2xl border border-slate-200/90 bg-[#fafbfe] p-5 shadow-2xs hover:bg-white hover:shadow-md hover:border-purple-300 transition-all group"
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
          9. SECURITY CONSULTATION & 10. FINAL CTA
          =================================================================== */}
      <section className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-[#f8fafd] border-b border-slate-200/80">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-purple-950 to-indigo-950 text-white p-8 sm:p-12 2xl:p-16 shadow-2xl relative overflow-hidden">
            <div className="pointer-events-none absolute -top-20 -right-20 size-96 rounded-full bg-purple-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 size-96 rounded-full bg-emerald-500/15 blur-3xl" />

            <div className="relative z-10 max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-200 uppercase tracking-wider font-mono">
                <ShieldCheck className="size-3 text-purple-300" /> SECURITY CONSULTATION
              </span>

              <h2 className="mt-4 text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.15]">
                Not Sure Where Your Business Stands on Security?
              </h2>

              <p className="mt-4 text-sm sm:text-base text-purple-100/90 leading-relaxed font-normal">
                Every business has different security requirements. Our team can help you understand your current security environment, identify potential risks, and determine the right protection strategy.
              </p>
              <p className="mt-2 text-xs sm:text-sm text-purple-200/80 leading-relaxed font-normal">
                Whether you need an application security assessment, cloud security implementation, infrastructure review, or enterprise security architecture, let's start with a conversation.
              </p>

              <div className="mt-6 pt-4 border-t border-purple-800/60">
                <div className="text-base sm:text-lg font-extrabold text-white">
                  Your Business Deserves a Stronger Digital Defense.
                </div>
                <p className="mt-1 text-xs text-purple-200/80">
                  Cybersecurity is not a one-time implementation. It is an ongoing commitment to protecting your business, customers, and digital infrastructure. Partner with IOTRONICS to build secure, resilient, and future-ready technology environments.
                </p>
              </div>

              <div className="mt-6 font-bold text-white text-sm">
                Let's Secure Your Digital Future.
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => setAssessmentModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-purple-950 hover:bg-purple-50 px-6 py-3 text-sm font-bold shadow-lg transition-all hover:scale-105 cursor-pointer"
                >
                  <span>Request a Security Assessment</span>
                  <ArrowRight className="size-4" />
                </button>

                <a
                  href="#contact"
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-400/40 bg-purple-900/40 hover:bg-purple-900/70 text-white px-5 py-3 text-sm font-bold shadow-xs transition-all cursor-pointer backdrop-blur-sm"
                >
                  <ShieldAlert className="size-4 text-purple-300" />
                  <span>Contact Our Security Team</span>
                </a>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ===================================================================
          11. CONTACT SECTION
          =================================================================== */}
      <section id="contact" className="py-8 sm:py-10 md:py-12 px-4 sm:px-6 2xl:px-12 bg-white scroll-mt-24">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px]">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            
            {/* Left Column */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono">
                  CONTACT SECTION
                </span>
                <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
                  Let's Strengthen Your Security Together.
                </h2>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed font-normal">
                  Have a security concern, infrastructure requirement, or enterprise protection challenge? Connect with our team to discuss your requirements and explore the right security solution.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-[#fafbfe] border border-slate-200/90 shadow-2xs flex items-start gap-3.5">
                  <div className="size-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center justify-center shrink-0">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                      Security Operations Desk
                    </div>
                    <a href="mailto:security@iotronics.io" className="text-sm font-semibold text-purple-700 hover:underline">
                      security@iotronics.io
                    </a>
                    <div className="text-xs text-slate-500 mt-0.5">24/7 Incident Reporting &amp; Vulnerability Disclosure</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#fafbfe] border border-slate-200/90 shadow-2xs flex items-start gap-3.5">
                  <div className="size-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center justify-center shrink-0">
                    <Key className="size-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                      Direct Advisory Hotline
                    </div>
                    <a href="tel:+18005550199" className="text-sm font-semibold text-indigo-700 hover:underline">
                      +1 (800) 555-0199 (Ext: 4)
                    </a>
                    <div className="text-xs text-slate-500 mt-0.5">Direct line to Principal Security Architects</div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 text-xs font-mono text-slate-500">
                IOTRONICS – Engineering Intelligence. Empowering Businesses.
              </div>
            </div>

            {/* Right Column: Interactive Assessment Form */}
            <div className="lg:col-span-7">
              <div className="rounded-3xl border border-slate-200/90 bg-[#fafbfe] p-6 sm:p-8 shadow-lg">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">Request a Security Review</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Confidential security consultation and architecture review.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full font-mono">
                    Confidential &amp; Encrypted
                  </span>
                </div>

                {formSubmitted ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="mx-auto size-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <CheckCircle2 className="size-7" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-900">Security Inquiry Received!</h4>
                    <p className="text-xs text-slate-600 max-w-md mx-auto">
                      Thank you. An IOTRONICS cybersecurity specialist will contact you securely within 24 hours to schedule an initial scoping session.
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
                          placeholder="Jordan Lee"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Corporate Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="jordan@company.com"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all"
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
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Company / Infrastructure Domain
                        </label>
                        <input
                          type="text"
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          placeholder="Global Retail Corp / app.com"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Primary Security Service Needed
                      </label>
                      <select
                        value={selectedService}
                        onChange={(e) => setSelectedService(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all bg-white"
                      >
                        {coreSecurityServices.map((srv) => (
                          <option key={srv.number} value={srv.title}>
                            {srv.number}. {srv.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Security Concern or Project Scope *
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={formData.concern}
                        onChange={(e) => setFormData({ ...formData, concern: e.target.value })}
                        placeholder="Tell us about your infrastructure (cloud provider, application stack, compliance requirements, or recent security findings)..."
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 px-6 py-3 text-xs font-bold text-white shadow-md shadow-purple-500/25 hover:shadow-lg transition-all hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Send className="size-4" />
                      <span>Submit Confidential Inquiry</span>
                    </button>
                  </form>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===================================================================
          MODAL: Security Consultation
          =================================================================== */}
      {assessmentModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setAssessmentModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase font-mono tracking-wider">
              <ShieldCheck className="size-4" /> Talk to a Security Expert
            </div>
            <h3 className="mt-1 text-xl font-extrabold text-slate-950">
              Schedule a Confidential Security Scoping
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Connect directly with an IOTRONICS certified cybersecurity engineer.
            </p>

            <form onSubmit={handleFormSubmit} className="mt-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Jordan Lee"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  placeholder="jordan@enterprise.com"
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
                  {coreSecurityServices.map((srv) => (
                    <option key={srv.number} value={srv.title}>
                      {srv.number}. {srv.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Key Concern</label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe your environment (AWS/Azure/GCP, web apps, API endpoints, SOC-2 readiness)..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-purple-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white py-2.5 text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Confirm Request
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default SecurityPageTemplate;

