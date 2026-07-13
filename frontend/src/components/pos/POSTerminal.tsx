import React, { useState } from "react";
import { 
  Search, ScanBarcode, Store, Clock, User as UserIcon, 
  Trash2, X, ChevronRight, Plus, Minus, CreditCard, Banknote, QrCode, Tag, ShoppingCart
} from "lucide-react";
import { posProducts, posCategories, posSession, posStore, posCustomers, paymentMethods } from "../../data/pos-mock";

const formatCurrency = (val: number) => 
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div className="p-10 text-red-500 font-mono whitespace-pre-wrap">{this.state.error?.stack || this.state.error?.toString()}</div>;
    return this.props.children;
  }
}

export function PosTerminal() {
  return <ErrorBoundary><PosTerminalInner /></ErrorBoundary>;
}

function PosTerminalInner() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState(posCustomers[0]);

  // Filter products
  const filteredProducts = posProducts.filter(p => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const matchSearch = (p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) || 
                        (p.barcode?.includes(searchQuery) || false);
    return matchCat && matchSearch;
  });

  // Cart actions
  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Cart Math
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const tax = subtotal * 0.05; // 5% flat mock tax
  const total = subtotal + tax;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50">
      {/* Top Toolbar */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-indigo-600 text-white flex items-center justify-center font-bold">
              POS
            </div>
            <div>
              <h2 className="font-bold text-slate-900 leading-none">{posStore.name}</h2>
              <span className="text-xs text-slate-500">{posStore.branch}</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <span className="flex items-center gap-1.5"><UserIcon className="w-4 h-4" /> {posSession.cashier}</span>
            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100">
              <Clock className="w-3.5 h-3.5" /> {posSession.shift} Shift
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full max-w-md">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <ScanBarcode className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Scan Barcode or Search Products... (F2)"
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Panel - Categories */}
        <div className="w-24 shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-y-auto hidden md:flex">
          <button 
            onClick={() => setActiveCategory("all")}
            className={`flex flex-col items-center justify-center gap-2 p-4 border-b border-slate-100 transition-colors ${activeCategory === "all" ? 'bg-indigo-50 text-indigo-700 border-r-2 border-r-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Store className="w-6 h-6" />
            <span className="text-xs font-medium text-center">All Items</span>
          </button>
          
          {posCategories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex flex-col items-center justify-center gap-2 p-4 border-b border-slate-100 transition-colors ${activeCategory === cat.id ? 'bg-indigo-50 text-indigo-700 border-r-2 border-r-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${cat.color.split(' ')[0]} ${cat.color.split(' ')[1]}`}>
                {cat.name.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-medium text-center leading-tight">{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Center - Product Grid */}
        <div className="flex-1 bg-slate-50 p-4 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map(product => (
              <div 
                key={product.id} 
                onClick={() => addToCart(product)}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group active:scale-95 flex flex-col"
              >
                <div className="h-32 bg-slate-100 relative overflow-hidden flex items-center justify-center p-4">
                  <img src={product.image} alt={product.name} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300" />
                  {product.stock <= 15 && (
                    <span className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      {product.stock} Left
                    </span>
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1 justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{posCategories.find(c => c.id === product.category)?.name}</span>
                    <h4 className="text-sm font-bold text-slate-900 leading-tight mt-0.5 line-clamp-2">{product.name}</h4>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-bold text-indigo-700">{formatCurrency(product.price)}</span>
                    <button className="h-7 w-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right - Cart Panel */}
        <div className="w-full md:w-96 shrink-0 bg-white border-l border-slate-200 flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
          
          {/* Customer Selection */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <button className="w-full bg-white border border-slate-300 hover:border-indigo-400 rounded-lg p-2.5 flex items-center justify-between transition-colors shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-900 leading-none">{selectedCustomer.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedCustomer.points > 0 ? `${selectedCustomer.points} Points • ${selectedCustomer.tier}` : 'No Loyalty Points'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-4">
                <ShoppingCart className="w-16 h-16 opacity-20" />
                <p className="font-medium">Cart is empty.<br/>Scan a barcode or select products.</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm flex items-start gap-3 relative group">
                  <img src={item.image} alt={item.name} className="w-12 h-12 rounded border border-slate-100 object-contain p-1" />
                  <div className="flex-1">
                    <h5 className="text-sm font-bold text-slate-900 leading-tight pr-6">{item.name}</h5>
                    <div className="text-xs text-slate-500 mt-1">{formatCurrency(item.price)} each</div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5">
                        <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-white text-slate-700 shadow-sm hover:bg-slate-50"><Minus className="w-3 h-3" /></button>
                        <span className="w-8 text-center text-sm font-bold text-slate-900">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-white text-slate-700 shadow-sm hover:bg-slate-50"><Plus className="w-3 h-3" /></button>
                      </div>
                      <span className="font-bold text-slate-900">{formatCurrency(item.price * item.qty)}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary & Actions */}
          <div className="bg-white border-t border-slate-200 p-4 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.05)]">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 flex items-center gap-1"><Tag className="w-3 h-3"/> Discount</span>
                <span className="font-semibold text-emerald-600">-$0.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Tax (5%)</span>
                <span className="font-semibold text-slate-900">{formatCurrency(tax)}</span>
              </div>
              <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-end">
                <span className="text-base font-bold text-slate-900">Total</span>
                <span className="text-2xl font-black text-indigo-700">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-3">
              <button className="flex flex-col items-center justify-center gap-1 p-2 rounded border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors">
                <Banknote className="w-5 h-5 text-emerald-600" />
                <span className="text-[10px] font-bold">Cash</span>
              </button>
              <button className="flex flex-col items-center justify-center gap-1 p-2 rounded border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <span className="text-[10px] font-bold">Card</span>
              </button>
              <button className="flex flex-col items-center justify-center gap-1 p-2 rounded border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors">
                <QrCode className="w-5 h-5 text-purple-600" />
                <span className="text-[10px] font-bold">UPI</span>
              </button>
              <button className="flex flex-col items-center justify-center gap-1 p-2 rounded border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors">
                <Plus className="w-5 h-5 text-slate-400" />
                <span className="text-[10px] font-bold">More</span>
              </button>
            </div>

            <div className="flex gap-2">
              <button className="w-12 h-12 flex items-center justify-center bg-rose-50 text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors shrink-0" onClick={() => setCart([])}>
                <Trash2 className="w-5 h-5" />
              </button>
              <button 
                className={`flex-1 h-12 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${cart.length > 0 ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/20' : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'}`}
                disabled={cart.length === 0}
              >
                Charge {formatCurrency(total)}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
