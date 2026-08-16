import { createFileRoute, Link } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";

export const Route = createFileRoute("/store/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  // A mock list of orders for the user to see
  const mockOrders = [
    {
      id: "ORDER-10294",
      date: "August 12, 2026",
      total: 450.00,
      status: "Processing",
      items: [
        { name: "Premium Leather Sofa", price: 450.00 }
      ]
    },
    {
      id: "ORDER-84729",
      date: "July 20, 2026",
      total: 120.50,
      status: "Delivered",
      items: [
        { name: "Wireless Noise Cancelling Headphones", price: 89.99 },
        { name: "Office Desk Lamp", price: 30.51 }
      ]
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      
      {/* Breadcrumb */}
      <div className="text-sm mb-4">
        <Link to="/store/account" className="text-sky-700 hover:underline hover:text-amber-600">Your Account</Link> 
        <span className="text-gray-500 mx-2">›</span> 
        <span className="text-amber-600">Your Orders</span>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-normal">Your Orders</h1>
        <div className="hidden sm:flex items-center space-x-2">
          <input type="text" placeholder="Search all orders" className="border border-gray-300 rounded-sm px-3 py-1 outline-none focus:ring-1 focus:ring-sky-500" />
          <button className="bg-[#1A1A1A] text-white px-4 py-1 rounded-full text-sm">Search Orders</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E5E4E2] mb-6 flex space-x-6 text-sm">
        <div className="font-bold border-b-2 border-amber-500 text-black pb-2 cursor-pointer">Orders</div>
        <div className="text-sky-700 hover:text-amber-600 hover:underline cursor-pointer pb-2">Buy Again</div>
        <div className="text-sky-700 hover:text-amber-600 hover:underline cursor-pointer pb-2">Not Yet Shipped</div>
        <div className="text-sky-700 hover:text-amber-600 hover:underline cursor-pointer pb-2">Cancelled Orders</div>
      </div>

      {/* Orders List */}
      <div className="space-y-6">
        {mockOrders.map((order) => (
          <div key={order.id} className="border border-[#E5E4E2] rounded-lg overflow-hidden">
            {/* Order Header */}
            <div className="bg-[#F2F2F2] p-4 border-b border-[#E5E4E2] flex flex-wrap justify-between text-sm text-gray-600">
              <div className="flex space-x-8">
                <div>
                  <div className="uppercase text-xs">Order Placed</div>
                  <div className="text-black">{order.date}</div>
                </div>
                <div>
                  <div className="uppercase text-xs">Total</div>
                  <div className="text-black">{order.total.toFixed(2)} KWD</div>
                </div>
                <div>
                  <div className="uppercase text-xs">Ship To</div>
                  <div className="text-sky-700 hover:underline cursor-pointer">Kuwait City</div>
                </div>
              </div>
              <div className="text-right mt-2 sm:mt-0">
                <div className="uppercase text-xs">Order # {order.id}</div>
                <div className="flex space-x-2 justify-end mt-1">
                  <span className="text-sky-700 hover:underline cursor-pointer">View order details</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-sky-700 hover:underline cursor-pointer">Invoice</span>
                </div>
              </div>
            </div>

            {/* Order Body */}
            <div className="p-6 bg-white">
              <h2 className="text-lg font-bold mb-4 flex items-center text-green-700">
                <Package className="mr-2 h-5 w-5" /> 
                {order.status}
              </h2>
              
              {order.items.map((item, idx) => (
                <div key={idx} className="flex mb-4 last:mb-0">
                  <img 
                    src={`https://source.unsplash.com/random/100x100/?${encodeURIComponent(item.name)}`} 
                    alt={item.name}
                    className="w-20 h-20 object-contain mr-4 border border-gray-100 p-1"
                  />
                  <div>
                    <div className="text-sky-700 hover:underline cursor-pointer font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500 mt-1">Sold by: Marketplace Vendor</div>
                    <div className="text-[#B12704] font-bold mt-1">{item.price.toFixed(2)} KWD</div>
                    
                    <div className="mt-2 space-x-2">
                      <button className="bg-amber-400 hover:bg-amber-500 px-3 py-1 text-sm rounded-full shadow-sm text-black">Buy it again</button>
                      <button className="border border-gray-300 hover:bg-gray-50 px-3 py-1 text-sm rounded-full shadow-sm text-black">View your item</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
