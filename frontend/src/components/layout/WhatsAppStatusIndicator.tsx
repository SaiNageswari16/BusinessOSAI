import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Smartphone, RefreshCw, CheckCircle2,
  AlertCircle, ExternalLink, QrCode, PowerOff, ShieldCheck
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWhatsAppStatus, WhatsAppConnectionStatus } from "@/hooks/use-whatsapp-status";
import { cn } from "@/lib/utils";

interface WhatsAppStatusIndicatorProps {
  variant?: "pill" | "compact" | "pos" | "minimal";
  className?: string;
  showDetailsPopover?: boolean;
}

export function WhatsAppStatusIndicator({
  variant = "pill",
  className,
  showDetailsPopover = true,
}: WhatsAppStatusIndicatorProps) {
  const navigate = useNavigate();
  const {
    status,
    isOnline,
    sessionId,
    sessionInfo,
    loading,
    lastChecked,
    refresh,
  } = useWhatsAppStatus();

  const handleOpenWhatsAppSettings = () => {
    void navigate({ to: "/crm", search: { tab: "whatsapp_inbox" } });
  };

  // Config mapping per status
  const statusConfig: Record<
    WhatsAppConnectionStatus,
    {
      label: string;
      subtext: string;
      colorClass: string;
      dotClass: string;
      borderClass: string;
      bgClass: string;
      icon: React.ReactNode;
    }
  > = {
    online: {
      label: "Online",
      subtext: "Ready to dispatch receipts & invoices",
      colorClass: "text-emerald-700 dark:text-emerald-300",
      dotClass: "bg-emerald-500",
      borderClass: "border-emerald-200 dark:border-emerald-800",
      bgClass: "bg-emerald-50/90 dark:bg-emerald-950/40 hover:bg-emerald-100/90",
      icon: <CheckCircle2 className="size-3.5 text-emerald-600" />,
    },
    connecting: {
      label: "Connecting",
      subtext: "Initializing WhatsApp Web session...",
      colorClass: "text-blue-700 dark:text-blue-300",
      dotClass: "bg-blue-500 animate-ping",
      borderClass: "border-blue-200 dark:border-blue-800",
      bgClass: "bg-blue-50/90 dark:bg-blue-950/40 hover:bg-blue-100/90",
      icon: <RefreshCw className="size-3.5 text-blue-600 animate-spin" />,
    },
    qr_ready: {
      label: "Scan QR",
      subtext: "Awaiting phone QR scan",
      colorClass: "text-amber-700 dark:text-amber-300",
      dotClass: "bg-amber-500 animate-pulse",
      borderClass: "border-amber-200 dark:border-amber-800",
      bgClass: "bg-amber-50/90 dark:bg-amber-950/40 hover:bg-amber-100/90",
      icon: <QrCode className="size-3.5 text-amber-600" />,
    },
    offline: {
      label: "Offline",
      subtext: "Gateway disconnected or phone unreachable",
      colorClass: "text-rose-700 dark:text-rose-300",
      dotClass: "bg-rose-500",
      borderClass: "border-rose-200 dark:border-rose-800",
      bgClass: "bg-rose-50/90 dark:bg-rose-950/40 hover:bg-rose-100/90",
      icon: <PowerOff className="size-3.5 text-rose-600" />,
    },
    unlinked: {
      label: "Not Linked",
      subtext: "No WhatsApp number configured",
      colorClass: "text-slate-600 dark:text-slate-400",
      dotClass: "bg-slate-400",
      borderClass: "border-slate-200 dark:border-slate-700",
      bgClass: "bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200/80",
      icon: <AlertCircle className="size-3.5 text-slate-500" />,
    },
  };

  const current = statusConfig[status];

  // Visual Trigger Button based on Variant
  const triggerElement = (
    <button
      type="button"
      title={`WhatsApp Status: ${current.label} (${current.subtext})`}
      className={cn(
        "transition-all duration-150 cursor-pointer flex items-center select-none font-medium",
        // POS Terminal specific compact style
        variant === "pos" && [
          "h-7 px-2 rounded-lg border text-[11px] gap-1 shadow-2xs font-bold",
          current.bgClass,
          current.borderClass,
          current.colorClass,
        ],
        // Topbar Pill style
        variant === "pill" && [
          "h-7.5 px-2 rounded-lg border text-[11px] gap-1.5 font-bold shadow-2xs",
          current.bgClass,
          current.borderClass,
          current.colorClass,
        ],
        // Compact icon-only with badge
        variant === "compact" && [
          "h-8 w-8 rounded-lg border flex items-center justify-center relative",
          current.bgClass,
          current.borderClass,
        ],
        // Minimal text badge
        variant === "minimal" && [
          "px-1.5 py-0.5 rounded-full border text-[10px] font-bold gap-1",
          current.bgClass,
          current.borderClass,
          current.colorClass,
        ],
        className
      )}
    >
      {/* Icon */}
      <span className="relative flex items-center justify-center shrink-0">
        <MessageCircle className="size-3.5 text-[#25D366]" />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full ring-1 ring-white dark:ring-slate-900",
            current.dotClass
          )}
        />
      </span>

      {/* Label (compact WA prefix) */}
      {variant !== "compact" && (
        <span className="font-bold leading-none truncate whitespace-nowrap">
          WA {current.label}
        </span>
      )}
    </button>
  );

  if (!showDetailsPopover) {
    return triggerElement;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{triggerElement}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
      >
        {/* Header */}
        <div
          className={cn(
            "p-3.5 border-b flex items-center justify-between",
            isOnline
              ? "bg-emerald-500/10 border-emerald-500/20"
              : status === "qr_ready"
              ? "bg-amber-500/10 border-amber-500/20"
              : "bg-rose-500/10 border-rose-500/20"
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-white dark:bg-slate-800 border shadow-xs flex items-center justify-center">
              <MessageCircle className="size-4 text-[#25D366]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  WhatsApp Connection
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider",
                    isOnline
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  )}
                >
                  {current.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {current.subtext}
              </p>
            </div>
          </div>

          <button
            onClick={() => void refresh()}
            disabled={loading}
            title="Refresh status"
            className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin text-purple-600")} />
          </button>
        </div>

        {/* Body Details */}
        <div className="p-3.5 space-y-3 text-xs">
          <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-semibold text-slate-500">Active Number:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {sessionId ? `+${sessionId}` : "None paired"}
              </span>
            </div>
            {sessionInfo?.info?.pushname && (
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold text-slate-500">Account:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                  {sessionInfo.info.pushname}
                </span>
              </div>
            )}
            {sessionInfo?.owner_name && (
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold text-slate-500">Assigned To:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                  {sessionInfo.owner_name}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
              <span className="text-[10px] text-slate-400">Last Verified:</span>
              <span className="text-[10px] text-slate-500">
                {lastChecked ? lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "Just now"}
              </span>
            </div>
          </div>

          {/* Operational Guidance */}
          <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
            {isOnline ? (
              <p className="flex items-start gap-1.5 text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="size-3.5 shrink-0 mt-0.5 text-emerald-600" />
                <span>Automated POS thermal receipts, sales invoices, and customer alerts are sending smoothly.</span>
              </p>
            ) : status === "qr_ready" ? (
              <p className="flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
                <QrCode className="size-3.5 shrink-0 mt-0.5 text-amber-600" />
                <span>A QR code is waiting to be scanned on your mobile WhatsApp app.</span>
              </p>
            ) : (
              <p className="flex items-start gap-1.5 text-rose-800 dark:text-rose-300">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5 text-rose-600" />
                <span>WhatsApp is currently offline. Customers will not receive auto-receipts until reconnected.</span>
              </p>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={handleOpenWhatsAppSettings}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-[#00a884] hover:bg-[#008f72] text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <span>{isOnline ? "Open WhatsApp Studio" : "Link / Reconnect Device"}</span>
            <ExternalLink className="size-3" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
