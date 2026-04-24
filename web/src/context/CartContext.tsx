'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { CartItem } from '@/lib/types';

interface CartCtx {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  totalGst: number;
  totalSavings: number;
  partnerId: string | null;
  partnerName: string | null;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  getQty: (productId: string) => number;
  clear: () => void;
}

const CartContext = createContext<CartCtx>({} as CartCtx);
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('dd_cart') || '[]');
      if (stored.length) setItems(stored);
    } catch { /* ignore */ }
  }, []);

  const save = (arr: CartItem[]) => {
    setItems(arr);
    localStorage.setItem('dd_cart', JSON.stringify(arr));
  };

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      // Check partner constraint
      if (prev.length > 0 && prev[0].partnerId !== item.partnerId) {
        if (!confirm('Cart has items from another shop. Clear and add this?')) return prev;
        const next = [{ ...item, quantity: 1 }];
        localStorage.setItem('dd_cart', JSON.stringify(next));
        return next;
      }
      const idx = prev.findIndex(i => i.productId === item.productId);
      let next: CartItem[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
      } else {
        next = [...prev, { ...item, quantity: 1 }];
      }
      localStorage.setItem('dd_cart', JSON.stringify(next));
      return next;
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.productId !== productId);
      localStorage.setItem('dd_cart', JSON.stringify(next));
      return next;
    });
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    setItems(prev => {
      if (qty <= 0) {
        const next = prev.filter(i => i.productId !== productId);
        localStorage.setItem('dd_cart', JSON.stringify(next));
        return next;
      }
      const next = prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i);
      localStorage.setItem('dd_cart', JSON.stringify(next));
      return next;
    });
  }, []);

  const getQty = useCallback((productId: string) => {
    return items.find(i => i.productId === productId)?.quantity || 0;
  }, [items]);

  const clear = useCallback(() => save([]), []);

  const itemCount = items.reduce((t, i) => t + i.quantity, 0);
  const subtotal = items.reduce((t, i) => t + i.price * i.quantity, 0);
  const totalGst = items.reduce((t, i) => {
    const gst = i.gstPercent || 0;
    if (gst === 0) return t;
    if (i.gstInclusive !== false) {
      const exGst = i.price / (1 + gst / 100);
      return t + (i.price - exGst) * i.quantity;
    }
    return t + (i.price * gst / 100) * i.quantity;
  }, 0);
  const totalSavings = items.reduce((t, i) => {
    if (i.mrp && i.mrp > i.price) return t + (i.mrp - i.price) * i.quantity;
    return t;
  }, 0);
  const partnerId = items.length > 0 ? items[0].partnerId : null;
  const partnerName = items.length > 0 ? items[0].partnerName : null;

  return (
    <CartContext.Provider value={{ items, itemCount, subtotal, totalGst, totalSavings, partnerId, partnerName, addItem, removeItem, updateQty, getQty, clear }}>
      {children}
    </CartContext.Provider>
  );
}
