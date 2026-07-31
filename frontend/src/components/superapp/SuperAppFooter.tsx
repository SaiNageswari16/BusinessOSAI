import { Facebook, Twitter, Instagram, Youtube, Sparkles } from "lucide-react";

export function SuperAppFooter() {
  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-24 md:pb-8 font-sans">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2 mb-6 group cursor-pointer">
            <div className="w-10 h-10 flex items-center justify-center transition-transform group-hover:scale-105">
              <img src="/Logo.png" alt="LazyMonkeyAI Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-black tracking-tight text-[#1A1A1A] leading-none">LazyMonkey<span className="text-amber-500">AI</span></span>
          </div>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Your one-stop destination for everything you need. From groceries and fashion to travel and entertainment, experience seamless shopping.
          </p>
          <div className="flex space-x-4">
            {[Facebook, Twitter, Instagram, Youtube].map((Icon, idx) => (
              <a key={idx} href="#" className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-amber-500 hover:text-white transition-all shadow-sm">
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Links */}
        <div>
          <h3 className="font-black text-[#1A1A1A] uppercase tracking-wider mb-6">Services</h3>
          <ul className="space-y-3 text-sm text-gray-500 font-medium">
            {['Grocery Delivery', 'Fashion Store', 'Electronics', 'Hotel Booking', 'Food Delivery'].map(item => (
              <li key={item}><a href="#" className="hover:text-amber-500 transition-colors">{item}</a></li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-black text-[#1A1A1A] uppercase tracking-wider mb-6">Support</h3>
          <ul className="space-y-3 text-sm text-gray-500 font-medium">
            {['Help Center', 'Track Order', 'Return Policy', 'Terms of Service', 'Privacy Policy'].map(item => (
              <li key={item}><a href="#" className="hover:text-amber-500 transition-colors">{item}</a></li>
            ))}
          </ul>
        </div>

        {/* App Download */}
        <div>
          <h3 className="font-black text-[#1A1A1A] uppercase tracking-wider mb-6">Get the App</h3>
          <p className="text-sm text-gray-500 mb-6">Download our app for the best experience and exclusive mobile offers.</p>
          <div className="flex flex-col space-y-3">
            <button className="bg-[#1A1A1A] hover:bg-black text-white px-6 py-3 rounded-xl flex items-center justify-center gap-3 transition-colors">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.8 3.59-.83 1.63-.04 2.94.59 3.84 1.7-3.04 1.83-2.52 6.09.43 7.35-.6 1.58-1.55 3.09-2.94 3.95zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              <div className="flex flex-col items-start">
                <span className="text-[10px] leading-none opacity-80">Download on the</span>
                <span className="font-bold leading-none mt-1">App Store</span>
              </div>
            </button>
            <button className="bg-[#1A1A1A] hover:bg-black text-white px-6 py-3 rounded-xl flex items-center justify-center gap-3 transition-colors">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M3.609 1.814L13.792 12 3.61 22.186c-.165-.126-.275-.323-.275-.547V2.36c0-.224.11-.421.274-.546zm10.74 9.63l2.875 2.876-2.876 2.875-10.18-5.75 10.18-5.75zM17.846 15.6l2.133-1.233c.966-.558.966-1.464 0-2.022l-2.133-1.233-3.2 3.2 3.2 3.2z"/></svg>
              <div className="flex flex-col items-start">
                <span className="text-[10px] leading-none opacity-80">GET IT ON</span>
                <span className="font-bold leading-none mt-1">Google Play</span>
              </div>
            </button>
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 container mx-auto px-4">
        <p className="text-sm text-gray-400">© {new Date().getFullYear()} LazyMonkeyAI. All rights reserved.</p>
        <div className="flex items-center gap-2">
          {/* Mock payment methods */}
          <div className="w-10 h-6 bg-gray-100 rounded border border-gray-200"></div>
          <div className="w-10 h-6 bg-gray-100 rounded border border-gray-200"></div>
          <div className="w-10 h-6 bg-gray-100 rounded border border-gray-200"></div>
          <div className="w-10 h-6 bg-gray-100 rounded border border-gray-200"></div>
        </div>
      </div>
    </footer>
  );
}
