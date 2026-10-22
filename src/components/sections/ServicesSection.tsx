"use client";

import React from "react";
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
} from "lucide-react";
import { Section, Reveal } from "@/components/site/primitives";

export const servicesData = [
  {
    id: "web-development",
    name: "Web Development",
    icon: Globe,
    badge: "Full-Stack",
    color: "from-blue-500/20 to-indigo-500/10 text-blue-600",
    description:
      "Scalable web applications, customer portals, and microservices built with modern frontend frameworks and cloud backends.",
  },
  {
    id: "mobile-app-development",
    name: "Mobile App Development",
    icon: Smartphone,
    badge: "iOS & Android",
    color: "from-purple-500/20 to-pink-500/10 text-purple-600",
    description:
      "Native and cross-platform mobile apps with offline local synchronization, biometric security, and push notification pipelines.",
  },
  {
    id: "ai-generative-ai",
    name: "AI & Generative AI Solutions",
    icon: BrainCircuit,
    badge: "Autonomous",
    color: "from-pink-500/20 to-rose-500/10 text-pink-600",
    description:
      "Custom LLM fine-tuning, domain copilot agents, automated workflow triggers, and predictive enterprise intelligence.",
  },
  {
    id: "data-analytics-bi",
    name: "Data Analytics & BI",
    icon: BarChart3,
    badge: "Telemetry",
    color: "from-cyan-500/20 to-blue-500/10 text-cyan-600",
    description:
      "Live multi-branch telemetry feeds, automated financial reconciliations, ETL data pipelines, and executive dashboards.",
  },
  {
    id: "cybersecurity-services",
    name: "Cybersecurity Services",
    icon: ShieldCheck,
    badge: "Zero-Trust",
    color: "from-emerald-500/20 to-teal-500/10 text-emerald-600",
    description:
      "Cryptographic data isolation, multi-tenant RBAC, vulnerability auditing, SOC-2 compliance, and automated threat monitoring.",
  },
  {
    id: "sap-cloud-services",
    name: "SAP Cloud Services",
    icon: Server,
    badge: "Cloud ERP",
    color: "from-amber-500/20 to-orange-500/10 text-amber-600",
    description:
      "SAP S/4HANA migration, custom ABAP workflows, two-way legacy database sync, and real-time enterprise resource tracking.",
  },
  {
    id: "salesforce-services",
    name: "Salesforce Services",
    icon: Users,
    badge: "CRM Architecture",
    color: "from-indigo-500/20 to-purple-500/10 text-indigo-600",
    description:
      "Sales & Service Cloud deployment, custom Lightning components, automated lead routing, and customer lifecycle workflows.",
  },
  {
    id: "cloud-devops-engineering",
    name: "Cloud & DevOps Engineering",
    icon: Cloud,
    badge: "Multi-Cloud",
    color: "from-sky-500/20 to-blue-500/10 text-sky-600",
    description:
      "Multi-cloud architectures (AWS, Azure, GCP), automated CI/CD deployment pipelines, container orchestration, and 99.99% uptime.",
  },
  {
    id: "testing-qa",
    name: "Testing & Quality Assurance",
    icon: CheckCircle2,
    badge: "Automation",
    color: "from-teal-500/20 to-emerald-500/10 text-teal-600",
    description:
      "Automated regression testing, stress and load simulation, API contract verification, and zero-downtime release pipelines.",
  },
  {
    id: "digital-marketing-seo",
    name: "Digital Marketing & SEO",
    icon: TrendingUp,
    badge: "Growth Engine",
    color: "from-fuchsia-500/20 to-pink-500/10 text-fuchsia-600",
    description:
      "Technical search engine optimization, local business visibility, conversion rate optimization, and automated customer acquisition.",
  },
];

export function ServicesSection({ className }: { className?: string }) {
  return (
    <Section
      id="services"
      className={"w-full bg-[#f8fafd] border-b border-slate-200/80 " + (className || "")}
    >
      <div className="w-full max-w-7xl 2xl:max-w-[1560px] 3xl:max-w-[1840px] mx-auto">
        {/* Section Heading */}
        <Reveal>
          <div className="max-w-3xl 2xl:max-w-4xl 3xl:max-w-5xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-pink-500/20 bg-pink-50 px-3.5 py-1 text-[11px] 2xl:text-xs font-bold tracking-wider text-pink-700 uppercase shadow-2xs">
              <Sparkles className="size-3 2xl:size-3.5 text-pink-600" /> Enterprise Services &amp; Solutions
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl 2xl:text-5xl font-extrabold text-slate-950 tracking-tight leading-[1.15]">
              End-to-End Technology Services for{" "}
              <span className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Modern Operations.
              </span>
            </h2>
            <p className="mt-2 text-xs sm:text-sm 2xl:text-base 3xl:text-lg text-slate-600 leading-relaxed max-w-2xl 2xl:max-w-4xl">
              From custom web &amp; mobile engineering to enterprise cloud migration and generative
              AI integration, our technical architects build the solutions that power your company.
            </p>
          </div>
        </Reveal>

        {/* 10 Services Grid */}
        <div className="mt-6 2xl:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 2xl:gap-5 3xl:gap-6">
          {servicesData.map((service, idx) => {
            const Icon = service.icon;
            return (
              <Reveal key={service.id} delay={idx * 20}>
                <div
                  id={service.id}
                  className="group flex flex-col justify-between h-full rounded-2xl 2xl:rounded-3xl border border-slate-200/90 bg-white p-4 2xl:p-5 3xl:p-6 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:border-pink-300/80 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div
                        className={`size-9 2xl:size-11 3xl:size-12 rounded-xl 2xl:rounded-2xl flex items-center justify-center bg-gradient-to-br ${service.color} border border-slate-200/60 shadow-2xs group-hover:scale-108 transition-transform`}
                      >
                        <Icon className="size-4.5 2xl:size-5.5 3xl:size-6" strokeWidth={2.2} />
                      </div>
                      <span className="text-[10px] 2xl:text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 2xl:px-2.5 py-0.5 2xl:py-1 rounded-full font-mono">
                        {service.badge}
                      </span>
                    </div>

                    <h3 className="mt-3 2xl:mt-4 text-sm 2xl:text-base 3xl:text-lg font-bold text-slate-900 group-hover:text-pink-600 transition-colors">
                      {service.name}
                    </h3>

                    <p className="mt-1.5 2xl:mt-2 text-xs 2xl:text-sm 3xl:text-[15px] text-slate-600 leading-relaxed font-normal">
                      {service.description}
                    </p>
                  </div>

                  <div className="mt-4 2xl:mt-5 pt-3 2xl:pt-4 border-t border-slate-100 flex items-center justify-between">
                    <a
                      href="#contact"
                      className="inline-flex items-center gap-1 text-[11px] 2xl:text-xs 3xl:text-sm font-bold text-pink-600 hover:text-pink-700 transition-colors"
                    >
                      <span>Request Scope</span>
                      <ArrowRight className="size-3 2xl:size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </a>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Bottom Banner */}
        <Reveal delay={200}>
          <div className="mt-6 rounded-2xl bg-gradient-to-r from-purple-50 via-pink-50/60 to-indigo-50 border border-purple-200/70 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-900">
                Need a bespoke multi-service deployment?
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                Our engineering team assesses your legacy infrastructure and delivers a phased
                implementation roadmap.
              </p>
            </div>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:shadow-md transition-all hover:scale-105 whitespace-nowrap shrink-0"
            >
              <span>Schedule Architecture Review</span>
              <ArrowRight className="size-3.5" />
            </a>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

export default ServicesSection;
