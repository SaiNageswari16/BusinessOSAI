import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/store/security")({
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="text-sm mb-4">
        <Link to="/store/account" className="text-sky-700 hover:underline hover:text-amber-600">Your Account</Link> 
        <span className="text-gray-500 mx-2">›</span> 
        <span className="text-amber-600">Login & Security</span>
      </div>

      <h1 className="text-3xl font-normal mb-6">Login & Security</h1>

      <div className="border border-[#E5E4E2] rounded-lg overflow-hidden">
        <div className="p-6 border-b border-[#E5E4E2] flex justify-between items-center bg-white hover:bg-gray-50">
          <div>
            <div className="font-bold">Name</div>
            <div className="text-sm text-gray-600">John Doe</div>
          </div>
          <button className="border border-gray-300 bg-gray-50 hover:bg-[#F2F2F2] px-4 py-1 rounded-md text-sm shadow-sm">Edit</button>
        </div>
        
        <div className="p-6 border-b border-[#E5E4E2] flex justify-between items-center bg-white hover:bg-gray-50">
          <div>
            <div className="font-bold">Email</div>
            <div className="text-sm text-gray-600">john.doe@example.com</div>
          </div>
          <button className="border border-gray-300 bg-gray-50 hover:bg-[#F2F2F2] px-4 py-1 rounded-md text-sm shadow-sm">Edit</button>
        </div>

        <div className="p-6 border-b border-[#E5E4E2] flex justify-between items-center bg-white hover:bg-gray-50">
          <div>
            <div className="font-bold">Mobile Number</div>
            <div className="text-sm text-gray-600">+965 1234 5678</div>
          </div>
          <button className="border border-gray-300 bg-gray-50 hover:bg-[#F2F2F2] px-4 py-1 rounded-md text-sm shadow-sm">Edit</button>
        </div>

        <div className="p-6 flex justify-between items-center bg-white hover:bg-gray-50">
          <div>
            <div className="font-bold">Password</div>
            <div className="text-sm text-gray-600">********</div>
          </div>
          <button className="border border-gray-300 bg-gray-50 hover:bg-[#F2F2F2] px-4 py-1 rounded-md text-sm shadow-sm">Edit</button>
        </div>
      </div>
      
      <div className="mt-6 text-center">
        <Link to="/store/account" className="bg-amber-400 hover:bg-amber-500 text-black px-6 py-2 rounded-md shadow-sm font-medium inline-block">Done</Link>
      </div>
    </div>
  );
}
