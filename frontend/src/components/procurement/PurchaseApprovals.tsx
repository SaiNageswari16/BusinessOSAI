import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { ShieldCheck, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { inventoryApi } from "../../lib/api-client";
import { toast } from "sonner";

export function PurchaseApprovals() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingIds, setActingIds] = useState<string[]>([]);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const res = await inventoryApi.getPendingApprovals();
      setData(res || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load pending approvals");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, rawType: string, action: "Approve" | "Reject") => {
    setActingIds((prev) => [...prev, `${id}-${action}`]);
    try {
      const res = await inventoryApi.submitApprovalAction(id, rawType, action);
      toast.success(res.message || `Successfully ${action.toLowerCase()}d the request.`);
      
      // Update local state to immediately remove the item
      setData((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action.toLowerCase()} the request.`);
    } finally {
      setActingIds((prev) => prev.filter((x) => x !== `${id}-${action}`));
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Approvals</h2>
          <p className="text-sm text-muted-foreground">Multi-level procurement approval workflows.</p>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          Loading pending approvals...
        </div>
      ) : data.length === 0 ? (
        <div className="bg-card border p-8 rounded-xl text-center text-muted-foreground font-semibold shadow-sm">
          No pending purchase approvals in your queue currently.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.map((req) => (
            <Card key={req.id} className="p-6 border-t-4 border-t-amber-500 bg-card rounded-xl shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-amber-500/10 text-amber-600 grid place-items-center">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{req.type}</h3>
                    <div className="text-xs font-mono text-primary font-semibold mt-0.5">{req.ref}</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted/40 p-4 rounded-xl border border-dashed mb-6 flex justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Requested By</div>
                  <div className="font-semibold text-sm">{req.by}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Total Amount</div>
                  <div className="font-bold text-sm">{req.amount}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => handleAction(req.id, req.raw_type, "Approve")}
                  disabled={actingIds.includes(`${req.id}-Approve`) || actingIds.includes(`${req.id}-Reject`)}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold flex items-center justify-center rounded-lg"
                >
                  {actingIds.includes(`${req.id}-Approve`) ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="size-4 mr-2" />
                  )}
                  Approve
                </Button>
                <Button 
                  onClick={() => handleAction(req.id, req.raw_type, "Reject")}
                  disabled={actingIds.includes(`${req.id}-Approve`) || actingIds.includes(`${req.id}-Reject`)}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-semibold flex items-center justify-center rounded-lg"
                >
                  {actingIds.includes(`${req.id}-Reject`) ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="size-4 mr-2" />
                  )}
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
