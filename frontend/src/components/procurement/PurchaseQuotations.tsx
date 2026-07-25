import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Plus, Network, Loader2, X } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

export function PurchaseQuotations() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const [rfqNo, setRfqNo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(100);

  const fetchData = async () => {
    setLoading(true);
    try {
      const supps = await inventoryApi.getSuppliers();
      setSuppliers(supps || []);

      const prodsRes = await inventoryApi.getProducts();
      setProducts(prodsRes.items || []);

      const res = await inventoryApi.getPurchaseQuotations();
      setQuotations(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load quotations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenNew = () => {
    setRfqNo(`RFQ-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setSupplierId(suppliers[0]?.id || "");
    setProductId(products[0]?.id || "");
    setQty(1);
    setPrice(100);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !productId || !rfqNo.trim()) return toast.error("Please fill in all fields");
    try {
      await inventoryApi.createPurchaseQuotation({
        quotation_number: rfqNo,
        supplier_id: supplierId,
        items: [
          {
            product_id: productId,
            quantity: Number(qty),
            unit_price: Number(price)
          }
        ]
      });
      toast.success("Purchase Quotation RFQ recorded successfully");
      setIsOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit quotation");
    }
  };

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Network className="text-primary size-6" /> Purchase Quotations (RFQ)
          </h2>
          <p className="text-sm text-muted-foreground">Generate RFQs, compare quotes, and award contracts.</p>
        </div>
        <Button onClick={handleOpenNew} className="gradient-brand text-white border-0 font-semibold rounded-lg shadow-sm">
          <Plus className="size-4 mr-2" /> Generate RFQ
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          Loading RFQs & quotations...
        </div>
      ) : quotations.length === 0 ? (
        <div className="bg-card border p-8 rounded-xl text-center text-muted-foreground font-semibold shadow-sm">
          No RFQ quotations logged yet. Click "Generate RFQ" to onboard vendor quotes.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {quotations.map((rfq) => (
            <Card key={rfq.id} className="bg-card border p-6 relative overflow-hidden shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <Network className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">
                      {rfq.items && rfq.items[0] ? rfq.items[0].product_name : "Quotation RFQ"}
                    </h3>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{rfq.quotation_number}</div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  rfq.status === "Accepted" ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
                }`}>
                  {rfq.status}
                </span>
              </div>

              <div className="bg-muted/40 p-4 rounded-xl border border-dashed flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Supplier Partner</div>
                  <div className="font-bold">{rfq.supplier_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-primary mb-1">Quotation Value</div>
                  <div className="font-mono font-bold text-lg text-primary">
                    ₹{rfq.total_amount.toLocaleString("en-IN")}
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
                <Network className="w-5 h-5 text-primary" />
                Record Vendor Quotation RFQ
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-muted-foreground">RFQ Document ID *</label>
                <input
                  type="text"
                  required
                  value={rfqNo}
                  onChange={(e) => setRfqNo(e.target.value)}
                  className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="font-semibold text-muted-foreground">Supplier Vendor *</label>
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
                  <label className="font-semibold text-muted-foreground">Select Product *</label>
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
                  <label className="font-semibold text-muted-foreground">Quoted Unit Price (₹) *</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" onClick={() => setIsOpen(false)} variant="outline" className="rounded-lg">
                  Cancel
                </Button>
                <Button type="submit" className="gradient-brand text-white border-0 font-semibold rounded-lg">
                  Save Quote
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
