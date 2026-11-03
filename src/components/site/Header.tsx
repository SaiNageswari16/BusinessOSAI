import { useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Menu,
  X,
  Sparkles,
  ArrowRight,
  LogIn,
  ChevronDown,
  Dumbbell,
  Scissors,
  Sun,
  Moon,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import { getAuthUrls } from "@/lib/auth-urls";

interface HeaderProps {
  activeLink?: "Home" | "Services" | "Applications" | "Analytics" | "Security" | "About" | "Contact";
}

export function Header({ activeLink = "Applications" }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [appsDropdownOpen, setAppsDropdownOpen] = useState(false);
  const [mobileAppsOpen, setMobileAppsOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const authUrls = getAuthUrls();

  const appsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        appsDropdownRef.current &&
        !appsDropdownRef.current.contains(e.target as Node)
      ) {
        setAppsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applicationsList = [
    {
      name: "IOTRONICS – Gym",
      badge: "Gym OS",
      description: "Memberships, biometric turnstiles, workouts & diet plans",
      productId: "fit-club-ai",
      icon: Dumbbell,
      iconColor: "text-purple-600 bg-purple-50 border-purple-200",
    },
    {
      name: "IOTRONICS – Retail",
      badge: "Retail OS",
      description: "POS, inventory, procurement, accounting, GST & e-commerce",
      productId: "ai-business-os",
      icon: ShoppingBag,
      iconColor: "text-purple-600 bg-purple-50 border-purple-200",
    },
    {
      name: "IOTRONICS – Luxury Saloon",
      badge: "Saloon OS",
      description: "24/7 appointments, client CRM, stylist rosters & luxury POS",
      productId: "salon-os",
      icon: Scissors,
      iconColor: "text-pink-600 bg-pink-50 border-pink-200",
    },
    {
      name: "IOTRONICS – Restaurant",
      badge: "Restaurant OS",
      description: "Table booking, KDS, touch POS, delivery & inventory",
      productId: "restaurant-os",
      icon: Utensils,
      iconColor: "text-amber-600 bg-amber-50 border-amber-200",
    },
  ];

  return (
    <header className="sticky top-0 z-[100] h-[64px] 2xl:h-[72px] bg-[#f8f9fa]/85 backdrop-blur-md px-4 sm:px-6 md:px-10 flex items-center justify-center border-b border-slate-200/80 transition-all duration-300">
      <div className="max-w-[1260px] 2xl:max-w-[1440px] w-full mx-auto relative flex items-center justify-between md:justify-center">
        {/* Floating Capsule Bar */}
        <div className="bg-white/95 border border-slate-200/90 backdrop-blur-2xl rounded-full pl-4 pr-2 py-1.5 2xl:py-2 2xl:px-5 flex items-center justify-between md:inline-flex md:gap-5 2xl:gap-6 shadow-[0_4px_25px_rgba(0,0,0,0.06)] w-full md:w-auto relative">
          {/* Brand Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 group cursor-pointer mr-1"
            aria-label="IOTRONICS home"
          >
            <img
              src={dark ? "/logo-white.png" : "/logo.png"}
              alt="IOTRONICS"
              className="h-6 sm:h-6.5 2xl:h-7.5 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-4 lg:gap-5 2xl:gap-6">
            <Link
              to="/"
              className={`text-[12.5px] 2xl:text-[14px] font-semibold cursor-pointer transition-colors ${activeLink === "Home"
                ? "text-purple-600 font-bold relative after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-[2px] after:bg-purple-600 after:rounded-full"
                : "text-slate-600 hover:text-purple-700"
                }`}
            >
              Home
            </Link>

            <Link
              to="/services"
              className={`text-[12.5px] 2xl:text-[14px] font-semibold cursor-pointer transition-colors ${activeLink === "Services"
                ? "text-purple-600 font-bold relative after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-[2px] after:bg-purple-600 after:rounded-full"
                : "text-slate-600 hover:text-purple-700"
                }`}
            >
              Services
            </Link>

            {/* Applications with Interactive Dropdown */}
            <div
              ref={appsDropdownRef}
              className="relative"
              onMouseEnter={() => setAppsDropdownOpen(true)}
              onMouseLeave={() => setAppsDropdownOpen(false)}
            >
              <button
                type="button"
                onClick={() => setAppsDropdownOpen((prev) => !prev)}
                className={`text-[12.5px] 2xl:text-[14px] font-semibold cursor-pointer transition-colors flex items-center gap-0.5 py-1 ${activeLink === "Applications"
                  ? "text-purple-600 font-bold relative after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-[2.5px] after:bg-purple-600 after:rounded-full"
                  : "text-slate-600 hover:text-purple-700"
                  }`}
              >
                <span>Applications</span>
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-200 ${appsDropdownOpen ? "rotate-180 text-purple-600" : "opacity-70"
                    }`}
                />
              </button>

              {/* Dropdown Menu */}
              {appsDropdownOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 bg-white/98 backdrop-blur-2xl border border-slate-200/90 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-mono">
                      Our Applications
                    </span>
                    <span className="text-[10px] font-bold text-purple-600">Enterprise AI</span>
                  </div>

                  <div className="space-y-1 mt-1">
                    {applicationsList.map((app) => {
                      const IconComp = app.icon;
                      return (
                        <Link
                          key={app.name}
                          to="/products/$productId"
                          params={{ productId: app.productId }}
                          preload="intent"
                          onClick={() => setAppsDropdownOpen(false)}
                          className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer"
                        >
                          <div
                            className={`size-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs group-hover:scale-105 transition-transform ${app.iconColor}`}
                          >
                            <IconComp className="size-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                                {app.name}
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                                {app.badge}
                              </span>
                            </div>
                            <span className="text-[10.5px] text-slate-500 leading-snug truncate mt-0.5">
                              {app.description}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="mt-1 pt-1.5 border-t border-slate-100 px-2 pb-1">
                    <Link
                      to="/"
                      hash="applications"
                      preload="intent"
                      onClick={() => setAppsDropdownOpen(false)}
                      className="text-[11px] font-bold text-purple-700 hover:text-purple-800 flex items-center justify-between px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors cursor-pointer"
                    >
                      <span>Explore all applications</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link
              to="/analytics"
              className={`text-[12.5px] 2xl:text-[14px] font-semibold cursor-pointer transition-colors ${activeLink === "Analytics"
                ? "text-purple-600 font-bold relative after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-[2px] after:bg-purple-600 after:rounded-full"
                : "text-slate-600 hover:text-purple-700"
                }`}
            >
              Analytics
            </Link>

            <Link
              to="/security"
              className={`text-[12.5px] 2xl:text-[14px] font-semibold cursor-pointer transition-colors ${activeLink === "Security"
                ? "text-purple-600 font-bold relative after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-[2px] after:bg-purple-600 after:rounded-full"
                : "text-slate-600 hover:text-purple-700"
                }`}
            >
              Security
            </Link>

            <Link
              to="/about"
              className={`text-[12.5px] 2xl:text-[14px] font-semibold cursor-pointer transition-colors ${activeLink === "About"
                ? "text-purple-600 font-bold relative after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-[2px] after:bg-purple-600 after:rounded-full"
                : "text-slate-600 hover:text-purple-700"
                }`}
            >
              About
            </Link>

            <Link
              to="/contact"
              className={`text-[12.5px] 2xl:text-[14px] font-semibold cursor-pointer transition-colors ${activeLink === "Contact"
                ? "text-purple-600 font-bold relative after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-[2px] after:bg-purple-600 after:rounded-full"
                : "text-slate-600 hover:text-purple-700"
                }`}
            >
              Contact
            </Link>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <a
              href={authUrls.signIn}
              title="Sign In to your existing account"
              className="border border-slate-300/90 bg-white/90 text-slate-800 text-[11px] sm:text-[12px] font-bold px-3 sm:px-3.5 py-1.5 rounded-full hover:bg-slate-100 hover:text-purple-700 hover:border-purple-300 transition-all cursor-pointer whitespace-nowrap shadow-xs flex items-center gap-1.5 hover:-translate-y-0.5"
            >
              <LogIn className="size-3 sm:size-3.5 text-slate-600" />
              <span>Sign In / Login</span>
            </a>

            <a
              href={authUrls.signUp}
              title="Sign Up - Create a new account"
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] sm:text-[12px] font-bold px-3.5 sm:px-4 py-1.5 rounded-full hover:from-purple-700 hover:to-indigo-700 transition-all cursor-pointer whitespace-nowrap shadow-md shadow-purple-500/20 flex items-center gap-1.5 hover:-translate-y-0.5"
            >
              <Sparkles className="size-3 text-purple-200" />
              <span>Sign Up</span>
              <ArrowRight className="size-3" />
            </a>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={() => {
                const next = !dark;
                setDark(next);
                document.documentElement.classList.toggle("dark", next);
              }}
              aria-label="Toggle theme"
              className="grid size-7.5 place-items-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              {dark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
            </button>

            {/* Mobile Hamburger inside bar */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              className="grid size-7.5 place-items-center rounded-full bg-slate-100 border border-slate-200 text-slate-700 md:hidden hover:bg-slate-200 cursor-pointer"
            >
              {open ? <X className="size-3.5" /> : <Menu className="size-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {open ? (
        <div className="absolute top-[64px] inset-x-0 border-b border-slate-200 bg-white/98 backdrop-blur-2xl md:hidden animate-in fade-in slide-in-from-top-2 duration-200 shadow-xl max-h-[85vh] overflow-y-auto">
          <div className="mx-auto grid w-full max-w-md gap-1.5 px-6 py-5">
            <div className="flex items-center justify-between pb-3 mb-1 border-b border-slate-100">
              <Link to="/" onClick={() => setOpen(false)} className="flex items-center" aria-label="IOTRONICS home">
                <img
                  src={dark ? "/logo-white.png" : "/logo.png"}
                  alt="IOTRONICS"
                  className="h-7 w-auto object-contain"
                />
              </Link>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 font-mono">
                Enterprise AI
              </span>
            </div>

            <Link
              to="/"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Home
            </Link>

            <Link
              to="/services"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Services
            </Link>

            {/* Mobile Applications Accordion */}
            <div>
              <button
                type="button"
                onClick={() => setMobileAppsOpen((v) => !v)}
                className="w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <span className={activeLink === "Applications" ? "text-purple-600 font-bold" : ""}>
                  Applications
                </span>
                <ChevronDown size={14} className={mobileAppsOpen ? "rotate-180" : ""} />
              </button>
              {mobileAppsOpen && (
                <div className="ml-4 pl-3 border-l-2 border-purple-200 space-y-1 my-1">
                  {applicationsList.map((app) => (
                    <Link
                      key={app.name}
                      to="/products/$productId"
                      params={{ productId: app.productId }}
                      preload="intent"
                      onClick={() => setOpen(false)}
                      className="block py-2 text-xs font-semibold text-slate-800 hover:text-purple-700"
                    >
                      {app.name}
                      <span className="block text-[10px] text-slate-500 font-normal">
                        {app.badge}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              to="/analytics"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Analytics
            </Link>

            <Link
              to="/security"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Security
            </Link>

            <Link
              to="/about"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              About
            </Link>

            <Link
              to="/contact"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Contact
            </Link>

            <div className="mt-3 grid gap-2 pt-3 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={authUrls.signIn}
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 px-3 py-2.5 text-center text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <LogIn className="size-3.5 text-slate-600" />
                  <span>Sign In</span>
                </a>
                <a
                  href={authUrls.signUp}
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 px-3 py-2.5 text-center text-xs font-bold shadow-md shadow-purple-500/20 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sparkles className="size-3.5 text-purple-200" />
                  <span>Sign Up</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export default Header;
