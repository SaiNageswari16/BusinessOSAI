import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus,
  Settings,
  ScanBarcode,
  XCircle,
  Search,
  ScanLine,
  X,
  ChevronDown,
  Trash2,
  UserPlus,
  Calendar,
  FileText,
  CreditCard,
  QrCode,
  Check,
  Building,
  Phone,
  Mail,
  Receipt,
  Sparkles,
  ArrowLeft,
  DollarSign,
  History,
  Wallet,

  MessageSquare,
  StickyNote,
  Tag,
  Boxes,
  CheckSquare,
  Square,
  ShoppingBag,
  Layers,
  Minus,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { posApi, crmApi, invoicesApi, employeesApi, fetchSalesEmployees, inventoryApi, procurementApi } from "../../lib/api-client";
import { toast } from "sonner";
import { ThermalReceiptPrinter } from "./ThermalReceiptPrinter";
import { FullInvoicePrinter, FullInvoiceData } from "./FullInvoicePrinter";
import { triggerThermalPrint } from "../../lib/print-helper";
import { useCurrency } from "@/hooks/use-currency";

export const INDIAN_STATES = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
];

interface InvoiceItem {
  id: string;
  product_id?: string;
  product_name: string;
  hsn_code?: string;
  batch_number?: string;
  expiry_date?: string;
  mfg_date?: string;
  mrp?: number;
  quantity: number;
  unit_price: number;
  discount_value: number;
  discount_type: "amount" | "percent";
  tax_rate: number;
  is_tax_inclusive?: boolean;
  custom_note?: string;
  is_note_open?: boolean;
  is_search_open?: boolean;
  search_query?: string;
}

export function PosSalesInvoice() {
    const { currency, formatCurrency } = useCurrency();
  const [showPaymentTerms, setShowPaymentTerms] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  // Fixed-position dropdown anchor for product search (avoids overflow-x-auto clipping)
  const [dropdownAnchor, setDropdownAnchor] = useState<{ itemId: string; top: number; left: number; width: number } | null>(null);

  // Invoice Fields
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-5)}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [paymentTerms, setPaymentTerms] = useState("30");
  const [customPaymentTermsText, setCustomPaymentTermsText] = useState("");
  const [customPaymentDays, setCustomPaymentDays] = useState<number | "">(30);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(
    "1. Goods once sold will not be taken back or exchanged.\n2. All disputes are subject to local jurisdiction only."
  );
  const [showPaymentQR, setShowPaymentQR] = useState(false);
  const [autoRoundOff, setAutoRoundOff] = useState(true);
  const [amountReceived, setAmountReceived] = useState<number | "">("");
  const [paymentMode, setPaymentMode] = useState("Cash");

  // Dynamic Custom Additional Charges State
  const [customCharges, setCustomCharges] = useState<{ id: string; name: string; amount: number | ""; tax_rate: number }[]>([
    { id: "1", name: "Freight / Transport", amount: 0, tax_rate: 0 },
    { id: "2", name: "Packing Charge", amount: 0, tax_rate: 0 }
  ]);

  const handleAddChargeRow = () => {
    setCustomCharges((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "Custom Charge", amount: "", tax_rate: 0 }
    ]);
  };

  const handleUpdateCharge = (id: string, field: "name" | "amount" | "tax_rate", value: any) => {
    setCustomCharges((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            [field]: field === "amount" ? (value === "" ? "" : Math.max(0, Number(value))) : field === "tax_rate" ? Number(value) : value
          };
        }
        return c;
      })
    );
  };

  const handleDeleteCharge = (id: string) => {
    setCustomCharges((prev) => prev.filter((c) => c.id !== id));
  };

  // Pricing Mode, Location & Sales Executive State
  const [pricingMode, setPricingMode] = useState<"Retail" | "Wholesale" | "B2B">("Retail");
  const [selectedLocation, setSelectedLocation] = useState<string>("Store Main Branch");
  const [salesExecutive, setSalesExecutive] = useState<string>("");
  const [salesEmployees, setSalesEmployees] = useState<any[]>([]);

  // Inline Create Product Modal State
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdSku, setNewProdSku] = useState("");
  const [newProdBarcode, setNewProdBarcode] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("General");
  const [newProdPrice, setNewProdPrice] = useState<number | "">("");
  const [newProdWholesalePrice, setNewProdWholesalePrice] = useState<number | "">("");
  const [newProdB2bPrice, setNewProdB2bPrice] = useState<number | "">("");
  const [newProdMrp, setNewProdMrp] = useState<number | "">("");
  const [newProdTax, setNewProdTax] = useState<number>(18);
  const [newProdStock, setNewProdStock] = useState<number>(100);

  // Add Party Modal State
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyPhone, setNewPartyPhone] = useState("");
  const [newPartyEmail, setNewPartyEmail] = useState("");
  const [newPartyCompany, setNewPartyCompany] = useState("");
  const [newPartyType, setNewPartyType] = useState("Retail");
  const [newPartyGST, setNewPartyGST] = useState("");
  
  // Detailed Structured Address
  const [newPartyStreet, setNewPartyStreet] = useState("");
  const [newPartyCity, setNewPartyCity] = useState("");
  const [newPartyState, setNewPartyState] = useState("Andhra Pradesh");
  const [newPartyPincode, setNewPartyPincode] = useState("");

  const [newPartyShipStreet, setNewPartyShipStreet] = useState("");
  const [newPartyShipCity, setNewPartyShipCity] = useState("");
  const [newPartyShipState, setNewPartyShipState] = useState("Andhra Pradesh");
  const [newPartyShipPincode, setNewPartyShipPincode] = useState("");
  const [isShippingSameAsBilling, setIsShippingSameAsBilling] = useState(true);
  const [isVerifyingGstin, setIsVerifyingGstin] = useState(false);

  // Customer History & Pending Due Tracking
  const [customerSummary, setCustomerSummary] = useState<{
    total_invoices: number;
    total_spent: number;
    total_pending_due: number;
    last_purchase_date: string | null;
  } | null>(null);
  const [includePreviousDueInBill, setIncludePreviousDueInBill] = useState(false);
  const [showPendingDueAlert, setShowPendingDueAlert] = useState(false);
  const [showCustomerLedger, setShowCustomerLedger] = useState(false);
  const [batches, setBatches] = useState<any[]>([]);
  const [aiFetchingHsnId, setAiFetchingHsnId] = useState<string | null>(null);

  const handleVerifyGstin = async () => {
    const cleanGst = newPartyGST.trim().toUpperCase();
    if (!cleanGst || cleanGst.length < 15) {
      toast.error("Please enter a valid 15-character GSTIN");
      return;
    }
    setIsVerifyingGstin(true);
    try {
      const res = await procurementApi.lookupGstin(cleanGst);
      if (res && res.valid) {
        if (res.trade_name) setNewPartyName(res.trade_name);
        else if (res.legal_name) setNewPartyName(res.legal_name);
        if (res.legal_name) setNewPartyCompany(res.legal_name);
        setNewPartyType("B2B");
        
        if (res.state) {
          setNewPartyState(res.state);
          if (isShippingSameAsBilling) setNewPartyShipState(res.state);
        }
        if (res.pincode) {
          setNewPartyPincode(res.pincode);
          if (isShippingSameAsBilling) setNewPartyShipPincode(res.pincode);
        }
        if (res.address?.city) {
          setNewPartyCity(res.address.city);
          if (isShippingSameAsBilling) setNewPartyShipCity(res.address.city);
        }
        if (res.address?.street) {
          setNewPartyStreet(res.address.street);
          if (isShippingSameAsBilling) setNewPartyShipStreet(res.address.street);
        }
        toast.success(`GSTIN Verified: ${res.legal_name} (${res.state || 'Active'})`);
      } else {
        toast.error("GSTIN lookup returned invalid or inactive status");
      }
    } catch (e: any) {
      toast.error(e?.detail || e?.message || "GSTIN lookup failed");
    } finally {
      setIsVerifyingGstin(false);
    }
  };

  const handleSwitchPricingTier = (newMode: "Retail" | "Wholesale" | "B2B") => {
    setPricingMode(newMode);
    setItems((prev) =>
      prev.map((item) => {
        if (!item.product_id) return item;
        const prod = products.find((p) => p.id === item.product_id);
        if (!prod) return item;
        const basePrice = Number(prod.selling_price || prod.price || prod.mrp || item.unit_price || 0);
        const wholesalePrice = Number(prod.wholesale_price || (basePrice * 0.85));
        const b2bPrice = Number(prod.b2b_price || (basePrice * 0.70));
        const newPrice = newMode === "B2B" ? b2bPrice : newMode === "Wholesale" ? wholesalePrice : basePrice;
        return {
          ...item,
          unit_price: newPrice > 0 ? Number(newPrice.toFixed(2)) : item.unit_price,
        };
      })
    );
    toast.success(`Active Pricing Tier switched to ${newMode} Tier`);
  };

  const handleAIFetchHsn = async (itemId: string, productName: string) => {
    if (!productName.trim()) {
      toast.error("Please enter a product name first");
      return;
    }
    try {
      setAiFetchingHsnId(itemId);
      const res: any = await inventoryApi.suggestHsn({ name: productName });
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            const currentPrice = Number(item.unit_price) || 0;
            const currentMrp = Number(item.mrp) || 0;

            const retailPrice = Number(res.estimated_selling_price) || (Number(res.estimated_mrp) ? Number((res.estimated_mrp * 0.85).toFixed(2)) : 150.0);
            const wholesalePrice = Number(res.estimated_wholesale_price) || Number((retailPrice * 0.85).toFixed(2));
            const b2bPrice = Number(res.estimated_b2b_price) || Number((retailPrice * 0.70).toFixed(2));

            const targetAiPrice =
              pricingMode === "B2B" ? b2bPrice : pricingMode === "Wholesale" ? wholesalePrice : retailPrice;
            const aiMrp = Number(res.estimated_mrp) || Number((retailPrice * 1.25).toFixed(2));

            const finalPrice = currentPrice > 0 ? currentPrice : targetAiPrice;
            const finalMrp = currentMrp > 0 ? currentMrp : aiMrp;

            return {
              ...item,
              hsn_code: res.hsn_code,
              tax_rate: res.gst_rate,
              is_tax_inclusive: false,
              unit_price: finalPrice,
              mrp: finalMrp,
            };
          }
          return item;
        })
      );

      const activeTierPrice =
        pricingMode === "B2B"
          ? (res.estimated_b2b_price || Math.round((res.estimated_selling_price || 150) * 0.70))
          : pricingMode === "Wholesale"
          ? (res.estimated_wholesale_price || Math.round((res.estimated_selling_price || 150) * 0.85))
          : (res.estimated_selling_price || Math.round((res.estimated_mrp || 180) * 0.85));

      const priceMsg = ` | ${pricingMode} Price: ₹${activeTierPrice} | MRP: ₹${res.estimated_mrp || Math.round(activeTierPrice * 1.25)}`;
      toast.success(`AI Auto-Classified: "${productName}" → HSN ${res.hsn_code} (${res.gst_rate}% GST)${priceMsg}`);
    } catch (e: any) {
      toast.error(e?.detail || "AI HSN Lookup failed");
    } finally {
      setAiFetchingHsnId(null);
    }
  };

  useEffect(() => {
    posApi
      .getProducts()
      .then((res: any) => setProducts(res?.items || (Array.isArray(res) ? res : [])))
      .catch(console.error);
    inventoryApi
      .getBatches()
      .then((bList: any) => setBatches(bList?.items || (Array.isArray(bList) ? bList : [])))
      .catch(() => setBatches([]));
    crmApi
      .getCustomers(1, 100)
      .then((data: any) => setCustomers(data?.items || (Array.isArray(data) ? data : [])))
      .catch(console.error);
    fetchSalesEmployees()
      .then((emps) => {
        setSalesEmployees(emps);
        if (emps && emps.length > 0) {
          setSalesExecutive(emps[0].full_name);
        } else {
          setSalesExecutive("Sales Executive");
        }
      })
      .catch(console.error);
  }, []);

  const getProductBatchInfo = (prod: any) => {
    if (!prod) return { batch_number: "", expiry_date: "", mrp: 0, unit_price: 0 };
    const basePrice = Number(prod.selling_price || prod.price || prod.mrp || 0);
    const wholesalePrice = Number(prod.wholesale_price || (basePrice * 0.85));
    const b2bPrice = Number(prod.b2b_price || (basePrice * 0.70));
    const targetPrice =
      pricingMode === "B2B"
        ? b2bPrice
        : pricingMode === "Wholesale"
        ? wholesalePrice
        : basePrice;

    const matchingBatches = batches.filter(
      (b) =>
        (b.product_id === prod.id ||
          (b.product_name && prod.name && b.product_name.toLowerCase() === prod.name.toLowerCase())) &&
        Number(b.remaining_quantity || b.quantity || 0) > 0
    ).sort(
      (a, b) =>
        new Date(a.expiry_date || "2099-12-31").getTime() -
        new Date(b.expiry_date || "2099-12-31").getTime()
    );

    const activeBatch = matchingBatches[0];

    return {
      batch_number: activeBatch?.batch_number || "",
      expiry_date: activeBatch?.expiry_date ? String(activeBatch.expiry_date).slice(0, 10) : "",
      mrp: Number(activeBatch?.mrp) > 0 ? Number(activeBatch.mrp) : (prod.mrp || Number((basePrice * 1.25).toFixed(2))),
      unit_price: Number(activeBatch?.selling_price) > 0 ? Number(activeBatch.selling_price) : targetPrice,
    };
  };

  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerSummary(null);
      setIncludePreviousDueInBill(false);
      return;
    }
    const cust = customers.find((c: any) => c.id === selectedCustomer);
    if (!cust) return;

    posApi
      .getCustomerSummary(cust.name, cust.phone)
      .then((summary) => {
        setCustomerSummary(summary);
        if (summary.total_pending_due > 0) {
          setShowPendingDueAlert(true);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch customer summary:", err);
      });
  }, [selectedCustomer, customers]);

  const handlePricingModeChange = (mode: "Retail" | "Wholesale") => {
    setPricingMode(mode);
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (!item.product_id) return item;
        const product = products.find((p) => p.id === item.product_id);
        if (!product) return item;
        const basePrice = product.selling_price || product.price || product.mrp || 0;
        const wholesalePrice = product.wholesale_price || (basePrice * 0.9);
        const targetPrice = mode === "Wholesale" ? wholesalePrice : basePrice;
        return { ...item, unit_price: targetPrice };
      })
    );
  };

  // Multi-Product Selection Modal State
  const [isMultiProductModalOpen, setIsMultiProductModalOpen] = useState(false);
  const [multiProductSearch, setMultiProductSearch] = useState("");
  const [multiProductCategory, setMultiProductCategory] = useState("all");
  const [selectedProductQuantities, setSelectedProductQuantities] = useState<Record<string, number>>({});

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Math.random().toString(36).substr(2, 9),
        product_name: "",
        quantity: 1,
        unit_price: 0,
        discount_value: 0,
        discount_type: "percent",
        tax_rate: 18,
        is_tax_inclusive: false,
        custom_note: "",
        is_note_open: false,
        is_search_open: false,
        search_query: "",
      },
    ]);
  };

  const toggleMultiSelectProduct = (productId: string) => {
    setSelectedProductQuantities((prev) => {
      const next = { ...prev };
      if (next[productId]) {
        delete next[productId];
      } else {
        next[productId] = 1;
      }
      return next;
    });
  };

  const updateMultiSelectQty = (productId: string, delta: number) => {
    setSelectedProductQuantities((prev) => {
      const currentQty = prev[productId] || 1;
      const nextQty = Math.max(1, currentQty + delta);
      return { ...prev, [productId]: nextQty };
    });
  };

  const handleAddMultipleProductsToInvoice = () => {
    const selectedIds = Object.keys(selectedProductQuantities);
    if (selectedIds.length === 0) {
      toast.error("Please select at least one product");
      return;
    }

    const newItems: InvoiceItem[] = [];
    selectedIds.forEach((pid) => {
      const prod = products.find((p) => p.id === pid);
      if (!prod) return;
      const qty = selectedProductQuantities[pid] || 1;
      const batchInfo = getProductBatchInfo(prod);

      newItems.push({
        id: Math.random().toString(36).substr(2, 9),
        product_id: prod.id,
        product_name: prod.name,
        quantity: qty,
        unit_price: batchInfo.unit_price,
        mrp: batchInfo.mrp,
        batch_number: batchInfo.batch_number,
        expiry_date: batchInfo.expiry_date,
        discount_value: 0,
        discount_type: "percent",
        tax_rate: prod.tax_percent || 18,
        is_tax_inclusive: prod.is_tax_inclusive === true,
      });
    });

    setItems((prev) => [...prev, ...newItems]);
    toast.success(`Added ${newItems.length} products to sales invoice!`);
    setSelectedProductQuantities({});
    setIsMultiProductModalOpen(false);
  };

  const handleBarcodeSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcodeInput.trim() !== "") {
      const queryCode = barcodeInput.trim();
      const product = products.find((p) => p.barcode === queryCode || p.sku === queryCode);
      if (product) {
        const batchInfo = getProductBatchInfo(product);

        setItems((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substr(2, 9),
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: batchInfo.unit_price,
            mrp: batchInfo.mrp,
            batch_number: batchInfo.batch_number,
            expiry_date: batchInfo.expiry_date,
            discount_value: 0,
            discount_type: "percent",
            tax_rate: product.tax_percent || 18,
            is_tax_inclusive: product.is_tax_inclusive === true,
          },
        ]);
        toast.success(`Added ${product.name} (${pricingMode} Price)`);
        setBarcodeInput("");
        return;
      }

      // If not in local products state, trigger real-time Master Catalog / RAG / Go-UPC Lookup
      toast.info(`Searching master catalog & web RAG for barcode ${queryCode}...`);
      try {
        const res = await posApi.lookupBarcode(queryCode);
        if (res && res.success && res.product && res.product.name) {
          const p = res.product;
          const basePrice = p.selling_price || p.mrp || 0;
          const wholesalePrice = basePrice * 0.9;
          const targetPrice = pricingMode === "Wholesale" ? wholesalePrice : basePrice;

          setItems((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substr(2, 9),
              product_id: p.id,
              product_name: p.name,
              quantity: 1,
              unit_price: targetPrice,
              mrp: p.mrp || 0,
              discount_value: 0,
              discount_type: "percent",
              tax_rate: p.gst || 18,
              is_tax_inclusive: p.is_tax_inclusive === true,
            },
          ]);
          toast.success(`Found & Added: ${p.name} (${p.source || "Master Catalog"})`);
          setBarcodeInput("");
        } else {
          toast.error(`Barcode ${queryCode} not found in catalog or RAG web registry`);
        }
      } catch (err: any) {
        toast.error(`Barcode search error: ${err.message || "Failed lookup"}`);
      }
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "product_id" && value) {
            const product = products.find((p) => p.id === value);
            if (product) {
              const batchInfo = getProductBatchInfo(product);

              updated.product_name = product.name;
              updated.unit_price = batchInfo.unit_price;
              updated.mrp = batchInfo.mrp;
              updated.hsn_code = product.hsn_code || "1905";
              updated.tax_rate = Number(product.tax_percent) > 0 ? Number(product.tax_percent) : 18;
              updated.is_tax_inclusive = product.is_tax_inclusive === true;
              updated.batch_number = batchInfo.batch_number;
              updated.expiry_date = batchInfo.expiry_date;
              if (!updated.quantity || updated.quantity === 0) {
                updated.quantity = 1;
              }
            }
          }
          return updated;
        }
        return item;
      }),
    );
  };

  const removeItem = (id: string) => setItems(items.filter((item) => item.id !== id));

  // Dynamic Invoice Discount State
  const [invoiceDiscountMode, setInvoiceDiscountMode] = useState<"before_tax" | "after_tax">("before_tax");
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<"percent" | "amount">("percent");
  const [invoiceDiscountValue, setInvoiceDiscountValue] = useState<number>(0);

  // GST Type: intra-state (CGST + SGST) or inter-state (IGST)
  const [gstType, setGstType] = useState<"cgst_sgst" | "igst">("cgst_sgst");

  // Calculated totals with GST Inclusive vs Exclusive Tax Modes
  let subtotal = 0;
  let itemDiscountTotal = 0;
  let totalTaxableValue = 0;
  let totalTax = 0;

  items.forEach((item) => {
    const isIncl = item.is_tax_inclusive === true;
    const price = Number(item.unit_price) || 0;
    const qty = Number(item.quantity) || 1;
    const taxRate = Number(item.tax_rate) || 0;

    const lineGross = qty * price;
    const dAmt = item.discount_type === "percent"
      ? lineGross * (Number(item.discount_value || 0) / 100)
      : Math.min(Number(item.discount_value || 0), lineGross);

    const effectiveGross = Math.max(0, lineGross - dAmt);
    let lineTaxable = 0;
    let lineTax = 0;

    if (isIncl) {
      // Tax Inclusive: Unit price already includes GST
      lineTaxable = taxRate > 0 ? effectiveGross / (1 + taxRate / 100) : effectiveGross;
      lineTax = effectiveGross - lineTaxable;
    } else {
      // Tax Exclusive (Default): GST is added ON TOP of unit price
      lineTaxable = effectiveGross;
      lineTax = (lineTaxable * taxRate) / 100;
    }

    subtotal += lineGross;
    itemDiscountTotal += dAmt;
    totalTaxableValue += lineTaxable;
    totalTax += lineTax;
  });

  // 1. Before-Tax Invoice Discount
  let beforeTaxDiscount = 0;
  if (invoiceDiscountMode === "before_tax" && invoiceDiscountValue > 0) {
    beforeTaxDiscount = invoiceDiscountType === "percent"
      ? totalTaxableValue * (invoiceDiscountValue / 100)
      : Math.min(invoiceDiscountValue, totalTaxableValue);
  }

  const taxableValue = Math.max(0, totalTaxableValue - beforeTaxDiscount);
  const effectiveTotalTax = totalTaxableValue > 0 ? (totalTax * (taxableValue / totalTaxableValue)) : 0;

  // Additional charges: base amount + GST on each charge
  const baseAdditionalCharges = customCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const chargesGstTotal = customCharges.reduce((sum, c) => {
    const amt = Number(c.amount || 0);
    return sum + (amt * (Number(c.tax_rate || 0) / 100));
  }, 0);
  const totalAdditionalCharges = baseAdditionalCharges + chargesGstTotal;
  const combinedTax = effectiveTotalTax + chargesGstTotal;

  // Gross total before after-tax discount
  const grossBillAmount = taxableValue + combinedTax + baseAdditionalCharges;

  // 3. After-Tax Invoice Discount
  let afterTaxDiscount = 0;
  if (invoiceDiscountMode === "after_tax" && invoiceDiscountValue > 0) {
    afterTaxDiscount = invoiceDiscountType === "percent"
      ? grossBillAmount * (invoiceDiscountValue / 100)
      : Math.min(invoiceDiscountValue, grossBillAmount);
  }

  const totalDiscount = itemDiscountTotal + beforeTaxDiscount + afterTaxDiscount;
  const previousDueAmount = (includePreviousDueInBill && customerSummary?.total_pending_due) ? Number(customerSummary.total_pending_due) : 0;
  const baseRawTotal = Math.max(0, grossBillAmount - afterTaxDiscount);
  const rawTotal = baseRawTotal + previousDueAmount;
  const roundOff = autoRoundOff ? Math.round(rawTotal) - rawTotal : 0;
  const grandTotal = autoRoundOff ? Math.round(rawTotal) : rawTotal;

  const activeCustomerObj = customers.find((c) => c.id === selectedCustomer);

  const handleCreateNewParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim()) return toast.error("Party name is required");

    const fullBillingAddress = [newPartyStreet, newPartyCity, newPartyState, newPartyPincode].filter(Boolean).join(", ");
    const fullShippingAddress = isShippingSameAsBilling
      ? fullBillingAddress
      : [newPartyShipStreet, newPartyShipCity, newPartyShipState, newPartyShipPincode].filter(Boolean).join(", ");

    try {
      const created = await crmApi.createCustomer({
        name: newPartyName.trim(),
        phone: newPartyPhone.trim() || undefined,
        email: newPartyEmail.trim() || undefined,
        company_name: newPartyCompany.trim() || undefined,
        customer_type: newPartyType || "Retail",
        gst_number: newPartyGST.trim().toUpperCase() || undefined,
        address: fullBillingAddress || undefined,
        billing_address: fullBillingAddress || undefined,
        shipping_address: fullShippingAddress || undefined,
      });
      const customerObj = created.data || created;
      customerObj.state = newPartyState;
      customerObj.billing_address = fullBillingAddress;
      customerObj.shipping_address = fullShippingAddress;
      setCustomers([customerObj, ...customers]);
      setSelectedCustomer(customerObj.id);

      // Check Inter-State vs Intra-State
      const cleanGst = newPartyGST.trim().toUpperCase();
      if (
        (cleanGst.length >= 2 && !cleanGst.startsWith("37")) ||
        (!newPartyState.toLowerCase().includes("andhra") && !newPartyState.toLowerCase().includes("ap"))
      ) {
        setGstType("igst");
        toast.info(`Inter-State Customer Created (${newPartyState}). Tax switched to IGST.`);
      } else {
        setGstType("cgst_sgst");
      }

      setIsAddPartyOpen(false);
      setNewPartyName("");
      setNewPartyPhone("");
      setNewPartyEmail("");
      setNewPartyCompany("");
      setNewPartyGST("");
      setNewPartyStreet("");
      setNewPartyCity("");
      setNewPartyState("Andhra Pradesh");
      setNewPartyPincode("");
      setNewPartyShipStreet("");
      setNewPartyShipCity("");
      setNewPartyShipState("Andhra Pradesh");
      setNewPartyShipPincode("");
      setIsShippingSameAsBilling(true);
      setNewPartyType("Retail");
      toast.success(`Party "${customerObj.name}" saved & selected!`);
    } catch (err: any) {
    }
  };

  const handleCreateNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return toast.error("Product name is required");
    const unitPriceVal = Number(newProdPrice) || 0;
    const mrpVal = Number(newProdMrp) || unitPriceVal;
    const wholesaleVal = Number(newProdWholesalePrice) || Number((unitPriceVal * 0.85).toFixed(2));
    const b2bVal = Number(newProdB2bPrice) || Number((unitPriceVal * 0.70).toFixed(2));
    const generatedProduct = {
      id: `prod-${Date.now()}`,
      name: newProdName.trim(),
      sku: newProdSku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      barcode: newProdBarcode.trim() || `BC-${Date.now().toString().slice(-4)}`,
      category: newProdCategory,
      selling_price: unitPriceVal,
      wholesale_price: wholesaleVal,
      b2b_price: b2bVal,
      mrp: mrpVal,
      tax_percent: Number(newProdTax) || 18,
      stock_quantity: Number(newProdStock) || 100,
    };

    const targetTierPrice =
      pricingMode === "B2B" ? b2bVal : pricingMode === "Wholesale" ? wholesaleVal : unitPriceVal;

    setProducts([generatedProduct, ...products]);
    setItems([
      ...items,
      {
        id: Math.random().toString(36).substr(2, 9),
        product_id: generatedProduct.id,
        product_name: generatedProduct.name,
        quantity: 1,
        unit_price: targetTierPrice,
        mrp: generatedProduct.mrp,
        discount_value: 0,
        discount_type: "percent",
        tax_rate: generatedProduct.tax_percent,
      },
    ]);

    setIsAddProductOpen(false);
    setNewProdName("");
    setNewProdSku("");
    setNewProdBarcode("");
    setNewProdPrice("");
    setNewProdWholesalePrice("");
    setNewProdB2bPrice("");
    setNewProdMrp("");
    toast.success(`Created "${generatedProduct.name}" & added to bill!`);
  };

  const [printedBill, setPrintedBill] = useState<any>(null);
  const [fullInvoiceModalData, setFullInvoiceModalData] = useState<FullInvoiceData | null>(null);
  const [isFullInvoiceOpen, setIsFullInvoiceOpen] = useState(false);
  const [autoPrintFullInvoice, setAutoPrintFullInvoice] = useState(false);

  const constructFullInvoicePayload = (): FullInvoiceData => {
    const customerObj = customers.find((c) => c.id === selectedCustomer);
    return {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      customerName: customerObj?.name || 'Walk-in Customer',
      customerPhone: customerObj?.phone || '',
      customerEmail: customerObj?.email || '',
      customerCompany: customerObj?.company || '',
      customerGST: customerObj?.gst_number || '',
      customerAddress: customerObj?.address || '',
      customerType: customerObj?.customer_type || 'Retail',
      items: items.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name || 'Item',
        hsn_code: it.hsn_code,
        quantity: Number(it.quantity || 0),
        unit_price: Number(it.unit_price || 0),
        mrp: Number(it.mrp || 0),
        discount_type: it.discount_type === 'amount' ? 'fixed' : (it.discount_type as any),
        discount_value: Number(it.discount_value || 0),
        tax_rate: Number(it.tax_rate || 0),
      })),
      subtotal: subtotal,
      discount_amount: totalDiscount,
      tax_amount: totalTax,
      additional_charges: customCharges
        .filter(c => Number(c.amount) > 0)
        .map(c => ({ name: c.name || 'Additional Charge', amount: Number(c.amount) })),
      round_off: autoRoundOff ? roundOff : undefined,
      grand_total: grandTotal,
      payment_method: paymentMode,
      payment_status: paymentMode === "Credit" ? 'UNPAID' : (Number(amountReceived) >= grandTotal ? 'PAID' : 'PARTIAL'),
      amount_received: paymentMode !== "Credit" && amountReceived !== "" ? Number(amountReceived) : undefined,
      terms: notes || undefined,
    };
  };


  const handlePreviewFullInvoice = () => {
    if (items.length === 0) return toast.error("Please add at least one item to preview invoice.");
    const payload = constructFullInvoicePayload();
    setFullInvoiceModalData(payload);
    setAutoPrintFullInvoice(false);
    setIsFullInvoiceOpen(true);
  };

  const handlePrintThermal = () => {
    if (items.length === 0) return toast.error("Please add items to invoice before printing receipt.");
    const customerObj = customers.find((c) => c.id === selectedCustomer);
    const billData = {
      invoice_number: invoiceNumber,
      date: invoiceDate,
      customerName: customerObj?.name || 'Walk-in Customer',
      customerPhone: customerObj?.phone || '',
      items: items.map(it => ({
        name: it.product_name || 'Item',
        quantity: it.quantity,
        unit_price: it.unit_price,
        hsn_code: it.hsn_code,
        discount: it.discount_type === 'percent' ? (it.quantity * it.unit_price * it.discount_value / 100) : it.discount_value,
        subtotal: (it.quantity * it.unit_price) - (it.discount_type === 'percent' ? (it.quantity * it.unit_price * it.discount_value / 100) : it.discount_value)
      })),
      subtotal: subtotal,
      discount_amount: totalDiscount,
      tax_amount: totalTax,
      grand_total: grandTotal,
      payment_method: paymentMode,
      payment_status: paymentMode === "Credit" ? 'UNPAID' : (Number(amountReceived) >= grandTotal ? 'PAID' : 'PARTIAL')
    };
    setPrintedBill(billData);
    setTimeout(() => {
      triggerThermalPrint();
    }, 100);
  };

  const resetInvoiceForm = () => {
    setItems([]);
    setSelectedCustomer("");
    setCustomerSummary(null);
    setAmountReceived("");
    setNotes("");
    setInvoiceDiscountValue(0);
    setIncludePreviousDueInBill(false);
    const seq = Math.floor(10000 + Math.random() * 90000);
    setInvoiceNumber(`INV-${seq}`);
  };

  const handleSave = async (printMode: 'a4' | 'thermal' | 'none' = 'a4') => {
    if (!selectedCustomer) return toast.error("Please select a customer or party first.");
    if (items.length === 0) return toast.error("Please add at least one item.");
    try {
      setIsSaving(true);
      const customer = customers.find((c) => c.id === selectedCustomer);
      const isCredit = paymentMode === "Credit";
      const calculatedPaymentStatus = isCredit
        ? "UNPAID"
        : (amountReceived === "" || Number(amountReceived) >= grandTotal ? "PAID" : "PARTIAL");

      const createResult = await invoicesApi.createInvoice({
        customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone || "",
        customer_email: customer.email || "",
        customer_gstin: customer.gst_number || "",
        billing_address: customer.address || "",
        invoice_date: invoiceDate,
        due_date: dueDate,
        payment_method: paymentMode,
        payment_status: calculatedPaymentStatus,
        lines: items.map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name || "Unknown Item",
          quantity: it.quantity,
          unit_price: it.unit_price,
          mrp: it.mrp || 0,
          batch_number: it.batch_number || null,
          expiry_date: it.expiry_date || null,
          mfg_date: it.mfg_date || null,
          hsn_code: it.hsn_code || null,
          discount_type: it.discount_type,
          discount_value: it.discount_value,
          tax_rate: it.tax_rate,
        })),
      });

      const apiInvoice = (createResult as any)?.data || createResult;
      const backendInvoiceNumber = apiInvoice?.invoice_number || invoiceNumber;
      const backendId = apiInvoice?.id || `inv-${Date.now()}`;

      const earnedPts = Math.floor(grandTotal / 100);
      const selectedEmp = salesEmployees.find(e => e.full_name === salesExecutive);
      if (selectedEmp && earnedPts > 0) {
        employeesApi.addSalesPoints(selectedEmp.id, earnedPts).then((updatedEmp) => {
          if (updatedEmp) {
            setSalesEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
          }
        }).catch(console.error);
      }

      // Persist to pos_saved_invoices in localStorage for instant Invoices History tab sync
      const newInvoiceRecord = {
        id: backendId,
        invoice_number: backendInvoiceNumber,
        customer_name: customer?.name || "Walk-in Customer",
        customer_phone: customer?.phone || "",
        customer_gstin: customer?.gst_number || "",
        sales_executive: salesExecutive || "Sales Executive",
        sales_points_earned: earnedPts,
        invoice_date: invoiceDate,
        due_date: dueDate,
        payment_mode: isCredit ? "Credit / Due" : paymentMode,
        payment_status: isCredit ? "Unpaid" : (amountReceived === "" || Number(amountReceived) >= grandTotal ? "Paid" : "Partial"),
        subtotal: subtotal,
        total_tax: combinedTax,
        discount_amount: totalDiscount,
        grand_total: grandTotal,
        amount_received: isCredit ? 0 : (amountReceived === "" ? grandTotal : (Number(amountReceived) || 0)),
        print_status: printMode === 'thermal' ? 'Thermal Printed' : printMode === 'a4' ? 'A4 PDF Generated' : 'Pending Print',
        items: items.map(it => ({
          product_name: it.product_name || "Item",
          quantity: it.quantity,
          unit_price: it.unit_price,
          mrp: it.mrp || 0,
          hsn_code: it.hsn_code || "",
          tax_rate: it.tax_rate || 18,
        }))
      };

      // Remove any stale record that shares the same frontend-generated invoiceNumber
      // so we don't end up with duplicates after the backend overwrites it
      const stored = localStorage.getItem("pos_saved_invoices");
      const list = stored ? JSON.parse(stored) : [];
      const cleaned = list.filter((r: any) => r.invoice_number !== invoiceNumber);
      localStorage.setItem("pos_saved_invoices", JSON.stringify([newInvoiceRecord, ...cleaned]));

      toast.success(`Sales Invoice ${invoiceNumber} saved! +${earnedPts} sales points awarded to ${salesExecutive || 'Sales Rep'}.`);

      if (printMode === 'a4') {
        const payload = constructFullInvoicePayload();
        setFullInvoiceModalData(payload);
        setAutoPrintFullInvoice(true);
        setIsFullInvoiceOpen(true);
      } else if (printMode === 'thermal') {
        handlePrintThermal();
      }

      // Auto-reset form state to prepare for next invoice transaction
      resetInvoiceForm();
    } catch (error: any) {
      toast.error(error?.detail || "Failed to create invoice");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-800">
      <ThermalReceiptPrinter bill={printedBill} />
      {/* Sleek Modern Header */}
      <div className="flex justify-between items-center mb-6 px-6 lg:px-8 pt-6 lg:pt-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Create Sales Invoice</h2>
          <p className="text-sm text-slate-500 mt-1">Draft sales receipt & manage line item billing</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Location Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold">
            <span className="text-slate-400 font-normal">Location:</span>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="bg-transparent text-slate-800 font-bold outline-none cursor-pointer"
            >
              <option value="Store Main Branch">Store Main Branch</option>
              <option value="Central Warehouse">Central Warehouse</option>
              <option value="Secondary Warehouse">Secondary Warehouse</option>
            </select>
          </div>

          {/* Sales Representative Selector & Commission Points */}
          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-2.5 py-1 text-xs font-semibold">
            <span className="text-amber-700 font-normal">Sales Rep:</span>
            <select
              value={salesExecutive}
              onChange={(e) => setSalesExecutive(e.target.value)}
              className="bg-transparent text-amber-950 font-bold outline-none cursor-pointer"
            >
              {salesEmployees && salesEmployees.length > 0 ? (
                salesEmployees.map((emp) => (
                  <option key={emp.id} value={emp.full_name}>
                    {emp.full_name} ({emp.employee_code})
                  </option>
                ))
              ) : (
                <option value="">Select Sales Executive</option>
              )}
            </select>
            {(() => {
              const selectedEmp = salesEmployees.find(e => e.full_name === salesExecutive);
              const totalPts = ((selectedEmp?.sales_points || 0) + Math.floor(grandTotal / 100)).toFixed(0);
              return (
                <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded text-[10px] font-black" title="Points earned for this invoice (Total accumulated points)">
                  +{Math.floor(grandTotal / 100)} Pts {selectedEmp ? `(Total: ${totalPts} Pts)` : ''}
                </span>
              );
            })()}
          </div>

          {/* Pricing Tier Mode Selector */}
          <div className="flex items-center bg-slate-100 p-1 border border-slate-200 rounded-xl text-xs font-bold gap-0.5">
            <button
              onClick={() => handleSwitchPricingTier("Retail")}
              className={`px-2.5 py-1 rounded-lg transition-all ${pricingMode === "Retail" ? "bg-white text-blue-600 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
            >
              🛒 Retail
            </button>
            <button
              onClick={() => handleSwitchPricingTier("Wholesale")}
              className={`px-2.5 py-1 rounded-lg transition-all ${pricingMode === "Wholesale" ? "bg-purple-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
            >
              📦 Wholesale
            </button>
            <button
              onClick={() => handleSwitchPricingTier("B2B")}
              className={`px-2.5 py-1 rounded-lg transition-all ${pricingMode === "B2B" ? "bg-indigo-700 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
            >
              🏢 B2B Contract
            </button>
          </div>

          {/* Inline Create Product Trigger Button */}
          <button
            onClick={() => setIsAddProductOpen(true)}
            className="px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-all shadow-sm flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> + New Product
          </button>

          <button
            onClick={handlePreviewFullInvoice}
            className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            title="Preview A4 Invoice using selected print template"
          >
            <FileText className="w-4 h-4 text-blue-600" /> Preview Invoice
          </button>
          <button
            onClick={handlePrintThermal}
            className="px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            title="Print 80mm Thermal Receipt"
          >
            <QrCode className="w-4 h-4 text-indigo-600" /> Thermal 80mm
          </button>
          <button
            onClick={resetInvoiceForm}
            className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-all shadow-sm"
          >
            Clear All
          </button>
          <button
            disabled={isSaving}
            onClick={() => handleSave('none')}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-all shadow-sm disabled:opacity-50"
          >
            Save Only
          </button>
          <button
            disabled={isSaving}
            onClick={() => handleSave('thermal')}
            className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <QrCode className="w-3.5 h-3.5" /> Save & Thermal
          </button>
          <button
            disabled={isSaving}
            onClick={() => handleSave('a4')}
            className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save & Download A4 Invoice (PDF)"}
          </button>
        </div>
      </div>

      <div className="p-6 lg:p-8 space-y-8 w-full max-w-full">
        {/* Top Info Grid: Bill To & Invoice Info */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Bill To Card (7 cols) */}
          <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-4 h-4 text-blue-600" /> Bill To / Customer Party
              </span>
              <button
                type="button"
                onClick={() => setIsAddPartyOpen(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" /> + Add New Party
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
              >
                <option value="">-- Select Customer / Party --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""} {c.company ? `- ${c.company}` : ""}
                  </option>
                ))}
              </select>

              {activeCustomerObj ? (
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        {activeCustomerObj.name}
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          Active Party
                        </span>
                      </div>
                      <div className="text-slate-500 flex items-center gap-4 text-[11px]">
                        {activeCustomerObj.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" /> {activeCustomerObj.phone}
                          </span>
                        )}
                        {activeCustomerObj.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" /> {activeCustomerObj.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer("")}
                      className="text-xs text-slate-400 hover:text-red-500 font-semibold"
                    >
                      Change Party
                    </button>
                  </div>

                  {/* Customer History & Outstanding Dues Summary */}
                  {customerSummary && (
                    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-3.5 space-y-2.5 shadow-md border border-indigo-900/50">
                      <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
                        <span className="font-bold text-indigo-200 flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5 text-indigo-400" /> Complete Purchase History
                        </span>
                        <span className="text-[11px] text-slate-300">
                          Total Orders: <strong className="text-white">{customerSummary.total_invoices}</strong> | Total Spent: <strong className="text-emerald-400">{currency.symbol}{Number(customerSummary.total_spent || 0).toFixed(2)}</strong>
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-amber-400" />
                          <div>
                            <div className="text-[10px] text-slate-300 font-medium">Pending Outstanding Due</div>
                            <div className={`text-sm font-extrabold ${Number(customerSummary.total_pending_due || 0) > 0 ? "text-amber-300" : "text-emerald-400"}`}>
                              {currency.symbol}{Number(customerSummary.total_pending_due || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>


                        {customerSummary.total_pending_due > 0 ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setShowCustomerLedger(true)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm border border-indigo-500"
                            >
                              View Ledger
                            </button>
                            <button
                              type="button"
                              onClick={() => setIncludePreviousDueInBill(!includePreviousDueInBill)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                includePreviousDueInBill
                                  ? "bg-amber-500 text-slate-950 shadow-sm"
                                  : "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border border-amber-500/40"
                              }`}
                            >
                              {includePreviousDueInBill ? "✓ Due Added" : `+ Add Due (₹${customerSummary.total_pending_due.toFixed(2)})`}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                            ✓ Clear Account (No Pending Dues)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                  <p className="text-xs text-slate-500">Select an existing party above or click Add New Party</p>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Details Card (5 cols) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" /> Invoice Metadata
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500">Sales Invoice No</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  readOnly
                  className="w-full h-9 bg-slate-100 border border-slate-200 rounded-xl px-3 text-xs font-bold text-slate-700 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500">Invoice Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPaymentTerms(val);
                      if (val !== "custom") {
                        const days = parseInt(val, 10);
                        if (!isNaN(days)) {
                          setDueDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
                        }
                      }
                    }}
                    className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0">Immediate / Cash (Net 0)</option>
                    <option value="7">Net 7 Days</option>
                    <option value="15">Net 15 Days</option>
                    <option value="30">Net 30 Days</option>
                    <option value="45">Net 45 Days</option>
                    <option value="60">Net 60 Days</option>
                    <option value="90">Net 90 Days</option>
                    <option value="custom">✏️ Custom Payment Terms...</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Custom Payment Terms Description / Days input */}
              {paymentTerms === "custom" && (
                <div className="grid grid-cols-2 gap-3 p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-800">Custom Terms Description</label>
                    <input
                      type="text"
                      placeholder="e.g. 50% Advance, 50% on Delivery"
                      value={customPaymentTermsText}
                      onChange={(e) => setCustomPaymentTermsText(e.target.value)}
                      className="w-full h-8 bg-white border border-blue-200 rounded-lg px-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-blue-800">Days to Payment</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Days"
                      value={customPaymentDays}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : Number(e.target.value);
                        setCustomPaymentDays(val);
                        if (typeof val === "number" && !isNaN(val)) {
                          setDueDate(new Date(Date.now() + val * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
                        }
                      }}
                      className="w-full h-8 bg-white border border-blue-200 rounded-lg px-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Itemized Line Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" /> Line Items & Services ({items.length})
            </h2>

            {/* Quick Barcode Search Bar */}
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-sm w-72 focus-within:ring-2 focus-within:ring-blue-500">
              <ScanBarcode className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeSubmit}
                placeholder="Scan or type SKU / barcode..."
                className="bg-transparent border-none text-xs text-slate-800 outline-none w-full"
              />
            </div>
          </div>

          {/* ===== Fixed-position autocomplete portal dropdown ===== */}
          {dropdownAnchor && (() => {
            const openItem = items.find(it => it.id === dropdownAnchor.itemId);
            if (!openItem || !openItem.is_search_open) return null;
            const matchP = products.filter(
              (p) =>
                !openItem.search_query ||
                p.name.toLowerCase().includes((openItem.search_query || "").toLowerCase()) ||
                (p.barcode && p.barcode.toLowerCase().includes((openItem.search_query || "").toLowerCase())) ||
                (p.sku && p.sku.toLowerCase().includes((openItem.search_query || "").toLowerCase()))
            );
            return (
              <div
                style={{
                  position: "fixed",
                  top: dropdownAnchor.top,
                  left: dropdownAnchor.left,
                  width: Math.max(dropdownAnchor.width, 340),
                  zIndex: 9999,
                }}
                className="bg-white border border-slate-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100"
              >
                {matchP.slice(0, 12).map((prod) => (
                  <div
                    key={prod.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const batchInfo = getProductBatchInfo(prod);
                      setItems((prev) =>
                        prev.map((it) =>
                          it.id === dropdownAnchor.itemId
                            ? {
                                ...it,
                                product_id: prod.id,
                                product_name: prod.name,
                                search_query: prod.name,
                                unit_price: batchInfo.unit_price,
                                mrp: batchInfo.mrp,
                                batch_number: batchInfo.batch_number,
                                expiry_date: batchInfo.expiry_date,
                                hsn_code: prod.hsn_code || "1905",
                                tax_rate: prod.tax_percent || 18,
                                is_tax_inclusive: prod.is_tax_inclusive !== false,
                                is_search_open: false,
                              }
                            : it
                        )
                      );
                      setDropdownAnchor(null);
                    }}
                    className="p-2.5 hover:bg-blue-50 cursor-pointer text-xs flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{prod.name}</div>
                      <div className="text-[10px] text-slate-500">
                        SKU: {prod.sku || "N/A"} | Stock: {prod.stock ?? prod.initial_stock ?? 0} | {prod.is_tax_inclusive !== false ? "✅ Incl. GST" : "🔶 Excl. GST"}
                      </div>
                    </div>
                    <div className="text-right font-extrabold text-blue-700 ml-3 shrink-0">
                      <div>
                        {currency.symbol}{Number(
                          pricingMode === "B2B"
                            ? (prod.b2b_price || (prod.selling_price || prod.mrp || 0) * 0.70)
                            : pricingMode === "Wholesale"
                            ? (prod.wholesale_price || (prod.selling_price || prod.mrp || 0) * 0.85)
                            : (prod.selling_price || prod.mrp || 0)
                        ).toFixed(2)}
                      </div>
                      <div className="text-[9px] font-normal text-slate-400">
                        {pricingMode} Price
                      </div>
                    </div>
                  </div>
                ))}
                {matchP.length === 0 && (
                  <div className="p-3 text-xs text-slate-400 text-center">No products found</div>
                )}
              </div>
            );
          })()}

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="px-3 py-3 w-10 text-center">#</th>
                  <th className="px-3 py-3 min-w-[240px]">Items / Services</th>
                  <th className="px-3 py-3 w-24">HSN/SAC</th>
                  <th className="px-3 py-3 w-24">Batch</th>
                  <th className="px-3 py-3 w-28">Exp Date</th>
                  <th className="px-3 py-3 w-20 text-right">MRP</th>
                  <th className="px-3 py-3 w-20 text-right">Qty</th>
                  <th className="px-3 py-3 w-24 text-right">Price/Item</th>
                  <th className="px-3 py-3 w-28 text-right">Discount</th>
                  <th className="px-3 py-3 w-28 text-right">GST Tax</th>
                  <th className="px-3 py-3 w-28 text-right font-bold">Amount ({currency.symbol})</th>
                  <th className="px-3 py-3 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length > 0 ? (
                  items.map((item, idx) => {
                    const isIncl = item.is_tax_inclusive === true;
                    const price = Number(item.unit_price) || 0;
                    const qty = Number(item.quantity) || 1;
                    const taxRate = Number(item.tax_rate) || 0;

                    let baseUnitPrice = price;
                    if (isIncl && taxRate > 0) {
                      baseUnitPrice = price / (1 + taxRate / 100);
                    }

                    const lineGross = qty * (isIncl ? baseUnitPrice : price);
                    const dAmt = item.discount_type === "percent"
                      ? lineGross * (item.discount_value / 100)
                      : Math.min(item.discount_value, lineGross);

                    const lineTaxable = Math.max(0, lineGross - dAmt);
                    const lineTaxAmount = (lineTaxable * taxRate) / 100;
                    const lineAmount = isIncl ? (qty * price - dAmt) : (lineTaxable + lineTaxAmount);

                    const matchingProducts = products.filter(
                      (p) =>
                        !item.search_query ||
                        p.name.toLowerCase().includes((item.search_query || "").toLowerCase()) ||
                        (p.barcode && p.barcode.toLowerCase().includes((item.search_query || "").toLowerCase())) ||
                        (p.sku && p.sku.toLowerCase().includes((item.search_query || "").toLowerCase()))
                    );

                    const sellingPriceIncl = isIncl ? price : price * (1 + taxRate / 100);
                    const mrpVal = Number(item.mrp) || 0;
                    const isMrpExceeded = mrpVal > 0 && sellingPriceIncl > mrpVal;

                    return (
                      <React.Fragment key={item.id}>
                      <tr className={`transition-colors ${isMrpExceeded ? "bg-red-50/40" : "hover:bg-slate-50/80"}`}>
                        <td className="px-3 py-2.5 text-slate-400 font-mono font-medium">{idx + 1}</td>

                        {/* Product Search & Dropdown */}
                        <td className="px-3 py-2.5">
                          <div className="relative">
                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 focus-within:border-blue-500 focus-within:bg-white rounded-lg px-2 py-1.5 transition-all">
                              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                placeholder="Search product name / scan barcode..."
                                value={item.product_name || item.search_query || ""}
                                onChange={(e) => {
                                  updateItem(item.id, "product_name", e.target.value);
                                  updateItem(item.id, "search_query", e.target.value);
                                  if (!item.is_search_open) {
                                    updateItem(item.id, "is_search_open", true);
                                  }
                                }}
                                onFocus={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setDropdownAnchor({
                                    itemId: item.id,
                                    top: rect.bottom + window.scrollY,
                                    left: rect.left + window.scrollX,
                                    width: rect.width,
                                  });
                                  setItems(items.map((it) => (it.id === item.id ? { ...it, is_search_open: true } : it)));
                                }}
                                onBlur={() => {
                                  // Delay so onMouseDown on dropdown items fires first
                                  setTimeout(() => {
                                    setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, is_search_open: false } : it));
                                    setDropdownAnchor(null);
                                  }, 150);
                                }}
                                className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                              />
                              {/* GST Mode Interactive Toggle Badge */}
                              <button
                                type="button"
                                onClick={() => updateItem(item.id, "is_tax_inclusive", !isIncl)}
                                title={isIncl ? "Tax Inclusive: Price includes GST. Click to switch to Tax Exclusive (Add GST on top)" : "Tax Exclusive: GST is added on top of Price. Click to switch to Tax Inclusive"}
                                className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider transition-all hover:scale-105 cursor-pointer shadow-2xs ${
                                  isIncl
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
                                    : "bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100"
                                }`}
                              >
                                {isIncl ? "INCL" : "EXCL"}
                              </button>
                              {/* Note icon */}
                              <button
                                type="button"
                                onClick={() => updateItem(item.id, "is_note_open", !item.is_note_open)}
                                title="Add item note"
                                className={`shrink-0 p-0.5 rounded transition-all ${
                                  item.custom_note ? "text-blue-600" : "text-slate-300 hover:text-blue-500"
                                }`}
                              >
                                <MessageSquare className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Custom Note Box */}
                            {item.is_note_open && (
                              <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded-lg space-y-1 shadow">
                                <div className="flex items-center justify-between text-[10px] font-bold text-blue-800">
                                  <span className="flex items-center gap-1"><StickyNote className="w-3 h-3" /> Note</span>
                                  <button onClick={() => updateItem(item.id, "is_note_open", false)} className="text-blue-500">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="e.g. Serial #, Gift wrap..."
                                  value={item.custom_note || ""}
                                  onChange={(e) => updateItem(item.id, "custom_note", e.target.value)}
                                  className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-xs text-slate-800 outline-none"
                                />
                              </div>
                            )}

                            {/* Active Note Badge */}
                            {!item.is_note_open && item.custom_note && (
                              <div
                                onClick={() => updateItem(item.id, "is_note_open", true)}
                                className="mt-0.5 text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded cursor-pointer flex items-center gap-1 w-fit"
                              >
                                <StickyNote className="w-2.5 h-2.5" /> {item.custom_note}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="HSN"
                              value={item.hsn_code || ""}
                              onChange={(e) => updateItem(item.id, "hsn_code", e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center outline-none font-mono text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleAIFetchHsn(item.id, item.product_name)}
                              disabled={aiFetchingHsnId === item.id || !item.product_name}
                              className="p-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 shrink-0 transition"
                              title="AI Auto-Fetch HSN & GST Rate"
                            >
                              {aiFetchingHsnId === item.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            placeholder="Batch"
                            value={item.batch_number || ""}
                            onChange={(e) => updateItem(item.id, "batch_number", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center outline-none font-mono"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="date"
                            value={item.expiry_date || ""}
                            onChange={(e) => updateItem(item.id, "expiry_date", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-[11px] outline-none"
                          />
                        </td>
                        {/* MRP Cell — red border + warning icon if exceeded */}
                        <td className="px-3 py-2 text-right align-middle">
                          <div className={`relative flex items-center justify-end gap-0.5 rounded-lg border ${isMrpExceeded ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                            <input
                              type="number"
                              min="0"
                              value={item.mrp || 0}
                              onChange={(e) => updateItem(item.id, "mrp", Number(e.target.value))}
                              className="w-14 bg-transparent px-2 py-1 text-right outline-none text-xs font-semibold"
                            />
                            {isMrpExceeded && (
                              <span title={`Price ₹${priceExclTax.toFixed(2)} > MRP ₹${mrpVal.toFixed(2)}`}>
                                <AlertTriangle className="w-3 h-3 text-red-500 mr-1 shrink-0" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, "quantity", Math.max(1, Number(e.target.value)))}
                            className="w-14 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold outline-none"
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateItem(item.id, "unit_price", Number(e.target.value))}
                            className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-right font-bold text-blue-700 outline-none"
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <select
                              value={item.discount_type}
                              onChange={(e) => updateItem(item.id, "discount_type", e.target.value)}
                              className="bg-slate-100 border border-slate-200 rounded-md px-1 py-1 text-[10px] font-bold"
                            >
                              <option value="percent">%</option>
                              <option value="amount">{currency.symbol}</option>
                            </select>
                            <input
                              type="number"
                              min="0"
                              value={item.discount_value}
                              onChange={(e) => updateItem(item.id, "discount_value", Number(e.target.value))}
                              className="w-14 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-right outline-none"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <select
                            value={item.tax_rate}
                            onChange={(e) => updateItem(item.id, "tax_rate", Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-right text-[11px] outline-none font-bold"
                          >
                            <option value={0}>0% GST</option>
                            <option value={5}>5% GST</option>
                            <option value={12}>12% GST</option>
                            <option value={18}>18% GST</option>
                            <option value={28}>28% GST</option>
                          </select>
                        </td>
                        <td className="px-3 py-3 text-right font-extrabold text-slate-900 text-sm">
                          {currency.symbol}{Number(lineAmount || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {/* MRP exceeded warning row */}
                      {isMrpExceeded && (
                        <tr key={`${item.id}-mrp-warn`} className="bg-red-100 border-l-4 border-red-500">
                          <td colSpan={12} className="px-4 py-1.5">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-red-800">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 animate-pulse" />
                              <span>
                                ⚠️ MRP Exceeded! Selling price {currency.symbol}{sellingPriceIncl.toFixed(2)} (incl. tax) &gt; MRP {currency.symbol}{mrpVal.toFixed(2)}.
                                Please reduce the price or obtain approval before saving.
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={12} className="text-center py-10 text-slate-400">
                      No line items added yet. Click "+ Add Line Item" or scan a barcode above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handleAddItem}
                className="bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Single Blank Row
              </button>
              <button
                onClick={() => setIsMultiProductModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-sm shadow-blue-200"
              >
                <Boxes className="w-4 h-4 text-blue-200" />
                📦 Multi-Select Products
                <span className="bg-white/20 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {products.length} Items
                </span>
              </button>
            </div>
            {items.length > 0 && (
              <span className="text-xs font-semibold text-slate-500">
                {items.length} line {items.length === 1 ? "item" : "items"} in invoice
              </span>
            )}
          </div>
        </div>

        {/* Invoice Footer: Terms, Notes & Summary Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Footer Details (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-500" /> Terms and Conditions
              </label>
              <textarea
                rows={3}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                Customer Notes & Payment Options
              </label>
              <input
                type="text"
                placeholder="Add special delivery instructions or payment reference notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="pt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showPaymentQR}
                    onChange={(e) => setShowPaymentQR(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <QrCode className="w-4 h-4 text-purple-600" /> Print UPI Payment QR Code on Receipt
                </label>
              </div>
            </div>
          </div>

          {/* Right Billing Totals Box (5 cols) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>Billing Financial Summary</span>
                <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-black">Invoice Discount</span>
              </h3>

              {/* Dynamic Invoice Discount Selector */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">Discount Calculation Mode</span>
                  <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-200 text-[10px] font-bold">
                    <button
                      onClick={() => setInvoiceDiscountMode("before_tax")}
                      className={`px-2 py-0.5 rounded-md transition-all ${invoiceDiscountMode === "before_tax" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900"}`}
                    >
                      Before Tax
                    </button>
                    <button
                      onClick={() => setInvoiceDiscountMode("after_tax")}
                      className={`px-2 py-0.5 rounded-md transition-all ${invoiceDiscountMode === "after_tax" ? "bg-purple-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900"}`}
                    >
                      After Tax
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
                    {[0, 5, 10, 15, 20, 25].map(val => (
                      <button
                        key={val}
                        onClick={() => { setInvoiceDiscountType("percent"); setInvoiceDiscountValue(val); }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0 ${invoiceDiscountType === "percent" && invoiceDiscountValue === val ? (invoiceDiscountMode === "before_tax" ? "bg-indigo-600 text-white shadow-xs" : "bg-purple-600 text-white shadow-xs") : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}
                      >
                        {val === 0 ? "Off" : `${val}%`}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shrink-0 w-28">
                    <input
                      type="number"
                      min="0"
                      placeholder="Custom"
                      value={invoiceDiscountValue || ""}
                      onChange={(e) => setInvoiceDiscountValue(Math.max(0, Number(e.target.value)))}
                      className="w-14 text-center text-xs font-bold text-slate-800 outline-none"
                    />
                    <button
                      onClick={() => setInvoiceDiscountType(invoiceDiscountType === "percent" ? "amount" : "percent")}
                      className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-black text-slate-700 hover:bg-slate-200"
                    >
                      {invoiceDiscountType === "percent" ? "%" : "₹"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between text-xs text-slate-600">
                <span>Gross Subtotal:</span>
                <span className="font-semibold text-slate-900">{currency.symbol}{subtotal.toFixed(2)}</span>
              </div>

              {itemDiscountTotal > 0 && (
                <div className="flex justify-between text-xs text-rose-500">
                  <span>Line Item Savings:</span>
                  <span className="font-semibold">-{currency.symbol}{itemDiscountTotal.toFixed(2)}</span>
                </div>
              )}

              {beforeTaxDiscount > 0 && (
                <div className="flex justify-between text-xs text-indigo-600 font-bold">
                  <span>Before-Tax Discount ({invoiceDiscountType === "percent" ? `${invoiceDiscountValue}%` : "Flat"}):</span>
                  <span className="font-black">-{currency.symbol}{beforeTaxDiscount.toFixed(2)}</span>
                </div>
              )}

              {/* Dynamic Custom Additional Charges */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-700">Additional Charges</span>
                  <button
                    type="button"
                    onClick={handleAddChargeRow}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md transition-all flex items-center gap-1"
                  >
                    + Add Charge Field
                  </button>
                </div>

                {customCharges.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No additional charges added.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {customCharges.map((charge) => (
                      <div key={charge.id} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Charge Name"
                          value={charge.name}
                          onChange={(e) => handleUpdateCharge(charge.id, "name", e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-400"
                        />
                        <div className="relative w-20 shrink-0">
                          <span className="absolute left-2 top-1 text-[10px] text-slate-400 font-bold">{currency.symbol}</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={charge.amount}
                            onChange={(e) => handleUpdateCharge(charge.id, "amount", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-md pl-5 pr-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-blue-400 text-right"
                          />
                        </div>
                        {/* GST % selector for this charge */}
                        <select
                          value={charge.tax_rate}
                          onChange={(e) => handleUpdateCharge(charge.id, "tax_rate", e.target.value)}
                          title="GST on this charge"
                          className="shrink-0 w-20 bg-white border border-slate-200 rounded-md px-1 py-1 text-[10px] font-bold text-slate-700 outline-none focus:border-blue-400"
                        >
                          <option value={0}>0% GST</option>
                          <option value={5}>5% GST</option>
                          <option value={12}>12% GST</option>
                          <option value={18}>18% GST</option>
                          <option value={28}>28% GST</option>
                        </select>
                        {/* Show computed GST amount inline */}
                        {Number(charge.tax_rate) > 0 && Number(charge.amount) > 0 && (
                          <span className="shrink-0 text-[10px] font-bold text-indigo-600 whitespace-nowrap">
                            +{currency.symbol}{(Number(charge.amount) * Number(charge.tax_rate) / 100).toFixed(2)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteCharge(charge.id)}
                          title="Delete charge row"
                          className="shrink-0 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between text-xs text-slate-600">
                <span>Taxable Value:</span>
                <span className="font-semibold text-slate-900">{currency.symbol}{taxableValue.toFixed(2)}</span>
              </div>

              {/* GST Breakdown Panel */}
              {totalTax > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
                  {/* GST Type Toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">GST Breakdown</span>
                    <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-200 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setGstType("cgst_sgst")}
                        className={`px-2 py-0.5 rounded-md transition-all ${
                          gstType === "cgst_sgst" ? "bg-blue-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        Intra-State
                      </button>
                      <button
                        type="button"
                        onClick={() => setGstType("igst")}
                        className={`px-2 py-0.5 rounded-md transition-all ${
                          gstType === "igst" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        Inter-State
                      </button>
                    </div>
                  </div>

                  {gstType === "cgst_sgst" ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                          CGST ({(items.reduce((s, it) => s + (Number(it.tax_rate) || 0), 0) / Math.max(items.length, 1) / 2).toFixed(1)}%):
                        </span>
                        <span className="font-bold text-blue-700">{currency.symbol}{(totalTax / 2).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                          SGST ({(items.reduce((s, it) => s + (Number(it.tax_rate) || 0), 0) / Math.max(items.length, 1) / 2).toFixed(1)}%):
                        </span>
                        <span className="font-bold text-emerald-700">{currency.symbol}{(totalTax / 2).toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"></span>
                        IGST ({(items.reduce((s, it) => s + (Number(it.tax_rate) || 0), 0) / Math.max(items.length, 1)).toFixed(1)}%):
                      </span>
                      <span className="font-bold text-indigo-700">{currency.symbol}{totalTax.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-[11px] font-bold text-slate-700 border-t border-slate-200 pt-1">
                    <span>Total GST:</span>
                    <span className="text-slate-900">+{currency.symbol}{totalTax.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {totalTax === 0 && (
                <div className="flex justify-between text-xs text-slate-600">
                  <span>GST Tax Amount:</span>
                  <span className="font-semibold text-slate-900">+{currency.symbol}0.00</span>
                </div>
              )}

              {afterTaxDiscount > 0 && (
                <div className="flex justify-between text-xs text-purple-600 font-bold">
                  <span>After-Tax Discount ({invoiceDiscountType === "percent" ? `${invoiceDiscountValue}%` : "Flat"}):</span>
                  <span className="font-black">-{currency.symbol}{afterTaxDiscount.toFixed(2)}</span>
                </div>
              )}

              {includePreviousDueInBill && previousDueAmount > 0 && (
                <div className="flex justify-between text-xs text-amber-800 font-bold bg-amber-50/90 p-2 rounded-lg border border-amber-200">
                  <span className="flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-amber-600" /> Previous Outstanding Due:
                  </span>
                  <span>+{currency.symbol}{previousDueAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={autoRoundOff}
                    onChange={(e) => setAutoRoundOff(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  Auto Round-Off ({roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`})
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-base font-extrabold text-slate-900">Grand Total Amount:</span>
                <span className="text-2xl font-black text-blue-600">{currency.symbol}{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment & Action */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => {
                      const mode = e.target.value;
                      setPaymentMode(mode);
                      if (mode === "Credit") {
                        setAmountReceived(0);
                      }
                    }}
                    className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="Card">Credit/Debit Card</option>
                    <option value="NetBanking">Net Banking</option>
                    <option value="Wallet">Wallet (B2B)</option>
                    <option value="Credit">Credit (Pay Later)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Amount Received</label>
                  <input
                    type="number"
                    placeholder="e.g. 1000"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value ? Number(e.target.value) : "")}
                    className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2.5 text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {amountReceived !== "" && Number(amountReceived) >= grandTotal && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex justify-between">
                  <span>Change / Return to Customer:</span>
                  <span className="text-emerald-700">{currency.symbol}{(Number(amountReceived) - grandTotal).toFixed(2)}</span>
                </div>
              )}
              <div className="space-y-2">
                <button
                  disabled={isSaving}
                  onClick={() => handleSave('a4')}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  {isSaving ? "Saving Invoice..." : `Save & Download PDF Invoice (₹${grandTotal.toFixed(2)})`}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={isSaving}
                    onClick={() => handleSave('thermal')}
                    className="py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <QrCode className="w-3.5 h-3.5" /> Save & Thermal
                  </button>
                  <button
                    disabled={isSaving}
                    onClick={() => handleSave('none')}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    Save Only
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Create Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-[520px] w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" /> Create & Add New Product
              </h3>
              <button
                onClick={() => setIsAddProductOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewProduct} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Product Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Pain d'épices artisanal"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  required
                  className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">SKU Code</label>
                  <input
                    type="text"
                    placeholder="Auto-generated if empty"
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Barcode</label>
                  <input
                    type="text"
                    placeholder="Optional barcode"
                    value={newProdBarcode}
                    onChange={(e) => setNewProdBarcode(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* 3-Tier Pricing Breakdown */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  💰 3-Tier Multi-Pricing Breakdown
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">🛒 Retail Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 200.00"
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      required
                      className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-700"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">📦 Wholesale (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 165.00"
                      value={newProdWholesalePrice}
                      onChange={(e) => setNewProdWholesalePrice(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-bold text-purple-700"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">🏢 B2B Contract (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 140.00"
                      value={newProdB2bPrice}
                      onChange={(e) => setNewProdB2bPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Market MRP (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 240.00"
                      value={newProdMrp}
                      onChange={(e) => setNewProdMrp(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 text-xs outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">GST Tax Rate</label>
                    <select
                      value={newProdTax}
                      onChange={(e) => setNewProdTax(Number(e.target.value))}
                      className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2 text-xs font-bold outline-none"
                    >
                      <option value={0}>0% GST</option>
                      <option value={5}>5% GST</option>
                      <option value={12}>12% GST</option>
                      <option value={18}>18% GST</option>
                      <option value={28}>28% GST</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Initial Stock</label>
                    <input
                      type="number"
                      placeholder="Qty"
                      value={newProdStock}
                      onChange={(e) => setNewProdStock(Number(e.target.value))}
                      className="w-full h-8 bg-white border border-slate-300 rounded-lg px-2.5 text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Product & Add to Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Party Modal */}
      {isAddPartyOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-[480px] w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" /> Create New Customer / Party
              </h3>
              <button
                onClick={() => setIsAddPartyOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewParty} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Party / Customer Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp / John Doe"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  required
                  className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    value={newPartyPhone}
                    onChange={(e) => setNewPartyPhone(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="contact@company.com"
                    value={newPartyEmail}
                    onChange={(e) => setNewPartyEmail(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Pvt Ltd"
                    value={newPartyCompany}
                    onChange={(e) => setNewPartyCompany(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Customer Category / Type</label>
                  <select
                    value={newPartyType}
                    onChange={(e) => setNewPartyType(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
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
                  <span className="text-[10px] text-slate-500 font-medium">Auto-populates company & address</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 37AABCU9603R1ZM"
                    value={newPartyGST}
                    onChange={(e) => setNewPartyGST(e.target.value.toUpperCase())}
                    maxLength={15}
                    className="flex-1 h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyGstin}
                    disabled={isVerifyingGstin || !newPartyGST.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                  >
                    {isVerifyingGstin ? (
                      <span className="animate-spin text-xs">⏳</span>
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    {isVerifyingGstin ? "Verifying..." : "⚡ Verify & Auto-fill"}
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
                    value={newPartyStreet}
                    onChange={(e) => setNewPartyStreet(e.target.value)}
                    className="w-full h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">City / Town</label>
                    <input
                      type="text"
                      placeholder="e.g. Proddatur"
                      value={newPartyCity}
                      onChange={(e) => setNewPartyCity(e.target.value)}
                      className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">State / UT (GST)</label>
                    <select
                      value={newPartyState}
                      onChange={(e) => {
                        setNewPartyState(e.target.value);
                        if (isShippingSameAsBilling) setNewPartyShipState(e.target.value);
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
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">PIN Code</label>
                    <input
                      type="text"
                      placeholder="e.g. 516360"
                      maxLength={6}
                      value={newPartyPincode}
                      onChange={(e) => setNewPartyPincode(e.target.value)}
                      className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
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
                      checked={isShippingSameAsBilling}
                      onChange={(e) => setIsShippingSameAsBilling(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Same as Billing Address
                  </label>
                </div>

                {!isShippingSameAsBilling && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Shipping Building, Street & Area</label>
                      <input
                        type="text"
                        placeholder="e.g. Warehouse 3, Industrial Area"
                        value={newPartyShipStreet}
                        onChange={(e) => setNewPartyShipStreet(e.target.value)}
                        className="w-full h-9 bg-white border border-slate-300 rounded-lg px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">City / Town</label>
                        <input
                          type="text"
                          placeholder="City"
                          value={newPartyShipCity}
                          onChange={(e) => setNewPartyShipCity(e.target.value)}
                          className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">State / UT (GST)</label>
                        <select
                          value={newPartyShipState}
                          onChange={(e) => setNewPartyShipState(e.target.value)}
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
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">PIN Code</label>
                        <input
                          type="text"
                          placeholder="PIN"
                          maxLength={6}
                          value={newPartyShipPincode}
                          onChange={(e) => setNewPartyShipPincode(e.target.value)}
                          className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPartyOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all"
                >
                  Create & Select Party
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pending Due Alert Modal */}
      {showPendingDueAlert && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] backdrop-blur-sm">
          <div className="bg-white w-[400px] rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowPendingDueAlert(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-2">Pending Dues Alert</h2>
              <p className="text-sm text-slate-600 mb-6">
                This customer has an outstanding balance of <span className="font-bold text-rose-600">{currency.symbol}{(customerSummary?.total_pending_due || 0).toFixed(2)}</span>.
              </p>
              <div className="flex w-full gap-3">
                <button
                  onClick={() => setShowPendingDueAlert(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200"
                >
                  Ignore & Bill
                </button>
                <button
                  onClick={() => {
                    setShowPendingDueAlert(false);
                    setShowCustomerLedger(true);
                  }}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-200"
                >
                  View Ledger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Ledger Modal */}
      {showCustomerLedger && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] backdrop-blur-sm">
          <div className="bg-white w-[700px] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-black text-slate-800">Customer Ledger</h2>
                <p className="text-xs text-slate-500 mt-1">Pending invoices and payment history</p>
              </div>
              <button onClick={() => setShowCustomerLedger(false)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-white flex-1">
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl mb-6 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-rose-700 uppercase">Total Outstanding</p>
                  <p className="text-3xl font-black text-rose-600">{currency.symbol}{(customerSummary?.total_pending_due || 0).toFixed(2)}</p>
                </div>
                <button 
                  onClick={() => {
                    setIncludePreviousDueInBill(true);
                    setShowCustomerLedger(false);
                    toast.success("Previous dues added to current bill");
                  }}
                  className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 text-sm shadow-md"
                >
                  Add to Current Bill
                </button>
              </div>
              
              <h3 className="font-bold text-slate-700 mb-3 text-sm">Unpaid Invoices</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Invoice ID</th>
                      <th className="px-4 py-3 font-semibold text-right">Original Amount</th>
                      <th className="px-4 py-3 font-semibold text-right">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">12 Oct 2025</td>
                      <td className="px-4 py-3 font-mono text-indigo-600 text-xs">INV-25-1002</td>
                      <td className="px-4 py-3 text-right text-slate-600">{currency.symbol}12500.00</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">{currency.symbol}5000.00</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">05 Nov 2025</td>
                      <td className="px-4 py-3 font-mono text-indigo-600 text-xs">INV-25-1145</td>
                      <td className="px-4 py-3 text-right text-slate-600">{currency.symbol}4800.00</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">{currency.symbol}4800.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Product Selection Catalog Modal */}
      {isMultiProductModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-200">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-900 leading-tight">
                    Multi-Product Catalog Selector
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Select multiple products & quantities to add directly to invoice items
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMultiProductModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search by product name, barcode, SKU, brand..."
                  value={multiProductSearch}
                  onChange={(e) => setMultiProductSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const filtered = products.filter((p: any) =>
                      !multiProductSearch.trim() ||
                      p.name?.toLowerCase().includes(multiProductSearch.toLowerCase()) ||
                      p.barcode?.includes(multiProductSearch) ||
                      p.sku?.toLowerCase().includes(multiProductSearch.toLowerCase())
                    );
                    const newSelected: Record<string, number> = {};
                    filtered.forEach((p: any) => {
                      newSelected[p.id] = selectedProductQuantities[p.id] || 1;
                    });
                    setSelectedProductQuantities(newSelected);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all shrink-0"
                >
                  Select All Visible
                </button>
                {Object.keys(selectedProductQuantities).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedProductQuantities({})}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg border border-rose-200 transition-all shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Product Grid / List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
              {products
                .filter((p: any) => {
                  const q = multiProductSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    p.name?.toLowerCase().includes(q) ||
                    p.barcode?.toLowerCase().includes(q) ||
                    p.sku?.toLowerCase().includes(q) ||
                    p.brand?.toLowerCase().includes(q)
                  );
                })
                .map((p: any) => {
                  const isSelected = !!selectedProductQuantities[p.id];
                  const qty = selectedProductQuantities[p.id] || 1;
                  const price =
                    pricingMode === "B2B"
                      ? (p.b2b_price || (p.selling_price || p.mrp || 0) * 0.70)
                      : pricingMode === "Wholesale"
                      ? (p.wholesale_price || (p.selling_price || p.mrp || 0) * 0.85)
                      : (p.selling_price || p.mrp || 0);

                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleMultiSelectProduct(p.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        isSelected
                          ? "bg-blue-50/80 border-blue-500 shadow-sm ring-1 ring-blue-500"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                            isSelected ? "bg-blue-600 text-white" : "border-2 border-slate-300 text-transparent"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {p.name}
                            </span>
                            {p.barcode && (
                              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                {p.barcode}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                            <span>SKU: {p.sku || "N/A"}</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-700">
                              Stock: <span className={(p.stock || p.initial_stock || 0) > 10 ? "text-emerald-600" : "text-amber-600"}>{p.stock || p.initial_stock || 0}</span>
                            </span>
                            <span>•</span>
                            <span>GST: {p.tax_percent || 18}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Pricing & Quantity Stepper */}
                      <div className="flex items-center gap-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <div className="text-right">
                          <div className="font-black text-xs text-slate-900">
                            ₹{Number(price).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold">
                            MRP: ₹{Number(p.mrp || price).toFixed(2)}
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="flex items-center gap-1.5 bg-white border border-blue-300 rounded-xl p-1 shadow-xs">
                            <button
                              type="button"
                              onClick={() => updateMultiSelectQty(p.id, -1)}
                              className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-black text-blue-700">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateMultiSelectQty(p.id, 1)}
                              className="w-6 h-6 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleMultiSelectProduct(p.id)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 transition-all"
                          >
                            + Select
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Sticky Bottom Summary & Action */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  {Object.keys(selectedProductQuantities).length} Product{Object.keys(selectedProductQuantities).length === 1 ? "" : "s"} Selected
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Pricing Mode: <strong className="text-indigo-600">{pricingMode}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMultiProductModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={Object.keys(selectedProductQuantities).length === 0}
                  onClick={handleAddMultipleProductsToInvoice}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-200 transition-all flex items-center gap-2"
                >
                  <Boxes className="w-4 h-4" />
                  Add {Object.keys(selectedProductQuantities).length} Selected to Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full A4 Printable Invoice Modal */}
      <FullInvoicePrinter
        invoice={fullInvoiceModalData}
        isOpen={isFullInvoiceOpen}
        onClose={() => setIsFullInvoiceOpen(false)}
        autoPrint={autoPrintFullInvoice}
      />
    </div>
  );
}
