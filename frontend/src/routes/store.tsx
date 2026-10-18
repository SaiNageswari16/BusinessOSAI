import React, { useState } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StoreCartProvider } from "@/contexts/StoreCartContext";
import { WishlistProvider } from "@/contexts/StoreWishlistContext";
import { StoreUserProvider } from "@/contexts/StoreUserContext";
import { StoreThemeProvider, useStoreTheme } from "@/contexts/StoreThemeContext";
import { DynamicStoreHeader, DynamicStoreFooter } from "@/components/storefront/UniversalTemplateRouter";
import { OrganicOffcanvasCart } from "@/components/storefront/organic/OrganicOffcanvasCart";
import { OrganicOffcanvasMenu } from "@/components/storefront/organic/OrganicOffcanvasMenu";
import "@/styles/organic-theme.css";

export const Route = createFileRoute("/store")({
  component: StoreLayoutWrapper,
});

function StoreLayoutWrapper() {
  return (
    <StoreThemeProvider>
      <StoreUserProvider>
        <StoreCartProvider>
          <WishlistProvider>
            <StoreLayoutContent />
          </WishlistProvider>
        </StoreCartProvider>
      </StoreUserProvider>
    </StoreThemeProvider>
  );
}

function StoreLayoutContent() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme } = useStoreTheme();

  return (
    <div
      className="min-h-screen text-gray-900 font-sans flex flex-col antialiased transition-colors duration-300"
      style={{ backgroundColor: theme.bgTone }}
    >
      {/* Dynamic Header */}
      <DynamicStoreHeader
        onOpenCart={() => setIsCartOpen(true)}
        onOpenMenu={() => setIsMenuOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {/* Dynamic Footer */}
      <DynamicStoreFooter />

      {/* Slide-out Cart Drawer */}
      <OrganicOffcanvasCart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />

      {/* Slide-out Mobile / Side Menu Drawer */}
      <OrganicOffcanvasMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />
    </div>
  );
}
