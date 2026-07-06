import { useTenant } from "@/contexts/tenant-context";
import * as baseData from "@/data/mockAccountingData";

export function useAccountingData() {
  const { tenant } = useTenant();

  if (tenant.id === "c2") {
    // Atlas Manufacturing (c2)
    return {
      ...baseData,
      mockFinanceStats: {
        totalRevenueYTD: 12500000,
        totalExpensesYTD: 10700000,
        netProfit: 1800000,
        profitMargin: 14.4,
        cashBalance: 3250000,
        accountsReceivable: 420000,
        accountsPayable: 310000,
        totalAssets: 6943000,
        totalLiabilities: 643000,
        totalEquity: 3600000,
        overdueReceivables: 2100000,
        overduePayables: 4200,
      },
      mockBankAccounts: baseData.mockBankAccounts.map(b => ({
        ...b,
        balance: b.balance * 1.5,
        name: b.name.replace("Nimbus", "Atlas")
      })),
      mockInvoices: baseData.mockInvoices.map(i => ({
        ...i,
        amount: i.amount * 2,
        customerName: i.customerName === "Acme Corp" ? "Global Tech" : "Local Retailers"
      })),
      mockJournalEntries: baseData.mockJournalEntries.map(j => ({
        ...j,
        debit: j.debit ? j.debit * 1.5 : 0,
        credit: j.credit ? j.credit * 1.5 : 0,
      })),
    };
  }

  if (tenant.id === "c3") {
    // Helios Logistics (c3)
    return {
      ...baseData,
      mockFinanceStats: {
        totalRevenueYTD: 6200000,
        totalExpensesYTD: 5350000,
        netProfit: 850000,
        profitMargin: 13.7,
        cashBalance: 1250000,
        accountsReceivable: 150000,
        accountsPayable: 80000,
        totalAssets: 3000000,
        totalLiabilities: 300000,
        totalEquity: 2700000,
        overdueReceivables: 100000,
        overduePayables: 2000,
      },
      mockBankAccounts: baseData.mockBankAccounts.map(b => ({
        ...b,
        balance: b.balance * 0.8,
        name: b.name.replace("Nimbus", "Helios")
      })),
      mockInvoices: baseData.mockInvoices.map(i => ({
        ...i,
        amount: i.amount * 0.7,
        customerName: "Fast Freight Co."
      })),
      mockJournalEntries: baseData.mockJournalEntries.map(j => ({
        ...j,
        debit: j.debit ? j.debit * 0.8 : 0,
        credit: j.credit ? j.credit * 0.8 : 0,
      })),
    };
  }

  // Default: Nimbus Retail Group (c1) or others
  return baseData;
}
