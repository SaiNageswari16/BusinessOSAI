import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/store/addresses")({
  component: AddressesPage,
});

function AddressesPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="text-sm mb-4">
        <Link to="/store/account" className="text-sky-700 hover:underline hover:text-amber-600">Your Account</Link> 
        <span className="text-gray-500 mx-2">›</span> 
        <span className="text-amber-600">Your Addresses</span>
      </div>

      <h1 className="text-3xl font-normal mb-6">Your Addresses</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Add New Address */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:bg-gray-50 transition-colors min-h-[250px]">
          <Plus className="h-12 w-12 text-gray-400 mb-2" />
          <h2 className="text-xl font-bold text-gray-600">Add Address</h2>
        </div>

        {/* Default Address */}
        <div className="border border-gray-300 rounded-lg overflow-hidden flex flex-col min-h-[250px] relative">
          <div className="bg-[#F2F2F2] border-b border-[#E5E4E2] py-2 px-4 text-sm font-medium text-[#1E293B]">
            Default
          </div>
          <div className="p-4 flex-1 text-sm leading-relaxed text-[#1A1A1A]">
            <div className="font-bold text-base mb-1">John Doe</div>
            <div>Kuwait City</div>
            <div>Al Asimah</div>
            <div>Kuwait</div>
            <div className="mt-2">Phone number: +965 1234 5678</div>
          </div>
          <div className="p-4 border-t border-[#E5E4E2] bg-gray-50 flex space-x-4 text-sm">
            <button className="text-sky-700 hover:underline">Edit</button>
            <span className="text-gray-300">|</span>
            <button className="text-sky-700 hover:underline">Remove</button>
          </div>
        </div>

      </div>
    </div>
  );
}
