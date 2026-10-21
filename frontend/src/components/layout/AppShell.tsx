import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  LogIn,
  Menu,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  UtensilsCrossed,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { switchBranch, useSettings } from "@/services/orderService";
import { notifications } from "@/data/business";
import { CommandPalette } from "./CommandPalette";
import { AiAssistant } from "./AiAssistant";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { resolveTenantNavigation } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const toneDot: Record<string, string> = {
  critical: "bg-critical",
  warning: "bg-warning",
  info: "bg-info",
  success: "bg-success",
  ai: "bg-ai",
};
const iconBtn =
  "grid size-8 place-items-center rounded-md text-nav-muted transition-colors hover:bg-nav-border hover:text-nav-foreground [&_svg]:size-4";

export function AppShell({ children }: { children: ReactNode }) {
  const [cmd, setCmd] = useState(false);
  const [ai, setAi] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const settings = useSettings();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, switchOutlet } = useAuth();
  const { hasPermission } = usePermissions();

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = useMemo(() => {
    return resolveTenantNavigation(undefined, hasPermission);
  }, [hasPermission]);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("ros-theme");
      if (stored === "dark") {
        localStorage.setItem("ros-theme", "light");
        setDark(false);
      } else {
        setDark(false);
      }
    }
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("dark");
    }
  }, []);
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", dark);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("ros-theme", dark ? "dark" : "light");
    }
  }, [dark]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-nav text-nav-foreground border-b border-nav-border">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <button
            className={cn(iconBtn, "lg:hidden")}
            onClick={() => setMobile(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <UtensilsCrossed className="size-4" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">RestaurantOS</span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="ml-2 hidden items-center gap-2 rounded-md border border-nav-border px-2.5 py-1.5 text-xs text-nav-foreground hover:bg-nav-border md:flex">
              <span className="size-1.5 rounded-full bg-success" />
              {settings.currentBranch}
              <ChevronDown className="size-3.5 text-nav-muted" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Switch branch</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={settings.currentBranch}
                onValueChange={(v) => {
                  switchBranch(v);
                  toast.success(`Switched to ${v}`);
                }}
              >
                {settings.branches.map((b) => (
                  <DropdownMenuRadioItem key={b} value={b}>
                    {b}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => setCmd(true)}
            className="mx-auto hidden h-8 w-full max-w-md items-center gap-2 rounded-md border border-nav-border bg-nav-border/40 px-3 text-xs text-nav-muted hover:text-nav-foreground sm:flex"
          >
            <Search className="size-3.5" />
            Search orders, customers, menu…
            <kbd className="ml-auto rounded border border-nav-border px-1.5 font-mono text-[10px]">
              Ctrl K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            <button
              className={cn(iconBtn, "sm:hidden")}
              onClick={() => setCmd(true)}
              aria-label="Search"
            >
              <Search />
            </button>
            <button
              onClick={() => setAi(true)}
              className="hidden h-8 items-center gap-1.5 rounded-md bg-ai/10 border border-ai/20 px-2.5 text-xs font-medium text-ai hover:bg-ai/20 md:flex"
            >
              <Sparkles className="size-3.5" /> AI Assistant
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                <Plus className="size-3.5" /> <span className="hidden sm:inline">New</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate({ to: "/pos" })}>
                  New order
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/reservations" })}>
                  New reservation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/crm" })}>
                  Add customer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/inventory" })}>
                  Stock adjustment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/operations" })}>
                  Seat walk-in
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger className={cn(iconBtn, "relative")} aria-label="Notifications">
                <Bell />
                <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-critical" />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <span className="text-sm font-semibold">Notifications</span>
                  <span className="text-xs text-muted-foreground">{notifications.length} new</span>
                </div>
                <ul className="divide-y">
                  {notifications.map((n) => (
                    <li key={n.id} className="flex gap-3 px-4 py-2.5">
                      <span
                        className={cn("mt-1.5 size-2 shrink-0 rounded-full", toneDot[n.tone])}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{n.title}</div>
                        <div className="text-xs text-muted-foreground">{n.body}</div>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{n.time}</span>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
            <button
              className={cn(iconBtn, "hidden sm:grid")}
              aria-label="Help"
              onClick={() =>
                toast("Help centre", { description: "Docs and support will open here." })
              }
            >
              <CircleHelp />
            </button>
            <button
              className={iconBtn}
              aria-label="Toggle theme"
              onClick={() => setDark((d) => !d)}
            >
              {dark ? <Sun /> : <Moon />}
            </button>
            {mounted && isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="ml-1 grid size-8 place-items-center rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                  {user.fullName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="font-medium text-foreground">{user.fullName}</div>
                    <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
                    <div className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {user.role}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                    My Profile & Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/platform" })}>
                    <ShieldCheck className="mr-2 size-4 text-primary" /> Platform Super Admin
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/" })}>
                    <UtensilsCrossed className="mr-2 size-4 text-primary" /> Switch Business Portal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    logout();
                    navigate({ to: "/" });
                  }}>
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/login"
                className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <LogIn className="size-3.5" /> Sign In
              </Link>
            )}
          </div>
        </div>
        <nav className="hidden h-10 items-center gap-0.5 overflow-x-auto border-t border-nav-border px-4 lg:flex lg:px-6">
          {navItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="relative flex h-10 items-center px-3 text-[13px] text-nav-muted transition-colors hover:text-nav-foreground"
              activeProps={{
                className:
                  "!text-nav-foreground font-medium after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle>RestaurantOS</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4 text-xs text-muted-foreground">{settings.currentBranch}</div>
          <nav className="flex flex-col px-2">
            {navItems.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMobile(false)}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-md px-3 py-2 text-sm hover:bg-accent"
                activeProps={{ className: "bg-accent font-medium" }}
              >
                {n.label}
              </Link>
            ))}
            <button
              onClick={() => {
                setMobile(false);
                setAi(true);
              }}
              className="mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ai hover:bg-accent"
            >
              <Sparkles className="size-4" /> AI Assistant
            </button>
          </nav>
        </SheetContent>
      </Sheet>
      <CommandPalette open={cmd} onOpenChange={setCmd} />
      <AiAssistant open={ai} onOpenChange={setAi} />
    </div>
  );
}

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1480px] space-y-5 px-4 py-6 lg:px-6", className)}>
      {children}
    </div>
  );
}
