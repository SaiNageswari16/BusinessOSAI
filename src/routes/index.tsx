import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { HeroSection } from "@/components/sections/HeroSection";
import { TrustedBrandBlack } from "@/components/sections/TrustedBrandBlack";
import { ApplicationsSection } from "@/components/sections/ApplicationsSection";
import { CommonFeaturesSection } from "@/components/sections/CommonFeaturesSection";
import { CustomizationSection } from "@/components/sections/CustomizationSection";
import { AboutUsSection } from "@/components/sections/AboutUsSection";
import { ContactSection } from "@/components/sections/ContactSection";
import WhyChooseUs01Finsyc from "@/components/sections/WhyChooseUs01Finsyc";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="relative min-h-screen bg-[#f8f9fa] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900">
      <Header />
      <main>
        {/* 1. Hero Section */}
        <HeroSection />

        {/* 2. Trusted Brand Marquee */}
        <TrustedBrandBlack />

        {/* 3. Applications / Products Section */}
        <ApplicationsSection />

        {/* 4. Built with Intelligence / Common Features */}
        <CommonFeaturesSection />

        {/* 5. Customization & Bespoke Software */}
        <CustomizationSection />

        {/* 6. About Us Section */}
        <AboutUsSection />

        {/* 7. Contact & Demo Section */}
        <ContactSection />

        {/* 8. Why Choose Us / Financial Growth Benefits */}
        <WhyChooseUs01Finsyc />
      </main>
      <Footer />
    </div>
  );
}
