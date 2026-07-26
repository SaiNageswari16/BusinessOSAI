import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

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
}

export interface CartItem {
  product: CartProduct;
  quantity: number;
}

interface StoreCartContextType {
  cartItems: CartItem[];
  addToCart: (product: CartProduct, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

const StoreCartContext = createContext<StoreCartContextType | undefined>(undefined);

export function StoreCartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

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
  }, []);

  // Save to local storage when changed
  useEffect(() => {
    localStorage.setItem('store-cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product: CartProduct, quantity: number) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });

    toast.success(`Added to cart: ${product.name}`, {
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

  return (
    <StoreCartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal }}>
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
