import { createFileRoute, Link } from "@tanstack/react-router";
import { Home } from "lucide-react";

export const Route = createFileRoute("/store/register")({
  component: AccountRegister,
});

function AccountRegister() {
  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Breadcrumb Banner */}
      <div className="bg-[#F2F2F2] py-10 mb-12 border-b border-[#E5E4E2]">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-black text-[#1A1A1A] uppercase tracking-widest mb-4">Create Account</h1>
          <div className="text-sm text-gray-500 flex items-center justify-center space-x-2">
            <Link to="/store" className="hover:text-blue-600 flex items-center transition-colors font-medium">
              <Home className="h-4 w-4 mr-1" />
              Home
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-[#1A1A1A] font-bold">Create Account</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          
          {/* Left Column: Register Form */}
          <div className="bg-[#F2F2F2] p-8 md:p-12 border border-[#E5E4E2] rounded-lg">
            <h2 className="text-2xl font-black text-[#1A1A1A] uppercase tracking-wide mb-6">Register</h2>
            <form className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-[#1E293B] mb-2">First Name *</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 rounded border border-gray-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                  placeholder="First Name"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#1E293B] mb-2">Last Name *</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 rounded border border-gray-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                  placeholder="Last Name"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#1E293B] mb-2">Email Address *</label>
                <input 
                  type="email" 
                  className="w-full px-4 py-3 rounded border border-gray-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                  placeholder="Email Address"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#1E293B] mb-2">Password *</label>
                <input 
                  type="password" 
                  className="w-full px-4 py-3 rounded border border-gray-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
                  placeholder="Password"
                />
              </div>
              
              <button 
                type="button" 
                className="bg-[#1A1A1A] hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full uppercase tracking-wider transition-colors w-full sm:w-auto mt-4"
              >
                Create
              </button>
            </form>
          </div>

          {/* Right Column: Login Prompt */}
          <div className="flex flex-col justify-center border-l-0 md:border-l border-[#E5E4E2] pl-0 md:pl-12">
            <h2 className="text-2xl font-black text-[#1A1A1A] uppercase tracking-wide mb-4">Already have an account?</h2>
            <p className="text-gray-600 leading-relaxed mb-8">
              If you already have an account with us, please login at the login page to access your profile, order history, and more.
            </p>
            <div>
              <Link 
                to="/store/account" 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full uppercase tracking-wider transition-colors inline-block"
              >
                Login Instead
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
