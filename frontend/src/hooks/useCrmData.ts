import { useTenant } from "@/contexts/tenant-context";
import * as baseData from "@/data/mockCrmData";

export function useCrmData() {
  const { tenant } = useTenant();

  if (tenant.id === "c2") {
    // Atlas Manufacturing (c2)
    return {
      ...baseData,
      mockCrmStats: {
        totalCustomers: 450,
        activePipelines: 12,
        winRate: 38,
        mrr: 210000,
        mrrGrowth: 15,
      },
      mockCustomers: baseData.mockCustomers.map(c => ({
        ...c,
        name: c.name.replace("Group", "Industries").replace("Corp", "Manufacturing"),
        ltv: c.ltv * 1.5,
      })),
      mockDeals: baseData.mockDeals.map(d => ({
        ...d,
        amount: d.amount * 2,
        name: d.name.replace("Enterprise Plan", "Bulk Order").replace("Pro Plan", "Custom Tooling"),
      })),
      mockLeads: baseData.mockLeads.map(l => ({
        ...l,
        source: l.source === "Website" ? "Trade Show" : "Referral",
      })),
    };
  }

  if (tenant.id === "c3") {
    // Helios Logistics (c3)
    return {
      ...baseData,
      mockCrmStats: {
        totalCustomers: 120,
        activePipelines: 8,
        winRate: 62,
        mrr: 450000,
        mrrGrowth: 8,
      },
      mockCustomers: baseData.mockCustomers.map(c => ({
        ...c,
        name: c.name.replace("Technologies", "Shipping Co").replace("Retail", "Distributors"),
        ltv: c.ltv * 0.8,
      })),
      mockDeals: baseData.mockDeals.map(d => ({
        ...d,
        amount: d.amount * 0.5,
        name: d.name.replace("Enterprise Plan", "Freight Contract").replace("Pro Plan", "Warehouse Lease"),
      })),
      mockLeads: baseData.mockLeads.map(l => ({
        ...l,
        source: "Inbound Logistics",
      })),
    };
  }

  // Default: Nimbus Retail Group (c1)
  return baseData;
}
