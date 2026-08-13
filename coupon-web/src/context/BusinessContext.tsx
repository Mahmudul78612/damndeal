'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { biz, bizToken, clearBizSession } from '@/lib/bizApi';

export interface BizMember {
  id: string;
  name: string;
  role: 'owner' | 'manager' | 'marketer' | 'cashier' | 'accountant';
  legacy?: boolean;
  permissions: string[];
  scope: { brands: string[]; outlets: string[] };
}

interface BizState {
  loading: boolean;
  member: BizMember | null;
  business: any | null;
  brands: any[];
  outlets: any[];
  /** Currently selected brand — a company can own several. */
  brandId: string | null;
  setBrandId: (id: string) => void;
  can: (perm: string) => boolean;
  refresh: () => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<BizState>({
  loading: true, member: null, business: null, brands: [], outlets: [],
  brandId: null, setBrandId: () => {}, can: () => false,
  refresh: async () => {}, signOut: () => {},
});

const BRAND_KEY = 'dd_biz_brand';

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<BizMember | null>(null);
  const [business, setBusiness] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [brandId, setBrandIdState] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!bizToken()) { setLoading(false); setMember(null); return; }
    try {
      const r = await biz.get('/coupons/business/me');
      setMember(r.member || null);
      setBusiness(r.business || null);
      setBrands(r.brands || []);
      setOutlets(r.outlets || []);
      // Keep the chosen brand only while it is still in scope
      const stored = typeof window !== 'undefined' ? localStorage.getItem(BRAND_KEY) : null;
      const ids = (r.brands || []).map((b: any) => String(b._id));
      const next = stored && ids.includes(stored) ? stored : ids[0] || null;
      setBrandIdState(next);
      if (next && typeof window !== 'undefined') localStorage.setItem(BRAND_KEY, next);
    } catch {
      setMember(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setBrandId = (id: string) => {
    setBrandIdState(id);
    if (typeof window !== 'undefined') localStorage.setItem(BRAND_KEY, id);
  };

  const can = (perm: string) => !!member?.permissions?.includes(perm);

  const signOut = () => {
    clearBizSession();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(BRAND_KEY);
      window.location.href = '/business/login';
    }
  };

  return (
    <Ctx.Provider value={{ loading, member, business, brands, outlets, brandId, setBrandId, can, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useBusiness = () => useContext(Ctx);
