import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Receipt, Loader2, X } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

export function VendorBills() {
  const [bills, setBills] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const [billNo, setBillNo] = useState("");
  const [poId, setPoId] = useState("");
  const [amount, setAmount] = useState(1000);
  const [dueDate, setDueDate] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const pos = await inventoryApi.getPurchaseOrders();
      setPurchaseOrders(pos || []);

      const res = await inventoryApi.getVendorBills();
      setBills(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load vendor bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenNew = () => {
    setBillNo(`INV-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setPoId(purchaseOrders[0]?.id || "");
    setAmount(1000);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().substring(0, 10));
    setIsOpen(true);
  };

  const handleSelectPO = (poId: string) => {
    setPoId(poId);
    const selectedPO = purchaseOrders.find((p) => p.id === poId);
    if (selectedPO) {
      setAmount(selectedPO.total_amount);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poId || !billNo.trim()) return toast.error("Please fill in all fields");
    try {
      await inventoryApi.createVendorBill({
        bill_number: billNo,
        purchase_order_id: poId,
        total_amount: Number(amount),
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined
      });
      toast.success("Vendor Invoice bill logged successfully");
      setIsOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to log bill");
    }
  };

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="text-primary size-6" /> Vendor Bills
          </h2>
          <p className="text-sm text-muted-foreground">Manage supplier invoices linked to POs and GRNs.</p>
        </div>
        <Button onClick={handleOpenNew} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
          <Plus className="size-4 mr-2" /> Log Bill
        </Button>
      </div>

      <Card className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                <th className="py-4 px-6">Bill Number</th>
                <th className="py-4 px-6">Linked PO</th>
                <th className="py-4 px-6">Supplier Vendor</th>
                <th className="py-4 px-6 text-right">Invoiced Amount</th>
                <th className="py-4 px-6 text-right">Paid Amount</th>
                <th className="py-4 px-6">Due Date</th>
                <th className="py-4 px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    Loading bills...
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground font-semibold">
                    No vendor bills logged yet. Click "Log Bill" to capture invoices.
                  </td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold">
                      <div className="flex items-center gap-2">
                        <Receipt className="size-4 text-muted-foreground" />
                        {bill.bill_number}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-muted-foreground">{bill.po_number || "—"}</td>
                    <td className="py-4 px-6 font-bold">{bill.supplier_name}</td>
                    <td className="py-4 px-6 text-right font-bold">
                      ₹{bill.total_amount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-emerald-600">
                      ₹{bill.paid_amount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-muted-foreground">
                      {bill.due_date ? new Date(bill.due_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        bill.status === "Paid" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                      }`}>
                        {bill.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4 text-foreground">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                Log Supplier Invoice Bill
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Vendor Invoice Number *</label>
                <input
                  type="text"
                  required
                  value={billNo}
                  onChange={(e) => setBillNo(e.target.value)}
                  className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-muted-foreground">Linked Purchase Order (PO) *</label>
                  <select
                    required
                    value={poId}
                    onChange={(e) => handleSelectPO(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">Select PO Reference</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>{po.po_number} ({po.supplier_name} - ₹{po.total_amount})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Bill Total Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" onClick={() => setIsOpen(false)} variant="outline" className="rounded-lg">
                  Cancel
                </Button>
                <Button type="submit" className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
                  Confirm Log Invoice
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
