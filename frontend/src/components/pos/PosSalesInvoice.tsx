import React, { useState, useEffect } from "react";
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
  DollarSign
} from "lucide-react";
import { posApi, crmApi, invoicesApi } from "../../lib/api-client";
import { toast } from "sonner";
import { ThermalReceiptPrinter } from "./ThermalReceiptPrinter";
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
}

export function PosSalesInvoice() {
  const [showPaymentTerms, setShowPaymentTerms] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");

  // Invoice Fields
  const [invoiceNumber] = useState(`INV-${Date.now().toString().slice(-5)}`);
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

  // Add Party Modal State
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyPhone, setNewPartyPhone] = useState("");
  const [newPartyEmail, setNewPartyEmail] = useState("");
  const [newPartyCompany, setNewPartyCompany] = useState("");

  useEffect(() => {
    posApi
      .getProducts()
      .then((res: any) => setProducts(res.items || res))
      .catch(console.error);
    crmApi
      .getCustomers(1, 100)
      .then((data: any) => setCustomers(data.items || data))
      .catch(console.error);
  }, []);

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
      },
    ]);
  };

  const handleBarcodeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcodeInput.trim() !== "") {
      const product = products.find((p) => p.barcode === barcodeInput.trim() || p.sku === barcodeInput.trim());
      if (product) {
        setItems([
          ...items,
          {
            id: Math.random().toString(36).substr(2, 9),
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: product.selling_price || product.price || product.mrp || 0,
            mrp: product.mrp || 0,
            discount_value: 0,
            discount_type: "percent",
            tax_rate: product.tax_percent || 18,
          },
        ]);
        toast.success(`Added ${product.name}`);
        setBarcodeInput("");
      } else {
        toast.error("Product not found with this barcode / SKU");
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
              updated.product_name = product.name;
              updated.unit_price = product.selling_price || product.price || product.mrp || 0;
              updated.mrp = product.mrp || 0;
              updated.hsn_code = product.hsn_code || "";
              updated.tax_rate = product.tax_percent || 18;
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

  // Calculated totals
  let subtotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;

  items.forEach((item) => {
    const lineGross = item.quantity * item.unit_price;
    const dAmt =
      item.discount_type === "percent"
        ? lineGross * (item.discount_value / 100)
        : Math.min(item.discount_value, lineGross);
    const taxable = lineGross - dAmt;
    const tax = taxable * (item.tax_rate / 100);
    subtotal += lineGross;
    totalDiscount += dAmt;
    totalTax += tax;
  });

  const rawTotal = subtotal - totalDiscount + totalTax;
  const roundOff = autoRoundOff ? Math.round(rawTotal) - rawTotal : 0;
  const grandTotal = autoRoundOff ? Math.round(rawTotal) : rawTotal;

  const activeCustomerObj = customers.find((c) => c.id === selectedCustomer);

  const handleCreateNewParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim()) return toast.error("Party name is required");
    const newCust = {
      id: `party-${Date.now()}`,
      name: newPartyName.trim(),
      phone: newPartyPhone.trim() || undefined,
      email: newPartyEmail.trim() || undefined,
      company: newPartyCompany.trim() || undefined,
    };
    setCustomers([newCust, ...customers]);
    setSelectedCustomer(newCust.id);
    setIsAddPartyOpen(false);
    setNewPartyName("");
    setNewPartyPhone("");
    setNewPartyEmail("");
    setNewPartyCompany("");
    toast.success(`Party "${newCust.name}" created and selected!`);
  };

  const [printedBill, setPrintedBill] = useState<any>(null);

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
      payment_status: 'PAID'
    };
    setPrintedBill(billData);
    setTimeout(() => {
      triggerThermalPrint();
    }, 100);
  };

  const handleSave = async () => {
    if (!selectedCustomer) return toast.error("Please select a customer or party first.");
    if (items.length === 0) return toast.error("Please add at least one item.");
    try {
      setIsSaving(true);
      const customer = customers.find((c) => c.id === selectedCustomer);
      await invoicesApi.createInvoice({
        customer_id: customer.id,
        customer_name: customer.name,
        invoice_date: invoiceDate,
        due_date: dueDate,
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
      toast.success("Sales Invoice created successfully!");
      // Automatically trigger thermal print upon successful save
      handlePrintThermal();
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

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintThermal}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            <QrCode className="w-4 h-4 text-indigo-600" /> Print Thermal (80mm)
          </button>
          <button
            onClick={() => setItems([])}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-all shadow-sm"
          >
            Clear All
          </button>
          <button
            disabled={isSaving}
            onClick={handleSave}
            className="px-6 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? "Saving Invoice..." : "Save & Print Receipt"}
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
                    onClick={() => setSelectedCustomer("")}
                    className="text-xs text-slate-400 hover:text-red-500 font-semibold"
                  >
                    Change Party
                  </button>
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
                    const lineGross = item.quantity * item.unit_price;
                    const dAmt =
                      item.discount_type === "percent"
                        ? lineGross * (item.discount_value / 100)
                        : Math.min(item.discount_value, lineGross);
                    const taxable = lineGross - dAmt;
                    const tax = taxable * (item.tax_rate / 100);
                    const lineAmount = taxable + tax;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3 py-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="px-3 py-3">
                          <select
                            value={item.product_id || ""}
                            onChange={(e) => updateItem(item.id, "product_id", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none mb-1"
                          >
                            <option value="">-- Select Product --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Description / custom name..."
                            value={item.product_name}
                            onChange={(e) => updateItem(item.id, "product_name", e.target.value)}
                            className="w-full text-[11px] bg-white border border-slate-200 rounded-md px-2 py-1 outline-none text-slate-700"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            placeholder="HSN"
                            value={item.hsn_code || ""}
                            onChange={(e) => updateItem(item.id, "hsn_code", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center outline-none"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            placeholder="Batch"
                            value={item.batch_number || ""}
                            onChange={(e) => updateItem(item.id, "batch_number", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center outline-none"
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
                        <td className="px-3 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.mrp || 0}
                            onChange={(e) => updateItem(item.id, "mrp", Number(e.target.value))}
                            className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-right outline-none"
                          />
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
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-right text-[11px] outline-none"
                          >
                            <option value={0}>0% GST</option>
                            <option value={5}>5% GST</option>
                            <option value={12}>12% GST</option>
                            <option value={18}>18% GST</option>
                            <option value={28}>28% GST</option>
                          </select>
                        </td>
                        <td className="px-3 py-3 text-right font-extrabold text-slate-900 text-sm">
                          ₹{lineAmount.toFixed(2)}
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
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
                Billing Financial Summary
              </h3>

              <div className="flex justify-between text-xs text-slate-600">
                <span>Gross Subtotal:</span>
                <span className="font-semibold text-slate-900">₹{subtotal.toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600">
                  <span>Total Discount Savings:</span>
                  <span className="font-semibold">-₹{totalDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-slate-600">
                <span>Taxable Value:</span>
                <span className="font-semibold text-slate-900">₹{(subtotal - totalDiscount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>GST Tax Amount:</span>
                <span className="font-semibold text-slate-900">+₹{totalTax.toFixed(2)}</span>
              </div>

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
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full h-9 bg-slate-50 border border-slate-300 rounded-xl px-2.5 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="Card">Credit/Debit Card</option>
                    <option value="NetBanking">Net Banking</option>
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

              <button
                disabled={isSaving}
                onClick={handleSave}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? "Saving Sales Invoice..." : `Save Invoice (₹${grandTotal.toFixed(2)})`}
              </button>
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
                  placeholder="Rahul Sharma / Acme Traders"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  required
                  className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Phone / Mobile</label>
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
                    placeholder="rahul@example.com"
                    value={newPartyEmail}
                    onChange={(e) => setNewPartyEmail(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Company / Organization</label>
                <input
                  type="text"
                  placeholder="Acme Pvt Ltd"
                  value={newPartyCompany}
                  onChange={(e) => setNewPartyCompany(e.target.value)}
                  className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
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
    </div>
  );
}
