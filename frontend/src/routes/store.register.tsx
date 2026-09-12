import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Home, Sparkles, Gift, CheckCircle2, User, Mail, Lock, Phone, MapPin, ArrowRight } from "lucide-react";
import { useStoreUser } from "@/contexts/StoreUserContext";
import { toast } from "sonner";

export const Route = createFileRoute("/store/register")({
  component: AccountRegister,
});

function AccountRegister() {
  const navigate = useNavigate();
  const { register } = useStoreUser();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Dubai");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !email.trim()) {
      toast.error("Please enter your name and email address");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      register({
        firstName,
        lastName,
        email,
        phone: phone || "+971 50 123 4567",
        address: address || "Villa 14, Al Wasl Road",
        city: city || "Dubai",
      });
      toast.success("Welcome to LazyMonkey!", {
        description: "Your account is created. +1,000 Coins & ₹500 Wallet Balance added!",
      });
      setIsLoading(false);
      navigate({ to: "/store" });
    }, 400);
  };

  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* Breadcrumb Banner */}
      <div className="bg-[#FAF8EF] py-10 mb-10 border-b border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6BB252]/10 text-[#6BB252] text-xs font-bold mb-3 border border-[#6BB252]/20">
            <Sparkles className="size-3.5" />
            <span>Join LazyMonkey Rewards Club</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 font-organic-heading mb-2">
            Create Customer Account
          </h1>
          <div className="text-xs text-gray-500 flex items-center justify-center space-x-2">
            <Link to="/store" className="hover:text-[#6BB252] flex items-center transition-colors font-medium">
              <Home className="h-3.5 w-3.5 mr-1" />
              Store
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-[#6BB252] font-bold">Register</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl">
        {/* Welcome Bonus Callout */}
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Gift className="size-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-gray-900">New Shopper Welcome Rewards</h4>
              <p className="text-xs text-gray-600">
                Register today to get <strong className="text-amber-700 font-black">1,000 LazyMonkey Coins</strong> + <strong className="text-[#6BB252] font-black">₹500 Wallet Credit</strong> instantly!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-white px-3 py-1.5 rounded-full border border-gray-200">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span>Instant Activation</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Column: Register Form */}
          <div className="lg:col-span-7 bg-[#FAF8EF]/50 p-6 sm:p-10 border border-gray-200/80 rounded-3xl shadow-xs">
            <h2 className="text-2xl font-black text-gray-900 font-organic-heading mb-2">Create Your Profile</h2>
            <p className="text-xs text-gray-500 mb-6">Enter your details to track orders, save shipping addresses, and unlock marketplace wholesale rates.</p>
            
            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">First Name *</label>
                  <div className="relative">
                    <User className="size-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-[#6BB252] focus:ring-1 focus:ring-[#6BB252] text-xs font-medium transition-all"
                      placeholder="e.g. David"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Last Name</label>
                  <input 
                    type="text" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-[#6BB252] focus:ring-1 focus:ring-[#6BB252] text-xs font-medium transition-all"
                    placeholder="e.g. Chen"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Email Address *</label>
                <div className="relative">
                  <Mail className="size-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-[#6BB252] focus:ring-1 focus:ring-[#6BB252] text-xs font-medium transition-all"
                    placeholder="david.chen@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="size-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="tel" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-[#6BB252] focus:ring-1 focus:ring-[#6BB252] text-xs font-medium transition-all"
                      placeholder="+971 50 123 4567"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">City / Emirate</label>
                  <input 
                    type="text" 
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-[#6BB252] focus:ring-1 focus:ring-[#6BB252] text-xs font-medium transition-all"
                    placeholder="Dubai / Abu Dhabi"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Default Delivery Address</label>
                <div className="relative">
                  <MapPin className="size-4 text-gray-400 absolute left-3 top-3" />
                  <textarea 
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-[#6BB252] focus:ring-1 focus:ring-[#6BB252] text-xs font-medium transition-all"
                    placeholder="Building / Villa name, Street, Community"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Password *</label>
                <div className="relative">
                  <Lock className="size-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-[#6BB252] focus:ring-1 focus:ring-[#6BB252] text-xs font-medium transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full mt-4 bg-[#6BB252] hover:bg-[#5ba342] text-white font-black py-3.5 px-6 rounded-2xl uppercase tracking-wider transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isLoading ? "Creating Account..." : "Create Account & Claim Rewards"}</span>
                <ArrowRight className="size-4" />
              </button>
            </form>
          </div>

          {/* Right Column: Benefits & Login Prompt */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            <div className="bg-slate-50 p-6 sm:p-8 rounded-3xl border border-slate-200">
              <h3 className="text-lg font-black text-gray-900 font-organic-heading mb-4">LazyMonkey Customer Perks</h3>
              <ul className="space-y-3.5 text-xs text-gray-600">
                <li className="flex items-start gap-2.5">
                  <div className="size-5 rounded-full bg-emerald-100 text-[#6BB252] flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span><strong>Live Order Tracking:</strong> Instant courier updates, dispatch alerts & real-time ETA.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="size-5 rounded-full bg-emerald-100 text-[#6BB252] flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span><strong>LazyMonkey Coins:</strong> Earn coins on every purchase and redeem at checkout.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="size-5 rounded-full bg-emerald-100 text-[#6BB252] flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span><strong>1-Click Direct Invoicing:</strong> Official GST/TRN tax invoices auto-generated with every order.</span>
                </li>
              </ul>
            </div>

            <div className="p-6 sm:p-8 rounded-3xl border border-gray-200 bg-white text-center">
              <h4 className="text-base font-black text-gray-900 mb-2">Already have an account?</h4>
              <p className="text-xs text-gray-500 mb-5">
                Sign in to access your saved payment methods, orders, and wallet balance.
              </p>
              <Link 
                to="/store/account" 
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 rounded-2xl border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white font-black uppercase text-xs tracking-wider transition-all"
              >
                <span>Sign In To Existing Account</span>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

