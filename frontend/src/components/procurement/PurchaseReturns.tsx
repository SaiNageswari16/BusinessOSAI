import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { ArrowRightLeft, ShieldAlert, Loader2, X, Building2, Store, Truck, DollarSign, FileCheck } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

export function PurchaseReturns() {
  const [returns, setReturns] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const [returnNo, setReturnNo] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [poId, setPoId] = useState("");
  const [productId, setProductId] = useState("");
  const [sourceLocation, setSourceLocation] = useState("Central Warehouse");
  const [resolutionAction, setResolutionAction] = useState("Debit Note / Credit Note");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("Damaged in transit");

  const fetchData = async () => {
    setLoading(true);
    try {
      const pos = await inventoryApi.getPurchaseOrders();
      setPurchaseOrders(pos || []);

      const supps = await inventoryApi.getSuppliers();
      setSuppliers(supps || []);

      const prodsRes = await inventoryApi.getProducts();
      setProducts(prodsRes.items || []);

      const res = await inventoryApi.getPurchaseReturns();
      setReturns(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenNew = () => {
    const seq = String(returns.length + 1).padStart(4, '0');
    setReturnNo(`PR-RET-2026-${seq}`);
    setSelectedVendorId(suppliers[0]?.id || "");
    setPoId(purchaseOrders[0]?.id || "");
    setProductId(products[0]?.id || "");
    setQty(1);
    setReason("Damaged in transit / Rejected quality check");
    setIsOpen(true);
  };

  const handleSelectPO = (poId: string) => {
    setPoId(poId);
    const selectedPO = purchaseOrders.find((p) => p.id === poId);
    if (selectedPO) {
      if (selectedPO.supplier_id) setSelectedVendorId(selectedPO.supplier_id);
      if (selectedPO.items && selectedPO.items[0]) {
        setProductId(selectedPO.items[0].product_id);
        setQty(selectedPO.items[0].quantity);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !returnNo.trim()) return toast.error("Please fill in all required fields");
    try {
      await inventoryApi.createPurchaseReturn({
        return_number: returnNo,
        purchase_order_id: poId || undefined,
        supplier_id: selectedVendorId,
        reason: `${reason} [Source: ${sourceLocation}] [Action: ${resolutionAction}]`,
        items: [
          {
            product_id: productId,
            quantity_returned: Number(qty)
          }
        ]
      });
      toast.success(`Purchase Return ${returnNo} recorded successfully!`);
      setIsOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to register return");
    }
  };

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ArrowRightLeft className="text-primary size-6" /> Purchase Returns (PRT)
          </h2>
          <p className="text-sm text-muted-foreground">Return goods to Vendors/Suppliers with Debit Note & sequence tracking.</p>
        </div>
        <Button onClick={handleOpenNew} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
          Initiate New Purchase Return
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          Loading returns...
        </div>
      ) : returns.length === 0 ? (
        <div className="bg-card border p-8 rounded-xl text-center text-muted-foreground font-semibold shadow-sm">
          No purchase returns recorded yet. Click "Initiate New Purchase Return" to start.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {returns.map((ret) => {
            const suppName = suppliers.find(s => s.id === ret.supplier_id)?.name || ret.supplier_name || "Target Vendor";
            return (
              <Card key={ret.id} className="bg-card border p-6 relative overflow-hidden shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-rose-500/10 text-rose-600 grid place-items-center font-bold">
                      <ArrowRightLeft className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg font-mono text-slate-900">{ret.return_number}</h3>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Building2 className="size-3 text-indigo-500" />
                        <span className="font-bold text-slate-700">{suppName}</span>
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                    {ret.status || "Returned"}
                  </span>
                </div>

                <div className="bg-muted/40 p-4 rounded-xl border border-dashed flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Return Reason & Source</div>
                    <div className="font-bold text-xs text-rose-600 flex items-center gap-1.5">
                      <ShieldAlert className="size-3.5 text-rose-500 shrink-0" />
                      {ret.reason || "Damaged/Defective Goods"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Return Qty</div>
                    <div className="font-bold text-lg text-rose-600 font-mono">
                      {ret.items && ret.items[0] ? ret.items[0].quantity_returned : "1"} pcs
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4 text-foreground">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                Initiate Purchase Return to Vendor
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-xs text-muted-foreground">Return Sequence No *</label>
                  <input
                    type="text"
                    required
                    value={returnNo}
                    onChange={(e) => setReturnNo(e.target.value)}
                    className="w-full p-2 bg-background border rounded-lg text-foreground text-xs font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-xs text-muted-foreground">Target Vendor / Supplier *</label>
                  <select
                    required
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full p-2 bg-background border rounded-lg text-foreground text-xs font-semibold cursor-pointer"
                  >
                    <option value="">Select Vendor</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code || 'Vendor'})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-xs text-muted-foreground">Purchase Order Reference</label>
                  <select
                    value={poId}
                    onChange={(e) => handleSelectPO(e.target.value)}
                    className="w-full p-2 bg-background border rounded-lg text-foreground text-xs cursor-pointer"
                  >
                    <option value="">Select PO (Optional)</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>{po.po_number} ({po.supplier_name})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-xs text-muted-foreground">Dispatch Source Location *</label>
                  <select
                    required
                    value={sourceLocation}
                    onChange={(e) => setSourceLocation(e.target.value)}
                    className="w-full p-2 bg-background border rounded-lg text-foreground text-xs font-semibold cursor-pointer"
                  >
                    <option value="Central Warehouse">Central Warehouse</option>
                    <option value="Secondary Warehouse">Secondary Warehouse</option>
                    <option value="Store Main Branch">Store Main Branch</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-xs text-muted-foreground">Product Item to Return *</label>
                  <select
                    required
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="w-full p-2 bg-background border rounded-lg text-foreground text-xs cursor-pointer"
                  >
                    <option value="">Select Product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-xs text-muted-foreground">Return Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full p-2 bg-background border rounded-lg text-foreground text-xs font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-xs text-muted-foreground">Resolution / Credit Action</label>
                <select
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value)}
                  className="w-full p-2 bg-background border rounded-lg text-foreground text-xs font-semibold cursor-pointer"
                >
                  <option value="Debit Note / Credit Note">Issue Debit Note (Credit Note in MyBillBook style)</option>
                  <option value="Vendor Replacement">Vendor Goods Replacement</option>
                  <option value="Cash Refund">Cash / Bank Account Refund</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-xs text-muted-foreground">Reason for Return *</label>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Damaged during delivery, defective batch, or wrong specification delivered"
                  rows={2}
                  className="w-full p-2 bg-background border rounded-lg text-foreground text-xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" onClick={() => setIsOpen(false)} variant="outline" className="rounded-lg">
                  Cancel
                </Button>
                <Button type="submit" className="gradient-brand text-white border-0 font-bold rounded-lg shadow-sm">
                  Verify & Dispatch Return
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

