import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, Sparkles, ArrowRight, LogIn, UserPlus } from "lucide-react";

const nav = [
  { label: "Home", href: "/#top" },
  { label: "Services", href: "/#services" },
  { label: "Applications", href: "/#applications" },
  { label: "Verticals", href: "/#industries" },
  { label: "Analytics", href: "/#analytics" },
  { label: "Security", href: "/#security" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/#contact" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-[100] h-[60px] bg-[#f8f9fa]/85 backdrop-blur-md px-4 sm:px-8 md:px-[60px] flex items-center justify-center border-b border-slate-200/80 transition-all duration-300">
      <div className="max-w-[1050px] w-full mx-auto relative flex items-center justify-between md:justify-center">
        {/* Floating Capsule Bar */}
        <div className="bg-white/95 border border-slate-200/90 backdrop-blur-2xl rounded-full pl-3.5 pr-1.5 py-1 flex items-center justify-between md:inline-flex md:gap-5 shadow-[0_4px_25px_rgba(0,0,0,0.06)] w-full md:w-auto">
          {/* Brand Logo */}
          <a
            href="/#top"
            className="flex items-center gap-2 group cursor-pointer"
            aria-label="IOTRONICS home"
          >
            <img
              src="/Logo.png"
              alt="IOTRONICS"
              className="h-5.5 sm:h-6 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </a>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-4.5">
            {nav.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[12.5px] text-slate-600 hover:text-purple-700 cursor-pointer transition-colors flex items-center gap-1 font-semibold"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5">
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center gap-1 text-[11.5px] sm:text-[12px] font-bold text-slate-700 hover:text-purple-700 px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap"
            >
              <LogIn className="size-3 text-slate-500" />
              <span>Sign In</span>
            </Link>

            <Link
              to="/login"
              search={{ mode: "register" }}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11.5px] sm:text-[12px] font-bold px-3.5 sm:px-4 py-1.5 rounded-full hover:from-purple-700 hover:to-indigo-700 transition-all cursor-pointer whitespace-nowrap shadow-sm flex items-center gap-1.5 hover:-translate-y-0.5"
            >
              <UserPlus className="size-3 text-purple-200" />
              <span>Sign Up</span>
              <ArrowRight className="size-3" />
            </Link>

            {/* Mobile Hamburger inside bar */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              className="grid size-7 place-items-center rounded-full bg-slate-100 border border-slate-200 text-slate-700 md:hidden hover:bg-slate-200"
            >
              {open ? <X className="size-3.5" /> : <Menu className="size-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {open ? (
        <div className="absolute top-[60px] inset-x-0 border-b border-slate-200 bg-white/98 backdrop-blur-2xl md:hidden animate-in fade-in slide-in-from-top-2 duration-200 shadow-xl">
          <div className="mx-auto grid w-full max-w-md gap-1.5 px-6 py-5">
            <div className="flex items-center justify-between pb-3 mb-1 border-b border-slate-100">
              <a href="/#top" onClick={() => setOpen(false)} className="flex items-center" aria-label="IOTRONICS home">
                <img
                  src="/Logo.png"
                  alt="IOTRONICS"
                  className="h-7 w-auto object-contain"
                />
              </a>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 font-mono">
                Enterprise AI
              </span>
            </div>
            {nav.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-purple-700"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-3 grid gap-2 pt-3 border-t border-slate-200">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-xs font-semibold text-slate-900 hover:bg-slate-100 flex items-center justify-center gap-1.5"
              >
                <LogIn className="size-3.5 text-slate-600" />
                <span>Sign In / Login</span>
              </Link>
              <Link
                to="/login"
                search={{ mode: "register" }}
                onClick={() => setOpen(false)}
                className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 px-4 py-2.5 text-center text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                <UserPlus className="size-3.5 text-purple-200" />
                <span>Sign Up / Create Workspace</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
