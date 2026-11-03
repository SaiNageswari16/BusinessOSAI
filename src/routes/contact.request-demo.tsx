import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { RequestDemoTemplate } from "@/components/sections/RequestDemoTemplate";

export const Route = createFileRoute("/contact/request-demo")({
  component: RequestDemoPage,
});

function RequestDemoPage() {
  return (
    <div className="relative min-h-screen bg-[#f8fafd] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      <Header activeLink="Contact" />
      <RequestDemoTemplate />
      <Footer />
    </div>
  );
}

