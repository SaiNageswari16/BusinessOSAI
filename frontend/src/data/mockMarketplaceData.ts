export interface Vendor {
  id: string;
  name: string;
  category: string;
  status: "Active" | "Pending" | "Suspended";
  rating: number;
  totalOrders: number;
  revenue: number;
  joinDate: string;
  location: string;
}

export interface MarketplaceProduct {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: "Approved" | "Pending" | "Rejected";
  rating: number;
}

export interface MarketplaceOrder {
  id: string;
  customerId: string;
  customerName: string;
  vendorId: string;
  vendorName: string;
  status: "Pending" | "Processing" | "Shipped" | "Delivered" | "Cancelled" | "Returned";
  total: number;
  date: string;
  items: number;
}

export const mockVendors: Vendor[] = [
  { id: "VND-001", name: "TechNova Electronics", category: "Electronics", status: "Active", rating: 4.8, totalOrders: 12450, revenue: 1450000, joinDate: "2024-01-15", location: "New York, USA" },
  { id: "VND-002", name: "Global Trade LLC", category: "B2B Supplies", status: "Active", rating: 4.5, totalOrders: 8200, revenue: 980000, joinDate: "2024-03-22", location: "London, UK" },
  { id: "VND-003", name: "Fresh Foods Co", category: "Groceries", status: "Active", rating: 4.9, totalOrders: 45000, revenue: 2100000, joinDate: "2023-11-10", location: "Chicago, USA" },
  { id: "VND-004", name: "Style Hub", category: "Fashion", status: "Pending", rating: 0, totalOrders: 0, revenue: 0, joinDate: "2025-06-12", location: "Paris, France" },
  { id: "VND-005", name: "BuildIt Hardware", category: "Hardware", status: "Suspended", rating: 3.2, totalOrders: 1500, revenue: 45000, joinDate: "2024-08-05", location: "Berlin, Germany" },
  { id: "VND-006", name: "Home Comforts", category: "Home & Garden", status: "Active", rating: 4.6, totalOrders: 5400, revenue: 320000, joinDate: "2024-05-18", location: "Toronto, Canada" },
  { id: "VND-007", name: "AutoParts Direct", category: "Automotive", status: "Active", rating: 4.4, totalOrders: 3200, revenue: 410000, joinDate: "2024-09-30", location: "Detroit, USA" },
  { id: "VND-008", name: "Beauty Bliss", category: "Health & Beauty", status: "Pending", rating: 0, totalOrders: 0, revenue: 0, joinDate: "2025-06-25", location: "Seoul, South Korea" },
];

export const mockMarketplaceProducts: MarketplaceProduct[] = [
  { id: "MP-1001", vendorId: "VND-001", vendorName: "TechNova Electronics", name: "Quantum Pro Laptop", category: "Electronics", price: 1299.99, stock: 450, status: "Approved", rating: 4.9 },
  { id: "MP-1002", vendorId: "VND-001", vendorName: "TechNova Electronics", name: "UltraHD Monitor 32\"", category: "Electronics", price: 349.50, stock: 120, status: "Approved", rating: 4.7 },
  { id: "MP-2001", vendorId: "VND-002", vendorName: "Global Trade LLC", name: "Ergonomic Office Chair", category: "Furniture", price: 185.00, stock: 85, status: "Approved", rating: 4.5 },
  { id: "MP-3001", vendorId: "VND-003", vendorName: "Fresh Foods Co", name: "Organic Avocado Box", category: "Groceries", price: 24.99, stock: 1500, status: "Approved", rating: 4.8 },
  { id: "MP-4001", vendorId: "VND-004", vendorName: "Style Hub", name: "Designer Summer Dress", category: "Fashion", price: 89.99, stock: 200, status: "Pending", rating: 0 },
  { id: "MP-5001", vendorId: "VND-005", vendorName: "BuildIt Hardware", name: "Power Drill Set 18V", category: "Hardware", price: 110.00, stock: 0, status: "Rejected", rating: 3.5 },
];

export const mockMarketplaceOrders: MarketplaceOrder[] = [
  { id: "ORD-98234", customerId: "CUST-004", customerName: "David Chen", vendorId: "VND-001", vendorName: "TechNova Electronics", status: "Delivered", total: 1299.99, date: "2025-06-28T14:30:00Z", items: 1 },
  { id: "ORD-98235", customerId: "EXT-001", customerName: "Davis Retail", vendorId: "VND-002", vendorName: "Global Trade LLC", status: "Shipped", total: 1850.00, date: "2025-06-30T09:15:00Z", items: 10 },
  { id: "ORD-98236", customerId: "CUST-002", customerName: "Sarah Jenkins", vendorId: "VND-003", vendorName: "Fresh Foods Co", status: "Processing", total: 74.97, date: "2025-07-01T08:45:00Z", items: 3 },
  { id: "ORD-98237", customerId: "EXT-002", customerName: "Smith & Co", vendorId: "VND-001", vendorName: "TechNova Electronics", status: "Pending", total: 349.50, date: "2025-07-01T10:20:00Z", items: 1 },
  { id: "ORD-98238", customerId: "CUST-005", customerName: "TechNova Solutions", vendorId: "VND-006", vendorName: "Home Comforts", status: "Cancelled", total: 450.00, date: "2025-06-25T11:00:00Z", items: 4 },
];

export const mockMarketplaceStats = {
  totalVendors: 1450,
  activeVendors: 1280,
  pendingApprovals: 85,
  totalProducts: 458200,
  monthlyGMV: 12500000,
  monthlyOrders: 85400,
  averageCommission: 12.5,
  totalRevenue: 1562500,
};
