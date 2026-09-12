import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { 
  Home, User, Mail, Lock, LogOut, Package, Wallet, Coins, 
  MapPin, Phone, ShieldCheck, ArrowRight, CheckCircle2, Sparkles 
} from "lucide-react";
import { useStoreUser } from "@/contexts/StoreUserContext";
import { useCurrency } from "@/hooks/use-currency";
import { toast } from "sonner";

export const Route = createFileRoute("/store/account")({
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const { user, isLoggedIn, login, logout, updateProfile } = useStoreUser();
  const { currency } = useCurrency();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editAddress, setEditAddress] = useState(user?.address || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    login(loginEmail);
    toast.success(`Welcome back, ${loginEmail.split("@")[0]}!`);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      address: editAddress,
      phone: editPhone,
    });
    setIsEditingAddress(false);
    toast.success("Profile & Delivery Address updated successfully!");
  };

  return (
    <div className="bg-white min-h-screen pb-20 font-organic-body">
      {/* Breadcrumb Banner */}
      <div className="bg-[#FAF8EF] py-10 mb-10 border-b border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 font-organic-heading mb-2">
            {isLoggedIn ? `Customer Portal` : `Account Login`}
          </h1>
          <div className="text-xs text-gray-500 flex items-center justify-center space-x-2">
            <Link to="/store" className="hover:text-[#6BB252] flex items-center transition-colors font-medium">
              <Home className="h-3.5 w-3.5 mr-1" />
              Store
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-[#6BB252] font-bold">Account</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl">
        {isLoggedIn && user ? (
          /* ── LOGGED IN DASHBOARD ── */
          <div className="space-y-8">
            {/* Header Profile Card */}
            <div className="bg-gradient-to-r from-[#1A1A1A] via-slate-900 to-slate-800 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-2xl bg-[#6BB252] text-white font-black text-2xl flex items-center justify-center shadow-lg border-2 border-white/20">
                  {user.firstName[0]?.toUpperCase() || "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black font-organic-heading text-white">{user.name}</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-900 flex items-center gap-1">
                      <Sparkles className="size-3" />
                      {user.membershipTier}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                    <span>{user.email}</span>
                    <span>•</span>
                    <span className="font-mono text-emerald-400 font-bold">{user.id}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  to="/store/orders"
                  className="px-4 py-2.5 bg-[#6BB252] hover:bg-[#5ba342] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                >
                  <Package className="size-4" />
                  <span>My Orders & Tracking</span>
                </Link>
                <button
                  onClick={() => {
                    logout();
                    toast.info("You have signed out.");
                  }}
                  className="px-3.5 py-2.5 bg-white/10 hover:bg-rose-600 hover:text-white text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>

            {/* Wallet & Coins Ribbon */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Wallet Card */}
              <div className="p-6 rounded-3xl bg-[#FAF8EF] border border-gray-200 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                    <Wallet className="size-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                      LazyMonkey Wallet Balance
                    </span>
                    <span className="text-2xl font-black text-gray-900">
                      {currency.symbol}{user.walletBalance.toFixed(2)}
                    </span>
                  </div>
                </div>
                <Link
                  to="/store/shop"
                  className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition-colors"
                >
                  Shop Now
                </Link>
              </div>

              {/* Coins Card */}
              <div className="p-6 rounded-3xl bg-[#FAF8EF] border border-gray-200 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                    <Coins className="size-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block">
                      LazyMonkey Coins
                    </span>
                    <span className="text-2xl font-black text-amber-600">
                      {user.osaiCoins.toLocaleString()} <span className="text-xs text-gray-500 font-semibold">Coins</span>
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-lg">
                  100 Coins = {currency.symbol}1.00
                </span>
              </div>
            </div>

            {/* Address & Profile Details */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-black text-gray-900 font-organic-heading">Shipping & Contact Info</h3>
                  <p className="text-xs text-gray-500">Auto-filled at checkout for instant 1-click ordering.</p>
                </div>
                <button
                  onClick={() => {
                    setEditAddress(user.address);
                    setEditPhone(user.phone);
                    setIsEditingAddress(!isEditingAddress);
                  }}
                  className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {isEditingAddress ? "Cancel" : "Edit Details"}
                </button>
              </div>

              {isEditingAddress ? (
                <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg text-xs">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-[#6BB252]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Delivery Address</label>
                    <textarea
                      rows={3}
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:border-[#6BB252]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#6BB252] hover:bg-[#5ba342] text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                  >
                    Save Changes
                  </button>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <MapPin className="size-5 text-[#6BB252] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-gray-500 text-[10px] uppercase block">Saved Shipping Address</span>
                      <p className="font-bold text-gray-900 mt-1">{user.address}</p>
                      <p className="text-gray-600">{user.city}, UAE</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <Phone className="size-5 text-[#6BB252] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-gray-500 text-[10px] uppercase block">Contact Phone</span>
                      <p className="font-bold text-gray-900 mt-1">{user.phone}</p>
                      <p className="text-gray-500 text-[11px] mt-0.5">Used for SMS dispatch and delivery notifications</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── LOGIN FORM ── */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Left Column: Login Form */}
            <div className="bg-[#FAF8EF]/60 p-8 md:p-10 border border-gray-200 rounded-3xl shadow-xs">
              <h2 className="text-2xl font-black text-gray-900 font-organic-heading mb-2">Sign In</h2>
              <p className="text-xs text-gray-500 mb-6">Enter your registered email to access your orders and rewards.</p>
              
              <form onSubmit={handleLogin} className="space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Email Address *</label>
                  <div className="relative">
                    <Mail className="size-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="email" 
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-[#6BB252] focus:ring-1 focus:ring-[#6BB252] text-xs font-medium"
                      placeholder="david.chen@example.com"
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
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:border-[#6BB252] focus:ring-1 focus:ring-[#6BB252] text-xs font-medium"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-gray-500">Demo password: any 6+ chars</span>
                  <a href="#" className="text-xs text-[#6BB252] hover:underline font-semibold">Forgot password?</a>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-[#6BB252] hover:bg-[#5ba342] text-white font-black py-3.5 px-8 rounded-2xl uppercase tracking-wider transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2 mt-4"
                >
                  <span>Sign In</span>
                  <ArrowRight className="size-4" />
                </button>
              </form>
            </div>

            {/* Right Column: Create Account Prompt */}
            <div className="flex flex-col justify-center border-l-0 md:border-l border-gray-200 pl-0 md:pl-10 space-y-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900 font-organic-heading mb-3">New to LazyMonkey?</h2>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Join our online store to access live courier delivery tracking, earn LazyMonkey Coins on every order, save delivery addresses, and enjoy verified marketplace products.
                </p>
              </div>

              <div className="space-y-3 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>Real-time tracking with driver consignment ID & ETA</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>Automatic tax invoices generated with every checkout</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>1,000 Coins + ₹500 Wallet Credit bonus upon registration</span>
                </div>
              </div>

              <div>
                <Link 
                  to="/store/register" 
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white font-black py-3.5 px-8 rounded-2xl uppercase text-xs tracking-wider transition-all shadow-md"
                >
                  <Sparkles className="size-4 text-amber-400" />
                  <span>Create An Account</span>
                </Link>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

