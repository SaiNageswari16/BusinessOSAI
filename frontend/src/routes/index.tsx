import { createFileRoute } from "@tanstack/react-router";
import { Footer } from "@/components/Website/site/Footer";
import { FloatingSocials } from "@/components/Website/site/FloatingSocials";
import { SideScrollNavigator } from "@/components/Website/site/SideScrollNavigator";
import { HeroSection } from "@/components/Website/sections/HeroSection";
import { TrustedBrandBlack } from "@/components/Website/sections/TrustedBrandBlack";
import { ServicesSection } from "@/components/Website/sections/ServicesSection";
import { ApplicationsSection } from "@/components/Website/sections/ApplicationsSection";
import { IndustrySolutions } from "@/components/Website/sections/IndustrySolutions";
import { AiSuite } from "@/components/Website/sections/AiSuite";
import { CommonFeaturesSection } from "@/components/Website/sections/CommonFeaturesSection";
import { AnalyticsDashboard } from "@/components/Website/sections/AnalyticsDashboard";
import { IntegrationsSecurity } from "@/components/Website/sections/IntegrationsSecurity";
import { CustomizationSection } from "@/components/Website/sections/CustomizationSection";
import { HowItWorksSteps } from "@/components/Website/sections/HowItWorksSteps";
import WhyChooseUs01Finsyc from "@/components/Website/sections/WhyChooseUs01Finsyc";
import { PricingSection } from "@/components/Website/sections/PricingSection";
import { ResourcesFaq } from "@/components/Website/sections/ResourcesFaq";
import { AboutUsSection } from "@/components/Website/sections/AboutUsSection";
import { ContactSection } from "@/components/Website/sections/ContactSection";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen bg-[#f8f9fa] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      <main>
        {/* 1. Hero Section */}
        <HeroSection />

        {/* 2. Trusted Brand Marquee */}
        <TrustedBrandBlack />

        {/* 3. Technology & Cloud Services */}
        <ServicesSection />

        {/* 4. Applications / Products Section (with Quick Preview Modal & Deep Dive Links) */}
        <ApplicationsSection />

        {/* 5. Verticals / Industry Solutions */}
        <IndustrySolutions />

        {/* 6. Autonomous AI Copilot Suite */}
        <AiSuite />

        {/* 7. Built with Intelligence / Common Features */}
        <CommonFeaturesSection />

        {/* 8. Live Telemetry & Analytics Dashboard */}
        <AnalyticsDashboard />

        {/* 9. Zero-Trust Integrations & Security */}
        <IntegrationsSecurity />

        {/* 10. Customization & Bespoke Software */}
        <CustomizationSection />

        {/* 11. Implementation Roadmap & Live Lifecycle Flow */}
        <HowItWorksSteps />

        {/* 12. Why Choose Us / Financial Growth Benefits */}
        <WhyChooseUs01Finsyc />

        {/* 13. Transparent Pricing & Investment Plans */}
        <PricingSection />

        {/* 14. Knowledge Base, Developer Guides & FAQ */}
        <ResourcesFaq />

        {/* 15. About Us Section */}
        <AboutUsSection />

        {/* 16. Contact & Demo Section */}
        <ContactSection />
      </main>
      <Footer />
      <FloatingSocials />
      <SideScrollNavigator />
    </div>
  );
}
