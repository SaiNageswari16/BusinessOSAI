import React from "react";
import { createPortal } from "react-dom";
import {
  ScanBarcode, Search, Clock, Combine, Truck, RefreshCw, CreditCard,
  Tag, Heart, History, Sparkles, AlertCircle, ShoppingCart, ArrowRightLeft,
  Banknote, Camera, QrCode, LayoutGrid, List as ListIcon, Edit2, Trash2, X, Info, Boxes,
  CheckCircle2, Keyboard, MonitorSmartphone, Wallet
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { posProducts, posTransactions, posCustomers, posCategories } from "../../lib/pos-fallback";
import { posApi, POSTransactionHistory } from "../../lib/api-client";
import { useTenant } from "../../contexts/tenant-context";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

const PrintableReceipt = ({ bill, allBills }: { bill: any, allBills: any[] }) => {
  const { tenant } = useTenant();
  
  if (!bill) return null;

  const totalQty = bill.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;
  const totalItems = bill.items?.length || 0;

  const companyName = tenant?.name || "";
  const address = (tenant?.raw as any)?.address || "";
  const taxId = (tenant?.raw as any)?.tax_id || "";
  const cin = (tenant?.raw as any)?.registration_number || "";
  const email = (tenant?.raw as any)?.email || "";

  return createPortal(
    <div id="printable-receipt-portal" className="w-[300px] ml-0 mr-auto p-4 font-mono text-black text-[11px] leading-tight" style={{ fontFamily: 'monospace' }}>
      <div className="text-center mb-1">
        <h2 className="text-sm font-bold mb-0">{companyName}</h2>
        <p className="text-[10px] whitespace-pre-line">{address}</p>
        <p className="text-[10px]">GSTIN/UIN: {taxId}<br/>CIN: {cin}<br/>E-Mail: {email}</p>
      </div>
      
      <div className="text-center font-bold border-y border-black py-0.5 my-1 text-xs">
        TAX INVOICE
      </div>

      <div className="text-[10px] mb-1">
        <div className="flex justify-between">
          <span>Bill No. : {bill.id || bill.rawId?.substring(0,8)}</span>
          <span>Time : {new Date(bill.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div className="flex justify-between">
          <span>Date : {new Date(bill.date).toLocaleDateString()}</span>
          <span>User : Admin</span>
        </div>
        <div>Party Name: Cash Customer</div>
      </div>
      
      <div className="flex justify-between font-bold border-y border-black py-0.5 mb-1">
        <span className="w-1/12 text-left">Sl</span>
        <span className="w-5/12 text-left pl-1">Description</span>
        <span className="w-2/12 text-center">Qty</span>
        <span className="w-2/12 text-right">Rate</span>
        <span className="w-2/12 text-right">Amount</span>
      </div>
      
      <div className="min-h-[40px]">
        {bill.items?.map((item: any, idx: number) => {
          const childRefunds = allBills.filter(b => b.parentTxId === bill.rawId);
          const refundedQty = childRefunds.reduce((sum, child) => {
            const childItem = child.items.find((i: any) => i.product_id === item.product_id);
            return sum + (childItem ? Math.abs(childItem.quantity) : 0);
          }, 0);

          const rate = item.price ? item.price : (item.quantity > 0 ? item.subtotal / item.quantity : 0);

          return (
            <div key={idx} className="flex justify-between mb-0.5 items-start">
              <span className="w-1/12 text-left">{idx + 1}</span>
              <span className="w-5/12 text-left break-words pl-1 pr-1">{item.name || `Product ${item.product_id.substring(0,4)}`}</span>
              <span className="w-2/12 text-center">{item.quantity} {refundedQty > 0 && `(-${refundedQty})`}</span>
              <span className="w-2/12 text-right">{rate.toFixed(2)}</span>
              <span className="w-2/12 text-right">{Number(item.subtotal).toFixed(2)}</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-black mt-1"></div>
      
      <div className="flex justify-between items-center mb-1 py-0.5">
        <span className="w-6/12 text-center font-bold">Total</span>
        <span className="w-2/12 text-center font-bold">{totalQty}</span>
        <span className="w-4/12 text-right font-bold">₹ {bill.subtotal?.toFixed(2) || 0}</span>
      </div>

      <div className="border-t border-black mb-1"></div>

      <div className="flex justify-between mb-0.5">
        <span>CGST @{(bill.tax/2 / bill.subtotal * 100).toFixed(0)}%</span>
        <span>{(bill.tax/2 || 0).toFixed(2)}</span>
      </div>
      <div className="flex justify-between mb-0.5">
        <span>SGST @{(bill.tax/2 / bill.subtotal * 100).toFixed(0)}%</span>
        <span>{(bill.tax/2 || 0).toFixed(2)}</span>
      </div>
      
      <div className="border-t border-black my-1"></div>

      <div className="flex justify-between font-bold text-sm border-y border-black py-1 mb-2">
        <span>Total Final Amount :</span>
        <span>{bill.total?.toFixed(2)}</span>
      </div>
      
      <div className="text-[9px] mb-2 text-justify">
        <span className="font-bold underline">Declaration :</span><br/>
        We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
      </div>

      <div className="text-center font-bold text-[10px] mt-2 mb-2">
        <p>THANK YOU FOR SHOPPING WITH US</p>
        <p>VISIT AGAIN | HAVE A NICE DAY</p>
      </div>

      {/* QR Code Placeholder */}
      <div className="flex flex-col items-center mt-2 mb-2">
        <span className="font-bold mb-1 text-[10px]">e-Invoice</span>
        <QrCode className="w-20 h-20 text-black mb-1" strokeWidth={1.5} />
      </div>
    </div>,
    document.body
  );
};

const PlaceholderView = ({ title, icon: Icon, description }: any) => (
  <div className="flex-1 bg-slate-50/50 flex flex-col items-center justify-center p-8">
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 p-12 text-center"
    >
      <div className="w-24 h-24 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100">
        <Icon className="w-10 h-10" />
      </div>
      <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-3">{title}</h2>
      <p className="text-slate-500 font-medium max-w-md mx-auto mb-8">{description}</p>
      <button className="bg-slate-900 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 transition-all">
        Initialize Module
      </button>
    </motion.div>
  </div>
);

export const BarcodeScannerView = ({ addToCart, products = posProducts }: { addToCart?: (p: any) => void, products?: any[] }) => {
  const [manualBarcode, setManualBarcode] = React.useState("");
  const [recentScans, setRecentScans] = React.useState<any[]>([]);
  const [scannerActive, setScannerActive] = React.useState(true);

  const simulateScan = () => {
    const list = products.length > 0 ? products : posProducts;
    const randomProduct = list[Math.floor(Math.random() * list.length)];
    const newScan = {
      ...randomProduct,
      scanTime: new Date().toLocaleTimeString(),
      id: Math.random().toString(36).substr(2, 9)
    };
    setRecentScans(prev => [newScan, ...prev].slice(0, 10)); // Keep last 10
    if (addToCart) addToCart(randomProduct);
  };

  const handleManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcode) return;

    const list = products.length > 0 ? products : posProducts;
    // Find product or pick random if not found for demo purposes
    const product = list.find(p => p.barcode === manualBarcode) || list[0];

    const newScan = {
      ...product,
      scanTime: new Date().toLocaleTimeString(),
      id: Math.random().toString(36).substr(2, 9)
    };
    setRecentScans(prev => [newScan, ...prev].slice(0, 10));
    if (addToCart) addToCart(product);
    setManualBarcode("");
  };

  return (
    <div className="flex-1 bg-slate-50 flex overflow-hidden">

      {/* LEFT PANEL: Scanner Camera */}
      <div className="flex-[2] bg-slate-900 relative flex flex-col">
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

        {/* Scanner Top Bar */}
        <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center z-20">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${scannerActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
            <span className="text-white font-bold tracking-widest uppercase text-sm">
              {scannerActive ? 'Scanner Active' : 'Scanner Offline'}
            </span>
          </div>
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button className="px-4 py-2 rounded-md bg-slate-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm">
              <ScanBarcode className="w-4 h-4" /> Hardware
            </button>
            <button className="px-4 py-2 rounded-md text-slate-400 hover:text-white text-xs font-bold flex items-center gap-2 transition-colors">
              <Camera className="w-4 h-4" /> Camera
            </button>
          </div>
        </div>

        {/* Viewfinder */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
          <div className="w-[400px] h-[250px] border-4 border-emerald-500/30 rounded-3xl mb-8 relative bg-black/20 backdrop-blur-sm">
            <div className="absolute inset-0 border-4 border-emerald-400 rounded-3xl clip-corners opacity-70"></div>
            {scannerActive && (
              <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,1)] animate-scan"></div>
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <ScanBarcode className="w-24 h-24 text-emerald-500" />
            </div>
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight mb-2">Ready to Scan</h2>
          <p className="text-slate-400 font-medium mb-8">Align the barcode within the frame</p>

          <button
            onClick={simulateScan}
            className="px-8 py-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-xl font-bold hover:bg-emerald-500/30 hover:scale-105 transition-all flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" /> Simulate Scan (Demo)
          </button>
        </div>

        <style>{`
          .clip-corners { clip-path: polygon(0 0, 20px 0, 20px 4px, 4px 4px, 4px 20px, 0 20px, 0 100%, 0 calc(100% - 20px), 4px calc(100% - 20px), 4px calc(100% - 4px), 20px calc(100% - 4px), 20px 100%, 0 100%, 100% 100%, 100% calc(100% - 20px), calc(100% - 4px) calc(100% - 20px), calc(100% - 4px) calc(100% - 4px), calc(100% - 20px) calc(100% - 4px), calc(100% - 20px) 100%, 100% 100%, 100% 0, calc(100% - 20px) 0, calc(100% - 20px) 4px, calc(100% - 4px) 4px, calc(100% - 4px) 20px, 100% 20px); }
          @keyframes scan { 0% { top: 10%; } 50% { top: 90%; } 100% { top: 10%; } }
          .animate-scan { animation: scan 2s ease-in-out infinite; }
        `}</style>
      </div>

      {/* RIGHT PANEL: Input & History */}
      <div className="flex-1 bg-white border-l border-slate-200 flex flex-col z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.05)] max-w-md">

        {/* Manual Entry */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Keyboard className="w-4 h-4" /> Manual Entry
          </h3>
          <form onSubmit={handleManualEntry} className="flex gap-2">
            <input
              type="text"
              value={manualBarcode}
              onChange={e => setManualBarcode(e.target.value)}
              placeholder="Type or paste barcode..."
              className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900 font-mono font-bold"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-sm">
              Add
            </button>
          </form>
        </div>

        {/* Recent Scans */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-6 pb-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2"><History className="w-4 h-4" /> Recent Scans</span>
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">{recentScans.length}</span>
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-6 pt-0">
            {recentScans.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                <ScanBarcode className="w-12 h-12 opacity-20" />
                <p className="text-sm font-medium">No items scanned yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {recentScans.map((scan, idx) => (
                    <motion.div
                      key={scan.id}
                      initial={{ opacity: 0, y: -20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className="bg-white border border-emerald-200 shadow-sm rounded-xl p-3 flex items-center gap-4 relative overflow-hidden group hover:border-emerald-400 transition-colors"
                    >
                      {/* Success indicator strip */}
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>

                      <div className="w-12 h-12 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center shrink-0 p-1">
                        <img src={scan.image} alt={scan.name} className="w-full h-full object-contain mix-blend-multiply" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm truncate leading-tight">{scan.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{scan.barcode}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{scan.scanTime}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end">
                        <span className="font-black text-indigo-600">{formatCurrency(scan.sellingPrice)}</span>
                        <div className="flex items-center gap-1 text-emerald-500 mt-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Scanned</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export const QuickSearchView = () => {
  const [search, setSearch] = React.useState("");
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('list');
  const [selectedProduct, setSelectedProduct] = React.useState<any>(null);

  const filtered = posProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search));
  const displayProducts = filtered.slice(0, 15);

  return (
    <div className="flex-1 bg-slate-50/50 flex flex-col p-6 overflow-hidden relative">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 shrink-0 flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-4">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type to search entire catalog..."
            className="flex-1 bg-transparent border-none focus:outline-none text-lg text-slate-800 placeholder:text-slate-400"
          />
          <div className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-bold text-slate-500">{filtered.length} SKUs</div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <ListIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {displayProducts.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedProduct(p)}
                className="bg-white border border-slate-200 rounded-xl overflow-visible hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group flex flex-col relative"
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                  <p className="font-bold mb-1">{p.name}</p>
                  <p className="text-slate-400 mb-1">Barcode: <span className="font-mono text-slate-300">{p.barcode}</span></p>
                  <p className="text-slate-400">{((p as any).description || (p as any).longDesc || '').substring(0, 50)}...</p>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                </div>

                <div className="h-32 bg-slate-100 relative overflow-hidden rounded-t-xl">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur text-xs font-bold px-2 py-1 rounded shadow-sm">{p.stock} in stock</div>
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <p className="text-[10px] font-bold text-slate-400 mb-1">{p.barcode}</p>
                  <h4 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug mb-2 flex-1">{p.name}</h4>
                  <div className="text-lg font-black text-indigo-600">{formatCurrency(p.sellingPrice)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-6 py-4 font-bold">Product</th>
                  <th className="px-6 py-4 font-bold">SKU</th>
                  <th className="px-6 py-4 font-bold">Category</th>
                  <th className="px-6 py-4 font-bold">Price</th>
                  <th className="px-6 py-4 font-bold">Stock</th>
                  <th className="px-6 py-4 font-bold">Kind</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayProducts.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group relative"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                      <img src={p.image} alt={p.name} className="w-10 h-10 rounded border border-slate-100 object-cover" />
                      <span>{p.name}</span>

                      {/* Tooltip */}
                      <div className="absolute left-64 top-1/2 -translate-y-1/2 ml-4 w-56 bg-slate-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                        <p className="font-bold mb-1">{p.name}</p>
                        <p className="text-slate-400 mb-1">Barcode: <span className="font-mono text-slate-300">{p.barcode}</span></p>
                        <p className="text-slate-400">{((p as any).description || (p as any).longDesc || '').substring(0, 60)}...</p>
                        <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-slate-500">{p.sku}</td>
                    <td className="px-6 py-4 text-slate-500">{posCategories.find(c => c.id === p.category)?.name || "Retail"}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">{formatCurrency(p.sellingPrice)}</td>
                    <td className="px-6 py-4 text-slate-500">{p.stock}</td>
                    <td className="px-6 py-4 text-slate-500 uppercase text-[10px] tracking-wider font-bold">RETAIL</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button className="hover:text-indigo-600 p-1"><Edit2 className="w-4 h-4" /></button>
                        <button className="hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product Details Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3 text-slate-900">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-xl leading-none">Product Details</h3>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{selectedProduct.sku}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 flex gap-8">
                <div className="w-48 h-48 bg-slate-50 rounded-2xl border border-slate-200 p-4 shrink-0">
                  <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-contain mix-blend-multiply" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-black text-slate-900 mb-2">{selectedProduct.name}</h2>
                  <p className="text-sm text-slate-600 mb-6 leading-relaxed">{selectedProduct.longDesc}</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Selling Price</p>
                      <div className="text-2xl font-black text-indigo-600">{formatCurrency(selectedProduct.sellingPrice)}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Boxes className="w-3 h-3" /> Inventory</p>
                      <div className="text-2xl font-black text-slate-900">{selectedProduct.stock} <span className="text-sm text-slate-500 font-medium">units</span></div>
                    </div>
                  </div>

                  <div className="mt-6 space-y-2 text-sm">
                    <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Barcode:</span> <span className="font-mono font-bold text-slate-700">{selectedProduct.barcode}</span></div>
                    <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Warehouse:</span> <span className="font-semibold text-slate-700">{selectedProduct.warehouse}</span></div>
                    <div className="flex justify-between pb-2"><span className="text-slate-500">Location:</span> <span className="font-semibold text-slate-700">Rack {selectedProduct.rack} / Shelf {selectedProduct.shelf}</span></div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
export const HoldBillsView = ({ onResume }: { onResume?: (bill: any) => void }) => {
  const [holdBills, setHoldBills] = React.useState<POSTransactionHistory[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchHoldBills = async () => {
      try {
        const bills = await posApi.getHistory({ status_filter: 'on_hold' });
        setHoldBills(bills);
      } catch (e) {
        console.error("Failed to load hold bills", e);
      } finally {
        setLoading(false);
      }
    };
    fetchHoldBills();
  }, []);

  return (
    <div className="flex-1 bg-slate-50/50 flex flex-col p-6 overflow-hidden">
      <div className="mb-6 shrink-0 flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
          <Clock className="w-5 h-5 fill-amber-600" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900">Suspended Bills</h2>
          <p className="text-slate-500 text-sm font-medium">Resume parked transactions.</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center p-12 text-slate-400">Loading...</div>
        ) : holdBills.length === 0 ? (
          <div className="text-center p-12 text-slate-400 font-medium bg-white rounded-xl shadow-sm border border-slate-200">
            No parked bills currently on hold.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {holdBills.map(bill => (
              <div key={bill.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-md">{bill.receipt_number}</span>
                  <span className="text-sm font-semibold text-slate-500">{new Date(bill.created_at).toLocaleTimeString()}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Customer ID: {bill.customer_id ? bill.customer_id.substring(0,8) : 'Walk-in'}</h3>
                <p className="text-sm text-slate-500 mb-6">{bill.items.length} items</p>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-black text-slate-900">{formatCurrency(bill.total_amount)}</div>
                  <button onClick={() => onResume && onResume(bill)} className="bg-slate-900 text-white font-bold px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-md">
                    Resume
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export const SplitBillsView = ({ totalBill, onSubmit }: { totalBill: number, onSubmit?: (payments: any[]) => void }) => {
  const [cash, setCash] = React.useState<number>(0);
  const [card, setCard] = React.useState<number>(0);
  const [upi, setUpi] = React.useState<number>(0);

  const paid = (cash || 0) + (card || 0) + (upi || 0);
  const remaining = totalBill - paid;
  const progress = Math.min(100, (paid / (totalBill || 1)) * 100);

  const handleProcess = () => {
    if (remaining > 0 || !onSubmit) return;
    const payments = [];
    if (cash > 0) payments.push({ payment_method: "cash", amount: cash });
    if (card > 0) payments.push({ payment_method: "card", amount: card });
    if (upi > 0) payments.push({ payment_method: "upi", amount: upi });
    onSubmit(payments);
  };

  return (
    <div className="flex-1 bg-slate-50/50 flex flex-col p-6 overflow-hidden">
      <div className="w-full max-w-4xl mx-auto flex flex-col h-full">
        <div className="mb-6 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <Combine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Split Payment</h2>
              <p className="text-slate-500 text-sm font-medium">Allocate balance across multiple payment methods.</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Bill</div>
            <div className="text-3xl font-black text-slate-900">{formatCurrency(totalBill)}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6 shrink-0">
          <div className="flex justify-between items-end mb-2">
            <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Remaining Balance</div>
            <div className={`text-2xl font-black ${remaining <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {remaining <= 0 ? '$0.00' : formatCurrency(remaining)}
            </div>
          </div>
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-500 ${remaining <= 0 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 flex-1">
          {/* Cash */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <Banknote className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Cash Allocation</h3>
            <div className="relative w-full">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input
                type="number"
                value={cash || ''}
                onChange={(e) => setCash(Number(e.target.value))}
                className="w-full text-center text-2xl font-black text-slate-900 border-2 border-slate-200 rounded-xl py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
              <CreditCard className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Card Allocation</h3>
            <div className="relative w-full">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input
                type="number"
                value={card || ''}
                onChange={(e) => setCard(Number(e.target.value))}
                className="w-full text-center text-2xl font-black text-slate-900 border-2 border-slate-200 rounded-xl py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* UPI */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-4">
              <QrCode className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">UPI Allocation</h3>
            <div className="relative w-full">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input
                type="number"
                value={upi || ''}
                onChange={(e) => setUpi(Number(e.target.value))}
                className="w-full text-center text-2xl font-black text-slate-900 border-2 border-slate-200 rounded-xl py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <button
          disabled={remaining > 0 || totalBill === 0}
          onClick={handleProcess}
          className="w-full mt-6 bg-slate-900 disabled:bg-slate-300 text-white font-black py-4 rounded-xl text-lg uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
        >
          {totalBill === 0 ? 'Cart is Empty' : remaining > 0 ? 'Balance Remaining' : 'Process Split Payment'}
        </button>
      </div>
    </div>
  );
};
export const DeliveryView = () => {
  const [deliveries, setDeliveries] = React.useState<POSTransactionHistory[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const bills = await posApi.getHistory({ limit: 100 });
        const deliveryOrders = bills.filter(b => b.delivery_status != null || b.delivery_address != null);
        setDeliveries(deliveryOrders);
      } catch (e) {
        console.error("Failed to load deliveries", e);
      } finally {
        setLoading(false);
      }
    };
    fetchDeliveries();
  }, []);

  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-slate-100 text-slate-700';
    switch (status.toLowerCase()) {
      case 'preparing': return 'bg-amber-100 text-amber-700';
      case 'out for delivery': return 'bg-blue-100 text-blue-700';
      case 'delivered': return 'bg-emerald-100 text-emerald-700';
      case 'failed': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="flex-1 bg-slate-50/50 flex flex-col p-6 overflow-hidden">
      <div className="mb-6 shrink-0 flex items-center gap-3">
        <div className="w-10 h-10 bg-cyan-100 text-cyan-600 rounded-xl flex items-center justify-center">
          <Truck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900">Delivery Dispatch</h2>
          <p className="text-slate-500 text-sm font-medium">Assign orders and track fulfillment.</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center p-12 text-slate-400">Loading deliveries...</div>
        ) : deliveries.length === 0 ? (
          <div className="text-center p-12 text-slate-400 font-medium bg-white rounded-xl shadow-sm border border-slate-200">
            No delivery orders found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deliveries.map(d => (
              <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-sm font-bold text-slate-900">{d.receipt_number}</span>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md ${getStatusColor(d.delivery_status)}`}>
                    {d.delivery_status || "Pending"}
                  </span>
                </div>
                <div className="mb-4">
                  <p className="text-sm font-bold text-slate-800">Customer {d.customer_id ? d.customer_id.substring(0,8) : "Guest"}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">{d.delivery_address || "No address provided"}</p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                      {d.driver_name ? d.driver_name.charAt(0) : "?"}
                    </div>
                    <span className="text-xs font-semibold text-slate-600">{d.driver_name || "Unassigned"}</span>
                  </div>
                  <div className="text-sm font-black text-slate-900">{formatCurrency(d.total_amount)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export const ExchangeView = () => {
  const returnItem = posProducts[0];
  const newItem = posProducts[5];
  const diff = newItem.sellingPrice - returnItem.sellingPrice;

  return (
    <div className="flex-1 bg-slate-50/50 flex flex-col p-6 overflow-hidden">
      <div className="mb-6 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 text-teal-600 rounded-xl flex items-center justify-center">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Product Exchange</h2>
            <p className="text-slate-500 text-sm font-medium">Scan returned item and replacement item.</p>
          </div>
        </div>
        <button className="bg-slate-900 text-white font-bold px-6 py-2 rounded-lg hover:bg-slate-800 transition-colors shadow-md">
          Process Exchange
        </button>
      </div>

      <div className="flex-1 flex gap-6">
        {/* Return Pane */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          <div className="bg-rose-50 border-b border-rose-100 p-4 text-rose-700 font-bold uppercase tracking-widest text-sm flex items-center justify-between">
            <span>Item to Return (Inbound)</span>
            <span className="bg-rose-200 text-rose-800 px-2 rounded">-1</span>
          </div>
          <div className="p-6 flex-1 flex flex-col items-center text-center">
            <img src={returnItem.image} alt={returnItem.name} className="w-48 h-48 object-cover rounded-xl border border-slate-200 mb-6" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">{returnItem.name}</h3>
            <p className="text-sm font-mono text-slate-500 mb-6">{returnItem.barcode}</p>
            <div className="mt-auto w-full bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
              <span className="font-bold text-slate-500">Value Credit</span>
              <span className="text-2xl font-black text-rose-600">-{formatCurrency(returnItem.sellingPrice)}</span>
            </div>
          </div>
        </div>

        {/* Exchange Icon */}
        <div className="flex flex-col justify-center">
          <div className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm text-slate-400">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
        </div>

        {/* New Item Pane */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          <div className="bg-emerald-50 border-b border-emerald-100 p-4 text-emerald-700 font-bold uppercase tracking-widest text-sm flex items-center justify-between">
            <span>Replacement Item (Outbound)</span>
            <span className="bg-emerald-200 text-emerald-800 px-2 rounded">+1</span>
          </div>
          <div className="p-6 flex-1 flex flex-col items-center text-center">
            <img src={newItem.image} alt={newItem.name} className="w-48 h-48 object-cover rounded-xl border border-slate-200 mb-6" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">{newItem.name}</h3>
            <p className="text-sm font-mono text-slate-500 mb-6">{newItem.barcode}</p>
            <div className="mt-auto w-full bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
              <span className="font-bold text-slate-500">New Charge</span>
              <span className="text-2xl font-black text-emerald-600">{formatCurrency(newItem.sellingPrice)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <span className="text-lg font-bold text-slate-600 uppercase tracking-widest">Net Exchange Difference</span>
        <div className="text-right">
          <span className={`text-4xl font-black ${diff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {diff > 0 ? `+${formatCurrency(diff)}` : formatCurrency(diff)}
          </span>
          <p className="text-sm font-bold text-slate-500 mt-1">{diff > 0 ? 'Amount due from customer' : 'Amount to refund to customer'}</p>
        </div>
      </div>
    </div>
  );
};

export const RefundView = ({ currentSessionId, initialSearch }: { currentSessionId?: string, initialSearch?: string }) => {
  const [search, setSearch] = React.useState(initialSearch || "");
  const [itemSearch, setItemSearch] = React.useState("");
  const [tx, setTx] = React.useState<POSTransactionHistory | null>(null);
  const [selectedItems, setSelectedItems] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(false);

  const handleLookup = async (query?: string) => {
    const q = query || search;
    if (!q.trim()) return;
    setLoading(true);
    try {
      const history = await posApi.getHistory({ limit: 1000 });
      const found = history.find(t => t.id === q || t.receipt_number === q);
      setTx(found || null);
      setSelectedItems({});
      if (!found && !query) alert("Transaction not found");
    } catch (err) {
      console.error(err);
      if (!query) alert("Search failed.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (initialSearch) {
      handleLookup(initialSearch);
    }
  }, [initialSearch]);

  const toggleItem = (itemId: string, maxQty: number) => {
    setSelectedItems(prev => {
      const newItems = { ...prev };
      if (newItems[itemId]) {
        delete newItems[itemId];
      } else {
        newItems[itemId] = maxQty; // default full refund of line item
      }
      return newItems;
    });
  };

  const handleSelectAll = () => {
    if (!tx) return;
    const filteredItems = tx.items.filter(item => 
      itemSearch ? item.product_id.toLowerCase().includes(itemSearch.toLowerCase()) : true
    );
    
    // Check if all filtered items are fully selected
    const allSelected = filteredItems.every(i => selectedItems[i.id] === i.quantity);
    
    if (allSelected) {
      // Deselect filtered
      const newItems = { ...selectedItems };
      filteredItems.forEach(i => delete newItems[i.id]);
      setSelectedItems(newItems);
    } else {
      // Select all filtered
      const newItems = { ...selectedItems };
      filteredItems.forEach(i => { newItems[i.id] = i.quantity; });
      setSelectedItems(newItems);
    }
  };

  const refundAmount = tx ? tx.items.reduce((sum, item) => {
    return sum + (selectedItems[item.id] ? Number(item.unit_price) * selectedItems[item.id] : 0);
  }, 0) : 0;

  const handleRefund = async () => {
    if (!tx || !currentSessionId) return alert("No active session or transaction.");
    if (Object.keys(selectedItems).length === 0) return alert("Select items to refund.");

    try {
      const payload = {
        subtotal: -refundAmount,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: -refundAmount,
        session_id: currentSessionId,
        parent_transaction_id: tx.id,
        items: tx.items.filter(i => selectedItems[i.id]).map(i => ({
          product_id: i.product_id,
          quantity: -selectedItems[i.id],
          unit_price: i.unit_price,
          discount: 0,
          subtotal: -Number(i.unit_price) * selectedItems[i.id]
        })),
        payments: [
          { payment_method: tx.payments?.[0]?.payment_method || "cash", amount: -refundAmount }
        ]
      };
      const response = await posApi.checkout(payload);
      alert("Refund processed successfully! Ref: " + response.receipt_number);
      setTx(null);
      setSelectedItems({});
      setSearch("");
    } catch (err: any) {
      alert("Refund failed: " + (err.detail || err.message));
    }
  };

  return (
    <div className="flex-1 bg-slate-50/50 flex flex-col p-6 overflow-hidden">
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full">
        <div className="mb-6 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Process Refund</h2>
              <p className="text-slate-500 text-sm font-medium">Look up receipt to issue partial or full refund.</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 shrink-0 flex items-center gap-4">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            placeholder="Scan receipt barcode or enter Receipt Number..."
            className="flex-1 bg-transparent border-none focus:outline-none text-lg text-slate-800 placeholder:text-slate-400"
          />
          <button onClick={() => handleLookup()} disabled={loading} className="bg-slate-900 text-white font-bold px-6 py-2 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50">
            {loading ? "Searching..." : "Lookup"}
          </button>
        </div>

        {tx ? (
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-xl font-black text-slate-900 mb-1">{tx.receipt_number}</h3>
                <p className="text-sm font-medium text-slate-500">{new Date(tx.created_at).toLocaleString()} • {tx.customer_id || "Guest"}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Original Total</div>
                <div className="text-2xl font-black text-slate-900">{formatCurrency(tx.total_amount)}</div>
              </div>
            </div>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2 flex-1 max-w-sm relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3" />
                <input 
                  type="text" 
                  placeholder="Filter items..." 
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <button 
                onClick={handleSelectAll}
                className="text-sm font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-lg transition-colors"
              >
                Select All
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <th className="pb-3 px-6 w-10">Select</th>
                    <th className="pb-3 px-6">Item ID</th>
                    <th className="pb-3 px-6 text-center w-24">Qty Refunded</th>
                    <th className="pb-3 px-6 text-right">Unit Price</th>
                    <th className="pb-3 px-6 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {tx.items
                    .filter(item => itemSearch ? item.product_id.toLowerCase().includes(itemSearch.toLowerCase()) : true)
                    .map((item) => (
                    <tr key={item.id} className="border-b border-slate-50">
                      <td className="py-4 px-6">
                        <input
                          type="checkbox"
                          checked={!!selectedItems[item.id]}
                          onChange={() => toggleItem(item.id, item.quantity)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-800">{item.product_id.substring(0,8)}...</p>
                      </td>
                      <td className="py-4 text-center font-medium text-slate-600">
                        {selectedItems[item.id] ? (
                          <input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={selectedItems[item.id]}
                            onChange={e => setSelectedItems(prev => ({ ...prev, [item.id]: Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 1)) }))}
                            className="w-16 border border-slate-200 rounded px-2 py-1 text-center"
                          />
                        ) : item.quantity}
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-slate-600">{formatCurrency(item.unit_price)}</td>
                      <td className="py-4 px-6 text-right font-bold text-slate-900">{formatCurrency(item.unit_price * (selectedItems[item.id] || item.quantity))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Refund Amount</span>
                <div className="text-3xl font-black text-rose-500">{formatCurrency(refundAmount)}</div>
              </div>
              <button
                onClick={handleRefund}
                disabled={refundAmount === 0}
                className="bg-rose-500 disabled:bg-slate-300 text-white font-black px-8 py-4 rounded-xl hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20 uppercase tracking-widest"
              >
                Issue Refund
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">
            Search for a transaction to process a refund.
          </div>
        )}
      </div>
    </div>
  );
};
export const PriceCheckView = () => (
  <div className="flex-1 bg-slate-50/50 flex flex-col items-center justify-center p-8">
    <div className="w-full max-w-3xl bg-white rounded-3xl border border-slate-200 shadow-xl p-12 flex items-center gap-10">
      <div className="w-64 h-64 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center">
        <ScanBarcode className="w-20 h-20 text-slate-300" />
      </div>
      <div className="flex-1">
        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full tracking-wide uppercase">Kiosk Mode</span>
        <h2 className="text-4xl font-black text-slate-900 mt-4 mb-2">Price Checker</h2>
        <p className="text-slate-500 mb-8">Scan any product barcode using the connected scanner to instantly view its price, promotions, and stock availability.</p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="font-mono text-sm text-slate-600">Scanner active & listening...</span>
        </div>
      </div>
    </div>
  </div>
);
export const FavoritesView = ({ products = [], addToCart }: { products?: any[], addToCart?: (product: any) => void }) => {
  const [favoriteIds, setFavoriteIds] = React.useState<string[]>([]);
  
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('pos_favorites');
      if (stored) setFavoriteIds(JSON.parse(stored));
    } catch(e) {}
  }, []);

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newFavs = favoriteIds.includes(id) 
      ? favoriteIds.filter(f => f !== id)
      : [...favoriteIds, id];
    setFavoriteIds(newFavs);
    localStorage.setItem('pos_favorites', JSON.stringify(newFavs));
  };

  // If no favorites are set yet, show top 5 as a placeholder demo
  const favorites = favoriteIds.length > 0 
    ? products.filter(p => favoriteIds.includes(p.id))
    : products.slice(0, 5);

  return (
    <div className="flex-1 bg-slate-50/50 flex flex-col p-6 overflow-hidden">
      <div className="mb-6 shrink-0 flex items-center gap-3">
        <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
          <Heart className="w-5 h-5 fill-rose-600" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900">Cashier Favorites</h2>
          <p className="text-slate-500 text-sm font-medium">1-tap access to your most frequently sold items.</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {favorites.length === 0 ? (
          <div className="text-center p-12 text-slate-400 font-medium">No favorite products selected yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {favorites.map(p => (
              <div 
                key={p.id} 
                onClick={() => addToCart && addToCart(p)}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-rose-400 hover:shadow-md transition-all cursor-pointer group flex flex-col relative"
              >
                <div 
                  onClick={(e) => toggleFavorite(e, p.id)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 bg-white/80 backdrop-blur-sm text-rose-500 hover:bg-rose-50 rounded-full flex items-center justify-center shadow-sm transition-colors"
                >
                  <Heart className={`w-4 h-4 ${favoriteIds.includes(p.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                </div>
                <div className="h-28 bg-slate-100 relative overflow-hidden">
                  <img src={p.image || p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-3 text-center">
                  <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug mb-1 h-8">{p.name}</h4>
                  <div className="text-sm font-black text-rose-600">{formatCurrency(p.sellingPrice || p.selling_price)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export const RecentBillsView = ({ onRefund }: { onRefund?: (id: string) => void }) => {
  const [bills, setBills] = React.useState<any[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [selectedBill, setSelectedBill] = React.useState<any | null>(null);

  React.useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      posApi.getHistory({ search: searchQuery || undefined })
        .then((data: POSTransactionHistory[]) => {
          if (Array.isArray(data)) {
            const mapped = data.map(tx => ({
              rawId: tx.id,
              id: tx.receipt_number,
              date: tx.created_at,
              customerName: "Customer",
              paymentMethod: tx.payments?.[0]?.payment_method || "cash",
              total: tx.total_amount,
              status: tx.status.charAt(0).toUpperCase() + tx.status.slice(1),
              items: tx.items,
              payments: tx.payments,
              subtotal: tx.subtotal,
              tax: tx.tax_amount,
              discount: tx.discount_amount,
              isRefund: tx.total_amount < 0,
              parentTxId: tx.parent_transaction_id,
            }));
            setBills(mapped);
          }
        })
        .catch((err) => {
          console.warn("Failed to fetch history:", err);
        })
        .finally(() => setLoading(false));
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  return (
    <div className="flex-1 bg-slate-50/50 flex flex-col p-6 relative overflow-hidden">
      <div className="mb-6 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Recent Receipts</h2>
            <p className="text-slate-500 text-sm font-medium">
              {loading ? "Loading from database..." : `${bills.length} transactions in ledger`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search receipt no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
          {loading && <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border border-slate-200">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0">
            <tr>
              <th className="px-6 py-4 font-bold">Receipt ID</th>
              <th className="px-6 py-4 font-bold">Time</th>
              <th className="px-6 py-4 font-bold">Customer</th>
              <th className="px-6 py-4 font-bold">Method</th>
              <th className="px-6 py-4 font-bold text-right">Total</th>
              <th className="px-6 py-4 font-bold text-center">Status</th>
              <th className="px-6 py-4 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {bills.map(tx => (
              <tr key={tx.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${tx.isRefund ? 'bg-rose-50/30' : ''}`}>
                <td className="px-6 py-4 font-mono font-medium text-slate-700">
                  {tx.id}
                  {tx.isRefund && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 uppercase">Refund</span>}
                </td>
                <td className="px-6 py-4 text-slate-500">{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-6 py-4 font-medium text-slate-900">{tx.customerName}</td>
                <td className="px-6 py-4 text-slate-500">{tx.paymentMethod?.toUpperCase()}</td>
                <td className={`px-6 py-4 text-right font-bold ${tx.isRefund ? 'text-rose-600' : 'text-slate-900'}`}>{formatCurrency(tx.total)}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${tx.isRefund ? 'bg-rose-100 text-rose-700' : tx.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {tx.isRefund ? 'Refunded' : tx.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => setSelectedBill(tx)}
                    className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-bold text-xs px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bill Details Modal */}
      <AnimatePresence>
        {selectedBill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            onClick={() => setSelectedBill(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3 text-slate-900">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg leading-none">Receipt Details</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">{selectedBill.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedBill(null)} className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-lg border border-slate-200 shadow-sm transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              {/* Customer Info */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                    {selectedBill.customerName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{selectedBill.customerName}</p>
                    <p className="text-xs text-slate-500">{new Date(selectedBill.date).toLocaleString()}</p>
                  </div>
                  <div className="ml-auto flex gap-2">
                    {selectedBill.isRefund && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                        Refund Receipt
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${selectedBill.isRefund ? 'bg-rose-100 text-rose-700' : selectedBill.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {selectedBill.isRefund ? 'Refunded' : selectedBill.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Purchased Items</h4>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {selectedBill.items.map((item: any, idx: number) => {
                    // Check if this specific item was refunded in any child transactions
                    const childRefunds = bills.filter(b => b.parentTxId === selectedBill.rawId);
                    const refundedQty = childRefunds.reduce((sum, child) => {
                      const childItem = child.items.find((i: any) => i.product_id === item.product_id);
                      return sum + (childItem ? Math.abs(childItem.quantity) : 0);
                    }, 0);
                    
                    return (
                      <div key={idx} className="flex justify-between p-3 border-b border-slate-100 last:border-b-0 items-center">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800 line-clamp-1">{item.name || `Product ${item.product_id.substring(0,8)}`}</p>
                          <p className="text-xs text-slate-500">
                            {item.quantity} x {formatCurrency(item.unit_price)}
                            {refundedQty > 0 && (
                              <span className="ml-2 font-bold text-rose-600">({refundedQty} Refunded)</span>
                            )}
                          </p>
                        </div>
                        <div className="text-sm font-black text-slate-900">
                          {formatCurrency(item.subtotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Details */}
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Payment Breakdown</h4>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                  <div className="flex justify-between text-sm text-slate-600 font-medium">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedBill.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 font-medium">
                    <span>Tax (5%)</span>
                    <span>{formatCurrency(selectedBill.tax || 0)}</span>
                  </div>
                  {selectedBill.discount > 0 && (
                    <div className="flex justify-between text-sm text-rose-600 font-medium">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedBill.discount || 0)}</span>
                    </div>
                  )}
                  <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between text-lg font-black text-slate-900">
                    <span>Grand Total {selectedBill.isRefund && "(Refunded)"}</span>
                    <span className={selectedBill.isRefund ? "text-rose-600" : ""}>{formatCurrency(selectedBill.total)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Methods Used */}
              {selectedBill.payments && selectedBill.payments.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Payment Methods</h4>
                  <div className="flex gap-2">
                    {selectedBill.payments.map((pm: any, idx: number) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 flex-1 text-center shadow-sm">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{pm.payment_method}</p>
                        <p className="text-sm font-black text-slate-900">{formatCurrency(pm.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
            
            {/* Actions */}
            <div className="p-4 border-t border-slate-200 bg-white flex gap-3">
              <button 
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
              >
                Print Receipt
              </button>
              {!selectedBill.isRefund && (
                <button 
                  onClick={() => {
                    if (onRefund && selectedBill?.id) {
                      onRefund(selectedBill.id);
                    }
                  }}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-slate-900/20"
                >
                  Refund
                </button>
              )}
            </div>
          </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <PrintableReceipt bill={selectedBill} allBills={bills} />
    </div>
  );
};
export const AISuggestionsView = () => (
  <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-[120px]"></div>
    <div className="w-full max-w-4xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-12 text-center relative z-10">
      <div className="w-20 h-20 bg-indigo-500/20 text-indigo-300 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-400/30">
        <Sparkles className="w-10 h-10" />
      </div>
      <h2 className="text-4xl font-black text-white tracking-tight mb-4">IOTRONCS Retail Copilot</h2>
      <p className="text-indigo-100 text-lg font-medium max-w-2xl mx-auto mb-10">
        The AI is analyzing real-time cart data, customer history, and local weather patterns to suggest high-conversion cross-sells.
      </p>
      <div className="grid grid-cols-3 gap-6 text-left">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors cursor-pointer">
            <div className="h-32 bg-black/20 rounded-xl mb-4 animate-pulse"></div>
            <div className="h-4 w-3/4 bg-white/20 rounded mb-2"></div>
            <div className="h-4 w-1/2 bg-white/20 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const WalletView = () => {
  const [summary, setSummary] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    posApi.getDailySummary().then(data => {
      setSummary(data);
      setIsLoading(false);
    }).catch((err) => {
      console.error("Failed to load daily summary:", err);
      // Fallback to empty state
      setSummary({ transactions_count: 0, total_revenue: 0, breakdown: { cash: 0, card: 0, upi: 0 }, split_count: 0 });
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Daily Wallet Summary</h2>
            <p className="text-slate-500 font-medium">Session payment breakdowns and totals</p>
          </div>
        </div>

        {isLoading || !summary ? (
          <div className="flex justify-center items-center h-64"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
        ) : (
          <div className="space-y-6">
            
            {/* Grand Total */}
            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
              <p className="text-slate-400 font-bold tracking-wider uppercase text-sm mb-2 relative z-10">Total Collected Today</p>
              <h1 className="text-5xl font-black tracking-tight relative z-10">{formatCurrency(summary.total_revenue)}</h1>
              <div className="mt-4 inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg text-sm font-medium border border-white/10 relative z-10">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {summary.transactions_count} Transactions processed
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                  <Banknote className="w-6 h-6" />
                </div>
                <p className="text-slate-500 font-bold uppercase tracking-wider text-xs mb-1">Cash Collection</p>
                <h3 className="text-3xl font-black text-slate-900">{formatCurrency(summary.breakdown?.cash || 0)}</h3>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                  <CreditCard className="w-6 h-6" />
                </div>
                <p className="text-slate-500 font-bold uppercase tracking-wider text-xs mb-1">Card Collection</p>
                <h3 className="text-3xl font-black text-slate-900">{formatCurrency(summary.breakdown?.card || 0)}</h3>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
                  <QrCode className="w-6 h-6" />
                </div>
                <p className="text-slate-500 font-bold uppercase tracking-wider text-xs mb-1">UPI Collection</p>
                <h3 className="text-3xl font-black text-slate-900">{formatCurrency(summary.breakdown?.upi || 0)}</h3>
              </div>

            </div>

            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 flex items-center gap-4 mt-6">
              <Combine className="w-8 h-8 text-amber-500 shrink-0" />
              <div>
                <h4 className="text-amber-900 font-bold">Split Payments</h4>
                <p className="text-amber-700/80 text-sm font-medium">You had <b>{summary.split_count}</b> transactions today that used multiple payment methods (e.g. Cash + UPI). The breakdown is already included in the totals above.</p>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
