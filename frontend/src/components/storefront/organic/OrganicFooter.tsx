import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Truck, ShieldCheck, Award, PiggyBank, Tag,
  Facebook, Twitter, Instagram, Youtube, Send,
  MapPin, Mail, Phone, ArrowRight, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

export function OrganicFooter() {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      return toast.error("Please enter a valid email address.");
    }
    setIsSubscribed(true);
    toast.success("Thank you for subscribing to Organic Grocery updates & weekly coupons!");
    setEmail("");
  };

  const trustHighlights = [
    {
      icon: Truck,
      title: "Free Delivery",
      description: "Fast free doorstep delivery on all orders over $50.",
    },
    {
      icon: ShieldCheck,
      title: "100% Secure Payment",
      description: "Guaranteed safe encrypted checkouts with SSL security.",
    },
    {
      icon: Award,
      title: "Quality Guarantee",
      description: "Hand-inspected, 100% certified pesticide-free organic harvest.",
    },
    {
      icon: PiggyBank,
      title: "Guaranteed Savings",
      description: "Direct farm relationships mean wholesale savings for you.",
    },
    {
      icon: Tag,
      title: "Daily Offers",
      description: "Fresh daily seasonal flash sales and member coupon codes.",
    },
  ];

  return (
    <footer className="w-full bg-white border-t border-gray-100 mt-16 font-sans">
      {/* ── 5 Feature Trust Highlights ── */}
      <div className="border-b border-gray-100 bg-[#FAF8EF]/60 py-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {trustHighlights.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3.5 group">
                <div className="size-11 rounded-xl bg-white border border-gray-200/80 text-[#6BB252] flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-[#6BB252] group-hover:text-white transition-colors duration-300">
                  <item.icon className="size-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider mb-1">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Multi-Column Footer ── */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Col 1: Logo & Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/store" className="inline-flex items-center gap-2 group">
              <img
                src="/Logo.png"
                alt="LazyMonkey Store"
                className="h-9 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <div className="flex flex-col">
                <span className="font-black text-base text-gray-900 tracking-tight font-organic-heading leading-tight flex items-center gap-1">
                  LazyMonkey<span className="text-[#6BB252]">Store</span>
                </span>
                <span className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase">
                  Omnichannel Marketplace
                </span>
              </div>
            </Link>
            <p className="text-xs text-gray-500 leading-relaxed max-w-sm">
              Connecting certified organic farms, artisan bakeries, and clean pantry producers directly to your home with 100% genuine farm-fresh groceries delivered to your doorsteps.
            </p>

            <div className="pt-2">
              <span className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-3">
                Follow Us
              </span>
              <div className="flex items-center gap-2">
                {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="size-8 rounded-full bg-[#FAF8EF] hover:bg-[#6BB252] text-gray-600 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Icon className="size-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2.5 text-xs text-gray-600">
              <li>
                <Link to="/store/shop" className="hover:text-[#6BB252] transition-colors">
                  Shop All Products
                </Link>
              </li>
              <li>
                <Link to="/store/shop" search={{ filter: "sale" }} className="hover:text-[#6BB252] transition-colors">
                  Offers & Promotions
                </Link>
              </li>
              <li>
                <Link to="/store/shop" search={{ filter: "coupons" }} className="hover:text-[#6BB252] transition-colors">
                  Discount Coupons
                </Link>
              </li>
              <li>
                <Link to="/store/orders" className="hover:text-[#6BB252] transition-colors">
                  Track Order
                </Link>
              </li>
              <li>
                <Link to="/store/account" className="hover:text-[#6BB252] transition-colors">
                  Customer Account
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Customer Service */}
          <div>
            <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider mb-4">
              Customer Service
            </h4>
            <ul className="space-y-2.5 text-xs text-gray-600">
              <li>
                <Link to="/store/about" className="hover:text-[#6BB252] transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/store/contact" className="hover:text-[#6BB252] transition-colors">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link to="/store/styles" className="hover:text-[#6BB252] transition-colors">
                  Style Guide
                </Link>
              </li>
              <li>
                <Link to="/store/blog" className="hover:text-[#6BB252] transition-colors">
                  Our Journals
                </Link>
              </li>
              <li>
                <Link to="/store/thank-you" className="hover:text-[#6BB252] transition-colors">
                  Order Status
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Newsletter Subscription */}
          <div>
            <h4 className="font-bold text-xs text-gray-900 uppercase tracking-wider mb-4">
              Subscribe Us
            </h4>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Subscribe to our weekly newsletter to get instant updates about grand seasonal offers and member discounts.
            </p>

            <form onSubmit={handleSubscribe} className="space-y-2">
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email..."
                  className="w-full pl-3.5 pr-10 py-2.5 bg-[#FAF8EF] border border-gray-200 rounded-xl text-xs text-gray-800 outline-none focus:border-[#6BB252] transition-colors placeholder:text-gray-400"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 bg-[#6BB252] hover:bg-[#5ba342] text-white rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Send className="size-3.5" />
                </button>
              </div>

              {isSubscribed && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                  <CheckCircle2 className="size-3.5" /> Subscribed successfully!
                </div>
              )}
            </form>
          </div>
        </div>

        {/* ── Bottom Bar ── */}
        <div className="border-t border-gray-100 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-4">
          <p>© 2026 Organic Grocery Store. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/store/about" className="hover:text-gray-700">Privacy Policy</Link>
            <span>•</span>
            <Link to="/store/about" className="hover:text-gray-700">Terms of Service</Link>
            <span>•</span>
            <Link to="/store/contact" className="hover:text-gray-700">Store Locator</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
