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
  AlertTriangle
} from "lucide-react";
import { posApi, crmApi, invoicesApi, employeesApi, fetchSalesEmployees } from "../../lib/api-client";
import { toast } from "sonner";
import { ThermalReceiptPrinter } from "./ThermalReceiptPrinter";
import { FullInvoicePrinter, FullInvoiceData } from "./FullInvoicePrinter";
import { triggerThermalPrint } from "../../lib/print-helper";

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
  const [pricingMode, setPricingMode] = useState<"Retail" | "Wholesale">("Retail");
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
  const [newPartyAddress, setNewPartyAddress] = useState("");

  // Customer History & Pending Due Tracking
  const [customerSummary, setCustomerSummary] = useState<{
    total_invoices: number;
    total_spent: number;
    total_pending_due: number;
    last_purchase_date: string | null;
  } | null>(null);
  const [includePreviousDueInBill, setIncludePreviousDueInBill] = useState(false);

  useEffect(() => {
    posApi
      .getProducts()
      .then((res: any) => setProducts(res.items || res))
      .catch(console.error);
    crmApi
      .getCustomers(1, 100)
      .then((data: any) => setCustomers(data.items || data))
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

  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerSummary(null);
      setIncludePreviousDueInBill(false);
      return;
    }
    invoicesApi
      .getCustomerSummary(selectedCustomer)
      .then((data: any) => {
        if (data) {
          setCustomerSummary(data);
        }
      })
      .catch(() => {
        setCustomerSummary(null);
      });
  }, [selectedCustomer]);

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
        is_tax_inclusive: true,
        custom_note: "",
        is_note_open: false,
        is_search_open: false,
        search_query: "",
      },
    ]);
  };

  const handleBarcodeSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcodeInput.trim() !== "") {
      const queryCode = barcodeInput.trim();
      const product = products.find((p) => p.barcode === queryCode || p.sku === queryCode);
      if (product) {
        const basePrice = product.selling_price || product.price || product.mrp || 0;
        const wholesalePrice = product.wholesale_price || (basePrice * 0.9);
        const targetPrice = pricingMode === "Wholesale" ? wholesalePrice : basePrice;

        setItems((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substr(2, 9),
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: targetPrice,
            mrp: product.mrp || 0,
            discount_value: 0,
            discount_type: "percent",
            tax_rate: product.tax_percent || 18,
            is_tax_inclusive: product.is_tax_inclusive !== false,
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
              is_tax_inclusive: p.is_tax_inclusive !== false,
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
              const basePrice = product.selling_price || product.price || product.mrp || 0;
              const wholesalePrice = product.wholesale_price || (basePrice * 0.9);
              const targetPrice = pricingMode === "Wholesale" ? wholesalePrice : basePrice;

              updated.product_name = product.name;
              updated.unit_price = targetPrice;
              updated.mrp = product.mrp || 0;
              updated.hsn_code = product.hsn_code || "";
              updated.tax_rate = product.tax_percent || 18;
              updated.is_tax_inclusive = product.is_tax_inclusive !== false;
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
    const isIncl = item.is_tax_inclusive !== false;
    const price = Number(item.unit_price) || 0;
    const qty = Number(item.quantity) || 1;
    const taxRate = Number(item.tax_rate) || 0;

    let lineFinal = 0;
    let lineTaxable = 0;
    let lineTax = 0;

    if (isIncl) {
      lineFinal = qty * price;
      lineTaxable = taxRate > 0 ? lineFinal / (1 + taxRate / 100) : lineFinal;
      lineTax = lineFinal - lineTaxable;
    } else {
      lineTaxable = qty * price;
      lineTax = (lineTaxable * taxRate) / 100;
      lineFinal = lineTaxable + lineTax;
    }

    const dAmt = item.discount_type === "percent"
      ? lineFinal * (item.discount_value / 100)
      : Math.min(item.discount_value, lineFinal);

    subtotal += lineFinal;
    itemDiscountTotal += dAmt;
    const discRatio = lineFinal > 0 ? dAmt / lineFinal : 0;
    totalTaxableValue += lineTaxable * (1 - discRatio);
    totalTax += lineTax * (1 - discRatio);
  });

  const netSubtotal = Math.max(0, subtotal - itemDiscountTotal);

  // 1. Before-Tax Invoice Discount
  let beforeTaxDiscount = 0;
  if (invoiceDiscountMode === "before_tax" && invoiceDiscountValue > 0) {
    beforeTaxDiscount = invoiceDiscountType === "percent"
      ? netSubtotal * (invoiceDiscountValue / 100)
      : Math.min(invoiceDiscountValue, netSubtotal);
  }

  const taxableValue = Math.max(0, totalTaxableValue - beforeTaxDiscount);
  const grossTotal = Math.max(0, netSubtotal - beforeTaxDiscount);

  // 3. After-Tax Invoice Discount
  let afterTaxDiscount = 0;
  if (invoiceDiscountMode === "after_tax" && invoiceDiscountValue > 0) {
    afterTaxDiscount = invoiceDiscountType === "percent"
      ? grossTotal * (invoiceDiscountValue / 100)
      : Math.min(invoiceDiscountValue, grossTotal);
  }

  const totalDiscount = itemDiscountTotal + beforeTaxDiscount + afterTaxDiscount;
  const previousDueAmount = (includePreviousDueInBill && customerSummary?.total_pending_due) ? Number(customerSummary.total_pending_due) : 0;
  // Additional charges: base amount + GST on each charge
  const totalAdditionalCharges = customCharges.reduce((sum, c) => {
    const amt = Number(c.amount || 0);
    const gstOnCharge = amt * (Number(c.tax_rate || 0) / 100);
    return sum + amt + gstOnCharge;
  }, 0);
  const chargesGstTotal = customCharges.reduce((sum, c) => {
    const amt = Number(c.amount || 0);
    return sum + amt * (Number(c.tax_rate || 0) / 100);
  }, 0);
  const baseRawTotal = Math.max(0, grossTotal - afterTaxDiscount) + totalAdditionalCharges;
  const rawTotal = baseRawTotal + previousDueAmount;
  const roundOff = autoRoundOff ? Math.round(rawTotal) - rawTotal : 0;
  const grandTotal = autoRoundOff ? Math.round(rawTotal) : rawTotal;

  const activeCustomerObj = customers.find((c) => c.id === selectedCustomer);

  const handleCreateNewParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim()) return toast.error("Party name is required");
    try {
      const created = await crmApi.createCustomer({
        name: newPartyName.trim(),
        phone: newPartyPhone.trim() || undefined,
        email: newPartyEmail.trim() || undefined,
        company_name: newPartyCompany.trim() || undefined,
        customer_type: newPartyType || "Retail",
        gst_number: newPartyGST.trim() || undefined,
        address: newPartyAddress.trim() || undefined,
      });
      const customerObj = created.data || created;
      setCustomers([customerObj, ...customers]);
      setSelectedCustomer(customerObj.id);
      setIsAddPartyOpen(false);
      setNewPartyName("");
      setNewPartyPhone("");
      setNewPartyEmail("");
      setNewPartyCompany("");
      setNewPartyGST("");
      setNewPartyAddress("");
      setNewPartyType("Retail");
      toast.success(`Party "${customerObj.name}" saved to database & selected!`);
    } catch (err) {
      const newCust = {
        id: `party-${Date.now()}`,
        name: newPartyName.trim(),
        phone: newPartyPhone.trim() || undefined,
        email: newPartyEmail.trim() || undefined,
        company: newPartyCompany.trim() || undefined,
        customer_type: newPartyType || "Retail",
        gst_number: newPartyGST.trim() || undefined,
        address: newPartyAddress.trim() || undefined,
      };
      setCustomers([newCust, ...customers]);
      setSelectedCustomer(newCust.id);
      setIsAddPartyOpen(false);
      setNewPartyName("");
      setNewPartyPhone("");
      setNewPartyEmail("");
      setNewPartyCompany("");
      setNewPartyGST("");
      setNewPartyAddress("");
      setNewPartyType("Retail");
      toast.success(`Party "${newCust.name}" created and selected!`);
    }
  };

  const handleCreateNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return toast.error("Product name is required");
    const unitPriceVal = Number(newProdPrice) || 0;
    const mrpVal = Number(newProdMrp) || unitPriceVal;
    const wholesaleVal = Number(newProdWholesalePrice) || unitPriceVal;
    const generatedProduct = {
      id: `prod-${Date.now()}`,
      name: newProdName.trim(),
      sku: newProdSku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      barcode: newProdBarcode.trim() || `BC-${Date.now().toString().slice(-4)}`,
      category: newProdCategory,
      selling_price: unitPriceVal,
      wholesale_price: wholesaleVal,
      mrp: mrpVal,
      tax_percent: Number(newProdTax) || 18,
      stock_quantity: Number(newProdStock) || 100,
    };

    setProducts([generatedProduct, ...products]);
    setItems([
      ...items,
      {
        id: Math.random().toString(36).substr(2, 9),
        product_id: generatedProduct.id,
        product_name: generatedProduct.name,
        quantity: 1,
        unit_price: pricingMode === "Wholesale" ? generatedProduct.wholesale_price : generatedProduct.selling_price,
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

      const apiInvoice = createResult.data || createResult;
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
        payment_mode: paymentMode,
        payment_status: isCredit ? "Unpaid" : (amountReceived === "" || Number(amountReceived) >= grandTotal ? "Paid" : "Partial"),
        subtotal: subtotal,
        total_tax: totalTax,
        discount_amount: totalDiscount,
        grand_total: grandTotal,
        amount_received: Number(amountReceived) || grandTotal,
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
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-md shadow-blue-500/20">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Create Sales Invoice</h1>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                New Invoice
              </span>
            </div>
            <p className="text-xs text-slate-500">Draft sales receipt & manage line item billing</p>
          </div>
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
          <div className="flex items-center bg-slate-100 p-1 border border-slate-200 rounded-xl text-xs font-bold">
            <button
              onClick={() => setPricingMode("Retail")}
              className={`px-2.5 py-1 rounded-lg transition-all ${pricingMode === "Retail" ? "bg-white text-blue-600 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
            >
              Retail Tier
            </button>
            <button
              onClick={() => setPricingMode("Wholesale")}
              className={`px-2.5 py-1 rounded-lg transition-all ${pricingMode === "Wholesale" ? "bg-purple-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
            >
              Wholesale/B2B Tier
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
                          Total Orders: <strong className="text-white">{customerSummary.total_invoices}</strong> | Total Spent: <strong className="text-emerald-400">₹{Number(customerSummary.total_spent || 0).toFixed(2)}</strong>
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-amber-400" />
                          <div>
                            <div className="text-[10px] text-slate-300 font-medium">Pending Outstanding Due</div>
                            <div className={`text-sm font-extrabold ${Number(customerSummary.total_pending_due || 0) > 0 ? "text-amber-300" : "text-emerald-400"}`}>
                              ₹{Number(customerSummary.total_pending_due || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {Number(customerSummary.total_pending_due || 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => setIncludePreviousDueInBill(!includePreviousDueInBill)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                              includePreviousDueInBill
                                ? "bg-amber-500 text-slate-950 shadow-sm"
                                : "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border border-amber-500/40"
                            }`}
                          >
                            {includePreviousDueInBill ? "✓ Previous Due Added to Bill" : `+ Add Previous Due (₹${Number(customerSummary.total_pending_due || 0).toFixed(2)})`}
                          </button>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500">Payment Terms</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => {
                    const days = parseInt(e.target.value, 10);
                    setPaymentTerms(e.target.value);
                    if (!isNaN(days)) {
                      setDueDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
                    }
                  }}
                  className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="0">Due on Receipt</option>
                  <option value="15">Net 15 Days</option>
                  <option value="30">Net 30 Days</option>
                  <option value="60">Net 60 Days</option>
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
                      const basePrice = prod.selling_price || prod.price || prod.mrp || 0;
                      const wholesalePrice = prod.wholesale_price || (basePrice * 0.9);
                      const targetPrice = pricingMode === "Wholesale" ? wholesalePrice : basePrice;
                      setItems((prev) =>
                        prev.map((it) =>
                          it.id === dropdownAnchor.itemId
                            ? {
                                ...it,
                                product_id: prod.id,
                                product_name: prod.name,
                                search_query: prod.name,
                                unit_price: targetPrice,
                                mrp: prod.mrp || 0,
                                hsn_code: prod.hsn_code || "",
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
                      ₹{Number(pricingMode === "Wholesale" ? (prod.wholesale_price || prod.selling_price || 0) : (prod.selling_price || prod.mrp || 0)).toFixed(2)}
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
                  <th className="px-3 py-3 w-28 text-right font-bold">Amount (₹)</th>
                  <th className="px-3 py-3 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length > 0 ? (
                  items.map((item, idx) => {
                    const isIncl = item.is_tax_inclusive !== false;
                    const price = Number(item.unit_price) || 0;
                    const qty = Number(item.quantity) || 1;
                    const taxRate = Number(item.tax_rate) || 0;

                    let baseUnitPrice = price;
                    if (isIncl && taxRate > 0) {
                      baseUnitPrice = price / (1 + taxRate / 100);
                    }

                    const lineGross = qty * baseUnitPrice;
                    const dAmt = item.discount_type === "percent"
                      ? lineGross * (item.discount_value / 100)
                      : Math.min(item.discount_value, lineGross);

                    const lineTaxable = Math.max(0, lineGross - dAmt);
                    const lineTaxAmount = isIncl
                      ? (qty * price - dAmt) - lineTaxable
                      : (lineTaxable * taxRate) / 100;
                    const lineAmount = isIncl ? (qty * price - dAmt) : (lineTaxable + lineTaxAmount);

                    const matchingProducts = products.filter(
                      (p) =>
                        !item.search_query ||
                        p.name.toLowerCase().includes((item.search_query || "").toLowerCase()) ||
                        (p.barcode && p.barcode.toLowerCase().includes((item.search_query || "").toLowerCase())) ||
                        (p.sku && p.sku.toLowerCase().includes((item.search_query || "").toLowerCase()))
                    );

                    // MRP warning: compare INCLUSIVE selling price to MRP (Indian MRP is always tax-inclusive)
                    const sellingPriceIncl = isIncl ? price : price * (1 + taxRate / 100);
                    const priceExclTax = isIncl && taxRate > 0 ? price / (1 + taxRate / 100) : price;
                    const mrpVal = Number(item.mrp) || 0;
                    const isMrpExceeded = mrpVal > 0 && sellingPriceIncl > mrpVal;

                    return (
                      <>
                      <tr key={item.id} className={`transition-colors ${isMrpExceeded ? "bg-red-50/40" : "hover:bg-slate-50/80"}`}>
                        <td className="px-3 py-2 text-center text-slate-400 font-bold text-xs align-middle">{idx + 1}</td>

                        {/* Product Search & Autocomplete Cell — single compact row */}
                        <td className="px-2 py-2 align-middle" style={{ minWidth: 220 }}>
                          <div>
                            {/* Single-row search: icon + input + GST badge + note btn */}
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400 shadow-sm transition-all">
                              <Search className="w-3 h-3 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                placeholder="Search product..."
                                value={item.search_query !== undefined ? item.search_query : item.product_name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setItems(
                                    items.map((it) =>
                                      it.id === item.id
                                        ? { ...it, search_query: val, product_name: val, is_search_open: true }
                                        : it
                                    )
                                  );
                                }}
                                onFocus={(e) => {
                                  const rect = e.currentTarget.closest('td')!.getBoundingClientRect();
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
                              {/* GST badge */}
                              <button
                                type="button"
                                onClick={() => updateItem(item.id, "is_tax_inclusive", !isIncl)}
                                title="Toggle GST Inclusive / Exclusive"
                                className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${
                                  isIncl
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                    : "bg-amber-100 text-amber-700 border border-amber-300"
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
                          <input
                            type="text"
                            placeholder="HSN"
                            value={item.hsn_code || ""}
                            onChange={(e) => updateItem(item.id, "hsn_code", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center outline-none font-mono"
                          />
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
                              <option value="amount">₹</option>
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
                          ₹{Number(lineAmount || 0).toFixed(2)}
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
                                ⚠️ MRP Exceeded! Selling price ₹{sellingPriceIncl.toFixed(2)} (incl. tax) &gt; MRP ₹{mrpVal.toFixed(2)}.
                                Please reduce the price or obtain approval before saving.
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      </>
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

          <div className="p-4 border-t border-slate-200 bg-slate-50/50">
            <button
              onClick={handleAddItem}
              className="bg-white border border-slate-300 hover:border-blue-500 hover:text-blue-600 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Line Item
            </button>
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
                <span className="font-semibold text-slate-900">₹{subtotal.toFixed(2)}</span>
              </div>

              {itemDiscountTotal > 0 && (
                <div className="flex justify-between text-xs text-rose-500">
                  <span>Line Item Savings:</span>
                  <span className="font-semibold">-₹{itemDiscountTotal.toFixed(2)}</span>
                </div>
              )}

              {beforeTaxDiscount > 0 && (
                <div className="flex justify-between text-xs text-indigo-600 font-bold">
                  <span>Before-Tax Discount ({invoiceDiscountType === "percent" ? `${invoiceDiscountValue}%` : "Flat"}):</span>
                  <span className="font-black">-₹{beforeTaxDiscount.toFixed(2)}</span>
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
                          <span className="absolute left-2 top-1 text-[10px] text-slate-400 font-bold">₹</span>
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
                            +₹{(Number(charge.amount) * Number(charge.tax_rate) / 100).toFixed(2)}
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
                <span className="font-semibold text-slate-900">₹{taxableValue.toFixed(2)}</span>
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
                        <span className="font-bold text-blue-700">₹{(totalTax / 2).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                          SGST ({(items.reduce((s, it) => s + (Number(it.tax_rate) || 0), 0) / Math.max(items.length, 1) / 2).toFixed(1)}%):
                        </span>
                        <span className="font-bold text-emerald-700">₹{(totalTax / 2).toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"></span>
                        IGST ({(items.reduce((s, it) => s + (Number(it.tax_rate) || 0), 0) / Math.max(items.length, 1)).toFixed(1)}%):
                      </span>
                      <span className="font-bold text-indigo-700">₹{totalTax.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-[11px] font-bold text-slate-700 border-t border-slate-200 pt-1">
                    <span>Total GST:</span>
                    <span className="text-slate-900">+₹{totalTax.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {totalTax === 0 && (
                <div className="flex justify-between text-xs text-slate-600">
                  <span>GST Tax Amount:</span>
                  <span className="font-semibold text-slate-900">+₹0.00</span>
                </div>
              )}

              {afterTaxDiscount > 0 && (
                <div className="flex justify-between text-xs text-purple-600 font-bold">
                  <span>After-Tax Discount ({invoiceDiscountType === "percent" ? `${invoiceDiscountValue}%` : "Flat"}):</span>
                  <span className="font-black">-₹{afterTaxDiscount.toFixed(2)}</span>
                </div>
              )}

              {includePreviousDueInBill && previousDueAmount > 0 && (
                <div className="flex justify-between text-xs text-amber-800 font-bold bg-amber-50/90 p-2 rounded-lg border border-amber-200">
                  <span className="flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-amber-600" /> Previous Outstanding Due:
                  </span>
                  <span>+₹{previousDueAmount.toFixed(2)}</span>
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
                <span className="text-2xl font-black text-blue-600">₹{grandTotal.toFixed(2)}</span>
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
                  <span className="text-emerald-700">₹{(Number(amountReceived) - grandTotal).toFixed(2)}</span>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">GSTIN / Tax ID Number</label>
                  <input
                    type="text"
                    placeholder="37AAAAA0000A1Z5"
                    value={newPartyGST}
                    onChange={(e) => setNewPartyGST(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Billing & Shipping Address</label>
                  <textarea
                    rows={2}
                    placeholder="Street, City, State, Pincode"
                    value={newPartyAddress}
                    onChange={(e) => setNewPartyAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md"
                >
                  Create & Select Party
                </button>
              </div>
            </form>
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
