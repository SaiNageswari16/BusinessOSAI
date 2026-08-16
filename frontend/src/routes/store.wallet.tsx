import { createFileRoute } from "@tanstack/react-router";
import { Wallet, CreditCard, Sparkles, TrendingUp, History, ShieldCheck, QrCode, X, Trash2, CheckCircle2, ArrowRightLeft, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchStorefrontUserContext, fetchWalletTransactions, topUpWallet } from "@/lib/storefront-api";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/store/wallet")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      action: (search.action as string) || undefined,
    };
  },
  component: WalletPage,
});

const initialCards = [
  { id: "c1", type: "VISA", number: "4242", expiry: "12/26" }
];

const initialMissions = [
  { id: "m1", title: "Complete your profile", reward: 500, progress: 100 },
  { id: "m2", title: "Link a new credit card", reward: 200, progress: 0 },
  { id: "m3", title: "Book your first hotel", reward: 1000, progress: 0 }
];

function WalletPage() {
  const searchParams = Route.useSearch();
  const [activeTab, setActiveTab] = useState("wallet");
  const queryClient = useQueryClient();
  
  // Real DB State
  const { data: userContext, isLoading: isLoadingContext } = useQuery({
    queryKey: ['storefrontUserContext'],
    queryFn: fetchStorefrontUserContext,
  });

  const { data: transactions = [], isLoading: isLoadingTx } = useQuery({
    queryKey: ['storefrontWalletTransactions'],
    queryFn: fetchWalletTransactions,
  });

  const topUpMutation = useMutation({
    mutationFn: topUpWallet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storefrontUserContext'] });
      queryClient.invalidateQueries({ queryKey: ['storefrontWalletTransactions'] });
      toast.success("Top Up Successful!", {
        style: { background: '#10b981', color: 'white', border: 'none' } 
      });
    },
    onError: () => {
      toast.error("Failed to top up wallet.");
    }
  });

  // Mock State for UI extras
  const [cards, setCards] = useState(initialCards);
  const [missions, setMissions] = useState(initialMissions);

  // Auto-open modal or scroll based on search params
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  
  useEffect(() => {
    if (searchParams.action === 'topup') {
      setActiveTab("wallet");
      setIsTopUpOpen(true);
    } else if (searchParams.action === 'history') {
      setActiveTab("wallet");
      // Could scroll to history here
    }
  }, [searchParams.action]);

  if (isLoadingContext || isLoadingTx) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-12 h-12 text-purple-900 animate-spin" />
      </div>
    );
  }

  const wallet = userContext?.wallet;
  const balance = wallet?.balance ?? 0;
  const coins = wallet?.osai_coins ?? 0;
  const tier = wallet?.membership_tier ?? "Standard";

  return (
    <div className="bg-gray-50 min-h-screen pb-20 pt-8 font-sans relative overflow-hidden">
      {/* Decorative background blur */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-400/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-20 -left-32 w-80 h-80 bg-indigo-400/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-4 max-w-5xl relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-black text-[#1A1A1A] tracking-tight">LazyMonkeyAI Pay & Rewards</h1>
            <p className="text-gray-500 text-sm mt-2 font-medium">Manage your digital wallet and loyalty perks securely.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                 <ShieldCheck className="w-4 h-4 text-purple-900" />
               </div>
               <div>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</p>
                 <p className="text-sm font-bold text-gray-900">{tier}</p>
               </div>
             </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 bg-white/60 p-1.5 rounded-2xl shadow-sm border border-gray-200/60 max-w-sm backdrop-blur-md">
          <button 
            onClick={() => setActiveTab("wallet")}
            className={`flex-1 py-2.5 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 ${activeTab === 'wallet' ? 'bg-[#1A1A1A] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <Wallet className="w-4 h-4" /> Digital Wallet
          </button>
          <button 
            onClick={() => setActiveTab("rewards")}
            className={`flex-1 py-2.5 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 ${activeTab === 'rewards' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md' : 'text-gray-500 hover:bg-orange-50'}`}
          >
            <Sparkles className="w-4 h-4" /> Rewards Hub
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'wallet' ? (
          <WalletDashboard 
            balance={balance} 
            transactions={transactions} 
            cards={cards} setCards={setCards}
            topUpMutation={topUpMutation}
          />
        ) : (
          <RewardsDashboard 
            coins={coins}
            missions={missions} setMissions={setMissions}
          />
        )}

      </div>
    </div>
  );
}

function WalletDashboard({ balance, transactions, cards, setCards, topUpMutation }: any) {
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  
  const [topUpAmount, setTopUpAmount] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const merchant = "LazyMonkeyAI Local Vendor";

  const [newCardNumber, setNewCardNumber] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");

  const handleTopUp = () => {
    const amount = Number(topUpAmount);
    if (amount > 0) {
      topUpMutation.mutate(amount);
      setTopUpAmount("");
    }
  };

  const handleScanPay = () => {
    toast.success(`Paid Rs ${payAmount} to ${merchant}`);
    setIsScanOpen(false);
    setPayAmount("");
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    setCards([...cards, { id: Date.now().toString(), type: "VISA", number: newCardNumber.slice(-4), expiry: newCardExpiry }]);
    setIsAddCardOpen(false);
    setNewCardNumber("");
    setNewCardExpiry("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Balances and Actions */}
      <div className="lg:col-span-7 space-y-8">
        
        {/* Modern Glassmorphic Balance Card */}
        <div className="relative bg-[#0A0F24] rounded-3xl p-6 md:p-8 text-white shadow-2xl overflow-hidden group">
          {/* Animated Background Gradients */}
          <div className="absolute -inset-10 bg-gradient-to-r from-blue-600/30 via-indigo-600/30 to-purple-600/30 blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-1000"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-blue-200 mb-3">
                <ShieldCheck className="w-5 h-5" /> Secured by LazyMonkeyAI Vault
              </div>
              <div className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-2">Available Balance</div>
              <h2 className="text-5xl md:text-6xl font-black tracking-tight flex items-baseline gap-2">
                <span className="text-2xl text-gray-400">Rs</span>
                {balance.toFixed(2)}
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3 w-full md:w-auto">
              <button 
                onClick={() => {
                  const element = document.getElementById('topup-section');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex-1 md:flex-none bg-white text-blue-900 hover:bg-gray-100 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <TrendingUp className="w-5 h-5" /> Add Money
              </button>
              <button 
                onClick={() => setIsScanOpen(true)}
                className="flex-1 md:flex-none bg-purple-900/20 hover:bg-purple-900/30 border border-blue-500/30 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all backdrop-blur-md"
              >
                <QrCode className="w-5 h-5" /> Scan & Pay
              </button>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-[#1A1A1A] flex items-center gap-2">
              <History className="w-6 h-6 text-purple-900" /> Recent Transactions
            </h3>
            <button className="text-purple-900 font-bold text-sm hover:underline">View All</button>
          </div>
          
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            {transactions.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="font-bold text-gray-900">No transactions yet</p>
                <p className="text-sm mt-1">Top up your wallet to get started!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {transactions.map((tx: any) => (
                  <div key={tx.id} className="p-5 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tx.is_positive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'} transition-transform group-hover:scale-105`}>
                        {tx.is_positive ? <TrendingUp className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-[#1A1A1A] text-lg">{tx.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{tx.category} • {new Date(tx.created_at || Date.now()).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className={`font-black text-lg ${tx.is_positive ? 'text-green-600' : 'text-[#1A1A1A]'}`}>
                      {tx.is_positive ? '+' : '-'}Rs {Math.abs(tx.amount).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Cards */}
      <div className="lg:col-span-5 space-y-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-[#1A1A1A] text-lg">Saved Cards</h3>
            <button onClick={() => setIsAddCardOpen(true)} className="text-purple-900 text-sm font-bold hover:underline">+ Add New</button>
          </div>
          
          <div className="space-y-4">
            {cards.map((card: any) => (
              <div key={card.id} className="relative overflow-hidden bg-gradient-to-tr from-gray-900 to-gray-800 rounded-2xl p-5 text-white shadow-md">
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="font-black italic tracking-wider text-xl">{card.type}</div>
                  <button className="text-gray-400 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between items-end relative z-10">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Card Number</div>
                    <div className="font-mono tracking-widest font-bold">**** **** **** {card.number}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Expires</div>
                    <div className="font-bold text-sm">{card.expiry}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div id="topup-section" className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-[#1A1A1A] text-lg">Top Up Wallet</h3>
          </div>
          
          <div className="mb-6">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Amount (Rs)</label>
            <input 
              type="number" 
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              placeholder="0.00"
              className="w-full text-3xl font-black border-b-2 border-gray-200 focus:border-purple-900 pb-2 outline-none text-[#1A1A1A] transition-colors"
            />
          </div>
          
          <div className="flex gap-2 mb-6">
            {[500, 1000, 2000].map(amt => (
              <button 
                key={amt}
                onClick={() => setTopUpAmount(amt.toString())}
                className="flex-1 py-1.5 border-2 border-gray-100 hover:border-purple-900 hover:bg-blue-50 rounded-xl font-bold text-gray-600 transition-all text-sm"
              >
                +{amt}
              </button>
            ))}
          </div>

          {cards.length > 0 && (
             <div className="mb-6">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Pay With Saved Card</label>
                 <select className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 focus:border-purple-900 outline-none font-medium text-sm text-gray-700">
                    {cards.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.type} ending in {c.number}</option>
                    ))}
                 </select>
             </div>
          )}

          <button 
            onClick={handleTopUp}
            disabled={topUpMutation.isPending || !topUpAmount}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {topUpMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><TrendingUp className="w-5 h-5" /> Confirm Top Up</>}
          </button>
        </div>
      </div>

      {/* Modals */}

      {isScanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-[#1A1A1A]">Pay Merchant</h3>
              <button onClick={() => setIsScanOpen(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-2xl mb-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 text-purple-900 rounded-xl flex items-center justify-center">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{merchant}</p>
                <p className="text-xs text-gray-500">Verified Merchant ID: V-8921</p>
              </div>
            </div>

            <div className="mb-8">
              <input 
                type="number" 
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Amount (Rs)"
                className="w-full text-center text-4xl font-black border-b-2 border-gray-200 focus:border-purple-900 pb-2 outline-none"
                autoFocus
              />
            </div>

            <button 
              onClick={handleScanPay}
              className="w-full py-4 bg-black text-white rounded-2xl font-black shadow-lg hover:bg-gray-800 transition-colors"
            >
              Pay Now
            </button>
          </div>
        </div>
      )}

      {isAddCardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-[#1A1A1A]">Add Card</h3>
              <button onClick={() => setIsAddCardOpen(false)} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddCard}>
              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Card Number</label>
                  <input required value={newCardNumber} onChange={e => setNewCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 focus:border-purple-900 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Expiry</label>
                    <input required value={newCardExpiry} onChange={e => setNewCardExpiry(e.target.value)} placeholder="MM/YY" className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 focus:border-purple-900 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">CVV</label>
                    <input required type="password" placeholder="***" className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 focus:border-purple-900 outline-none" />
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-purple-900 text-white rounded-2xl font-black shadow-lg hover:bg-amber-600 transition-colors">
                Save Card
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RewardsDashboard({ coins, missions, setMissions }: any) {
  const completeMission = (id: string, reward: number) => {
    // In a real app this would trigger an API. For now, it just mocks the UI state since this wasn't part of the core task.
    setMissions(missions.map((m: any) => m.id === id ? { ...m, progress: 100 } : m));
    toast.success(`Mission Complete! Earned ${reward} Coins`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Coins Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-3xl p-8 text-white shadow-2xl group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
        <div className="relative z-10">
          <span className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-white/20 shadow-sm">Gold Tier</span>
          <h2 className="text-7xl font-black mt-6 mb-2 tracking-tighter drop-shadow-md">{coins.toLocaleString()}</h2>
          <p className="text-white/90 font-medium text-sm mb-8 flex items-center gap-1">
             Total LazyMonkeyAI Coins
          </p>
          
          <div className="space-y-3">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
              <span>Next Tier: Platinum</span>
              <span>{(coins/25000 * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden backdrop-blur-sm border border-white/10">
              <div className="bg-white h-full rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" style={{ width: `${Math.min((coins / 25000) * 100, 100)}%` }}></div>
            </div>
            <p className="text-xs text-white/70">Earn {25000 - coins} more coins to unlock free premium shipping.</p>
          </div>
        </div>
      </div>

      {/* Missions */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-black text-[#1A1A1A]">Daily Missions</h3>
          <span className="text-sm font-bold text-orange-500 bg-orange-50 px-3 py-1 rounded-full">New Rewards!</span>
        </div>
        
        <div className="space-y-4">
          {missions.map((mission: any) => (
            <div key={mission.id} className="border-2 border-gray-50 rounded-2xl p-4 flex items-center justify-between hover:border-orange-100 transition-colors group">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${mission.progress === 100 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                  {mission.progress === 100 ? <CheckCircle2 className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className="font-bold text-[#1A1A1A]">{mission.title}</h4>
                  <p className="text-sm font-bold text-orange-500 mt-0.5">+{mission.reward} Coins</p>
                </div>
              </div>
              
              {mission.progress === 100 ? (
                <span className="text-green-600 font-bold text-sm bg-green-50 px-4 py-2 rounded-xl">Claimed</span>
              ) : (
                <button 
                  onClick={() => completeMission(mission.id, mission.reward)}
                  className="text-white bg-black hover:bg-gray-800 font-bold text-sm px-6 py-2.5 rounded-xl shadow-md transition-all hover:-translate-y-0.5"
                >
                  Start
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
