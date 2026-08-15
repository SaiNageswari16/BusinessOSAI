import React, { useState, useEffect } from "react";
import { crmApi, invoicesApi, procurementApi, inventoryApi, crmWalletApi } from "../../lib/api-client";
import { formatCurrency } from "../../lib/utils";
import { 
  Search, 
  HelpCircle, 
  Settings, 
  ChevronDown, 
  Filter, 
  Printer, 
  MoreVertical, 
  ArrowLeft,
  X,
  Plus,
  FileText,
  Calendar,
  WalletCards,
  Receipt,
  FileSpreadsheet,
  CheckCircle,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { ThermalReceiptPrinter } from "./ThermalReceiptPrinter";
import { triggerThermalPrint } from "../../lib/print-helper";

// Removed dummy PAST_PAYMENTS in favor of real backend data

export function PosPaymentIn() {
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  
  const [parties, setParties] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [partySummary, setPartySummary] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentNumber, setPaymentNumber] = useState("4275");
  const [paymentDiscount, setPaymentDiscount] = useState<number | "">("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);

  const [pastPayments, setPastPayments] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalReceived: 0, thisMonth: 0, count: 0 });

  // Toolbar state
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("Last 365 Days");
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [modeFilter, setModeFilter] = useState("All");
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [printedPayment, setPrintedPayment] = useState<any>(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  const filteredPayments = React.useMemo(() => {
    let filtered = [...pastPayments];
    if (tableSearchQuery) {
      const q = tableSearchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        (p.party_name && p.party_name.toLowerCase().includes(q)) ||
        (p.invoice_number && p.invoice_number.toLowerCase().includes(q))
      );
    }
    if (modeFilter !== "All") {
      filtered = filtered.filter(p => p.payment_method?.toLowerCase() === modeFilter.toLowerCase());
    }
    const now = new Date();
    filtered = filtered.filter(p => {
      const pDate = new Date(p.payment_date);
      if (dateFilter === "Today") {
        return pDate.toDateString() === now.toDateString();
      } else if (dateFilter === "Last 7 Days") {
        return (now.getTime() - pDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
      } else if (dateFilter === "Last 30 Days") {
        return (now.getTime() - pDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
      } else if (dateFilter === "Last 365 Days") {
        return (now.getTime() - pDate.getTime()) <= 365 * 24 * 60 * 60 * 1000;
      }
      return true;
    });
    return filtered;
  }, [pastPayments, tableSearchQuery, dateFilter, modeFilter]);

  const fetchPayments = async () => {
    try {
      const invoicesRes = await invoicesApi.listPayments();
      const vendorPaymentsRes = await inventoryApi.getVendorPayments();
      const vendorBillsRes = await inventoryApi.getVendorBills();
      
      const invPayments = (invoicesRes.items || []).map((p: any) => ({
        ...p,
        type: 'in',
        party_name: p.party_name || p.customer_name,
        amount: p.amount,
        payment_date: p.payment_date,
        payment_method: p.payment_method
      }));
      
      const venPayments = (vendorPaymentsRes || []).map((p: any) => {
        const bill = (vendorBillsRes || []).find((b: any) => b.id === p.vendor_bill_id);
        return {
          id: p.id,
          invoice_number: p.bill_number || "Bill",
          party_name: bill?.supplier_name || "Vendor",
          party_id: "Vendor",
          amount: p.amount_paid,
          payment_date: p.payment_date || new Date().toISOString(),
          payment_method: p.payment_method,
          created_at: p.payment_date || new Date().toISOString(),
          type: 'out'
        };
      });
      
      const combined = [...invPayments, ...venPayments].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setPastPayments(combined);
      
      let total = 0;
      let thisMonth = 0;
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      combined.forEach((p: any) => {
        if (p.type === 'in') {
          total += p.amount;
          const d = new Date(p.payment_date);
          if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            thisMonth += p.amount;
          }
        }
      });
      
      setStats({ totalReceived: total, thisMonth, count: combined.length });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.all([
      crmApi.getCustomers(1, 100),
      procurementApi.getVendors(1, 100)
    ]).then(([custRes, vendRes]) => {
      const c = (custRes.items || custRes).map((x: any) => ({ ...x, type: 'customer' }));
      const v = (vendRes.items || vendRes).map((x: any) => ({ ...x, type: 'vendor' }));
      setParties([...c, ...v]);
    }).catch(console.error);
    
    fetchPayments();
  }, []);

  const handleSelectParty = async (party: any) => {
    setSelectedParty(party);
    setSearchQuery(party.name);
    setIsDropdownOpen(false);
    
    try {
      if (party.type === 'customer') {
        const [data, walletRes]: any = await Promise.all([
          invoicesApi.getCustomerSummary(party.id),
          crmWalletApi.getBalance(party.id).catch(() => ({ balance: 0 }))
        ]);
        setWalletBalance(walletRes.balance);
        if (data) {
          setPartySummary(data);
          if (data.unpaid_invoices && data.unpaid_invoices.length > 0) {
            setPendingInvoices(
              data.unpaid_invoices.map((inv: any) => ({
                id: inv.invoice_number,
                realId: inv.id,
                date: inv.invoice_date,
                total: inv.total_amount,
                pending: inv.balance_due
              }))
            );
          } else {
            setPendingInvoices([]);
          }
        }
      } else {
        // Vendor logic
        const bills: any = await inventoryApi.getVendorBills();
        const pending = (bills || []).filter((b: any) => 
          b.supplier_name === party.name && 
          (b.status === "Unpaid" || b.status === "Partially Paid" || b.status === "Overdue")
        );
        
        const totalPending = pending.reduce((sum: number, b: any) => sum + (b.total_amount - b.paid_amount), 0);
        setPartySummary({ total_pending_due: totalPending });
        
        setPendingInvoices(
          pending.map((inv: any) => ({
            id: inv.bill_number || "Bill",
            realId: inv.id,
            date: inv.due_date || inv.created_at,
            total: inv.total_amount,
            pending: inv.total_amount - inv.paid_amount
          }))
        );
      }
    } catch (err) {
      setPartySummary(null);
      setPendingInvoices([]);
      setWalletBalance(0);
    }
  };

  const calculateAllocation = () => {
    let remaining = Number(paymentAmount) || 0;
    let allocated = 0;
    
    const allocations = pendingInvoices.map(inv => {
      const allocateToThis = Math.min(inv.pending, remaining);
      remaining -= allocateToThis;
      allocated += allocateToThis;
      return {
        ...inv,
        allocated: allocateToThis,
        newPending: inv.pending - allocateToThis
      };
    });

    return { allocations, remainingAdvance: remaining, totalAllocated: allocated };
  };

  const { allocations, remainingAdvance } = calculateAllocation();

  const handleProcessPayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }
    
    if (!selectedParty) {
      toast.error("Please select a party.");
      return;
    }

    if (allocations.length === 0 && selectedParty.type === 'vendor') {
      toast.error("No pending transactions to apply payment to.");
      return;
    }

    setIsProcessing(true);
    try {
      let totalApplied = 0;
      for (const inv of allocations) {
        if (inv.allocated > 0) {
          if (selectedParty.type === 'customer') {
            await invoicesApi.recordPayment(inv.realId, {
              amount: inv.allocated,
              payment_date: paymentDate,
              payment_method: paymentMode.toLowerCase(),
            });
          } else {
            await inventoryApi.createVendorPayment({
              vendor_bill_id: inv.realId,
              amount_paid: inv.allocated,
              payment_method: paymentMode,
              reference_number: paymentNumber
            });
          }
          totalApplied += inv.allocated;
        }
      }
      
      if (remainingAdvance > 0 && selectedParty.type === 'customer') {
        await crmWalletApi.credit(
          selectedParty.id,
          remainingAdvance,
          "Overpayment / Advance from POS",
          paymentNumber
        );
        toast.success(`Overpayment of ${formatCurrency(remainingAdvance)} securely credited to Customer Wallet.`);
      }
      
      if (selectedParty.type === 'customer' && totalApplied > 0) {
        toast.success(`Payment In of ${formatCurrency(totalApplied)} processed successfully!`);
      } else if (selectedParty.type === 'vendor' && totalApplied > 0) {
        toast.success(`Payment Out of ${formatCurrency(totalApplied)} processed successfully!`);
      }
      
      // Re-fetch payments
      fetchPayments();
      
      // Reset state and close sidebar
      setSelectedParty(null);
      setPartySummary(null);
      setPendingInvoices([]);
      setPaymentAmount("");
      setSearchQuery("");
      setIsRecordingPayment(false);
    } catch (error: any) {
      console.error("Payment failed:", error);
      toast.error(error?.response?.data?.detail || error.message || "Failed to process payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintPaymentReceipt = (payment: any) => {
    setActionMenuOpenId(null);
    const billData = {
      invoice_number: `PAY-${payment.id.substring(0,6).toUpperCase()}`,
      invoice_date: payment.payment_date,
      customer_name: payment.party_name,
      total_amount: payment.amount,
      amount_paid: payment.amount,
      balance_due: 0,
      payment_method: payment.payment_method,
      lines: [{
         item_name: `Payment for Inv #${payment.invoice_number}`,
         quantity: 1,
         unit_price: payment.amount,
         line_total: payment.amount
      }]
    };
    setPrintedPayment(billData);
    setTimeout(() => {
      triggerThermalPrint();
    }, 100);
  };

  const handlePrintTableThermally = () => {
    const reportData = {
      invoice_number: `REPORT-${new Date().getTime().toString().substring(5)}`,
      date: new Date().toISOString(),
      customerName: "Payment In Report",
      total: stats.totalReceived,
      subtotal: stats.totalReceived,
      discount: 0,
      tax: 0,
      payment_method: "Various",
      items: filteredPayments.map(p => ({
         name: `${p.party_name || 'Unknown'} (${p.payment_method || 'Cash'})`,
         quantity: 1,
         price: p.amount,
         subtotal: p.amount
      }))
    };
    setPrintedPayment(reportData);
    setTimeout(() => {
      triggerThermalPrint();
    }, 100);
  };

  return (
    <div className="flex w-full h-full relative overflow-hidden text-slate-800">
      
      {/* Hidden Thermal Printer Element */}
      {printedPayment && (
         <div className="hidden">
           <ThermalReceiptPrinter bill={printedPayment} />
         </div>
      )}
      
      {/* LEFT PANE (Main Content) */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isRecordingPayment ? "mr-[480px]" : "mr-0"}`}>
        <div className="p-6 lg:p-8 h-full flex flex-col w-full">
          
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Unified Payment Ledger</h2>
              <p className="text-sm text-slate-500 mt-1">Manage all incoming and outgoing payments from customers and vendors.</p>
            </div>
            <div className="flex gap-3">

              <button 
                onClick={() => setIsRecordingPayment(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Record Payment
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {/* Tile 1 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <WalletCards className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Total Received</p>
                <p className="text-lg font-black text-slate-800">{formatCurrency(stats.totalReceived)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{stats.count} Payments</p>
              </div>
            </div>
            {/* Tile 2 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">This Month</p>
                <p className="text-lg font-black text-slate-800">{formatCurrency(stats.thisMonth)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">This month</p>
              </div>
            </div>
            {/* Tile 3 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Outstanding</p>
                <p className="text-lg font-black text-slate-800">Live</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Select party to view</p>
              </div>
            </div>
            {/* Tile 4 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Average Payment</p>
                <p className="text-lg font-black text-slate-800">{formatCurrency(stats.count > 0 ? stats.totalReceived / stats.count : 0)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Per Transaction</p>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex gap-3 mb-4 no-print">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                placeholder="Search by party name, invoice number..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            
            {/* Date Filter Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Calendar className="w-4 h-4 text-slate-500" /> {dateFilter} <ChevronDown className="w-4 h-4" />
              </button>
              {isDateDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-10 py-1">
                  {["Today", "Last 7 Days", "Last 30 Days", "Last 365 Days", "All Time"].map(opt => (
                    <button 
                      key={opt}
                      onClick={() => { setDateFilter(opt); setIsDateDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex-1"></div>
            
            {/* Mode Filter Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Filter className="w-4 h-4" /> {modeFilter === "All" ? "Filters" : modeFilter}
              </button>
              {isModeDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-10 py-1">
                  {["All", "Cash", "Bank", "Card", "UPI"].map(opt => (
                    <button 
                      key={opt}
                      onClick={() => { setModeFilter(opt); setIsModeDropdownOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {opt === "All" ? "All Payment Modes" : opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={handlePrintTableThermally}
              className="border border-slate-200 rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-50"
              title="Print Displayed Table Thermally"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs sticky top-0">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Payment Number</th>
                    <th className="px-5 py-3">Party Name</th>
                    <th className="px-5 py-3 text-right">Total Amount</th>
                    <th className="px-5 py-3 text-right">Amount Received</th>
                    <th className="px-5 py-3 text-center">Mode</th>
                    <th className="px-5 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                        No payments found.
                      </td>
                    </tr>
                  ) : filteredPayments.map((payment, i) => (
                    <tr key={payment.id || i} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-800">{new Date(payment.payment_date).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500">{new Date(payment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className={`font-semibold ${payment.type === 'in' ? 'text-indigo-600' : 'text-rose-600'}`}>{payment.invoice_number}</p>
                        <p className={`text-xs ${payment.type === 'in' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {payment.type === 'in' ? 'Received' : 'Paid Out'}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 text-slate-800 font-semibold">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            <span className="text-[10px] text-slate-500">👤</span>
                          </div>
                          <div>
                            <p>{payment.party_name}</p>
                            <p className="text-xs font-normal text-slate-500 flex items-center gap-1">
                              <span className="text-[10px]">👤</span> {payment.party_id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-medium">{formatCurrency(payment.amount)}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${payment.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {payment.type === 'in' ? '+' : '-'}{formatCurrency(payment.amount)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-md text-[11px] font-bold capitalize">
                          {payment.payment_method || "cash"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center relative no-print">
                        <button 
                          onClick={() => setActionMenuOpenId(actionMenuOpenId === payment.id ? null : payment.id)}
                          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 mx-auto"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {actionMenuOpenId === payment.id && (
                          <div className="absolute right-8 top-8 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20 py-1 text-left">
                            <button 
                              onClick={() => handlePrintPaymentReceipt(payment)}
                              className="w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                              <Printer className="w-4 h-4 text-indigo-600" /> Print Receipt
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 no-print">
              <span>Showing {filteredPayments.length > 0 ? 1 : 0} to {filteredPayments.length} of {filteredPayments.length} entries</span>
              <div className="flex gap-1">
                <button className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-400">{"<"}</button>
                <button className="w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded font-bold">1</button>
                <button className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-400">{">"}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANE (Record Payment Overlay/Sidebar) */}
      <div 
        className={`absolute top-0 right-0 w-[480px] h-full bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] border-l border-slate-200 transition-transform duration-300 flex flex-col z-50 ${isRecordingPayment ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsRecordingPayment(false)}
              className="text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-slate-800">Record Payment #{paymentNumber}</h3>
          </div>
          <button 
            onClick={() => setIsRecordingPayment(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          <button className="py-3 px-6 text-sm font-bold text-indigo-600 border-b-2 border-indigo-600">Payment Details</button>
          <button className="py-3 px-6 text-sm font-semibold text-slate-500 hover:text-slate-700">Additional Info</button>
        </div>

        {/* Form Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          <div className="grid grid-cols-2 gap-5">
            {/* Party Name */}
            <div className="col-span-1 relative">
              <label className="text-xs font-bold text-slate-600 block mb-1">Party Name <span className="text-rose-500">*</span></label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Select or search party"
                    value={searchQuery}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                      if(e.target.value === "") setSelectedParty(null);
                    }}
                    className="w-full border border-slate-200 rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-indigo-400"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  
                  {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {parties
                        .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(c => (
                          <div 
                            key={`${c.type}-${c.id}`} 
                            onClick={() => handleSelectParty(c)}
                            className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                          >
                            <p className="font-semibold text-sm flex justify-between items-center">
                              {c.name}
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">{c.type}</span>
                            </p>
                            <p className="text-xs text-slate-500">{c.phone}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <button className="w-10 h-10 border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-50 shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Payment In Number */}
            <div className="col-span-1">
              <label className="text-xs font-bold text-slate-600 block mb-1">Payment Reference <span className="text-rose-500">*</span></label>
              <input
                type="text"
                value={paymentNumber}
                onChange={(e) => setPaymentNumber(e.target.value)}
                className="w-full border border-slate-200 rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>

            {/* Payment Date */}
            <div className="col-span-1">
              <label className="text-xs font-bold text-slate-600 block mb-1">Payment Date <span className="text-rose-500">*</span></label>
              <div className="relative">
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg h-10 px-3 pl-9 text-sm focus:outline-none focus:border-indigo-400"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Payment Mode */}
            <div className="col-span-1">
              <label className="text-xs font-bold text-slate-600 block mb-1">Payment Mode <span className="text-rose-500">*</span></label>
              <div className="relative">
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg h-10 px-3 appearance-none text-sm focus:outline-none focus:border-indigo-400 bg-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                  <option value="Card">Credit Card</option>
                  <option value="UPI">UPI</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Amount Received */}
            <div className="col-span-1">
              <label className="text-xs font-bold text-slate-600 block mb-1">Amount <span className="text-rose-500">*</span></label>
              <div className="flex">
                <span className="h-10 px-3 bg-slate-50 border border-r-0 border-slate-200 rounded-l-lg flex items-center text-slate-500 text-sm">₹</span>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-r-lg h-10 px-3 text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            {/* Payment In Discount */}
            <div className="col-span-1">
              <label className="text-xs font-bold text-slate-600 block mb-1">Discount <HelpCircle className="w-3 h-3 inline text-slate-400"/></label>
              <div className="flex">
                <span className="h-10 px-3 bg-slate-50 border border-r-0 border-slate-200 rounded-l-lg flex items-center text-slate-500 text-sm">%</span>
                <input
                  type="number"
                  value={paymentDiscount}
                  onChange={(e) => setPaymentDiscount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-r-lg h-10 px-3 text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          </div>

          {/* Net Amount Box */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 flex justify-between items-center mt-2">
            <span className="text-sm font-semibold text-indigo-900">Net Amount</span>
            <span className="text-xl font-black text-indigo-600">₹ {(Number(paymentAmount) || 0).toFixed(2)}</span>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Notes</label>
            <div className="relative">
              <textarea 
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Enter notes (optional)"
                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-400 min-h-[80px]"
              />
              <span className="absolute bottom-2 right-2 text-[10px] text-slate-400">{paymentNotes.length}/500</span>
            </div>
          </div>

          {/* Linked Transactions (FIFO Auto Allocation) */}
          <div>
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-6 min-h-[160px] flex flex-col items-center justify-center text-center">
              {!selectedParty ? (
                <>
                  <FileText className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-500">Linked Transactions</p>
                  <p className="text-xs text-slate-400 mt-1">Select a party to view and link transactions</p>
                </>
              ) : pendingInvoices.length === 0 ? (
                <>
                  <CheckCircle className="w-8 h-8 text-emerald-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-500">No pending transactions</p>
                  <p className="text-xs text-slate-400 mt-1">{selectedParty.name} has no outstanding dues to link.</p>
                  {selectedParty.type === 'customer' && (
                    <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg max-w-sm">
                      <p className="text-sm text-indigo-700 font-semibold">Any payment received will be added to their Wallet.</p>
                      <p className="text-xs text-indigo-500 mt-1">Current Wallet Balance: {formatCurrency(walletBalance)}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full text-left">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-bold text-slate-700">Linked Pending Invoices (FIFO)</p>
                    <div className="flex gap-2">
                      {selectedParty.type === 'customer' && (
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          Wallet: {formatCurrency(walletBalance)}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                        Total Due: {formatCurrency(partySummary?.total_pending_due || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Invoice #</th>
                          <th className="px-3 py-2 font-semibold text-right">Pending</th>
                          <th className="px-3 py-2 font-semibold text-right text-emerald-600">Allocated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {allocations.map(inv => (
                          <tr key={inv.id} className={inv.allocated > 0 ? "bg-emerald-50/20" : ""}>
                            <td className="px-3 py-2 font-mono text-indigo-600">{inv.id}</td>
                            <td className="px-3 py-2 text-right font-medium text-rose-600">{formatCurrency(inv.pending)}</td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-600">
                              {inv.allocated > 0 ? formatCurrency(inv.allocated) : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
          
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex gap-3 bg-white">
          <button 
            onClick={() => setIsRecordingPayment(false)}
            disabled={isProcessing}
            className="flex-1 py-3 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleProcessPayment}
            disabled={isProcessing}
            className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 text-sm shadow-sm disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Processing...</>
            ) : "Save Payment"}
          </button>
        </div>
      </div>
      
    </div>
  );
}
