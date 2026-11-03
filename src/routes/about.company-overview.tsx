import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { CompanyOverviewTemplate } from "@/components/sections/CompanyOverviewTemplate";

export const Route = createFileRoute("/about/company-overview")({
  component: CompanyOverviewPage,
});

function CompanyOverviewPage() {
  return (
    <div className="relative min-h-screen bg-[#f8fafd] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      <Header activeLink="About" />
      <CompanyOverviewTemplate />
      <Footer />
    </div>
  );
}

