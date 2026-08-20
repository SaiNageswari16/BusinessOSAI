import React, { useState, useEffect, useMemo } from "react";
import {
  Search, ScanBarcode, Store, Clock, User as UserIcon,
  Trash2, X, ChevronRight, Plus, Minus, CreditCard, Banknote, QrCode, Tag, ShoppingCart,
  Info, Camera, Sparkles, Printer, Database, Boxes, LayoutGrid, List as ListIcon, Combine, ArrowRightLeft, ArrowLeft,
  Truck, RefreshCw, Heart, History, Wallet, Layers, Phone, Building, Mail, UserPlus, Percent, CheckCircle2
} from "lucide-react";
import { posApi, inventoryApi, crmApi, invoicesApi, crmWalletApi, procurementApi, POSProduct, POSCategory, resolveImageUrl } from "../../lib/api-client";
import { useHardwareBarcodeScanner } from "../../hooks/useHardwareBarcodeScanner";
import { posStore, posSession, posCustomers, paymentMethods, posCategories } from "../../lib/pos-fallback";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useSearch, useNavigate } from "@tanstack/react-router";
import {
  BarcodeScannerView, QuickSearchView, HoldBillsView, SplitBillsView,
  DeliveryView, ExchangeView, RefundView, PriceCheckView,
  FavoritesView, RecentBillsView, AISuggestionsView, WalletView
} from "./POSTerminalViews";
import { ThermalReceiptPrinter } from "./ThermalReceiptPrinter";
import { triggerThermalPrint } from "../../lib/print-helper";
import { useCurrency } from "@/hooks/use-currency";
import { formatCurrency } from "../../lib/utils";
import { INDIAN_STATES } from "@/data/indian-states";
import { usePincodeLookup } from "@/hooks/use-pincode-lookup";
import { FreeQtyPanel, FreeQtyItem } from "./FreeQtyPanel";

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
  const { currency, formatCurrency } = useCurrency();
  const [, setCurrencyTick] = useState(0);
  useEffect(() => {
    const cb = () => setCurrencyTick(t => t + 1);
    window.addEventListener("bos-currency-changed", cb);
    return () => window.removeEventListener("bos-currency-changed", cb);
  }, []);

  const search = useSearch({ strict: false }) as any;
  const navigate = useNavigate();
  const currentView = search.view || 'billing';

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeSubCategory, setActiveSubCategory] = useState<string>("all");
  const [activeBrand, setActiveBrand] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [posPage, setPosPage] = useState<number>(1);
  const [posPageSize, setPosPageSize] = useState<number>(24);
  const [cart, setCart] = useState<any[]>([]);

  useEffect(() => { setPosPage(1); }, [activeCategory, activeSubCategory, activeBrand, searchQuery]);


  const [selectedCustomer, setSelectedCustomer] = useState(posCustomers[0]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerList, setCustomerList] = useState<any[]>(posCustomers);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerTab, setCustomerTab] = useState<'search' | 'new'>('search');
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustCompany, setNewCustCompany] = useState("");
  const [newCustType, setNewCustType] = useState("Retail");
  const [newCustGST, setNewCustGST] = useState("");
  
  // Structured Address States
  const [newCustStreet, setNewCustStreet] = useState("");
  const [newCustCity, setNewCustCity] = useState("");
  const [newCustState, setNewCustState] = useState("Andhra Pradesh");
  const [newCustPincode, setNewCustPincode] = useState("");

  const [newCustShipStreet, setNewCustShipStreet] = useState("");
  const [newCustShipCity, setNewCustShipCity] = useState("");
  const [newCustShipState, setNewCustShipState] = useState("Andhra Pradesh");
  const [newCustShipPincode, setNewCustShipPincode] = useState("");
  const [isCustShippingSameAsBilling, setIsCustShippingSameAsBilling] = useState(true);

  // Free Quantity / Promotional Schemes State
  const [freeItems, setFreeItems] = useState<FreeQtyItem[]>([]);

  // Pincode Lookup Hook
  const { lookup: lookupPincode, loading: isLookingUpPincode } = usePincodeLookup();

  const handleCustPincodeChange = async (val: string) => {
    setNewCustPincode(val);
    if (isCustShippingSameAsBilling) setNewCustShipPincode(val);
    const clean = val.replace(/\D/g, "").slice(0, 6);
    if (clean.length === 6) {
      const res = await lookupPincode(clean);
      if (res) {
        if (res.city) setNewCustCity(res.city);
        if (res.state) {
          const matched = INDIAN_STATES.find(s => s.name.toLowerCase() === res.state.toLowerCase() || res.state.toLowerCase().includes(s.name.toLowerCase()));
          setNewCustState(matched?.name || res.state);
        }
        if (!newCustStreet && res.area) setNewCustStreet(res.area);
        if (isCustShippingSameAsBilling) {
          if (res.city) setNewCustShipCity(res.city);
          if (res.state) {
            const matched = INDIAN_STATES.find(s => s.name.toLowerCase() === res.state.toLowerCase() || res.state.toLowerCase().includes(s.name.toLowerCase()));
            setNewCustShipState(matched?.name || res.state);
          }
          if (!newCustShipStreet && res.area) setNewCustShipStreet(res.area);
        }
      }
    }
  };

  const handleCustShipPincodeChange = async (val: string) => {
    setNewCustShipPincode(val);
    const clean = val.replace(/\D/g, "").slice(0, 6);
    if (clean.length === 6) {
      const res = await lookupPincode(clean);
      if (res) {
        if (res.city) setNewCustShipCity(res.city);
        if (res.state) {
          const matched = INDIAN_STATES.find(s => s.name.toLowerCase() === res.state.toLowerCase() || res.state.toLowerCase().includes(s.name.toLowerCase()));
          setNewCustShipState(matched?.name || res.state);
        }
        if (!newCustShipStreet && res.area) setNewCustShipStreet(res.area);
      }
    }
  };

  const [newCustTier, setNewCustTier] = useState("Silver");

  const [customerSummary, setCustomerSummary] = useState<any | null>(null);
  const [includePreviousDueInBill, setIncludePreviousDueInBill] = useState<boolean>(false);
  const [verifyingCustGST, setVerifyingCustGST] = useState(false);

  const handleVerifyPOSCustomerGST = async () => {
    const cleanGst = (newCustGST || "").trim().toUpperCase();
    if (!cleanGst || cleanGst.length !== 15) {
      toast.error("Please enter a valid 15-character GSTIN");
      return;
    }
    try {
      setVerifyingCustGST(true);
      const res = await procurementApi.lookupGstin(cleanGst);
      if (res && res.valid) {
        if (res.trade_name || res.legal_name) {
          setNewCustName(res.trade_name || res.legal_name);
          setNewCustCompany(res.legal_name || res.trade_name);
        }
        if (res.state) {
          setNewCustState(res.state);
          if (isCustShippingSameAsBilling) setNewCustShipState(res.state);
        }
        if (res.pincode) {
          setNewCustPincode(res.pincode);
          if (isCustShippingSameAsBilling) setNewCustShipPincode(res.pincode);
        }
        const rawAddr: any = (res as any).address;
        const addrObj = typeof rawAddr === 'object' && rawAddr !== null ? rawAddr : null;
        if (addrObj?.city) {
          setNewCustCity(addrObj.city);
          if (isCustShippingSameAsBilling) setNewCustShipCity(addrObj.city);
        }
        if (addrObj?.street) {
          setNewCustStreet(addrObj.street);
          if (isCustShippingSameAsBilling) setNewCustShipStreet(addrObj.street);
        }
        if (res.phone && !newCustPhone) setNewCustPhone(res.phone);
        if (res.email && !newCustEmail) setNewCustEmail(res.email);
        setNewCustType("B2B");
        setNewCustTier("Wholesale B2B");
        toast.success(`GSTIN Verified: ${res.legal_name || res.trade_name} (${res.state || 'Active'})`);
      } else {
        toast.error("GSTIN verification returned invalid or inactive status");
      }
    } catch (e: any) {
      toast.error(e?.detail || e?.message || "GSTIN lookup failed");
    } finally {
      setVerifyingCustGST(false);
    }
  };

  useEffect(() => {
    crmApi.getCustomers(1, 100)
      .then((res: any) => {
        const items = res?.items || res;
        if (Array.isArray(items) && items.length > 0) {
          const formatted = items.map((c: any) => ({
            id: c.id,
            name: c.name || "Customer",
            phone: c.phone || "",
            email: c.email || "",
            company: c.company_name || "",
            customer_type: c.customer_type || "Retail",
            gstin: c.gst_number || "",
            address: c.address || "",
            points: c.loyalty_points || 150,
            tier: c.tier || "Silver",
            wallet: c.wallet_balance || 0,
            totalSpent: c.total_spent ? `₹${c.total_spent}` : "₹0.00",
            lastVisit: "Recent"
          }));
          setCustomerList([posCustomers[0], ...formatted]);
        }
      })
      .catch(() => {});
  }, []);

  // Backend data
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [customerWalletBalance, setCustomerWalletBalance] = useState<number>(0);
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
  const [creditChangeToWallet, setCreditChangeToWallet] = useState(false);
  const [completedCheckoutBill, setCompletedCheckoutBill] = useState<any | null>(null);

  // Partial Payment States
  const [partialModalOpen, setPartialModalOpen] = useState(false);
  const [partialPaidAmount, setPartialPaidAmount] = useState("");
  const [partialPaymentMode, setPartialPaymentMode] = useState<string>("Cash");

  // Held Bills Modal States
  const [heldBillsModalOpen, setHeldBillsModalOpen] = useState(false);
  const [heldBillsList, setHeldBillsList] = useState<any[]>([]);
  const [isLoadingHeldBills, setIsLoadingHeldBills] = useState(false);
  const [heldBillsCount, setHeldBillsCount] = useState(0);

  useEffect(() => {
    if (!selectedCustomer || selectedCustomer.id === 'walk-in' || selectedCustomer.id === 'WALK-IN' || !selectedCustomer.id) {
      setCustomerSummary(null);
      setCustomerWalletBalance(0);
      setIncludePreviousDueInBill(false);
      return;
    }

    invoicesApi
      .getCustomerSummary(selectedCustomer.id)
      .then((data: any) => {
        if (data) {
          const rawUnpaid = (data.unpaid_invoices || []).filter((inv: any) => {
            const rawStatus = String(inv.status || "").toLowerCase();
            const due = Number(inv.balance_due) || 0;
            return !["paid", "voided", "cancelled", "completed"].includes(rawStatus) && due > 0.05;
          });
          const totalPending = rawUnpaid.reduce((sum: number, inv: any) => sum + Number(inv.balance_due || 0), 0);
          setCustomerSummary({
            ...data,
            total_pending_due: totalPending,
            unpaid_invoices: rawUnpaid
          });
        }
      })
      .catch(() => {
        setCustomerSummary(null);
      });

    crmWalletApi
      .getBalance(selectedCustomer.id)
      .then((res: any) => {
        const bal = Number(res?.balance || 0);
        setCustomerWalletBalance(bal);
        setSelectedCustomer((prev: any) => (prev ? { ...prev, wallet: bal } : prev));
      })
      .catch(() => {
        const fallbackBal = Number((selectedCustomer as any)?.wallet || (selectedCustomer as any)?.wallet_balance || 0);
        setCustomerWalletBalance(fallbackBal);
      });
  }, [selectedCustomer?.id]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return toast.error("Customer name is required");

    const fullBilling = [newCustStreet, newCustCity, newCustState, newCustPincode].filter(Boolean).join(", ");
    const fullShipping = isCustShippingSameAsBilling
      ? fullBilling
      : [newCustShipStreet, newCustShipCity, newCustShipState, newCustShipPincode].filter(Boolean).join(", ");

    try {
      const created = await crmApi.createCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        email: newCustEmail.trim() || undefined,
        company_name: newCustCompany.trim() || undefined,
        customer_type: newCustType,
        gst_number: newCustGST.trim() || undefined,
        billing_address: fullBilling ? { street: newCustStreet, city: newCustCity, state: newCustState, postal_code: newCustPincode, country: "India" } : undefined,
        shipping_address: fullShipping ? { street: isCustShippingSameAsBilling ? newCustStreet : newCustShipStreet, city: isCustShippingSameAsBilling ? newCustCity : newCustShipCity, state: isCustShippingSameAsBilling ? newCustState : newCustShipState, postal_code: isCustShippingSameAsBilling ? newCustPincode : newCustShipPincode, country: "India" } : undefined,
      });

      const customerObj = created.data || created;
      const formatted = {
        id: customerObj.id,
        name: customerObj.name,
        phone: customerObj.phone || "",
        email: customerObj.email || "",
        company: customerObj.company_name || "",
        customer_type: customerObj.customer_type || newCustType,
        gstin: customerObj.gst_number || "",
        address: fullBilling || "",
        points: customerObj.loyalty_points || 150,
        tier: customerObj.tier || newCustTier,
        wallet: customerObj.wallet_balance || 0,
        totalSpent: "₹0.00",
        lastVisit: "Just Now"
      };

      setCustomerList(prev => [posCustomers[0], formatted, ...prev.filter(c => c.id !== 'walk-in')]);
      setSelectedCustomer(formatted);
      setIsCustomerModalOpen(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");
      setNewCustCompany("");
      setNewCustGST("");
      setNewCustStreet("");
      setNewCustCity("");
      setNewCustState("Andhra Pradesh");
      setNewCustPincode("");
      setNewCustShipStreet("");
      setNewCustShipCity("");
      setNewCustShipState("Andhra Pradesh");
      setNewCustShipPincode("");
      setIsCustShippingSameAsBilling(true);
      setNewCustType("Retail");
      toast.success(`Customer "${formatted.name}" created and selected!`);
    } catch {
      const fullBilling = [newCustStreet, newCustCity, newCustState, newCustPincode].filter(Boolean).join(", ");
      const newCust = {
        id: `CUST${Date.now().toString().slice(-4)}`,
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        email: newCustEmail.trim(),
        company: newCustCompany.trim(),
        customer_type: newCustType,
        gstin: newCustGST.trim(),
        address: fullBilling,
        points: 100,
        tier: newCustTier,
        wallet: 0,
        totalSpent: "₹0.00",
        lastVisit: "Just Now"
      };
      setCustomerList(prev => [posCustomers[0], newCust, ...prev.filter(c => c.id !== 'walk-in')]);
      setSelectedCustomer(newCust);
      setIsCustomerModalOpen(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");
      setNewCustCompany("");
      setNewCustGST("");
      setNewCustStreet("");
      setNewCustCity("");
      setNewCustState("Andhra Pradesh");
      setNewCustPincode("");
      setNewCustType("Retail");
      toast.success(`Customer "${newCust.name}" created and selected!`);
    };
  };
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editForm, setEditForm] = useState<any>({
    name: "", brand: "", sku: "", barcode: "",
    sellingPrice: 0, mrp: 0, purchasePrice: 0, stock: 0, longDesc: ""
  });

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    setIsEditingProduct(false);
    setEditForm({
      name: product.name || "",
      brand: product.brand || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      sellingPrice: product.sellingPrice || 0,
      mrp: product.mrp || 0,
      purchasePrice: product.purchasePrice || 0,
      stock: product.stock || 0,
      longDesc: product.longDesc || product.shortDesc || "",
    });
  };



  // Load real data from backend on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingProducts(true);
      try {
        const [cats, prods, bList, heldHistory] = await Promise.all([
          posApi.getCategories(),
          posApi.getProducts(),
          inventoryApi.getBatches().catch(() => []),
          posApi.getHistory({ status_filter: 'on_hold', limit: 100 }).catch(() => [])
        ]);

        if (Array.isArray(bList)) {
          setBatches(bList);
        }

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

        const rawCats = Array.isArray(cats) ? cats : ((cats as any)?.items || []);
        if (rawCats.length > 0) {
          const mappedCats = rawCats.map((c: any, i: number) => ({
            id: c.id,
            name: c.name,
            parent_id: c.parent_id || null,
            color: c.color || posCategories[i % posCategories.length]?.color || "bg-slate-100 text-slate-700",
            icon: posCategories[i % posCategories.length]?.icon || null,
            aiScore: Math.floor(Math.random() * 30) + 70,
          }));
          setCategories(mappedCats);
        }

        let fetchedProds: any[] = Array.isArray(prods) ? prods : ((prods as any)?.items || []);
        if (fetchedProds.length === 0) {
          try {
            const invProdsRes: any = await inventoryApi.getProducts({ page_size: 300 });
            fetchedProds = Array.isArray(invProdsRes) ? invProdsRes : (invProdsRes?.items || []);
          } catch (e) {
            console.warn("Could not fetch inventory products fallback:", e);
          }
        }

        if (Array.isArray(fetchedProds)) {
          const mappedProds = fetchedProds.map((p: any) => {
            const specs = typeof p.specifications === "string" ? JSON.parse(p.specifications || "{}") : (p.specifications || {});
            const basePrice = Number(p.selling_price || p.price || p.mrp || 0);
            const rawWholesale = Number(p.wholesale_price && Number(p.wholesale_price) > 0 ? p.wholesale_price : (specs.wholesale_price && Number(specs.wholesale_price) > 0 ? specs.wholesale_price : 0));
            const rawB2B = Number(p.b2b_price && Number(p.b2b_price) > 0 ? p.b2b_price : (specs.b2b_price && Number(specs.b2b_price) > 0 ? specs.b2b_price : 0));
            const wPrice = rawWholesale > 0 ? rawWholesale : (basePrice > 0 ? Math.round(basePrice * 0.90 * 100) / 100 : 0);
            const bPrice = rawB2B > 0 ? rawB2B : (rawWholesale > 0 ? Math.round(rawWholesale * 0.95 * 100) / 100 : (basePrice > 0 ? Math.round(basePrice * 0.85 * 100) / 100 : 0));
            const taxPct = Number(p.tax_percent != null ? p.tax_percent : (p.tax_rate != null ? p.tax_rate : 18));
            return {
              id: p.id,
              name: p.name,
              brand: p.brand?.name || p.brand || "",
              category: p.category_id || p.category?.id || "all",
              category_name: p.category?.name || p.category_name || "",
              shortDesc: p.description || p.short_description || `${p.name}`,
              longDesc: p.description || "",
              barcode: p.barcode || "",
              sku: p.sku || "",
              hsn_code: p.hsn_code || "1905",
              sellingPrice: basePrice,
              wholesalePrice: wPrice,
              b2bPrice: bPrice,
              minWholesaleQty: Number(p.min_wholesale_qty || 1),
              mrp: Number(p.mrp || basePrice || 0),
              purchasePrice: Number(p.purchase_price || p.cost_price || 0),
              tax_percent: taxPct,
              tax: taxPct,
              is_tax_inclusive: p.is_tax_inclusive !== false,
              discount: Number(p.discount || p.discount_limit || 0),
              stock: Number(p.stock || p.initial_stock || 0),
              reorderLevel: Number(p.reorder_level || 10),
              image: p.image_url ? resolveImageUrl(p.image_url) : null,
              aiScore: Math.floor(Math.random() * 30) + 70,
              isFastMoving: (p.stock || p.initial_stock || 0) > 50,
            };
          });
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
    } catch (e) { }

    return () => {
      // Exit fullscreen when unmounting the terminal
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
    };
  }, []);

  // Professional Cashier Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering when user is typing inside an open modal or input field
      const isInputFocused = ["INPUT", "TEXTAREA", "SELECT"].includes((document.activeElement?.tagName || ""));

      if (e.key === "F2") {
        e.preventDefault();
        const searchInput = document.getElementById("pos-barcode-input") || document.getElementById("global-search");
        if (searchInput) (searchInput as HTMLInputElement).focus();
      } else if (e.key === "F4" && !isInputFocused) {
        e.preventDefault();
        if (cart.length > 0) {
          handleHoldBill();
        } else {
          openHeldBillsModal();
        }
      } else if (e.key === "F8" && !isInputFocused && cart.length > 0) {
        e.preventDefault();
        setDiscountModalItem(cart[0]);
        setDiscountInput(cart[0]?.discount?.toString() || "0");
      } else if (e.key === "F9" && !isInputFocused && cart.length > 0) {
        e.preventDefault();
        setCashModalOpen(true);
      } else if (e.key === "F10" && !isInputFocused && cart.length > 0) {
        e.preventDefault();
        setCheckoutModalOpen(true);
      } else if (e.key === "Escape") {
        setDiscountModalItem(null);
        setCheckoutModalOpen(false);
        setPartialModalOpen(false);
        setCashModalOpen(false);
        setHeldBillsModalOpen(false);
        setIsCustomerModalOpen(false);
        setSessionModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart]);

  // Hardware Barcode Scanner Listener in POS Terminal
  useHardwareBarcodeScanner({
    onScan: async (scannedCode) => {
      const code = scannedCode.trim();
      if (!code) return;

      const matched = products.find(
        p => p.barcode === code || p.sku === code || p.barcode?.toLowerCase() === code.toLowerCase()
      );

      if (matched) {
        addToCart(matched);
        toast.success(`Scanned: ${matched.name} (+1 to Cart)`);
        return;
      }

      try {
        const fastRes = await inventoryApi.lookupProductByBarcode(code);
        if (fastRes?.success && fastRes?.product?.name) {
          const p = fastRes.product;
          const posProd = {
            id: p.id || `scanned-${code}`,
            name: p.name,
            barcode: p.barcode || code,
            sku: p.sku || code,
            category: p.category || "General",
            sellingPrice: p.selling_price || p.mrp || 100,
            mrp: p.mrp || p.selling_price || 100,
            image_url: p.image || "/static/uploads/products/default_product.jpg",
          };
          addToCart(posProd);
          toast.success(`Scanned & Added: ${p.name}`);
          return;
        }
      } catch (e) { }
      // Automatically create a provisional/unknown item to allow immediate billing:
      const provItem = {
        id: `scanned-${code}`,
        name: `Scanned Item (${code})`,
        barcode: code,
        sku: `SKU-${code}`,
        category: "all",
        sellingPrice: 100, // Default price, editable
        mrp: 100,
        purchasePrice: 60,
        tax: 5,
        discount: 0,
        stock: 99,
        isProvisional: true, // Mark it as provisional
        brand: "General",
        shortDesc: "Provisional scanned product",
        longDesc: "This item was added dynamically via barcode scanner. Edit details to save to inventory.",
        image: "/static/uploads/products/default_product.jpg",
        aiScore: 50,
      };
      addToCart(provItem);
      toast.info(`Unknown barcode: added provisional item to cart. Click details to edit name/price.`);
    },
    enabled: true
  });

  // Category Getters (Strict Top-Level Main Categories on left sidebar)
  const parentCategories = useMemo(() => {
    // Only top-level main categories (where parent_id is null/undefined/empty)
    const mainCats = categories.filter(c => !c.parent_id);

    // Filter to main categories that actually contain products (directly or via sub-categories)
    const categoriesWithProducts = mainCats.filter(cat => {
      const subCatIds = new Set(categories.filter(c => c.parent_id === cat.id).map(c => c.id));
      const count = products.filter(p =>
        p.category === cat.id ||
        p.category_id === cat.id ||
        (p.category && p.category.toLowerCase() === cat.name.toLowerCase()) ||
        subCatIds.has(p.category) ||
        subCatIds.has(p.category_id)
      ).length;
      return count > 0;
    });

    return categoriesWithProducts.length > 0 ? categoriesWithProducts : mainCats;
  }, [categories, products]);

  const currentSubCategories = useMemo(() => {
    if (activeCategory === "all") return [];
    return categories.filter(c => c.parent_id === activeCategory);
  }, [categories, activeCategory]);

  // Brands available under current Category / Sub-Category
  const availableBrands = useMemo(() => {
    const brandSet = new Set<string>();
    products.forEach(p => {
      if (!p.brand) return;

      if (activeSubCategory !== "all") {
        const subCat = categories.find(c => c.id === activeSubCategory);
        const matchId = p.category === activeSubCategory || p.category_id === activeSubCategory;
        const matchName = subCat && p.category?.toLowerCase() === subCat.name.toLowerCase();
        if (matchId || matchName) brandSet.add(p.brand);
      } else if (activeCategory !== "all") {
        const parentCat = categories.find(c => c.id === activeCategory);
        const matchParentId = p.category === activeCategory || p.category_id === activeCategory;
        const matchParentName = parentCat && p.category?.toLowerCase() === parentCat.name.toLowerCase();
        const subCatIds = new Set(categories.filter(c => c.parent_id === activeCategory).map(c => c.id));
        const subCatNames = new Set(categories.filter(c => c.parent_id === activeCategory).map(c => c.name.toLowerCase()));
        const matchSub = subCatIds.has(p.category) || subCatIds.has(p.category_id) || subCatNames.has(p.category?.toLowerCase());
        if (matchParentId || matchParentName || matchSub) brandSet.add(p.brand);
      } else {
        brandSet.add(p.brand);
      }
    });
    return Array.from(brandSet).sort();
  }, [products, activeCategory, activeSubCategory, categories]);

  // Filter products by parent category, sub-category, brand, and search query
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name?.toLowerCase().includes(q);
        const matchBarcode = p.barcode?.toLowerCase().includes(q);
        const matchSku = p.sku?.toLowerCase().includes(q);
        if (!matchName && !matchBarcode && !matchSku) return false;
      }

      // 2. Brand Filter (if selected)
      if (activeBrand !== "all") {
        if (p.brand?.toLowerCase() !== activeBrand.toLowerCase()) return false;
      }

      // 3. Sub-category Filter (if selected)
      if (activeSubCategory !== "all") {
        const subCat = categories.find(c => c.id === activeSubCategory);
        const matchId = p.category === activeSubCategory || p.category_id === activeSubCategory;
        const matchName = subCat && p.category?.toLowerCase() === subCat.name.toLowerCase();
        return matchId || matchName;
      }

      // 4. Parent category Filter (if selected)
      if (activeCategory !== "all") {
        const parentCat = categories.find(c => c.id === activeCategory);
        const matchParentId = p.category === activeCategory || p.category_id === activeCategory;
        const matchParentName = parentCat && p.category?.toLowerCase() === parentCat.name.toLowerCase();

        const subCatIds = new Set(categories.filter(c => c.parent_id === activeCategory).map(c => c.id));
        const subCatNames = new Set(categories.filter(c => c.parent_id === activeCategory).map(c => c.name.toLowerCase()));
        const matchSub = subCatIds.has(p.category) || subCatIds.has(p.category_id) || subCatNames.has(p.category?.toLowerCase());

        return matchParentId || matchParentName || matchSub;
      }

      return true;
    });
  }, [products, searchQuery, activeCategory, activeSubCategory, activeBrand, categories]);


  const totalPosPages = Math.ceil(filteredProducts.length / posPageSize) || 1;
  const paginatedProducts = filteredProducts.slice((posPage - 1) * posPageSize, posPage * posPageSize);


  // Cart actions
  const addToCart = (product: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Match active inventory batch via FEFO (First Expired First Out)
    const matchingBatches = batches.filter(
      (b) =>
        (b.product_id === product.id ||
          (b.product_name && product.name && b.product_name.toLowerCase() === product.name.toLowerCase())) &&
        Number(b.remaining_quantity || b.quantity || 0) > 0
    ).sort(
      (a, b) =>
        new Date(a.expiry_date || "2099-12-31").getTime() -
        new Date(b.expiry_date || "2099-12-31").getTime()
    );

    const activeBatch = matchingBatches[0];
    const effectiveHsn =
      product.hsn_code ||
      (product.category?.toLowerCase().includes("dairy")
        ? "0405"
        : product.category?.toLowerCase().includes("biscuit")
        ? "1905"
        : product.category?.toLowerCase().includes("shampoo")
        ? "3305"
        : "1905");
    const effectiveTax = Number(product.tax_percent ?? product.tax ?? 18);
    const enrichedProduct = {
      ...product,
      batch_number: activeBatch?.batch_number || product.batch_number || "",
      batch_id: activeBatch?.id || null,
      expiry_date: activeBatch?.expiry_date ? String(activeBatch.expiry_date).slice(0, 10) : product.expiry_date || null,
      mrp: Number(activeBatch?.mrp) > 0 ? Number(activeBatch.mrp) : (product.mrp || product.sellingPrice * 1.2),
      sellingPrice: Number(activeBatch?.selling_price) > 0 ? Number(activeBatch.selling_price) : product.sellingPrice,
      hsn_code: effectiveHsn,
      tax_percent: effectiveTax,
      is_tax_inclusive: product.is_tax_inclusive !== false,
    };

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...enrichedProduct, qty: 1 }];
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

  const [pricingMode, setPricingMode] = useState<"Retail" | "Wholesale" | "B2B">("Retail");

  const getItemEffectivePrice = (item: any, qty: number = item.qty || 1, overrideMode?: "Retail" | "Wholesale" | "B2B") => {
    const mode = overrideMode || pricingMode;
    const basePrice = Number(item.sellingPrice || item.selling_price || item.price || item.mrp || 0);
    const rawWholesale = Number(item.wholesalePrice || item.wholesale_price || 0);
    const rawB2B = Number(item.b2bPrice || item.b2b_price || 0);
    const wholesalePrice = rawWholesale > 0 ? rawWholesale : (basePrice > 0 ? Math.round(basePrice * 0.90 * 100) / 100 : basePrice);
    const b2bPrice = rawB2B > 0 ? rawB2B : (rawWholesale > 0 ? Math.round(rawWholesale * 0.95 * 100) / 100 : (basePrice > 0 ? Math.round(basePrice * 0.85 * 100) / 100 : basePrice));
    
    let unitPrice = basePrice;
    let isTierApplied = false;
    let tierName = "Retail";

    if (mode === "B2B") {
      unitPrice = b2bPrice;
      isTierApplied = true;
      tierName = "B2B";
    } else if (mode === "Wholesale") {
      unitPrice = wholesalePrice;
      isTierApplied = true;
      tierName = "Wholesale";
    } else {
      const isWholesaleCustomer = selectedCustomer?.tier?.toLowerCase().includes("wholesale") || selectedCustomer?.tier?.toLowerCase().includes("b2b");
      const isQtyQualified = qty >= (item.minWholesaleQty || 5) && Number(item.minWholesaleQty || 0) > 1;
      if (isWholesaleCustomer || isQtyQualified) {
        unitPrice = wholesalePrice;
        isTierApplied = true;
        tierName = "Wholesale";
      }
    }
    return { unitPrice, isWholesale: isTierApplied, tierName, basePrice, wholesalePrice, b2bPrice };
  };

  const handlePricingModeChange = (mode: "Retail" | "Wholesale" | "B2B") => {
    setPricingMode(mode);
    setCart((prevCart) =>
      prevCart.map((item) => {
        const { unitPrice } = getItemEffectivePrice(item, item.qty, mode);
        return {
          ...item,
          price: unitPrice,
          subtotal: unitPrice * item.qty
        };
      })
    );
  };

  // Dynamic Cart Discount State
  const [discountMode, setDiscountMode] = useState<"before_tax" | "after_tax">("before_tax");
  const [cartDiscountType, setCartDiscountType] = useState<"percent" | "amount">("percent");
  const [cartDiscountValue, setCartDiscountValue] = useState<number>(0);

  // Dynamic Custom Additional Charges State (Freight, Packing, Transport, etc.)
  const [posCustomCharges, setPosCustomCharges] = useState<{ id: string; name: string; amount: number; tax_rate: number }[]>([]);
  const [posGstType, setPosGstType] = useState<"cgst_sgst" | "igst">("cgst_sgst");

  const handleAddPosChargeRow = () => {
    setPosCustomCharges(prev => [
      ...prev,
      { id: `chg_${Date.now()}_${Math.floor(Math.random() * 1000)}`, name: "Freight / Delivery Fee", amount: 0, tax_rate: 0 }
    ]);
  };

  const handleUpdatePosCharge = (id: string, field: "name" | "amount" | "tax_rate", value: any) => {
    setPosCustomCharges(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: field === "amount" ? Math.max(0, Number(value)) : field === "tax_rate" ? Number(value) : value } : c))
    );
  };

  const handleDeletePosCharge = (id: string) => {
    setPosCustomCharges(prev => prev.filter(c => c.id !== id));
  };

  const posAdditionalChargesTotal = useMemo(() => {
    return posCustomCharges.reduce((sum, c) => {
      const amt = Number(c.amount) || 0;
      const gstAmt = amt * ((Number(c.tax_rate) || 0) / 100);
      return sum + amt + gstAmt;
    }, 0);
  }, [posCustomCharges]);

  const posChargesGstTotal = useMemo(() => {
    return posCustomCharges.reduce((sum, c) => {
      const amt = Number(c.amount) || 0;
      return sum + amt * ((Number(c.tax_rate) || 0) / 100);
    }, 0);
  }, [posCustomCharges]);

  // Cart Math with Dynamic Before-Tax & After-Tax Discount
  const subtotal = cart.reduce((sum, item) => {
    const { unitPrice } = getItemEffectivePrice(item);
    return sum + (unitPrice * item.qty);
  }, 0);
  const itemDiscounts = cart.reduce((sum, item) => sum + ((item.discount || 0) * item.qty), 0);
  const netSubtotal = Math.max(0, subtotal - itemDiscounts);

  // 1. Before-Tax Discount
  let beforeTaxDiscount = 0;
  if (discountMode === "before_tax" && cartDiscountValue > 0) {
    beforeTaxDiscount = cartDiscountType === "percent"
      ? netSubtotal * (cartDiscountValue / 100)
      : Math.min(cartDiscountValue, netSubtotal);
  }

  const taxableAmount = Math.max(0, netSubtotal - beforeTaxDiscount);

  // 2. Tax Calculation on Taxable Value
  const taxRatio = netSubtotal > 0 ? (taxableAmount / netSubtotal) : 1;
  const tax = cart.reduce((sum, item) => {
    const { unitPrice } = getItemEffectivePrice(item);
    const itemTaxPercent = Number(item.tax_percent ?? item.tax ?? 18);
    const itemNet = Math.max(0, (unitPrice - (item.discount || 0)) * item.qty);
    const effectiveItemTaxable = itemNet * taxRatio;
    return sum + (effectiveItemTaxable * (itemTaxPercent / 100));
  }, 0);

  const grossTotal = taxableAmount + tax;

  // 3. After-Tax Discount
  let afterTaxDiscount = 0;
  if (discountMode === "after_tax" && cartDiscountValue > 0) {
    afterTaxDiscount = cartDiscountType === "percent"
      ? grossTotal * (cartDiscountValue / 100)
      : Math.min(cartDiscountValue, grossTotal);
  }

  const totalDiscount = itemDiscounts + beforeTaxDiscount + afterTaxDiscount;
  const previousDueToAdd = (includePreviousDueInBill && customerSummary?.total_pending_due > 0)
    ? Number(customerSummary.total_pending_due)
    : 0;
  const total = Math.max(0, grossTotal - afterTaxDiscount) + previousDueToAdd + posAdditionalChargesTotal;

  const handleCheckout = async () => {
    if (paymentMethod === 'Split') {
      setSplitPaymentModalOpen(true);
      return;
    }
    if (paymentMethod === 'Partial' || paymentMethod === 'Partial Pay') {
      setPartialPaidAmount(total > 0 ? (total * 0.5).toFixed(2) : '');
      setPartialPaymentMode('Cash');
      setPartialModalOpen(true);
      return;
    }
    if (paymentMethod === 'Cash') {
      setCashTendered(total.toString());
      setCashModalOpen(true);
      return;
    }
    if (paymentMethod === 'Credit' || paymentMethod === 'Pay Later') {
      if (!selectedCustomer || selectedCustomer.id === 'walk-in' || selectedCustomer.id === 'WALK-IN') {
        toast.error("Please select or add a registered customer for Pay Later (Store Credit) sales!");
        setIsCustomerModalOpen(true);
        return;
      }
      await executeCheckout([{ payment_method: 'credit', amount: total }]);
      return;
    }
    if (paymentMethod === 'Wallet') {
      if (!selectedCustomer || selectedCustomer.id === "WALK-IN") {
        alert("Please select a registered customer to use Wallet.");
        return;
      }
      if ((selectedCustomer.wallet || 0) < total) {
        alert(`Insufficient Wallet Balance (${formatCurrency(selectedCustomer.wallet || 0)} available).`);
        return;
      }
      executeCheckout([{ payment_method: "wallet", amount: total }]);
    } else {
      await executeCheckout([{ payment_method: paymentMethod.toLowerCase(), amount: total }]);
    }
  };

  const resolveCartProvisionalItems = async (currentCart: any[]) => {
    const provisionalItems = currentCart.filter(item => item.isProvisional || item.id.toString().startsWith("scanned-"));
    if (provisionalItems.length === 0) return currentCart;

    toast.loading("Registering new scanned products to inventory...");
    try {
      const createdProds = await Promise.all(
        provisionalItems.map(async (item) => {
          const res = await posApi.createProduct({
            name: item.name,
            brand_name: item.brand || "General",
            sku: item.sku || `SKU-${item.barcode}`,
            barcode: item.barcode,
            selling_price: item.sellingPrice,
            mrp: item.mrp || item.sellingPrice,
            purchase_price: item.purchasePrice || (item.sellingPrice * 0.6),
            initial_stock: item.qty || 1,
            description: item.longDesc || "Scanned unknown item",
            is_active: true
          });
          return {
            tempId: item.id,
            realId: res.id
          };
        })
      );

      const updatedCart = currentCart.map(item => {
        const match = createdProds.find(cp => cp.tempId === item.id);
        if (match) {
          return { ...item, id: match.realId, isProvisional: false };
        }
        return item;
      });

      toast.dismiss();
      toast.success("New products registered successfully.");

      // Fetch updated products list
      posApi.getProducts().then(prods => {
        if (Array.isArray(prods)) {
          const mappedProds = prods.map((p: any) => ({
            id: p.id,
            name: p.name,
            brand: p.brand || "",
            category: p.category_id || "all",
            shortDesc: p.description || `${p.name}`,
            longDesc: p.description || "",
            barcode: p.barcode || "",
            sku: p.sku || "",
            sellingPrice: p.selling_price || p.mrp || 0,
            mrp: p.mrp,
            purchasePrice: p.purchase_price,
            tax: (p.selling_price || p.mrp || 0) * (p.tax_percent / 100),
            discount: p.discount,
            stock: p.stock,
            reorderLevel: p.reorder_level,
            image: p.image_url ? resolveImageUrl(p.image_url) : null,
            aiScore: 75,
            isFastMoving: p.stock > 50,
          }));
          setProducts(mappedProds);
        }
      }).catch(err => console.warn(err));

      return updatedCart;
    } catch (e: any) {
      toast.dismiss();
      toast.error("Failed to register provisional items: " + (e.detail || e.message));
      throw e;
    }
  };

  const executeCheckout = async (paymentsArray: any[]) => {
    try {
      if (!currentSession) {
        alert("Please open a register first.");
        return;
      }
      
      const resolvedCart = await resolveCartProvisionalItems(cart);

      const payload = {
        subtotal: subtotal,
        tax_amount: tax,
        discount_amount: totalDiscount,
        total_amount: total,
        session_id: currentSession.id,
        customer_id: selectedCustomer && selectedCustomer.id !== 'walk-in' ? selectedCustomer.id : null,
        status: "completed",
        items: resolvedCart.map(item => {
          const { unitPrice } = getItemEffectivePrice(item);
          return {
            product_id: item.id,
            quantity: item.qty,
            unit_price: unitPrice,
            discount: item.discount || 0,
            subtotal: (unitPrice - (item.discount || 0)) * item.qty
          };
        }),
        payments: paymentsArray
      };

      // Call Backend API
      const response = await posApi.checkout(payload);
      console.log("Checkout Success! Receipt:", response.receipt_number);

      const billData = {
        invoice_number: response.receipt_number || `REC-${Date.now().toString().slice(-6)}`,
        date: new Date(),
        customerName: selectedCustomer?.name || 'Walk-in Guest',
        customerPhone: selectedCustomer?.phone || '',
        items: resolvedCart.map(item => ({
          product_id: item.id,
          name: item.name,
          product_name: item.name,
          sku: item.sku,
          hsn_code: item.hsn_code,
          quantity: item.qty,
          unit_price: item.sellingPrice,
          subtotal: (item.sellingPrice - (item.discount || 0)) * item.qty
        })),
        subtotal: subtotal,
        discount_amount: totalDiscount,
        tax_amount: tax,
        grand_total: total,
        payment_method: paymentsArray[0]?.payment_method || 'Cash',
        payment_status: 'PAID'
      };

      setCompletedCheckoutBill(billData);

      // Sync Customer Wallet balance if paid via Wallet
      const isWalletPayment = paymentsArray.some(p => p.payment_method?.toLowerCase() === 'wallet');
      if (isWalletPayment && selectedCustomer && selectedCustomer.id !== 'walk-in' && selectedCustomer.id !== 'WALK-IN') {
        const walletPaidAmt = paymentsArray.find(p => p.payment_method?.toLowerCase() === 'wallet')?.amount || total;
        const newBal = Math.max(0, customerWalletBalance - walletPaidAmt);
        setCustomerWalletBalance(newBal);
        setSelectedCustomer((prev: any) => prev ? { ...prev, wallet: newBal } : prev);
        crmWalletApi.getBalance(selectedCustomer.id).then((res: any) => {
          if (res && res.balance !== undefined) {
            setCustomerWalletBalance(Number(res.balance));
            setSelectedCustomer((prev: any) => prev ? { ...prev, wallet: Number(res.balance) } : prev);
          }
        }).catch(() => {});
      }

      // Broadcast global updates for stock & ledger refresh
      window.dispatchEvent(new Event("pos_invoices_updated"));
      window.dispatchEvent(new Event("inventory_updated"));

      // Clear UI state
      clearCart();
      setPaymentMethod("");
      setSplitPaymentModalOpen(false);
      setCashModalOpen(false);
      setSplitCash("");
      setSplitOnline("");
      setCashTendered("");

      toast.success(`Checkout Successful! Receipt: ${response.receipt_number}`);

      // Wait for React to render the portal before triggering print
      setTimeout(() => {
        // Force a reflow to ensure portal is in the DOM
        const portal = document.getElementById('printable-receipt-portal');
        if (!portal) {
          console.warn('[Print] Portal not found in DOM');
          return;
        }
        triggerThermalPrint();
      }, 500);
    } catch (err: any) {
      console.error("Checkout Failed:", err);
      alert("Checkout failed: " + (err.detail || err.message || "Unknown error"));
    }
  };

  const handleCashConfirm = async () => {
    const tendered = parseFloat(cashTendered) || 0;
    if (tendered < total) {
      alert("Cash tendered cannot be less than the total amount!");
      return;
    }
    const changeDue = tendered - total;
    
    try {
      await executeCheckout([{ payment_method: "cash", amount: total }]);
      
      // Credit to wallet if checked and applicable
      if (creditChangeToWallet && changeDue > 0 && selectedCustomer && selectedCustomer.id !== "WALK-IN") {
        await crmWalletApi.credit(
          selectedCustomer.id,
          changeDue,
          "POS Cash Change Added to Wallet",
          `POS-${new Date().getTime()}` // Fake reference if receipt isn't returned synchronously before this
        );
        toast.success(`Change of ${formatCurrency(changeDue)} securely credited to Customer Wallet.`);
      }
    } catch (err: any) {
      // Errors already handled in executeCheckout
    }
  };

  const handlePartialConfirm = async () => {
    const paid = parseFloat(partialPaidAmount) || 0;
    if (paid <= 0) {
      toast.error("Please enter a valid upfront payment amount.");
      return;
    }
    if (paid >= total) {
      setPartialModalOpen(false);
      await executeCheckout([{ payment_method: partialPaymentMode.toLowerCase(), amount: total }]);
      return;
    }

    if (!selectedCustomer || selectedCustomer.id === 'walk-in' || selectedCustomer.id === 'WALK-IN') {
      toast.error("Please select a registered customer to record the remaining balance due in their Khata/Ledger!");
      setIsCustomerModalOpen(true);
      return;
    }

    const due = Number((total - paid).toFixed(2));

    if (partialPaymentMode === 'Wallet' && (customerWalletBalance || 0) < paid) {
      toast.error(`Insufficient Customer Wallet balance (${formatCurrency(customerWalletBalance || 0)} available).`);
      return;
    }

    setPartialModalOpen(false);
    await executeCheckout([
      { payment_method: partialPaymentMode.toLowerCase(), amount: paid },
      { payment_method: "credit", amount: due }
    ]);
  };

  const handleHoldBill = async () => {
    try {
      if (cart.length === 0) return alert("Cart is empty.");
      if (!currentSession) return alert("Please open a register first.");

      const resolvedCart = await resolveCartProvisionalItems(cart);

      const payload = {
        subtotal: subtotal,
        tax_amount: tax,
        discount_amount: totalDiscount,
        total_amount: total,
        session_id: currentSession.id,
        status: "on_hold",
        items: resolvedCart.map(item => ({
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
          image: product && product.image ? product.image : "https://placehold.co/100?text=Item",
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

      const resolvedCart = await resolveCartProvisionalItems(cart);

      const payload = {
        subtotal: subtotal,
        tax_amount: tax,
        discount_amount: totalDiscount,
        total_amount: total,
        session_id: currentSession.id,
        items: resolvedCart.map(item => {
          const { unitPrice } = getItemEffectivePrice(item);
          return {
            product_id: item.id,
            quantity: item.qty,
            unit_price: unitPrice,
            discount: item.discount || 0,
            subtotal: (unitPrice - (item.discount || 0)) * item.qty
          };
        }),
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

  const handleSplitConfirm = async () => {
    const cashAmt = parseFloat(splitCash) || 0;
    const onlineAmt = parseFloat(splitOnline) || 0;
    if (Math.abs(cashAmt + onlineAmt - total) > 0.05) {
      toast.error(`Split amounts (${formatCurrency(cashAmt + onlineAmt)}) must equal total (${formatCurrency(total)})`);
      return;
    }
    setSplitPaymentModalOpen(false);
    const payments = [];
    if (cashAmt > 0) payments.push({ payment_method: "cash", amount: cashAmt });
    if (onlineAmt > 0) payments.push({ payment_method: "online", amount: onlineAmt });
    await handleSplitPayment(payments);
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#F3F4F6] font-sans selection:bg-indigo-100 selection:text-indigo-900">

      {/* Terminal Header Nav */}
      <div className="flex-shrink-0 bg-white/95 backdrop-blur-xl border-b border-slate-200/50 px-4 flex items-center overflow-x-auto gap-3 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.02)] z-50">
        <button
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => { });
            }
            navigate({ to: "/pos", search: { tab: "dashboard" } });
          }}
          className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white shadow-sm hover:shadow-rose-500/20 mr-2 border border-rose-100 hover:border-rose-500"
        >
          <ArrowLeft className="w-4 h-4" /> Exit POS
        </button>
        <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>
        <div className="flex items-center gap-2">
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
                className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-300 ${isActive ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-105" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Pricing Mode 3-Way Pill Toggle (Retail / Wholesale / B2B) */}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button
              onClick={() => handlePricingModeChange("Retail")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                pricingMode === "Retail"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              🛒 Retail
            </button>
            <button
              onClick={() => handlePricingModeChange("Wholesale")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                pricingMode === "Wholesale"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              📦 Wholesale
            </button>
            <button
              onClick={() => handlePricingModeChange("B2B")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                pricingMode === "B2B"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                  : "text-purple-700 hover:bg-purple-50"
              }`}
            >
              🏢 B2B
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE (3 Columns) OR SUB-VIEW */}
      {currentView === 'billing' || !currentView ? (
        <div className="flex flex-1 overflow-hidden relative">

          {/* MAIN PRODUCT AREA: LEFT CATEGORY SIDEBAR & TOP SUB-CATEGORY/BRAND WORKSPACE */}
          <div className="flex-1 bg-[#F8FAFC] flex overflow-hidden">

            {/* LEFT VERTICAL SIDEBAR: MAIN CATEGORIES */}
            <div className="w-48 sm:w-56 shrink-0 bg-white border-r border-slate-200/80 flex flex-col p-3 overflow-y-auto z-20 shadow-[2px_0_12px_rgba(0,0,0,0.02)]">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 mb-2">
                Main Categories
              </div>

              <button
                onClick={() => { setActiveCategory("all"); setActiveSubCategory("all"); setActiveBrand("all"); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-between gap-2 mb-1 ${
                  activeCategory === "all"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-600/30"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Store className="w-4 h-4 shrink-0" />
                  <span className="truncate">All Products</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeCategory === "all" ? "bg-indigo-500/40 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {products.length}
                </span>
              </button>

              <div className="space-y-1">
                {(parentCategories.length > 0 ? parentCategories : categories).map(cat => {
                  const Icon = (cat.icon && typeof cat.icon === 'function') ? cat.icon : Layers;
                  const isActive = activeCategory === cat.id;
                  const subCatIds = new Set(categories.filter(c => c.parent_id === cat.id).map(c => c.id));
                  const count = products.filter(p => p.category === cat.id || p.category_id === cat.id || subCatIds.has(p.category) || subCatIds.has(p.category_id)).length;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        setActiveSubCategory("all");
                        setActiveBrand("all");
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-between gap-2 ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-1 ring-indigo-600/30 scale-[1.01]"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className={`p-1 rounded-lg shrink-0 ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-indigo-600"}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate">{cat.name}</span>
                      </div>
                      {count > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${isActive ? "bg-indigo-500/40 text-white" : "bg-slate-100 text-slate-500"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RIGHT WORKSPACE AREA: TOP SUB-CATEGORIES/BRANDS & PRODUCT GRID */}
            <div className="flex-1 overflow-y-auto flex flex-col">

              {/* TOP SUB-CATEGORIES & BRANDS NAVIGATION BAR */}
              {(currentSubCategories.length > 0 || availableBrands.length > 0) && (
                <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 p-3 space-y-2 z-30 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                  {/* Row 1: Nested Sub-Categories Bar */}
                  {currentSubCategories.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600/70 mr-1 shrink-0 flex items-center gap-1">
                        <ChevronRight className="w-3 h-3" /> Sub-Category:
                      </span>

                      <button
                        onClick={() => { setActiveSubCategory("all"); setActiveBrand("all"); }}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shrink-0 ${
                          activeSubCategory === "all"
                            ? "bg-slate-900 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                        }`}
                      >
                        All {categories.find(c => c.id === activeCategory)?.name || "Sub-Categories"}
                      </button>

                      {currentSubCategories.map(subCat => {
                        const isSubActive = activeSubCategory === subCat.id;
                        const subCount = products.filter(p => p.category === subCat.id || p.category_id === subCat.id || p.category?.toLowerCase() === subCat.name.toLowerCase()).length;

                        return (
                          <button
                            key={subCat.id}
                            onClick={() => { setActiveSubCategory(subCat.id); setActiveBrand("all"); }}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                              isSubActive
                                ? "bg-indigo-500 text-white shadow-sm scale-105"
                                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
                            }`}
                          >
                            <span>{subCat.name}</span>
                            {subCount > 0 && (
                              <span className={`px-1.5 py-0.2 rounded-md text-[9px] ${isSubActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                                {subCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Row 2: Brands Bar */}
                  {availableBrands.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1.5 border-t border-slate-100">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600/70 mr-1 shrink-0 flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Brand:
                      </span>

                      <button
                        onClick={() => setActiveBrand("all")}
                        className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 ${
                          activeBrand === "all"
                            ? "bg-purple-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                        }`}
                      >
                        All Brands ({availableBrands.length})
                      </button>

                      {availableBrands.map(bName => {
                        const isBrandActive = activeBrand.toLowerCase() === bName.toLowerCase();
                        const bCount = products.filter(p => {
                          const matchesBrand = p.brand?.toLowerCase() === bName.toLowerCase();
                          if (activeSubCategory !== "all") {
                            return matchesBrand && (p.category === activeSubCategory || p.category_id === activeSubCategory);
                          }
                          if (activeCategory !== "all") {
                            return matchesBrand && (p.category === activeCategory || p.category_id === activeCategory);
                          }
                          return matchesBrand;
                        }).length;

                        return (
                          <button
                            key={bName}
                            onClick={() => setActiveBrand(bName)}
                            className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                              isBrandActive
                                ? "bg-purple-600 text-white shadow-sm scale-105"
                                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
                            }`}
                          >
                            <span>{bName}</span>
                            <span className={`px-1.5 py-0.2 rounded-md text-[9px] ${isBrandActive ? "bg-white/20 text-white" : "bg-purple-50 text-purple-600"}`}>
                              {bCount}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            <div className="p-4 lg:p-6 flex-1">


            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-black text-slate-900 whitespace-nowrap tracking-tight">
                  {activeCategory === "all" ? "All Products" : categories.find(c => c.id === activeCategory)?.name}
                </h3>
                <span className="text-xs font-bold bg-white text-slate-500 px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
                  {filteredProducts.length} Results
                </span>
              </div>

              <div className="flex items-center gap-3 flex-1 max-w-xl justify-end">
                <div className="flex-1 relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    id="global-search"
                    type="text"
                    placeholder="Search by name, barcode, SKU... (F2)"
                    className="block w-full pl-11 pr-20 py-3 border border-slate-200/60 rounded-full bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="absolute inset-y-0 right-1.5 flex items-center gap-1">
                    <button className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors">
                      <Camera className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors">
                      <ScanBarcode className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-white border border-slate-200/80 p-1 rounded-2xl shadow-sm">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-xl transition-colors ${viewMode === 'grid' ? 'bg-slate-100 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-xl transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                  >
                    <ListIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {paginatedProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-white rounded-2xl border border-transparent shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:border-indigo-100 transition-all duration-300 cursor-pointer group flex flex-col relative"
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
                      onClick={(e) => { e.stopPropagation(); handleSelectProduct(product); }}
                      className="absolute top-2 right-2 z-20 w-6 h-6 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>

                    <div className="h-32 bg-slate-50 relative p-4 flex items-center justify-center">
                      <img src={product.image || "https://placehold.co/400x400/f8fafc/94a3b8?text=No+Image"} onError={(e) => { e.currentTarget.src = "https://placehold.co/400x400/f8fafc/94a3b8?text=No+Image"; }} alt={product.name} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="p-3 flex flex-col flex-1 justify-between border-t border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{product.brand}</span>
                        <h4 className="text-xs font-semibold text-slate-800 leading-tight mt-0.5 line-clamp-2">{product.name}</h4>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          {(() => {
                            const eff = getItemEffectivePrice(product);
                            if (eff.isWholesale) {
                              return (
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 line-through leading-none">{formatCurrency(eff.basePrice)}</span>
                                  <span className={`font-bold leading-none mt-0.5 flex items-center gap-1 ${pricingMode === 'B2B' ? 'text-purple-700' : 'text-emerald-600'}`}>
                                    {formatCurrency(eff.unitPrice)}
                                    <span className={`text-[8px] px-1 py-0.2 rounded font-black uppercase ${pricingMode === 'B2B' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                      {eff.tierName}
                                    </span>
                                  </span>
                                </div>
                              );
                            }
                            if (product.discount > 0) {
                              return (
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 line-through leading-none">{formatCurrency(product.mrp)}</span>
                                  <span className="font-bold text-slate-900 leading-none mt-0.5">{formatCurrency(eff.unitPrice)}</span>
                                </div>
                              );
                            }
                            return (
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 leading-none">{formatCurrency(eff.unitPrice)}</span>
                                {pricingMode === 'Retail' && (
                                  <span className="text-[9px] text-slate-400 font-medium mt-0.5">Wholesale: {formatCurrency(eff.wholesalePrice)}</span>
                                )}
                              </div>
                            );
                          })()}
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
                    {paginatedProducts.map(p => (
                      <tr
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group relative"
                      >
                        <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                          <img src={p.image || "https://placehold.co/40x40/f8fafc/94a3b8?text=Img"} onError={(e) => { e.currentTarget.src = "https://placehold.co/40x40/f8fafc/94a3b8?text=Img"; }} alt={p.name} className="w-10 h-10 rounded border border-slate-100 object-cover" />
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
                          {(() => {
                            const eff = getItemEffectivePrice(p);
                            if (eff.isWholesale) {
                              return (
                                <div className="flex items-center gap-2">
                                  <span className={pricingMode === 'B2B' ? 'text-purple-700' : 'text-emerald-700'}>{formatCurrency(eff.unitPrice)}</span>
                                  <span className="text-xs text-slate-400 line-through font-normal">{formatCurrency(eff.basePrice)}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${pricingMode === 'B2B' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'}`}>{eff.tierName}</span>
                                </div>
                              );
                            }
                            if (p.discount > 0) {
                              return (
                                <div className="flex items-center gap-2">
                                  <span>{formatCurrency(eff.unitPrice)}</span>
                                  <span className="text-xs text-rose-500 line-through font-normal">{formatCurrency(p.mrp)}</span>
                                </div>
                              );
                            }
                            return <span>{formatCurrency(eff.unitPrice)}</span>;
                          })()}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          <span className={p.stock <= p.reorderLevel ? "text-rose-500 font-bold" : ""}>
                            {p.stock}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-slate-400">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSelectProduct(p); }}
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

            {/* POS Pagination Controls */}
            {filteredProducts.length > posPageSize && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">
                  Showing <span className="text-slate-900 font-bold">{(posPage - 1) * posPageSize + 1}</span> to{" "}
                  <span className="text-slate-900 font-bold">{Math.min(posPage * posPageSize, filteredProducts.length)}</span> of{" "}
                  <span className="text-slate-900 font-bold">{filteredProducts.length}</span> products
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPosPage(p => Math.max(1, p - 1))}
                    disabled={posPage === 1}
                    className="px-3 py-1.5 rounded-xl border bg-white text-xs font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 shadow-sm"
                  >
                    Previous
                  </button>
                  <span className="text-xs font-bold text-slate-800 px-2">
                    Page {posPage} of {totalPosPages}
                  </span>
                  <button
                    onClick={() => setPosPage(p => Math.min(totalPosPages, p + 1))}
                    disabled={posPage >= totalPosPages}
                    className="px-3 py-1.5 rounded-xl border bg-white text-xs font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 shadow-sm"
                  >
                    Next
                  </button>
                </div>
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
                      <h3 className="font-bold">{isEditingProduct ? "Edit Product Details" : "Product Specifications"}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditingProduct(!isEditingProduct)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 shadow-sm transition-all cursor-pointer"
                      >
                        {isEditingProduct ? "Cancel" : "Edit Product"}
                      </button>
                      <button onClick={() => { setSelectedProduct(null); setIsEditingProduct(false); }} className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-lg border border-slate-200 shadow-sm cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {isEditingProduct ? (
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8FAFC]">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Product Name</label>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, name: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white text-slate-900 font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Brand</label>
                          <input
                            type="text"
                            value={editForm.brand}
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, brand: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white text-slate-900 font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">SKU Code</label>
                          <input
                            type="text"
                            value={editForm.sku}
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, sku: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white text-slate-900 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Barcode</label>
                          <input
                            type="text"
                            value={editForm.barcode}
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, barcode: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white text-slate-900 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Selling Price ({currency.symbol})</label>
                          <input
                            type="number"
                            value={editForm.sellingPrice}
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, sellingPrice: parseFloat(e.target.value) || 0 }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white text-slate-900 font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">MRP ({currency.symbol})</label>
                          <input
                            type="number"
                            value={editForm.mrp}
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, mrp: parseFloat(e.target.value) || 0 }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white text-slate-900 font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase Price ({currency.symbol})</label>
                          <input
                            type="number"
                            value={editForm.purchasePrice}
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white text-slate-900 font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Stock</label>
                          <input
                            type="number"
                            value={editForm.stock}
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white text-slate-900 font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tax Percent (%)</label>
                          <input
                            type="number"
                            value={selectedProduct.tax_percent || 18}
                            disabled
                            className="w-full border border-slate-100 rounded-xl px-3 py-2 text-sm bg-slate-50 text-slate-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                        <textarea
                          rows={3}
                          value={editForm.longDesc}
                          onChange={(e) => setEditForm((prev: any) => ({ ...prev, longDesc: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white text-slate-900 font-medium"
                        />
                      </div>

                      <div className="pt-4 flex gap-3">
                        <button
                          onClick={async () => {
                            try {
                              if (selectedProduct.isProvisional) {
                                // If it is provisional, we can update it locally in the cart,
                                // and once the order is checked out it will be created in the DB!
                                setCart(prev => prev.map(item => {
                                  if (item.id === selectedProduct.id) {
                                    return {
                                      ...item,
                                      name: editForm.name,
                                      brand: editForm.brand,
                                      sku: editForm.sku,
                                      barcode: editForm.barcode,
                                      sellingPrice: editForm.sellingPrice,
                                      mrp: editForm.mrp,
                                      purchasePrice: editForm.purchasePrice,
                                      stock: editForm.stock,
                                      longDesc: editForm.longDesc,
                                      shortDesc: editForm.name,
                                    };
                                  }
                                  return item;
                                }));
                                toast.success("Provisional product details updated in current transaction cart!");
                              } else {
                                // For database products, call update API
                                await posApi.updateProduct(selectedProduct.id, {
                                  name: editForm.name,
                                  brand_name: editForm.brand,
                                  sku: editForm.sku,
                                  barcode: editForm.barcode,
                                  selling_price: editForm.sellingPrice,
                                  mrp: editForm.mrp,
                                  purchase_price: editForm.purchasePrice,
                                  initial_stock: editForm.stock,
                                  description: editForm.longDesc,
                                });

                                // Update local lists
                                setProducts(prev => prev.map(p => {
                                  if (p.id === selectedProduct.id) {
                                    return {
                                      ...p,
                                      name: editForm.name,
                                      brand: editForm.brand,
                                      sku: editForm.sku,
                                      barcode: editForm.barcode,
                                      sellingPrice: editForm.sellingPrice,
                                      mrp: editForm.mrp,
                                      purchasePrice: editForm.purchasePrice,
                                      stock: editForm.stock,
                                      longDesc: editForm.longDesc,
                                    };
                                  }
                                  return p;
                                }));

                                // Update cart
                                setCart(prev => prev.map(item => {
                                  if (item.id === selectedProduct.id) {
                                    return {
                                      ...item,
                                      name: editForm.name,
                                      brand: editForm.brand,
                                      sku: editForm.sku,
                                      barcode: editForm.barcode,
                                      sellingPrice: editForm.sellingPrice,
                                      mrp: editForm.mrp,
                                      purchasePrice: editForm.purchasePrice,
                                      stock: editForm.stock,
                                      longDesc: editForm.longDesc,
                                    };
                                  }
                                  return item;
                                }));
                                toast.success("Product updated successfully in local database and catalog!");
                              }
                              setSelectedProduct(null);
                              setIsEditingProduct(false);
                            } catch (e: any) {
                              toast.error("Failed to update product details: " + (e.detail || e.message));
                            }
                          }}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all text-center cursor-pointer"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setIsEditingProduct(false)}
                          className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                        <div className="flex gap-6 items-start">
                          <div className="w-48 h-48 bg-slate-50 rounded-xl border border-slate-200 p-4 shrink-0 flex items-center justify-center">
                            <img src={selectedProduct.image || "https://placehold.co/400x400/f8fafc/94a3b8?text=No+Image"} onError={(e) => { e.currentTarget.src = "https://placehold.co/400x400/f8fafc/94a3b8?text=No+Image"; }} alt={selectedProduct.name} className="w-full h-full object-contain mix-blend-multiply" />
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
                              <div className="flex justify-between"><span className="text-slate-500">Warehouse:</span> <span className="font-semibold text-slate-700">{selectedProduct.warehouse || "Main Storefront"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Location:</span> <span className="font-semibold text-slate-700">{selectedProduct.rack || "Default"} / {selectedProduct.shelf || "Default"}</span></div>
                              <div className="flex justify-between"><span className="text-slate-500">Barcode:</span> <span className="font-mono text-xs bg-white px-1 border rounded">{selectedProduct.barcode}</span></div>
                            </div>
                          </div>

                          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> AI Product Insights</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-amber-700/70">Demand Forecast:</span> <span className="font-bold text-amber-700">{selectedProduct.demandScore || 85}/100</span></div>
                              <div className="flex justify-between"><span className="text-amber-700/70">AI Recommendation:</span> <span className="font-bold text-amber-900">{selectedProduct.aiScore || 90}/100</span></div>
                              <div className="flex justify-between"><span className="text-amber-700/70">Trend Status:</span> <span className="font-semibold text-emerald-600">{selectedProduct.isFastMoving ? 'Fast Moving 🔥' : 'Stable'}</span></div>
                              <div className="flex justify-between"><span className="text-amber-700/70">Supplier:</span> <span className="font-semibold text-amber-900">{selectedProduct.supplier || "Direct"}</span></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
                        <button onClick={() => addToCart(selectedProduct)} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-slate-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                          <Plus className="w-5 h-5" /> Add to Checkout
                        </button>
                        <button onClick={() => setSelectedProduct(null)} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer">
                          Close
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>

              )}
            </AnimatePresence>
          </div>
        </div>


          {/* COL 3: Billing Workspace (30%) */}

          <div className="w-[30%] min-w-[350px] max-w-[480px] shrink-0 bg-white/95 backdrop-blur-3xl flex flex-col shadow-[-8px_0_32px_rgba(0,0,0,0.05)] border-l border-slate-200/50 z-20">

            {/* Customer Profile */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setIsCustomerModalOpen(true)}
                className="w-full bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl p-3 flex items-center justify-between transition-all shadow-sm hover:shadow-md group mb-2 text-left"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-indigo-50 text-indigo-700 font-black text-sm flex items-center justify-center border border-indigo-100 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                    {selectedCustomer?.name && selectedCustomer.name !== "Walk-in Customer" ? selectedCustomer.name.charAt(0).toUpperCase() : <UserIcon className="w-5 h-5" />}
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-slate-900 leading-tight truncate">{selectedCustomer.name}</p>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">
                        {(selectedCustomer as any).customer_type || selectedCustomer.tier || 'Retail'}
                      </span>
                    </div>
                    {selectedCustomer.id && selectedCustomer.id !== 'walk-in' && selectedCustomer.id !== 'WALK-IN' ? (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="text-[11px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shadow-2xs">
                          💰 Wallet: {formatCurrency(customerWalletBalance)}
                        </span>
                        <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shadow-2xs">
                          ⭐ {selectedCustomer.points || (selectedCustomer as any).loyalty_points || 0} Pts
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Guest • Click to select customer
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors shrink-0 ml-1" />
              </button>

              {/* Customer Pending Dues Banner */}
              {customerSummary && customerSummary.total_pending_due > 0 && (
                <div className="mb-2 p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl text-xs flex flex-col gap-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-900 flex items-center gap-1">
                      ⚠️ Previous Outstanding Due:
                    </span>
                    <span className="font-extrabold text-amber-700">{currency.symbol}{customerSummary.total_pending_due?.toFixed(2)}</span>
                  </div>
                  <label className="flex items-center gap-2 text-slate-700 cursor-pointer pt-1 border-t border-amber-200/60 font-medium">
                    <input
                      type="checkbox"
                      checked={includePreviousDueInBill}
                      onChange={(e) => setIncludePreviousDueInBill(e.target.checked)}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <span>Add previous due to current bill total</span>
                  </label>
                </div>
              )}

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
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/40 relative">
              <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-4">
                  <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center border border-slate-100 shadow-sm shadow-slate-200/50">
                    <ShoppingCart className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="font-bold text-sm text-slate-500">Cart is empty.<br />Scan a barcode to begin.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item, idx) => {
                    const { unitPrice, isWholesale } = getItemEffectivePrice(item);
                    const itemTaxPercent = Number(item.tax_percent ?? item.tax ?? 18);
                    const isIncl = item.is_tax_inclusive !== false;
                    const sellingPriceIncl = isIncl ? unitPrice : unitPrice * (1 + itemTaxPercent / 100);
                    const mrpVal = Number(item.mrp) || 0;
                    const isMrpExceeded = mrpVal > 0 && sellingPriceIncl > mrpVal;

                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        onClick={() => { setDiscountModalItem(item); setDiscountInput(item.discount.toString()); }}
                        className={`bg-white border rounded-2xl p-3 shadow-sm flex flex-col gap-2 relative group cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all duration-300 ${isMrpExceeded ? "border-red-300 bg-red-50/30" : "border-slate-200/80"}`}
                      >
                        <div className="flex items-start gap-3">
                          <img src={item.image || "https://placehold.co/100x100/f8fafc/94a3b8?text=Img"} onError={(e) => { e.currentTarget.src = "https://placehold.co/100x100/f8fafc/94a3b8?text=Img"; }} alt={item.name} className="w-12 h-12 rounded-xl border border-slate-100 object-contain p-1 shrink-0 bg-slate-50" />
                          <div className="flex-1 min-w-0">
                            <h5 className="text-[13px] font-bold text-slate-900 leading-tight truncate pr-6">{item.name}</h5>
                            <div className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wider uppercase">{item.sku}</div>

                            {/* Batch, HSN & GST Tax-Inclusive Badges */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {item.batch_number && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[9px] font-bold rounded">
                                  Batch #{item.batch_number}
                                </span>
                              )}
                              {item.hsn_code && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[9px] font-mono font-bold rounded">
                                  HSN: {item.hsn_code}
                                </span>
                              )}
                              <span className="text-[9px] text-slate-500 font-semibold">
                                GST: {itemTaxPercent}% ({isIncl ? "Incl." : "Excl."})
                              </span>
                              {mrpVal > 0 && (
                                <span className="text-[9px] text-emerald-700 font-semibold">
                                  • MRP: {formatCurrency(mrpVal)}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-1 bg-slate-100 rounded-lg border border-slate-200/60 p-0.5">
                                <button onClick={(e) => { e.stopPropagation(); updateQty(item.id, -1); }} className="w-6 h-6 flex items-center justify-center rounded-md bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                                <span className="w-8 text-center text-xs font-bold text-slate-900">{item.qty}</span>
                                <button onClick={(e) => { e.stopPropagation(); updateQty(item.id, 1); }} className="w-6 h-6 flex items-center justify-center rounded-md bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-sm text-slate-900 block leading-none">{formatCurrency(unitPrice * item.qty)}</span>
                                {isWholesale && (
                                  <span className={`text-[9px] font-bold block leading-none mt-1 ${pricingMode === 'B2B' ? 'text-purple-600' : 'text-emerald-600'}`}>
                                    {getItemEffectivePrice(item).tierName} ({formatCurrency(unitPrice)}/ea)
                                  </span>
                                )}
                                {item.discount > 0 && <span className="text-[10px] text-rose-500 font-bold block leading-none mt-1">Saved {formatCurrency(item.discount * item.qty)}</span>}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                            className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors p-1.5 rounded-lg opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* MRP Warning Alert Banner */}
                        {isMrpExceeded && (
                          <div className="flex items-center gap-1.5 bg-red-100 text-red-800 border border-red-300 rounded-lg px-2 py-1 text-[10px] font-bold">
                            <span className="animate-pulse">⚠️</span>
                            <span>MRP Alert: Price {currency.symbol}{sellingPriceIncl.toFixed(2)} &gt; MRP {currency.symbol}{mrpVal.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Checkout Summary */}
            <div className="bg-white border-t border-slate-200/80 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.05)] flex flex-col shrink-0 z-20">

              {/* DYNAMIC FREE QTY / SCHEMES BAR */}
              <div className="p-2 border-b border-slate-200/70 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-indigo-500/10 relative z-30 overflow-visible">
                <FreeQtyPanel
                  cartSubtotal={subtotal}
                  cartItems={cart.map(c => ({
                    id: c.id,
                    product_id: c.id,
                    name: c.name,
                    quantity: c.qty,
                  }))}
                  freeItems={freeItems}
                  onFreeItemsChange={(newFree) => {
                    setFreeItems(newFree);
                    // Also ensure any newly added free item shows in cart with 0 price if not already
                    newFree.forEach(f => {
                      const exists = cart.find(ci => ci.id === f.product_id);
                      if (!exists && f.product_id) {
                        const prod = products.find(p => p.id === f.product_id);
                        if (prod) {
                          setCart(prev => [...prev, {
                            ...prod,
                            sellingPrice: 0,
                            mrp: prod.mrp || 0,
                            discount: 0,
                            qty: f.quantity || 1,
                            is_free: true,
                            name: `🎁 [FREE] ${prod.name}`,
                          }]);
                        }
                      }
                    });
                  }}
                  products={products.map(p => ({ id: p.id, name: p.name, sku: p.sku }))}
                  compact={true}
                />
              </div>

              {/* DYNAMIC CART DISCOUNT BAR */}
              <div className="p-3 border-b border-slate-200/70 bg-slate-50/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-indigo-600" /> Dynamic Cart Discount
                  </span>
                  <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-200/80 text-[10px] font-bold shadow-2xs">
                    <button
                      onClick={() => setDiscountMode("before_tax")}
                      className={`px-2 py-0.5 rounded-md transition-all ${discountMode === "before_tax" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                    >
                      Before Tax
                    </button>
                    <button
                      onClick={() => setDiscountMode("after_tax")}
                      className={`px-2 py-0.5 rounded-md transition-all ${discountMode === "after_tax" ? "bg-purple-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                    >
                      After Tax
                    </button>
                  </div>
                </div>

                {/* Quick Presets & Custom Input */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
                    {[0, 5, 10, 15, 20, 25].map(val => (
                      <button
                        key={val}
                        onClick={() => { setCartDiscountType("percent"); setCartDiscountValue(val); }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0 ${cartDiscountType === "percent" && cartDiscountValue === val ? (discountMode === "before_tax" ? "bg-indigo-600 text-white shadow-sm" : "bg-purple-600 text-white shadow-sm") : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100"}`}
                      >
                        {val === 0 ? "Off" : `${val}%`}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center bg-white border border-slate-200/80 rounded-lg p-0.5 shrink-0 w-28 shadow-2xs">
                    <input
                      type="number"
                      min="0"
                      placeholder="Custom"
                      value={cartDiscountValue || ""}
                      onChange={(e) => setCartDiscountValue(Math.max(0, Number(e.target.value)))}
                      className="w-14 text-center text-xs font-bold text-slate-800 outline-none"
                    />
                    <button
                      onClick={() => setCartDiscountType(cartDiscountType === "percent" ? "amount" : "percent")}
                      className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-black text-slate-700 hover:bg-slate-200"
                    >
                      {cartDiscountType === "percent" ? "%" : "₹"}
                    </button>
                  </div>
                </div>
              </div>

              {/* DYNAMIC ADDITIONAL CHARGES BAR (Freight, Packing, Transport, etc.) */}
              <div className="px-3 py-2.5 border-b border-slate-200/70 bg-emerald-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-emerald-600" /> Additional Charges (Freight / Transport)
                  </span>
                  <button
                    onClick={handleAddPosChargeRow}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-200 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Charge
                  </button>
                </div>

                {posCustomCharges.length > 0 && (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {posCustomCharges.map(ch => (
                      <div key={ch.id} className="flex items-center gap-1.5 bg-white border border-emerald-200/70 rounded-lg p-1 shadow-2xs">
                        <input
                          type="text"
                          value={ch.name}
                          onChange={e => handleUpdatePosCharge(ch.id, "name", e.target.value)}
                          placeholder="Charge name (e.g. Transport)"
                          className="flex-1 min-w-0 text-xs font-semibold text-slate-800 outline-none px-1.5"
                        />
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md px-1 shrink-0">
                          <span className="text-[10px] text-slate-400 font-bold">{currency.symbol}</span>
                          <input
                            type="number"
                            min="0"
                            value={ch.amount || ""}
                            onChange={e => handleUpdatePosCharge(ch.id, "amount", e.target.value)}
                            placeholder="0"
                            className="w-14 text-right text-xs font-bold text-slate-900 outline-none py-0.5"
                          />
                        </div>
                        {/* GST % Selector for charge */}
                        <select
                          value={ch.tax_rate || 0}
                          onChange={e => handleUpdatePosCharge(ch.id, "tax_rate", e.target.value)}
                          title="GST on charge"
                          className="shrink-0 bg-slate-50 border border-slate-200 rounded-md px-1 py-0.5 text-[10px] font-bold text-slate-700 outline-none"
                        >
                          <option value={0}>0% GST</option>
                          <option value={5}>5% GST</option>
                          <option value={12}>12% GST</option>
                          <option value={18}>18% GST</option>
                          <option value={28}>28% GST</option>
                        </select>
                        {Number(ch.tax_rate) > 0 && Number(ch.amount) > 0 && (
                          <span className="shrink-0 text-[10px] font-bold text-emerald-600 whitespace-nowrap">
                            +{currency.symbol}{(Number(ch.amount) * Number(ch.tax_rate) / 100).toFixed(2)}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeletePosCharge(ch.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals Box */}
              <div className="p-4 space-y-1.5 border-b border-slate-100 border-dashed bg-slate-50/40">
                <div className="flex justify-between text-[12px]">
                  <span className="text-slate-500 font-bold">Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} items)</span>
                  <span className="font-black text-slate-700">{formatCurrency(subtotal)}</span>
                </div>

                {itemDiscounts > 0 && (
                  <div className="flex justify-between text-[12px] text-rose-500">
                    <span className="font-bold">Item Savings</span>
                    <span className="font-black">-{formatCurrency(itemDiscounts)}</span>
                  </div>
                )}

                {beforeTaxDiscount > 0 && (
                  <div className="flex justify-between text-[12px] text-indigo-600 font-bold">
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Before-Tax Discount ({cartDiscountType === "percent" ? `${cartDiscountValue}%` : "Flat"})</span>
                    <span className="font-black">-{formatCurrency(beforeTaxDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-[12px]">
                  <span className="text-slate-500 font-bold">Taxable Amount</span>
                  <span className="font-black text-slate-700">{formatCurrency(taxableAmount)}</span>
                </div>

                {/* GST Breakdown (CGST+SGST vs IGST toggle) */}
                <div className="pt-1.5 border-t border-slate-200/60 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-bold flex items-center gap-1">
                      Total Tax / GST
                    </span>
                    <div className="flex items-center bg-slate-100 rounded-md p-0.5 text-[9px] font-bold">
                      <button
                        onClick={() => setPosGstType("cgst_sgst")}
                        className={`px-1.5 py-0.5 rounded transition-all ${posGstType === "cgst_sgst" ? "bg-white text-indigo-700 shadow-2xs font-extrabold" : "text-slate-500"}`}
                      >
                        CGST+SGST
                      </button>
                      <button
                        onClick={() => setPosGstType("igst")}
                        className={`px-1.5 py-0.5 rounded transition-all ${posGstType === "igst" ? "bg-white text-indigo-700 shadow-2xs font-extrabold" : "text-slate-500"}`}
                      >
                        IGST
                      </button>
                    </div>
                  </div>

                  {posGstType === "cgst_sgst" ? (
                    <>
                      <div className="flex justify-between text-[11px] text-slate-600 pl-2">
                        <span>• CGST</span>
                        <span className="font-semibold">+{formatCurrency((tax + posChargesGstTotal) / 2)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-600 pl-2">
                        <span>• SGST</span>
                        <span className="font-semibold">+{formatCurrency((tax + posChargesGstTotal) / 2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-[11px] text-slate-600 pl-2">
                      <span>• IGST</span>
                      <span className="font-semibold">+{formatCurrency(tax + posChargesGstTotal)}</span>
                    </div>
                  )}
                </div>

                {posAdditionalChargesTotal > 0 && (
                  <div className="flex justify-between text-[12px] text-emerald-700 font-bold">
                    <span className="flex items-center gap-1"><Truck className="w-3 h-3 text-emerald-600" /> Extra Additional Charges</span>
                    <span className="font-black">+{formatCurrency(posAdditionalChargesTotal)}</span>
                  </div>
                )}

                {afterTaxDiscount > 0 && (
                  <div className="flex justify-between text-[12px] text-purple-600 font-bold">
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> After-Tax Discount ({cartDiscountType === "percent" ? `${cartDiscountValue}%` : "Flat"})</span>
                    <span className="font-black">-{formatCurrency(afterTaxDiscount)}</span>
                  </div>
                )}
              </div>

              {/* Massive Grand Total */}
              <div className="px-5 py-4 flex justify-between items-end bg-white">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Grand Total</span>
                <span className="text-[2.5rem] font-black text-slate-900 tracking-tighter leading-none">{formatCurrency(total)}</span>
              </div>

              {/* Payment Methods Grid */}
              <div className="px-4 pb-4">
                <div className="grid grid-cols-4 gap-1.5 mb-4">
                  <button
                    onClick={() => setPaymentMethod('Cash')}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border-2 transition-all shadow-sm hover:-translate-y-0.5 ${paymentMethod === 'Cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-emerald-500/20' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-500 bg-white'}`}
                  >
                    <Banknote className={`w-4 h-4 ${paymentMethod === 'Cash' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Cash</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('Card')}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border-2 transition-all shadow-sm hover:-translate-y-0.5 ${paymentMethod === 'Card' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-indigo-500/20' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-500 bg-white'}`}
                  >
                    <CreditCard className={`w-4 h-4 ${paymentMethod === 'Card' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Card</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('UPI')}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border-2 transition-all shadow-sm hover:-translate-y-0.5 ${paymentMethod === 'UPI' ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-purple-500/20' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-500 bg-white'}`}
                  >
                    <QrCode className={`w-4 h-4 ${paymentMethod === 'UPI' ? 'text-purple-600' : 'text-slate-400'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">UPI</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('Wallet')}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border-2 transition-all shadow-sm hover:-translate-y-0.5 ${paymentMethod === 'Wallet' ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sky-500/20' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-500 bg-white'}`}
                  >
                    <Wallet className={`w-4 h-4 ${paymentMethod === 'Wallet' ? 'text-sky-600' : 'text-slate-400'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Wallet</span>
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod('Partial Pay');
                      setPartialPaidAmount(total > 0 ? (total * 0.5).toFixed(2) : '');
                      setPartialModalOpen(true);
                    }}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border-2 transition-all shadow-sm hover:-translate-y-0.5 ${paymentMethod === 'Partial Pay' ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-rose-500/20' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-500 bg-white'}`}
                  >
                    <Percent className={`w-4 h-4 ${paymentMethod === 'Partial Pay' ? 'text-rose-600' : 'text-slate-400'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Partial Pay</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('Pay Later')}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border-2 transition-all shadow-sm hover:-translate-y-0.5 ${paymentMethod === 'Pay Later' ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-amber-500/20' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-500 bg-white'}`}
                  >
                    <Clock className={`w-4 h-4 ${paymentMethod === 'Pay Later' ? 'text-amber-600' : 'text-slate-400'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Pay Later</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('Split')}
                    className={`col-span-2 flex flex-row items-center justify-center gap-2 py-2.5 rounded-xl border-2 transition-all shadow-sm hover:-translate-y-0.5 ${paymentMethod === 'Split' ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-orange-500/20' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-500 bg-white'}`}
                  >
                    <Combine className={`w-4 h-4 ${paymentMethod === 'Split' ? 'text-orange-600' : 'text-slate-400'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Split Payment</span>
                  </button>
                </div>

                {/* Complete Payment Button */}
                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || !paymentMethod}
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2 group transform active:scale-[0.98]"
                >
                  Complete Payment <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
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
      <div className="h-10 bg-white border-t border-slate-200/60 flex items-center justify-between px-4 shrink-0 text-slate-500 text-[11px] font-bold tracking-wide z-40 relative shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">

        {/* AI Recommendations */}
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/50">
          <Sparkles className="w-3 h-3" />
          <span>AI Insight: Recommend <b>Warranty Plan</b> based on cart value.</span>
        </div>

        {/* Shift Info */}
        <div className="flex items-center gap-4 border-l border-slate-200 pl-4">
          <span className="flex items-center gap-1.5 text-slate-700"><UserIcon className="w-3.5 h-3.5 text-slate-400" /> {posSession.cashier}</span>
          <span className="flex items-center gap-1.5 text-slate-700"><Clock className="w-3.5 h-3.5 text-slate-400" /> {posSession.shift}</span>
        </div>

        {/* Device Status */}
        <div className="flex items-center gap-4 border-l border-slate-200 pl-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <ScanBarcode className="w-3.5 h-3.5 text-slate-400" />
            Scanner
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            Printer
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div>
            <Database className="w-3.5 h-3.5 text-slate-400" />
            Drawer
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
                <img src={discountModalItem.image || "https://placehold.co/100x100/f8fafc/94a3b8?text=Img"} onError={(e) => { e.currentTarget.src = "https://placehold.co/100x100/f8fafc/94a3b8?text=Img"; }} alt={discountModalItem.name} className="w-12 h-12 object-contain mix-blend-multiply bg-white rounded border border-slate-200" />
                <div>
                  <p className="font-bold text-slate-900 line-clamp-1">{discountModalItem.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{formatCurrency(discountModalItem.sellingPrice)} each</p>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Discount Amount ({currency.symbol})</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency.symbol}</span>
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cash Tendered ({currency.symbol})</label>
                <div className="relative mb-3">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency.symbol}</span>
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

              <div className="mb-6 p-4 bg-slate-900 rounded-xl flex flex-col justify-center shadow-inner">
                <div className="flex justify-between items-center w-full">
                  <span className="text-sm font-bold text-slate-400">Change Due</span>
                  <span className={`text-3xl font-black ${Number(cashTendered) >= total ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {Number(cashTendered) >= total ? formatCurrency(Number(cashTendered) - total) : '---'}
                  </span>
                </div>
                {Number(cashTendered) > total && selectedCustomer && selectedCustomer.id !== "WALK-IN" && (
                  <label className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-700/50 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={creditChangeToWallet} 
                      onChange={(e) => setCreditChangeToWallet(e.target.checked)} 
                      className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-500 bg-slate-800 border-slate-600" 
                    />
                    <span className="text-sm font-semibold text-slate-300">
                      Add change ({formatCurrency(Number(cashTendered) - total)}) to Customer Wallet
                    </span>
                  </label>
                )}
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
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency.symbol}</span>
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
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency.symbol}</span>
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

      {/* PARTIAL PAYMENT WITH DUE MODAL */}
      <AnimatePresence>
        {partialModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPartialModalOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-slate-100">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                    <Percent className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Partial Payment & Due Collection</h3>
                    <p className="text-[11px] text-slate-500 font-semibold">Collect upfront amount now & record balance due in Khata</p>
                  </div>
                </div>
                <button onClick={() => setPartialModalOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
              </div>

              {/* Grand Total Bar */}
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex justify-between items-center mb-4 shadow-inner">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Total Bill Amount</span>
                  <span className="text-2xl font-black text-white">{formatCurrency(total)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Party / Customer</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {selectedCustomer?.id && selectedCustomer.id !== "WALK-IN" && selectedCustomer.id !== "walk-in" ? selectedCustomer.name : "⚠️ Walk-in Guest (Requires Selection)"}
                  </span>
                </div>
              </div>

              {/* Upfront Payment Mode Selector */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">1. Select Upfront Tender Mode</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: "Cash", icon: Banknote },
                    { id: "UPI", icon: QrCode },
                    { id: "Card", icon: CreditCard },
                    { id: "Wallet", icon: Wallet }
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = partialPaymentMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPartialPaymentMode(m.id)}
                        className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl border-2 transition-all font-bold text-xs ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm"
                            : "border-slate-200 hover:border-slate-300 text-slate-600 bg-slate-50/50"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[10px]">{m.id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount Paid Now Input + Quick Chips */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">2. Amount Paid Now ({currency.symbol})</label>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    {Number(partialPaidAmount) > 0 && Number(partialPaidAmount) < total ? `${((Number(partialPaidAmount) / total) * 100).toFixed(0)}% Upfront` : ""}
                  </span>
                </div>
                <div className="relative mb-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">{currency.symbol}</span>
                  <input
                    type="number"
                    value={partialPaidAmount}
                    onChange={(e) => setPartialPaidAmount(e.target.value)}
                    className="w-full text-2xl font-black text-slate-900 border-2 border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-rose-500 transition-colors"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>

                {/* Quick % Buttons */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "25%", val: Number((total * 0.25).toFixed(2)) },
                    { label: "50%", val: Number((total * 0.50).toFixed(2)) },
                    { label: "75%", val: Number((total * 0.75).toFixed(2)) },
                    { label: "Full (100%)", val: total }
                  ].map(chip => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => setPartialPaidAmount(chip.val.toString())}
                      className={`py-1.5 text-xs font-bold rounded-xl border transition-all ${
                        Number(partialPaidAmount) === chip.val
                          ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Balance Due Calculation Card */}
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl mb-4">
                <div className="flex justify-between items-center text-xs text-amber-900 font-bold mb-1">
                  <span>Upfront Collection ({partialPaymentMode}):</span>
                  <span className="text-emerald-700 font-black">+{formatCurrency(Number(partialPaidAmount) || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-black text-amber-950 pt-1.5 border-t border-amber-200/60">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-amber-600" /> Remaining Balance Due (Khata):
                  </span>
                  <span className="text-amber-700 text-base">
                    {formatCurrency(Math.max(0, total - (Number(partialPaidAmount) || 0)))}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                {(!selectedCustomer || selectedCustomer.id === "WALK-IN" || selectedCustomer.id === "walk-in") && (
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="py-3 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors flex items-center gap-1"
                  >
                    <UserIcon className="w-4 h-4" /> Link Customer
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePartialConfirm}
                  disabled={!partialPaidAmount || Number(partialPaidAmount) <= 0}
                  className="flex-1 py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-rose-600/20 transition-all uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Percent className="w-4 h-4" /> Confirm Partial Payment
                </button>
              </div>
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
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Starting Cash ({currency.symbol})</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency.symbol}</span>
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
                          <p className="text-sm font-bold text-slate-800">Customer: {bill.customer_id ? bill.customer_id.substring(0, 8) : 'Walk-in'}</p>
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

      {/* Customer Selection & Registration Modal */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCustomerModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-100 z-10"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3 text-slate-900">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg leading-tight">Customer Profile Selection</h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Attach Customer to Terminal Cart & Rewards</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode Toggle Pills */}
              <div className="p-3 border-b border-slate-100 bg-white flex gap-2">
                <button
                  onClick={() => setCustomerTab('search')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    customerTab === 'search'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Search Existing Customer
                </button>
                <button
                  onClick={() => setCustomerTab('new')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    customerTab === 'new'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  + Add New Customer
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 bg-slate-50">
                {customerTab === 'search' ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Search by customer name, mobile, or email..."
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500 shadow-sm"
                      />
                    </div>

                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                      {customerList
                        .filter(c =>
                          !customerSearchQuery.trim() ||
                          c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                          (c.phone && c.phone.includes(customerSearchQuery)) ||
                          (c.email && c.email.toLowerCase().includes(customerSearchQuery.toLowerCase()))
                        )
                        .map(cust => (
                          <div
                            key={cust.id}
                            onClick={() => {
                              setSelectedCustomer(cust);
                              setIsCustomerModalOpen(false);
                            }}
                            className={`p-3.5 bg-white border rounded-xl cursor-pointer transition-all flex items-center justify-between hover:border-indigo-400 hover:shadow-md ${
                              selectedCustomer.id === cust.id ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20' : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center border border-slate-200">
                                {cust.name.charAt(0)}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                  {cust.name}
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.2 rounded">
                                    {cust.tier || 'Silver'} Tier
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                                  {cust.phone && <span>📞 {cust.phone}</span>}
                                  <span>{cust.points || 0} Pts</span>
                                </div>
                              </div>
                            </div>
                            <button className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors">
                              Select
                            </button>
                          </div>
                        ))}
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                      <button
                        onClick={() => {
                          setSelectedCustomer(posCustomers[0]);
                          setIsCustomerModalOpen(false);
                        }}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800"
                      >
                        Reset to Walk-in Guest
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCreateCustomer} className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Customer Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Alex Rivera"
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        required
                        className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number</label>
                        <input
                          type="text"
                          placeholder="+1 (555) 019-2834"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                        <input
                          type="email"
                          placeholder="alex@example.com"
                          value={newCustEmail}
                          onChange={(e) => setNewCustEmail(e.target.value)}
                          className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Company / Business Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Acme Corp"
                          value={newCustCompany}
                          onChange={(e) => setNewCustCompany(e.target.value)}
                          className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Customer Category / Type</label>
                        <select
                          value={newCustType}
                          onChange={(e) => setNewCustType(e.target.value)}
                          className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="Retail">Retail Customer</option>
                          <option value="Wholesale">Wholesale Client</option>
                          <option value="B2B">B2B Business Party</option>
                        </select>
                      </div>
                    </div>

                    {/* GSTIN Field with Live Verification */}
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800">GSTIN / Tax ID Number</label>
                        <span className="text-[10px] text-slate-500 font-medium">Auto-populates business & address</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. 37AABCU9603R1ZM"
                          value={newCustGST}
                          onChange={(e) => setNewCustGST(e.target.value.toUpperCase())}
                          maxLength={15}
                          className="flex-1 h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono font-bold"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyPOSCustomerGST}
                          disabled={verifyingCustGST || !newCustGST.trim()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                        >
                          {verifyingCustGST ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          )}
                          {verifyingCustGST ? "Verifying..." : "⚡ Verify & Auto-fill"}
                        </button>
                      </div>
                    </div>

                    {/* Billing Address Structured Fields */}
                    <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                        🏢 Billing Address Details
                      </span>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Building, Street & Area</label>
                        <input
                          type="text"
                          placeholder="e.g. Door 14/2, Market Street"
                          value={newCustStreet}
                          onChange={(e) => setNewCustStreet(e.target.value)}
                          className="w-full h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">City / Town</label>
                          <input
                            type="text"
                            placeholder="e.g. Proddatur"
                            value={newCustCity}
                            onChange={(e) => setNewCustCity(e.target.value)}
                            className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">State / UT (GST)</label>
                          <select
                            value={newCustState}
                            onChange={(e) => {
                              setNewCustState(e.target.value);
                              if (isCustShippingSameAsBilling) setNewCustShipState(e.target.value);
                            }}
                            className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {INDIAN_STATES.map((st) => (
                              <option key={st.code} value={st.name}>
                                {st.code} - {st.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            PIN Code {isLookingUpPincode && <span className="text-indigo-600 animate-pulse text-[10px]">Detecting...</span>}
                          </label>
                          <input
                            type="text"
                            placeholder="PIN Code"
                            maxLength={6}
                            value={newCustPincode}
                            onChange={(e) => handleCustPincodeChange(e.target.value)}
                            className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-800"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Shipping Address Header & Checkbox */}
                    <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                          🚚 Shipping / Delivery Address
                        </span>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isCustShippingSameAsBilling}
                            onChange={(e) => setIsCustShippingSameAsBilling(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Same as Billing Address
                        </label>
                      </div>

                      {!isCustShippingSameAsBilling && (
                        <div className="space-y-2 pt-2 border-t border-slate-200">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Shipping Building, Street & Area</label>
                            <input
                              type="text"
                              placeholder="e.g. Warehouse 3, Industrial Area"
                              value={newCustShipStreet}
                              onChange={(e) => setNewCustShipStreet(e.target.value)}
                              className="w-full h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[11px] font-semibold text-slate-600 block mb-1">City / Town</label>
                              <input
                                type="text"
                                placeholder="City"
                                value={newCustShipCity}
                                onChange={(e) => setNewCustShipCity(e.target.value)}
                                className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-slate-600 block mb-1">State / UT (GST)</label>
                              <select
                                value={newCustShipState}
                                onChange={(e) => setNewCustShipState(e.target.value)}
                                className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                {INDIAN_STATES.map((st) => (
                                  <option key={st.code} value={st.name}>
                                    {st.code} - {st.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                                PIN Code {isLookingUpPincode && <span className="text-indigo-600 animate-pulse text-[10px]">Detecting...</span>}
                              </label>
                              <input
                                type="text"
                                placeholder="PIN"
                                maxLength={6}
                                value={newCustShipPincode}
                                onChange={(e) => handleCustShipPincodeChange(e.target.value)}
                                className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-800"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomerTab('search')}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md"
                      >
                        Create & Attach Customer
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Active Checkout Thermal Printer Portal */}
      <ThermalReceiptPrinter bill={completedCheckoutBill} />
    </div>
  );
}

// Trivial change to force Vite HMR rebuild
