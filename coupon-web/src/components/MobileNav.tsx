'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, BadgePercent, User } from 'lucide-react';

/** App-style bottom navigation (mobile only). Center = Spin & Win. */
export default function MobileNav() {
  const pathname = usePathname();

  // Detail pages have their own sticky claim bar — keep them clean.
  if (pathname?.startsWith('/c/')) return null;

  const item = (active: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 py-1 text-[10px] font-extrabold transition ${active ? 'text-primary' : 'text-ink/60'}`;

  const openSpin = () => window.dispatchEvent(new CustomEvent('dd-open-spin'));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[90] bg-white/97 backdrop-blur border-t border-gray-100 shadow-[0_-4px_20px_-8px_rgba(91,33,182,0.25)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-end h-[58px] max-w-md mx-auto px-2">
        <Link href="/" className={item(pathname === '/')}>
          <Home size={20} /> Home
        </Link>
        <Link href="/coupons" className={item(pathname === '/coupons')}>
          <Compass size={20} /> Browse
        </Link>
        {/* Center: Spin & Win */}
        <button onClick={openSpin} className="flex flex-col items-center flex-1 -mt-5" aria-label="Spin and win">
          <span className="w-[52px] h-[52px] rounded-full brand-grad grid place-items-center text-[24px] shadow-[0_8px_20px_-6px_rgba(236,26,116,0.6)] ring-4 ring-white active:scale-95 transition">
            🎡
          </span>
          <span className="text-[9.5px] font-extrabold brand-grad-text mt-0.5">Spin &amp; Win</span>
        </button>
        <Link href="/my-coupons" className={item(pathname === '/my-coupons')}>
          <BadgePercent size={20} /> Coupons
        </Link>
        <Link href="/menu" className={item(pathname === '/menu')}>
          <User size={20} /> Account
        </Link>
      </div>
    </nav>
  );
}
