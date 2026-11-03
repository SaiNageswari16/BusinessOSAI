import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ContactMainPageTemplate } from "@/components/sections/ContactMainPageTemplate";

export const Route = createFileRoute("/contact/")({
  component: ContactMainPage,
});

function ContactMainPage() {
  return (
    <div className="relative min-h-screen bg-[#f8fafd] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      <Header activeLink="Contact" />
      <ContactMainPageTemplate />
      <Footer />
    </div>
  );
}

