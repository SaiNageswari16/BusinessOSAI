import { useTenant } from "@/contexts/tenant-context";
import * as baseData from "@/data/mockAccountingData";

export function useAccountingData() {
  const { tenant } = useTenant();

  if (tenant.id === "c2") {
    // Atlas Manufacturing (c2)
    return {
      ...baseData,
      mockFinanceStats: {
        totalRevenue: 12500000,
        netProfit: 1800000,
        ar: 420000,
        ap: 310000,
        revenueGrowth: 8.5,
        profitMargin: 14.4,
      },
      mockBankAccounts: baseData.mockBankAccounts.map(b => ({
        ...b,
        balance: b.balance * 1.5,
        accountName: b.accountName.replace("Nimbus", "Atlas")
      })),
      mockInvoices: baseData.mockInvoices.map(i => ({
        ...i,
        amount: i.amount * 2,
        customerName: i.customerName === "Acme Corp" ? "Global Tech" : "Local Retailers"
      })),
      mockJournalEntries: baseData.mockJournalEntries.map(j => ({
        ...j,
        amount: j.amount * 1.5,
        debit: j.debit ? j.debit * 1.5 : undefined,
        credit: j.credit ? j.credit * 1.5 : undefined,
      })),
    };
  }

  if (tenant.id === "c3") {
    // Helios Logistics (c3)
    return {
      ...baseData,
      mockFinanceStats: {
        totalRevenue: 6200000,
        netProfit: 850000,
        ar: 150000,
        ap: 80000,
        revenueGrowth: 15.2,
        profitMargin: 13.7,
      },
      mockBankAccounts: baseData.mockBankAccounts.map(b => ({
        ...b,
        balance: b.balance * 0.8,
        accountName: b.accountName.replace("Nimbus", "Helios")
      })),
      mockInvoices: baseData.mockInvoices.map(i => ({
        ...i,
        amount: i.amount * 0.7,
        customerName: "Fast Freight Co."
      })),
      mockJournalEntries: baseData.mockJournalEntries.map(j => ({
        ...j,
        amount: j.amount * 0.8,
        debit: j.debit ? j.debit * 0.8 : undefined,
        credit: j.credit ? j.credit * 0.8 : undefined,
      })),
    };
  }

  // Default: Nimbus Retail Group (c1) or others
  return baseData;
}
