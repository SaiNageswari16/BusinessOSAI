import { useState } from "react";
import { Send, CheckCircle2, Bot, Sparkles, Mail, Phone, Building2, ArrowRight } from "lucide-react";
import { products } from "@/data/products";
import { Section, Reveal, Cta } from "@/components/site/primitives";

export function ContactSection() {
  const [submitted, setSubmitted] = useState(false);
  const [selectedApp, setSelectedApp] = useState(products[0]?.name ?? "AI Business OS");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <Section id="contact" className="bg-[#f8f9fa] border-t border-slate-200/90">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-15" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-halo" />

      <div className="relative grid gap-12 lg:grid-cols-[1.05fr_0.95fr] items-center">
        {/* Left Information Block */}
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-50 px-4 py-1.5 text-xs font-bold tracking-[0.14em] text-purple-700 uppercase shadow-2xs">
            <Sparkles className="size-3.5 text-purple-600" /> Get in Touch
          </span>

          <h2 className="mt-6 font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-slate-950">
            Let's Build{" "}
            <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Something Smarter.
            </span>
          </h2>

          <p className="mt-5 text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg font-normal">
            Looking for an AI-powered solution for your business? Explore our applications, discover the right tools for your needs, or connect with our team to discuss your requirements.
          </p>

          <div className="mt-8 space-y-3.5">
            {[
              "Personalized 1-on-1 walkthrough with a solution architect",
              "Custom sandbox testing with your existing datasets",
              "Tailored pricing plans built around your team size and velocity",
            ].map((point) => (
              <div key={point} className="flex items-center gap-2.5 text-xs text-slate-800 font-medium">
                <CheckCircle2 className="size-4 text-purple-600 shrink-0" />
                <span>{point}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 text-white shadow-md hover:brightness-105"
            >
              Contact Us <ArrowRight className="size-4" />
            </a>
            <a
              href="#applications"
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 shadow-xs"
            >
              Explore Applications
            </a>
          </div>
        </Reveal>

        {/* Right Contact / Demo Request Card */}
        <Reveal delay={100}>
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-md">
            {submitted ? (
              <div className="text-center py-10">
                <span className="grid size-14 place-items-center rounded-2xl bg-purple-600 text-white mx-auto shadow-md">
                  <CheckCircle2 className="size-8" />
                </span>
                <h3 className="mt-4 font-display text-xl font-bold text-slate-950">
                  Thank You for Reaching Out!
                </h3>
                <p className="mt-2 text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                  We received your inquiry regarding <span className="text-purple-700 font-bold">{selectedApp}</span>. An AI solutions consultant will follow up with {formData.email || "you"} within 2 hours.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-6 rounded-full border border-slate-300 px-5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="border-b border-slate-200 pb-3 mb-2">
                  <h3 className="font-display text-base font-bold text-slate-950">
                    Request a Demo or Consultation
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Fill in your details below and we will prepare a live demo environment.
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">
                    Interested Application
                  </label>
                  <select
                    value={selectedApp}
                    onChange={(e) => setSelectedApp(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:bg-white focus:outline-none"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} ({p.category})
                      </option>
                    ))}
                    <option value="All Applications">All IOTRONICS Products (Platform License)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase">Your Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Siddhant Tiwari"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase">Work Email</label>
                    <input
                      required
                      type="email"
                      placeholder="name@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase">Company Name</label>
                    <input
                      type="text"
                      placeholder="Company Inc."
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase">How can we help?</label>
                  <textarea
                    rows={2}
                    placeholder="Tell us about your current workflow bottlenecks or requirements..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 py-3 text-xs font-bold text-white shadow-md hover:brightness-105 transition-all cursor-pointer"
                >
                  <Send className="size-3.5" /> Request a Demo / Contact Us
                </button>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
