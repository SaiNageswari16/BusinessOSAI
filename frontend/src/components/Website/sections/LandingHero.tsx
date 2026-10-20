"use client";

import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
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
  LogIn,
  UserPlus,
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
            <img
              src={dark ? "/logo-white.png" : "/Logo.png"}
              alt="IOTRONICS"
              className="hero-brand-logo"
            />
            <span className="sr-only">IOTRONICS</span>
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

            <div className="mobile-nav-ctas">
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="nav-login justify-center py-2.5 text-center font-bold"
              >
                <LogIn size={13} />
                <span>Sign In / Login</span>
              </Link>
              <Link
                to="/login"
                search={{ mode: "register" }}
                onClick={() => setMenuOpen(false)}
                className="nav-signup justify-center py-2.5 text-center font-bold"
              >
                <UserPlus size={13} />
                <span>Create Workspace / Sign Up</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </nav>

          <div className="hero-nav-actions">
            <Link
              to="/login"
              className="nav-login"
            >
              <LogIn size={13} className="opacity-80" />
              <span>Sign In / Login</span>
            </Link>

            <Link
              to="/login"
              search={{ mode: "register" }}
              className="nav-signup"
            >
              <UserPlus size={13} />
              <span>Sign Up</span>
              <ArrowRight size={13} />
            </Link>

            <button
              className="theme-button"
              aria-label="Toggle theme"
              onClick={() => setDark(!dark)}
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

            {/* Hero Interactive CTAs */}
            <div className="hero-cta-group">
              <Link
                to="/login"
                search={{ mode: "register" }}
                className="primary-hero-cta"
              >
                <span>Start Free Workspace</span>
                <ArrowRight size={14} />
              </Link>
              <a href="#contact" className="secondary-hero-cta">
                <span className="play-circle">
                  <Sparkles size={11} />
                </span>
                <span>Book Enterprise Demo</span>
              </a>
            </div>

            {/* 2*2 Stats Tab */}
            <div className="hero-stats">
              {stats.map(({ icon: Icon, value, label }) => (
                <div className="hero-stat" key={label}>
                  <div className="stat-icon">
                    <Icon size={17} strokeWidth={2.2} />
                  </div>
                  <div className="stat-info">
                    <strong>{value}</strong>
                    <p>{label}</p>
                  </div>
                </div>
              ))}
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
      </div>
    </section>
  );
}

export default LandingHero;
