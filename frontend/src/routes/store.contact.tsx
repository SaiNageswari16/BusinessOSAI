import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Home, Phone, Mail, MapPin, Clock, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/store/contact")({
  component: ContactPage,
});

function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      return toast.error("Please fill in all required fields.");
    }
    setIsSubmitted(true);
    toast.success("Thank you! Your enterprise inquiry has been submitted to the support desk.");
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* Breadcrumb */}
      <div className="bg-slate-50 py-8 mb-10 border-b border-slate-200">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 font-organic-heading mb-2">
            Enterprise Support Desk
          </h1>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#2563EB] flex items-center transition-colors font-medium">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <span className="text-[#2563EB] font-bold">Contact Support</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Contact Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="border border-slate-200 rounded-3xl p-6 md:p-8 bg-slate-50/70 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#2563EB] uppercase tracking-widest">
                  Direct Line
                </span>
                <h3 className="text-xl font-black text-slate-900 font-organic-heading">
                  We're Here to Help
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Have questions regarding POS hardware compatibility, bulk procurement pricing, GST invoices, or dispatch schedules?
                  Reach out to our B2B procurement team anytime.
                </p>
              </div>

              <div className="space-y-4 text-xs text-slate-700 pt-2">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-white border border-slate-200 text-[#2563EB] flex items-center justify-center shrink-0">
                    <Phone className="size-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900">Commercial Sales Desk</span>
                    <span className="text-slate-500">+91 98765 43210 • Mon-Sat 9am-8pm</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-white border border-slate-200 text-[#2563EB] flex items-center justify-center shrink-0">
                    <Mail className="size-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900">Enterprise Procurement</span>
                    <span className="text-slate-500">procurement@businessos.ai</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-white border border-slate-200 text-[#2563EB] flex items-center justify-center shrink-0">
                    <MapPin className="size-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900">Commercial Warehouse & Dispatch Hub</span>
                    <span className="text-slate-500">BusinessOS Tech Park, Phase II, Bengaluru, Karnataka, India</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="border border-slate-200 rounded-3xl p-6 md:p-8 bg-white shadow-xs space-y-6">
              <h2 className="text-xl font-black text-slate-900 font-organic-heading">
                Send Us an Inquiry
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#2563EB]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Your Business Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="ramesh@company.com"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Subject / Requirement</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Bulk POS Quote, Thermal paper supplies, or API Integration"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Message *</label>
                  <textarea
                    rows={5}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Specify hardware models, quantities needed, or delivery timelines..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#2563EB]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-8 py-3.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <Send className="size-3.5" /> Submit Inquiry
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
