'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, ShoppingCart, User } from 'lucide-react';
import { useDdgoCart } from '@/context/DdgoCartContext';

/**
 * Bottom navigation for the DDGo storefront — the quick-commerce app shell.
 *
 * The marketplace's own MobileNav does not appear on /grocery, so this is the
 * only tab bar here. Kept to the four things a grocery shopper moves between:
 * the store list, their orders, the basket (with a live count) and account.
 */
const TABS = [
  { href: '/grocery', icon: Home, label: 'Home', exact: true },
  { href: '/grocery/orders', icon: ClipboardList, label: 'Orders' },
  { href: '/grocery/cart', icon: ShoppingCart, label: 'Cart', badge: true },
  { href: '/account', icon: User, label: 'Account' },
];

export default function DdgoBottomNav() {
  const path = usePathname() || '';
  const { itemCount } = useDdgoCart();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 md:hidden safe-bottom">
      <div className="flex items-center justify-around h-14 max-w-[600px] mx-auto">
        {TABS.map((t) => {
          const active = t.exact ? path === t.href : path.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              prefetch
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
              style={{ color: active ? '#0D7A30' : '#98A2B3' }}
            >
              <span className="relative">
                <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                {t.badge && itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[#0D7A30] text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] px-1 flex items-center justify-center">
                    {itemCount > 9 ? '9+' : itemCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-bold">{t.label}</span>
              {active && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-[#0D7A30]" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
