import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Truck, Loader2, X } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

export function PurchaseOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const [poNo, setPoNo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(100);
  const [tax, setTax] = useState(18);

  const fetchData = async () => {
    setLoading(true);
    try {
      const supps = await inventoryApi.getSuppliers();
      setSuppliers(supps || []);

      const prodsRes = await inventoryApi.getProducts();
      setProducts(prodsRes.items || []);

      const res = await inventoryApi.getPurchaseOrders();
      setOrders(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenNew = () => {
    const seq = String(orders.length + 1).padStart(4, '0');
    setPoNo(`PO-2026-${seq}`);
    setSupplierId(suppliers[0]?.id || "");
    setProductId(products[0]?.id || "");
    setQty(1);
    setPrice(100);
    setTax(18);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !productId || !poNo.trim()) return toast.error("Please fill in all fields");
    try {
      await inventoryApi.createPurchaseOrder({
        po_number: poNo,
        supplier_id: supplierId,
        items: [
          {
            product_id: productId,
            quantity: Number(qty),
            unit_price: Number(price),
            tax_percent: Number(tax)
          }
        ]
      });
      toast.success("Purchase Order dispatch registered successfully");
      setIsOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create PO");
    }
  };

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Truck className="text-primary size-6" /> Purchase Orders (PO)
          </h2>
          <p className="text-sm text-muted-foreground">Manage official supplier orders, approvals, and dispatch status.</p>
        </div>
        <Button onClick={handleOpenNew} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
          <Plus className="size-4 mr-2" /> Create PO
        </Button>
      </div>

      <Card className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50 border-b text-muted-foreground text-xs uppercase font-semibold">
                <th className="py-4 px-6">PO Number</th>
                <th className="py-4 px-6">Supplier Vendor</th>
                <th className="py-4 px-6">Ordered Items</th>
                <th className="py-4 px-6 text-right">PO Total Amount</th>
                <th className="py-4 px-6">Order Date</th>
                <th className="py-4 px-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    Loading purchase orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground font-semibold">
                    No purchase orders logged yet. Click "Create PO" to place an order.
                  </td>
                </tr>
              ) : (
                orders.map((po) => (
                  <tr key={po.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-mono font-bold text-primary">{po.po_number}</div>
                    </td>
                    <td className="py-4 px-6 font-bold">
                      <div className="flex items-center gap-2">
                        <Truck className="size-4 text-muted-foreground" />
                        {po.supplier_name}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {po.items && po.items.length > 0 ? (
                        <div className="space-y-0.5 text-xs">
                          {po.items.map((it: any) => (
                            <div key={it.id}>
                              • {it.product_name || "Material"} (x{it.quantity})
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No items specified</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right font-bold">
                      ₹{po.total_amount.toLocaleString("en-IN")}
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-muted-foreground">
                      {po.order_date ? new Date(po.order_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        po.status === "Billed" || po.status === "Fully Received"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}>
                        {po.status}
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
                <Truck className="w-5 h-5 text-primary" />
                Issue Purchase Order (PO)
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">PO Order Number *</label>
                <input
                  type="text"
                  required
                  value={poNo}
                  onChange={(e) => setPoNo(e.target.value)}
                  className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-muted-foreground">Select Supplier *</label>
                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">Select Vendor</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-muted-foreground">Select Item *</label>
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
                  <label className="font-semibold text-muted-foreground">Quantity *</label>
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
                  <label className="font-semibold text-muted-foreground">Unit Price (₹) *</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-muted-foreground">GST / Tax Percent (%)</label>
                  <input
                    type="number"
                    required
                    value={tax}
                    onChange={(e) => setTax(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" onClick={() => setIsOpen(false)} variant="outline" className="rounded-lg">
                  Cancel
                </Button>
                <Button type="submit" className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
                  Issue Purchase Order
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
