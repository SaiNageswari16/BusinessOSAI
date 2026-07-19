export const posStore = {
  name: "Sunrise Hyper Market",
  branch: "Hyderabad",
  address: "Hi-Tech City, Hyderabad, 500081",
  phone: "+91 98765 43210",
  gstin: "36AAAAA0000A1Z5",
};

export const posSession = {
  cashier: "Ananya Sharma",
  shift: "Morning",
  registerId: "REG-01",
  openedAt: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
  openingFloat: 350.00,
};

export const posCategories = [
  { id: "c1", name: "Electronics", color: "bg-blue-100 text-blue-700" },
  { id: "c2", name: "Groceries", color: "bg-green-100 text-green-700" },
  { id: "c3", name: "Apparel & Shoes", color: "bg-purple-100 text-purple-700" },
  { id: "c4", name: "Health & Beauty", color: "bg-pink-100 text-pink-700" },
  { id: "c5", name: "Home & Kitchen", color: "bg-orange-100 text-orange-700" },
];

export const posProducts = [
  { id: "p1", name: "Apple iPhone 16 Pro", sku: "APP-16P-256", price: 1299.0, category: "c1", stock: 45, image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&q=80", barcode: "888123456789" },
  { id: "p2", name: "Samsung Galaxy S25", sku: "SAM-S25-512", price: 1199.0, category: "c1", stock: 32, image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=300&q=80", barcode: "888987654321" },
  { id: "p3", name: "Sony WH-1000XM5 Headphones", sku: "SON-WH5-BLK", price: 349.0, category: "c1", stock: 12, image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=300&q=80", barcode: "456123789012" },
  { id: "p4", name: "Nike Air Max 2024", sku: "NIK-AM24-WHT", price: 150.0, category: "c3", stock: 28, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=80", barcode: "123456789012" },
  { id: "p5", name: "Premium Basmati Rice 25KG", sku: "GRO-RIC-25K", price: 45.0, category: "c2", stock: 150, image: "https://images.unsplash.com/photo-1586201375761-83865001e8ac?w=300&q=80", barcode: "098765432109" },
  { id: "p6", name: "Organic Whole Milk 1L", sku: "GRO-MLK-1L", price: 2.5, category: "c2", stock: 85, image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=300&q=80", barcode: "112233445566" },
  { id: "p7", name: "Herbal Essence Shampoo", sku: "BEA-SHM-500", price: 8.99, category: "c4", stock: 64, image: "https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=300&q=80", barcode: "998877665544" },
  { id: "p8", name: "Whey Protein Powder 2KG", sku: "HEA-PRO-2K", price: 55.0, category: "c4", stock: 40, image: "https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=300&q=80", barcode: "334455667788" },
  { id: "p9", name: "LG 4K Smart TV 55\"", sku: "LG-TV-55-4K", price: 699.0, category: "c1", stock: 8, image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=300&q=80", barcode: "887766554433" },
  { id: "p10", name: "Levis Classic Blue Jeans", sku: "APP-LEV-BLU", price: 59.99, category: "c3", stock: 112, image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=300&q=80", barcode: "223344556677" },
  { id: "p11", name: "Ceramic Dinner Set (16pcs)", sku: "HOM-DIN-16", price: 89.0, category: "c5", stock: 22, image: "https://images.unsplash.com/photo-1616428453472-35bd3fb0817c?w=300&q=80", barcode: "554433221100" },
  { id: "p12", name: "Fresh Apples 1KG", sku: "GRO-APP-1K", price: 4.99, category: "c2", stock: 200, image: "https://images.unsplash.com/photo-1560806887-1e4cd0b6fac6?w=300&q=80", barcode: "776655443322" },
  { id: "p13", name: "Gaming Mouse Pro", sku: "ELE-MOU-PRO", price: 79.99, category: "c1", stock: 35, image: "https://images.unsplash.com/photo-1527814050087-158a2e1e0d37?w=300&q=80", barcode: "990011223344" },
  { id: "p14", name: "Yoga Mat Standard", sku: "HEA-YOG-MAT", price: 24.5, category: "c4", stock: 50, image: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=300&q=80", barcode: "112211221122" },
  { id: "p15", name: "Non-Stick Frying Pan", sku: "HOM-PAN-NS", price: 34.99, category: "c5", stock: 45, image: "https://images.unsplash.com/photo-1585032767073-ea50edc5f0f3?w=300&q=80", barcode: "998899889988" }
];

// Generate extra products for volume
for (let i = 16; i <= 60; i++) {
  const cat = posCategories[i % 5];
  posProducts.push({
    id: `p${i}`,
    name: `${cat.name} Item ${i}`,
    sku: `SKU-${i.toString().padStart(4, '0')}`,
    price: parseFloat((Math.random() * 100 + 5).toFixed(2)),
    category: cat.id,
    stock: Math.floor(Math.random() * 100) + 10,
    image: `https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300&q=80`,
    barcode: `10000000${i.toString().padStart(4, '0')}`
  });
}

export const posCustomers = [
  { id: "walk-in", name: "Walk-in Customer", phone: "", points: 0, totalSpent: "₹0", lastVisit: "-" },
  { id: "c1", name: "Rahul Verma", phone: "+91 98765 11111", points: 450, email: "rahul.v@example.com", tier: "Gold", totalSpent: "₹45,200", lastVisit: "2026-07-18" },
  { id: "c2", name: "Sneha Patel", phone: "+91 98765 22222", points: 120, email: "sneha.p@example.com", tier: "Silver", totalSpent: "₹12,800", lastVisit: "2026-07-15" },
  { id: "c3", name: "Amit Kumar", phone: "+91 98765 33333", points: 890, email: "amit.k@example.com", tier: "Platinum", totalSpent: "₹1,24,500", lastVisit: "2026-07-19" },
  { id: "c4", name: "Priya Sharma", phone: "+91 98765 44444", points: 45, email: "priya.s@example.com", tier: "Bronze", totalSpent: "₹3,900", lastVisit: "2026-07-10" }
];

export const paymentMethods = [
  { id: "cash", label: "Cash", icon: "Banknote" },
  { id: "card", label: "Credit/Debit Card", icon: "CreditCard" },
  { id: "upi", label: "UPI (QR)", icon: "QrCode" },
  { id: "wallet", label: "Store Wallet", icon: "Wallet" },
  { id: "giftcard", label: "Gift Card", icon: "Gift" }
];

export const generateTransactions = (count: number) => {
  const transactions = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const isToday = i < 150; 
    const date = new Date(now.getTime() - (isToday ? Math.random() * 12 * 3600000 : Math.random() * 30 * 86400000));
    
    const itemCount = Math.floor(Math.random() * 5) + 1;
    const items = [];
    let subtotal = 0;
    
    for (let j = 0; j < itemCount; j++) {
      const product = posProducts[Math.floor(Math.random() * posProducts.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: qty,
        total: product.price * qty
      });
      subtotal += product.price * qty;
    }
    
    const tax = subtotal * 0.05;
    const total = subtotal + tax;
    const customer = Math.random() > 0.4 ? posCustomers[Math.floor(Math.random() * posCustomers.length)] : posCustomers[0];
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    
    transactions.push({
      id: `TRX-${date.getTime().toString().slice(-6)}-${i}`,
      date: date.toISOString(),
      items,
      subtotal,
      tax,
      discount: 0,
      total,
      customerId: customer.id,
      customerName: customer.name,
      paymentMethod: paymentMethod.id,
      status: Math.random() > 0.05 ? "Completed" : "Refunded",
      cashier: posSession.cashier
    });
  }
  
  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const posTransactions = generateTransactions(500);

export const posDashboardStats = (() => {
  const stats = {
    todayRevenue: posTransactions.filter(t => new Date(t.date).toDateString() === new Date().toDateString() && t.status === "Completed").reduce((sum, t) => sum + t.total, 0),
    todayOrders: posTransactions.filter(t => new Date(t.date).toDateString() === new Date().toDateString()).length,
    todayCustomers: new Set(posTransactions.filter(t => new Date(t.date).toDateString() === new Date().toDateString()).map(t => t.customerId)).size,
    avgBill: 0, 
    refunds: posTransactions.filter(t => new Date(t.date).toDateString() === new Date().toDateString() && t.status === "Refunded").reduce((sum, t) => sum + t.total, 0),
    returns: posTransactions.filter(t => new Date(t.date).toDateString() === new Date().toDateString() && t.status === "Refunded").length,
  };
  stats.avgBill = stats.todayOrders > 0 ? stats.todayRevenue / stats.todayOrders : 0;
  return stats;
})();
