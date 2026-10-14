import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useCurrency } from "@/hooks/use-currency";

/**
 * CartProduct is a minimal, standalone type for items in the cart.
 * It decouples the cart from both MarketplaceProduct (mock) and
 * StorefrontProduct (live backend), accepting either.
 */
export interface CartProduct {
  id: string;
  name: string;
  price: number;        // selling price
  mrp?: number;         // original / crossed-out price
  image_url?: string;
  category_name?: string;
  brand?: string;
  stock?: number;
  vendorName?: string;
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
}

interface StoreCartContextType {
  cartItems: CartItem[];
  items: Array<CartItem & { productId: string; name: string; price: number; image?: string }>;
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  totalItems: number;
  cartTotal: number;
  wishlistItems: CartProduct[];
  toggleWishlist: (product: any) => void;
}

const StoreCartContext = createContext<StoreCartContextType | undefined>(undefined);

export function StoreCartProvider({ children }: { children: React.ReactNode }) {
  const { currency, formatCurrency } = useCurrency();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<CartProduct[]>([]);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('store-cart');
    if (saved) {
      try {
        setCartItems(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse cart', e);
      }
    }
    const savedWish = localStorage.getItem('store-wishlist');
    if (savedWish) {
      try {
        setWishlistItems(JSON.parse(savedWish));
      } catch (e) {
        console.error('Failed to parse wishlist', e);
      }
    }
  }, []);

  // Save to local storage when changed
  useEffect(() => {
    localStorage.setItem('store-cart', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    localStorage.setItem('store-wishlist', JSON.stringify(wishlistItems));
  }, [wishlistItems]);

  const toggleWishlist = (productOrId: any) => {
    const id = typeof productOrId === "string" ? productOrId : productOrId.id || productOrId.productId;
    const name = typeof productOrId === "object" ? productOrId.name : "Product";
    setWishlistItems(prev => {
      const exists = prev.some(item => item.id === id);
      if (exists) {
        toast.info(`Removed from wishlist: ${name}`);
        return prev.filter(item => item.id !== id);
      } else {
        toast.success(`Saved to wishlist: ${name}`);
        const productObj: CartProduct = typeof productOrId === "object" ? {
          id,
          name: productOrId.name || "Product",
          price: productOrId.price || 0,
          image_url: productOrId.image_url || productOrId.image,
          mrp: productOrId.mrp || productOrId.originalPrice,
        } : { id, name: "Product", price: 0 };
        return [...prev, productObj];
      }
    });
  };

  const addToCart = (productInput: any, quantityParam?: number) => {
    const productId = productInput.id || productInput.productId;
    const finalQuantity = quantityParam ?? productInput.quantity ?? 1;

    const normalizedProduct: CartProduct = {
      id: productId,
      name: productInput.name || "Product",
      price: Number(productInput.price ?? productInput.selling_price ?? 0),
      mrp: Number(productInput.mrp ?? productInput.original_price ?? productInput.price ?? 0),
      image_url: productInput.image_url || productInput.image,
      category_name: productInput.category_name || productInput.category,
      brand: productInput.brand,
      stock: productInput.stock,
      vendorName: productInput.vendorName,
    };

    setCartItems(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (existing) {
        return prev.map(item =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + finalQuantity }
            : item
        );
      }
      return [...prev, { product: normalizedProduct, quantity: finalQuantity }];
    });

    toast.success(`Added to cart: ${normalizedProduct.name}`, {
      style: { background: '#2563EB', color: 'white', border: 'none' },
    });
  };

  const removeFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cartItems.reduce((total, item) => total + (item.product.price * item.quantity), 0);

  // Compatible items array with top-level helper getters
  const compatibleItems = cartItems.map(item => ({
    ...item,
    productId: item.product.id,
    name: item.product.name,
    price: item.product.price,
    image: item.product.image_url,
  }));

  return (
    <StoreCartContext.Provider value={{
      cartItems,
      items: compatibleItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartCount,
      totalItems: cartCount,
      cartTotal,
      wishlistItems,
      toggleWishlist
    }}>
      {children}
    </StoreCartContext.Provider>
  );
}

export function useStoreCart() {
  const context = useContext(StoreCartContext);
  if (context === undefined) {
    throw new Error('useStoreCart must be used within a StoreCartProvider');
  }
  return context;
}
