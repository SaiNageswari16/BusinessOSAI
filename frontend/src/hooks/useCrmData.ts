import { useTenant } from "@/contexts/tenant-context";
import * as baseData from "@/data/mockCrmData";

export function useCrmData() {
  const { tenant } = useTenant();

  if (tenant.id === "c2") {
    // Atlas Manufacturing (c2)
    return {
      ...baseData,
      mockCrmStats: {
        ...baseData.mockCrmStats,
        totalCustomers: 450,
        activeCustomers: 380,
        totalRevenue: 2100000,
        churnRate: 1.5,
      },
      mockCustomers: baseData.mockCustomers.map(c => ({
        ...c,
        name: c.name.replace("Group", "Industries").replace("Corp", "Manufacturing"),
        totalPurchases: Math.floor(c.totalPurchases * 1.5),
      })),
      mockDeals: baseData.mockDeals.map(d => ({
        ...d,
        amount: d.amount * 2,
        title: d.title.replace("Enterprise Plan", "Bulk Order").replace("Pro Plan", "Custom Tooling"),
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
        ...baseData.mockCrmStats,
        totalCustomers: 120,
        activeCustomers: 110,
        totalRevenue: 4500000,
        churnRate: 0.8,
      },
      mockCustomers: baseData.mockCustomers.map(c => ({
        ...c,
        name: c.name.replace("Technologies", "Shipping Co").replace("Retail", "Distributors"),
        totalPurchases: Math.floor(c.totalPurchases * 0.8),
      })),
      mockDeals: baseData.mockDeals.map(d => ({
        ...d,
        amount: d.amount * 0.5,
        title: d.title.replace("Enterprise Plan", "Freight Contract").replace("Pro Plan", "Warehouse Lease"),
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
