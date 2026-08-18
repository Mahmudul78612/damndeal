'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

/**
 * DDGo's own basket, kept apart from the marketplace cart.
 *
 * Two reasons it cannot be the same cart:
 *
 *  - They are different businesses. A marketplace cart is a courier shipment
 *    that arrives in days; a DDGo cart is one rider leaving one shop in
 *    minutes. Sharing storage meant adding groceries silently emptied whatever
 *    the customer had been collecting on the shopping side, and the other way
 *    round.
 *  - Quick commerce is one shop per order. A rider cannot collect from two
 *    shops, so a basket belongs to exactly one store — and switching store is
 *    a decision the customer makes, not something that happens to them. Adding
 *    from another shop therefore ASKS rather than wiping, the way Zomato and
 *    Swiggy do.
 */

const KEY = 'dd_ddgo_cart';

export interface DdgoCartItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  mrp: number;
  unit?: string;
  quantity: number;
  stock: number;
}

interface PendingAdd {
  item: DdgoCartItem;
  storeId: string;
  storeName: string;
  storeType: 'darkstore' | 'partner';
}

interface Stored {
  storeId: string | null;
  storeName: string | null;
  storeType: 'darkstore' | 'partner' | null;
  items: DdgoCartItem[];
}

interface Ctx extends Stored {
  itemCount: number;
  subtotal: number;
  savings: number;
  /** Returns false when the basket belongs to another shop — see `pending`. */
  addItem: (item: DdgoCartItem, store: { id: string; name: string; type: 'darkstore' | 'partner' }) => boolean;
  updateQty: (productId: string, qty: number) => void;
  getQty: (productId: string) => number;
  clear: () => void;
  /** Set when an add was refused; confirm or dismiss it. */
  pending: PendingAdd | null;
  confirmSwitch: () => void;
  cancelSwitch: () => void;
}

const EMPTY: Stored = { storeId: null, storeName: null, storeType: null, items: [] };
const DdgoCartContext = createContext<Ctx>({} as Ctx);
export const useDdgoCart = () => useContext(DdgoCartContext);

export function DdgoCartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Stored>(EMPTY);
  const [pending, setPending] = useState<PendingAdd | null>(null);

  // Hydrated after mount so the server and the first client render agree.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (Array.isArray(v?.items)) setCart({ ...EMPTY, ...v });
      }
    } catch { /* unreadable storage just starts empty */ }
  }, []);

  const persist = useCallback((next: Stored) => {
    setCart(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }, []);

  const addItem: Ctx['addItem'] = useCallback((item, store) => {
    let refused = false;
    setCart((prev) => {
      if (prev.items.length && prev.storeId && prev.storeId !== store.id) {
        // Someone else's shop. Ask instead of destroying what they collected.
        setPending({ item, storeId: store.id, storeName: store.name, storeType: store.type });
        refused = true;
        return prev;
      }
      const existing = prev.items.find((i) => i.productId === item.productId);
      const items = existing
        ? prev.items.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.stock) }
              : i)
        : [...prev.items, item];
      const next: Stored = {
        storeId: store.id, storeName: store.name, storeType: store.type, items,
      };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    return !refused;
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    setCart((prev) => {
      const items = qty <= 0
        ? prev.items.filter((i) => i.productId !== productId)
        : prev.items.map((i) =>
            i.productId === productId ? { ...i, quantity: Math.min(qty, i.stock) } : i);
      // An emptied basket forgets its shop, so the next add starts clean
      // instead of asking about a store nothing belongs to any more.
      const next: Stored = items.length
        ? { ...prev, items }
        : EMPTY;
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const getQty = useCallback(
    (productId: string) => cart.items.find((i) => i.productId === productId)?.quantity || 0,
    [cart.items]
  );

  const clear = useCallback(() => persist(EMPTY), [persist]);

  const confirmSwitch = useCallback(() => {
    if (!pending) return;
    persist({
      storeId: pending.storeId,
      storeName: pending.storeName,
      storeType: pending.storeType,
      items: [pending.item],
    });
    setPending(null);
  }, [pending, persist]);

  const cancelSwitch = useCallback(() => setPending(null), []);

  const itemCount = cart.items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = cart.items.reduce((n, i) => n + i.price * i.quantity, 0);
  const savings = cart.items.reduce((n, i) => n + Math.max(0, (i.mrp || i.price) - i.price) * i.quantity, 0);

  return (
    <DdgoCartContext.Provider
      value={{
        ...cart, itemCount, subtotal, savings,
        addItem, updateQty, getQty, clear,
        pending, confirmSwitch, cancelSwitch,
      }}
    >
      {children}
    </DdgoCartContext.Provider>
  );
}
