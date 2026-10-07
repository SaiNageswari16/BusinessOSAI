import React from "react";
import {
  Sparkles,
  Lightbulb,
  Zap,
  User,
  TrendingUp,
  MousePointer2,
  ShieldCheck,
  Globe,
  PieChart,
  Bell,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BenefitItemProps {
  title: string;
  description: string;
  icon: LucideIcon;
  delay?: number;
}

function BenefitItem({ title, description, icon: Icon }: BenefitItemProps) {
  return (
    <div className="flex gap-6 transition-all duration-500 ease-out hover:translate-x-1 group">
      <div className="flex-shrink-0 w-11 h-11 bg-purple-50 border border-purple-200/80 rounded-xl flex items-center justify-center shadow-2xs group-hover:bg-purple-600 group-hover:text-white transition-colors text-purple-600">
        <Icon className="w-5.5 h-5.5" strokeWidth={2.2} />
      </div>
      <div className="flex flex-col gap-1">
        <h3
          className="text-slate-950 text-[20px] md:text-[24px] font-bold leading-[26px] md:leading-[30px] tracking-tight group-hover:text-purple-700 transition-colors"
          style={{ fontFamily: "'Onest', sans-serif" }}
        >
          {title}
        </h3>
        <p className="text-slate-600 font-sans text-base md:text-[18px] font-normal leading-[24px] md:leading-[28px]">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function WhyChooseUs01Finsyc({ className }: { className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isLargeScreen, setIsLargeScreen] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);

  React.useEffect(() => {
    const checkScreen = () => setIsLargeScreen(window.innerWidth >= 1024);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  React.useEffect(() => {
    if (!isLargeScreen) {
      setScrollProgress(0);
      return;
    }

    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalHeight = containerRef.current.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;

      const currentScroll = -rect.top;
      const progress = Math.min(Math.max(currentScroll / totalHeight, 0), 1);
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isLargeScreen]);

  const yTranslatePercent = -(scrollProgress * 65);
  const translateY = isLargeScreen ? `${yTranslatePercent}%` : "0%";

  const tags = [
    "Automated Operations",
    "Smart Security",
    "AI Insights",
    "Real-time Telemetry",
    "Unified Dashboard",
  ];

  const benefits: Array<{ title: string; description: string; icon: LucideIcon }> = [
    {
      title: "Smart financial insights",
      description: "Get real-time visibility into your spending, income, and financial trends to make faster decisions.",
      icon: Lightbulb,
    },
    {
      title: "Fast and seamless tracking",
      description: "Automatically track all transactions across accounts without manual input or delays.",
      icon: Zap,
    },
    {
      title: "Personalized for you",
      description: "Customize workflows, modules, and role-based permissions based on your enterprise setup.",
      icon: User,
    },
    {
      title: "Maximum operational efficiency",
      description: "Reduce unnecessary overhead and optimize your supply chain with intelligent AI triggers.",
      icon: TrendingUp,
    },
    {
      title: "Simple and user friendly",
      description: "Enjoy a clean, intuitive interface designed to make managing operations effortless.",
      icon: MousePointer2,
    },
    {
      title: "Advanced data security",
      description: "Your enterprise data is protected with SOC 2 Type II compliant encryption and secure protocols.",
      icon: ShieldCheck,
    },
    {
      title: "Global connectivity",
      description: "Sync your branches, POS terminals, and warehouses across locations in real time.",
      icon: Globe,
    },
    {
      title: "Customized analytics",
      description: "Create deep-dive reports and visualizations that matter most to your business goals.",
      icon: PieChart,
    },
    {
      title: "Instant smart alerts",
      description: "Stay ahead with real-time notifications about unusual variances, low stock, or approvals.",
      icon: Bell,
    },
    {
      title: "Collaborative platform",
      description: "Share reports and coordinate multi-team workflows with team members seamlessly.",
      icon: Users,
    },
  ];

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap"
        rel="stylesheet"
        crossOrigin="anonymous"
      />

      <section className={cn("w-full bg-white py-16 md:py-24 lg:py-[120px] flex justify-center border-t border-slate-200/90", className)}>
        <div className="w-full max-w-[1440px] px-6 lg:px-[96px]">
          <div className="w-full max-w-[1248px] mx-auto">
            <div className="flex flex-col lg:flex-row items-start gap-16 lg:gap-[48px] justify-between">
              {/* Left Column - Sticky */}
              <div className="w-full lg:max-w-[622px] flex flex-col items-start lg:sticky lg:top-[120px] self-start">
                <div className="px-4 py-2 bg-purple-50 border border-purple-200/80 rounded-full flex items-center gap-2 mb-8 shadow-2xs">
                  <Sparkles className="w-4 h-4 text-purple-600 fill-purple-600" />
                  <span className="text-purple-700 font-sans text-sm font-bold">Why Choose IOTRONICS</span>
                </div>

                <h2
                  className="text-slate-950 text-[32px] sm:text-[42px] md:text-[52px] font-extrabold leading-[38px] sm:leading-[48px] md:leading-[58px] tracking-tight mb-4"
                  style={{ fontFamily: "'Onest', sans-serif" }}
                >
                  Take full control of your business growth with{" "}
                  <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-600 bg-clip-text text-transparent italic">
                    intelligent
                  </span>{" "}
                  tools
                </h2>

                <p className="text-slate-600 font-sans text-lg md:text-[20px] font-normal leading-[26px] md:leading-[32px] mb-14 max-w-[560px]">
                  Manage your enterprise smarter with powerful tools designed to simplify tracking, optimize workflows, and drive better business decisions.
                </p>

                <div className="flex flex-wrap gap-2.5">
                  {tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-5 py-2.5 border border-slate-200/90 rounded-full text-slate-800 font-sans text-[15px] md:text-[16px] font-medium hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-all cursor-default bg-white shadow-2xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right Column - Scrollable List */}
              <div
                ref={containerRef}
                className="flex-1 lg:max-w-[578px] flex items-start pr-0 lg:h-[220vh] h-auto relative w-full"
              >
                <div className="lg:sticky lg:top-[120px] lg:h-[800px] h-auto flex items-start w-full lg:overflow-hidden overflow-visible">
                  <div className="hidden lg:block absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-white via-white/95 to-transparent z-10 pointer-events-none" />

                  {/* Vertical progress rail */}
                  <div className="hidden lg:flex flex-col items-center mr-10 xl:mr-12 relative w-[3px] bg-purple-100 self-stretch rounded-full">
                    <div
                      style={{
                        height: `${scrollProgress * 100}%`,
                        transition: "height 0.15s cubic-bezier(0, 0, 0.2, 1)",
                      }}
                      className="w-full bg-gradient-to-b from-purple-600 via-indigo-600 to-purple-700 rounded-full absolute top-0 left-0 shadow-sm"
                    />
                  </div>

                  <div
                    style={{
                      transform: isLargeScreen ? `translateY(${translateY})` : "none",
                      transition: isLargeScreen ? "transform 0.15s cubic-bezier(0, 0, 0.2, 1)" : "none",
                    }}
                    className="w-full lg:w-[514px] flex flex-col gap-10 md:gap-12 lg:gap-16 lg:pt-28 lg:pb-40 pt-0 pb-0"
                  >
                    {benefits.map((benefit, idx) => (
                      <BenefitItem
                        key={idx}
                        title={benefit.title}
                        description={benefit.description}
                        icon={benefit.icon}
                        delay={0.4 + idx * 0.1}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
