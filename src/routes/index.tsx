import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { HeroSection } from "@/components/sections/HeroSection";
import { TrustedBrandBlack } from "@/components/sections/TrustedBrandBlack";
import { ServicesSection } from "@/components/sections/ServicesSection";
import { ApplicationsSection } from "@/components/sections/ApplicationsSection";
import { CommonFeaturesSection } from "@/components/sections/CommonFeaturesSection";
import { IndustrySolutions } from "@/components/sections/IndustrySolutions";
import { AnalyticsDashboard } from "@/components/sections/AnalyticsDashboard";
import { CustomizationSection } from "@/components/sections/CustomizationSection";
import { IntegrationsSecurity } from "@/components/sections/IntegrationsSecurity";
import { AboutUsSection } from "@/components/sections/AboutUsSection";
import WhyChooseUs01Finsyc from "@/components/sections/WhyChooseUs01Finsyc";
import { ResourcesFaq } from "@/components/sections/ResourcesFaq";
import { ContactSection } from "@/components/sections/ContactSection";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen bg-[#f8f9fa] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      <main>
        {/* 1. Hero Section with Integrated Glass Navbar & Real-world Trust Metrics */}
        <HeroSection />

        {/* 2. Trusted Brand & Municipal Corporation Marquee */}
        <TrustedBrandBlack />

        {/* 3. Technology & IT Services */}
        <ServicesSection />

        {/* 4. Applications / Products Showcase */}
        <ApplicationsSection />

        {/* 4. Built with Intelligence / Common Features */}
        <CommonFeaturesSection />

        {/* 5. Tailored Industry Verticals & Civic Governance Solutions */}
        <IndustrySolutions />

        {/* 6. Live Business Intelligence & Multi-Branch Telemetry */}
        <AnalyticsDashboard />

        {/* 7. Customization & Bespoke Software */}
        <CustomizationSection />

        {/* 8. Enterprise Hardware Connectivity & Zero-Trust Security */}
        <IntegrationsSecurity />

        {/* 9. About Us Section & Architecture */}
        <AboutUsSection />

        {/* 10. Strategic Advantages & Financial Growth Benefits */}
        <WhyChooseUs01Finsyc />

        {/* 11. Frequently Asked Questions & Knowledge Base */}
        <ResourcesFaq />

        {/* 12. Contact & Demo Section */}
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
