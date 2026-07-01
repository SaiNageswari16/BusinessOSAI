export interface Account {
  id: string;
  code: string;
  name: string;
  type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  balance: number;
  status: "Active" | "Inactive";
  parentCode?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  account: string;
  status: "Posted" | "Draft";
}

export interface Invoice {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  dueDate: string;
  amount: number;
  balanceDue: number;
  status: "Paid" | "Unpaid" | "Overdue" | "Partially Paid";
}

export interface VendorBill {
  id: string;
  vendorName: string;
  date: string;
  dueDate: string;
  amount: number;
  balanceDue: number;
  status: "Paid" | "Unpaid" | "Overdue";
}

export interface BankAccount {
  id: string;
  name: string;
  bank: string;
  accountNo: string;
  type: "Current" | "Savings" | "Cash";
  balance: number;
  currency: string;
  lastReconciled: string;
}

export interface TaxEntry {
  id: string;
  period: string;
  type: "GST" | "TDS" | "VAT";
  taxableAmount: number;
  taxAmount: number;
  paidAmount: number;
  dueDate: string;
  status: "Paid" | "Pending" | "Filed";
}

export interface FixedAsset {
  id: string;
  name: string;
  category: string;
  purchaseDate: string;
  purchaseCost: number;
  bookValue: number;
  depreciationRate: number;
  depreciationMethod: "SLM" | "WDV";
  status: "Active" | "Disposed" | "Under Maintenance";
}

export interface ExpenseClaim {
  id: string;
  employee: string;
  department: string;
  category: string;
  amount: number;
  date: string;
  status: "Approved" | "Pending" | "Rejected";
  description: string;
}

export interface Budget {
  id: string;
  name: string;
  department: string;
  fiscalYear: string;
  budgeted: number;
  actual: number;
  variance: number;
  status: "On Track" | "Over Budget" | "Under Utilized";
}

export const mockAccounts: Account[] = [
  { id: "ACC-1000", code: "1000", name: "Cash in Bank", type: "Asset", balance: 1250000.50, status: "Active" },
  { id: "ACC-1100", code: "1100", name: "Petty Cash", type: "Asset", balance: 15000.00, status: "Active" },
  { id: "ACC-1200", code: "1200", name: "Accounts Receivable", type: "Asset", balance: 450000.00, status: "Active" },
  { id: "ACC-1300", code: "1300", name: "Prepaid Expenses", type: "Asset", balance: 28000.00, status: "Active" },
  { id: "ACC-1500", code: "1500", name: "Inventory", type: "Asset", balance: 850000.00, status: "Active" },
  { id: "ACC-1600", code: "1600", name: "Fixed Assets (Net)", type: "Asset", balance: 2100000.00, status: "Active" },
  { id: "ACC-2000", code: "2000", name: "Accounts Payable", type: "Liability", balance: 210000.00, status: "Active" },
  { id: "ACC-2100", code: "2100", name: "GST Payable", type: "Liability", balance: 48000.00, status: "Active" },
  { id: "ACC-2200", code: "2200", name: "Salaries Payable", type: "Liability", balance: 85000.00, status: "Active" },
  { id: "ACC-2500", code: "2500", name: "Short-Term Loans", type: "Liability", balance: 300000.00, status: "Active" },
  { id: "ACC-3000", code: "3000", name: "Owner's Equity", type: "Equity", balance: 1500000.00, status: "Active" },
  { id: "ACC-3100", code: "3100", name: "Retained Earnings", type: "Equity", balance: 2100000.00, status: "Active" },
  { id: "ACC-4000", code: "4000", name: "Sales Revenue", type: "Revenue", balance: 3200000.00, status: "Active" },
  { id: "ACC-4100", code: "4100", name: "Service Revenue", type: "Revenue", balance: 480000.00, status: "Active" },
  { id: "ACC-4200", code: "4200", name: "Other Income", type: "Revenue", balance: 95000.00, status: "Active" },
  { id: "ACC-5000", code: "5000", name: "Cost of Goods Sold", type: "Expense", balance: 1400000.00, status: "Active" },
  { id: "ACC-5100", code: "5100", name: "Payroll Expenses", type: "Expense", balance: 420000.00, status: "Active" },
  { id: "ACC-5200", code: "5200", name: "Rent & Utilities", type: "Expense", balance: 96000.00, status: "Active" },
  { id: "ACC-5300", code: "5300", name: "Marketing & Advertising", type: "Expense", balance: 65000.00, status: "Active" },
  { id: "ACC-5400", code: "5400", name: "Depreciation", type: "Expense", balance: 110000.00, status: "Active" },
];

export const mockJournalEntries: JournalEntry[] = [
  { id: "JE-2026-001", date: "2026-07-01", reference: "INV-2025-004", description: "Invoice payment from TechNova Solutions", debit: 4000.00, credit: 0, account: "Cash in Bank", status: "Posted" },
  { id: "JE-2026-002", date: "2026-07-01", reference: "BILL-001", description: "Payment to Supplier A for goods", debit: 0, credit: 12500.00, account: "Accounts Payable", status: "Posted" },
  { id: "JE-2026-003", date: "2026-06-30", reference: "SAL-JUN", description: "June 2026 Payroll Processing", debit: 85000.00, credit: 0, account: "Payroll Expenses", status: "Posted" },
  { id: "JE-2026-004", date: "2026-06-30", reference: "DEP-JUN", description: "Monthly Depreciation Entry", debit: 9166.67, credit: 0, account: "Depreciation", status: "Posted" },
  { id: "JE-2026-005", date: "2026-06-29", reference: "ADJ-001", description: "Prepaid insurance amortization", debit: 2500.00, credit: 0, account: "Prepaid Expenses", status: "Draft" },
  { id: "JE-2026-006", date: "2026-06-28", reference: "GST-Q2", description: "Q2 GST liability adjustment", debit: 0, credit: 48000.00, account: "GST Payable", status: "Posted" },
  { id: "JE-2026-007", date: "2026-06-27", reference: "SALE-0701", description: "Daily sales entry – POS channels", debit: 42000.00, credit: 0, account: "Sales Revenue", status: "Posted" },
];

export const mockInvoices: Invoice[] = [
  { id: "INV-2026-001", customerId: "CUST-004", customerName: "David Chen", date: "2026-06-15", dueDate: "2026-07-15", amount: 1500.00, balanceDue: 0, status: "Paid" },
  { id: "INV-2026-002", customerId: "EXT-001", customerName: "Davis Retail Group", date: "2026-06-20", dueDate: "2026-07-20", amount: 4500.50, balanceDue: 4500.50, status: "Unpaid" },
  { id: "INV-2026-003", customerId: "EXT-002", customerName: "Smith & Co", date: "2026-05-10", dueDate: "2026-06-10", amount: 2100.00, balanceDue: 2100.00, status: "Overdue" },
  { id: "INV-2026-004", customerId: "CUST-005", customerName: "TechNova Solutions", date: "2026-06-25", dueDate: "2026-07-25", amount: 8400.00, balanceDue: 4000.00, status: "Partially Paid" },
  { id: "INV-2026-005", customerId: "CUST-001", customerName: "Acme Corp", date: "2026-07-01", dueDate: "2026-07-31", amount: 15200.00, balanceDue: 15200.00, status: "Unpaid" },
  { id: "INV-2026-006", customerId: "CUST-003", customerName: "Global Trade LLC", date: "2026-06-10", dueDate: "2026-07-10", amount: 6750.00, balanceDue: 0, status: "Paid" },
];

export const mockVendorBills: VendorBill[] = [
  { id: "BILL-2026-001", vendorName: "Prime Distributors", date: "2026-06-28", dueDate: "2026-07-28", amount: 32000.00, balanceDue: 32000.00, status: "Unpaid" },
  { id: "BILL-2026-002", vendorName: "Tech Supplies Ltd", date: "2026-06-20", dueDate: "2026-07-20", amount: 8400.00, balanceDue: 0, status: "Paid" },
  { id: "BILL-2026-003", vendorName: "Metro Logistics", date: "2026-05-15", dueDate: "2026-06-15", amount: 4200.00, balanceDue: 4200.00, status: "Overdue" },
  { id: "BILL-2026-004", vendorName: "Office World", date: "2026-07-01", dueDate: "2026-08-01", amount: 1850.00, balanceDue: 1850.00, status: "Unpaid" },
  { id: "BILL-2026-005", vendorName: "CloudHost Pro", date: "2026-06-01", dueDate: "2026-07-01", amount: 2999.00, balanceDue: 0, status: "Paid" },
];

export const mockBankAccounts: BankAccount[] = [
  { id: "BA-001", name: "Primary Operations Account", bank: "First National Bank", accountNo: "****4521", type: "Current", balance: 1250000.50, currency: "USD", lastReconciled: "2026-06-30" },
  { id: "BA-002", name: "Payroll Account", bank: "City Bank", accountNo: "****8832", type: "Current", balance: 215000.00, currency: "USD", lastReconciled: "2026-06-30" },
  { id: "BA-003", name: "Savings Reserve", bank: "First National Bank", accountNo: "****1190", type: "Savings", balance: 850000.00, currency: "USD", lastReconciled: "2026-06-01" },
  { id: "BA-004", name: "Head Office Petty Cash", bank: "", accountNo: "CASH-HQ", type: "Cash", balance: 15000.00, currency: "USD", lastReconciled: "2026-07-01" },
];

export const mockTaxEntries: TaxEntry[] = [
  { id: "TAX-GST-Q2", period: "Apr–Jun 2026", type: "GST", taxableAmount: 800000, taxAmount: 144000, paidAmount: 144000, dueDate: "2026-07-20", status: "Filed" },
  { id: "TAX-TDS-JUN", period: "June 2026", type: "TDS", taxableAmount: 85000, taxAmount: 8500, paidAmount: 8500, dueDate: "2026-07-07", status: "Paid" },
  { id: "TAX-GST-Q3", period: "Jul–Sep 2026", type: "GST", taxableAmount: 920000, taxAmount: 165600, paidAmount: 0, dueDate: "2026-10-20", status: "Pending" },
  { id: "TAX-TDS-JUL", period: "July 2026", type: "TDS", taxableAmount: 85000, taxAmount: 8500, paidAmount: 0, dueDate: "2026-08-07", status: "Pending" },
  { id: "TAX-VAT-H1", period: "H1 2026", type: "VAT", taxableAmount: 1500000, taxAmount: 75000, paidAmount: 75000, dueDate: "2026-07-15", status: "Paid" },
];

export const mockFixedAssets: FixedAsset[] = [
  { id: "FA-001", name: "Head Office Building", category: "Real Estate", purchaseDate: "2020-01-01", purchaseCost: 5000000, bookValue: 4100000, depreciationRate: 5, depreciationMethod: "SLM", status: "Active" },
  { id: "FA-002", name: "Delivery Fleet – 5 Vehicles", category: "Vehicles", purchaseDate: "2022-06-15", purchaseCost: 850000, bookValue: 510000, depreciationRate: 20, depreciationMethod: "WDV", status: "Active" },
  { id: "FA-003", name: "Server Infrastructure", category: "IT Equipment", purchaseDate: "2023-03-01", purchaseCost: 320000, bookValue: 192000, depreciationRate: 33, depreciationMethod: "SLM", status: "Active" },
  { id: "FA-004", name: "Warehouse Racking System", category: "Plant & Machinery", purchaseDate: "2021-09-01", purchaseCost: 180000, bookValue: 108000, depreciationRate: 10, depreciationMethod: "SLM", status: "Active" },
  { id: "FA-005", name: "Retail POS Hardware (20 units)", category: "IT Equipment", purchaseDate: "2024-01-15", purchaseCost: 95000, bookValue: 76000, depreciationRate: 25, depreciationMethod: "WDV", status: "Active" },
  { id: "FA-006", name: "Old Forklift", category: "Plant & Machinery", purchaseDate: "2018-05-01", purchaseCost: 75000, bookValue: 0, depreciationRate: 15, depreciationMethod: "WDV", status: "Disposed" },
];

export const mockExpenseClaims: ExpenseClaim[] = [
  { id: "EXP-001", employee: "James Thompson", department: "Sales", category: "Travel", amount: 1240.00, date: "2026-06-28", status: "Approved", description: "Client visits – Chicago trip" },
  { id: "EXP-002", employee: "Sarah Mitchell", department: "Marketing", category: "Entertainment", amount: 560.00, date: "2026-06-25", status: "Pending", description: "Client dinner – product launch event" },
  { id: "EXP-003", employee: "Kevin Park", department: "Engineering", category: "Software", amount: 299.00, date: "2026-06-20", status: "Approved", description: "Annual software subscription" },
  { id: "EXP-004", employee: "Priya Sharma", department: "HR", category: "Training", amount: 850.00, date: "2026-06-15", status: "Pending", description: "Leadership training program" },
  { id: "EXP-005", employee: "Daniel Roberts", department: "Operations", category: "Office Supplies", amount: 145.00, date: "2026-06-10", status: "Rejected", description: "Stationary purchase – not pre-approved" },
  { id: "EXP-006", employee: "Emily Wang", department: "Sales", category: "Travel", amount: 2100.00, date: "2026-07-01", status: "Pending", description: "International conference – Singapore" },
];

export const mockBudgets: Budget[] = [
  { id: "BDG-001", name: "Sales Department FY2026", department: "Sales", fiscalYear: "2026", budgeted: 1200000, actual: 1150000, variance: 50000, status: "On Track" },
  { id: "BDG-002", name: "Marketing FY2026", department: "Marketing", fiscalYear: "2026", budgeted: 350000, actual: 390000, variance: -40000, status: "Over Budget" },
  { id: "BDG-003", name: "IT & Infrastructure FY2026", department: "IT", fiscalYear: "2026", budgeted: 480000, actual: 310000, variance: 170000, status: "Under Utilized" },
  { id: "BDG-004", name: "HR & Payroll FY2026", department: "HR", fiscalYear: "2026", budgeted: 2200000, actual: 2180000, variance: 20000, status: "On Track" },
  { id: "BDG-005", name: "Operations FY2026", department: "Operations", fiscalYear: "2026", budgeted: 900000, actual: 875000, variance: 25000, status: "On Track" },
];

export const mockFinanceStats = {
  totalRevenueYTD: 14500000,
  totalExpensesYTD: 8200000,
  netProfit: 6300000,
  profitMargin: 43.4,
  cashBalance: 3250000,
  accountsReceivable: 1150000,
  accountsPayable: 420000,
  totalAssets: 6943000,
  totalLiabilities: 643000,
  totalEquity: 3600000,
  overdueReceivables: 2100000,
  overduePayables: 4200,
};
