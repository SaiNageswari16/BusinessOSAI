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
} from "lucide-react";
import { posApi, crmApi, invoicesApi, inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

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
        tax_rate: 0,
      },
    ]);
  };

  const [barcodeInput, setBarcodeInput] = useState("");
  const handleBarcodeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcodeInput.trim() !== "") {
      const product = products.find((p) => p.barcode === barcodeInput.trim());
      if (product) {
        setItems([
          ...items,
          {
            id: Math.random().toString(36).substr(2, 9),
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: product.selling_price || product.mrp || 0,
            mrp: product.mrp || 0,
            discount_value: 0,
            discount_type: "percent",
            tax_rate: product.tax_percent || 0,
          },
        ]);
        toast.success(`Added ${product.name}`);
        setBarcodeInput("");
      } else {
        toast.error("Product not found with this barcode");
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
              updated.unit_price = product.selling_price || product.mrp || 0;
              updated.mrp = product.mrp || 0;
              updated.hsn_code = product.hsn_code || "";
              updated.tax_rate = product.tax_percent || 18; // Default GST if not defined
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

  const roundOff =
    Math.round(subtotal - totalDiscount + totalTax) - (subtotal - totalDiscount + totalTax);
  const totalAmount = subtotal - totalDiscount + totalTax + roundOff;

  const handleSave = async () => {
    if (!selectedCustomer) return toast.error("Please select a customer first.");
    if (items.length === 0) return toast.error("Please add at least one item.");
    try {
      setIsSaving(true);
      const customer = customers.find((c) => c.id === selectedCustomer);
      await invoicesApi.createInvoice({
        customer_id: customer.id,
        customer_name: customer.name,
        invoice_date: new Date().toISOString().split("T")[0],
        due_date: new Date().toISOString().split("T")[0],
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
      setItems([]);
    } catch (error: any) {
      toast.error(error?.detail || "Failed to create invoice");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-white font-sans text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button className="p-1 hover:bg-slate-100 rounded-md">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-xl font-medium text-slate-800">Create Sales Invoice</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-md">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" ry="2" />
              <path d="M6 8h.001" />
              <path d="M10 8h.001" />
              <path d="M14 8h.001" />
              <path d="M18 8h.001" />
              <path d="M8 12h.001" />
              <path d="M12 12h.001" />
              <path d="M16 12h.001" />
              <path d="M7 16h10" />
            </svg>
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded bg-white hover:bg-slate-50">
            <Settings className="w-4 h-4 text-slate-500" /> Settings{" "}
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 mb-2"></div>
          </button>
          <button className="px-4 py-1.5 text-sm font-medium text-slate-400 border border-slate-200 rounded bg-white hover:bg-slate-50 cursor-pointer">
            Save & New
          </button>
          <button
            disabled={isSaving}
            onClick={handleSave}
            className="px-8 py-1.5 text-sm font-medium text-white rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Top Section */}
        <div className="flex border-b border-slate-200 min-h-[160px]">
          {/* Bill To */}
          <div className="flex-[2] flex flex-col border-r border-slate-200">
            <div className="px-4 py-2 border-b border-slate-200 font-medium text-sm text-slate-700">
              Bill To
            </div>
            <div className="p-4 flex-1">
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full h-10 border border-slate-300 rounded-sm px-3 text-sm focus:outline-none focus:border-blue-500 mb-2"
              >
                <option value="">Select Customer / Party</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {!selectedCustomer && (
                <button className="w-full h-10 border border-dashed border-blue-300 bg-white rounded-sm flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Plus className="w-4 h-4" /> Add Party
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div className="flex-1 flex flex-col p-4">
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="text-xs text-slate-400 mb-1 block">Sales Invoice No:</label>
                <input
                  type="text"
                  value="13767"
                  readOnly
                  className="w-full bg-slate-100 border border-slate-200 rounded-sm px-3 py-1.5 text-sm text-slate-700 focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-400 mb-1 block">Sales Invoice Date:</label>
                <div className="relative">
                  <input
                    type="text"
                    defaultValue="01 Aug 2026"
                    className="w-full border border-slate-200 rounded-sm pl-8 pr-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-blue-400"
                  />
                  <svg
                    className="w-4 h-4 absolute left-2.5 top-2 text-slate-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                </div>
              </div>
            </div>

            {showPaymentTerms ? (
              <div className="flex gap-4 relative">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Payment Terms:</label>
                  <div className="flex items-center border border-slate-200 rounded-sm overflow-hidden h-8">
                    <input
                      type="text"
                      defaultValue="30"
                      className="w-16 px-2 text-right focus:outline-none bg-white border-r border-slate-200 text-sm text-slate-700"
                    />
                    <span className="px-3 flex-1 flex items-center text-slate-500 bg-slate-50 text-sm">
                      days
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Due Date:</label>
                  <div className="relative h-8">
                    <input
                      type="text"
                      defaultValue="31 Aug 2026"
                      className="w-full h-full border border-slate-200 rounded-sm pl-8 pr-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-blue-400"
                    />
                    <svg
                      className="w-4 h-4 absolute left-2.5 top-2 text-slate-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                      <line x1="16" x2="16" y1="2" y2="6" />
                      <line x1="8" x2="8" y1="2" y2="6" />
                      <line x1="3" x2="21" y1="10" y2="10" />
                    </svg>
                  </div>
                </div>
                <button
                  onClick={() => setShowPaymentTerms(false)}
                  className="absolute -top-2 -right-2 bg-slate-400 text-white rounded-full p-0.5 hover:bg-slate-500 z-10 shadow-sm border-2 border-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setShowPaymentTerms(true)}
                  className="w-full h-9 border border-dashed border-blue-300 bg-white rounded-sm flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Plus className="w-3 h-3" /> Add Due Date
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="border-b border-slate-200 overflow-x-auto bg-white">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-[#f8f9fa] border-b border-slate-200 text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 font-medium w-8 border-r border-slate-200">No</th>
                <th className="px-3 py-3 font-medium border-r border-slate-200">Items/ Services</th>
                <th className="px-3 py-3 font-medium border-r border-slate-200">HSN/ SAC</th>
                <th className="px-3 py-3 font-medium border-r border-slate-200">Batch No.</th>
                <th className="px-3 py-3 font-medium border-r border-slate-200">Exp. Date</th>
                <th className="px-3 py-3 font-medium border-r border-slate-200">Mfg Date</th>
                <th className="px-3 py-3 font-medium border-r border-slate-200 text-right">MRP</th>
                <th className="px-3 py-3 font-medium border-r border-slate-200 text-right">Qty</th>
                <th className="px-3 py-3 font-medium border-r border-slate-200 text-right">
                  Price/Item (â‚¹)
                </th>
                <th className="px-3 py-3 font-medium border-r border-slate-200 text-right">
                  Discount
                </th>
                <th className="px-3 py-3 font-medium border-r border-slate-200 text-right">Tax</th>
                <th className="px-3 py-3 font-medium text-right pr-6 border-r border-slate-200">
                  Amount (â‚¹)
                </th>
                <th className="px-2 py-3 font-medium w-10 text-center">
                  <div className="bg-slate-400 text-white rounded-full p-1 cursor-pointer hover:bg-slate-500 mx-auto w-5 h-5 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-slate-200 align-top group bg-white">
                  <td className="px-3 py-3 border-r border-slate-200 text-slate-600">{idx + 1}</td>
                  <td className="px-3 py-3 border-r border-slate-200 w-[250px] max-w-[250px] whitespace-normal">
                    <select
                      value={item.product_id || ""}
                      onChange={(e) => updateItem(item.id, "product_id", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1 focus:outline-none mb-1 text-slate-800 truncate"
                    >
                      <option value="">Select Product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Enter Description (optional)"
                      value={item.product_name}
                      onChange={(e) => updateItem(item.id, "product_name", e.target.value)}
                      className="w-full text-[11px] bg-slate-100 border-none rounded-sm px-2 py-1.5 focus:outline-none text-slate-800 truncate"
                    />
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200">
                    <input
                      type="text"
                      placeholder="HSN"
                      value={item.hsn_code || ""}
                      onChange={(e) => updateItem(item.id, "hsn_code", e.target.value)}
                      className="w-16 bg-slate-50 border border-slate-200 rounded-sm px-1 py-1 focus:outline-none text-[11px] text-slate-800"
                    />
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200">
                    <input
                      type="text"
                      placeholder="Batch"
                      value={item.batch_number || ""}
                      onChange={(e) => updateItem(item.id, "batch_number", e.target.value)}
                      className="w-16 bg-slate-50 border border-slate-200 rounded-sm px-1 py-1 focus:outline-none text-[11px] text-slate-800"
                    />
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200">
                    <input
                      type="date"
                      value={item.expiry_date || ""}
                      onChange={(e) => updateItem(item.id, "expiry_date", e.target.value)}
                      className="w-[90px] bg-slate-50 border border-slate-200 rounded-sm px-1 py-1 focus:outline-none text-[11px] text-slate-800"
                    />
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200">
                    <input
                      type="date"
                      value={item.mfg_date || ""}
                      onChange={(e) => updateItem(item.id, "mfg_date", e.target.value)}
                      className="w-[90px] bg-slate-50 border border-slate-200 rounded-sm px-1 py-1 focus:outline-none text-[11px] text-slate-800"
                    />
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 text-right">
                    <div className="border border-slate-200 rounded-sm overflow-hidden h-7 bg-white w-16 mx-auto">
                      <input
                        type="number"
                        value={item.mrp || 0}
                        onChange={(e) => updateItem(item.id, "mrp", Number(e.target.value))}
                        className="w-full text-right px-2 py-1 focus:outline-none text-[11px] text-slate-800"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 text-right">
                    <div className="border border-slate-200 rounded-sm overflow-hidden h-7 bg-white">
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(item.id, "unit_price", Number(e.target.value))}
                        className="w-16 text-right px-2 py-1 focus:outline-none text-slate-800"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 min-w-[100px]">
                    <div className="flex items-center border border-slate-200 rounded-sm overflow-hidden h-7 bg-white">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                        className="w-10 text-center py-1 focus:outline-none text-slate-800"
                      />
                      <span className="bg-white text-[11px] text-slate-700 px-1 py-1 border-l border-slate-200 w-full text-center">
                        PCS
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 text-right">
                    <div className="border border-slate-200 rounded-sm overflow-hidden h-7 bg-white">
                      <input
                        type="text"
                        readOnly
                        value={(item.quantity * item.unit_price).toFixed(2)}
                        className="w-20 text-right px-2 py-1 bg-slate-50 focus:outline-none text-slate-800"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 min-w-[90px]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center border border-slate-200 rounded-sm overflow-hidden h-6 bg-white">
                        <select
                          value={item.discount_type}
                          onChange={(e) =>
                            updateItem(item.id, "discount_type", e.target.value as any)
                          }
                          className="bg-slate-50 text-slate-500 px-1 border-r border-slate-200 text-[10px] outline-none"
                        >
                          <option value="percent">%</option>
                          <option value="amount">â‚¹</option>
                        </select>
                        <input
                          type="number"
                          value={item.discount_value}
                          onChange={(e) =>
                            updateItem(item.id, "discount_value", Number(e.target.value))
                          }
                          className="w-full text-right px-2 focus:outline-none text-slate-800"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 text-right min-w-[140px]">
                    <div className="flex items-center justify-between border border-slate-200 rounded-sm px-2 py-1.5 bg-white">
                      <input
                        type="number"
                        value={item.tax_rate}
                        onChange={(e) => updateItem(item.id, "tax_rate", Number(e.target.value))}
                        className="w-12 text-right focus:outline-none"
                      />
                      <span className="text-[11px]">% GST</span>
                    </div>
                    <div className="text-[10px] text-slate-600 text-center mt-1">
                      (â‚¹{" "}
                      {(
                        (item.quantity * item.unit_price -
                          (item.discount_type === "percent"
                            ? (item.quantity * item.unit_price * item.discount_value) / 100
                            : Math.min(item.discount_value, item.quantity * item.unit_price))) *
                        (item.tax_rate / 100)
                      ).toFixed(2)}
                      )
                    </div>
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200">
                    <div className="flex items-center justify-end bg-slate-50 border border-slate-200 rounded-sm overflow-hidden h-7">
                      <span className="px-2 bg-slate-100 text-slate-600 border-r border-slate-200 h-full flex items-center text-[10px]">
                        â‚¹
                      </span>
                      <input
                        type="text"
                        readOnly
                        value={(
                          (item.quantity * item.unit_price -
                            (item.discount_type === "percent"
                              ? (item.quantity * item.unit_price * item.discount_value) / 100
                              : Math.min(item.discount_value, item.quantity * item.unit_price))) *
                          (1 + item.tax_rate / 100)
                        ).toFixed(2)}
                        className="w-16 text-right px-2 focus:outline-none bg-slate-50 text-slate-800"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center align-middle">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 mx-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              <tr className="bg-white">
                <td colSpan={13} className="p-3 border-b border-slate-200">
                  <div className="flex gap-4">
                    <button
                      onClick={handleAddItem}
                      className="flex-1 h-12 border border-dashed border-blue-300 bg-white rounded-sm flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <Plus className="w-4 h-4" /> Add Item
                      </span>
                    </button>
                    <div className="h-12 px-4 border border-slate-300 rounded-sm flex items-center gap-2 bg-white flex-shrink-0 w-64 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400">
                      <ScanBarcode className="w-5 h-5 text-slate-500" />
                      <input
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={handleBarcodeSubmit}
                        placeholder="Scan or type barcode..."
                        className="bg-transparent border-none focus:outline-none w-full text-sm text-slate-800"
                      />
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Subtotal Row */}
        <div className="border-b border-slate-200 bg-[#f8f9fa] flex">
          <div className="flex-1 flex justify-end p-3 gap-12 text-sm text-slate-700 pr-[4.5rem]">
            <div className="flex items-center gap-4">
              <span className="uppercase text-[11px] text-slate-500 font-bold tracking-widest">
                Subtotal
              </span>
              <span className="w-20 text-center">â‚¹ {subtotal.toFixed(2)}</span>
            </div>
            <div className="w-28 text-right">â‚¹ {totalTax.toFixed(2)}</div>
            <div className="w-24 text-right">â‚¹ {totalAmount.toFixed(2)}</div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex min-h-[400px]">
          {/* Bottom Left */}
          <div className="flex-[1.5] border-r border-slate-200 p-6 flex flex-col gap-6 bg-white">
            <button className="text-blue-500 text-sm flex items-center gap-1 hover:underline self-start">
              <Plus className="w-3 h-3" /> Add Notes
            </button>

            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-800">Terms and Conditions</span>
                <button className="text-slate-400 hover:text-slate-600">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-[#f8f9fa] rounded-sm p-3 text-xs text-slate-700 leading-relaxed border border-slate-200 h-28">
                1. Goods once sold will not be taken back or exchanged
                <br />
                2. All disputes are subject to [ENTER_YOUR_CITY_NAME] jurisdiction only
              </div>
            </div>

            <button className="text-blue-500 text-sm flex items-center gap-1 hover:underline self-start">
              <Plus className="w-3 h-3" /> Add New Account
            </button>

            <button className="text-blue-500 text-sm flex items-center gap-1 hover:underline self-start">
              <Plus className="w-3 h-3" /> Add Payment QR
            </button>
          </div>

          {/* Bottom Right (Summary) */}
          <div className="flex-1 flex flex-col relative bg-white pb-16">
            <div className="p-6 space-y-4 flex-1">
              <div className="flex justify-between items-center text-sm">
                <button className="text-blue-500 flex items-center gap-1 hover:underline">
                  <Plus className="w-3 h-3" /> Add Additional Charges
                </button>
                <span className="text-slate-800">â‚¹ 0</span>
              </div>

              <div className="flex justify-between items-center text-sm font-medium text-slate-800">
                <span>Taxable Amount</span>
                <span>â‚¹ {(subtotal - totalDiscount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-700">
                <span>Total Tax</span>
                <span>â‚¹ {totalTax.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <button className="text-blue-500 flex items-center gap-1 hover:underline">
                  <Plus className="w-3 h-3" /> Add Discount
                </button>
                <span className="text-slate-800">- â‚¹ {totalDiscount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-sm mt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roundOff !== 0}
                    readOnly
                    className="rounded-sm border-slate-300 text-blue-600 w-4 h-4"
                  />
                  <span className="text-slate-800">Auto Round Off</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-[#f8f9fa] border border-slate-200 rounded-sm px-2 py-1 text-xs cursor-pointer">
                    <span className="text-slate-600">+ Add</span>
                    <ChevronDown className="w-3 h-3 ml-1 text-slate-500" />
                  </div>
                  <div className="flex items-center border border-slate-200 rounded-sm px-2 py-1 bg-white">
                    <span className="text-slate-500 mr-1 text-xs">â‚¹</span>
                    <input
                      className="text-slate-800 w-10 text-right bg-transparent focus:outline-none text-sm"
                      readOnly
                      value={roundOff.toFixed(2)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-bold border-t border-slate-200 pt-4 mt-2">
                <span className="text-slate-900">Total Amount</span>
                <span className="text-slate-900 font-bold text-lg">
                  â‚¹ {totalAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end text-sm mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-slate-600 text-xs">Mark as fully paid</span>
                  <input
                    type="checkbox"
                    className="rounded-sm border-slate-300 text-blue-600 w-3.5 h-3.5"
                  />
                </label>
              </div>

              <div className="flex justify-between items-center text-sm mt-4">
                <span className="text-slate-800">Amount Received</span>
                <div className="flex border border-slate-200 rounded-sm overflow-hidden h-9 bg-white">
                  <span className="px-3 flex items-center text-slate-600 border-r border-slate-200 bg-[#f8f9fa]">
                    â‚¹
                  </span>
                  <input
                    type="text"
                    defaultValue="0"
                    className="w-20 px-2 text-right focus:outline-none text-slate-800"
                  />
                  <div className="flex items-center gap-1 px-3 border-l border-slate-200 cursor-pointer text-slate-700 bg-white hover:bg-slate-50">
                    Cash <ChevronDown className="w-3 h-3 text-slate-500 ml-1" />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-bold pt-4 mt-4 border-t border-slate-100">
                <span className="text-emerald-500">Balance Amount</span>
                <span className="text-emerald-500">â‚¹ {totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Signatory */}
            <div className="absolute bottom-6 right-6 flex flex-col items-end pt-4">
              <div className="text-[10px] text-slate-500 mb-2">
                Authorized signatory for{" "}
                <span className="font-bold text-slate-800">LazyMonkeyAI</span>
              </div>
              <div className="h-8 flex items-center opacity-80 mix-blend-multiply">
                <div className="flex items-center gap-2">
                  <img src="/Logo.png" alt="LazyMonkeyAI Logo" className="h-6 w-6 object-contain" />
                  <div className="text-lg font-black tracking-tight text-slate-800 leading-none">
                    LazyMonkey<span className="text-amber-500">AI</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// Force HMR

