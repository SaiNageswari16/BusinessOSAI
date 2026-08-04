const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'Admin', 'Desktop', 'NEW FOLDER', 'frontend', 'src', 'components', 'pos', 'PosSalesInvoice.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Imports
content = content.replace(
  `import { Plus, Settings, ScanBarcode, XCircle, Search, ScanLine, X, ChevronDown } from "lucide-react";`,
  `import { Plus, Settings, ScanBarcode, XCircle, Search, ScanLine, X, ChevronDown, Trash2 } from "lucide-react";
import { posApi, crmApi, invoicesApi, POSProduct } from "../../lib/api-client";
import { toast } from "sonner";

interface InvoiceItem {
  id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_value: number;
  discount_type: "amount" | "percent";
  tax_rate: number;
}`
);

// 2. Component State
content = content.replace(
  `export function PosSalesInvoice() {\n  const [showPaymentTerms, setShowPaymentTerms] = useState(false);`,
  `export function PosSalesInvoice() {
  const [showPaymentTerms, setShowPaymentTerms] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    posApi.getProducts().then(setProducts).catch(console.error);
    crmApi.listCustomers({ page_size: 100 }).then(data => setCustomers(data.items)).catch(console.error);
  }, []);

  const handleAddItem = () => {
    setItems([...items, {
      id: Math.random().toString(36).substr(2, 9),
      product_name: "", quantity: 1, unit_price: 0, discount_value: 0, discount_type: "percent", tax_rate: 0
    }]);
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === "product_id" && value) {
          const product = products.find(p => p.id === value);
          if (product) {
            updated.product_name = product.name;
            updated.unit_price = product.price;
            updated.tax_rate = product.tax_rate || 0;
          }
        }
        return updated;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => setItems(items.filter(item => item.id !== id));

  let subtotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;

  items.forEach(item => {
    const lineGross = item.quantity * item.unit_price;
    const dAmt = item.discount_type === "percent" ? lineGross * (item.discount_value / 100) : Math.min(item.discount_value, lineGross);
    const taxable = lineGross - dAmt;
    const tax = taxable * (item.tax_rate / 100);
    subtotal += lineGross;
    totalDiscount += dAmt;
    totalTax += tax;
  });

  const roundOff = Math.round(subtotal - totalDiscount + totalTax) - (subtotal - totalDiscount + totalTax);
  const totalAmount = subtotal - totalDiscount + totalTax + roundOff;

  const handleSave = async () => {
    if (!selectedCustomer) return toast.error("Please select a customer first.");
    if (items.length === 0) return toast.error("Please add at least one item.");
    try {
      setIsSaving(true);
      const customer = customers.find(c => c.id === selectedCustomer);
      await invoicesApi.createInvoice({
        customer_id: customer.id,
        customer_name: customer.name,
        invoice_date: new Date().toISOString().split("T")[0],
        due_date: new Date().toISOString().split("T")[0],
        lines: items.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name || "Unknown Item",
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_type: it.discount_type,
          discount_value: it.discount_value,
          tax_rate: it.tax_rate
        }))
      });
      toast.success("Sales Invoice created successfully!");
      setItems([]);
    } catch (error: any) {
      toast.error(error?.detail || "Failed to create invoice");
    } finally {
      setIsSaving(false);
    }
  };`
);

// 3. Header Buttons
content = content.replace(
  /<button className="px-4 py-1\.5 text-sm font-medium text-slate-400 border border-slate-200 rounded bg-white cursor-not-allowed">[\s\S]*?Save & New[\s\S]*?<\/button>[\s\S]*?<button className="px-8 py-1\.5 text-sm font-medium text-white rounded bg-indigo-200 cursor-not-allowed">[\s\S]*?Save[\s\S]*?<\/button>/m,
  `<button className="px-4 py-1.5 text-sm font-medium text-slate-400 border border-slate-200 rounded bg-white hover:bg-slate-50 cursor-pointer">
            Save & New
          </button>
          <button 
            disabled={isSaving}
            onClick={handleSave} 
            className="px-8 py-1.5 text-sm font-medium text-white rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
            {isSaving ? "Saving..." : "Save"}
          </button>`
);

// 4. Bill To / Customer
content = content.replace(
  /<div className="p-4 flex-1">[\s\S]*?<button className="w-full h-24 border border-dashed border-blue-300 bg-white rounded-sm flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors">[\s\S]*?<span className="flex items-center gap-2 text-sm font-medium"><Plus className="w-4 h-4" \/> Add Party<\/span>[\s\S]*?<\/button>[\s\S]*?<\/div>/m,
  `<div className="p-4 flex-1">
              <select 
                value={selectedCustomer} 
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full h-10 border border-slate-300 rounded-sm px-3 text-sm focus:outline-none focus:border-blue-500 mb-2"
              >
                <option value="">Select Customer / Party</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {!selectedCustomer && (
                <button className="w-full h-10 border border-dashed border-blue-300 bg-white rounded-sm flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors">
                  <span className="flex items-center gap-2 text-sm font-medium"><Plus className="w-4 h-4" /> Add Party</span>
                </button>
              )}
            </div>`
);

// 5. Table Body Items
content = content.replace(
  /<tbody>[\s\S]*?<tr className="bg-white">/m,
  `<tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-slate-200 align-top group bg-white">
                  <td className="px-3 py-3 border-r border-slate-200 text-slate-600">{idx + 1}</td>
                  <td className="px-3 py-3 border-r border-slate-200 min-w-[220px]">
                    <select 
                      value={item.product_id || ""}
                      onChange={(e) => updateItem(item.id, "product_id", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1 focus:outline-none mb-1 text-slate-800"
                    >
                      <option value="">Select Product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <input 
                      type="text" 
                      placeholder="Enter Description (optional)" 
                      value={item.product_name}
                      onChange={(e) => updateItem(item.id, "product_name", e.target.value)}
                      className="w-full text-[11px] bg-slate-100 border-none rounded-sm px-2 py-1.5 focus:outline-none" 
                    />
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 text-slate-400 text-xs"></td>
                  <td className="px-3 py-3 border-r border-slate-200 text-slate-400 text-xs"></td>
                  <td className="px-3 py-3 border-r border-slate-200 text-slate-400 text-xs"></td>
                  <td className="px-3 py-3 border-r border-slate-200 text-slate-400 text-xs"></td>
                  <td className="px-3 py-3 border-r border-slate-200 text-right">
                    <div className="border border-slate-200 rounded-sm overflow-hidden h-7 bg-white">
                      <input type="number" value={item.unit_price} onChange={e => updateItem(item.id, "unit_price", Number(e.target.value))} className="w-16 text-right px-2 py-1 focus:outline-none text-slate-800" />
                    </div>
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 min-w-[100px]">
                    <div className="flex items-center border border-slate-200 rounded-sm overflow-hidden h-7 bg-white">
                      <input type="number" value={item.quantity} onChange={e => updateItem(item.id, "quantity", Number(e.target.value))} className="w-10 text-center py-1 focus:outline-none text-slate-800" />
                      <span className="bg-white text-[11px] text-slate-700 px-1 py-1 border-l border-slate-200 w-full text-center">PCS</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 text-right">
                    <div className="border border-slate-200 rounded-sm overflow-hidden h-7 bg-white">
                      <input type="text" readOnly value={(item.quantity * item.unit_price).toFixed(2)} className="w-20 text-right px-2 py-1 bg-slate-50 focus:outline-none text-slate-800" />
                    </div>
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 min-w-[90px]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center border border-slate-200 rounded-sm overflow-hidden h-6 bg-white">
                        <select value={item.discount_type} onChange={e => updateItem(item.id, "discount_type", e.target.value as any)} className="bg-slate-50 text-slate-500 px-1 border-r border-slate-200 text-[10px] outline-none">
                          <option value="percent">%</option>
                          <option value="amount">₹</option>
                        </select>
                        <input type="number" value={item.discount_value} onChange={e => updateItem(item.id, "discount_value", Number(e.target.value))} className="w-full text-right px-2 focus:outline-none text-slate-800" />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 text-right min-w-[140px]">
                    <div className="flex items-center justify-between border border-slate-200 rounded-sm px-2 py-1.5 bg-white">
                      <input type="number" value={item.tax_rate} onChange={e => updateItem(item.id, "tax_rate", Number(e.target.value))} className="w-12 text-right focus:outline-none" />
                      <span className="text-[11px]">% GST</span>
                    </div>
                    <div className="text-[10px] text-slate-600 text-center mt-1">
                      (₹ {((item.quantity * item.unit_price - (item.discount_type === 'percent' ? (item.quantity * item.unit_price * item.discount_value / 100) : Math.min(item.discount_value, item.quantity * item.unit_price))) * (item.tax_rate / 100)).toFixed(2)})
                    </div>
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200">
                    <div className="flex items-center justify-end bg-slate-50 border border-slate-200 rounded-sm overflow-hidden h-7">
                      <span className="px-2 bg-slate-100 text-slate-600 border-r border-slate-200 h-full flex items-center text-[10px]">₹</span>
                      <input type="text" readOnly value={
                        ((item.quantity * item.unit_price - (item.discount_type === 'percent' ? (item.quantity * item.unit_price * item.discount_value / 100) : Math.min(item.discount_value, item.quantity * item.unit_price))) * (1 + item.tax_rate / 100)).toFixed(2)
                      } className="w-16 text-right px-2 focus:outline-none bg-slate-50 text-slate-800" />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center align-middle">
                    <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 mx-auto">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              <tr className="bg-white">`
);

// 6. Add Item click handler
content = content.replace(
  /<button className="flex-1 h-12 border border-dashed border-blue-300 bg-white rounded-sm flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors">/m,
  `<button onClick={handleAddItem} className="flex-1 h-12 border border-dashed border-blue-300 bg-white rounded-sm flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors">`
);

// 7. Subtotal Section Updates
content = content.replace(
  /<span className="w-20 text-center">₹ 0<\/span>[\s\S]*?<\/div>[\s\S]*?<div className="w-28 text-right">₹ 234\.15<\/div>[\s\S]*?<div className="w-24 text-right">₹ 600<\/div>/m,
  `<span className="w-20 text-center">₹ {subtotal.toFixed(2)}</span>
            </div>
            <div className="w-28 text-right">₹ {totalTax.toFixed(2)}</div>
            <div className="w-24 text-right">₹ {totalAmount.toFixed(2)}</div>`
);

// 8. Right side totals update
content = content.replace(
  /<span>Taxable Amount<\/span>[\s\S]*?<span>₹ 365\.85<\/span>[\s\S]*?<\/div>[\s\S]*?<div className="flex justify-between items-center text-sm text-slate-700">[\s\S]*?<span>SGST@14<\/span>[\s\S]*?<span>₹ 51\.22<\/span>[\s\S]*?<\/div>[\s\S]*?<div className="flex justify-between items-center text-sm text-slate-700">[\s\S]*?<span>CGST@14<\/span>[\s\S]*?<span>₹ 51\.22<\/span>[\s\S]*?<\/div>[\s\S]*?<div className="flex justify-between items-center text-sm text-slate-700">[\s\S]*?<span>CESS@36<\/span>[\s\S]*?<span>₹ 131\.71<\/span>[\s\S]*?<\/div>/m,
  `<span>Taxable Amount</span>
                <span>₹ {(subtotal - totalDiscount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-slate-700">
                <span>Total Tax</span>
                <span>₹ {totalTax.toFixed(2)}</span>
              </div>`
);

content = content.replace(
  /<span className="text-slate-800">- ₹ 0<\/span>/m,
  `<span className="text-slate-800">- ₹ {totalDiscount.toFixed(2)}</span>`
);

content = content.replace(
  /<input type="checkbox" className="rounded-sm border-slate-300 text-blue-600 w-4 h-4" \/>/m,
  `<input type="checkbox" checked={roundOff !== 0} readOnly className="rounded-sm border-slate-300 text-blue-600 w-4 h-4" />`
);

content = content.replace(
  /<input className="text-slate-800 w-10 text-right bg-transparent focus:outline-none text-sm" defaultValue="0" \/>/m,
  `<input className="text-slate-800 w-10 text-right bg-transparent focus:outline-none text-sm" readOnly value={roundOff.toFixed(2)} />`
);

content = content.replace(
  /<div className="bg-\[#f8f9fa\] border border-slate-200 text-slate-400 px-4 py-2 rounded-sm w-52 text-right font-normal">Enter Payment amount<\/div>/m,
  `<span className="text-slate-900 font-bold text-lg">₹ {totalAmount.toFixed(2)}</span>`
);

content = content.replace(
  /<span className="text-emerald-500">₹ 0<\/span>/m,
  `<span className="text-emerald-500">₹ {totalAmount.toFixed(2)}</span>`
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully patched PosSalesInvoice.tsx');
