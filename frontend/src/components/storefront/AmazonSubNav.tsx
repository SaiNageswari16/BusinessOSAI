import { Menu } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function AmazonSubNav() {
  const navItems = [
    "Today's Deals",
    "Customer Service",
    "Registry",
    "Gift Cards",
    "Sell"
  ];

  return (
    <nav className="bg-sky-700 text-white flex items-center px-4 h-[40px] text-sm overflow-x-auto whitespace-nowrap hide-scrollbar shadow-sm relative z-40">
      {/* "All" button navigates to main store page instead of opening a drawer */}
      <Link 
        to="/store"
        className="flex items-center font-bold border border-transparent hover:border-white p-1 rounded-sm cursor-pointer mr-2 transition-colors"
      >
        <Menu className="h-5 w-5 mr-1" />
        All
      </Link>
      
      {navItems.map((item, index) => (
        <Link 
          key={index} 
          to="/store/search"
          search={{ q: item }}
          className="border border-transparent hover:border-white px-2 py-1 mx-1 rounded-sm cursor-pointer transition-colors"
        >
          {item}
        </Link>
      ))}
      
      <div className="flex-1"></div>
      
      <Link to="/store/search" search={{ q: 'deals' }} className="font-bold border border-transparent hover:border-white px-2 py-1 rounded-sm cursor-pointer hidden md:block">
        Shop Great Deals now
      </Link>
    </nav>
  );
}
