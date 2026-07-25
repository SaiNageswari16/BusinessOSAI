import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { ArrowRightLeft, ShieldAlert, Loader2, X } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

export function PurchaseReturns() {
  const [returns, setReturns] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const [returnNo, setReturnNo] = useState("");
  const [poId, setPoId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("Damaged in transit");

  const fetchData = async () => {
    setLoading(true);
    try {
      const pos = await inventoryApi.getPurchaseOrders();
      setPurchaseOrders(pos || []);

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
    setReturnNo(`RET-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setPoId(purchaseOrders[0]?.id || "");
    setProductId(products[0]?.id || "");
    setQty(1);
    setReason("Damaged in transit");
    setIsOpen(true);
  };

  const handleSelectPO = (poId: string) => {
    setPoId(poId);
    const selectedPO = purchaseOrders.find((p) => p.id === poId);
    if (selectedPO && selectedPO.items && selectedPO.items[0]) {
      setProductId(selectedPO.items[0].product_id);
      setQty(selectedPO.items[0].quantity);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poId || !productId || !returnNo.trim()) return toast.error("Please fill in all fields");
    try {
      await inventoryApi.createPurchaseReturn({
        return_number: returnNo,
        purchase_order_id: poId,
        reason,
        items: [
          {
            product_id: productId,
            quantity_returned: Number(qty)
          }
        ]
      });
      toast.success("Purchase Return registered successfully");
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
          <p className="text-sm text-muted-foreground">Manage returns to supplier for replacement or refund.</p>
        </div>
        <Button onClick={handleOpenNew} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
          New Return
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          Loading returns...
        </div>
      ) : returns.length === 0 ? (
        <div className="bg-card border p-8 rounded-xl text-center text-muted-foreground font-semibold shadow-sm">
          No purchase returns recorded yet. Click "New Return" to initiate returns.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {returns.map((ret) => (
            <Card key={ret.id} className="bg-card border p-6 relative overflow-hidden shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-rose-500/10 text-rose-600 grid place-items-center">
                    <ArrowRightLeft className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{ret.return_number}</h3>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">PO Ref: {ret.po_number || "—"}</div>
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                  {ret.status}
                </span>
              </div>

              <div className="bg-muted/40 p-4 rounded-xl border border-dashed flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Return Reason</div>
                  <div className="font-bold text-xs text-rose-600 flex items-center gap-1.5">
                    <ShieldAlert className="size-3 text-rose-500" />
                    {ret.reason || "Damaged/Defective Goods"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Return Qty</div>
                  <div className="font-bold text-lg text-rose-600 font-mono">
                    {ret.items && ret.items[0] ? ret.items[0].quantity_returned : "1"}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4 text-foreground">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                Initiate Purchase Return
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Return Document ID *</label>
                <input
                  type="text"
                  required
                  value={returnNo}
                  onChange={(e) => setReturnNo(e.target.value)}
                  className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-muted-foreground">Select Purchase Order Reference *</label>
                  <select
                    required
                    value={poId}
                    onChange={(e) => handleSelectPO(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">Select PO</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>{po.po_number} ({po.supplier_name})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-muted-foreground">Product Item to Return *</label>
                  <select
                    required
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">Select Product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Quantity to Return *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-muted-foreground">Reason for Return *</label>
                  <textarea
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter return reasons..."
                    rows={3}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm resize-none focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" onClick={() => setIsOpen(false)} variant="outline" className="rounded-lg">
                  Cancel
                </Button>
                <Button type="submit" className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
                  Verify Return Dispatch
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
