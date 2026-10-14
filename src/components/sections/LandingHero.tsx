"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Play,
  Sun,
  Moon,
  ChevronDown,
  Menu,
  X,
  CheckCircle2,
  Box,
  Zap,
  Cloud,
  LayoutGrid,
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

export function LandingHero() {
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section id="home" className={`landing-hero ${dark ? "hero-dark" : ""}`}>
      {/* 3D Background Canvas Layer */}
      <div className="hero-bg-wrapper">
        <img
          src="/hero-bg.png"
          alt="IOTRONICS 3D Platform Overview"
          className="hero-bg-image"
          loading="eager"
        />
        <div className="hero-bg-gradient-fade" />
      </div>

      <div className="hero-shell">
        {/* Floating Capsule Glass Navbar */}
        <header className="glass-navbar">
          <a href="#home" className="hero-brand" aria-label="IOTRONICS Home">
            <img src="/logo.png" alt="IOTRONICS" className="hero-brand-logo" />
            <span className="hero-brand-name">IOTRONICS</span>
          </a>

          <nav className={`hero-nav ${menuOpen ? "nav-open" : ""}`}>
            {navItems.map((item, i) => (
              <a
                href={item.href}
                key={item.name}
                className={`hero-nav-link ${i === 0 ? "active" : ""}`}
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
            <a href="#contact" className="nav-demo">
              <Sparkles size={15} />
              <span>Request Demo</span>
              <ArrowRight size={14} />
            </a>

            <button
              className="theme-button"
              aria-label="Toggle theme"
              onClick={() => setDark(!dark)}
              title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {dark ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <button
              className="mobile-menu-button"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        {/* Hero Main: Two Column Stage */}
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

            <div className="hero-cta-group">
              <a href="#applications" className="primary-hero-cta">
                Explore Applications <ArrowRight size={18} />
              </a>
              <a href="#contact" className="secondary-hero-cta">
                <span className="play-circle">
                  <Play size={13} fill="currentColor" />
                </span>
                Watch Demo
              </a>
            </div>

            <div className="hero-trust">
              <div className="trust-item">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span>50+ Enterprise Deployments</span>
              </div>
              <div className="trust-divider" />
              <div className="trust-item">
                <CheckCircle2 size={15} className="text-purple-500" />
                <span>Sub-second Sync</span>
              </div>
              <div className="trust-divider" />
              <div className="trust-item">
                <CheckCircle2 size={15} className="text-blue-500" />
                <span>99.98% Cloud Uptime</span>
              </div>
            </div>

            {/* Mobile visual preview card */}
            <div className="hero-mobile-visual">
              <img
                src="/hero-bg.png"
                alt="IOTRONICS 3D Platform Overview"
                className="hero-mobile-img"
              />
            </div>
          </div>

          {/* Desktop Right Spacer to preserve background visual space */}
          <div className="hero-right-spacer" aria-hidden="true" />
        </div>

        {/* Floating Bottom Stats Strip */}
        <div className="hero-stats">
          {stats.map(({ icon: Icon, value, label }) => (
            <div className="hero-stat" key={label}>
              <div className="stat-icon">
                <Icon size={24} strokeWidth={2.2} />
              </div>
              <div>
                <strong>{value}</strong>
                <p>{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default LandingHero;
