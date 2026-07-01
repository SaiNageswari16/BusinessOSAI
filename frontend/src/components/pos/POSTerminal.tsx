import { useState } from "react";
import { posProducts } from "../../data/pos-mock";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Search, ScanBarcode, UserPlus, CreditCard, Banknote, Trash2, Settings, Plus, Minus, Calculator, ShoppingCart } from "lucide-react";

export function POSTerminal() {
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const tax = subtotal * 0.18; // 18% GST mock
  const total = subtotal + tax;

  const filteredProducts = posProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search));

  return (
    <div className="flex h-full w-full bg-muted/20">
      {/* Left Panel: Products & Scanning */}
      <div className="flex-1 flex flex-col p-4 border-r overflow-hidden h-full">
        {/* Top Bar for Search & Customer */}
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <input 
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-10 pr-4 text-base rounded-xl border-2 border-primary/20 bg-background focus:ring-2 focus:ring-primary shadow-sm" 
              placeholder="Scan Barcode or Search Products..." 
              autoFocus
            />
          </div>
          <Button variant="outline" className="h-12 px-6 rounded-xl bg-background shadow-sm">
            <UserPlus className="size-5 mr-2 text-primary" /> Walk-in Customer
          </Button>
        </div>

        {/* Categories / Quick Filters */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-thin">
          <Button className="rounded-full px-6 gradient-brand text-white border-0">All Items</Button>
          <Button variant="outline" className="rounded-full px-6 bg-background">Electronics</Button>
          <Button variant="outline" className="rounded-full px-6 bg-background">Accessories</Button>
          <Button variant="outline" className="rounded-full px-6 bg-background">Services</Button>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pr-2 pb-20 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 scrollbar-thin content-start">
          {filteredProducts.map((p) => (
            <Card 
              key={p.id} 
              className="p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all active:scale-95 flex flex-col justify-between"
              onClick={() => addToCart(p)}
            >
              <div className="size-full bg-muted/30 rounded-lg mb-3 flex items-center justify-center aspect-video">
                <span className="text-muted-foreground/30 font-bold">IMAGE</span>
              </div>
              <div>
                <div className="font-bold text-sm leading-tight line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono mt-1">{p.barcode}</div>
              </div>
              <div className="mt-3 flex justify-between items-center border-t pt-2">
                <span className="font-bold text-primary">₹{p.price.toLocaleString()}</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{p.stock} left</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Right Panel: Cart & Checkout */}
      <div className="w-[400px] bg-background flex flex-col h-full shadow-xl z-10 shrink-0">
        <div className="p-4 border-b bg-muted/10 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center gap-2"><ShoppingCart className="size-5 text-primary" /> Current Order</h3>
          <Button variant="ghost" size="icon" onClick={() => setCart([])}><Trash2 className="size-4 text-rose-500" /></Button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <ShoppingCart className="size-12 opacity-20 mb-4" />
              <p>Cart is empty. Scan an item.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex gap-3 group">
                <div className="flex-1">
                  <div className="font-semibold text-sm line-clamp-1">{item.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">₹{item.price.toLocaleString()} x {item.qty}</div>
                </div>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  <Button variant="ghost" size="icon" className="size-7 rounded-md" onClick={() => updateQty(item.id, -1)}><Minus className="size-3" /></Button>
                  <span className="w-6 text-center font-bold text-sm">{item.qty}</span>
                  <Button variant="ghost" size="icon" className="size-7 rounded-md" onClick={() => updateQty(item.id, 1)}><Plus className="size-3" /></Button>
                </div>
                <div className="font-bold text-sm w-20 text-right flex flex-col justify-center">
                  ₹{(item.price * item.qty).toLocaleString()}
                </div>
                <Button variant="ghost" size="icon" className="size-8 rounded-md text-rose-500 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => removeFromCart(item.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Totals & Checkout */}
        <div className="border-t bg-muted/10 p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-bold">₹{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GST (18%)</span>
            <span className="font-bold">₹{tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Discount</span>
            <span className="font-bold text-emerald-500">- ₹0.00</span>
          </div>
          
          <div className="pt-3 border-t flex justify-between items-end">
            <span className="text-lg font-bold">Total Pay</span>
            <span className="text-3xl font-bold tracking-tighter text-primary">₹{total.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button className="h-14 text-lg bg-emerald-500 hover:bg-emerald-600 text-white"><Banknote className="size-5 mr-2" /> Cash</Button>
            <Button className="h-14 text-lg bg-blue-500 hover:bg-blue-600 text-white"><CreditCard className="size-5 mr-2" /> Card / UPI</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
