import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/services/api';
import { apiClient } from '@/services/apiClient';
import type { Member } from '@/types';
import { cn } from '@/utils/cn';

interface POSProduct {
  id: string;
  name: string;
  sub: string;
  price: number;
  category: string;
  badge?: string;
  iconName: string;
  bgGradient: string;
  iconColor: string;
  imageUrl?: string;
}

interface CartItem {
  product: POSProduct;
  qty: number;
}

interface RecentSale {
  invoiceId: string;
  customerName: string;
  itemsStr: string;
  amount: number;
  paymentMethod: string;
  dateTimeStr: string;
}

const posTabs = ['Quick Sale', 'Recent Sales', 'Draft Orders', 'Hold Cart', 'Daily Summary'];
const categories = ['All', 'Memberships', 'Services', 'Supplements', 'Merchandise'];

export function PosPage() {
  const [activeTab, setActiveTab] = useState('Quick Sale');
  const [activeCat, setActiveCat] = useState('All');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    apiClient.get<any[]>('/plans')
      .then((plans) => {
        if (!isMounted) return;
        if (Array.isArray(plans) && plans.length > 0) {
          const dynamicProducts: POSProduct[] = plans.map((p, i) => ({
            id: p.id || `plan_${i}`,
            name: p.name,
            sub: p.duration_days ? `${p.duration_days} Days` : '',
            price: Number(p.price) || 0,
            category: 'Memberships',
            badge: p.badge || `${Math.round((p.duration_days || 30) / 30)} Mo`,
            iconName: p.price > 10000 ? 'crown' : p.price > 5000 ? 'award' : 'shield',
            bgGradient: i % 2 === 0 ? 'from-amber-900 via-neutral-900 to-black' : 'from-blue-900 to-indigo-950',
            iconColor: i % 2 === 0 ? 'text-amber-400' : 'text-blue-400',
            imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=500&auto=format&fit=crop&q=80',
          }));
          setProducts(dynamicProducts);
        } else {
          setProducts([]);
        }
      })
      .catch(() => {
        if (isMounted) setProducts([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Cart State (empty by default)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Wallet' | 'Split Payment'>('UPI');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);

  // Customer Selection State (null by default)
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string; code: string } | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberList, setMemberList] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  // Discount Modal State
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [customDiscountInput, setCustomDiscountInput] = useState('0');

  // Custom Item Modal State
  const [customItemModalOpen, setCustomItemModalOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemSub, setCustomItemSub] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');

  // Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<RecentSale | null>(null);

  useEffect(() => {
    Promise.all([
      api.customers.list().catch(() => []),
      api.payments.all().catch(() => []),
    ]).then(([custList, txRes]) => {
      if (Array.isArray(custList)) setMemberList(custList);
      const txs = Array.isArray(txRes) ? txRes : (txRes as any)?.transactions || [];
      if (Array.isArray(txs) && txs.length > 0) {
        const sales: RecentSale[] = txs.map((tx: any) => ({
          invoiceId: tx.invoice_number || tx.invoice || `INV-${tx.id}`,
          customerName: tx.member || tx.customer_name || 'Customer',
          itemsStr: tx.plan_name || 'POS Transaction',
          amount: tx.amount || 0,
          paymentMethod: tx.payment_method || tx.method || 'Online',
          dateTimeStr: tx.date || tx.created_at || 'Today',
        }));
        setRecentSales(sales);
      }
    });
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesCat = activeCat === 'All' || p.category === activeCat;
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sub.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const addToCart = (product: POSProduct) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) => (c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.product.id === id ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const [includeGst, setIncludeGst] = useState<boolean>(true);

  // Calculate totals
  const subtotal = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  const discount = Math.min(subtotal, discountAmount);
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = includeGst ? Math.round(taxableAmount * 0.18) : 0;
  const totalAmount = taxableAmount + tax;

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName || !customItemPrice) return;
    const priceNum = Number(customItemPrice) || 0;
    const newCustomProd: POSProduct = {
      id: `custom_${Date.now()}`,
      name: customItemName,
      sub: customItemSub || 'Custom Service',
      price: priceNum,
      category: 'Other',
      iconName: 'plus-circle',
      bgGradient: 'from-brand-600 to-indigo-900',
      iconColor: 'text-brand-300',
    };
    addToCart(newCustomProd);
    setCustomItemName('');
    setCustomItemSub('');
    setCustomItemPrice('');
    setCustomItemModalOpen(false);
  };

  const handleApplyDiscountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(customDiscountInput) || 0;
    setDiscountAmount(val);
    setDiscountModalOpen(false);
  };

  const handleProceedPayment = async () => {
    if (cart.length === 0) return;
    const invoiceNum = `INV-2025-${Math.floor(1000 + Math.random() * 9000)}`;
    const itemsSummary = cart.map((c) => c.product.name).join(', ');
    const custName = selectedMember ? selectedMember.name : 'Walk-in Customer';
    const nowStr = new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    const newSaleRecord: RecentSale = {
      invoiceId: invoiceNum,
      customerName: custName,
      itemsStr: itemsSummary,
      amount: totalAmount,
      paymentMethod,
      dateTimeStr: nowStr,
    };

    try {
      await apiClient.post('/payments/transaction', {
        invoice_id: invoiceNum,
        customer_name: custName,
        amount: totalAmount,
        payment_method: paymentMethod,
        items: itemsSummary,
      });
    } catch (_err) {
      /* fallback graceful */
    }

    setRecentSales((prev) => [newSaleRecord, ...prev]);
    setCompletedSale(newSaleRecord);
    setReceiptModalOpen(true);
  };

  const filteredMembers = memberList.filter(
    (m) =>
      !memberSearch ||
      (m.name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.phone || '').includes(memberSearch)
  );

  return (
    <div className="space-y-5 animate-fade-in pb-12">


      {/* POS Sub-Navigation Tabs */}
      <div className="flex border-b border-navy-100 gap-6 text-sm font-semibold text-navy-500">
        {posTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'pb-3 transition-all relative',
              activeTab === tab ? 'text-brand-600 font-bold' : 'hover:text-navy-800'
            )}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Main Grid: Left Catalog & Table / Right Cart Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Catalog Search, Category Pills, Grid, Recent Sales Table) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Catalog Search & Category Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
              <input
                type="text"
                placeholder="Search products, services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field text-xs pl-9 py-2 rounded-xl bg-white border border-navy-200"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                    activeCat === cat
                      ? 'bg-brand-600 text-white shadow-glow'
                      : 'bg-navy-50/80 text-navy-600 hover:bg-navy-100 border border-navy-100'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="hidden sm:flex items-center gap-1 bg-navy-50 p-1 rounded-xl border border-navy-100 text-navy-400">
              <button className="p-1 rounded-lg bg-white shadow text-brand-600">
                <Icon name="grid" size={14} />
              </button>
              <button className="p-1 rounded-lg hover:text-navy-700">
                <Icon name="list" size={14} />
              </button>
            </div>
          </div>

          {/* Products & Services Section */}
          <div>
            <h2 className="text-sm font-bold text-navy-900 mb-3">Products & Services</h2>

            {loading ? (
              <Skeleton className="h-64 w-full rounded-2xl" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="card card-hover p-3 text-left group flex flex-col justify-between h-48 border border-navy-100 hover:border-brand-500 transition-all"
                  >
                    {/* Visual Card Image / Photo container */}
                    <div className="aspect-[4/3] rounded-xl bg-navy-100 overflow-hidden relative shadow-sm mb-2 group-hover:scale-105 transition-transform duration-200">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className={cn('w-full h-full bg-gradient-to-br p-3 flex flex-col justify-between', p.bgGradient)}>
                          <Icon name={p.iconName as any} size={24} className={p.iconColor} />
                        </div>
                      )}
                      {p.badge && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold text-white bg-black/60 backdrop-blur px-1.5 py-0.5 rounded shadow">
                          {p.badge}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-bold text-navy-900 line-clamp-1 group-hover:text-brand-600 transition-colors">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-navy-400">{p.sub}</div>
                      <div className="text-sm font-extrabold text-navy-900 mt-1">
                        ₹{p.price.toLocaleString()}
                      </div>
                    </div>
                  </button>
                ))}

                {/* Add Custom Item Card */}
                <button
                  onClick={() => setCustomItemModalOpen(true)}
                  className="card p-3 text-center flex flex-col items-center justify-center h-48 border-2 border-dashed border-navy-200 hover:border-brand-500 hover:bg-brand-50/20 group transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Icon name="plus" size={20} className="text-brand-600" />
                  </div>
                  <div className="text-xs font-bold text-navy-900">Custom Item</div>
                  <div className="text-[10px] text-navy-400 mt-1">Add custom product or service</div>
                </button>
              </div>
            )}
          </div>

          {/* Recent Sales Table */}
          <div className="card p-4 border border-navy-100">
            <h2 className="text-sm font-bold text-navy-900 mb-3">Recent Sales</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-navy-100 text-navy-400 font-semibold uppercase tracking-wider">
                    <th className="pb-2 px-2">Invoice ID</th>
                    <th className="pb-2 px-2">Customer</th>
                    <th className="pb-2 px-2">Items</th>
                    <th className="pb-2 px-2">Amount</th>
                    <th className="pb-2 px-2">Payment</th>
                    <th className="pb-2 px-2">Date</th>
                    <th className="pb-2 px-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {recentSales.map((sale) => (
                    <tr key={sale.invoiceId} className="hover:bg-navy-50/60 transition-colors">
                      <td className="py-2.5 px-2 font-mono font-bold text-navy-800">{sale.invoiceId}</td>
                      <td className="py-2.5 px-2 font-semibold text-navy-900">{sale.customerName}</td>
                      <td className="py-2.5 px-2 text-navy-600 truncate max-w-[200px]">{sale.itemsStr}</td>
                      <td className="py-2.5 px-2 font-bold text-navy-900">₹{sale.amount.toLocaleString()}</td>
                      <td className="py-2.5 px-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-navy-100 text-navy-700">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-navy-400">{sale.dateTimeStr}</td>
                      <td className="py-2.5 px-2 text-right">
                        <button
                          onClick={() => {
                            setCompletedSale(sale);
                            setReceiptModalOpen(true);
                          }}
                          className="p-1 rounded-lg text-brand-600 hover:bg-brand-50"
                          title="Print Receipt"
                        >
                          <Icon name="file-text" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Sidebar (Cart & Checkout Panel matching exact screenshot) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="card p-5 border border-navy-100 space-y-4 shadow-sm bg-white sticky top-20">
            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-navy-100 pb-3">
              <h2 className="text-sm font-bold text-navy-900">
                Current Sale ({cart.reduce((sum, c) => sum + c.qty, 0)} Items)
              </h2>
              <button onClick={clearCart} className="text-xs font-semibold text-danger-600 hover:text-danger-700">
                Clear All
              </button>
            </div>

            {/* Cart Itemized List */}
            {cart.length === 0 ? (
              <div className="text-center py-10 text-xs text-navy-400 space-y-2">
                <Icon name="shopping-bag" size={32} className="mx-auto text-navy-300" />
                <div>Current sale cart is empty.</div>
                <div className="text-[10px] text-navy-400">Click any product or service to add it.</div>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-navy-50/70 border border-navy-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-navy-100 overflow-hidden shrink-0 border border-navy-200">
                        {item.product.imageUrl ? (
                          <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={cn('w-full h-full bg-gradient-to-br flex items-center justify-center', item.product.bgGradient)}>
                            <Icon name={item.product.iconName as any} size={16} className={item.product.iconColor} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-navy-900 truncate">{item.product.name}</div>
                        <div className="text-[10px] text-navy-400">{item.product.sub}</div>
                        <div className="text-xs font-semibold text-navy-800">
                          ₹{item.product.price.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Stepper buttons */}
                      <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-navy-200">
                        <button
                          onClick={() => updateQty(item.product.id, -1)}
                          className="text-navy-500 hover:text-navy-900 text-xs font-bold px-1"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold text-navy-900 w-4 text-center">{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.product.id, 1)}
                          className="text-navy-500 hover:text-navy-900 text-xs font-bold px-1"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-xs font-extrabold text-navy-900 min-w-[60px] text-right">
                        ₹{(item.product.price * item.qty).toLocaleString()}
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-navy-300 hover:text-danger-600 text-xs"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Apply Discount Banner */}
            <button
              onClick={() => setDiscountModalOpen(true)}
              className="w-full flex items-center justify-start gap-2 px-3 py-2.5 rounded-xl bg-brand-50/60 border border-brand-100 text-brand-700 text-xs font-semibold hover:bg-brand-50 transition-colors"
            >
              <Icon name="tag" size={14} className="text-brand-600" />
              <span>Apply Discount</span>
              {discountAmount > 0 && (
                <span className="ml-auto text-[10px] font-bold text-success-600 bg-success-50 px-2 py-0.5 rounded-full border border-success-200">
                  -₹{discountAmount.toLocaleString()} Applied
                </span>
              )}
            </button>

            {/* Subtotal & Breakdown Calculations */}
            <div className="space-y-2 text-xs pt-2 border-t border-navy-100">
              <div className="flex justify-between text-navy-600">
                <span>Subtotal</span>
                <span className="font-bold text-navy-900">₹{subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-navy-600">
                  <span>Discount</span>
                  <span className="font-bold text-danger-600">- ₹{discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-navy-600 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer select-none font-bold text-navy-800 hover:text-brand-600 transition-colors">
                  <input
                    type="checkbox"
                    checked={includeGst}
                    onChange={(e) => setIncludeGst(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-navy-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                  <span>Apply GST (18%)</span>
                </label>
                <span className={cn('font-bold', includeGst ? 'text-navy-900' : 'text-navy-400')}>
                  {includeGst ? `₹${tax.toLocaleString()}` : '₹0 (Without GST)'}
                </span>
              </div>

              <div className="pt-2 border-t border-dashed border-navy-200 flex justify-between items-baseline">
                <div>
                  <div className="text-xs font-bold text-navy-900">Total Amount</div>
                  {discount > 0 && (
                    <div className="text-[10px] font-semibold text-success-600">
                      You Save ₹{discount.toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="text-2xl font-black text-brand-600">
                  ₹{totalAmount.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Primary Payment Action CTA */}
            <button
              onClick={handleProceedPayment}
              disabled={cart.length === 0}
              className="btn-primary w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl text-sm shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span>Proceed to Payment</span>
            </button>

            {/* Payment Method Selector Grid */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => setPaymentMethod('Cash')}
                className={cn(
                  'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                  paymentMethod === 'Cash'
                    ? 'border-success-500 bg-success-50 text-success-700 ring-2 ring-success-500/20'
                    : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
                )}
              >
                <Icon name="dollar-sign" size={14} className="text-success-600" />
                <span>Cash</span>
              </button>

              <button
                onClick={() => setPaymentMethod('UPI')}
                className={cn(
                  'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                  paymentMethod === 'UPI'
                    ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                    : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
                )}
              >
                <Icon name="zap" size={14} className="text-brand-600" />
                <span>UPI</span>
              </button>

              <button
                onClick={() => setPaymentMethod('Card')}
                className={cn(
                  'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                  paymentMethod === 'Card'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                    : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
                )}
              >
                <Icon name="credit-card" size={14} className="text-indigo-600" />
                <span>Card</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod('Wallet')}
                className={cn(
                  'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                  paymentMethod === 'Wallet'
                    ? 'border-cyan-500 bg-cyan-50 text-cyan-700 ring-2 ring-cyan-500/20'
                    : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
                )}
              >
                <Icon name="archive" size={14} className="text-cyan-600" />
                <span>Wallet</span>
              </button>

              <button
                onClick={() => setPaymentMethod('Split Payment')}
                className={cn(
                  'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                  paymentMethod === 'Split Payment'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 ring-2 ring-purple-500/20'
                    : 'border-navy-200 bg-white text-navy-600 hover:bg-navy-50'
                )}
              >
                <Icon name="layers" size={14} className="text-purple-600" />
                <span>Split Payment</span>
              </button>
            </div>

            {/* Customer Member Selector Footer */}
            <div className="flex items-center gap-2 pt-2 border-t border-navy-100">
              {selectedMember ? (
                <div className="flex-1 flex items-center justify-between p-2 rounded-xl bg-navy-50 border border-navy-200">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {selectedMember.name[0]}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-navy-900">{selectedMember.name}</div>
                      <div className="text-[10px] text-navy-400">{selectedMember.code}</div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedMember(null)} className="text-navy-400 hover:text-navy-700">
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setMemberModalOpen(true)}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-dashed border-navy-300 text-xs font-bold text-navy-700 hover:border-brand-500 hover:bg-brand-50/40 flex items-center justify-center gap-1.5"
                >
                  <Icon name="user-plus" size={14} className="text-brand-600" />
                  <span>Attach Member to Sale</span>
                </button>
              )}

              <button
                onClick={() => setMemberModalOpen(true)}
                className="btn-secondary text-xs py-2.5 px-3 rounded-xl flex items-center gap-1 whitespace-nowrap"
              >
                <Icon name="plus" size={14} />
                <span>Add Member</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Discount Modal */}
      {discountModalOpen && (
        <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl animate-scale-in border border-navy-100">
            <div className="flex items-center justify-between border-b border-navy-100 pb-3">
              <h3 className="text-base font-bold text-navy-900">Apply Sale Discount</h3>
              <button onClick={() => setDiscountModalOpen(false)} className="text-navy-400 hover:text-navy-600">
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleApplyDiscountSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-navy-700 mb-1 block">Discount Amount (₹)</label>
                <input
                  type="number"
                  value={customDiscountInput}
                  onChange={(e) => setCustomDiscountInput(e.target.value)}
                  className="input-field"
                  placeholder="e.g. 1098"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setDiscountModalOpen(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Apply Discount
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Search Modal */}
      {memberModalOpen && (
        <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-scale-in border border-navy-100">
            <div className="flex items-center justify-between border-b border-navy-100 pb-3">
              <h3 className="text-base font-bold text-navy-900">Select Gym Member</h3>
              <button onClick={() => setMemberModalOpen(false)} className="text-navy-400 hover:text-navy-600">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="relative">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
              <input
                type="text"
                placeholder="Search member by name or phone..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="input-field text-xs pl-9"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {filteredMembers.length === 0 ? (
                <div className="text-center py-6 text-xs text-navy-400">No members found.</div>
              ) : (
                filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMember({ id: m.id, name: m.name, code: `MEM${m.id.slice(0, 4)}` });
                      setMemberModalOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl border border-navy-100 hover:border-brand-500 hover:bg-brand-50/40 text-left flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-navy-900">{m.name}</div>
                      <div className="text-[10px] text-navy-400">{m.phone || m.email}</div>
                    </div>
                    <Badge variant="brand">{m.membership || 'Member'}</Badge>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Item Modal */}
      {customItemModalOpen && (
        <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl animate-scale-in border border-navy-100">
            <div className="flex items-center justify-between border-b border-navy-100 pb-3">
              <h3 className="text-base font-bold text-navy-900">Add Custom Item</h3>
              <button onClick={() => setCustomItemModalOpen(false)} className="text-navy-400 hover:text-navy-600">
                <Icon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCustomItem} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-navy-700 mb-1 block">Item Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Day Pass, Sauna Access"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-navy-700 mb-1 block">Sub-details (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Single Entry, 1 Session"
                  value={customItemSub}
                  onChange={(e) => setCustomItemSub(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-navy-700 mb-1 block">Price (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 500"
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setCustomItemModalOpen(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Add to Cart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptModalOpen && completedSale && (
        <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl animate-scale-in border border-navy-100 text-center">
            <div className="w-14 h-14 rounded-2xl bg-success-50 text-success-600 flex items-center justify-center mx-auto">
              <Icon name="check-circle" size={32} />
            </div>

            <div>
              <h3 className="text-lg font-bold text-navy-900">Transaction Successful!</h3>
              <p className="text-xs text-navy-400 mt-1">Receipt #{completedSale.invoiceId}</p>
            </div>

            <div className="card p-3 bg-navy-50 text-left text-xs font-mono space-y-1 text-navy-700 border border-navy-200">
              <div>Customer: {completedSale.customerName}</div>
              <div>Items: {completedSale.itemsStr}</div>
              <div>Payment: {completedSale.paymentMethod}</div>
              <div>Date: {completedSale.dateTimeStr}</div>
              <div className="border-t border-navy-200 pt-1 font-bold text-navy-900 text-sm">
                Total Paid: ₹{completedSale.amount.toLocaleString()}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="btn-secondary flex-1 flex items-center justify-center gap-1.5"
              >
                <Icon name="printer" size={14} /> Print Receipt
              </button>
              <button onClick={() => setReceiptModalOpen(false)} className="btn-primary flex-1">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
