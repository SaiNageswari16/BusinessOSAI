import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Package, Clock, ShieldCheck, Loader2, X } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

export function PurchaseRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const [prNo, setPrNo] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [estimatedPrice, setEstimatedPrice] = useState(100);

  const fetchData = async () => {
    setLoading(true);
    try {
      const prs = await inventoryApi.getPurchaseRequests();
      setRequests(prs || []);

      const prodsRes = await inventoryApi.getProducts();
      setProducts(prodsRes.items || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load purchase requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenNew = () => {
    setPrNo(`PR-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setProductId(products[0]?.id || "");
    setQty(1);
    setEstimatedPrice(100);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !prNo.trim()) return toast.error("Please fill in all required fields");
    try {
      const requesterId = "00000000-0000-0000-0000-000000000000";
      await inventoryApi.createPurchaseRequest({
        request_number: prNo,
        requester_id: requesterId,
        items: [
          {
            product_id: productId,
            quantity: Number(qty),
            estimated_price: Number(estimatedPrice)
          }
        ]
      });
      toast.success("Purchase request submitted successfully");
      setIsOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to raise purchase request");
    }
  };

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Package className="text-primary size-6" /> Purchase Requests (PR)
          </h2>
          <p className="text-sm text-muted-foreground">Manage internal departmental requests for materials and services.</p>
        </div>
        <Button onClick={handleOpenNew} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
          <Plus className="size-4 mr-2" /> Raise PR
        </Button>
      </div>

      <Card className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                <th className="py-4 px-6">PR Number</th>
                <th className="py-4 px-6">Requested Items</th>
                <th className="py-4 px-6 text-right">Total Amount</th>
                <th className="py-4 px-6">Date Raised</th>
                <th className="py-4 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    Loading purchase requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground font-semibold">
                    No purchase requests raised yet. Click "Raise PR" to create one.
                  </td>
                </tr>
              ) : (
                requests.map((pr) => (
                  <tr key={pr.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-primary font-mono">{pr.request_number}</div>
                    </td>
                    <td className="py-4 px-6">
                      {pr.items && pr.items.length > 0 ? (
                        <div className="space-y-1">
                          {pr.items.map((it: any) => (
                            <div key={it.id} className="text-foreground font-medium">
                              • {it.product_name || "Unknown Product"} (x{it.quantity})
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No items specified</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right font-bold">
                      ₹{pr.total_amount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-muted-foreground">
                      {pr.request_date ? new Date(pr.request_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        pr.status === "Approved" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                      }`}>
                        {pr.status === "Approved" ? <ShieldCheck className="size-3" /> : <Clock className="size-3" />}
                        {pr.status}
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
                <Package className="w-5 h-5 text-primary" />
                Raise Purchase Request
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">PR Document Number *</label>
                <input
                  type="text"
                  required
                  value={prNo}
                  onChange={(e) => setPrNo(e.target.value)}
                  className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">Select Product Material *</label>
                <select
                  required
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="">Choose Catalog Product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Requested Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">Est. Unit Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={estimatedPrice}
                    onChange={(e) => setEstimatedPrice(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" onClick={() => setIsOpen(false)} variant="outline" className="rounded-lg">
                  Cancel
                </Button>
                <Button type="submit" className="gradient-brand text-white border-0 font-semibold rounded-lg">
                  Submit Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
