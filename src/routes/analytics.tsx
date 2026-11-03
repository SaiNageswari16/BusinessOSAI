import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AnalyticsPageTemplate } from "@/components/sections/AnalyticsPageTemplate";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <div className="relative min-h-screen bg-[#f8fafd] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      <Header activeLink="Analytics" />
      <AnalyticsPageTemplate />
      <Footer />
    </div>
  );
}

