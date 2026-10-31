import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useI18n } from "@/contexts/i18n-context";
import {
  Search, ScanBarcode, Store, Clock, User as UserIcon,
  Trash2, X, ChevronRight, Plus, Minus, CreditCard, Banknote, QrCode, Tag, ShoppingCart,
  Info, Camera, Sparkles, Printer, Database, Boxes, LayoutGrid, List as ListIcon, Combine, ArrowRightLeft, ArrowLeft, ArrowRight,
  Truck, RefreshCw, Heart, History, Wallet, Layers, Phone, Building, Mail, UserPlus, Percent, CheckCircle2, Loader2, Check,
  Pencil, Edit3, MapPin, Bell, ChevronDown, Package, Filter, ReceiptText,
  Box, Flower2, Cloud, Gem, Leaf, Grid, Flower, Palette, Shield, Crown, Sun, Shirt, Flame, Award, Compass, Monitor, ShoppingBag
} from "lucide-react";
import { posApi, inventoryApi, crmApi, invoicesApi, crmWalletApi, procurementApi, POSProduct, POSCategory, resolveImageUrl, fetchSalesEmployees } from "../../lib/api-client";
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
import { WhatsAppStatusIndicator } from "../layout/WhatsAppStatusIndicator";
import { generateThermalReceiptHtml, thermalReceiptHtmlToPdfBase64, printHtmlInPage, triggerThermalPrint } from "../../lib/print-helper";
import { useCurrency } from "@/hooks/use-currency";
import { formatCurrency, getTodayDateString, getCurrentTimeString, isValidUUID, isWalkInParty, formatPartyAddress } from "../../lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { INDIAN_STATES } from "@/data/indian-states";
import { usePincodeLookup } from "@/hooks/use-pincode-lookup";
import { FreeQtyPanel, FreeQtyItem } from "./FreeQtyPanel";
import { StockAlertModal } from "./StockAlertModal";
import { useTenant } from "../../contexts/tenant-context";
import { PineLabsEDCModal } from "./PineLabsEDCModal";
import { RazorpayPOSModal } from "./RazorpayPOSModal";
import { BatchSelectorModal } from "../inventory/BatchSelectorModal";
import { getEffectiveTaxRate, extractProductDiscount } from "@/lib/gst-utils";
import { loadStoredInvoiceSettings, saveStoredInvoiceSettings } from "./InvoiceQuickSettingsModal";
import { getActiveBillingGst, getActiveReceiptTemplate, setOrgDocumentPrefixes } from "../../lib/receipt-template-store";
import { safeSetItem } from "@/lib/safe-storage";
import { useStoreLocations } from "@/hooks/use-store-locations";

export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <div className="p-10 text-red-500 font-mono whitespace-pre-wrap">{this.state.error?.stack || this.state.error?.toString()}</div>;
    return this.props.children;
  }
}

export function PosTerminal() {
  const { t } = useI18n();
  return <ErrorBoundary><PosTerminalInner /></ErrorBoundary>;
}

function PosTerminalInner() {
  const { t } = useI18n();
  const { currency, formatCurrency } = useCurrency();
  const { tenant } = useTenant();
  const { stores, selectedStore, setSelectedStore } = useStoreLocations();
  const currentTenantId = (tenant as any)?.raw?.tenant_id || (tenant as any)?.tenant_id || tenant?.id || "default";
  const currentCompanyId = tenant?.id || (tenant as any)?.raw?.id || (tenant as any)?.company_id || "default";
  const posStorageKey = `pos_saved_invoices_${currentTenantId}_${currentCompanyId}`;
  const [, setCurrencyTick] = useState(0);
  useEffect(() => {
    const cb = () => setCurrencyTick(t => t + 1);
    window.addEventListener("bos-currency-changed", cb);
    return () => window.removeEventListener("bos-currency-changed", cb);
  }, []);

  const { user } = useAuth();
  const defaultSalesExecName = user?.name || (user as any)?.fullName || (user?.email ? user.email.split('@')[0] : "Sales Executive");
  const [salesExecutive, setSalesExecutive] = useState<string>(() => defaultSalesExecName);
  const [salesEmployees, setSalesEmployees] = useState<any[]>([]);

  useEffect(() => {
    async function loadStaff() {
      try {
        const staffRes = await fetchSalesEmployees().catch(() => null);
        if (staffRes && Array.isArray(staffRes) && staffRes.length > 0) {
          const list = staffRes.map((u: any) => ({
            id: u.id,
            full_name: u.full_name || u.name || u.email,
            employee_code: u.employee_code || `EMP-${String(u.id).slice(0, 4).toUpperCase()}`
          }));
          setSalesEmployees(list);
          const currentUserMatch = list.find(e => e.id === user?.id || (user?.email && ((e as any).email || "").toLowerCase() === user.email.toLowerCase()));
          const defaultName = currentUserMatch?.full_name || list[0]?.full_name || defaultSalesExecName;
          setSalesExecutive(defaultName);
        } else if (user) {
          const currentUserName = user.name || (user as any).fullName || user.email || "Sales Executive";
          setSalesEmployees([
            { id: user.id || "u-staff", full_name: currentUserName, employee_code: (user as any).employee_code || "EMP-0001", is_fallback: true }
          ]);
          setSalesExecutive(currentUserName);
        }
      } catch {
        if (user) {
          const currentUserName = user.name || (user as any).fullName || user.email || "Sales Executive";
          setSalesEmployees([
            { id: user.id || "u-staff", full_name: currentUserName, employee_code: (user as any).employee_code || "EMP-0001", is_fallback: true }
          ]);
          setSalesExecutive(currentUserName);
        }
      }
    }
    void loadStaff();
  }, [tenant?.id, user, defaultSalesExecName]);

  const search = useSearch({ strict: false }) as any;
  const navigate = useNavigate();
  const currentView = search.view || 'billing';

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeSubCategory, setActiveSubCategory] = useState<string>("all");
  const [activeBrand, setActiveBrand] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [posPage, setPosPage] = useState<number>(1);
  const [posPageSize, setPosPageSize] = useState<number>(20);
  const [cart, setCart] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const toggleFavorite = useCallback((productId: string) => {
    setFavorites(prev => ({ ...prev, [productId]: !prev[productId] }));
  }, []);
  const [sortBy, setSortBy] = useState<string>("relevance");

  const getCategoryVisual = useCallback((name: string) => {
    const n = (name || "").toUpperCase().trim();
    if (n === "ACC") return { Icon: Box, color: "text-blue-500" };
    if (n === "BANARAS") return { Icon: Flower2, color: "text-rose-500" };
    if (n === "COTTON") return { Icon: Cloud, color: "text-sky-500" };
    if (n === "DHARMAVARAM") return { Icon: Gem, color: "text-emerald-500" };
    if (n === "FANCY") return { Icon: Sparkles, color: "text-teal-500" };
    if (n.includes("GREEN MANGO") || n.includes("MANGO")) return { Icon: Leaf, color: "text-lime-600" };
    if (n === "IKKAT") return { Icon: Grid, color: "text-violet-500" };
    if (n === "JAMDANI") return { Icon: Flower, color: "text-pink-500" };
    if (n === "JAMDHANI") return { Icon: Layers, color: "text-cyan-500" };
    if (n === "KALAMKARI") return { Icon: Palette, color: "text-amber-500" };
    if (n === "KOTA") return { Icon: Shield, color: "text-emerald-600" };
    if (n === "MAHESHWARI") return { Icon: Crown, color: "text-amber-600" };
    if (n === "MANGALGIRI") return { Icon: Sun, color: "text-yellow-600" };
    if (n.includes("MYSORE SILK")) return { Icon: Shirt, color: "text-indigo-600" };
    if (n === "MYSORE") return { Icon: Layers, color: "text-blue-600" };
    if (n === "PATOLA") return { Icon: Flame, color: "text-red-500" };
    if (n === "PATTU") return { Icon: Award, color: "text-amber-500" };
    if (n === "PITHANI") return { Icon: Compass, color: "text-blue-600" };
    if (n.includes("ELEC")) return { Icon: Monitor, color: "text-blue-500" };
    if (n.includes("GROC")) return { Icon: ShoppingCart, color: "text-emerald-500" };
    if (n.includes("FASH") || n.includes("CLOTH") || n.includes("APP")) return { Icon: ShoppingBag, color: "text-violet-500" };
    if (n.includes("BEAUTY") || n.includes("CARE")) return { Icon: Heart, color: "text-pink-500" };
    return { Icon: Layers, color: "text-[#5B4DF5]" };
  }, []);

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
  const [newCustOutstanding, setNewCustOutstanding] = useState("");

  // Structured Address States
  const [newCustStreet, setNewCustStreet] = useState("");
  const [newCustCity, setNewCustCity] = useState("");
  const [newCustState, setNewCustState] = useState("");
  const [newCustPincode, setNewCustPincode] = useState("");

  const [newCustShipStreet, setNewCustShipStreet] = useState("");
  const [newCustShipCity, setNewCustShipCity] = useState("");
  const [newCustShipState, setNewCustShipState] = useState("");
  const [newCustShipPincode, setNewCustShipPincode] = useState("");
  const [isCustShippingSameAsBilling, setIsCustShippingSameAsBilling] = useState(true);

  // Free Quantity / Promotional Schemes State
  const [freeItems, setFreeItems] = useState<FreeQtyItem[]>([]);

  // Hardware POS EDC & Online Gateways State
  const [isPineLabsModalOpen, setIsPineLabsModalOpen] = useState(false);
  const [isRazorpayModalOpen, setIsRazorpayModalOpen] = useState(false);
  const [edcMetadata, setEdcMetadata] = useState<{ rrn?: string; authCode?: string; cardBrand?: string; cardLast4?: string; batchNumber?: string } | null>(null);
  const [batchModalCartItem, setBatchModalCartItem] = useState<{ id: string; productId?: string; productName?: string; currentBatch?: string } | null>(null);

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
      .catch(() => { });
  }, []);

  // Backend data
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [customerWalletBalance, setCustomerWalletBalance] = useState<number>(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Modal States
  const [discountModalItem, setDiscountModalItem] = useState<any | null>(null);
  const [cartEditItem, setCartEditItem] = useState<any | null>(null);
  const [editSellingPrice, setEditSellingPrice] = useState<string>("");
  const [editMrp, setEditMrp] = useState<string>("");
  const [editTaxInclusive, setEditTaxInclusive] = useState<boolean>(true);
  const [editDiscountType, setEditDiscountType] = useState<"amount" | "percent">("amount");
  const [editDiscountValue, setEditDiscountValue] = useState<string>("");
  const [editUpdateMaster, setEditUpdateMaster] = useState<boolean>(false);
  const [isSavingEditItem, setIsSavingEditItem] = useState<boolean>(false);
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
  const [partialPaymentModalOpen, setPartialPaymentModalOpen] = useState(false);
  const [partialPaidAmount, setPartialPaidAmount] = useState("");
  const [partialPaymentMode, setPartialPaymentMode] = useState<string>("Cash");

  // Held Bills Modal States
  const [heldBillsModalOpen, setHeldBillsModalOpen] = useState(false);
  const [heldBillsList, setHeldBillsList] = useState<any[]>([]);
  const [isLoadingHeldBills, setIsLoadingHeldBills] = useState(false);
  const [heldBillsCount, setHeldBillsCount] = useState(0);

  // Strict Duplicate Checkout Protection Lock
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const isProcessingCheckoutRef = useRef(false);

  const isWalkInCustomer = isWalkInParty(selectedCustomer);

  useEffect(() => {
    if (!isWalkInParty(selectedCustomer)) return;
    setPartialPaymentModalOpen(false);
    if (["Pay Later", "Credit", "Partial Pay", "Partial", "Wallet"].includes(paymentMethod)) {
      setPaymentMethod("Cash");
    }
  }, [selectedCustomer?.id, paymentMethod]);

  useEffect(() => {
    if (isWalkInParty(selectedCustomer)) {
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
    if (!newCustPhone.trim()) return toast.error("Phone number is required");

    const fullBilling = [newCustStreet, newCustCity, newCustState, newCustPincode].filter(Boolean).join(", ");
    const fullShipping = isCustShippingSameAsBilling
      ? fullBilling
      : [newCustShipStreet, newCustShipCity, newCustShipState, newCustShipPincode].filter(Boolean).join(", ");

    try {
      const dueVal = Number(newCustOutstanding) || 0;
      const created = await crmApi.createCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        email: newCustEmail.trim() || undefined,
        company_name: newCustCompany.trim() || undefined,
        customer_type: newCustType,
        gst_number: newCustGST.trim() || undefined,
        opening_balance: dueVal,
        outstanding_balance: dueVal,
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
      setNewCustState("");
      setNewCustPincode("");
      setNewCustShipStreet("");
      setNewCustShipCity("");
      setNewCustShipState("");
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
      setNewCustState("");
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

  // Helper to match a product to a category/sub-category by ID or Name
  const isProductInCategory = (p: any, catId: string, allCats: any[]) => {
    if (!catId || catId === "all") return true;

    // Find target category object
    const targetCat = allCats.find(
      (c) =>
        String(c.id).toLowerCase().trim() === String(catId).toLowerCase().trim() ||
        String(c.name).toLowerCase().trim() === String(catId).toLowerCase().trim()
    );
    const targetName = (targetCat ? targetCat.name : catId).toLowerCase().trim();
    const targetId = String(targetCat?.id || catId).toLowerCase().trim();

    const pCatId = String(p.category_id || (typeof p.category === "object" ? p.category?.id : p.category) || "").toLowerCase().trim();
    const pCatName = String(p.category_name || (typeof p.category === "object" ? p.category?.name : (typeof p.category === "string" ? p.category : "")) || "").toLowerCase().trim();
    const pSubCat = String(p.sub_category || p.subcategory || p.sub_category_name || "").toLowerCase().trim();

    // 1. Direct match by ID or Name
    if (pCatId && (pCatId === targetId || pCatId === targetName)) return true;
    if (pCatName && (pCatName === targetName || pCatName === targetId)) return true;
    if (pSubCat && (pSubCat === targetName || pSubCat === targetId)) return true;

    // 2. Contains match (handles slight casing or whitespace discrepancies)
    if (pCatName && targetName && (pCatName === targetName || pCatName.includes(targetName) || targetName.includes(pCatName))) return true;
    if (pSubCat && targetName && (pSubCat === targetName || pSubCat.includes(targetName) || targetName.includes(pSubCat))) return true;

    // 3. Child categories check (if target is a parent category, match if product belongs to any child)
    const childCats = allCats.filter((c) => {
      const pId = String(c.parent_id || "").toLowerCase().trim();
      return pId && (pId === targetId || pId === targetName || (targetCat && pId === String(targetCat.id).toLowerCase().trim()));
    });

    for (const child of childCats) {
      const childId = String(child.id).toLowerCase().trim();
      const childName = String(child.name).toLowerCase().trim();
      if (
        (pCatId && (pCatId === childId || pCatId === childName)) ||
        (pCatName && (pCatName === childName || pCatName === childId)) ||
        (pSubCat && (pSubCat === childName || pSubCat === childId)) ||
        (pCatName && (pCatName.includes(childName) || childName.includes(pCatName))) ||
        (pSubCat && (pSubCat.includes(childName) || childName.includes(pSubCat)))
      ) {
        return true;
      }
    }

    return false;
  };

  // Load real data from backend on mount
  const loadData = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const [cats, invCatsRes, posProds, invProdsRes, bList, heldHistory] = await Promise.all([
        posApi.getCategories().catch(() => []),
        inventoryApi.getCategories({ page_size: 500 }).catch(() => null),
        posApi.getProducts({ limit: 5000 }).catch(() => []),
        inventoryApi.getProducts({ page_size: 5000, sort_by: "updated_at", sort_order: "desc" }).catch(() => null),
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

      // 1. Build unified categories list
      const rawPosCats = Array.isArray(cats) ? cats : ((cats as any)?.items || []);
      const rawInvCats = Array.isArray(invCatsRes) ? invCatsRes : ((invCatsRes as any)?.items || []);

      const catMap = new Map<string, any>();
      [...rawPosCats, ...rawInvCats].forEach((c: any, i: number) => {
        if (c && (c.id || c.name)) {
          const key = String(c.id || c.name);
          if (!catMap.has(key)) {
            catMap.set(key, {
              id: c.id || c.name,
              name: c.name,
              parent_id: c.parent_id || null,
              color: c.color || posCategories[i % posCategories.length]?.color || "bg-slate-100 text-slate-700",
              icon: posCategories[i % posCategories.length]?.icon || null,
              aiScore: Math.floor(Math.random() * 30) + 70,
            });
          }
        }
      });

      // 2. Build unified products list
      const rawPosProds: any[] = Array.isArray(posProds) ? posProds : ((posProds as any)?.items || []);
      const rawInvProds: any[] = Array.isArray(invProdsRes) ? invProdsRes : ((invProdsRes as any)?.items || []);

      const prodMap = new Map<string, any>();
      rawPosProds.forEach((p: any) => { if (p?.id) prodMap.set(String(p.id), p); });
      rawInvProds.forEach((p: any) => {
        if (p?.id) {
          const existing = prodMap.get(String(p.id)) || {};
          prodMap.set(String(p.id), { ...existing, ...p });
        }
      });

      const allFetchedProds = Array.from(prodMap.values());

      // Extract any missing categories / subcategories present on products
      allFetchedProds.forEach((p: any, i: number) => {
        const catName = p.category?.name || p.category_name || (typeof p.category === "string" ? p.category : "") || "";
        const subCatName = p.sub_category || p.subcategory || p.sub_category_name || "";
        if (catName && !catMap.has(catName)) {
          catMap.set(catName, {
            id: p.category_id || catName,
            name: catName,
            parent_id: null,
            color: posCategories[i % posCategories.length]?.color || "bg-slate-100 text-slate-700",
            icon: posCategories[i % posCategories.length]?.icon || null,
            aiScore: 80
          });
        }
        if (catName && subCatName) {
          const subKey = `${catName}::${subCatName}`;
          if (!catMap.has(subKey)) {
            const parentCatObj = catMap.get(catName) || catMap.get(p.category_id);
            catMap.set(subKey, {
              id: subKey,
              name: subCatName,
              parent_id: parentCatObj ? parentCatObj.id : catName,
              color: posCategories[i % posCategories.length]?.color || "bg-slate-100 text-slate-700",
              icon: null,
              aiScore: 80
            });
          }
        }
      });

      const finalCats = Array.from(catMap.values());
      setCategories(finalCats);

      const mappedProds = allFetchedProds.map((p: any) => {
        let specs: any = {};
        if (typeof p.specifications === "string") {
          try {
            specs = JSON.parse(p.specifications || "{}");
          } catch {
            specs = {};
          }
        } else if (p.specifications && typeof p.specifications === "object") {
          specs = p.specifications;
        }
        const basePrice = Number(p.selling_price || p.price || p.mrp || 0);
        const rawWholesale = Number(p.wholesale_price && Number(p.wholesale_price) > 0 ? p.wholesale_price : (specs.wholesale_price && Number(specs.wholesale_price) > 0 ? specs.wholesale_price : 0));
        const rawB2B = Number(p.b2b_price && Number(p.b2b_price) > 0 ? p.b2b_price : (specs.b2b_price && Number(specs.b2b_price) > 0 ? specs.b2b_price : 0));
        const wPrice = rawWholesale > 0 ? rawWholesale : basePrice;
        const bPrice = rawB2B > 0 ? rawB2B : basePrice;
        const taxPct = getEffectiveTaxRate(p);
        const discInfo = extractProductDiscount(p);
        const isTaxInclusive = p.is_tax_inclusive === true || p.tax_included === true || p.is_inclusive === true || (p.is_tax_inclusive !== false && p.tax_included !== false);

        const catNameVal = p.category?.name || p.category_name || (typeof p.category === "string" ? p.category : "") || "";
        const subCatNameVal = p.sub_category || p.subcategory || p.sub_category_name || "";

        const primaryUom = p.uom || p.uom_name || specs.primary_uom || specs.uom || p.unit || "Pcs";
        const secondaryUom = p.secondary_uom || specs.secondary_uom || "";
        const rawFactor = p.conversion_factor ?? specs.conversion_factor;
        const conversionFactor = Number(rawFactor) > 0 ? Number(rawFactor) : 1;

        return {
          id: p.id,
          name: p.name,
          brand: p.brand?.name || (typeof p.brand === "string" ? p.brand : "") || "",
          category: p.category_id || p.category?.id || catNameVal || "all",
          category_id: p.category_id || p.category?.id || null,
          category_name: catNameVal,
          sub_category: subCatNameVal,
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
          tax_rate: taxPct,
          tax: taxPct,
          is_tax_inclusive: isTaxInclusive,
          discount: discInfo.discount_value,
          discount_value: discInfo.discount_value,
          stock: p.on_hand_stock !== undefined && p.on_hand_stock !== null ? Number(p.on_hand_stock) : (p.stock !== undefined && p.stock !== null ? Number(p.stock) : (p.initial_stock !== undefined && p.initial_stock !== null ? Number(p.initial_stock) : 0)),
          on_hand_stock: p.on_hand_stock !== undefined && p.on_hand_stock !== null ? Number(p.on_hand_stock) : (p.stock !== undefined && p.stock !== null ? Number(p.stock) : (p.initial_stock !== undefined && p.initial_stock !== null ? Number(p.initial_stock) : 0)),
          reorderLevel: Number(p.reorder_level || 10),
          image: p.image_url ? resolveImageUrl(p.image_url) : null,
          aiScore: Math.floor(Math.random() * 30) + 70,
          isFastMoving: (p.on_hand_stock ?? p.stock ?? p.initial_stock ?? 0) > 50,
          uom: String(primaryUom),
          secondary_uom: String(secondaryUom),
          conversion_factor: conversionFactor,
        };
      });

      setProducts(mappedProds);
    } catch (err) {
      console.warn("Backend loading notice:", err);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [tenant?.id, (tenant as any)?.company_id, (tenant as any)?.raw?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleWorkspaceRefresh = () => {
      loadData();
    };
    window.addEventListener("workspace_changed", handleWorkspaceRefresh);
    window.addEventListener("company_changed", handleWorkspaceRefresh);
    window.addEventListener("inventory_updated", handleWorkspaceRefresh);
    window.addEventListener("pos_invoices_updated", handleWorkspaceRefresh);
    return () => {
      window.removeEventListener("workspace_changed", handleWorkspaceRefresh);
      window.removeEventListener("company_changed", handleWorkspaceRefresh);
      window.removeEventListener("inventory_updated", handleWorkspaceRefresh);
      window.removeEventListener("pos_invoices_updated", handleWorkspaceRefresh);
    };
  }, [loadData]);

  useEffect(() => {
    // Attempt to enter fullscreen
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => { });
      }
    } catch { }
  }, []);

  // Sync active session when switching back from other views
  useEffect(() => {
    if (currentView === 'billing') {
      posApi.getCurrentSession().then(sess => {
        setCurrentSession(sess);
      }).catch(err => {
        if (err?.status === 404) {
          setSessionModalOpen(true);
        }
      });
    }
  }, [currentView]);

  // Available Main Categories
  const parentCategories = useMemo(() => {
    const mainCats = categories.filter(c => !c.parent_id);
    return mainCats;
  }, [categories]);

  const currentSubCategories = useMemo(() => {
    if (activeCategory === "all") return [];
    return categories.filter(c => c.parent_id === activeCategory);
  }, [categories, activeCategory]);

  // Brands available under current Category / Sub-Category
  const availableBrands = useMemo(() => {
    const brandSet = new Set<string>();
    const activeTarget = activeSubCategory !== "all" ? activeSubCategory : activeCategory;
    products.forEach(p => {
      if (!p.brand) return;
      if (isProductInCategory(p, activeTarget, categories)) {
        brandSet.add(p.brand);
      }
    });
    return Array.from(brandSet).sort();
  }, [products, activeCategory, activeSubCategory, categories]);

  // Filter products by parent category, sub-category, brand, and search query
  const filteredProducts = useMemo(() => {
    const activeTarget = activeSubCategory !== "all" ? activeSubCategory : activeCategory;
    const list = products.filter(p => {
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

      // 3. Category & Sub-category Filter
      if (activeTarget !== "all") {
        if (!isProductInCategory(p, activeTarget, categories)) return false;
      }

      return true;
    });

    if (sortBy === "price_asc") {
      return [...list].sort((a, b) => (Number(a.sellingPrice || a.price || 0)) - (Number(b.sellingPrice || b.price || 0)));
    }
    if (sortBy === "price_desc") {
      return [...list].sort((a, b) => (Number(b.sellingPrice || b.price || 0)) - (Number(a.sellingPrice || a.price || 0)));
    }
    if (sortBy === "name") {
      return [...list].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    }
    return list;
  }, [products, searchQuery, activeCategory, activeSubCategory, activeBrand, categories, sortBy]);


  const totalPosPages = Math.ceil(filteredProducts.length / posPageSize) || 1;

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice((posPage - 1) * posPageSize, posPage * posPageSize);
  }, [filteredProducts, posPage, posPageSize]);

  // User authorization check for zero-stock sales
  const isZeroStockAuthorized = Boolean(
    user?.isTenantOwner ||
    user?.isPlatformAdmin ||
    (user as any)?.is_tenant_owner ||
    user?.assignedRoles?.some((r: string) => ["owner", "admin", "manager", "supervisor"].includes(r.toLowerCase())) ||
    user?.roles?.some((r: any) => ["owner", "admin", "manager", "supervisor"].includes(r.name?.toLowerCase())) ||
    ["owner", "admin", "manager", "supervisor"].includes(user?.defaultRole?.toLowerCase() || "") ||
    user?.permissions?.includes("manage:pos") ||
    user?.permissions?.includes("manage:inventory")
  );

  // Track acknowledged stock per item
  const [acknowledgedStockMap, setAcknowledgedStockMap] = useState<Record<string, number>>({});

  // Stock Alert Modal State
  const [stockAlertModal, setStockAlertModal] = useState<{
    isOpen: boolean;
    mode: "zero_stock" | "low_stock" | "excess_quantity";
    productName: string;
    sku: string;
    availableStock: number;
    requestedQuantity: number;
    reorderLevel: number;
    itemId: string;
    onAllow: () => void;
    onRemove: () => void;
    onAdjust?: (qty: number) => void;
  }>({
    isOpen: false,
    mode: "zero_stock",
    productName: "",
    sku: "",
    availableStock: 0,
    requestedQuantity: 1,
    reorderLevel: 5,
    itemId: "",
    onAllow: () => {},
    onRemove: () => {},
  });

  // Extract stock info reusing existing product fields
  const getProductStockInfo = (prod: any) => {
    if (!prod) return { availableStock: 0, reorderLevel: 5 };
    let availableStock: number | null = null;
    const candidates = [prod.on_hand_stock, prod.stock, prod.current_stock, prod.initial_stock, prod.qty, prod.quantity];
    for (const c of candidates) {
      if (c !== undefined && c !== null && c !== "") {
        const num = Number(c);
        if (!isNaN(num)) {
          availableStock = num;
          break;
        }
      }
    }
    if (availableStock === null) availableStock = 0;

    let reorderLevel = 5;
    const reorderCandidates = [prod.reorderLevel, prod.reorder_level, prod.min_stock_level, prod.safety_stock];
    for (const r of reorderCandidates) {
      if (r !== undefined && r !== null && r !== "") {
        const num = Number(r);
        if (!isNaN(num) && num > 0) {
          reorderLevel = num;
          break;
        }
      }
    }
    return { availableStock, reorderLevel };
  };

  // Central stock validation logic per requirements
  const checkStockAndExecute = (
    product: any,
    requestedQty: number,
    itemId: string,
    executeAction: () => void,
    removeAction: () => void,
    adjustAction?: (qty: number) => void
  ) => {
    const invSettings = loadStoredInvoiceSettings(currentTenantId, currentCompanyId);
    if (invSettings?.showStockAlerts === false) {
      executeAction();
      return;
    }
    const { availableStock, reorderLevel } = getProductStockInfo(product);
    const prevAck = acknowledgedStockMap[itemId] || 0;

    // Rule 1: Stock is zero (availableStock <= 0)
    if (availableStock <= 0) {
      if (prevAck >= requestedQty) {
        executeAction();
        return;
      }
      setStockAlertModal({
        isOpen: true,
        mode: "zero_stock",
        productName: product.name || "Product",
        sku: product.sku || "",
        availableStock: 0,
        requestedQuantity: requestedQty,
        reorderLevel,
        itemId,
        onAllow: () => {
          if (!isZeroStockAuthorized) {
            toast.error("Supervisor authorization required to permit zero-stock sales.");
            return;
          }
          setAcknowledgedStockMap((prev) => ({ ...prev, [itemId]: requestedQty }));
          setStockAlertModal((m) => ({ ...m, isOpen: false }));
          executeAction();
          toast.warning(`Zero-stock sale permitted for ${product.name}`);
        },
        onRemove: () => {
          setStockAlertModal((m) => ({ ...m, isOpen: false }));
          removeAction();
        },
      });
      return;
    }

    // Rule 4: Requested quantity exceeds available stock (stock > 0 and requestedQty > availableStock)
    if (requestedQty > availableStock) {
      if (prevAck >= requestedQty) {
        executeAction();
        return;
      }
      setStockAlertModal({
        isOpen: true,
        mode: "excess_quantity",
        productName: product.name || "Product",
        sku: product.sku || "",
        availableStock,
        requestedQuantity: requestedQty,
        reorderLevel,
        itemId,
        onAllow: () => {
          if (!isZeroStockAuthorized) {
            toast.error("Supervisor authorization required to permit quantity exceeding inventory stock.");
            return;
          }
          setAcknowledgedStockMap((prev) => ({ ...prev, [itemId]: requestedQty }));
          setStockAlertModal((m) => ({ ...m, isOpen: false }));
          executeAction();
        },
        onRemove: () => {
          setStockAlertModal((m) => ({ ...m, isOpen: false }));
          removeAction();
        },
        onAdjust: (qty) => {
          setStockAlertModal((m) => ({ ...m, isOpen: false }));
          if (adjustAction) {
            adjustAction(qty);
          }
        },
      });
      return;
    }

    // Rule 2: Stock is below 5 or <= reorder_level
    if (availableStock < 5 || (reorderLevel > 0 && availableStock <= reorderLevel)) {
      if (prevAck >= requestedQty) {
        executeAction();
        return;
      }
      setStockAlertModal({
        isOpen: true,
        mode: "low_stock",
        productName: product.name || "Product",
        sku: product.sku || "",
        availableStock,
        requestedQuantity: requestedQty,
        reorderLevel,
        itemId,
        onAllow: () => {
          setAcknowledgedStockMap((prev) => ({ ...prev, [itemId]: requestedQty }));
          setStockAlertModal((m) => ({ ...m, isOpen: false }));
          executeAction();
        },
        onRemove: () => {
          setStockAlertModal((m) => ({ ...m, isOpen: false }));
          removeAction();
        },
      });
      return;
    }

    // Rule 3: stock >= 5 and requestedQty <= availableStock -> proceed normally
    executeAction();
  };

  // Strict Cart Product Comparison (No fallbacks):
  // When scanning a barcode or when items have barcodes, match ONLY by exact barcode.
  const isSameCartProduct = useCallback((item: any, targetProd: any, queryBarcode?: string) => {
    const itBarcode = item?.barcode ? String(item.barcode).trim().toLowerCase() : "";
    const prodBarcode = (targetProd?.barcode || queryBarcode)
      ? String(targetProd?.barcode || queryBarcode).trim().toLowerCase()
      : "";

    if (queryBarcode || prodBarcode || itBarcode) {
      return Boolean(prodBarcode && itBarcode && prodBarcode === itBarcode);
    }

    return Boolean(targetProd?.id && item?.id && String(targetProd.id).trim() === String(item.id).trim());
  }, []);

  // Cart actions
  const addToCart = (product: any, e?: React.MouseEvent, scannedCode?: string) => {
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
      (product.category?.toLowerCase?.()?.includes("dairy")
        ? "0405"
        : product.category?.toLowerCase?.()?.includes("biscuit")
          ? "1905"
          : product.category?.toLowerCase?.()?.includes("shampoo")
            ? "3305"
            : "1905");
    const effectiveTax = getEffectiveTaxRate(product);
    const discInfo = extractProductDiscount(product);
    const isTaxInclusive = product.is_tax_inclusive === true || product.tax_included === true || product.is_inclusive === true || (product.is_tax_inclusive !== false && product.tax_included !== false);
    const specs = typeof product.specifications === "string" ? (function () { try { return JSON.parse(product.specifications); } catch { return {}; } })() : (product.specifications || {});
    const primaryUom = product.uom || product.uom_name || specs.uom || specs.primary_uom || "Pcs";
    const secondaryUom = product.secondary_uom || specs.secondary_uom || "";
    const conversionFactor = Math.max(1, Number(product.conversion_factor || specs.conversion_factor || 1));
    const salesMeasuringUnit = product.sales_measuring_unit || specs.sales_measuring_unit || "";

    const baseProdPrice = Number(product.sellingPrice ?? product.selling_price ?? product.price ?? product.mrp ?? 0);
    const rawBasePrice = Number(activeBatch?.selling_price) > 0 ? Number(activeBatch.selling_price) : (pricingMode === "B2B" && product.b2bPrice ? product.b2bPrice : pricingMode === "Wholesale" && product.wholesalePrice ? product.wholesalePrice : baseProdPrice);
    const rawBaseMrp = Number(activeBatch?.mrp) > 0 ? Number(activeBatch.mrp) : (Number(product.mrp) || rawBasePrice * 1.2);

    const priceIsPerSec = Boolean(
      secondaryUom &&
      conversionFactor > 1 &&
      salesMeasuringUnit &&
      (
        salesMeasuringUnit.toLowerCase() === secondaryUom.toLowerCase() ||
        (salesMeasuringUnit.toLowerCase() !== String(primaryUom).toLowerCase() && (
          secondaryUom.toLowerCase().includes(salesMeasuringUnit.toLowerCase()) ||
          salesMeasuringUnit.toLowerCase().includes(secondaryUom.toLowerCase())
        ))
      )
    );

    const primarySellingPrice = priceIsPerSec ? Number((rawBasePrice * conversionFactor).toFixed(2)) : rawBasePrice;
    const secondarySellingPrice = priceIsPerSec ? rawBasePrice : Number((rawBasePrice / conversionFactor).toFixed(2));
    const primaryMrpVal = priceIsPerSec ? Number((rawBaseMrp * conversionFactor).toFixed(2)) : rawBaseMrp;
    const secondaryMrpVal = priceIsPerSec ? rawBaseMrp : (rawBaseMrp > 0 ? Number((rawBaseMrp / conversionFactor).toFixed(2)) : 0);

    const initialUom = priceIsPerSec && secondaryUom ? secondaryUom : primaryUom;
    const initialPrice = initialUom === secondaryUom ? secondarySellingPrice : primarySellingPrice;
    const initialMrp = initialUom === secondaryUom ? secondaryMrpVal : primaryMrpVal;

    const resolvedBarcode = String(product.barcode || scannedCode || "").trim();
    const resolvedBrand = product.brand?.name || product.brand_name || (typeof product.brand === "string" ? product.brand : "") || "";

    const enrichedProduct = {
      ...product,
      id: product.id || (resolvedBarcode ? `scanned-${resolvedBarcode}` : Math.random().toString(36).substr(2, 9)),
      barcode: resolvedBarcode,
      sku: product.sku || "",
      brand: resolvedBrand,
      uom: primaryUom,
      secondary_uom: secondaryUom,
      conversion_factor: conversionFactor,
      selected_uom: initialUom,
      base_selling_price: primarySellingPrice,
      base_mrp: primaryMrpVal,
      batch_number: activeBatch?.batch_number || product.batch_number || "",
      batch_id: activeBatch?.id || null,
      expiry_date: activeBatch?.expiry_date ? String(activeBatch.expiry_date).slice(0, 10) : product.expiry_date || null,
      mrp: initialMrp,
      sellingPrice: initialPrice,
      price: initialPrice,
      hsn_code: effectiveHsn,
      tax_percent: effectiveTax,
      tax_rate: effectiveTax,
      tax: effectiveTax,
      is_tax_inclusive: isTaxInclusive,
      discount: discInfo.discount_value,
      discount_value: discInfo.discount_value,
      discount_type: discInfo.discount_type,
    };

    const existing = cart.find((item) => isSameCartProduct(item, enrichedProduct, scannedCode));
    const targetQty = (existing ? existing.qty : 0) + 1;
    const itemId = String(existing?.id || enrichedProduct.id);

    const executeAdd = () => {
      setCart((prev) => {
        const foundIdx = prev.findIndex((item) => isSameCartProduct(item, enrichedProduct, scannedCode));
        if (foundIdx >= 0) {
          const existingItem = prev[foundIdx];
          const newQty = existingItem.qty + 1;
          const next = [...prev];
          next[foundIdx] = {
            ...existingItem,
            sku: existingItem.sku || enrichedProduct.sku || "",
            barcode: existingItem.barcode || resolvedBarcode,
            brand: existingItem.brand || resolvedBrand,
            qty: newQty,
          };
          if (scannedCode) {
            toast.success(`Scanned: ${enrichedProduct.name}${enrichedProduct.sku ? ` (${enrichedProduct.sku})` : ""} — Quantity incremented to ${newQty}`);
          }
          return next;
        }
        if (scannedCode) {
          toast.success(`Scanned: Added ${enrichedProduct.name}${enrichedProduct.sku ? ` (${enrichedProduct.sku})` : ""} (Qty: 1)`);
        }
        return [...prev, { ...enrichedProduct, qty: 1 }];
      });
    };

    checkStockAndExecute(
      product,
      targetQty,
      itemId,
      executeAdd,
      () => {
        if (existing) {
          removeItem(existing.id);
        }
      },
      (adjQty) => {
        setCart((prev) =>
          prev.map((item) =>
            isSameCartProduct(item, enrichedProduct, scannedCode) ? { ...item, qty: adjQty } : item
          )
        );
      }
    );
  };

  const switchCartItemUom = (itemId: string, newUom: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const factor = Number(item.conversion_factor) > 1 ? Number(item.conversion_factor) : 1;
          const basePrice = Number(item.base_selling_price ?? item.sellingPrice ?? item.price) || 0;
          const baseMrp = Number(item.base_mrp ?? item.mrp) || 0;

          if (newUom === item.secondary_uom && factor > 1) {
            const secPrice = Number((basePrice / factor).toFixed(2));
            const secMrp = baseMrp > 0 ? Number((baseMrp / factor).toFixed(2)) : 0;
            return {
              ...item,
              selected_uom: item.secondary_uom,
              sellingPrice: secPrice,
              price: secPrice,
              mrp: secMrp,
              subtotal: secPrice * (item.qty || 1),
            };
          } else {
            return {
              ...item,
              selected_uom: item.uom,
              sellingPrice: basePrice,
              price: basePrice,
              mrp: baseMrp,
              subtotal: basePrice * (item.qty || 1),
            };
          }
        }
        return item;
      })
    );
  };

  const handleBatchSelectForCartItem = (batch: any) => {
    if (!batchModalCartItem) return;
    setCart((prev) =>
      prev.map((it) => {
        if (it.id !== batchModalCartItem.id) return it;

        let updatedSellingPrice = it.sellingPrice;
        let updatedMrp = it.mrp;
        const isLoose =
          it.selected_uom &&
          it.secondary_uom &&
          it.selected_uom === it.secondary_uom &&
          it.conversion_factor > 1;

        if (batch.selling_price && Number(batch.selling_price) > 0) {
          const baseBatchSp = Number(batch.selling_price);
          updatedSellingPrice = isLoose
            ? Number((baseBatchSp / it.conversion_factor).toFixed(2))
            : baseBatchSp;
        }

        if (batch.mrp && Number(batch.mrp) > 0) {
          const baseBatchMrp = Number(batch.mrp);
          updatedMrp = isLoose
            ? Number((baseBatchMrp / it.conversion_factor).toFixed(2))
            : baseBatchMrp;
        }

        return {
          ...it,
          batch_id: batch.id,
          batch_number: batch.batch_number,
          expiry_date: batch.expiry_date,
          mfg_date: batch.mfg_date,
          warehouse_id: batch.warehouse_id,
          warehouse_name: batch.warehouse_name,
          sellingPrice: updatedSellingPrice,
          base_selling_price: batch.selling_price
            ? Number(batch.selling_price)
            : it.base_selling_price,
          mrp: updatedMrp,
          base_mrp: batch.mrp ? Number(batch.mrp) : it.base_mrp,
        };
      })
    );
    setBatchModalCartItem(null);
    toast.success(`Batch #${batch.batch_number} assigned to cart item.`);
  };

  const updateQty = (id: string, delta: number) => {
    const item = cart.find((it) => it.id === id);
    if (!item) return;

    if (delta <= 0) {
      if (item.qty <= 1) {
        removeItem(id);
      } else {
        setCart((prev) =>
          prev.map((it) => (it.id === id ? { ...it, qty: it.qty + delta } : it))
        );
      }
      return;
    }

    const targetQty = item.qty + delta;
    const matchedProduct = products.find((p) => p.id === item.id) || item;

    checkStockAndExecute(
      matchedProduct,
      targetQty,
      id,
      () => {
        setCart((prev) =>
          prev.map((it) => (it.id === id ? { ...it, qty: targetQty } : it))
        );
      },
      () => {
        removeItem(id);
      },
      (adjQty) => {
        setCart((prev) =>
          prev.map((it) => (it.id === id ? { ...it, qty: adjQty } : it))
        );
      }
    );
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(item => item.id !== id));

  const openCartItemEditModal = (item: any) => {
    setCartEditItem(item);
    const rawPrice = item.sellingPrice || item.selling_price || item.price || 0;
    setEditSellingPrice(rawPrice > 0 ? rawPrice.toString() : "");
    setEditMrp((item.mrp || 0) > 0 ? item.mrp.toString() : "");
    setEditTaxInclusive(item.is_tax_inclusive !== false);

    // Fetch and pre-fill actual discount from cart item or master product database (strictly by ID or exact barcode, never shared SKU)
    const masterProduct = products.find(
      (p) =>
        p.id === item.id ||
        (p.barcode && item.barcode && String(p.barcode).trim().toLowerCase() === String(item.barcode).trim().toLowerCase())
    );
    const discInfo = (item.discount_value !== undefined && item.discount_value !== null && Number(item.discount_value) > 0)
      ? { discount_value: Number(item.discount_value), discount_type: (item.discount_type as "percent" | "amount") || "amount" }
      : (item.discount !== undefined && item.discount !== null && Number(item.discount) > 0)
        ? { discount_value: Number(item.discount), discount_type: (item.discount_type as "percent" | "amount") || "amount" }
        : extractProductDiscount(masterProduct || item);

    setEditDiscountType(discInfo.discount_type === "percent" ? "percent" : "amount");
    setEditDiscountValue(discInfo.discount_value > 0 ? discInfo.discount_value.toString() : "");
    setEditUpdateMaster(false);
  };

  const handleSaveCartItemEdit = async () => {
    if (!cartEditItem) return;
    const rawPrice = parseFloat(editSellingPrice) || 0;
    const rawMrp = parseFloat(editMrp) || 0;

    // Calculate effective discount
    let discAmt = 0;
    const discVal = parseFloat(editDiscountValue) || 0;
    if (editDiscountType === "percent") {
      discAmt = (rawPrice * discVal) / 100;
    } else {
      discAmt = discVal;
    }

    setIsSavingEditItem(true);
    try {
      // 1. Update cart item
      setCart(prev => prev.map(it => {
        if (it.id === cartEditItem.id) {
          return {
            ...it,
            sellingPrice: rawPrice,
            selling_price: rawPrice,
            price: rawPrice,
            mrp: rawMrp,
            is_tax_inclusive: editTaxInclusive,
            discount: discAmt,
            discount_value: discVal,
            discount_type: editDiscountType,
          };
        }
        return it;
      }));

      // 2. If requested, sync back to master product database
      if (editUpdateMaster) {
        try {
          await posApi.updateProduct(cartEditItem.id, {
            selling_price: rawPrice,
            mrp: rawMrp,
            is_tax_inclusive: editTaxInclusive,
            discount_value: discVal,
            discount_type: editDiscountType,
          });
          setProducts(prev => prev.map(p => {
            if (p.id === cartEditItem.id) {
              return {
                ...p,
                sellingPrice: rawPrice,
                selling_price: rawPrice,
                mrp: rawMrp,
                is_tax_inclusive: editTaxInclusive,
                discount: discAmt,
                discount_value: discVal,
                discount_type: editDiscountType,
              };
            }
            return p;
          }));
          toast.success("Updated in cart and saved to product database!");
        } catch (dbErr: any) {
          console.error("Failed to update master product:", dbErr);
          toast.warning("Updated in cart, but could not update product master.");
        }
      } else {
        toast.success("Cart item pricing updated!");
      }

      setCartEditItem(null);
    } finally {
      setIsSavingEditItem(false);
    }
  };

  const applyDiscount = () => {
    if (!discountModalItem) return;
    const val = Number(discountInput) || 0;
    setCart(prev => prev.map(item => {
      if (item.id === discountModalItem.id) {
        return {
          ...item,
          discount: val,
          discount_value: val,
          discount_type: "amount",
        };
      }
      return item;
    }));
    setDiscountModalItem(null);
    setDiscountInput("");
  };

  const clearCart = () => {
    setCart([]);
    setFreeItems([]);
  };

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
    const specs = typeof item.specifications === "string" ? (function () { try { return JSON.parse(item.specifications); } catch { return {}; } })() : (item.specifications || {});
    const basePrice = Number(item.base_selling_price ?? item.sellingPrice ?? item.selling_price ?? item.price ?? item.mrp ?? 0);
    const rawWholesale = Number(item.wholesalePrice || item.wholesale_price || specs.wholesale_price || 0);
    const rawB2B = Number(item.b2bPrice || item.b2b_price || specs.b2b_price || 0);
    const wholesalePrice = rawWholesale > 0 ? rawWholesale : basePrice;
    const b2bPrice = rawB2B > 0 ? rawB2B : basePrice;

    let primaryUnitPrice = basePrice;
    let isTierApplied = false;
    let tierName = "Retail";

    if (mode === "B2B") {
      primaryUnitPrice = b2bPrice;
      isTierApplied = true;
      tierName = "B2B";
    } else if (mode === "Wholesale") {
      primaryUnitPrice = wholesalePrice;
      isTierApplied = true;
      tierName = "Wholesale";
    } else {
      const isWholesaleCustomer = selectedCustomer?.tier?.toLowerCase().includes("wholesale") || selectedCustomer?.tier?.toLowerCase().includes("b2b");
      if (isWholesaleCustomer) {
        primaryUnitPrice = wholesalePrice;
        isTierApplied = true;
        tierName = "Wholesale";
      }
    }

    const factor = Number(item.conversion_factor) > 1 ? Number(item.conversion_factor) : 1;
    let unitPrice = primaryUnitPrice;
    if (item.selected_uom === item.secondary_uom && factor > 1) {
      unitPrice = Number((primaryUnitPrice / factor).toFixed(2));
    }

    return { unitPrice, primaryUnitPrice, isWholesale: isTierApplied, tierName, basePrice, wholesalePrice, b2bPrice };
  };

  const handlePricingModeChange = (mode: "Retail" | "Wholesale" | "B2B") => {
    setPricingMode(mode);
    setCart((prevCart) =>
      prevCart.map((item) => {
        const { unitPrice, primaryUnitPrice } = getItemEffectivePrice(item, item.qty, mode);
        return {
          ...item,
          base_selling_price: primaryUnitPrice,
          sellingPrice: unitPrice,
          price: unitPrice,
          subtotal: unitPrice * item.qty
        };
      })
    );
    toast.success(`Active Pricing Tier switched to ${mode} Tier`);
  };

  const handleProcessBarcodeScan = useCallback(async (scannedCode: string) => {
    const queryCode = (scannedCode || "").trim();
    if (!queryCode) return;

    const cleanQuery = queryCode.toLowerCase();

    // 1. Exact barcode lookup in local tenant inventory product list (no SKU/ID fallback, no RAG search)
    let product = products.find(
      (p) => p.barcode && String(p.barcode).trim().toLowerCase() === cleanQuery
    );

    // 2. If not in memory yet, query strictly the tenant's Inventory DB (inventoryOnly=true, never RAG/Web/Master Catalog)
    if (!product) {
      try {
        const res = await posApi.lookupBarcode(queryCode, true);
        if (
          res &&
          res.success &&
          res.product &&
          res.product.name &&
          (!res.product.source || res.product.source === "DATABASE") &&
          String(res.product.barcode || "").trim().toLowerCase() === cleanQuery
        ) {
          const apiProd = res.product;
          const localMatch = products.find(
            (p) =>
              apiProd.barcode &&
              p.barcode &&
              String(p.barcode).trim().toLowerCase() === String(apiProd.barcode).trim().toLowerCase()
          );
          product = localMatch || {
            ...apiProd,
            id: apiProd.id,
            name: apiProd.name,
            brand: apiProd.brand?.name || apiProd.brand_name || (typeof apiProd.brand === "string" ? apiProd.brand : "") || "",
            sku: apiProd.sku || "",
            barcode: apiProd.barcode || queryCode,
            sellingPrice: Number(apiProd.selling_price ?? apiProd.sellingPrice ?? apiProd.price ?? apiProd.mrp ?? 0),
            mrp: Number(apiProd.mrp ?? apiProd.selling_price ?? apiProd.sellingPrice ?? 0),
            stock: Number(apiProd.on_hand_stock ?? apiProd.stock ?? apiProd.initial_stock ?? 0),
            reorderLevel: Number(apiProd.reorder_level ?? 5),
          };
        }
      } catch (err: any) {
        console.warn("Inventory barcode search error in POS Terminal:", err);
      }
    }

    if (!product) {
      toast.error(`Barcode "${queryCode}" not found in inventory.`);
      return;
    }

    addToCart(product, undefined, queryCode);
    setSearchQuery("");
  }, [products, cart, batches, pricingMode, acknowledgedStockMap, isZeroStockAuthorized]);

  // Universal hardware barcode scanner gun listener for POS Terminal
  useHardwareBarcodeScanner({
    onScan: handleProcessBarcodeScan,
    enabled: true,
  });

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

  // Cart Math with Dynamic Before-Tax & After-Tax Discount and GST Inclusive/Exclusive Support
  const itemTaxBreakdown = useMemo(() => {
    return cart.map((item) => {
      const { unitPrice, isWholesale, tierName } = getItemEffectivePrice(item);
      const taxRate = getEffectiveTaxRate(item);
      const isIncl = item.is_tax_inclusive === true;
      const qty = Number(item.qty) || 1;
      const lineGross = unitPrice * qty;

      const discVal = Number(item.discount_value !== undefined ? item.discount_value : (item.discount || 0));
      const lineDisc = item.discount_type === "percent"
        ? lineGross * (discVal / 100)
        : Math.min(discVal * qty, lineGross);

      const effectiveGross = Math.max(0, lineGross - lineDisc);
      let lineTaxable = 0;
      let lineTax = 0;

      if (isIncl) {
        // Tax Inclusive: Unit price already includes GST
        lineTaxable = taxRate > 0 ? effectiveGross / (1 + taxRate / 100) : effectiveGross;
        lineTax = effectiveGross - lineTaxable;
      } else {
        // Tax Exclusive (Default): GST is added ON TOP of unit price
        lineTaxable = effectiveGross;
        lineTax = (effectiveGross * taxRate) / 100;
      }

      const baseUnitPrice = isIncl && taxRate > 0 ? unitPrice / (1 + taxRate / 100) : unitPrice;
      const unitGst = isIncl && taxRate > 0 ? unitPrice - baseUnitPrice : baseUnitPrice * (taxRate / 100);
      const sellingUnitPriceIncl = isIncl ? unitPrice : baseUnitPrice + unitGst;
      const finalLineTotal = isIncl ? effectiveGross : (lineTaxable + lineTax);

      return {
        item,
        unitPrice,
        isWholesale,
        tierName,
        taxRate,
        isIncl,
        baseUnitPrice,
        unitGst,
        sellingUnitPriceIncl,
        lineGross,
        lineDisc,
        taxableLine: lineTaxable,
        taxLine: lineTax,
        finalLineTotal,
      };
    });
  }, [cart, pricingMode, selectedCustomer]);

  const subtotal = itemTaxBreakdown.reduce((sum, b) => sum + b.lineGross, 0);
  const totalBaseTaxable = itemTaxBreakdown.reduce((sum, b) => sum + b.taxableLine, 0);
  const itemDiscounts = itemTaxBreakdown.reduce((sum, b) => sum + b.lineDisc, 0);
  const rawItemTaxTotal = itemTaxBreakdown.reduce((sum, b) => sum + b.taxLine, 0);

  // 1. Before-Tax Discount
  let beforeTaxDiscount = 0;
  if (discountMode === "before_tax" && cartDiscountValue > 0) {
    beforeTaxDiscount = cartDiscountType === "percent"
      ? totalBaseTaxable * (cartDiscountValue / 100)
      : Math.min(cartDiscountValue, totalBaseTaxable);
  }

  const taxableAmount = Math.max(0, totalBaseTaxable - beforeTaxDiscount);

  // 2. Tax Calculation on Taxable Value
  const taxRatio = totalBaseTaxable > 0 ? (taxableAmount / totalBaseTaxable) : 1;
  const tax = rawItemTaxTotal * taxRatio;

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
    if (isProcessingCheckoutRef.current || isCheckingOut) return;
    if (cart.length === 0) {
      toast.error("Cart is empty.");
      return;
    }

    const invSettings = loadStoredInvoiceSettings(currentTenantId, currentCompanyId);
    if (invSettings?.showStockAlerts !== false) {
      // Validate stock for all items before proceeding to payment
      for (const item of cart) {
        const matched = products.find((p) => p.id === item.id) || item;
        const { availableStock, reorderLevel } = getProductStockInfo(matched);
        const reqQty = item.qty || 1;
        const isAck = (acknowledgedStockMap[item.id] || 0) >= reqQty;
        if (!isAck) {
          if (availableStock <= 0) {
            setStockAlertModal({
              isOpen: true,
              mode: "zero_stock",
              productName: item.name || matched.name,
              sku: item.sku || matched.sku || "",
              availableStock: 0,
              requestedQuantity: reqQty,
              reorderLevel,
              itemId: item.id,
              onAllow: () => {
                if (!isZeroStockAuthorized) {
                  toast.error("Supervisor authorization required to permit zero-stock sales.");
                  return;
                }
                setAcknowledgedStockMap((prev) => ({ ...prev, [item.id]: reqQty }));
                setStockAlertModal((m) => ({ ...m, isOpen: false }));
                toast.warning(`Zero-stock sale permitted for ${item.name}`);
              },
              onRemove: () => {
                setStockAlertModal((m) => ({ ...m, isOpen: false }));
                removeItem(item.id);
              },
            });
            return;
          } else if (reqQty > availableStock) {
            setStockAlertModal({
              isOpen: true,
              mode: "excess_quantity",
              productName: item.name || matched.name,
              sku: item.sku || matched.sku || "",
              availableStock,
              requestedQuantity: reqQty,
              reorderLevel,
              itemId: item.id,
              onAllow: () => {
                if (!isZeroStockAuthorized) {
                  toast.error("Supervisor authorization required to permit quantity exceeding inventory stock.");
                  return;
                }
                setAcknowledgedStockMap((prev) => ({ ...prev, [item.id]: reqQty }));
                setStockAlertModal((m) => ({ ...m, isOpen: false }));
              },
              onRemove: () => {
                setStockAlertModal((m) => ({ ...m, isOpen: false }));
                removeItem(item.id);
              },
              onAdjust: (adjQty) => {
                setStockAlertModal((m) => ({ ...m, isOpen: false }));
                setCart((prev) => prev.map((it) => (it.id === item.id ? { ...it, qty: adjQty } : it)));
              },
            });
            return;
          } else if (availableStock < 5 || (reorderLevel > 0 && availableStock <= reorderLevel)) {
            setStockAlertModal({
              isOpen: true,
              mode: "low_stock",
              productName: item.name || matched.name,
              sku: item.sku || matched.sku || "",
              availableStock,
              requestedQuantity: reqQty,
              reorderLevel,
              itemId: item.id,
              onAllow: () => {
                setAcknowledgedStockMap((prev) => ({ ...prev, [item.id]: reqQty }));
                setStockAlertModal((m) => ({ ...m, isOpen: false }));
              },
              onRemove: () => {
                setStockAlertModal((m) => ({ ...m, isOpen: false }));
                removeItem(item.id);
              },
            });
            return;
          }
        }
      }
    }
    if (paymentMethod === 'Split') {
      setSplitPaymentModalOpen(true);
      return;
    }
    if (paymentMethod === 'Partial' || paymentMethod === 'Partial Pay') {
      if (isWalkInParty(selectedCustomer)) {
        toast.error("Walk-in customers require full payment. Ledger / Khata is not available.");
        setPaymentMethod("Cash");
        return;
      }
      setPartialPaidAmount(total > 0 ? (total * 0.5).toFixed(2) : '');
      setPartialPaymentMode('Cash');
      setPartialPaymentModalOpen(true);
      return;
    }
    if (paymentMethod === 'Cash') {
      setCashTendered(total.toString());
      setCashModalOpen(true);
      return;
    }
    if (paymentMethod === 'Credit' || paymentMethod === 'Pay Later') {
      if (isWalkInParty(selectedCustomer)) {
        toast.error("Walk-in customers require full payment. Pay Later / ledger credit is not available.");
        setPaymentMethod("Cash");
        return;
      }
      await executeCheckout([{ payment_method: 'credit', amount: total }]);
      return;
    }
    if (paymentMethod === 'Wallet') {
      if (isWalkInParty(selectedCustomer)) {
        toast.error("Walk-in customers cannot use Wallet. Full spot payment is required.");
        setPaymentMethod("Cash");
        return;
      }
      if ((selectedCustomer.wallet || 0) < total) {
        alert(`Insufficient Wallet Balance (${formatCurrency(selectedCustomer.wallet || 0)} available).`);
        return;
      }
      await executeCheckout([{ payment_method: "wallet", amount: total }]);
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
    if (isProcessingCheckoutRef.current) {
      console.warn("[POS] Checkout already in progress, blocking duplicate execution.");
      return;
    }
    if (cart.length === 0) {
      console.warn("[POS] Cart is empty, blocking checkout.");
      return;
    }
    if (!currentSession) {
      alert("Please open a register first.");
      return;
    }

    const walkInCheckout = isWalkInParty(selectedCustomer);
    const creditLike = (method?: string) => {
      const m = String(method || "").toLowerCase();
      return m === "credit" || m === "pay later" || m === "pay_later" || m === "wallet";
    };
    const paidNow = paymentsArray
      .filter((p) => !creditLike(p.payment_method))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    if (walkInCheckout && (paymentsArray.some((p) => creditLike(p.payment_method)) || paidNow < total - 0.01)) {
      toast.error("Walk-in customers require full payment. Pay Later, wallet, and ledger credit are not available.");
      return;
    }

    isProcessingCheckoutRef.current = true;
    setIsCheckingOut(true);

    try {
      const resolvedCart = await resolveCartProvisionalItems(cart);
      const selectedEmpObj = salesEmployees.find(e => e.full_name === salesExecutive || e.id === salesExecutive);
      const selectedEmpId = (selectedEmpObj?.id && isValidUUID(selectedEmpObj.id) && !selectedEmpObj?.is_fallback) ? selectedEmpObj.id : undefined;

      const storedSettings = loadStoredInvoiceSettings(currentTenantId, currentCompanyId);
      const activeGst = getActiveBillingGst(currentTenantId);
      const recPrefix = storedSettings.receiptPrefix || activeGst?.receipt_prefix || "REC-";
      const rawConfiguredSeq = Number(storedSettings.receiptSequenceNumber || activeGst?.receipt_sequence || 1);
      const recPadding = Number(storedSettings.receiptPadding || activeGst?.receipt_padding || 5);

      // Scan local history for highest sequence to prevent duplicate receipt numbers
      let highestLocalSeq = 0;
      try {
        const prevList = JSON.parse(localStorage.getItem(posStorageKey) || "[]");
        if (Array.isArray(prevList)) {
          prevList.forEach((inv: any) => {
            const numStr = String(inv.invoice_number || "").trim();
            if (numStr && numStr.startsWith(recPrefix)) {
              const digits = numStr.slice(recPrefix.length).match(/\d+$/);
              if (digits) {
                const val = parseInt(digits[0], 10);
                if (!isNaN(val) && val > 0 && val < 50000) {
                  highestLocalSeq = Math.max(highestLocalSeq, val);
                }
              }
            }
          });
        }
      } catch { }

      const recSeq = Math.max(rawConfiguredSeq, highestLocalSeq > 0 ? highestLocalSeq + 1 : rawConfiguredSeq);
      const targetReceiptNo = `${recPrefix}${String(recSeq).padStart(recPadding, "0")}`;

      const freePrintLines = (freeItems || []).filter((fi) => Number(fi.quantity) > 0).map((fi) => ({
        product_id: fi.product_id,
        name: fi.product_name,
        product_name: fi.product_name,
        quantity: fi.quantity,
        qty: fi.quantity,
        unit_price: 0,
        price: 0,
        tax_rate: 0,
        tax_percent: 0,
        tax_amount: 0,
        subtotal: 0,
        total_amount: 0,
        is_free: true,
        custom_note: fi.rule_name ? `FREE ITEM (${fi.rule_name})` : "FREE ITEM",
        description: fi.rule_name ? `FREE ITEM (${fi.rule_name})` : "FREE ITEM",
      }));

      const payload = {
        subtotal: taxableAmount > 0 ? taxableAmount : subtotal,
        gross_subtotal: subtotal,
        taxable_value: taxableAmount,
        tax_amount: tax,
        discount_amount: totalDiscount,
        total_discount: totalDiscount,
        discount_value: cartDiscountValue,
        discount_type: cartDiscountType,
        invoice_discount_value: cartDiscountValue,
        invoice_discount_type: cartDiscountType,
        invoice_discount_mode: discountMode,
        total_amount: total,
        session_id: currentSession.id,
        customer_id: (!isWalkInParty(selectedCustomer) && selectedCustomer?.id && isValidUUID(selectedCustomer.id)) ? selectedCustomer.id : null,
        status: "completed",
        sales_rep_id: selectedEmpId,
        sales_rep_name: salesExecutive || defaultSalesExecName,
        sales_points_earned: Math.floor(total / 100),
        receipt_number: targetReceiptNo,
        receipt_prefix: recPrefix,
        receipt_sequence: recSeq,
        items: resolvedCart.map(item => {
          const { unitPrice } = getItemEffectivePrice(item);
          const taxRate = getEffectiveTaxRate(item);
          const isIncl = item.is_tax_inclusive === true;
          const discVal = Number(item.discount_value !== undefined ? item.discount_value : (item.discount || 0));
          const lineGross = unitPrice * item.qty;
          const lineDisc = item.discount_type === "percent"
            ? lineGross * (discVal / 100)
            : Math.min(discVal * item.qty, lineGross);
          const effectiveGross = Math.max(0, lineGross - lineDisc);
          const lineTaxable = isIncl && taxRate > 0 ? effectiveGross / (1 + taxRate / 100) : effectiveGross;
          const lineTax = isIncl ? effectiveGross - lineTaxable : (lineTaxable * taxRate / 100);

          return {
            product_id: item.id,
            quantity: item.qty,
            unit_price: unitPrice,
            discount: lineDisc / item.qty,
            discount_type: item.discount_type || "amount",
            discount_value: discVal,
            subtotal: lineTaxable,
            tax_rate: taxRate,
            tax_amount: lineTax,
            total_amount: isIncl ? effectiveGross : (lineTaxable + lineTax),
            batch_id: item.batch_id || undefined,
            batch_number: item.batch_number || undefined,
            expiry_date: item.expiry_date || undefined,
            warehouse_id: item.warehouse_id || undefined,
            warehouse_name: item.warehouse_name || undefined,
          };
        }).concat(
          (freePrintLines
            .filter((fi) => fi.product_id && isValidUUID(fi.product_id))
            .map((fi) => ({
              product_id: fi.product_id,
              quantity: fi.quantity,
              unit_price: 0,
              discount: 0,
              discount_type: "amount",
              discount_value: 0,
              subtotal: 0,
              tax_rate: 0,
              tax_amount: 0,
              total_amount: 0,
              notes: fi.custom_note,
              batch_id: undefined,
              batch_number: undefined,
              expiry_date: undefined,
              warehouse_id: undefined,
              warehouse_name: undefined,
            })) as any)
        ),
        payments: paymentsArray
      };

      // Call Backend API
      const response = await posApi.checkout(payload);
      console.log("Checkout Success! Receipt:", response.receipt_number);

      const actualPaid = paymentsArray
        .filter(p => p.payment_method?.toLowerCase() !== 'credit')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const balanceDue = Number(Math.max(0, total - actualPaid).toFixed(2));
      const isCreditOnly = actualPaid <= 0.01;
      const isPartial = actualPaid > 0.01 && actualPaid < total - 0.01;
      const paymentStatusDisplay = isCreditOnly ? 'UNPAID' : (isPartial ? 'PARTIALLY PAID' : 'PAID');
      const paymentMethodSummary = paymentsArray.map(p => `${p.payment_method?.toUpperCase()} (₹${Number(p.amount).toFixed(2)})`).join(', ') || 'Cash';

      const billData = {
        invoice_number: response.receipt_number || `REC-${Date.now().toString().slice(-6)}`,
        date: new Date(),
        customerName: selectedCustomer?.name || 'Walk-in Guest',
        customerPhone: selectedCustomer?.phone || '',
        customerAddress: formatPartyAddress(selectedCustomer) || (selectedCustomer as any)?.address || '',
        customerBillingAddress: formatPartyAddress(selectedCustomer) || (selectedCustomer as any)?.address || '',
        customerShippingAddress: formatPartyAddress(selectedCustomer) || (selectedCustomer as any)?.shipping_address || (selectedCustomer as any)?.address || '',
        items: resolvedCart.map(item => {
          const { unitPrice } = getItemEffectivePrice(item);
          const taxRate = getEffectiveTaxRate(item);
          const isIncl = item.is_tax_inclusive === true;
          const discVal = Number(item.discount_value !== undefined ? item.discount_value : (item.discount || 0));
          const lineGross = unitPrice * item.qty;
          const lineDisc = item.discount_type === "percent"
            ? lineGross * (discVal / 100)
            : Math.min(discVal * item.qty, lineGross);
          const effectiveGross = Math.max(0, lineGross - lineDisc);
          const lineTaxable = isIncl && taxRate > 0 ? effectiveGross / (1 + taxRate / 100) : effectiveGross;
          const lineTax = isIncl ? effectiveGross - lineTaxable : (lineTaxable * taxRate / 100);

          return {
            product_id: item.id,
            name: item.name,
            product_name: item.name,
            sku: item.sku,
            hsn_code: item.hsn_code,
            quantity: item.qty,
            unit_price: unitPrice,
            price: unitPrice,
            discount: lineDisc / item.qty,
            discount_type: item.discount_type || "amount",
            discount_value: discVal,
            tax_rate: taxRate,
            tax_percent: taxRate,
            is_tax_inclusive: isIncl,
            subtotal: lineTaxable,
            tax_amount: lineTax,
            total_amount: isIncl ? effectiveGross : (lineTaxable + lineTax),
            batch_id: item.batch_id || undefined,
            batch_number: item.batch_number || undefined,
            expiry_date: item.expiry_date || undefined,
            warehouse_id: item.warehouse_id || undefined,
            warehouse_name: item.warehouse_name || undefined,
            mrp: item.mrp,
          };
        }).concat(freePrintLines as any[]),
        subtotal: taxableAmount > 0 ? taxableAmount : subtotal,
        gross_subtotal: subtotal,
        discount_amount: totalDiscount,
        tax_amount: tax,
        grand_total: total,
        paid_amount: actualPaid,
        balance_due: balanceDue,
        payment_method: paymentMethodSummary,
        payment_status: paymentStatusDisplay,
      };

      setCompletedCheckoutBill(billData);

      // Sync Customer Wallet balance if paid via Wallet
      const isWalletPayment = paymentsArray.some(p => p.payment_method?.toLowerCase() === 'wallet');
      if (isWalletPayment && selectedCustomer && !isWalkInParty(selectedCustomer)) {
        const walletPaidAmt = paymentsArray.find(p => p.payment_method?.toLowerCase() === 'wallet')?.amount || total;
        const newBal = Math.max(0, customerWalletBalance - walletPaidAmt);
        setCustomerWalletBalance(newBal);
        setSelectedCustomer((prev: any) => prev ? { ...prev, wallet: newBal } : prev);
        crmWalletApi.getBalance(selectedCustomer.id).then((res: any) => {
          if (res && res.balance !== undefined) {
            setCustomerWalletBalance(Number(res.balance));
            setSelectedCustomer((prev: any) => prev ? { ...prev, wallet: Number(res.balance) } : prev);
          }
        }).catch(() => { });
      }

      let terminalInvoiceRecord: any = null;
      let thermalReceiptHtml: string | null = null;
      // Persist to pos_saved_invoices for Invoices History sync
      try {
        const finalInvoiceNumber = (response as any)?.invoice_number || response.receipt_number || billData.invoice_number;
        terminalInvoiceRecord = {
          id: response.id || `rec-${Date.now()}`,
          invoice_number: finalInvoiceNumber,
          reference_number: response.receipt_number || billData.invoice_number,
          receipt_number: response.receipt_number || billData.invoice_number,
          customer_id: (!isWalkInParty(selectedCustomer) && selectedCustomer?.id && isValidUUID(selectedCustomer.id)) ? selectedCustomer.id : null,
          customer_type: isWalkInParty(selectedCustomer) ? "Walk-in" : ((selectedCustomer as any)?.customer_type || ""),
          customer_name: billData.customerName,
          customer_phone: billData.customerPhone,
          customer_address: billData.customerAddress,
          customer_billing_address: billData.customerBillingAddress,
          customer_shipping_address: billData.customerShippingAddress,
          customer_gstin: (selectedCustomer as any)?.gst_number || (selectedCustomer as any)?.gstin || "",
          sales_executive: salesExecutive || defaultSalesExecName || currentSession?.cashier_name || "POS Cashier",
          sales_points_earned: Math.floor(total / 100),
          invoice_date: getTodayDateString(),
          due_date: getTodayDateString(),
          created_at: new Date().toISOString(),
          payment_mode: billData.payment_method,
          payment_status: isCreditOnly ? "Unpaid" : (isPartial ? "Partially Paid" : "Paid"),
          subtotal: taxableAmount > 0 ? taxableAmount : subtotal,
          taxable_value: taxableAmount,
          gross_subtotal: subtotal,
          total_tax: tax,
          discount_amount: totalDiscount,
          grand_total: total,
          amount_received: actualPaid,
          balance_due: balanceDue,
          print_status: "Thermal Printed",
          print_template_id: "thermal",
          template_id: "thermal",
          is_pos: true,
          custom_fields: {
            source: "pos",
            bill_type: "thermal",
            print_status: "Thermal Printed",
            receipt_number: response.receipt_number || billData.invoice_number,
          },
          items: billData.items,
        };
        thermalReceiptHtml = generateThermalReceiptHtml(terminalInvoiceRecord, undefined, currentTenantId);
        const prevList = JSON.parse(localStorage.getItem(posStorageKey) || "[]");
        const mergedList = [
          { ...terminalInvoiceRecord, tenant_id: currentTenantId, company_id: currentCompanyId, workspace_id: currentCompanyId },
          ...prevList.filter((r: any) => r.invoice_number !== terminalInvoiceRecord.invoice_number && r.invoice_number !== response.receipt_number)
        ];
        safeSetItem(posStorageKey, JSON.stringify(mergedList.slice(0, 50)));

        // Increment stored receipt sequence number
        const nextRecSeq = recSeq + 1;
        if (storedSettings) {
          saveStoredInvoiceSettings({
            ...storedSettings,
            receiptSequenceNumber: nextRecSeq,
          }, currentTenantId, currentCompanyId);
        }
        if (activeGst) {
          setOrgDocumentPrefixes({
            ...activeGst,
            invoice_prefix: activeGst.invoice_prefix || undefined,
            receipt_prefix: recPrefix,
            receipt_sequence: nextRecSeq,
            receipt_padding: recPadding,
          } as any, currentTenantId);
        }
      } catch (e) {
        console.warn("Could not save POS checkout bill to localStorage:", e);
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

      // Send the same thermal receipt used for printing; email remains invoice-based.
      const targetPhone = (billData.customerPhone || selectedCustomer?.phone || "").trim();
      const targetEmail = (selectedCustomer?.email || "").trim();
      const targetDocId = response.id || response.receipt_number;

      if (response.id && targetPhone) {
        const receiptNo = response.receipt_number || billData.invoice_number || "POS";
        const cleanP = targetPhone.replace(/\D/g, "");
        const waPhone = cleanP.length === 10 ? `91${cleanP}` : cleanP;
        const capturedHtml = thermalReceiptHtml;
        const capturedTenantId = currentTenantId;
        const transactionId = response.id || response.receipt_number || billData.invoice_number;

        // Fire-and-forget background task: does not block POS terminal or freeze cashier billing
        void (async () => {
          try {
            let receiptPdfBase64: string | undefined = undefined;
            if (capturedHtml) {
              try {
                receiptPdfBase64 = await thermalReceiptHtmlToPdfBase64(
                  capturedHtml,
                  getActiveReceiptTemplate(capturedTenantId).paperSize,
                );
              } catch (pdfErr) {
                console.warn("[POSTerminal] Thermal PDF generation error:", pdfErr);
              }
            }

            const res = await posApi.sendThermalReceiptWhatsApp(transactionId, receiptPdfBase64, targetPhone);
            console.info("[POSTerminal] Thermal receipt dispatched in background via WhatsApp:", res);
          } catch (err: any) {
            console.warn("[POSTerminal] Background thermal receipt WhatsApp dispatch notice:", err);
          }
        })();
      }

      if (targetDocId && targetEmail) {
        try {
          const sendFn = (invoicesApi as any)?.sendInvoiceMultichannel || (invoicesApi as any)?.sendInvoice;
          if (typeof sendFn === "function") {
            sendFn(targetDocId, {
              send_whatsapp: false,
              send_email: Boolean(targetEmail.includes("@")),
              recipient_email: targetEmail || undefined,
            }).then((res: any) => {
              if (res?.success) {
                console.log("[POSTerminal] Auto-dispatched receipt to customer:", res);
              }
            }).catch((err: any) => {
              console.warn("[POSTerminal] Background receipt auto-dispatch info:", err);
            });
          }
        } catch (dispatchErr) {
          console.warn("[POSTerminal] Multi-channel dispatch invocation error:", dispatchErr);
        }
      }

      // Print immediately using the active saved thermal template (identical to Invoice History)
      setTimeout(() => {
        try {
          if (thermalReceiptHtml) {
            printHtmlInPage(thermalReceiptHtml, 250);
          } else {
            triggerThermalPrint();
          }
        } catch (printErr) {
          console.warn("[Print] Fallback to triggerThermalPrint due to error:", printErr);
          triggerThermalPrint();
        }
      }, 300);
    } catch (err: any) {
      console.error("Checkout Failed:", err);
      alert("Checkout failed: " + (err.detail || err.message || "Unknown error"));
    } finally {
      setIsCheckingOut(false);
      setTimeout(() => {
        isProcessingCheckoutRef.current = false;
      }, 1000);
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
      if (creditChangeToWallet && changeDue > 0 && selectedCustomer && !isWalkInParty(selectedCustomer)) {
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
      setPartialPaymentModalOpen(false);
      await executeCheckout([{ payment_method: partialPaymentMode.toLowerCase(), amount: total }]);
      return;
    }

    if (isWalkInParty(selectedCustomer)) {
      toast.error("Walk-in customers require full payment. Remaining balance cannot be posted to ledger.");
      setPaymentMethod("Cash");
      setPartialPaymentModalOpen(false);
      return;
    }

    const due = Number((total - paid).toFixed(2));

    if (partialPaymentMode === 'Wallet' && (customerWalletBalance || 0) < paid) {
      toast.error(`Insufficient Customer Wallet balance (${formatCurrency(customerWalletBalance || 0)} available).`);
      return;
    }

    setPartialPaymentModalOpen(false);
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
        subtotal: taxableAmount > 0 ? taxableAmount : subtotal,
        gross_subtotal: subtotal,
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
    await executeCheckout(payments);
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
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden bg-[#F3F4F6] font-sans selection:bg-indigo-100 selection:text-indigo-900">

      {/* Terminal Header Nav */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200/80 px-4 flex items-center overflow-x-auto gap-3 py-2.5 shadow-xs z-50">
        {/* Back Button to Exit Terminal */}
        <button
          type="button"
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
            }
            if (window.history.length > 1) {
              window.history.back();
            } else {
              navigate({ to: "/dashboard" });
            }
          }}
          className="group inline-flex items-center justify-center size-8 sm:size-8.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
          title="Back / Exit Terminal"
          aria-label="Back / Exit Terminal"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-slate-900 group-hover:-translate-x-0.5 transition-transform duration-150" />
        </button>

        {/* Brand Logo */}
        <div
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => { });
            }
            navigate({ to: "/dashboard" });
          }}
          className="flex items-center gap-2 mr-3 cursor-pointer select-none group shrink-0"
          title="Exit to Dashboard"
        >
          <img
            src="/Logo.png"
            alt="IoTRONCS"
            className="h-7 w-auto object-contain group-hover:scale-105 transition-transform"
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: "billing", label: "Billing", icon: ShoppingCart },
            { id: "recent", label: "Recent Bills", icon: History },
            { id: "exchange", label: "Exchange", icon: RefreshCw },
            { id: "refund", label: "Refund", icon: CreditCard },
            { id: "wallet", label: "Wallet Summary", icon: Wallet },
            { id: "ai_suggest", label: "AI Suggestions", icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = (currentView === tab.id) || (!currentView && tab.id === 'billing');
            return (
              <button
                key={tab.id}
                onClick={() => navigate({ to: "/pos", search: { tab: "terminal", view: tab.id }, replace: true })}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${isActive
                    ? "bg-[#5B4DF5] text-white shadow-md shadow-[#5B4DF5]/20"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Store / Branch, Mode Toggle & User Profile */}
        <div className="ml-auto flex items-center gap-2.5 shrink-0">
          {/* Store / Location Dropdown */}
          <div className="bg-white border border-slate-200/90 rounded-xl px-2.5 py-1 shadow-2xs flex items-center gap-1.5 shrink-0">
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Store / Branch</span>
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="size-3 text-[#5B4DF5] shrink-0" />
                <select
                  value={selectedStore}
                  onChange={(e) => {
                    setSelectedStore(e.target.value);
                    toast.info(`Switched POS Store to ${e.target.value}`);
                  }}
                  className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs max-w-[170px] truncate"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.displayName || s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pricing Mode 3-Way Pill Toggle */}
          <div className="flex items-center bg-white border border-slate-200/90 p-0.5 rounded-xl shadow-2xs">
            <button
              onClick={() => handlePricingModeChange("Retail")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${pricingMode === "Retail"
                  ? "bg-[#5B4DF5] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              <span>🛒</span> Retail
            </button>
            <button
              onClick={() => handlePricingModeChange("Wholesale")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${pricingMode === "Wholesale"
                  ? "bg-[#F59E0B] text-white shadow-xs"
                  : "text-amber-700 hover:bg-amber-50"
                }`}
            >
              <span>📦</span> Wholesale
            </button>
            <button
              onClick={() => handlePricingModeChange("B2B")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${pricingMode === "B2B"
                  ? "bg-[#0D9488] text-white shadow-xs"
                  : "text-teal-700 hover:bg-teal-50"
                }`}
            >
              <span>🏢</span> B2B
            </button>
          </div>

          {/* WhatsApp Connection Status Indicator */}
          <WhatsAppStatusIndicator variant="pos" />

          {/* Notification Bell */}
          <button className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors">
            <Bell className="size-4" />
            <span className="absolute top-1 right-1 size-3.5 bg-rose-500 text-white rounded-full text-[8.5px] font-black flex items-center justify-center leading-none">
              1
            </span>
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-1 border-l border-slate-200/80">
            <div className="size-7 rounded-full bg-[#5B4DF5] text-white font-bold text-xs flex items-center justify-center shadow-xs">
              S
            </div>
            <div className="flex flex-col text-left leading-tight hidden xl:flex">
              <span className="text-xs font-bold text-slate-900">Sarah</span>
              <span className="text-[10px] text-slate-400 font-medium">Sales Admin</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE (3 Columns) OR SUB-VIEW */}
      {currentView === 'billing' || !currentView ? (
        <div className="flex flex-1 overflow-hidden relative w-full min-w-0">

          {/* MAIN PRODUCT AREA: LEFT CATEGORY SIDEBAR & TOP SUB-CATEGORY/BRAND WORKSPACE */}
          <div className="flex-1 bg-[#F8FAFC] flex overflow-hidden min-w-0">

            {/* LEFT VERTICAL SIDEBAR: MAIN CATEGORIES */}
            <div className="w-48 sm:w-52 shrink-0 bg-white border-r border-slate-200/80 flex flex-col p-2.5 z-20 shadow-[2px_0_12px_rgba(0,0,0,0.02)] h-full justify-between">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-bold text-slate-800">Categories</span>
                <Search className="size-3.5 text-slate-400 cursor-pointer hover:text-slate-600" />
              </div>

              <button
                onClick={() => { setActiveCategory("all"); setActiveSubCategory("all"); setActiveBrand("all"); }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 mb-1.5 ${activeCategory === "all"
                    ? "bg-[#5B4DF5] text-white shadow-md shadow-[#5B4DF5]/20"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Store className="size-3.5 shrink-0" />
                  <span className="truncate">All Products</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeCategory === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {products.length}
                </span>
              </button>

              <div className="space-y-0.5 flex-1 overflow-y-auto pr-0.5">
                {(parentCategories.length > 0 ? parentCategories : categories).map(cat => {
                  const { Icon: CatIcon, color: iconColor } = getCategoryVisual(cat.name);
                  const isActive = activeCategory === cat.id;
                  const count = products.filter(p => isProductInCategory(p, cat.id, categories)).length;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        setActiveSubCategory("all");
                        setActiveBrand("all");
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-1.5 cursor-pointer ${isActive
                          ? "bg-[#5B4DF5] text-white shadow-sm font-bold"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <CatIcon className={`size-3.5 shrink-0 ${isActive ? "text-white" : iconColor}`} />
                        <span className="truncate uppercase text-[11px] font-bold">{cat.name}</span>
                      </div>
                      {count > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Bottom AI Insight Card */}
              <div className="mt-auto pt-2 shrink-0">
                <div className="bg-[#FFF8F0] border border-amber-200/60 rounded-xl p-2.5 flex items-start gap-2 shadow-2xs">
                  <span className="text-sm leading-none mt-0.5">💡</span>
                  <div className="leading-tight">
                    <p className="text-[11px] font-bold text-amber-900">AI Insight</p>
                    <p className="text-[10px] text-amber-700/90 mt-0.5 leading-snug">Recommend Warranty Plan based on cart value.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT WORKSPACE AREA: PROMO BANNER, SEARCH, BRANDS, SORT & 5-COL PRODUCT GRID */}
            <div className="flex-1 overflow-y-auto flex flex-col min-w-0 p-3 bg-[#F8FAFC]">

              {/* Promo Banner from ss1 */}
              <div className="relative rounded-2xl overflow-hidden p-4 bg-gradient-to-r from-purple-100/90 via-indigo-50/80 to-pink-100/90 border border-purple-100 shadow-xs flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="size-11 rounded-xl bg-white/90 shadow-sm flex items-center justify-center text-[#5B4DF5] shrink-0">
                    <ShoppingCart className="size-6 text-[#5B4DF5]" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Smart Billing for a Faster Business</h2>
                    <p className="text-xs text-slate-500 font-semibold">Scan • Add • Checkout • Grow</p>
                  </div>
                </div>
                {/* 3D shopping bags graphic matching ss1 */}
                <div className="hidden sm:flex items-center pr-2">
                  <svg className="w-28 h-16 drop-shadow-md" viewBox="0 0 120 70" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="yellowBag" x1="75" y1="24" x2="107" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#FDE047" />
                        <stop offset="1" stopColor="#EAB308" />
                      </linearGradient>
                      <linearGradient id="pinkBag" x1="42" y1="16" x2="78" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#F472B6" />
                        <stop offset="1" stopColor="#DB2777" />
                      </linearGradient>
                      <linearGradient id="purpleBag" x1="14" y1="22" x2="48" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#818CF8" />
                        <stop offset="1" stopColor="#4F46E5" />
                      </linearGradient>
                      <linearGradient id="bagHighlight" x1="0" y1="0" x2="1" y2="1">
                        <stop stopColor="#FFFFFF" stopOpacity="0.45" />
                        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    {/* Yellow Bag (Back Right) */}
                    <rect x="74" y="22" width="32" height="44" rx="4" fill="url(#yellowBag)" />
                    <path d="M84 22 V14 C84 10 96 10 96 14 V22" stroke="#CA8A04" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    {/* Pink Bag (Middle) */}
                    <rect x="42" y="14" width="36" height="52" rx="5" fill="url(#pinkBag)" />
                    <path d="M52 14 V6 C52 2 68 2 68 6 V14" stroke="#BE185D" strokeWidth="3" fill="none" strokeLinecap="round" />
                    <rect x="44" y="16" width="10" height="48" rx="2" fill="url(#bagHighlight)" />
                    {/* Purple Bag (Front Left) */}
                    <rect x="14" y="20" width="34" height="46" rx="5" fill="url(#purpleBag)" />
                    <path d="M24 20 V12 C24 8 38 8 38 12 V20" stroke="#3730A3" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <rect x="16" y="22" width="8" height="42" rx="2" fill="url(#bagHighlight)" />
                  </svg>
                </div>
              </div>

              {/* Full-width Search Bar with Camera icon and Separate View Toggle Buttons matching ss1 */}
              <div className="flex items-center gap-2 mb-2.5 shrink-0">
                <div className="flex-1 relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search className="size-4 text-slate-400 group-focus-within:text-[#5B4DF5] transition-colors" />
                  </div>
                  <input
                    id="global-search"
                    type="text"
                    placeholder="Search by name, barcode, SKU... (F2)"
                    className="block w-full pl-11 pr-11 py-2.5 border border-slate-200/90 rounded-2xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B4DF5]/20 focus:border-[#5B4DF5] transition-all text-xs font-semibold shadow-2xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && searchQuery.trim() !== "") {
                        e.preventDefault();
                        await handleProcessBarcodeScan(searchQuery.trim());
                      }
                    }}
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <button className="p-1 text-slate-400 hover:text-[#5B4DF5] rounded-lg transition-colors cursor-pointer" title="Scan with camera">
                      <Camera className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Two standalone square buttons matching ss1 */}
                <button
                  onClick={() => setViewMode('grid')}
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shrink-0 cursor-pointer ${viewMode === 'grid'
                      ? 'bg-[#5B4DF5] text-white shadow-md shadow-[#5B4DF5]/25'
                      : 'bg-white border border-slate-200/90 text-slate-400 hover:text-slate-700 shadow-2xs'
                    }`}
                  title="Grid view"
                >
                  <div className="grid grid-cols-2 gap-0.5">
                    <span className={`size-1.5 rounded-[1px] ${viewMode === 'grid' ? 'bg-white' : 'bg-slate-400'}`}></span>
                    <span className={`size-1.5 rounded-[1px] ${viewMode === 'grid' ? 'bg-white' : 'bg-slate-400'}`}></span>
                    <span className={`size-1.5 rounded-[1px] ${viewMode === 'grid' ? 'bg-white' : 'bg-slate-400'}`}></span>
                    <span className={`size-1.5 rounded-[1px] ${viewMode === 'grid' ? 'bg-white' : 'bg-slate-400'}`}></span>
                  </div>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shrink-0 cursor-pointer ${viewMode === 'list'
                      ? 'bg-[#5B4DF5] text-white shadow-md shadow-[#5B4DF5]/25'
                      : 'bg-white border border-slate-200/90 text-slate-400 hover:text-slate-700 shadow-2xs'
                    }`}
                  title="List view"
                >
                  <ListIcon className="size-4" />
                </button>
              </div>

              {/* Brand Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-3 py-0.5 shrink-0">
                <button
                  onClick={() => setActiveBrand("all")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-sm ${activeBrand === "all"
                      ? "bg-[#5B4DF5] text-white"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  <span>All Brands ({availableBrands.length || 6})</span>
                  <ChevronDown className="size-3" />
                </button>

                {availableBrands.map(bName => {
                  const isBrandActive = activeBrand.toLowerCase() === bName.toLowerCase();
                  const activeTarget = activeSubCategory !== "all" ? activeSubCategory : activeCategory;
                  const bCount = products.filter(p => {
                    const matchesBrand = p.brand?.toLowerCase() === bName.toLowerCase();
                    if (activeTarget !== "all") {
                      return matchesBrand && isProductInCategory(p, activeTarget, categories);
                    }
                    return matchesBrand;
                  }).length;

                  return (
                    <button
                      key={bName}
                      onClick={() => setActiveBrand(bName)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer ${isBrandActive
                          ? "bg-[#5B4DF5] text-white font-bold"
                          : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/90"
                        }`}
                    >
                      <span>{bName}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isBrandActive ? "bg-white/20 text-white" : "bg-[#F5F3FF] text-[#5B4DF5]"}`}>
                        {bCount}
                      </span>
                    </button>
                  );
                })}

                {availableBrands.length > 6 && (
                  <button
                    onClick={() => setActiveBrand("all")}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/90 shrink-0 cursor-pointer"
                  >
                    More +
                  </button>
                )}
              </div>

              {/* Heading Row with Results count & Sort/Filter */}
              <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {activeCategory === "all" ? "All Products" : (categories.find(c => c.id === activeCategory)?.name || "All Products")}
                  </h3>
                  <span className="text-xs font-bold bg-[#E0F2FE] text-[#0284C7] border border-sky-100 px-2.5 py-0.5 rounded-full shadow-2xs">
                    {filteredProducts.length} Results
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="appearance-none bg-white border border-slate-200 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-700 outline-none cursor-pointer shadow-2xs hover:border-slate-300"
                    >
                      <option value="relevance">Sort: Relevance</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="name">Name: A to Z</option>
                    </select>
                    <ChevronDown className="size-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  <button className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs">
                    <Filter className="size-3.5 text-slate-500" />
                    <span>Filter</span>
                  </button>
                </div>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {paginatedProducts.map(product => {
                    const eff = getItemEffectivePrice(product);
                    const taxRate = getEffectiveTaxRate(product);
                    const isIncl = product.is_tax_inclusive !== false;
                    const mrp = Number(product.mrp) || 0;
                    const price = eff.unitPrice;
                    const hasDirectDiscount = mrp > price;
                    const discountPct = mrp > 0 && hasDirectDiscount ? Math.round(((mrp - price) / mrp) * 100) : (Number(product.discount) || 0);

                    return (
                      <div
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="bg-white rounded-xl border border-slate-200/80 hover:border-[#5B4DF5]/40 hover:shadow-md transition-all duration-200 cursor-pointer relative group flex flex-col justify-between overflow-hidden"
                      >
                        {/* Top Image Box with Overlaid Badges & Wishlist */}
                        <div className="h-20 sm:h-22 bg-slate-50/70 relative p-1.5 flex items-center justify-center overflow-hidden">
                          {/* Badges Overlay */}
                          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 z-10 pointer-events-none">
                            {product.stock <= product.reorderLevel && (
                              <span className="bg-[#EF4444] text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-2xs">
                                Low Stock
                              </span>
                            )}
                            {product.aiScore > 90 && (
                              <span className="bg-[#F59E0B] text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-2xs flex items-center gap-0.5">
                                ⚡ Hot
                              </span>
                            )}
                          </div>

                          {/* Wishlist Heart Overlay */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }}
                            className="absolute top-1.5 right-1.5 z-20 w-6 h-6 rounded-full bg-white/80 hover:bg-white text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center shadow-2xs cursor-pointer"
                            title="Add to wishlist"
                          >
                            <Heart className={`size-3.5 ${favorites[product.id] ? "fill-rose-500 text-rose-500" : ""}`} />
                          </button>

                          {/* Product Image */}
                          <img
                            src={product.image || "https://placehold.co/200x200/f8fafc/94a3b8?text=No+Image"}
                            onError={(e) => { e.currentTarget.src = "https://placehold.co/200x200/f8fafc/94a3b8?text=No+Image"; }}
                            alt={product.name}
                            className="max-h-full max-w-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>

                        {/* Product Info & Pricing */}
                        <div className="p-2 flex flex-col flex-1 justify-between border-t border-slate-100">
                          <div>
                            <span className="text-[9px] font-bold text-[#3B82F6] uppercase tracking-wider block leading-none mb-0.5 truncate">
                              {product.brand || "BRAND"}
                            </span>
                            <h4 className="text-[11px] font-bold text-slate-800 leading-tight line-clamp-2 min-h-[24px]" title={product.name}>
                              {product.name}
                            </h4>
                          </div>

                          {/* Pricing & Add Button */}
                          <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-end justify-between gap-1">
                            <div className="min-w-0">
                              {eff.isWholesale ? (
                                <div className="leading-tight">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] text-slate-400 line-through leading-none">{formatCurrency(eff.basePrice)}</span>
                                    <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1 py-0.2 rounded">{isIncl ? 'Incl.' : '+'} GST {taxRate}%</span>
                                  </div>
                                  <div className={`font-extrabold text-xs leading-none mt-0.5 ${pricingMode === 'B2B' ? 'text-purple-700' : 'text-emerald-600'}`}>
                                    {formatCurrency(eff.unitPrice)}
                                  </div>
                                </div>
                              ) : (hasDirectDiscount || discountPct > 0) ? (
                                <div className="leading-tight">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-slate-400 line-through leading-none">{formatCurrency(mrp || price)}</span>
                                    <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded leading-none">-{discountPct}%</span>
                                  </div>
                                  <div className="font-extrabold text-xs text-slate-900 leading-tight mt-0.5">
                                    {formatCurrency(price)}{" "}
                                    <span className="text-[9px] font-normal text-slate-400">{isIncl ? 'Incl.' : '+'} GST {taxRate}%</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="leading-tight">
                                  <div className="font-extrabold text-xs text-slate-900 leading-tight">
                                    {formatCurrency(price)}{" "}
                                    <span className="text-[9px] font-normal text-slate-400">{isIncl ? 'Incl.' : '+'} GST {taxRate}%</span>
                                  </div>
                                  {pricingMode === 'Retail' && eff.wholesalePrice > 0 && (
                                    <div className="text-[9px] text-slate-400 font-medium leading-none mt-0.5">
                                      Wholesale: {formatCurrency(eff.wholesalePrice)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                              className="size-6.5 rounded-full bg-[#5B4DF5] hover:bg-[#4E40E5] text-white flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95 cursor-pointer"
                              title="Add to cart"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 font-bold">Product</th>
                        <th className="px-6 py-4 font-bold">SKU</th>
                        <th className="px-6 py-4 font-bold">Price & Tax</th>
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
                            <img
                              src={p.image || "https://placehold.co/40x40/f8fafc/94a3b8?text=Img"}
                              onError={(e) => { e.currentTarget.src = "https://placehold.co/40x40/f8fafc/94a3b8?text=Img"; }}
                              alt={p.name}
                              className="w-10 h-10 rounded border border-slate-100 object-contain p-0.5"
                            />
                            <div className="flex flex-col">
                              <span>{p.name}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">{p.brand}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono font-medium text-slate-500">{p.sku}</td>
                          <td className="px-6 py-4 font-bold text-slate-900">
                            {formatCurrency(p.sellingPrice)}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            <span className={p.stock <= p.reorderLevel ? "text-rose-500 font-bold" : ""}>
                              {p.stock}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                              className="size-7 rounded-full bg-[#5B4DF5] text-white inline-flex items-center justify-center shadow-xs"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* POS Pagination Controls */}
              {filteredProducts.length > posPageSize && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500">
                    Showing <span className="text-slate-900 font-bold">{(posPage - 1) * posPageSize + 1}</span> to{" "}
                    <span className="text-slate-900 font-bold">{Math.min(posPage * posPageSize, filteredProducts.length)}</span> of{" "}
                    <span className="text-slate-900 font-bold">{filteredProducts.length}</span> products
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPosPage(p => Math.max(1, p - 1))}
                      disabled={posPage === 1}
                      className="px-3 py-1.5 rounded-xl border bg-white text-xs font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 shadow-2xs"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-bold text-slate-800 px-2">
                      Page {posPage} of {totalPosPages}
                    </span>
                    <button
                      onClick={() => setPosPage(p => Math.min(totalPosPages, p + 1))}
                      disabled={posPage >= totalPosPages}
                      className="px-3 py-1.5 rounded-xl border bg-white text-xs font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 shadow-2xs"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

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
                            value={editForm.sellingPrice || ""}
                            placeholder="0.00"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, sellingPrice: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white text-slate-900 font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">MRP ({currency.symbol})</label>
                          <input
                            type="number"
                            value={editForm.mrp || ""}
                            placeholder="0.00"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, mrp: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white text-slate-900 font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase Price ({currency.symbol})</label>
                          <input
                            type="number"
                            value={editForm.purchasePrice || ""}
                            placeholder="0.00"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, purchasePrice: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white text-slate-900 font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Stock</label>
                          <input
                            type="number"
                            value={editForm.stock || ""}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setEditForm((prev: any) => ({ ...prev, stock: e.target.value === "" ? "" : parseInt(e.target.value) || 0 }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white text-slate-900 font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tax Percent (%)</label>
                          <input
                            type="number"
                            value={selectedProduct.tax_percent ?? selectedProduct.tax ?? 0}
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
                            <h2 className="text-2xl font-semibold text-slate-900 leading-tight mb-2">{selectedProduct.name}</h2>
                            <p className="text-sm text-slate-600 mb-4">{selectedProduct.longDesc}</p>

                            <div className="flex flex-wrap items-end gap-4">
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Selling Price</p>
                                <div className="text-3xl font-semibold text-emerald-600">{formatCurrency(selectedProduct.sellingPrice)}</div>
                              </div>
                              <div className="pb-1 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="font-semibold text-slate-500">
                                    Base (Excl. GST): <strong className="text-slate-800">{formatCurrency(selectedProduct.is_tax_inclusive !== false && Number(selectedProduct.tax_percent ?? selectedProduct.tax ?? 0) > 0 ? selectedProduct.sellingPrice / (1 + Number(selectedProduct.tax_percent ?? selectedProduct.tax ?? 0) / 100) : selectedProduct.sellingPrice)}</strong>
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${selectedProduct.is_tax_inclusive !== false ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                                    {selectedProduct.is_tax_inclusive !== false ? "✅ Incl. GST" : "🔶 Excl. GST"} {selectedProduct.tax_percent ?? selectedProduct.tax ?? 0}%
                                  </span>
                                </div>
                                {selectedProduct.discount > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-400 line-through">{formatCurrency(selectedProduct.mrp)}</span>
                                    <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                      -{selectedProduct.margin} Margin
                                    </span>
                                  </div>
                                )}
                              </div>
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

          {/* COL 3: Billing Workspace (30%) */}
          <div className="w-[30%] min-w-[340px] max-w-[460px] shrink-0 bg-white flex flex-col shadow-[-8px_0_32px_rgba(0,0,0,0.03)] border-l border-slate-200/80 z-20">

            {/* Customer Profile & Sales Rep Header */}
            <div className="p-3 border-b border-slate-100 space-y-2">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                <UserIcon className="size-4 text-slate-700" />
                <span>Customer / Sales Rep</span>
              </div>

              {/* Sales Representative Row */}
              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                <div className="flex items-center gap-1.5 text-slate-600 font-semibold text-xs min-w-0">
                  <div className="size-4 rounded-full bg-[#5B4DF5]/10 text-[#5B4DF5] flex items-center justify-center text-[9px] font-bold shrink-0">
                    <UserIcon className="size-2.5" />
                  </div>
                  <span className="truncate">Sales Rep</span>
                </div>
                <select
                  value={salesExecutive}
                  onChange={(e) => setSalesExecutive(e.target.value)}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1 outline-none cursor-pointer max-w-[210px] truncate shadow-2xs"
                  title="Assign sales volume and incentives to this representative"
                >
                  {salesEmployees.map((emp) => (
                    <option key={emp.id} value={emp.full_name}>
                      {emp.full_name} ({emp.employee_code})
                    </option>
                  ))}
                  {!salesEmployees.some((e) => e.full_name === salesExecutive) && (
                    <option value={salesExecutive}>{salesExecutive || "Platform Super Admin (EMP001)"}</option>
                  )}
                </select>
              </div>

              {/* Customer Card */}
              <button
                onClick={() => setIsCustomerModalOpen(true)}
                className="w-full bg-[#F8F7FF] border border-[#E4E0FD] hover:border-[#5B4DF5] rounded-2xl p-2.5 flex items-center justify-between transition-all shadow-2xs text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="size-8 shrink-0 rounded-full bg-[#EEEBFF] text-[#5B4DF5] flex items-center justify-center font-bold text-xs">
                    <UserIcon className="size-4 text-[#5B4DF5]" />
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {selectedCustomer?.name || "Walk-in Customer"}
                      </p>
                      <span className="text-[9px] font-bold text-[#3B82F6] bg-white border border-[#BFDBFE] px-1.5 py-0.2 rounded-md uppercase">
                        {isWalkInCustomer ? "GUEST" : ((selectedCustomer as any).customer_type || 'Retail')}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium leading-none mt-1">
                      {isWalkInCustomer ? "Guest • Click to select customer" : `Wallet: ${formatCurrency(customerWalletBalance)}`}
                    </div>
                  </div>
                </div>
                <ChevronRight className="size-4 text-slate-400 group-hover:text-slate-700 transition-colors shrink-0 ml-1" />
              </button>

              {/* Customer Pending Dues Banner */}
              {!isWalkInCustomer && customerSummary && customerSummary.total_pending_due > 0 && (
                <div className="p-1.5 bg-amber-50/90 border border-amber-200 rounded-lg text-[11px] flex flex-col gap-1 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-900 flex items-center gap-1">
                      ⚠️ Prev Due:
                    </span>
                    <span className="font-extrabold text-amber-700">{currency.symbol}{customerSummary.total_pending_due?.toFixed(2)}</span>
                  </div>
                  <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer pt-0.5 border-t border-amber-200/60 font-medium text-[10px]">
                    <input
                      type="checkbox"
                      checked={includePreviousDueInBill}
                      onChange={(e) => setIncludePreviousDueInBill(e.target.checked)}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                    />
                    <span>Add previous due to current bill</span>
                  </label>
                </div>
              )}

              {/* Hold Bill & Resume Buttons matching ss1 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleHoldBill}
                  disabled={cart.length === 0}
                  className="flex-1 py-1.5 bg-[#FFFDF5] hover:bg-amber-50 text-amber-700 text-xs font-bold rounded-xl border border-amber-300 transition-colors flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  <Clock className="size-3.5 text-amber-600" />
                  <span>Hold Bill</span>
                </button>
                <button
                  onClick={openHeldBillsModal}
                  className="flex-1 py-1.5 bg-[#F5F3FF] hover:bg-[#ECE8FE] text-[#5B4DF5] text-xs font-bold rounded-xl border border-[#DCD7FE] transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <ListIcon className="size-3.5 text-[#5B4DF5]" />
                  <span>Resume ({heldBillsCount || 1})</span>
                </button>
              </div>
            </div>

            {/* Tax Mode Bulk Quick Toggle */}
            {cart.length > 0 && (
              <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-slate-200/60 text-[10px]">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">GST Pricing:</span>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCart(prev => prev.map(it => ({ ...it, is_tax_inclusive: true })))}
                    className={`px-1.5 py-0.2 rounded font-extrabold transition-all cursor-pointer text-[9px] ${cart.every(it => it.is_tax_inclusive !== false)
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    All Incl. GST
                  </button>
                  <button
                    type="button"
                    onClick={() => setCart(prev => prev.map(it => ({ ...it, is_tax_inclusive: false })))}
                    className={`px-1.5 py-0.2 rounded font-extrabold transition-all cursor-pointer text-[9px] ${cart.every(it => it.is_tax_inclusive === false)
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    All Excl. GST
                  </button>
                </div>
              </div>
            )}

            {/* Cart Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-4 text-slate-800" />
                <span className="text-xs font-bold text-slate-900">Cart ({cart.reduce((s, i) => s + i.qty, 0)} items)</span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs font-semibold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                >
                  <span>Clear All</span>
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>

            {/* Cart Content Area */}
            <div className="flex-1 overflow-y-auto px-2 py-0.5 bg-white relative">
              <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
              {cart.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 space-y-2.5">
                  <div className="size-16 rounded-full bg-[#F5F4FF] flex items-center justify-center text-[#5B4DF5] mb-1">
                    <ShoppingCart className="size-7 text-[#5B4DF5]" />
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-900">Your cart is empty</h4>
                  <p className="text-xs text-slate-400 max-w-[210px] leading-relaxed">
                    Scan a barcode or click on a product to add
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {cart.map((item, idx) => {
                    const { unitPrice, isWholesale } = getItemEffectivePrice(item);
                    const itemTaxPercent = getEffectiveTaxRate(item);
                    const isIncl = item.is_tax_inclusive === true;
                    const baseUnitPrice = isIncl && itemTaxPercent > 0 ? unitPrice / (1 + itemTaxPercent / 100) : unitPrice;
                    const unitGst = isIncl && itemTaxPercent > 0 ? unitPrice - baseUnitPrice : baseUnitPrice * (itemTaxPercent / 100);
                    const sellingPriceIncl = isIncl ? unitPrice : baseUnitPrice + unitGst;
                    const mrpVal = Number(item.mrp) || 0;
                    const isMrpExceeded = mrpVal > 0 && sellingPriceIncl > mrpVal;

                    const qty = Number(item.qty) || 1;
                    const lineGross = unitPrice * qty;
                    const discVal = Number(item.discount_value !== undefined ? item.discount_value : (item.discount || 0));
                    const lineDisc = item.discount_type === "percent"
                      ? lineGross * (discVal / 100)
                      : Math.min(discVal * qty, lineGross);
                    const effectiveGross = Math.max(0, lineGross - lineDisc);
                    const lineTaxable = isIncl && itemTaxPercent > 0 ? effectiveGross / (1 + itemTaxPercent / 100) : effectiveGross;
                    const lineTax = isIncl ? effectiveGross - lineTaxable : (lineTaxable * itemTaxPercent / 100);
                    const lineFinalTotal = isIncl ? effectiveGross : (lineTaxable + lineTax);

                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        onClick={() => openCartItemEditModal(item)}
                        className={`py-1.5 px-1 hover:bg-slate-50/90 transition-colors relative group cursor-pointer rounded-lg ${isMrpExceeded ? "bg-red-50/40" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={item.image || "https://placehold.co/100x100/f8fafc/94a3b8?text=Img"}
                            onError={(e) => { e.currentTarget.src = "https://placehold.co/100x100/f8fafc/94a3b8?text=Img"; }}
                            alt={item.name}
                            className="w-7 h-7 rounded border border-slate-100 object-contain p-0.5 shrink-0 bg-slate-50"
                          />
                          <div className="flex-1 min-w-0 space-y-0.5">
                            {/* Line 1: Name & Price */}
                            <div className="flex items-center justify-between gap-1.5">
                              <h5 className="text-xs font-bold text-slate-900 leading-none truncate" title={item.sku ? `${item.name} (SKU: ${item.sku})` : item.name}>
                                {item.name}
                              </h5>
                              {(item.sku || item.barcode) && (
                                <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-mono text-slate-500">
                                  {item.sku && (
                                    <span className="bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-200">
                                      SKU: <strong>{item.sku}</strong>
                                    </span>
                                  )}
                                  {item.barcode && (
                                    <span className="bg-slate-100 text-slate-700 px-1 py-0.2 rounded border border-slate-200">
                                      BARCODE: <strong>{item.barcode}</strong>
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="text-right shrink-0">
                                <span className="font-extrabold text-xs text-slate-900 block leading-none">
                                  {formatCurrency(lineFinalTotal)}
                                </span>
                                {isWholesale && (
                                  <span className={`text-[8px] font-bold block leading-none mt-0.5 ${pricingMode === 'B2B' ? 'text-purple-600' : 'text-emerald-600'}`}>
                                    {getItemEffectivePrice(item).tierName}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Line 2: All badges + Base/GST + Stepper in ONE single compact line */}
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1 text-[9px] flex-wrap min-w-0">
                                {mrpVal > 0 ? (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openCartItemEditModal(item); }}
                                    title="Click to edit MRP or Selling Price"
                                    className="px-1 py-0.2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold rounded flex items-center gap-0.5 transition-colors cursor-pointer"
                                  >
                                    <span>MRP: {formatCurrency(mrpVal)}</span>
                                    <Pencil className="w-2 h-2 opacity-70" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openCartItemEditModal(item); }}
                                    title="Click to set MRP"
                                    className="px-1 py-0.2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 font-bold rounded flex items-center gap-0.5 transition-colors cursor-pointer"
                                  >
                                    <span>+ MRP</span>
                                  </button>
                                )}

                                {/* Interactive GST toggle badge */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCart(prev => prev.map(it => it.id === item.id ? { ...it, is_tax_inclusive: !isIncl } : it));
                                  }}
                                  title={isIncl ? "Tax Inclusive: Click to switch to Tax Exclusive" : "Tax Exclusive: Click to switch to Tax Inclusive"}
                                  className={`px-1 py-0.2 rounded font-extrabold uppercase transition-all hover:scale-105 cursor-pointer border ${isIncl
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                      : "bg-blue-50 text-blue-700 border-blue-300"
                                    }`}
                                >
                                  {isIncl ? "Incl." : "Excl."} {itemTaxPercent}%
                                </button>

                                <span className="text-slate-400 font-medium whitespace-nowrap">
                                  Base: {formatCurrency(lineTaxable)} • GST: {formatCurrency(lineTax)}
                                </span>

                                {discVal > 0 && (
                                  <span className="px-1.5 py-0.2 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded whitespace-nowrap flex items-center gap-0.5">
                                    <Tag className="w-2 h-2 text-rose-600" />
                                    {discVal}{item.discount_type === "percent" ? "%" : "₹"} OFF (-{formatCurrency(lineDisc)})
                                  </span>
                                )}

                                {(mrpVal > unitPrice) && (
                                  <span className="px-1 py-0.2 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded whitespace-nowrap">
                                    MRP Save: {formatCurrency((mrpVal - unitPrice) * qty)}
                                  </span>
                                )}

                                {item.hsn_code && (
                                  <span className="px-1 py-0.2 bg-slate-100 text-slate-500 font-mono rounded">
                                    {item.hsn_code}
                                  </span>
                                )}

                                {item.secondary_uom && item.conversion_factor > 1 ? (
                                  <div className="flex items-center gap-1 bg-indigo-50/80 border border-indigo-200 rounded-lg p-0.5">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); switchCartItemUom(item.id, item.uom); }}
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-all cursor-pointer ${(item.selected_uom || item.uom) === item.uom
                                          ? "bg-indigo-600 text-white shadow-2xs"
                                          : "text-indigo-700 hover:bg-indigo-100"
                                        }`}
                                      title={`Primary Unit: ${item.uom} (${formatCurrency(item.base_selling_price || item.sellingPrice)})`}
                                    >
                                      Primary: {item.uom} ({formatCurrency(item.base_selling_price || item.sellingPrice)})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); switchCartItemUom(item.id, item.secondary_uom); }}
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-all cursor-pointer ${item.selected_uom === item.secondary_uom
                                          ? "bg-emerald-600 text-white shadow-2xs"
                                          : "text-emerald-700 hover:bg-emerald-100"
                                        }`}
                                      title={`Secondary Unit: ${item.secondary_uom} (${formatCurrency((item.base_selling_price || item.sellingPrice) / item.conversion_factor)})`}
                                    >
                                      Secondary: {item.secondary_uom} ({formatCurrency((item.base_selling_price || item.sellingPrice) / item.conversion_factor)})
                                    </button>
                                  </div>
                                ) : item.uom ? (
                                  <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-800 text-[10px] font-bold rounded">
                                    Primary: {item.selected_uom || item.uom}
                                  </span>
                                ) : null}

                                {/* Batch Selector Pill Button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBatchModalCartItem({
                                      id: item.id,
                                      productId: item.id,
                                      productName: item.name,
                                      currentBatch: item.batch_number,
                                    });
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border ${item.batch_number
                                      ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-2xs"
                                      : "bg-slate-100 text-slate-500 border-dashed border-slate-300 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300"
                                    }`}
                                  title="Select or Create Product Batch (FEFO / Traceability)"
                                >
                                  <Boxes className="w-2.5 h-2.5" />
                                  {item.batch_number ? (
                                    <span>
                                      #{item.batch_number}
                                      {item.expiry_date ? ` (Exp: ${String(item.expiry_date).substring(0, 7)})` : ""}
                                    </span>
                                  ) : (
                                    <span>+ Batch</span>
                                  )}
                                </button>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {/* Edit Price / MRP button */}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openCartItemEditModal(item); }}
                                  className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 rounded opacity-0 group-hover:opacity-100 cursor-pointer"
                                  title="Edit Rate, MRP & Discount"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>

                                {/* Quantity Stepper */}
                                <div className="flex items-center bg-slate-100 rounded border border-slate-200/80 p-0.5">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateQty(item.id, -1); }}
                                    className="w-4 h-4 flex items-center justify-center rounded bg-white text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                                    title="Decrease quantity"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <span className="w-5 text-center text-xs font-bold text-slate-900 leading-none">{item.qty}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); updateQty(item.id, 1); }}
                                    className="w-4 h-4 flex items-center justify-center rounded bg-white text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                                    title="Increase quantity"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                                <span className="text-[8.5px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.5 rounded">
                                  {item.secondary_uom && item.selected_uom === item.secondary_uom ? "Secondary" : "Primary"}
                                </span>

                                <button
                                  onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                                  className="text-slate-300 hover:text-rose-500 transition-colors p-0.5 rounded opacity-0 group-hover:opacity-100 cursor-pointer"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* MRP Warning Alert Banner */}
                        {isMrpExceeded && (
                          <div className="flex items-center gap-1 bg-red-100 text-red-800 border border-red-300 rounded px-1.5 py-0.5 text-[9px] font-bold mt-1">
                            <span className="animate-pulse">⚠️</span>
                            <span>MRP Alert: Price {currency.symbol}{sellingPriceIncl.toFixed(2)} &gt; MRP {currency.symbol}{mrpVal.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {freeItems.map((fi) => (
                    <div key={fi.id} className="py-1.5 px-1 flex items-center justify-between bg-emerald-50/70 rounded-lg mt-1 border border-emerald-100">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-emerald-800 truncate">
                          {fi.product_name}{" "}
                          <span className="text-[8px] font-black uppercase bg-emerald-600 text-white px-1 py-0.2 rounded">FREE</span>
                        </p>
                        {fi.rule_name && <p className="text-[9px] text-emerald-700">{fi.rule_name}</p>}
                      </div>
                      <span className="text-[11px] font-extrabold text-emerald-800">{fi.quantity} × ₹0</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FREE ITEMS & PROMOTIONAL OFFERS BANNER */}
            <div className="mx-2.5 my-1.5 p-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl flex items-center justify-between shadow-2xs shrink-0">
              <div className="flex items-center gap-1.5 text-emerald-800">
                <span className="text-sm leading-none">🎁</span>
                <span className="text-[10px] font-extrabold uppercase tracking-wide">FREE ITEMS & PROMOTIONAL OFFERS</span>
              </div>
              <button
                type="button"
                className="text-xs font-bold text-emerald-700 bg-white border border-emerald-300 rounded-lg px-2.5 py-0.5 hover:bg-emerald-50 transition-colors shadow-2xs cursor-pointer"
              >
                Show
              </button>
            </div>

            {/* Checkout Summary */}
            <div className="bg-white border-t border-slate-200/80 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.05)] flex flex-col shrink-0 z-20">

              {/* DYNAMIC CART DISCOUNT BAR */}
              <div className="px-2.5 py-1.5 border-b border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5B4DF5] flex items-center gap-1">
                    <Tag className="size-3 text-[#5B4DF5]" />
                    <span>DYNAMIC CART DISCOUNT</span>
                  </span>
                  <div className="flex items-center bg-slate-100 rounded-md p-0.5 text-[9px] font-bold">
                    <button
                      onClick={() => setDiscountMode("before_tax")}
                      className={`px-1.5 py-0.5 rounded transition-all ${discountMode === "before_tax" ? "bg-[#5B4DF5] text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"}`}
                    >
                      Before Tax
                    </button>
                    <button
                      onClick={() => setDiscountMode("after_tax")}
                      className={`px-1.5 py-0.5 rounded transition-all ${discountMode === "after_tax" ? "bg-[#5B4DF5] text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"}`}
                    >
                      After Tax
                    </button>
                  </div>
                </div>

                {/* Quick Presets & Custom Input */}
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
                    {[0, 5, 10, 15, 20, 25].map(val => (
                      <button
                        key={val}
                        onClick={() => { setCartDiscountType("percent"); setCartDiscountValue(val); }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all shrink-0 ${cartDiscountType === "percent" && cartDiscountValue === val
                            ? "bg-[#5B4DF5] text-white shadow-2xs"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                          }`}
                      >
                        {val === 0 ? "Off" : `${val}%`}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center bg-white border border-slate-200 rounded p-0.5 shrink-0 w-24 shadow-2xs">
                    <input
                      type="number"
                      min="0"
                      placeholder="Custom"
                      value={cartDiscountValue || ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setCartDiscountValue(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                      className="w-12 text-center text-xs font-bold text-slate-800 outline-none"
                    />
                    <button
                      onClick={() => setCartDiscountType(cartDiscountType === "percent" ? "amount" : "percent")}
                      className="px-1 py-0.2 rounded bg-slate-100 text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      {cartDiscountType === "percent" ? "%" : "₹"}
                    </button>
                  </div>
                </div>
              </div>

              {/* DYNAMIC ADDITIONAL CHARGES BAR (Freight, Packing, Transport, etc.) */}
              <div className="px-2.5 py-1.5 border-b border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <Truck className="size-3 text-emerald-600" />
                    <span>ADDITIONAL CHARGES (FREIGHT / TRANSPORT)</span>
                  </span>
                  <button
                    onClick={handleAddPosChargeRow}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-200 hover:bg-emerald-100 px-2 py-0.5 rounded-lg transition-all flex items-center gap-0.5 shadow-2xs cursor-pointer"
                  >
                    <Plus className="size-3" /> Add Charge
                  </button>
                </div>

                {posCustomCharges.length > 0 && (
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {posCustomCharges.map(ch => (
                      <div key={ch.id} className="flex items-center gap-1 bg-white border border-emerald-200/70 rounded p-1 shadow-2xs text-[10px]">
                        <input
                          type="text"
                          value={ch.name}
                          onChange={e => handleUpdatePosCharge(ch.id, "name", e.target.value)}
                          placeholder="Charge name"
                          className="flex-1 min-w-0 text-[10px] font-semibold text-slate-800 outline-none px-1"
                        />
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded px-1 shrink-0">
                          <span className="text-[9px] text-slate-400 font-bold">{currency.symbol}</span>
                          <input
                            type="number"
                            min="0"
                            value={ch.amount || ""}
                            onFocus={(e) => e.target.select()}
                            onChange={e => handleUpdatePosCharge(ch.id, "amount", e.target.value === "" ? "" : Number(e.target.value))}
                            placeholder="0"
                            className="w-12 text-right text-[10px] font-bold text-slate-900 outline-none py-0.2"
                          />
                        </div>
                        {/* GST % Selector for charge */}
                        <select
                          value={ch.tax_rate || 0}
                          onChange={e => handleUpdatePosCharge(ch.id, "tax_rate", e.target.value)}
                          title="GST on charge"
                          className="shrink-0 bg-slate-50 border border-slate-200 rounded px-0.5 py-0.2 text-[9px] font-bold text-slate-700 outline-none"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                        {Number(ch.tax_rate) > 0 && Number(ch.amount) > 0 && (
                          <span className="shrink-0 text-[9px] font-bold text-emerald-600 whitespace-nowrap">
                            +{currency.symbol}{(Number(ch.amount) * Number(ch.tax_rate) / 100).toFixed(2)}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeletePosCharge(ch.id)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-rose-50 transition-colors shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals Box */}
              <div className="px-3 py-1.5 space-y-1 border-b border-slate-100 border-dashed bg-slate-50/40 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} items)</span>
                  <span className="font-semibold text-slate-700">{formatCurrency(subtotal)}</span>
                </div>

                {itemDiscounts > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span className="flex items-center gap-1"><Tag className="w-2.5 h-2.5 text-rose-500" /> Item Discounts</span>
                    <span className="font-extrabold">-{formatCurrency(itemDiscounts)}</span>
                  </div>
                )}

                {beforeTaxDiscount > 0 && (
                  <div className="flex justify-between text-[#5B4DF5] font-bold">
                    <span className="flex items-center gap-1"><Tag className="w-2.5 h-2.5" /> Before-Tax Discount ({cartDiscountType === "percent" ? `${cartDiscountValue}%` : "Flat"})</span>
                    <span className="font-semibold">-{formatCurrency(beforeTaxDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Taxable Amount</span>
                  <span className="font-semibold text-slate-700">{formatCurrency(taxableAmount)}</span>
                </div>

                {/* GST Breakdown (CGST+SGST vs IGST toggle) */}
                <div className="pt-1 border-t border-slate-200/60 space-y-0.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold flex items-center gap-1">
                      Total Tax / GST
                    </span>
                    <div className="flex items-center bg-slate-100 rounded p-0.5 text-[8px] font-bold">
                      <button
                        onClick={() => setPosGstType("cgst_sgst")}
                        className={`px-1 py-0.2 rounded transition-all ${posGstType === "cgst_sgst" ? "bg-white text-[#5B4DF5] shadow-2xs font-extrabold" : "text-slate-500"}`}
                      >
                        CGST+SGST
                      </button>
                      <button
                        onClick={() => setPosGstType("igst")}
                        className={`px-1 py-0.2 rounded transition-all ${posGstType === "igst" ? "bg-white text-[#5B4DF5] shadow-2xs font-extrabold" : "text-slate-500"}`}
                      >
                        IGST
                      </button>
                    </div>
                  </div>

                  {posGstType === "cgst_sgst" ? (
                    <>
                      <div className="flex justify-between text-slate-600 pl-1.5">
                        <span>• CGST</span>
                        <span className="font-semibold">+{formatCurrency((tax + posChargesGstTotal) / 2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 pl-1.5">
                        <span>• SGST</span>
                        <span className="font-semibold">+{formatCurrency((tax + posChargesGstTotal) / 2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-slate-600 pl-1.5">
                      <span>• IGST</span>
                      <span className="font-semibold">+{formatCurrency(tax + posChargesGstTotal)}</span>
                    </div>
                  )}
                </div>

                {afterTaxDiscount > 0 && (
                  <div className="flex justify-between text-purple-600 font-bold pt-0.5 border-t border-slate-200/60">
                    <span className="flex items-center gap-1"><Tag className="w-2.5 h-2.5" /> After-Tax Discount ({cartDiscountType === "percent" ? `${cartDiscountValue}%` : "Flat"})</span>
                    <span className="font-semibold">-{formatCurrency(afterTaxDiscount)}</span>
                  </div>
                )}

                {!isWalkInCustomer && includePreviousDueInBill && customerSummary?.total_pending_due > 0 && (
                  <div className="flex justify-between text-amber-700 font-bold pt-0.5 border-t border-amber-200/60">
                    <span>⚠️ Previous Due</span>
                    <span className="font-bold">+{formatCurrency(customerSummary.total_pending_due)}</span>
                  </div>
                )}
              </div>

              {/* Massive Grand Total */}
              <div className="px-5 py-3 flex justify-between items-baseline bg-white">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Grand Total</span>
                <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">{formatCurrency(total)}</span>
              </div>

              {/* Payment Methods moved to full-width footer */}

            </div>
          </div>
        </div>
      ) : (



        <>
          {currentView === 'barcode' && <BarcodeScannerView addToCart={addToCart} products={products} />}
          {currentView === 'search' && <QuickSearchView />}
          {currentView === 'delivery' && <DeliveryView />}
          {currentView === 'exchange' && <ExchangeView currentSessionId={currentSession?.id} products={products} initialSearch={(search as any)?.exchangeId || undefined} />}
          {currentView === 'refund' && <RefundView currentSessionId={currentSession?.id} initialSearch={(search as any)?.refundId || undefined} />}
          {currentView === 'wallet' && <WalletView />}
          {currentView === 'price_check' && <PriceCheckView />}
          {currentView === 'favorites' && <FavoritesView products={products} addToCart={addToCart} />}
          {currentView === 'recent' && (
            <RecentBillsView
              onRefund={(id) => navigate({ to: "/pos", search: { tab: "terminal", view: "refund", refundId: id } })}
              onExchange={(id) => navigate({ to: "/pos", search: { tab: "terminal", view: "exchange", exchangeId: id } })}
            />
          )}
          {currentView === 'ai_suggest' && <AISuggestionsView />}
        </>
      )}

      {/* FULL WIDTH PAYMENT BAR */}
      {(!currentView || currentView === 'billing') && (
        <div className="bg-white border-t border-slate-200 px-4 py-2.5 shrink-0 relative z-30 shadow-[0_-4px_15px_-3px_rgb(0_0_0_/_0.05)] w-full flex items-center justify-between gap-4">
          {/* Centered Payment Tender Buttons */}
          <div className="flex-1 flex items-center justify-start sm:justify-center overflow-hidden">
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 px-1">
              {/* Cash */}
              <button
                onClick={() => setPaymentMethod('Cash')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all whitespace-nowrap group hover:-translate-y-0.5 cursor-pointer ${paymentMethod === 'Cash'
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'border-emerald-200 bg-[#ECFDF5] hover:bg-emerald-100/80 text-emerald-800 shadow-2xs'
                  }`}
              >
                <div className={`p-1 rounded-lg transition-colors ${paymentMethod === 'Cash' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                  <Banknote className="size-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">Cash</span>
              </button>

              {/* Card / PineLabs */}
              <button
                onClick={() => {
                  setPaymentMethod('Card');
                  setIsPineLabsModalOpen(true);
                }}
                className={`flex items-center gap-2.5 px-4 py-1.5 rounded-xl border transition-all whitespace-nowrap group hover:-translate-y-0.5 cursor-pointer ${paymentMethod === 'Card'
                    ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'border-blue-200 bg-[#EFF6FF] hover:bg-blue-100/80 text-blue-800 shadow-2xs'
                  }`}
              >
                <div className={`p-1 rounded-lg transition-colors ${paymentMethod === 'Card' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                  <CreditCard className="size-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold uppercase tracking-wider block">Card / PineLabs</span>
                  <span className="text-[9px] opacity-75 font-normal block leading-none">EDC Swiper & NFC</span>
                </div>
              </button>

              {/* Razorpay UPI */}
              <button
                onClick={() => {
                  setPaymentMethod('UPI');
                  setIsRazorpayModalOpen(true);
                }}
                className={`flex items-center gap-2.5 px-4 py-1.5 rounded-xl border transition-all whitespace-nowrap group hover:-translate-y-0.5 cursor-pointer ${paymentMethod === 'UPI'
                    ? 'border-purple-600 bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'border-purple-200 bg-[#FAF5FF] hover:bg-purple-100/80 text-purple-800 shadow-2xs'
                  }`}
              >
                <div className={`p-1 rounded-lg transition-colors ${paymentMethod === 'UPI' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'}`}>
                  <QrCode className="size-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold uppercase tracking-wider block">Razorpay UPI</span>
                  <span className="text-[9px] opacity-75 font-normal block leading-none">Smart QR / SMS</span>
                </div>
              </button>

              {/* Split Payment */}
              <button
                onClick={() => setPaymentMethod('Split')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all whitespace-nowrap group hover:-translate-y-0.5 cursor-pointer ${paymentMethod === 'Split'
                    ? 'border-amber-600 bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'border-amber-200 bg-[#FFFBEB] hover:bg-amber-100/80 text-amber-800 shadow-2xs'
                  }`}
              >
                <div className={`p-1 rounded-lg transition-colors ${paymentMethod === 'Split' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                  <Combine className="size-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">Split Payment</span>
              </button>
            </div>
          </div>

          {/* Amount Due & Complete Payment */}
          <div className="shrink-0 flex items-center gap-4 pl-4 border-l border-slate-100">
            <div className="text-right flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Amount Due</span>
              <span className="text-xl font-extrabold text-slate-900 leading-none">{formatCurrency(total)}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || !paymentMethod || isCheckingOut}
              className="bg-[#5B4DF5] hover:bg-[#4E40E5] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-7 py-3.5 rounded-2xl shadow-lg shadow-[#5B4DF5]/25 transition-all uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-2 group transform active:scale-[0.98] cursor-pointer"
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" /> Processing...
                </>
              ) : (
                <>
                  Complete Payment <ChevronRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── EDIT CART ITEM (MRP, RATE, DISCOUNT & TAX) MODAL ── */}
      <AnimatePresence>
        {cartEditItem && (() => {
          const rawPrice = parseFloat(editSellingPrice) || 0;
          const rawMrp = parseFloat(editMrp) || 0;
          const rawItemTax = cartEditItem.tax_percent !== undefined && cartEditItem.tax_percent !== null ? cartEditItem.tax_percent : (cartEditItem.tax !== undefined && cartEditItem.tax !== null ? cartEditItem.tax : (cartEditItem.tax_rate !== undefined && cartEditItem.tax_rate !== null ? cartEditItem.tax_rate : 0));
          const taxPercent = Number(rawItemTax) || 0;

          // Base & GST calculation based on tax inclusive toggle
          const baseUnitPrice = editTaxInclusive && taxPercent > 0
            ? rawPrice / (1 + taxPercent / 100)
            : rawPrice;
          const unitGst = editTaxInclusive && taxPercent > 0
            ? rawPrice - baseUnitPrice
            : baseUnitPrice * (taxPercent / 100);
          const grossSellingPrice = editTaxInclusive ? rawPrice : baseUnitPrice + unitGst;

          // Discount calculation
          const discVal = parseFloat(editDiscountValue) || 0;
          const discAmt = editDiscountType === "percent"
            ? (grossSellingPrice * discVal) / 100
            : discVal;
          const netUnitPrice = Math.max(0, grossSellingPrice - discAmt);
          const lineTotal = netUnitPrice * (cartEditItem.qty || 1);
          const isMrpExceeded = rawMrp > 0 && grossSellingPrice > rawMrp;

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setCartEditItem(null)}
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-100"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/90">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 leading-tight">{t("Edit Cart Item Pricing", "Edit Cart Item Pricing")}</h3>
                      <p className="text-[11px] text-slate-500 font-medium">Update MRP, Selling Rate & Discounts on this line</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCartEditItem(null)}
                    className="p-1.5 bg-white hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
                  {/* Product Header Card */}
                  <div className="flex gap-3 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <img
                      src={cartEditItem.image || "https://placehold.co/100x100/f8fafc/94a3b8?text=Img"}
                      onError={(e) => { e.currentTarget.src = "https://placehold.co/100x100/f8fafc/94a3b8?text=Img"; }}
                      alt={cartEditItem.name}
                      className="w-11 h-11 object-contain mix-blend-multiply bg-white rounded-xl border border-slate-200 shrink-0 p-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-slate-900 text-xs truncate" title={cartEditItem.name}>{cartEditItem.name}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold mt-1 flex-wrap">
                        {cartEditItem.sku && <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">SKU: {cartEditItem.sku}</span>}
                        {cartEditItem.barcode && <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Barcode: {cartEditItem.barcode}</span>}
                        <span className="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Qty: {cartEditItem.qty}</span>
                        <span className="text-slate-600 font-bold bg-slate-200/70 px-1.5 py-0.5 rounded">GST: {taxPercent}%</span>
                      </div>
                    </div>
                  </div>

                  {/* MRP and Selling Price Fields in a 2-Column Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* MRP Field */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                          MRP ({currency.symbol})
                        </label>
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Printed MRP
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-sm">{currency.symbol}</span>
                        <input
                          type="number"
                          step="any"
                          value={editMrp}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setEditMrp(e.target.value)}
                          placeholder="0.00"
                          className="w-full text-sm font-extrabold text-slate-900 border-2 border-slate-200 rounded-xl py-2 pl-7 pr-3 focus:outline-none focus:border-indigo-500 transition-colors bg-white"
                        />
                      </div>
                    </div>

                    {/* Selling Price Field */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                          Selling Rate ({currency.symbol})
                        </label>
                        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                          {editTaxInclusive ? "Incl. GST" : "Excl. GST"}
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-sm">{currency.symbol}</span>
                        <input
                          type="number"
                          step="any"
                          value={editSellingPrice}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setEditSellingPrice(e.target.value)}
                          placeholder="0.00"
                          autoFocus
                          className="w-full text-sm font-extrabold text-slate-900 border-2 border-slate-200 rounded-xl py-2 pl-7 pr-3 focus:outline-none focus:border-indigo-500 transition-colors bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* GST Mode Toggle */}
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-xs font-bold text-slate-700">Tax Type:</span>
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setEditTaxInclusive(true)}
                        className={`px-2.5 py-1 text-[11px] font-extrabold rounded-md transition-all cursor-pointer ${editTaxInclusive ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                          }`}
                      >
                        Tax Inclusive (GST Included)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditTaxInclusive(false)}
                        className={`px-2.5 py-1 text-[11px] font-extrabold rounded-md transition-all cursor-pointer ${!editTaxInclusive ? "bg-blue-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                          }`}
                      >
                        Tax Exclusive (GST Added)
                      </button>
                    </div>
                  </div>

                  {/* Discount Section */}
                  <div className="space-y-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                        Line Discount
                      </label>
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setEditDiscountType("amount")}
                          className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${editDiscountType === "amount" ? "bg-indigo-600 text-white" : "text-slate-600"
                            }`}
                        >
                          Flat ({currency.symbol})
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditDiscountType("percent")}
                          className={`px-2.5 py-0.5 rounded transition-all cursor-pointer ${editDiscountType === "percent" ? "bg-indigo-600 text-white" : "text-slate-600"
                            }`}
                        >
                          Percent (%)
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-sm">
                          {editDiscountType === "amount" ? currency.symbol : "%"}
                        </span>
                        <input
                          type="number"
                          step="any"
                          value={editDiscountValue}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setEditDiscountValue(e.target.value)}
                          placeholder="0.00"
                          className="w-full text-sm font-extrabold text-slate-900 border-2 border-slate-200 rounded-xl py-2 pl-7 pr-3 focus:outline-none focus:border-indigo-500 transition-colors bg-white"
                        />
                      </div>
                      {/* Quick Percentage Chips */}
                      {editDiscountType === "percent" && (
                        <div className="flex items-center gap-1 shrink-0">
                          {[5, 10, 15, 20].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setEditDiscountValue(pct.toString())}
                              className={`px-2 py-1.5 text-xs font-extrabold rounded-xl border transition-all cursor-pointer ${editDiscountValue === pct.toString()
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Live Calculation Breakdown Card */}
                  <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/70 border border-indigo-100/90 rounded-2xl p-3.5 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-slate-600 font-medium">
                      <span>Base Unit Price (Excl. Tax):</span>
                      <span className="font-bold text-slate-900">{formatCurrency(baseUnitPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600 font-medium">
                      <span>GST Amount ({taxPercent}%):</span>
                      <span className="font-bold text-slate-900">{formatCurrency(unitGst)}</span>
                    </div>
                    {discAmt > 0 && (
                      <div className="flex justify-between items-center text-rose-600 font-medium">
                        <span>Discount Applied:</span>
                        <span className="font-bold">-{formatCurrency(discAmt)}</span>
                      </div>
                    )}
                    <div className="border-t border-indigo-200/60 pt-1.5 flex justify-between items-center">
                      <span className="font-extrabold text-indigo-950">Effective Customer Rate / Unit:</span>
                      <span className="font-black text-sm text-indigo-600">{formatCurrency(netUnitPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-0.5">
                      <span className="font-extrabold text-slate-700">Line Total ({cartEditItem.qty} {cartEditItem.qty === 1 ? 'item' : 'items'}):</span>
                      <span className="font-black text-sm text-slate-900">{formatCurrency(lineTotal)}</span>
                    </div>
                  </div>

                  {/* MRP Warning Alert */}
                  {isMrpExceeded && (
                    <div className="flex items-center gap-2 bg-red-50 text-red-800 border border-red-200 rounded-xl p-2.5 text-xs font-bold">
                      <span className="text-base">⚠️</span>
                      <div>
                        <span>Selling Price ({currency.symbol}{grossSellingPrice.toFixed(2)}) exceeds MRP ({currency.symbol}{rawMrp.toFixed(2)})!</span>
                        <p className="text-[10px] font-normal text-red-600 mt-0.5">Under consumer regulations, products cannot be sold above printed MRP.</p>
                      </div>
                    </div>
                  )}

                  {/* Master Database Sync Option */}
                  <label className="flex items-start gap-2.5 p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={editUpdateMaster}
                      onChange={(e) => setEditUpdateMaster(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <div className="text-xs">
                      <span className="font-extrabold text-slate-900 block">Update in Product Master Database</span>
                      <span className="text-[11px] text-slate-500 font-normal">Save this new MRP ({currency.symbol}{rawMrp.toFixed(2)}) & Rate permanently so all future scans use it.</span>
                    </div>
                  </label>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-slate-50/90 border-t border-slate-100 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setCartEditItem(null)}
                    disabled={isSavingEditItem}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCartItemEdit}
                    disabled={isSavingEditItem}
                    className="px-5 py-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingEditItem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Apply & Save</span>
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* CASH TENDERED MODAL */}
      <AnimatePresence>
        {cashModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCashModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-[350px] sm:max-w-[360px] bg-white rounded-[26px] shadow-[0_20px_50px_rgba(0,0,0,0.18)] border border-slate-100 overflow-hidden p-4 sm:p-4.5"
            >
              {/* Top Decorative Header Area */}
              <div className="relative -m-4 sm:-m-4.5 mb-3 p-4 sm:p-4.5 pb-2.5 bg-gradient-to-b from-[#eafaf1]/80 via-[#f4fcf7]/40 to-transparent">
                <div className="flex items-start justify-between">
                  {/* Left: Icon + Title + Subtitle */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-[#e6f7ee] text-emerald-600 flex items-center justify-center shrink-0 shadow-xs border border-emerald-100/60">
                      <Wallet className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
                    </div>
                    <div>
                      <h3 className="text-[17px] font-bold text-slate-900 tracking-tight leading-tight">
                        {t("Cash Payment", "Cash Payment")}
                      </h3>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-tight">
                        {t("Enter the cash received from customer", "Enter the cash received from customer")}
                      </p>
                    </div>
                  </div>

                  {/* Right: 3D Cash Illustration + Close Button */}
                  <div className="flex items-start gap-1 shrink-0 -mt-1 -mr-1">
                    {/* 3D Banknote & Coins Graphic */}
                    <div className="hidden sm:block select-none pointer-events-none -mr-2 -mt-1">
                      <svg width="74" height="42" viewBox="0 0 74 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Golden Sparkles */}
                        <path d="M54 3L55.2 6.5L59 7.7L55.2 8.9L54 12.5L52.8 8.9L49 7.7L52.8 6.5L54 3Z" fill="#FBBF24" />
                        <path d="M67 12L67.7 13.8L70 14.5L67.7 15.2L67 17L66.3 15.2L64 14.5L66.3 13.8L67 12Z" fill="#FDE047" opacity="0.85" />
                        <circle cx="43" cy="8" r="1.2" fill="#FBBF24" opacity="0.75" />

                        {/* Tilted Banknote in soft mint/emerald */}
                        <g transform="rotate(-8 26 22)">
                          <rect x="2" y="8" width="42" height="23" rx="4.5" fill="#34D399" opacity="0.9" />
                          <rect x="3.5" y="9.5" width="39" height="20" rx="3.5" fill="#10B981" />
                          <rect x="5.5" y="11.5" width="35" height="16" rx="2.5" stroke="#A7F3D0" strokeWidth="0.8" strokeDasharray="2 1.5" fill="none" opacity="0.6" />
                          <circle cx="23" cy="19.5" r="5" fill="#34D399" />
                          <circle cx="23" cy="19.5" r="3.2" fill="#059669" />
                          <circle cx="7.5" cy="13.5" r="1" fill="#A7F3D0" />
                          <circle cx="38.5" cy="13.5" r="1" fill="#A7F3D0" />
                          <circle cx="7.5" cy="25.5" r="1" fill="#A7F3D0" />
                          <circle cx="38.5" cy="25.5" r="1" fill="#A7F3D0" />
                        </g>

                        {/* Golden Coins Stack */}
                        <g transform="translate(38, 16)">
                          <ellipse cx="15" cy="15" rx="10" ry="4.2" fill="#D97706" />
                          <path d="M5 11.5v3.5c0 2.3 4.5 4.2 10 4.2s10-1.9 10-4.2v-3.5" fill="#B45309" />
                          <ellipse cx="15" cy="11.5" rx="10" ry="4.2" fill="#F59E0B" />
                          <ellipse cx="15" cy="11.5" rx="8" ry="3" fill="#FBBF24" />
                        </g>
                        <g transform="translate(38, 11)">
                          <ellipse cx="15" cy="13" rx="10" ry="4.2" fill="#D97706" />
                          <path d="M5 9.5v3.5c0 2.3 4.5 4.2 10 4.2s10-1.9 10-4.2v-3.5" fill="#B45309" />
                          <ellipse cx="15" cy="9.5" rx="10" ry="4.2" fill="#F59E0B" />
                          <ellipse cx="15" cy="9.5" rx="8" ry="3" fill="#FBBF24" />
                        </g>
                        <g transform="translate(29, 16)">
                          <ellipse cx="12" cy="11" rx="10" ry="6" fill="#F59E0B" stroke="#D97706" strokeWidth="0.8" />
                          <ellipse cx="12" cy="11" rx="8" ry="4.5" fill="#FBBF24" />
                          <ellipse cx="12" cy="10.5" rx="6" ry="3" fill="#FDE047" opacity="0.6" />
                          <text x="12" y="13" fontSize="8" fontWeight="900" textAnchor="middle" fill="#92400E" fontFamily="sans-serif">₹</text>
                        </g>
                      </svg>
                    </div>

                    <button
                      onClick={() => setCashModalOpen(false)}
                      className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Total Due Section */}
              <div className="mb-3 p-3 px-3.5 bg-[#eefcf4] border border-[#c8f5dc] rounded-2xl flex justify-between items-center shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#057a55] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ReceiptText className="w-4 h-4 text-white" strokeWidth={2.2} />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold text-emerald-950 block leading-tight">Total Due</span>
                    <span className="text-[10px] font-medium text-emerald-700/80 block leading-tight">Amount to be paid</span>
                  </div>
                </div>
                <span className="text-2xl font-black text-[#047857] tracking-tight">{formatCurrency(total)}</span>
              </div>

              {/* Cash Tendered Input Section */}
              <div className="mb-3">
                <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Cash Tendered ({currency.symbol})
                </label>
                <div className="relative flex items-center bg-white border-2 border-blue-400 rounded-2xl px-3 py-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all mb-2 shadow-2xs">
                  <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">
                    {currency.symbol}
                  </span>
                  <input
                    type="number"
                    value={cashTendered}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-full text-xl font-black text-slate-900 tracking-tight bg-transparent border-none outline-none px-2 py-0.5 placeholder:text-slate-300"
                    placeholder="0.00"
                    autoFocus
                  />
                  {/* Overlapping Dual-Banknote Icon */}
                  <svg width="22" height="18" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 shrink-0 select-none">
                    <rect x="2" y="6" width="18" height="12" rx="2" fill="none" />
                    <circle cx="11" cy="12" r="2.5" />
                    <path d="M6 2h14a2 2 0 0 1 2 2v8" />
                  </svg>
                </div>

                {/* Quick Denominations */}
                <div className="grid grid-cols-4 gap-2">
                  {[total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, 2000]
                    .filter((v, i, a) => a.indexOf(v) === i && v >= total)
                    .slice(0, 4)
                    .map((amt) => {
                      const isExact = amt === total;
                      const isSelected = Number(cashTendered) === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCashTendered(amt.toString())}
                          className={`py-2 px-1 rounded-xl font-bold transition-all flex flex-col items-center justify-center cursor-pointer ${isSelected || (isExact && (!cashTendered || Number(cashTendered) === total))
                              ? "bg-[#eefcf4] border-2 border-emerald-500 text-emerald-950 shadow-xs"
                              : "bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-800"
                            }`}
                        >
                          {isExact ? (
                            <>
                              <span className="text-xs font-black text-emerald-950 leading-tight">Exact</span>
                              <span className="text-[10px] font-bold text-emerald-700 leading-tight">{formatCurrency(amt)}</span>
                            </>
                          ) : (
                            <span className="text-xs font-black leading-tight">{currency.symbol}{amt}</span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Change Due Section */}
              <div className="mb-3.5 p-3 px-3.5 bg-[#eef6ff] border border-blue-100 rounded-2xl flex flex-col justify-center shadow-2xs">
                <div className="flex justify-between items-center w-full">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#dbeafe] text-[#1d4ed8] flex items-center justify-center shrink-0 shadow-xs">
                      <ArrowRightLeft className="w-4 h-4 text-blue-600" strokeWidth={2.4} />
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-bold text-slate-900 block leading-tight">Change Due</span>
                      <span className="text-[10px] font-medium text-slate-500 block leading-tight">Amount to return to customer</span>
                    </div>
                  </div>
                  <span className={`text-2xl font-black tracking-tight ${Number(cashTendered) >= total ? "text-[#002f9c]" : "text-slate-400"
                    }`}>
                    {Number(cashTendered) >= total ? formatCurrency(Number(cashTendered) - total) : formatCurrency(0)}
                  </span>
                </div>

                {Number(cashTendered) > total && selectedCustomer && !isWalkInCustomer && (
                  <label className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={creditChangeToWallet}
                      onChange={(e) => setCreditChangeToWallet(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-white border-blue-300"
                    />
                    <span className="text-[11px] font-semibold text-slate-700">
                      Add change ({formatCurrency(Number(cashTendered) - total)}) to Customer Wallet
                    </span>
                  </label>
                )}
              </div>

              {/* Complete Transaction Button */}
              <button
                onClick={handleCashConfirm}
                disabled={Number(cashTendered) < total || isCheckingOut}
                className="w-full bg-gradient-to-r from-[#009e5a] to-[#007c44] hover:from-[#008f52] hover:to-[#00703d] disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 px-4.5 rounded-2xl shadow-lg shadow-emerald-700/20 active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer disabled:cursor-not-allowed disabled:shadow-none"
              >
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Banknote className="w-4 h-4 text-white" strokeWidth={2.2} />
                </div>
                <span className="text-sm sm:text-base font-bold text-white tracking-wide">
                  {isCheckingOut ? "Processing..." : t("Complete Transaction", "Complete Transaction")}
                </span>
                <ArrowRight className="w-5 h-5 text-white shrink-0" strokeWidth={2.5} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SPLIT PAYMENT MODAL */}
      <AnimatePresence>
        {splitPaymentModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSplitPaymentModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-[390px] bg-white rounded-[28px] shadow-2xl shadow-slate-900/20 p-6 sm:p-7 border border-slate-100"
            >
              {/* Header with Split Icon, Title, Subtitle, and Close button */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-2xl bg-[#e6fbf3] border border-[#c1f3e3] flex items-center justify-center text-[#009e74] shrink-0 shadow-2xs">
                    <svg
                      className="w-6 h-6 text-[#009e74]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {/* Back card */}
                      <rect x="5" y="9" width="13" height="9" rx="2" fill="#009e74" fillOpacity="0.2" stroke="#009e74" strokeWidth="1.8" />
                      <line x1="5" y1="12" x2="18" y2="12" stroke="#009e74" strokeWidth="1.5" />
                      {/* Front card */}
                      <rect x="2" y="5" width="13" height="9" rx="2" fill="#009e74" fillOpacity="0.85" stroke="#009e74" strokeWidth="1.8" />
                      <line x1="2" y1="8" x2="15" y2="8" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.75" />
                      <circle cx="5" cy="11.5" r="0.75" fill="#ffffff" />
                      {/* Arrow */}
                      <path d="M16 4h4v4" stroke="#009e74" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20 4l-5 5" stroke="#009e74" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">
                      {t("Split Payment", "Split Payment")}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5 leading-snug">
                      Enter how the customer wants to split the payment
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSplitPaymentModalOpen(false)}
                  className="size-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 stroke-[2.2]" />
                </button>
              </div>

              {/* Grand Total Mint/Teal Card with Decorative Translucent Cards Art */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#e7fbf4] via-[#e2f9f1] to-[#d4f4ea] border border-[#bbf0df] p-5 mb-5 flex flex-col items-center justify-center text-center shadow-xs">
                {/* 3D-Style Translucent Credit Cards Art on Right */}
                <div className="absolute -right-3 -bottom-3 w-32 h-26 pointer-events-none select-none opacity-85">
                  <svg viewBox="0 0 120 100" className="w-full h-full fill-none">
                    {/* Back Card */}
                    <g transform="rotate(-10 70 50)">
                      <rect x="42" y="24" width="62" height="38" rx="8" fill="#10b981" fillOpacity="0.22" stroke="#10b981" strokeOpacity="0.35" strokeWidth="1.2" />
                      <rect x="42" y="32" width="62" height="7" fill="#0d9488" fillOpacity="0.2" />
                      <rect x="48" y="47" width="14" height="4" rx="2" fill="#ffffff" fillOpacity="0.5" />
                    </g>
                    {/* Front Card */}
                    <g transform="rotate(6 65 60)">
                      <rect x="30" y="36" width="66" height="42" rx="9" fill="#10b981" fillOpacity="0.4" stroke="#059669" strokeOpacity="0.45" strokeWidth="1.2" />
                      <rect x="30" y="45" width="66" height="8" fill="#047857" fillOpacity="0.25" />
                      <rect x="37" y="62" width="18" height="5" rx="2.5" fill="#ffffff" fillOpacity="0.75" />
                      <circle cx="82" cy="65" r="4" fill="#ffffff" fillOpacity="0.4" />
                    </g>
                    {/* Sparkle rays */}
                    <line x1="68" y1="18" x2="68" y2="13" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />
                    <line x1="84" y1="21" x2="88" y2="17" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />
                    <line x1="28" y1="44" x2="23" y2="42" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />
                  </svg>
                </div>

                <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-1.5 relative z-10">
                  Grand Total
                </p>
                <p className="text-3xl sm:text-[34px] font-black text-slate-900 tracking-tight leading-none relative z-10">
                  {formatCurrency(total)}
                </p>
              </div>

              {/* Input: Cash Amount */}
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Cash Amount
                </label>
                <div className="relative flex items-center bg-white border-2 border-[#5b96f7] rounded-2xl p-1.5 pl-3 shadow-[0_0_0_3.5px_rgba(59,130,246,0.12)] transition-all">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 font-bold text-base mr-3 shrink-0 select-none shadow-2xs">
                    {currency.symbol}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={splitCash}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSplitCash(val);
                      const parsedVal = parseFloat(val) || 0;
                      if (parsedVal <= total && parsedVal >= 0) {
                        setSplitOnline((total - parsedVal).toFixed(2));
                      }
                    }}
                    className="w-full bg-transparent text-xl font-bold text-slate-800 placeholder:text-slate-400 outline-none py-1.5"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Input: Online / UPI Amount */}
              <div className="mb-6">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Online / UPI Amount
                </label>
                <div className="relative flex items-center bg-white border-2 border-slate-200/90 hover:border-slate-300 focus-within:border-[#5b96f7] focus-within:shadow-[0_0_0_3.5px_rgba(59,130,246,0.12)] rounded-2xl p-1.5 pl-3 transition-all">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 font-bold text-base mr-3 shrink-0 select-none shadow-2xs">
                    {currency.symbol}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={splitOnline}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSplitOnline(val);
                      const parsedVal = parseFloat(val) || 0;
                      if (parsedVal <= total && parsedVal >= 0) {
                        setSplitCash((total - parsedVal).toFixed(2));
                      }
                    }}
                    className="w-full bg-transparent text-xl font-bold text-slate-800 placeholder:text-slate-400 outline-none py-1.5"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Confirm Payment Button */}
              <button
                type="button"
                onClick={handleSplitConfirm}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#0d2f44] via-[#095b66] to-[#049474] hover:from-[#0b283b] hover:to-[#038367] text-white font-bold text-base tracking-wide shadow-lg shadow-teal-950/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <div className="size-6 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                  <Check className="size-3.5 stroke-[3]" />
                </div>
                <span>{t("Confirm Payment", "Confirm Payment")}</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PARTIAL PAYMENT (KHATA / SPLIT DUE) MODAL — registered customers only */}
      <AnimatePresence>
        {partialPaymentModalOpen && !isWalkInCustomer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPartialPaymentModalOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Percent className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{t("Partial Payment & Khata", "Partial Payment & Khata")}</h3>
                    <p className="text-xs text-slate-400">Collect upfront part, record remaining on credit</p>
                  </div>
                </div>
                <button onClick={() => setPartialPaymentModalOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
              </div>

              {/* Grand Total banner */}
              <div className="p-3 bg-slate-900 text-white rounded-2xl mb-4 flex justify-between items-center shadow-inner">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Invoice Bill</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(total)}</p>
                </div>
                {selectedCustomer && !isWalkInCustomer && (
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-indigo-300">Customer</p>
                    <p className="text-xs font-bold text-indigo-100 max-w-[130px] truncate">{selectedCustomer.name}</p>
                  </div>
                )}
              </div>

              {/* Payment Mode Selector */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">1. Select Upfront Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Cash", "UPI", "Card"] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPartialPaymentMode(m)}
                      className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${partialPaymentMode === m
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/30"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                    >
                      {m === "Cash" && <Banknote className="w-3.5 h-3.5" />}
                      {m === "UPI" && <QrCode className="w-3.5 h-3.5" />}
                      {m === "Card" && <CreditCard className="w-3.5 h-3.5" />}
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount input */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">2. Amount Paid Now ({currency.symbol})</label>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    {Number(partialPaidAmount) > 0 && Number(partialPaidAmount) < total ? `${((Number(partialPaidAmount) / total) * 100).toFixed(0)}% Upfront` : ""}
                  </span>
                </div>
                <div className="relative mb-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-lg">{currency.symbol}</span>
                  <input
                    type="number"
                    value={partialPaidAmount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setPartialPaidAmount(e.target.value)}
                    className="w-full text-2xl font-semibold text-slate-900 border-2 border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-rose-500 transition-colors"
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
                      className={`py-1.5 text-xs font-bold rounded-xl border transition-all ${Number(partialPaidAmount) === chip.val
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
                  <span className="text-emerald-700 font-semibold">+{formatCurrency(Number(partialPaidAmount) || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold text-amber-950 pt-1.5 border-t border-amber-200/60">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-amber-600" /> Remaining Balance Due (Khata):
                  </span>
                  <span className="text-amber-700 text-base">
                    {formatCurrency(Math.max(0, total - (Number(partialPaidAmount) || 0)))}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                {isWalkInCustomer && (
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
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">{t("Open Register", "Open Register")}</h2>
              <p className="text-sm text-slate-500 mb-6 font-medium">Please enter your starting cash float to open the shift.</p>

              <div className="mb-6 text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Starting Cash ({currency.symbol})</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency.symbol}</span>
                  <input
                    type="number"
                    value={startingCash}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setStartingCash(e.target.value)}
                    className="w-full text-2xl font-semibold text-slate-900 border-2 border-slate-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>

              <button
                onClick={handleOpenSession}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all uppercase tracking-wide"
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
                    <h3 className="font-semibold text-xl leading-none">{t("Resume Bill", "Resume Bill")}</h3>
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
                    <h3 className="font-semibold text-lg leading-tight">{t("Customer Profile Selection", "Customer Profile Selection")}</h3>
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
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${customerTab === 'search'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  Search Existing Customer
                </button>
                <button
                  onClick={() => setCustomerTab('new')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${customerTab === 'new'
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
                            className={`p-3.5 bg-white border rounded-xl cursor-pointer transition-all flex items-center justify-between hover:border-indigo-400 hover:shadow-md ${selectedCustomer.id === cust.id ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20' : 'border-slate-200'
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
                        <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number *</label>
                        <input
                          type="text"
                          placeholder="+1 (555) 019-2834"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          required
                          className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Email Address <span className="text-[10px] font-normal text-slate-400">(Optional)</span></label>
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

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Opening Outstanding Balance (₹)</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={newCustOutstanding}
                        onChange={(e) => setNewCustOutstanding(e.target.value)}
                        className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                      />
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
                            placeholder="e.g. City / Town"
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

      {/* Pine Labs Handheld EDC Card Terminal Modal */}
      <PineLabsEDCModal
        isOpen={isPineLabsModalOpen}
        amount={total}
        billNumber={`POS-${Date.now().toString().slice(-6)}`}
        customerMobile={selectedCustomer?.phone}
        onClose={() => setIsPineLabsModalOpen(false)}
        onSuccess={(payData) => {
          setPaymentMethod(payData.paymentMethod);
          setEdcMetadata({
            rrn: payData.rrn,
            authCode: payData.authCode,
            cardBrand: payData.cardBrand,
            cardLast4: payData.cardLast4,
            batchNumber: payData.batchNumber,
          });
          setIsPineLabsModalOpen(false);
          toast.success(`Payment captured via PineLabs EDC (RRN: ${payData.rrn})`);
          executeCheckout([{ payment_method: "card", amount: total }]);
        }}
      />

      {/* Razorpay Dynamic UPI QR & SMS Link Modal */}
      <RazorpayPOSModal
        isOpen={isRazorpayModalOpen}
        amount={total}
        billNumber={`POS-${Date.now().toString().slice(-6)}`}
        customerMobile={selectedCustomer?.phone}
        customerName={selectedCustomer?.name}
        onClose={() => setIsRazorpayModalOpen(false)}
        onSuccess={(payData) => {
          setPaymentMethod("UPI");
          setIsRazorpayModalOpen(false);
          toast.success(`Razorpay Payment verified (${payData.paymentId})`);
          executeCheckout([{ payment_method: "online", amount: total }]);
        }}
      />

      {/* Active Checkout Thermal Printer Portal */}
      <ThermalReceiptPrinter bill={completedCheckoutBill} />

      {/* Interactive Product Batch & Traceability Selector Modal */}
      {batchModalCartItem && (
        <BatchSelectorModal
          isOpen={!!batchModalCartItem}
          onClose={() => setBatchModalCartItem(null)}
          productId={batchModalCartItem.productId}
          productName={batchModalCartItem.productName}
          currentBatchNumber={batchModalCartItem.currentBatch}
          onSelectBatch={handleBatchSelectForCartItem}
        />
      )}

      {/* Central Stock Alert Confirmation Modal */}
      <StockAlertModal
        isOpen={stockAlertModal.isOpen}
        onClose={() => setStockAlertModal((prev) => ({ ...prev, isOpen: false }))}
        mode={stockAlertModal.mode}
        productName={stockAlertModal.productName}
        sku={stockAlertModal.sku}
        availableStock={stockAlertModal.availableStock}
        requestedQuantity={stockAlertModal.requestedQuantity}
        reorderLevel={stockAlertModal.reorderLevel}
        isAuthorized={isZeroStockAuthorized}
        onRemoveItem={stockAlertModal.onRemove}
        onAllowBilling={stockAlertModal.onAllow}
        onAdjustQuantity={stockAlertModal.onAdjust}
      />
    </div>
  );
}

// Trivial change to force Vite HMR rebuild
