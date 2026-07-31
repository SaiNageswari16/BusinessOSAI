import { Wallet, Coins, ChevronRight, ShieldCheck, CreditCard, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchStorefrontUserContext } from "@/lib/storefront-api";
import { useNavigate } from "@tanstack/react-router";

export function WalletRewardsWidget() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['storefrontUserContext'],
    queryFn: fetchStorefrontUserContext,
    staleTime: 60_000,
  });

  const wallet = data?.wallet;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
        <div className="bg-slate-900 rounded-2xl p-6 h-40 animate-pulse" />
        <div className="bg-[#ff6a00] rounded-2xl p-6 h-40 animate-pulse" />
        <div className="bg-[#3b43f9] rounded-2xl p-6 h-40 animate-pulse" />
      </div>
    );
  }

  // Fallback to zeros if no wallet data is found
  const balance = wallet?.balance ?? 0;
  const coins = wallet?.osai_coins ?? 0;
  const tier = wallet?.membership_tier ?? "Standard Member";
  const cardLastFour = wallet?.card_last_four ?? "****";

  return (
    <section className="py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Wallet Balance Card */}
        <div 
          onClick={() => navigate({ to: '/store/wallet', search: { action: undefined } })}
          className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group cursor-pointer hover:shadow-xl transition-all"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                <Wallet className="w-4 h-4 text-blue-400" />
              </div>
              <span className="font-semibold text-sm">LazyMonkeyAI Wallet</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors group-hover:translate-x-1" />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-white drop-shadow-md">Rs {balance.toFixed(2)}</h3>
            <p className="text-green-400 text-xs mt-1 flex items-center gap-1 font-medium"><Sparkles className="w-3 h-3" /> +2% cashback</p>
          </div>
          <div className="mt-4 flex gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); navigate({ to: '/store/wallet', search: { action: 'topup' } }); }}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              Add Money
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); navigate({ to: '/store/wallet', search: { action: 'history' } }); }}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
            >
              History
            </button>
          </div>
        </div>

        {/* Rewards Card */}
        <div 
          onClick={() => navigate({ to: '/store/wallet', search: { action: undefined } })}
          className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group cursor-pointer hover:shadow-xl transition-all"
        >
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Coins className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-sm">LazyMonkeyAI Coins</span>
            </div>
            <ChevronRight className="w-5 h-5 text-white/70 group-hover:text-white transition-colors group-hover:translate-x-1" />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-white drop-shadow-md flex items-center gap-2">
              {coins.toLocaleString()}
              <span className="text-sm font-medium bg-white/20 px-2 py-1 rounded-full flex items-center gap-1 shadow-inner backdrop-blur-sm">
                <Coins className="w-3 h-3" /> = Rs {(coins / 100).toFixed(2)}
              </span>
            </h3>
            <p className="text-white/90 text-xs mt-2 font-medium">Use coins to pay for up to 50% of your next order across any service.</p>
          </div>
        </div>

        {/* Credit/Membership Card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden group cursor-pointer hover:shadow-xl transition-all hidden lg:block">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="flex justify-between items-center text-white/90 font-medium text-sm mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/20">
                <CreditCard className="w-3 h-3 text-white" />
              </div>
              {tier}
            </div>
            <ShieldCheck className="w-4 h-4 text-white/80" />
          </div>
          <div className="mt-6 flex flex-col justify-end">
            <p className="text-white font-mono tracking-widest text-lg drop-shadow-md">**** **** **** {cardLastFour}</p>
            <p className="text-white/70 text-[10px] mt-2 uppercase tracking-widest font-bold">Free Delivery on all orders</p>
          </div>
        </div>

      </div>
    </section>
  );
}
