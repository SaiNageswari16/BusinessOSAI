import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Boxes, Loader2, X } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

export function GoodsReceivedNotes() {
  const [grns, setGrns] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const [grnNo, setGrnNo] = useState("");
  const [poId, setPoId] = useState("");
  const [productId, setProductId] = useState("");
  const [qtyOrdered, setQtyOrdered] = useState(1);
  const [qtyReceived, setQtyReceived] = useState(1);
  const [qtyAccepted, setQtyAccepted] = useState(1);
  const [qtyRejected, setQtyRejected] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const pos = await inventoryApi.getPurchaseOrders();
      setPurchaseOrders(pos || []);

      const prodsRes = await inventoryApi.getProducts();
      setProducts(prodsRes.items || []);

      const res = await inventoryApi.getGoodsReceivedNotes();
      setGrns(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load GRN logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenNew = () => {
    setGrnNo(`GRN-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setPoId(purchaseOrders[0]?.id || "");
    setProductId(products[0]?.id || "");
    setQtyOrdered(1);
    setQtyReceived(1);
    setQtyAccepted(1);
    setQtyRejected(0);
    setIsOpen(true);
  };

  const handleSelectPO = (poId: string) => {
    setPoId(poId);
    const selectedPO = purchaseOrders.find((p) => p.id === poId);
    if (selectedPO && selectedPO.items && selectedPO.items[0]) {
      setProductId(selectedPO.items[0].product_id);
      setQtyOrdered(selectedPO.items[0].quantity);
      setQtyReceived(selectedPO.items[0].quantity);
      setQtyAccepted(selectedPO.items[0].quantity);
      setQtyRejected(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poId || !productId || !grnNo.trim()) return toast.error("Please fill in all fields");
    try {
      const receivedBy = "00000000-0000-0000-0000-000000000000";
      await inventoryApi.createGoodsReceivedNote({
        grn_number: grnNo,
        purchase_order_id: poId,
        received_by: receivedBy,
        items: [
          {
            product_id: productId,
            quantity_ordered: Number(qtyOrdered),
            quantity_received: Number(qtyReceived),
            quantity_accepted: Number(qtyAccepted),
            quantity_rejected: Number(qtyRejected)
          }
        ]
      });
      toast.success("GRN received and inventory adjusted successfully");
      setIsOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to log GRN");
    }
  };

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Boxes className="text-primary size-6" /> Goods Received Notes (GRN)
          </h2>
          <p className="text-sm text-muted-foreground">Receive PO stock against inventory automatically.</p>
        </div>
        <Button onClick={handleOpenNew} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
          <Plus className="size-4 mr-2" /> Create GRN
        </Button>
      </div>

      <Card className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                <th className="py-4 px-6">GRN Number</th>
                <th className="py-4 px-6">Linked PO</th>
                <th className="py-4 px-6">Received Items</th>
                <th className="py-4 px-6">Received / Damaged</th>
                <th className="py-4 px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    Loading GRNs...
                  </td>
                </tr>
              ) : grns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground font-semibold">
                    No Goods Received Notes created yet. Click "Create GRN" to receive stock.
                  </td>
                </tr>
              ) : (
                grns.map((grn) => (
                  <tr key={grn.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold">
                      <div className="flex items-center gap-2">
                        <Boxes className="size-4 text-primary" />
                        {grn.grn_number}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-muted-foreground">{grn.po_number || "—"}</td>
                    <td className="py-4 px-6">
                      {grn.items && grn.items.length > 0 ? (
                        <div className="space-y-0.5 text-xs">
                          {grn.items.map((it: any) => (
                            <div key={it.id}>
                              • {it.product_name || "Material"}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No items specified</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {grn.items && grn.items.length > 0 ? (
                        <div>
                          <div className="font-bold text-emerald-600">
                            {grn.items[0].quantity_received} Received
                          </div>
                          {grn.items[0].quantity_rejected > 0 && (
                            <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                              {grn.items[0].quantity_rejected} Rejected / Damaged
                            </div>
                          )}
                        </div>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        {grn.status}
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
                <Boxes className="w-5 h-5 text-primary" />
                Record Goods Receipt (GRN)
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">GRN Number *</label>
                <input
                  type="text"
                  required
                  value={grnNo}
                  onChange={(e) => setGrnNo(e.target.value)}
                  className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-muted-foreground">Select Purchase Order *</label>
                  <select
                    required
                    value={poId}
                    onChange={(e) => handleSelectPO(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">Select PO Order</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>{po.po_number} ({po.supplier_name})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-muted-foreground">Received Item *</label>
                  <select
                    required
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">Select Catalog</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Ordered Quantity *</label>
                  <input
                    type="number"
                    required
                    value={qtyOrdered}
                    onChange={(e) => setQtyOrdered(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Received Quantity *</label>
                  <input
                    type="number"
                    required
                    value={qtyReceived}
                    onChange={(e) => {
                      setQtyReceived(Number(e.target.value));
                      setQtyAccepted(Number(e.target.value));
                    }}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Accepted Quantity *</label>
                  <input
                    type="number"
                    required
                    value={qtyAccepted}
                    onChange={(e) => setQtyAccepted(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Rejected / Damaged</label>
                  <input
                    type="number"
                    required
                    value={qtyRejected}
                    onChange={(e) => setQtyRejected(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" onClick={() => setIsOpen(false)} variant="outline" className="rounded-lg">
                  Cancel
                </Button>
                <Button type="submit" className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
                  Verify Receipt
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
