"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  ChevronDown,
  Menu,
  X,
  Box,
  Zap,
  Cloud,
  LayoutGrid,
  ShoppingCart,
  Dumbbell,
  Scissors,
  Store,
  Users,
  BarChart3,
  Truck,
  Utensils,
  Handshake,
} from "lucide-react";
import "./LandingHero.css";

const navItems = [
  { name: "Home", href: "#home" },
  { name: "Services", href: "#services" },
  { name: "Applications", href: "#applications" },
  { name: "Verticals", href: "#industries" },
  { name: "Analytics", href: "#analytics" },
  { name: "Security", href: "#security" },
  { name: "About", href: "#about" },
  { name: "Contact", href: "#contact" },
];

const stats = [
  { icon: Box, value: "50+", label: "Municipal & Enterprise Deployments" },
  { icon: Zap, value: "< 12ms", label: "Sub-Second POS & Biometric Sync" },
  { icon: Cloud, value: "99.98%", label: "High-Availability Cloud Uptime" },
  { icon: LayoutGrid, value: "16+", label: "Unified Operational Modules" },
];

// 4 Cards on the Left
const leftCards = [
  {
    id: "retail-inventory",
    icon: ShoppingCart,
    cardClass: "card-retail eco-pos-l1",
    iconBoxClass: "icon-retail",
    title: "Retail & Inventory",
    description: "AI inventory, billing & store operations",
    href: "#applications",
  },
  {
    id: "fitness-gym",
    icon: Dumbbell,
    cardClass: "card-fitness eco-pos-l2",
    iconBoxClass: "icon-fitness",
    title: "Fitness & Gym",
    description: "Members, training & plans",
    href: "#industries",
  },
  {
    id: "salon-beauty",
    icon: Scissors,
    cardClass: "card-salon eco-pos-l3",
    iconBoxClass: "icon-salon",
    title: "Salon & Beauty",
    description: "Appointments, staff & scheduling",
    href: "#industries",
  },
  {
    id: "order-delivery",
    icon: Truck,
    cardClass: "card-delivery eco-pos-l4",
    iconBoxClass: "icon-delivery",
    title: "Order & Delivery",
    description: "Manage orders & logistics",
    href: "#applications",
  },
];

// Top Center Card
const topCenterCard = {
  id: "hrms",
  icon: Users,
  cardClass: "card-hrms eco-pos-top",
  iconBoxClass: "icon-hrms",
  title: "HRMS",
  description: "Employees, Payroll & Attendance",
  href: "#applications",
};

// Bottom Center Card
const bottomCenterCard = {
  id: "restaurant",
  icon: Utensils,
  cardClass: "card-restaurant eco-pos-bottom",
  iconBoxClass: "icon-restaurant",
  title: "Restaurant",
  description: "Orders, kitchen & table management",
  href: "#industries",
};

// 4 Cards on the Right
const rightCards = [
  {
    id: "pos-billing",
    icon: Store,
    cardClass: "card-pos eco-pos-r1",
    iconBoxClass: "icon-pos",
    title: "POS & Billing",
    description: "Fast, smart cloud billing",
    href: "#applications",
  },
  {
    id: "crm-marketing",
    icon: Users,
    cardClass: "card-crm eco-pos-r2",
    iconBoxClass: "icon-crm",
    title: "CRM & Marketing",
    description: "Acquire, engage & retain customers",
    href: "#applications",
  },
  {
    id: "analytics-ai",
    icon: BarChart3,
    cardClass: "card-analytics eco-pos-r3",
    iconBoxClass: "icon-analytics",
    title: "Analytics & AI",
    description: "Real-time insights for smarter growth",
    href: "#analytics",
  },
  {
    id: "vendor-management",
    icon: Handshake,
    cardClass: "card-vendor eco-pos-r4",
    iconBoxClass: "icon-vendor",
    title: "Vendor Management",
    description: "Suppliers, purchases & procurement",
    href: "#applications",
  },
];

export function LandingHero() {
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [activeSection, setActiveSection] = useState("Home");
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 15);

      // Smart navbar hide on scroll down, reveal on scroll up
      if (currentScrollY > 120) {
        if (currentScrollY > lastScrollY.current + 8) {
          // Scrolling down -> hide navbar so it never covers section titles
          setNavVisible(false);
        } else if (currentScrollY < lastScrollY.current - 6) {
          // Scrolling up -> reveal navbar
          setNavVisible(true);
        }
      } else {
        // At or near top of page -> always show navbar
        setNavVisible(true);
      }
      lastScrollY.current = currentScrollY;

      // Scrollspy active section
      const sections = navItems.map((item) => ({
        name: item.name,
        el: document.querySelector(item.href),
      }));

      const scrollPos = currentScrollY + 130;
      for (let i = sections.length - 1; i >= 0; i--) {
        const sec = sections[i];
        if (!sec || !sec.el) continue;
        const top = sec.el.getBoundingClientRect().top + currentScrollY;
        if (scrollPos >= top) {
          setActiveSection(sec.name);
          break;
        }
      }
    };

    // Reveal navbar when cursor hovers near top 50px of window
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY < 50) {
        setNavVisible(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <section id="home" className={`landing-hero ${dark ? "hero-dark" : ""}`}>
      {/* Luminous Flowing Wave Artwork Backdrop */}
      <div className="hero-backdrop" aria-hidden="true">
        <div className="hero-bg-image" />
        <div className="hero-bg-overlay" />
      </div>

      {/* Sticky Floating Capsule Glass Navbar (hoisted to section root to escape shell stacking context) */}
      <header
        className={`glass-navbar ${scrolled ? "is-scrolled" : ""} ${
          navVisible || menuOpen ? "nav-visible" : "nav-hidden"
        }`}
      >
        <a href="#home" className="hero-brand" aria-label="IOTRONICS Home">
          <img
            src={dark ? "/logo-white.png" : "/logo.png"}
            alt="IOTRONICS"
            className="hero-brand-logo"
          />
          <span className="sr-only">IOTRONICS</span>
        </a>

        <nav className={`hero-nav ${menuOpen ? "nav-open" : ""}`}>
          {navItems.map((item) => (
            <a
              href={item.href}
              key={item.name}
              className={`hero-nav-link ${activeSection === item.name ? "active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.name}
              {(item.name === "Applications" || item.name === "Verticals") && (
                <ChevronDown size={13} className="ml-0.5 opacity-70" />
              )}
            </a>
          ))}
        </nav>

        <div className="hero-nav-actions">
          <a href="https://lazymonkeyai.com/login" className="nav-demo">
            <Sparkles size={14} />
            <span>Sign Up</span>
            <ArrowRight size={14} />
          </a>

          <button
            className="theme-button"
            aria-label="Toggle theme"
            onClick={() => {
              const nextDark = !dark;
              setDark(nextDark);
              document.documentElement.classList.toggle("dark", nextDark);
            }}
            title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {dark ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <button
            className="mobile-menu-button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <div className="hero-shell">
        {/* Space reservation placeholder for fixed navbar */}
        <div className="glass-navbar-placeholder" aria-hidden="true" />

        {/* Hero Main: Left Copy & Right Compact Neural Ecosystem */}
        <div className="hero-main">
          {/* Left Hero Copy */}
          <div className="hero-copy">
            <div className="ecosystem-pill">
              <span className="ecosystem-badge-dot">
                <Sparkles size={13} className="text-purple-600" />
              </span>
              <span>Next-Gen AI Business &amp; Vertical OS</span>
            </div>

            <h1>
              One Platform.
              <span className="gradient-headline">Smarter Business.</span>
              Endless Possibilities.
            </h1>

            <p className="hero-description">
              Manage your enterprise, automate daily workflows, and make smarter decisions with
              unified AI applications engineered to scale retail, fitness, and luxury service
              chains.
            </p>

            {/* Stats Strip */}
            <div className="hero-stats-strip">
              {stats.map(({ icon: Icon, value, label }) => (
                <div className="hero-stat-card" key={label}>
                  <div className="stat-icon-wrap">
                    <Icon size={16} strokeWidth={2.2} />
                  </div>
                  <div className="stat-content">
                    <strong>{value}</strong>
                    <p>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Hero Architectural Neural Hub Stage */}
          <div className="hero-ecosystem-stage">
            {/* Background Digital Ribbon Waves */}
            <svg
              className="hero-waves-svg"
              viewBox="0 0 760 520"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="waveGlow1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#c084fc" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.15" />
                </linearGradient>
                <linearGradient id="waveGlow2" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                  <stop offset="60%" stopColor="#a855f7" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0.12" />
                </linearGradient>
              </defs>

              <path
                d="M-20,130 C200,60 420,410 780,110"
                stroke="url(#waveGlow1)"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M-20,220 C180,130 360,460 780,190"
                stroke="url(#waveGlow2)"
                strokeWidth="1.8"
                fill="none"
              />
              <path
                d="M-20,320 C220,210 440,510 780,280"
                stroke="url(#waveGlow1)"
                strokeWidth="1.4"
                strokeDasharray="5 5"
                fill="none"
                opacity="0.75"
              />
              <path
                d="M80,40 C340,0 560,300 780,60"
                stroke="url(#waveGlow2)"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                fill="none"
                opacity="0.7"
              />
            </svg>

            <div className="ecosystem-canvas">
              {/* Orbit & Micro-Circuit Traces for all 10 Applications */}
              <svg
                className="ecosystem-connections-svg"
                viewBox="0 0 860 540"
                fill="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="orbitStroke1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#93c5fd" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id="orbitStroke2" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                    <stop offset="50%" stopColor="#a855f7" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity="0.35" />
                  </linearGradient>
                </defs>

                {/* Concentric Dashed Orbit Rings */}
                <circle
                  cx="430"
                  cy="270"
                  r="118"
                  stroke="url(#orbitStroke1)"
                  strokeWidth="1.3"
                  strokeDasharray="4 4"
                  className="orbit-ring-circle"
                />
                <circle
                  cx="430"
                  cy="270"
                  r="154"
                  stroke="url(#orbitStroke2)"
                  strokeWidth="1.2"
                  strokeDasharray="5 5"
                  opacity="0.65"
                />

                {/* Radial Circuit Connecting Lines to each of the 10 cards */}
                {/* 1. Top (HRMS) */}
                <line x1="430" y1="190" x2="430" y2="74" stroke="#9333ea" strokeWidth="1.3" strokeDasharray="3 3" opacity="0.75" />
                {/* 2. Top-Left (Retail & Inventory) */}
                <path d="M374,214 L321,161 L258,106" stroke="#a855f7" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.75" />
                {/* 3. Mid-Left (Fitness & Gym) */}
                <path d="M350,250 L284,222 L236,214" stroke="#0284c7" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.75" />
                {/* 4. Lower-Left (Salon & Beauty) */}
                <path d="M350,290 L284,318 L236,326" stroke="#ec4899" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.75" />
                {/* 5. Bottom-Left (Order & Delivery) */}
                <path d="M374,326 L321,379 L258,434" stroke="#8b5cf6" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.75" />
                {/* 6. Bottom (Restaurant) */}
                <line x1="430" y1="350" x2="430" y2="466" stroke="#f97316" strokeWidth="1.3" strokeDasharray="3 3" opacity="0.75" />
                {/* 7. Bottom-Right (Vendor Management) */}
                <path d="M486,326 L539,379 L602,434" stroke="#06b6d4" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.75" />
                {/* 8. Lower-Right (Analytics & AI) */}
                <path d="M510,290 L576,318 L624,326" stroke="#10b981" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.75" />
                {/* 9. Mid-Right (CRM & Marketing) */}
                <path d="M510,250 L576,222 L624,214" stroke="#d946ef" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.75" />
                {/* 10. Top-Right (POS & Billing) */}
                <path d="M486,214 L539,161 L602,106" stroke="#3b82f6" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.75" />

                {/* Glowing Orbit Node Beads in the 10 notches */}
                <circle cx="430" cy="116" r="4.5" fill="#9333ea" className="node-dot dot-purple" />
                <circle cx="539" cy="161" r="4.5" fill="#3b82f6" className="node-dot dot-blue" />
                <circle cx="576" cy="222" r="4.5" fill="#d946ef" className="node-dot dot-pink" />
                <circle cx="576" cy="318" r="4.5" fill="#10b981" className="node-dot dot-green" />
                <circle cx="539" cy="379" r="4.5" fill="#06b6d4" className="node-dot dot-cyan" />
                <circle cx="430" cy="424" r="4.5" fill="#f97316" className="node-dot dot-orange" />
                <circle cx="321" cy="379" r="4.5" fill="#8b5cf6" className="node-dot dot-violet" />
                <circle cx="284" cy="318" r="4.5" fill="#ec4899" className="node-dot dot-pink" />
                <circle cx="284" cy="222" r="4.5" fill="#0284c7" className="node-dot dot-cyan" />
                <circle cx="321" cy="161" r="4.5" fill="#a855f7" className="node-dot dot-purple" />
              </svg>

              {/* Center Re-engineered Holographic AI Core Hub */}
              <div className="ecosystem-center-hub">
                {/* Multi-layered ambient neon glow aura */}
                <div className="hub-aura-glow" />

                {/* Rotating fine-tick tech ring */}
                <div className="hub-tech-orbit" />

                {/* Frosted Glass Outer Bezel */}
                <div className="hub-glass-ring">
                  {/* Solid Neural Core Disc */}
                  <div className="hub-core-circle">
                    {/* Live Telemetry Status Chip */}
                    <div className="hub-status-chip">
                      <span className="status-ping" />
                      <span className="status-solid" />
                      <span className="status-text">AI-POWERED</span>
                    </div>

                    {/* Iconic 4-Point Prism Sparkle Star */}
                    <div className="hub-sparkle-box">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 32 32"
                        fill="none"
                        className="hub-sparkle-svg"
                      >
                        <path
                          d="M16 2 C16 9.73 9.73 16 2 16 C9.73 16 16 22.27 16 30 C16 22.27 22.27 16 30 16 C22.27 16 16 9.73 16 2 Z"
                          fill="white"
                        />
                        <path
                          d="M7.5 6.5 C7.5 8.16 6.16 9.5 4.5 9.5 C6.16 9.5 7.5 10.84 7.5 12.5 C7.5 10.84 8.84 9.5 10.5 9.5 C8.84 9.5 7.5 8.16 7.5 6.5 Z"
                          fill="white"
                          opacity="0.95"
                        />
                      </svg>
                    </div>

                    {/* Bold Core Title */}
                    <span className="hub-headline">BUSINESS OS</span>

                    {/* Unique Enterprise Micro-Telemetry */}
                    <span className="hub-sub-telemetry">NEURAL ENGINE</span>
                  </div>
                </div>
              </div>

              {/* Top Center Card: HRMS */}
              <a
                href={topCenterCard.href}
                className={`ecosystem-card ${topCenterCard.cardClass}`}
                id={`eco-${topCenterCard.id}`}
              >
                <div className={`eco-card-icon-box ${topCenterCard.iconBoxClass}`}>
                  <topCenterCard.icon size={18} strokeWidth={2.2} />
                </div>
                <div className="eco-card-info">
                  <h3 className="eco-card-title">{topCenterCard.title}</h3>
                  <p className="eco-card-subtitle">{topCenterCard.description}</p>
                </div>
                <div className="eco-card-action">
                  <ArrowRight size={12} strokeWidth={2.4} />
                </div>
              </a>

              {/* Bottom Center Card: Restaurant */}
              <a
                href={bottomCenterCard.href}
                className={`ecosystem-card ${bottomCenterCard.cardClass}`}
                id={`eco-${bottomCenterCard.id}`}
              >
                <div className={`eco-card-icon-box ${bottomCenterCard.iconBoxClass}`}>
                  <bottomCenterCard.icon size={18} strokeWidth={2.2} />
                </div>
                <div className="eco-card-info">
                  <h3 className="eco-card-title">{bottomCenterCard.title}</h3>
                  <p className="eco-card-subtitle">{bottomCenterCard.description}</p>
                </div>
                <div className="eco-card-action">
                  <ArrowRight size={12} strokeWidth={2.4} />
                </div>
              </a>

              {/* Left Column (4 Cards) */}
              <div className="ecosystem-group-left">
                {leftCards.map((card) => (
                  <a
                    key={card.id}
                    href={card.href}
                    className={`ecosystem-card ${card.cardClass}`}
                    id={`eco-${card.id}`}
                  >
                    <div className={`eco-card-icon-box ${card.iconBoxClass}`}>
                      <card.icon size={18} strokeWidth={2.2} />
                    </div>
                    <div className="eco-card-info">
                      <h3 className="eco-card-title">{card.title}</h3>
                      <p className="eco-card-subtitle">{card.description}</p>
                    </div>
                    <div className="eco-card-action">
                      <ArrowRight size={12} strokeWidth={2.4} />
                    </div>
                  </a>
                ))}
              </div>

              {/* Right Column (4 Cards) */}
              <div className="ecosystem-group-right">
                {rightCards.map((card) => (
                  <a
                    key={card.id}
                    href={card.href}
                    className={`ecosystem-card ${card.cardClass}`}
                    id={`eco-${card.id}`}
                  >
                    <div className={`eco-card-icon-box ${card.iconBoxClass}`}>
                      <card.icon size={18} strokeWidth={2.2} />
                    </div>
                    <div className="eco-card-info">
                      <h3 className="eco-card-title">{card.title}</h3>
                      <p className="eco-card-subtitle">{card.description}</p>
                    </div>
                    <div className="eco-card-action">
                      <ArrowRight size={12} strokeWidth={2.4} />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingHero;
