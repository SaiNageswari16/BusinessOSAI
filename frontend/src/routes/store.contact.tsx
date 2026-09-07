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
    toast.success("Thank you! Your message has been sent to our customer care team.");
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* Breadcrumb */}
      <div className="bg-[#FAF8EF] py-8 mb-10 border-b border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 font-organic-heading mb-2">
            Contact Support & Stores
          </h1>
          <div className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <Link to="/store" className="hover:text-[#6BB252] flex items-center transition-colors font-medium">
              <Home className="size-3.5 mr-1" /> Home
            </Link>
            <span>/</span>
            <span className="text-[#6BB252] font-bold">Contact Us</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Contact Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="border border-gray-100 rounded-3xl p-6 md:p-8 bg-[#FAF8EF]/50 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#6BB252] uppercase tracking-widest">
                  Direct Line
                </span>
                <h3 className="text-xl font-black text-gray-900 font-organic-heading">
                  We're Here to Help
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Have questions regarding your delivery, certified organic products, or partnership inquiries?
                  Reach out to our customer care team anytime.
                </p>
              </div>

              <div className="space-y-4 text-xs text-gray-700 pt-2">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-white border border-gray-200 text-[#6BB252] flex items-center justify-center shrink-0">
                    <Phone className="size-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-gray-900">Toll-Free Phone</span>
                    <span className="text-gray-500">(800) 123-4567 • Mon-Sat 7am-9pm</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-white border border-gray-200 text-[#6BB252] flex items-center justify-center shrink-0">
                    <Mail className="size-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-gray-900">Email Inquiries</span>
                    <span className="text-gray-500">support@organicstore.com</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-white border border-gray-200 text-[#6BB252] flex items-center justify-center shrink-0">
                    <MapPin className="size-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-gray-900">Central Hub & Farm Depot</span>
                    <span className="text-gray-500">Al Quoz Industrial Hub 3, Dubai, UAE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="border border-gray-100 rounded-3xl p-6 md:p-8 bg-white shadow-xs space-y-6">
              <h2 className="text-xl font-black text-gray-900 font-organic-heading">
                Send Us a Message
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Sarah Connor"
                      className="w-full px-3.5 py-2.5 bg-[#FAF8EF]/40 border border-gray-200 rounded-xl outline-none focus:border-[#6BB252]"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1">Your Email Address *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="sarah@example.com"
                      className="w-full px-3.5 py-2.5 bg-[#FAF8EF]/40 border border-gray-200 rounded-xl outline-none focus:border-[#6BB252]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Order inquiry, feedback, or delivery questions"
                    className="w-full px-3.5 py-2.5 bg-[#FAF8EF]/40 border border-gray-200 rounded-xl outline-none focus:border-[#6BB252]"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Message *</label>
                  <textarea
                    rows={5}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="How can we assist you today?"
                    className="w-full px-3.5 py-2.5 bg-[#FAF8EF]/40 border border-gray-200 rounded-xl outline-none focus:border-[#6BB252]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-8 py-3.5 bg-[#6BB252] hover:bg-[#5ba342] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <Send className="size-3.5" /> Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
