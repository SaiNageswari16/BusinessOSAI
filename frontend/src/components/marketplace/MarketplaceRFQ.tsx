import React, { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Plus, Search, Filter, CheckCircle2, Clock, Check, X, ArrowRight, MessageSquare, Building2, MapPin } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { marketplaceApi } from "@/lib/api-client";
import { useCurrency } from "@/hooks/use-currency";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function MarketplaceRFQ() {
  const queryClient = useQueryClient();
  const { currency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeBidRFQ, setActiveBidRFQ] = useState<any | null>(null);

  // RFQ form states
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [buyerCompany, setBuyerCompany] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [quantity, setQuantity] = useState(100);
  const [targetPrice, setTargetPrice] = useState(100);
  const [deliveryLocation, setDeliveryLocation] = useState("Dubai, UAE");

  // Bid form
  const [bidPrice, setBidPrice] = useState(90);
  const [bidDays, setBidDays] = useState(5);
  const [vendorName, setVendorName] = useState("TechNova Electronics LLC");

  const { data: rfqs, isLoading } = useQuery({
    queryKey: ["marketplace-rfqs"],
    queryFn: () => marketplaceApi.getRFQs(),
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => marketplaceApi.createRFQ(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-rfqs"] });
      toast.success("RFQ published to verified supplier network!");
      setIsCreateOpen(false);
    },
  });

  const bidMutation = useMutation({
    mutationFn: ({ rfqId, data }: { rfqId: string; data: any }) => marketplaceApi.submitRFQBid(rfqId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-rfqs"] });
      toast.success("Quotation bid submitted!");
      setActiveBidRFQ(null);
    },
  });

  const acceptMutation = useMutation({
    mutationFn: ({ rfqId, bidId }: { rfqId: string; bidId: string }) => marketplaceApi.acceptRFQBid(rfqId, bidId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-rfqs"] });
      toast.success("Bid accepted! Generated Proforma Purchase Order.");
    },
  });

  const filtered = (rfqs || []).filter((r: any) =>
    r.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.buyer_company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100 shrink-0">
              <FileText className="size-4" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">B2B RFQ & Quotation Negotiation Desk</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 pl-10.5">Post bulk procurement requests, receive competitive supplier bids, and generate proforma purchase orders.</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search RFQs, buyers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="size-4" /> + Post RFQ
          </button>
        </div>
      </div>

      {/* ── RFQ Cards with Multi-Supplier Bids ── */}
      <div className="space-y-4">
        {filtered.map((rfq: any) => (
          <div key={rfq.id} className="bg-card border rounded-2xl p-6 shadow-xs space-y-4 hover:border-purple-500/30 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
                    {rfq.id}
                  </span>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                    rfq.status === "Open" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  )}>
                    ● {rfq.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground mt-1">{rfq.product_name}</h3>
                <p className="text-xs text-muted-foreground">Buyer: {rfq.buyer_company} ({rfq.buyer_name}) · Location: {rfq.delivery_location}</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[11px] text-muted-foreground">Target Volume & Budget</span>
                  <div className="text-base font-black text-slate-900">
                    {rfq.quantity.toLocaleString()} units · {currency.symbol}{rfq.target_price.toFixed(2)}/unit
                  </div>
                </div>
                {rfq.status === "Open" && (
                  <button
                    onClick={() => setActiveBidRFQ(rfq)}
                    className="px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Submit Quotation Bid
                  </button>
                )}
              </div>
            </div>

            {/* Bids List */}
            <div>
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Supplier Bids Received ({rfq.bids?.length || 0})
              </h4>
              {rfq.bids?.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No bids submitted yet. Suppliers are reviewing specifications.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {rfq.bids?.map((bid: any) => (
                    <div key={bid.id} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-foreground text-xs">{bid.vendor_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Bid: <span className="font-black text-purple-700">{currency.symbol}{bid.bid_unit_price.toFixed(2)}</span>/unit · Lead Time: {bid.delivery_days} days
                        </div>
                      </div>
                      {bid.status === "Accepted" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                          <CheckCircle2 className="size-3.5" /> Accepted (PO Issued)
                        </span>
                      ) : rfq.status === "Open" ? (
                        <button
                          onClick={() => acceptMutation.mutate({ rfqId: rfq.id, bidId: bid.id })}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-md shadow-xs cursor-pointer"
                        >
                          Accept Bid
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Submit Bid Modal ── */}
      {activeBidRFQ && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <h3 className="text-base font-bold text-foreground">Submit Supplier Bid for {activeBidRFQ.id}</h3>
              <button onClick={() => setActiveBidRFQ(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="size-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                bidMutation.mutate({
                  rfqId: activeBidRFQ.id,
                  data: { vendor_name: vendorName, bid_unit_price: Number(bidPrice), delivery_days: Number(bidDays) },
                });
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="text-xs font-semibold">Vendor / Merchant Name</label>
                <input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background/50 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold">Offer Unit Price ({currency.symbol})</label>
                  <input
                    type="number"
                    value={bidPrice}
                    onChange={(e) => setBidPrice(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Fulfillment Days</label>
                  <input
                    type="number"
                    value={bidDays}
                    onChange={(e) => setBidDays(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background/50 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setActiveBidRFQ(null)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-accent cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-purple-700 text-white rounded-lg text-sm font-bold shadow-xs hover:bg-purple-800 cursor-pointer">
                  Submit Bid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create RFQ Modal ── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <h3 className="text-base font-bold text-foreground">Post Bulk RFQ Request</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="size-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({
                  product_name: productName,
                  category,
                  buyer_company: buyerCompany,
                  buyer_name: buyerName,
                  quantity: Number(quantity),
                  target_price: Number(targetPrice),
                  delivery_location: deliveryLocation,
                });
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="text-xs font-semibold">Product Name / Specifications</label>
                <input
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. 500 Cartons Premium Basmati Rice"
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background/50 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold">Buyer Company</label>
                  <input
                    required
                    value={buyerCompany}
                    onChange={(e) => setBuyerCompany(e.target.value)}
                    placeholder="e.g. Al-Madina Mart LLC"
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Contact Person</label>
                  <input
                    required
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="e.g. Khalid Al-Amri"
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background/50 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold">Quantity</label>
                  <input
                    type="number"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Target Price ({currency.symbol})</label>
                  <input
                    type="number"
                    required
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(Number(e.target.value))}
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-background/50 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-accent cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-purple-700 text-white rounded-lg text-sm font-bold shadow-xs hover:bg-purple-800 cursor-pointer">
                  Publish RFQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
