'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { Home, ShoppingCart, User, Grid3X3, Ticket } from 'lucide-react';
import { useCouponMarket } from './CouponMarketLink';

const tabs = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/categories', icon: Grid3X3, label: 'Categories' },
  { href: '/cart', icon: ShoppingCart, label: 'Cart', badge: true },
  { href: '/account', icon: User, label: 'Account' },
];

// Only show bottom nav on these top-level routes (exact match for "/" and prefix for others)
const navAllowedRoots = ['/categories', '/account', '/cart'];

export default function MobileNav() {
  const path = usePathname();
  const { itemCount } = useCart();
  // Coupon marketplace lives on a sibling subdomain, so it needs a plain <a>
  // rather than a client-side route — the shared session cookie does the rest.
  const coupons = useCouponMarket();
  const normalizedPath = path === '/' ? '/' : path.replace(/\/$/, '');
  const showBottomNav =
    normalizedPath === '/' ||
    navAllowedRoots.some(root => normalizedPath === root);

  return (
    <>
      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden safe-bottom">
          <div className="flex items-center justify-around h-12">
            {tabs.map(t => {
              const active = t.href === '/' ? normalizedPath === '/' : normalizedPath.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href} className="flex flex-col items-center gap-0 relative">
                  <t.icon size={20} className={active ? 'text-primary' : 'text-gray-400'} strokeWidth={active ? 2.5 : 1.8} />
                  {t.badge && itemCount > 0 && (
                    <span className="absolute -top-1.5 right-[-10px] bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-1 flex items-center justify-center">
                      {itemCount > 9 ? '9+' : itemCount}
                    </span>
                  )}
                  <span className={`text-[9px] ${active ? 'text-primary font-semibold' : 'text-gray-400'}`}>
                    {t.label}
                  </span>
                </Link>
              );
            })}

            {coupons.enabled && (
              <a href={coupons.url} className="flex flex-col items-center gap-0">
                <Ticket size={20} className="text-gray-400" strokeWidth={1.8} />
                <span className="text-[9px] text-gray-400">{coupons.label}</span>
              </a>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
