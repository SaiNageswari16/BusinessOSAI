import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AboutMainPageTemplate } from "@/components/sections/AboutMainPageTemplate";

export const Route = createFileRoute("/about/")({
  component: AboutMainPage,
});

function AboutMainPage() {
  return (
    <div className="relative min-h-screen bg-[#f8fafd] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      <Header activeLink="About" />
      <AboutMainPageTemplate />
      <Footer />
    </div>
  );
}

