import React, { useState } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StoreCartProvider } from "@/contexts/StoreCartContext";
import { WishlistProvider } from "@/contexts/StoreWishlistContext";
import { StoreUserProvider } from "@/contexts/StoreUserContext";
import { OrganicHeader } from "@/components/storefront/organic/OrganicHeader";
import { OrganicOffcanvasCart } from "@/components/storefront/organic/OrganicOffcanvasCart";
import { OrganicOffcanvasMenu } from "@/components/storefront/organic/OrganicOffcanvasMenu";
import { OrganicFooter } from "@/components/storefront/organic/OrganicFooter";
import "@/styles/organic-theme.css";

export const Route = createFileRoute("/store")({
  component: StoreLayout,
});

function StoreLayout() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <StoreUserProvider>
      <StoreCartProvider>
        <WishlistProvider>
          <div className="min-h-screen bg-white text-[#222222] font-organic-body flex flex-col antialiased selection:bg-[#6BB252] selection:text-white">
            {/* Top Navigation Header */}
            <OrganicHeader
              onOpenCart={() => setIsCartOpen(true)}
              onOpenMenu={() => setIsMenuOpen(true)}
            />

            {/* Main Content Area */}
            <main className="flex-1 w-full">
              <Outlet />
            </main>

            {/* Template Footer */}
            <OrganicFooter />

            {/* Slide-out Cart Drawer (offcanvasCart) */}
            <OrganicOffcanvasCart
              isOpen={isCartOpen}
              onClose={() => setIsCartOpen(false)}
            />

            {/* Slide-out Mobile / Side Menu Drawer (offcanvasNavbar) */}
            <OrganicOffcanvasMenu
              isOpen={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
            />
          </div>
        </WishlistProvider>
      </StoreCartProvider>
    </StoreUserProvider>
  );
}
