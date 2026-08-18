'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { useDdgoCart } from '@/context/DdgoCartContext';
import { CURRENCY_SYMBOL } from '@/lib/api';

/**
 * The running basket, pinned to the bottom of every DDGo screen.
 *
 * Quick commerce is a fast, additive flow — tap, tap, tap — and the thing a
 * customer keeps checking is what it has come to so far. Hiding that behind a
 * header icon means leaving the aisle to find out.
 *
 * It hides itself on the basket and checkout screens, where it would be
 * repeating what the page already says.
 */
export default function DdgoCartBar() {
  const cart = useDdgoCart();
  const pathname = usePathname() || '';

  if (!cart.itemCount) return null;
  if (pathname.startsWith('/grocery/cart') || pathname.startsWith('/checkout')) return null;

  return (
    <div className="fixed inset-x-0 z-40 px-3 pointer-events-none bottom-16 pb-2 md:bottom-0 md:pb-4">
      <div className="max-w-[1200px] mx-auto pointer-events-auto">
        <div className="bg-[#0D7A30] text-white rounded-2xl shadow-[0_8px_28px_rgba(13,122,48,.35)] px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13.5px] font-extrabold leading-tight">
              {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} · {CURRENCY_SYMBOL}{cart.subtotal}
            </p>
            <p className="text-[11px] opacity-85 truncate">
              {cart.savings > 0 ? `You save ${CURRENCY_SYMBOL}${cart.savings} · ` : ''}
              {cart.storeName}
            </p>
          </div>
          <Link
            href="/grocery/cart"
            prefetch
            className="shrink-0 bg-white text-[#0D7A30] font-extrabold text-[13.5px] px-4 py-2 rounded-xl inline-flex items-center gap-1.5 active:scale-[.98] transition"
          >
            <ShoppingCart size={15} /> View cart
          </Link>
        </div>
      </div>
    </div>
  );
}
