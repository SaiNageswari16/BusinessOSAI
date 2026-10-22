import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useRestaurantStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HeaderBrandBar } from "./HeaderBrandBar";
import { HeaderModals } from "./HeaderModals";
import { HeaderNavBar } from "./HeaderNavBar";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const dark = useRestaurantStore((s) => s.settings.dark);
  const clearPosCart = useRestaurantStore((s) => s.clearPosCart);

  const [cmdOpen, setCmdOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Sync dark mode class on mount and whenever settings.dark changes
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", dark);
    }
  }, [dark]);

  // Global keyboard shortcut (Ctrl+K / Cmd+K for command palette)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleNewOrderQuickAction = () => {
    clearPosCart();
    navigate({ to: "/pos" });
    toast.info("POS ready for a new order");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* Two-Row Premium Colorful RestaurantOS Application Header */}
      <header
        className={cn(
          "sticky top-0 z-40 w-full text-[#F8FAFC] border-b border-[rgba(148,163,184,0.22)] transition-colors",
          dark
            ? "bg-gradient-to-r from-[#041122] via-[#071B32] to-[#081F3A] shadow-[0_6px_28px_rgba(0,0,0,0.45)]"
            : "bg-gradient-to-r from-[#071B32] via-[#0B2A4A] to-[#092340] shadow-[0_6px_24px_rgba(7,27,50,0.22)]",
        )}
      >
        {/* Subtle ambient cyan, blue & violet depth highlights */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 left-12 h-36 w-72 rounded-full bg-[#22D3EE]/10 blur-3xl" />
          <div className="absolute -top-16 left-1/2 h-36 w-96 -translate-x-1/2 rounded-full bg-[#1769E8]/14 blur-3xl" />
          <div className="absolute -top-14 right-28 h-36 w-72 rounded-full bg-[#8B5CF6]/12 blur-3xl" />
        </div>

        {/* Row 1: Main Application Bar */}
        <HeaderBrandBar
          mobileNavOpen={mobileNavOpen}
          onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
          onOpenSearch={() => setCmdOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
          onOpenResetConfirm={() => setResetConfirmOpen(true)}
          onNewOrder={handleNewOrderQuickAction}
        />

        {/* Row 2: Horizontal Navigation Bar */}
        <HeaderNavBar
          mobileNavOpen={mobileNavOpen}
          onCloseMobileNav={() => setMobileNavOpen(false)}
        />
      </header>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-[1640px] flex-1 px-4 py-5 lg:px-6">{children}</main>

      {/* Command Palette, Help & Reset Modals */}
      <HeaderModals
        cmdOpen={cmdOpen}
        onCmdOpenChange={setCmdOpen}
        helpOpen={helpOpen}
        onHelpOpenChange={setHelpOpen}
        resetConfirmOpen={resetConfirmOpen}
        onResetConfirmOpenChange={setResetConfirmOpen}
      />
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumb, badge, actions }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {breadcrumb && (
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              RestaurantOS
            </Link>
            <span>/</span>
            <span className="text-foreground">{breadcrumb}</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
