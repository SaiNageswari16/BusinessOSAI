import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LazyMonkeyAIHeader } from "@/components/storefront/LazyMonkeyAIHeader";
import { LazyMonkeyAINavBar } from "@/components/storefront/LazyMonkeyAINavBar";
import { StoreCartProvider } from "@/contexts/StoreCartContext";
import { Facebook, Twitter, Instagram, Youtube, MapPin, Mail, Phone } from "lucide-react";

export const Route = createFileRoute("/store")({
  component: StoreLayout,
});

function StoreLayout() {
  return (
    <StoreCartProvider>
      <div className="min-h-screen bg-[#F2F2F2] font-sans flex flex-col">
        {/* Top Header */}
        <LazyMonkeyAIHeader />
        
        {/* Navigation Navbar */}
        <LazyMonkeyAINavBar />
        
        {/* Main Content Area */}
        <main className="flex-1 w-full pb-10">
          <Outlet />
        </main>

        {/* Newsletter Section */}
        <section className="bg-purple-900 text-white py-12">
          <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between">
            <div className="mb-6 md:mb-0">
              <h2 className="text-2xl font-bold mb-2">Subscribe to our Newsletter</h2>
              <p className="text-sm opacity-90">Get all the latest information on Events, Sales and Offers.</p>
            </div>
            <div className="flex w-full md:w-auto max-w-md">
              <input 
                type="email" 
                placeholder="Email address here..." 
                className="flex-1 px-4 py-3 rounded-l-full text-[#1A1A1A] outline-none"
              />
              <button className="bg-[#1A1A1A] hover:bg-[#111111] px-8 py-3 rounded-r-full font-bold transition-colors">
                SUBSCRIBE
              </button>
            </div>
          </div>
        </section>

        {/* LazyMonkeyAI Footer */}
        <footer className="bg-white border-t border-[#E5E4E2] py-16 text-gray-600 text-sm">
          <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Contact Info */}
            <div>
              <div className="text-3xl font-black tracking-tight text-[#1A1A1A] mb-6">
                LazyMonkeyAI
              </div>
              <p className="mb-6">We are a team of designers and developers that create high quality Magento, Prestashop, Opencart...</p>
              <div className="space-y-3">
                <div className="flex items-start"><MapPin className="w-5 h-5 mr-3 text-purple-900 flex-shrink-0" /> 4710-4890 Breckinridge St, USA</div>
                <div className="flex items-center"><Mail className="w-5 h-5 mr-3 text-purple-900 flex-shrink-0" /> support@vegist.com</div>
                <div className="flex items-center"><Phone className="w-5 h-5 mr-3 text-purple-900 flex-shrink-0" /> 1-1001-234-5678</div>
              </div>
            </div>

            {/* Information */}
            <div>
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-6 uppercase tracking-wide">Information</h3>
              <ul className="space-y-3">
                <li><a href="#" className="hover:text-purple-900 transition-colors">Delivery Information</a></li>
                <li><a href="#" className="hover:text-purple-900 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-purple-900 transition-colors">Terms & Conditions</a></li>
                <li><a href="#" className="hover:text-purple-900 transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-purple-900 transition-colors">Returns</a></li>
              </ul>
            </div>

            {/* Custom Links */}
            <div>
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-6 uppercase tracking-wide">Custom Links</h3>
              <ul className="space-y-3">
                <li><a href="#" className="hover:text-purple-900 transition-colors">Legal Notice</a></li>
                <li><a href="#" className="hover:text-purple-900 transition-colors">Prices drop</a></li>
                <li><a href="#" className="hover:text-purple-900 transition-colors">New products</a></li>
                <li><a href="#" className="hover:text-purple-900 transition-colors">Best sales</a></li>
                <li><a href="#" className="hover:text-purple-900 transition-colors">Login</a></li>
              </ul>
            </div>

            {/* Socials & Download */}
            <div>
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-6 uppercase tracking-wide">Follow Us</h3>
              <div className="flex space-x-4 mb-8">
                <a href="#" className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-purple-900 hover:text-white hover:border-purple-900 transition-all"><Facebook className="w-4 h-4" /></a>
                <a href="#" className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-purple-900 hover:text-white hover:border-purple-900 transition-all"><Twitter className="w-4 h-4" /></a>
                <a href="#" className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-purple-900 hover:text-white hover:border-purple-900 transition-all"><Instagram className="w-4 h-4" /></a>
                <a href="#" className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-purple-900 hover:text-white hover:border-purple-900 transition-all"><Youtube className="w-4 h-4" /></a>
              </div>
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-4 uppercase tracking-wide">Download App</h3>
              <div className="flex space-x-2">
                <div className="bg-[#F2F2F2] text-xs px-4 py-2 rounded border border-[#E5E4E2] cursor-pointer">App Store</div>
                <div className="bg-[#F2F2F2] text-xs px-4 py-2 rounded border border-[#E5E4E2] cursor-pointer">Google Play</div>
              </div>
            </div>
          </div>
          <div className="container mx-auto px-4 mt-12 pt-6 border-t border-[#E5E4E2] flex flex-col md:flex-row justify-between items-center text-gray-500">
            <div>© 2026 LazyMonkeyAI. All Rights Reserved.</div>
            <div className="flex space-x-2 mt-4 md:mt-0 opacity-60">
              {/* Mock payment icons */}
              <div className="w-10 h-6 bg-gray-200 rounded"></div>
              <div className="w-10 h-6 bg-gray-200 rounded"></div>
              <div className="w-10 h-6 bg-gray-200 rounded"></div>
              <div className="w-10 h-6 bg-gray-200 rounded"></div>
            </div>
          </div>
        </footer>
      </div>
    </StoreCartProvider>
  );
}
