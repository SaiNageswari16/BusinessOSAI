import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/login")({
  component: LoginRedirectPage,
});

function LoginRedirectPage() {
  useEffect(() => {
    const search = window.location.search || "";
    const hostname = window.location.hostname;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      Boolean(import.meta.env?.DEV);

    if (isLocal) {
      // Stay on localhost: navigate to local BusinessOS app on port 8080
      const targetBase = window.location.port === "8080" ? "" : "http://localhost:8080";
      window.location.href = `${targetBase}/login${search}`;
      return;
    }

    // On production server, redirect to production portal
    window.location.href = `https://lazymonkeyai.com/login${search}`;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] text-slate-900 font-sans px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="size-9 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
        <h2 className="text-lg font-bold text-slate-900">Redirecting to IOTRONICS / BusinessOS Portal...</h2>
        <p className="text-xs text-slate-500">Please wait while we transfer you to the secure authorization service.</p>
      </div>
    </div>
  );
}
