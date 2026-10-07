import { useEffect, useState } from "react";
import { Menu, X, Sparkles, ArrowRight } from "lucide-react";

const nav = [
  { label: "Home", href: "/#top" },
  { label: "Applications", href: "/#applications" },
  { label: "Why Us", href: "/#features" },
  { label: "About Us", href: "/#about" },
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
    <header className="sticky top-0 z-[100] h-[76px] bg-[#030205]/80 backdrop-blur-md px-4 sm:px-8 md:px-[60px] flex items-center justify-center border-b border-white/[0.04] transition-all duration-300">
      <div className="max-w-[1050px] w-full mx-auto relative flex items-center justify-between md:justify-center">
        {/* Floating Capsule Bar */}
        <div className="bg-[#14121f]/90 border border-white/10 backdrop-blur-2xl rounded-full pl-4 pr-1.5 py-1.5 flex items-center justify-between md:inline-flex md:gap-7 shadow-[0_4px_30px_rgba(0,0,0,0.6)] w-full md:w-auto">
          {/* Brand Logo */}
          <a
            href="/#top"
            className="flex items-center gap-2.5 group cursor-pointer"
            aria-label="IOTRONICS home"
          >
            <img
              src="/logo.png"
              alt="IOTRONICS"
              className="h-7 sm:h-8 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </a>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            {nav.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[13.5px] text-zinc-400 hover:text-white cursor-pointer transition-colors flex items-center gap-1 font-medium"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <a
              href="/#contact"
              className="bg-white text-black text-[12.5px] sm:text-[13px] font-bold px-4 sm:px-5 py-2 rounded-full hover:bg-gray-100 transition-all cursor-pointer whitespace-nowrap shadow-sm flex items-center gap-1.5 hover:-translate-y-0.5"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>Request Demo</span>
            </a>

            {/* Mobile Hamburger inside bar */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              className="grid size-8 place-items-center rounded-full bg-white/5 border border-white/10 text-white md:hidden"
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {open ? (
        <div className="absolute top-[76px] inset-x-0 border-b border-white/10 bg-[#030205]/95 backdrop-blur-2xl md:hidden animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xl">
          <div className="mx-auto grid w-full max-w-md gap-1.5 px-6 py-5">
            {nav.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-3 grid gap-2 pt-3 border-t border-white/10">
              <a
                href="/#applications"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-xs font-semibold text-white"
              >
                Explore Products
              </a>
              <a
                href="/#contact"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-white text-black px-4 py-2.5 text-center text-xs font-bold shadow-sm flex items-center justify-center gap-1.5"
              >
                Request a Demo <ArrowRight className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
