import React, { useState, useEffect } from "react";
import {
  Search, ScanBarcode, Store, Clock, User as UserIcon,
  Trash2, X, ChevronRight, Plus, Minus, CreditCard, Banknote, QrCode, Tag, ShoppingCart,
  Info, Camera, Sparkles, Printer, Database, Boxes, LayoutGrid, List as ListIcon, Combine, ArrowRightLeft, ArrowLeft,
  Truck, RefreshCw, Heart, History, Wallet
} from "lucide-react";
import { posApi, POSProduct, POSCategory } from "../../lib/api-client";
import { posStore, posSession, posCustomers, paymentMethods, posCategories } from "../../lib/pos-fallback";
import { motion, AnimatePresence } from "framer-motion";
import { useSearch, useNavigate } from "@tanstack/react-router";
import {
  BarcodeScannerView, QuickSearchView, HoldBillsView, SplitBillsView,
  DeliveryView, ExchangeView, RefundView, PriceCheckView,
  FavoritesView, RecentBillsView, AISuggestionsView, WalletView
} from "./POSTerminalViews";
const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val);

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
  const search = useSearch({ strict: false }) as any;
  const navigate = useNavigate();
  const currentView = search.view || 'billing';

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState(posCustomers[0]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // Backend data
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Modal States
  const [discountModalItem, setDiscountModalItem] = useState<any | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [discountInput, setDiscountInput] = useState<string>("");

  // Shift/Session States
  const [currentSession, setCurrentSession] = useState<any | null>(null);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [startingCash, setStartingCash] = useState<string>("0");

  // View States
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Split Payment States
  const [splitPaymentModalOpen, setSplitPaymentModalOpen] = useState(false);
  const [splitCash, setSplitCash] = useState("");
  const [splitOnline, setSplitOnline] = useState("");

  // Cash Payment States
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashTendered, setCashTendered] = useState("");

  // Held Bills Modal States
  const [heldBillsModalOpen, setHeldBillsModalOpen] = useState(false);
  const [heldBillsList, setHeldBillsList] = useState<any[]>([]);
  const [isLoadingHeldBills, setIsLoadingHeldBills] = useState(false);
  const [heldBillsCount, setHeldBillsCount] = useState(0);

  // Load real data from backend on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingProducts(true);
      try {
        const [cats, prods, heldHistory] = await Promise.all([
          posApi.getCategories(),
          posApi.getProducts(),
          posApi.getHistory({ status_filter: 'on_hold', limit: 100 }).catch(() => [])
        ]);

        if (Array.isArray(heldHistory)) {
          setHeldBillsCount(heldHistory.length);
        }

        // Also check session
        try {
          const sess = await posApi.getCurrentSession();
          setCurrentSession(sess);
        } catch (sessErr: any) {
          if (sessErr?.status === 404) {
            setSessionModalOpen(true);
          }
        }

        if (Array.isArray(cats)) {
          // Map backend categories to frontend format (add icon/color defaults)
          const mappedCats = cats.map((c: POSCategory, i: number) => ({
            id: c.id,
            name: c.name,
            color: c.color || posCategories[i % posCategories.length]?.color || "bg-slate-100 text-slate-700",
            icon: posCategories[i % posCategories.length]?.icon || null,
            aiScore: Math.floor(Math.random() * 30) + 70,
          }));
          setCategories(mappedCats);
        }
        if (Array.isArray(prods)) {
          // Map backend products to frontend cart format
          const mappedProds = prods.map((p: POSProduct) => ({
            id: p.id,
            name: p.name,
            brand: p.brand || "",
            category: p.category_id || "all",
            shortDesc: p.description || `${p.name}`,
            longDesc: p.description || "",
            barcode: p.barcode || "",
            sku: p.sku || "",
            sellingPrice: p.selling_price,
            mrp: p.mrp,
            purchasePrice: p.purchase_price,
            tax: p.selling_price * (p.tax_percent / 100),
            discount: p.discount,
            stock: p.stock,
            reorderLevel: p.reorder_level,
            image: p.image_url || null,
            aiScore: Math.floor(Math.random() * 30) + 70,
            isFastMoving: p.stock > 50,
          }));
          setProducts(mappedProds);
        }
      } catch (err) {
        console.warn("Backend not available:", err);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    loadData();
  }, []);


  useEffect(() => {
    // Attempt to enter fullscreen (requires user gesture, which the previous Link click provides)
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn("Fullscreen request was blocked (needs user gesture).", err);
        });
      }
    } catch (e) {}
    
    return () => {
      // Exit fullscreen when unmounting the terminal
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const matchSearch = (p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (p.barcode?.includes(searchQuery) || false) ||
      (p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    return matchCat && matchSearch;
  });

  // Cart actions
  const addToCart = (product: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  const removeItem = (id: string) => setCart(prev => prev.filter(item => item.id !== id));

  const applyDiscount = () => {
    if (!discountModalItem) return;
    setCart(prev => prev.map(item => {
      if (item.id === discountModalItem.id) {
        return { ...item, discount: Number(discountInput) };
      }
      return item;
    }));
    setDiscountModalItem(null);
    setDiscountInput("");
  };

  const clearCart = () => setCart([]);

  const handleOpenSession = async () => {
    try {
      const sess = await posApi.openSession({ starting_cash: Number(startingCash) });
      setCurrentSession(sess);
      setSessionModalOpen(false);
    } catch (err: any) {
      alert("Failed to open register: " + (err.detail || err.message || "Unknown error"));
    }
  };

  // Cart Math
  const subtotal = cart.reduce((sum, item) => sum + (item.sellingPrice * item.qty), 0);
  const totalDiscount = cart.reduce((sum, item) => sum + (item.discount * item.qty), 0);
  const taxableAmount = subtotal - totalDiscount;
  const tax = taxableAmount * 0.05; // 5% flat mock tax
  const total = taxableAmount + tax;

  const handleCheckout = async () => {
    if (paymentMethod === 'Split') {
      setSplitPaymentModalOpen(true);
      return;
    }
    if (paymentMethod === 'Cash') {
      setCashTendered(total.toString());
      setCashModalOpen(true);
      return;
    }
    await executeCheckout([{ payment_method: paymentMethod.toLowerCase(), amount: total }]);
  };

  const executeCheckout = async (paymentsArray: any[]) => {
    try {
      if (!currentSession) {
        alert("Please open a register first.");
        return;
      }
      // Create payload matching POSTransactionCreate schema
      const payload = {
        subtotal: subtotal,
        tax_amount: tax,
        discount_amount: totalDiscount,
        total_amount: total,
        session_id: currentSession.id,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.qty,
          unit_price: item.sellingPrice,
          discount: item.discount || 0,
          subtotal: (item.sellingPrice - (item.discount || 0)) * item.qty
        })),
        payments: paymentsArray
      };
      // Call Backend API
      const response = await posApi.checkout(payload);
      console.log("Checkout Success! Receipt:", response.receipt_number);

      // Clear UI state
      clearCart();
      setPaymentMethod("");
      setSplitPaymentModalOpen(false);
      setCashModalOpen(false);
      setSplitCash("");
      setSplitOnline("");
      setCashTendered("");
      alert("Checkout Successful! Receipt: " + response.receipt_number);
    } catch (err: any) {
      console.error("Checkout Failed:", err);
      alert("Checkout failed: " + (err.detail || err.message || "Unknown error"));
    }
  };

  const handleCashConfirm = () => {
    const tendered = parseFloat(cashTendered) || 0;
    if (tendered < total) {
      alert("Cash tendered cannot be less than the total amount!");
      return;
    }
    executeCheckout([{ payment_method: "cash", amount: total }]);
  };

  const handleSplitConfirm = () => {
    const cashAmt = parseFloat(splitCash) || 0;
    const onlineAmt = parseFloat(splitOnline) || 0;
    if (Math.abs(cashAmt + onlineAmt - total) > 0.01) {
      alert("Split amounts must equal the grand total: " + formatCurrency(total));
      return;
    }
    executeCheckout([
      { payment_method: "cash", amount: cashAmt },
      { payment_method: "online", amount: onlineAmt }
    ]);
  };

  const handleHoldBill = async () => {
    try {
      if (cart.length === 0) return alert("Cart is empty.");
      if (!currentSession) return alert("Please open a register first.");
      
      const payload = {
        subtotal: subtotal,
        tax_amount: tax,
        discount_amount: totalDiscount,
        total_amount: total,
        session_id: currentSession.id,
        status: "on_hold",
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.qty,
          unit_price: item.sellingPrice,
          discount: item.discount || 0,
          subtotal: (item.sellingPrice - (item.discount || 0)) * item.qty
        })),
        payments: []
      };
      
      await posApi.checkout(payload);
      clearCart();
      setHeldBillsCount(prev => prev + 1);
      alert("Bill placed on hold.");
    } catch (err: any) {
      console.error("Hold Bill Failed:", err);
      alert("Failed to hold bill: " + (err.detail || err.message));
    }
  };

  const resumeCart = async (transaction: any) => {
    try {
      if (cart.length > 0) {
        if (!confirm("Current cart is not empty. Overwrite with resumed bill?")) return;
      }
      
      const newCart = transaction.items.map((item: any) => {
        const product = products.find(p => p.id === item.product_id);
        return {
          id: item.product_id,
          name: product ? product.name : `Product ${item.product_id.substring(0, 8)}`,
          sku: product ? product.sku : "UNKNOWN",
          brand: product ? product.brand : "",
          image: product ? product.image_url : "https://placehold.co/100?text=Item",
          sellingPrice: Number(item.unit_price),
          mrp: Number(item.unit_price) + Number(item.discount || 0),
          discount: Number(item.discount || 0),
          qty: item.quantity,
          stock: product ? product.stock : 999
        };
      });
      
      setCart(newCart);
      
      // Delete the held bill from DB so it's not lingering
      // Catch errors silently to prevent double-click 404 alerts
      posApi.deleteTransaction(transaction.id).catch(err => console.warn("Delete held bill:", err));
    } catch (err: any) {
      console.error("Resume failed:", err);
      alert("Failed to resume bill: " + (err.detail || err.message));
    }
  };

  const openHeldBillsModal = async () => {
    setHeldBillsModalOpen(true);
    setIsLoadingHeldBills(true);
    try {
      const bills = await posApi.getHistory({ status_filter: 'on_hold' });
      setHeldBillsList(bills);
    } catch (e) {
      console.error("Failed to load hold bills", e);
    } finally {
      setIsLoadingHeldBills(false);
    }
  };

  const handleSplitPayment = async (payments: any[]) => {
    try {
      if (cart.length === 0) return alert("Cart is empty.");
      if (!currentSession) return alert("Please open a register first.");
      
      const payload = {
        subtotal: subtotal,
        tax_amount: tax,
        discount_amount: totalDiscount,
        total_amount: total,
        session_id: currentSession.id,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.qty,
          unit_price: item.sellingPrice,
          discount: item.discount || 0,
          subtotal: (item.sellingPrice - (item.discount || 0)) * item.qty
        })),
        payments: payments
      };
      
      const response = await posApi.checkout(payload);
      clearCart();
      alert("Split Payment Successful! Receipt: " + response.receipt_number);
      window.location.hash = "#/pos?view=billing";
    } catch (err: any) {
      console.error("Checkout Failed:", err);
      alert("Checkout failed: " + (err.detail || err.message || "Unknown error"));
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-slate-50 font-sans">
      
      {/* Terminal Header Nav */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 flex items-center overflow-x-auto gap-2 py-2">
        <button
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
            }
            navigate({ to: "/pos", search: { tab: "dashboard" } });
          }}
          className="px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors bg-rose-50 text-rose-600 hover:bg-rose-100 mr-2 border border-rose-100"
        >
          <ArrowLeft className="w-4 h-4" /> Exit
        </button>
        <div className="h-6 w-px bg-slate-200 mr-2 hidden sm:block"></div>
        {[
          { id: "billing", label: "Billing", icon: ShoppingCart },
          { id: "exchange", label: "Exchange", icon: RefreshCw },
          { id: "refund", label: "Refund", icon: CreditCard },
          { id: "wallet", label: "Wallet Summary", icon: Wallet },
          { id: "recent", label: "Recent Bills", icon: History },
          { id: "ai_suggest", label: "AI Suggestions", icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = (currentView === tab.id) || (!currentView && tab.id === 'billing');
          return (
            <button
              key={tab.id}
              onClick={() => navigate({ to: "/pos", search: { tab: "terminal", view: tab.id } })}
              className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
                isActive ? "bg-slate-900 text-white shadow-md" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2. MAIN WORKSPACE (3 Columns) OR SUB-VIEW */}
      {currentView === 'billing' || !currentView ? (
        <div className="flex flex-1 overflow-hidden relative">

          {/* COL 1: Categories (15%) */}
          <div className="w-[15%] min-w-[120px] max-w-[200px] shrink-0 bg-white border-r border-slate-200 overflow-y-auto scrollbar-none hidden md:block">
            <div className="p-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Explorer</h3>
              <button
                onClick={() => setActiveCategory("all")}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all mb-1 ${activeCategory === "all" ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Store className="w-5 h-5" />
                <span className="text-sm font-semibold">All Items</span>
              </button>

              <div className="space-y-1 mt-2">
                {categories.map(cat => {
                  const Icon = cat.icon as any;
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${isActive ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/20' : cat.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-left truncate">{cat.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COL 2: Product Grid / Details Drawer (55%) */}
          <div className="flex-1 bg-slate-50/50 p-4 overflow-y-auto relative">

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4 flex-1">
                <h3 className="text-lg font-bold text-slate-900 whitespace-nowrap">
                  {activeCategory === "all" ? "All Products" :
                    categories.find(c => c.id === activeCategory)?.name}
                  <span className="text-sm font-medium text-slate-500 ml-2">({filteredProducts.length} Results)</span>
                </h3>

                <div className="flex-1 max-w-lg relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="global-search"
                    type="text"
                    placeholder="Search products by name, barcode, SKU... (Press F2)"
                    className="block w-full pl-9 pr-12 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all sm:text-sm shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="absolute inset-y-0 right-1 flex items-center gap-1">
                    <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors">
                      <Camera className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors">
                      <ScanBarcode className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-slate-100 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col relative"
                  >
                    {/* Badges */}
                    <div className="absolute top-2 left-2 right-2 flex justify-between z-10 pointer-events-none">
                      {product.stock <= product.reorderLevel && (
                        <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">Low Stock</span>
                      )}
                      {product.aiScore > 90 && (
                        <span className="bg-amber-400 text-amber-950 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> Hot</span>
                      )}
                    </div>

                    {/* Info Button (Opens Drawer) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); }}
                      className="absolute top-2 right-2 z-20 w-6 h-6 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>

                    <div className="h-32 bg-slate-50 relative p-4 flex items-center justify-center">
                      <img src={product.image} alt={product.name} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="p-3 flex flex-col flex-1 justify-between border-t border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{product.brand}</span>
                        <h4 className="text-xs font-semibold text-slate-800 leading-tight mt-0.5 line-clamp-2">{product.name}</h4>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          {product.discount > 0 ? (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400 line-through leading-none">{formatCurrency(product.mrp)}</span>
                              <span className="font-bold text-slate-900 leading-none mt-0.5">{formatCurrency(product.sellingPrice)}</span>
                            </div>
                          ) : (
                            <span className="font-bold text-slate-900">{formatCurrency(product.sellingPrice)}</span>
                          )}
                        </div>
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-bold">Product</th>
                      <th className="px-6 py-4 font-bold">SKU</th>
                      <th className="px-6 py-4 font-bold">Price</th>
                      <th className="px-6 py-4 font-bold">Stock</th>
                      <th className="px-6 py-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => (
                      <tr
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group relative"
                      >
                        <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                          <img src={p.image} alt={p.name} className="w-10 h-10 rounded border border-slate-100 object-cover" />
                          <div className="flex flex-col">
                            <span>{p.name}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{p.brand}</span>
                          </div>

                          {/* Tooltip */}
                          <div className="absolute left-64 top-1/2 -translate-y-1/2 ml-4 w-56 bg-slate-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                            <p className="font-bold mb-1">{p.name}</p>
                            <p className="text-slate-400 mb-1">Barcode: <span className="font-mono text-slate-300">{p.barcode}</span></p>
                            <p className="text-slate-400">{p.longDesc.substring(0, 60)}...</p>
                            <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-medium text-slate-500">{p.sku}</td>
                        <td className="px-6 py-4 font-bold text-slate-900">
                          {p.discount > 0 ? (
                            <div className="flex items-center gap-2">
                              <span>{formatCurrency(p.sellingPrice)}</span>
                              <span className="text-xs text-rose-500 line-through font-normal">{formatCurrency(p.mrp)}</span>
                            </div>
                          ) : (
                            formatCurrency(p.sellingPrice)
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          <span className={p.stock <= p.reorderLevel ? "text-rose-500 font-bold" : ""}>
                            {p.stock}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-slate-400">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedProduct(p); }}
                              className="hover:text-slate-900 p-1 bg-white border border-slate-200 rounded-md shadow-sm"
                            >
                              <Info className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                              className="hover:text-white hover:bg-slate-900 p-1 bg-slate-100 border border-slate-200 rounded-md shadow-sm text-slate-700 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* PRODUCT DETAILS SLIDEOVER */}
            <AnimatePresence>
              {selectedProduct && (
                <motion.div
                  initial={{ x: "100%", opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: "100%", opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="absolute inset-y-0 right-0 w-full md:w-3/4 lg:w-2/3 bg-white shadow-2xl border-l border-slate-200 z-30 flex flex-col"
                >
                  <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2 text-slate-900">
                      <Info className="w-5 h-5" />
                      <h3 className="font-bold">Product Specifications</h3>
                    </div>
                    <button onClick={() => setSelectedProduct(null)} className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-lg border border-slate-200 shadow-sm">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                    <div className="flex gap-6 items-start">
                      <div className="w-48 h-48 bg-slate-50 rounded-xl border border-slate-200 p-4 shrink-0 flex items-center justify-center">
                        <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-contain mix-blend-multiply" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">{selectedProduct.brand}</span>
                          <span className="text-xs font-semibold text-slate-400">{selectedProduct.sku}</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 leading-tight mb-2">{selectedProduct.name}</h2>
                        <p className="text-sm text-slate-600 mb-4">{selectedProduct.longDesc}</p>

                        <div className="flex items-end gap-4">
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Selling Price</p>
                            <div className="text-3xl font-black text-emerald-600">{formatCurrency(selectedProduct.sellingPrice)}</div>
                          </div>
                          {selectedProduct.discount > 0 && (
                            <div className="pb-1">
                              <span className="text-sm text-slate-400 line-through mr-2">{formatCurrency(selectedProduct.mrp)}</span>
                              <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                -{selectedProduct.margin} Margin
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1"><Boxes className="w-3.5 h-3.5" /> Inventory & Storage</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-slate-500">Available Stock:</span> <span className="font-bold text-slate-900">{selectedProduct.stock} Units</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Warehouse:</span> <span className="font-semibold text-slate-700">{selectedProduct.warehouse}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Location:</span> <span className="font-semibold text-slate-700">{selectedProduct.rack} / {selectedProduct.shelf}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Batch:</span> <span className="font-mono text-xs bg-white px-1 border rounded">{selectedProduct.batch}</span></div>
                        </div>
                      </div>

                      <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> AI Product Insights</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-amber-700/70">Demand Forecast:</span> <span className="font-bold text-amber-700">{selectedProduct.demandScore}/100</span></div>
                          <div className="flex justify-between"><span className="text-amber-700/70">AI Recommendation:</span> <span className="font-bold text-amber-700">{selectedProduct.aiScore}/100</span></div>
                          <div className="flex justify-between"><span className="text-amber-700/70">Trend Status:</span> <span className="font-semibold text-emerald-600">{selectedProduct.isFastMoving ? 'Fast Moving 🔥' : 'Stable'}</span></div>
                          <div className="flex justify-between"><span className="text-amber-700/70">Supplier:</span> <span className="font-semibold text-amber-900">{selectedProduct.supplier}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
                    <button onClick={() => addToCart(selectedProduct)} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-slate-900/20 transition-all flex items-center justify-center gap-2">
                      <Plus className="w-5 h-5" /> Add to Checkout
                    </button>
                    <button onClick={() => setSelectedProduct(null)} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all">
                      Close
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* COL 3: Billing Workspace (30%) */}
          <div className="w-[30%] min-w-[320px] max-w-[450px] shrink-0 bg-white flex flex-col shadow-[-4px_0_24px_-8px_rgba(0,0,0,0.08)] z-20">

            {/* Customer Profile */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <button className="w-full bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-3 flex items-center justify-between transition-colors shadow-sm group mb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-slate-900 leading-tight">{selectedCustomer.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">{selectedCustomer.tier} Tier</span>
                      <span className="text-[10px] text-slate-500 font-medium">{selectedCustomer.points} Pts • ${selectedCustomer.wallet} Wallet</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <div className="flex items-center gap-2">
                <button 
                  onClick={handleHoldBill} 
                  disabled={cart.length === 0} 
                  className="flex-1 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg border border-amber-200 transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" /> Hold Bill
                </button>
                <button 
                  onClick={openHeldBillsModal}
                  className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <ListIcon className="w-3.5 h-3.5" /> Resume Bill {heldBillsCount > 0 && `(${heldBillsCount})`}
                </button>
              </div>
            </div>

            {/* High-Density Cart */}
            <div className="flex-1 overflow-y-auto p-2 bg-slate-50/30">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                    <ShoppingCart className="w-8 h-8 opacity-40" />
                  </div>
                  <p className="font-medium text-sm">Cart is empty.<br />Scan a barcode to begin.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {cart.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      onClick={() => { setDiscountModalItem(item); setDiscountInput(item.discount.toString()); }}
                      className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm flex items-start gap-3 relative group cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all"
                    >
                      <img src={item.image} alt={item.name} className="w-10 h-10 rounded border border-slate-100 object-contain p-1 shrink-0 bg-slate-50" />
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-bold text-slate-900 leading-tight truncate pr-6">{item.name}</h5>
                        <div className="text-[10px] font-medium text-slate-500 mt-0.5">{item.sku}</div>

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1 bg-slate-100 rounded border border-slate-200 p-0.5">
                            <button onClick={(e) => { e.stopPropagation(); updateQty(item.id, -1); }} className="w-5 h-5 flex items-center justify-center rounded bg-white text-slate-700 shadow-sm hover:bg-slate-50"><Minus className="w-3 h-3" /></button>
                            <span className="w-6 text-center text-xs font-bold text-slate-900">{item.qty}</span>
                            <button onClick={(e) => { e.stopPropagation(); updateQty(item.id, 1); }} className="w-5 h-5 flex items-center justify-center rounded bg-white text-slate-700 shadow-sm hover:bg-slate-50"><Plus className="w-3 h-3" /></button>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-sm text-slate-900 block leading-none">{formatCurrency(item.sellingPrice * item.qty)}</span>
                            {item.discount > 0 && <span className="text-[9px] text-rose-500 font-bold block leading-none mt-1">Saved {formatCurrency(item.discount * item.qty)}</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                        className="absolute top-1.5 right-1.5 text-slate-300 hover:text-rose-500 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkout Summary */}
            <div className="bg-white border-t border-slate-200 shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.05)] flex flex-col shrink-0">

              {/* Totals Box */}
              <div className="p-4 space-y-1.5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} items)</span>
                  <span className="font-bold text-slate-700">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-rose-500 font-medium flex items-center gap-1"><Tag className="w-3 h-3" /> Total Discount</span>
                  <span className="font-bold text-rose-600">-{formatCurrency(totalDiscount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Tax (5% GST)</span>
                  <span className="font-bold text-slate-700">{formatCurrency(tax)}</span>
                </div>
              </div>

              {/* Massive Grand Total */}
              <div className="px-4 py-3 flex justify-between items-end bg-white">
                <span className="text-sm font-black text-slate-400 uppercase tracking-wider mb-1">Grand Total</span>
                <span className="text-4xl font-black text-slate-900 tracking-tight">{formatCurrency(total)}</span>
              </div>

              {/* Payment Methods Grid */}
              <div className="px-3 pb-3">
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <button
                    onClick={() => setPaymentMethod('Cash')}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all shadow-sm ${paymentMethod === 'Cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-700 bg-white'}`}
                  >
                    <Banknote className={`w-5 h-5 ${paymentMethod === 'Cash' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="text-[9px] font-bold uppercase tracking-wide">Cash</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('Card')}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all shadow-sm ${paymentMethod === 'Card' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-700 bg-white'}`}
                  >
                    <CreditCard className={`w-5 h-5 ${paymentMethod === 'Card' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="text-[9px] font-bold uppercase tracking-wide">Card</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('UPI')}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all shadow-sm ${paymentMethod === 'UPI' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-700 bg-white'}`}
                  >
                    <QrCode className={`w-5 h-5 ${paymentMethod === 'UPI' ? 'text-purple-600' : 'text-slate-400'}`} />
                    <span className="text-[9px] font-bold uppercase tracking-wide">UPI</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('Split')}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all shadow-sm ${paymentMethod === 'Split' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-700 bg-white'}`}
                  >
                    <Combine className={`w-5 h-5 ${paymentMethod === 'Split' ? 'text-orange-600' : 'text-slate-400'}`} />
                    <span className="text-[9px] font-bold uppercase tracking-wide">Split</span>
                  </button>
                </div>

                {/* Complete Payment Button */}
                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || !paymentMethod}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black py-4 rounded-xl shadow-lg shadow-slate-900/20 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                >
                  Complete Payment <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {currentView === 'barcode' && <BarcodeScannerView addToCart={addToCart} products={products} />}
          {currentView === 'search' && <QuickSearchView />}
          {currentView === 'delivery' && <DeliveryView />}
          {currentView === 'exchange' && <ExchangeView />}
          {currentView === 'refund' && <RefundView currentSessionId={currentSession?.id} initialSearch={search?.refundId || undefined} />}
          {currentView === 'wallet' && <WalletView />}
          {currentView === 'price_check' && <PriceCheckView />}
          {currentView === 'favorites' && <FavoritesView products={products} addToCart={addToCart} />}
          {currentView === 'recent' && (
            <RecentBillsView 
              onRefund={(id) => navigate({ to: "/pos", search: { tab: "terminal", view: "refund", refundId: id } })} 
            />
          )}
          {currentView === 'ai_suggest' && <AISuggestionsView />}
        </>
      )}

      {/* 3. BOTTOM BAR: AI, Shift, Devices */}
      <div className="h-10 bg-slate-900 flex items-center justify-between px-4 shrink-0 text-slate-300 text-[11px] font-medium tracking-wide z-40 relative">

        {/* AI Recommendations */}
        <div className="flex items-center gap-2 text-amber-300">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Insight: Recommend <b>Warranty Plan</b> based on current cart value.</span>
        </div>

        {/* Shift Info */}
        <div className="flex items-center gap-4 border-l border-slate-700 pl-4">
          <span className="flex items-center gap-1.5 text-white"><UserIcon className="w-3.5 h-3.5" /> {posSession.cashier}</span>
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {posSession.shift}</span>
        </div>

        {/* Device Status */}
        <div className="flex items-center gap-4 border-l border-slate-700 pl-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <ScanBarcode className="w-3.5 h-3.5 text-slate-400" />
            Scanner
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            Printer
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
            <Database className="w-3.5 h-3.5 text-slate-400" />
            Drawer (Offline)
          </div>
        </div>
      </div>

      {/* LINE ITEM DISCOUNT MODAL */}
      <AnimatePresence>
        {discountModalItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDiscountModalItem(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-900">Line Discount</h3>
                <button onClick={() => setDiscountModalItem(null)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-4 items-center mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <img src={discountModalItem.image} alt={discountModalItem.name} className="w-12 h-12 object-contain mix-blend-multiply bg-white rounded border border-slate-200" />
                <div>
                  <p className="font-bold text-slate-900 line-clamp-1">{discountModalItem.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{formatCurrency(discountModalItem.sellingPrice)} each</p>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Discount Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    className="w-full text-2xl font-black text-slate-900 border-2 border-slate-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>
              <button onClick={applyDiscount} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/20">
                Apply Discount
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CASH TENDERED MODAL */}
      <AnimatePresence>
        {cashModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCashModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-900">Cash Payment</h3>
                <button onClick={() => setCashModalOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex justify-between items-center">
                <span className="text-sm font-bold text-emerald-800">Total Due</span>
                <span className="text-2xl font-black text-emerald-700">{formatCurrency(total)}</span>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cash Tendered (₹)</label>
                <div className="relative mb-3">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-full text-2xl font-black text-slate-900 border-2 border-slate-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>

                <div className="flex gap-2 mb-2">
                  {[total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, 2000].filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 4).map(amt => (
                    <button 
                      key={amt} 
                      onClick={() => setCashTendered(amt.toString())}
                      className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-lg transition-colors border border-slate-200"
                    >
                      {amt === total ? 'Exact' : `₹${amt}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6 p-4 bg-slate-900 rounded-xl flex justify-between items-center shadow-inner">
                <span className="text-sm font-bold text-slate-400">Change Due</span>
                <span className={`text-3xl font-black ${Number(cashTendered) >= total ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {Number(cashTendered) >= total ? formatCurrency(Number(cashTendered) - total) : '---'}
                </span>
              </div>

              <button 
                onClick={handleCashConfirm} 
                disabled={Number(cashTendered) < total}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-emerald-600/20 text-lg flex items-center justify-center gap-2"
              >
                <Banknote className="w-5 h-5" /> Complete Transaction
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SPLIT PAYMENT MODAL */}
      <AnimatePresence>
        {splitPaymentModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSplitPaymentModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-slate-900">Split Payment</h3>
                <button onClick={() => setSplitPaymentModalOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="mb-4">
                <div className="text-center bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Grand Total</p>
                  <p className="text-3xl font-black text-slate-900">{formatCurrency(total)}</p>
                </div>
                
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cash Amount</label>
                <div className="relative mb-4">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={splitCash}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSplitCash(val);
                      const parsedVal = parseFloat(val) || 0;
                      if (parsedVal <= total && parsedVal >= 0) {
                        setSplitOnline((total - parsedVal).toFixed(2));
                      }
                    }}
                    className="w-full text-lg font-black text-slate-900 border-2 border-slate-200 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="0.00"
                  />
                </div>
                
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Online / UPI Amount</label>
                <div className="relative mb-6">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={splitOnline}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSplitOnline(val);
                      const parsedVal = parseFloat(val) || 0;
                      if (parsedVal <= total && parsedVal >= 0) {
                        setSplitCash((total - parsedVal).toFixed(2));
                      }
                    }}
                    className="w-full text-lg font-black text-slate-900 border-2 border-slate-200 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <button onClick={handleSplitConfirm} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-slate-900/20">
                Confirm Payment
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* OPEN REGISTER (SESSION) MODAL */}
      <AnimatePresence>
        {sessionModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-6 text-center">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Store className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Open Register</h2>
              <p className="text-sm text-slate-500 mb-6 font-medium">Please enter your starting cash float to open the shift.</p>

              <div className="mb-6 text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Starting Cash ($)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    value={startingCash}
                    onChange={(e) => setStartingCash(e.target.value)}
                    className="w-full text-2xl font-black text-slate-900 border-2 border-slate-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              <button
                onClick={handleOpenSession}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all uppercase tracking-widest"
              >
                Start Shift
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Held Bills Modal */}
      <AnimatePresence>
        {heldBillsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHeldBillsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3 text-slate-900">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <ListIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-xl leading-none">Resume Bill</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Restore Parked Transactions</p>
                  </div>
                </div>
                <button onClick={() => setHeldBillsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                {isLoadingHeldBills ? (
                  <div className="text-center p-8 text-slate-500 font-medium animate-pulse">Loading held bills...</div>
                ) : heldBillsList.length === 0 ? (
                  <div className="text-center p-8 text-slate-500 font-medium">No parked bills currently on hold.</div>
                ) : (
                  <div className="space-y-3">
                    {heldBillsList.map(bill => (
                      <div key={bill.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between hover:border-indigo-300 transition-colors">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{bill.receipt_number}</span>
                            <span className="text-xs font-semibold text-slate-400">{new Date(bill.created_at).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-800">Customer: {bill.customer_id ? bill.customer_id.substring(0,8) : 'Walk-in'}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{bill.items.length} items • <span className="font-bold text-slate-700">{formatCurrency(bill.total_amount)}</span></p>
                        </div>
                        <button
                          onClick={() => {
                            setHeldBillsModalOpen(false);
                            setHeldBillsCount(prev => Math.max(0, prev - 1));
                            resumeCart(bill);
                          }}
                          className="bg-indigo-600 text-white font-bold px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm"
                        >
                          Resume
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Trivial change to force Vite HMR rebuild
