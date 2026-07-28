'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LocationPill } from '@/context/LocationContext';
import { Search, User, LogOut, BadgePercent, Store, Compass } from 'lucide-react';

/** Ticket-shaped brand mark (from the brand asset — gradient ticket + %) */
export function TicketLogo({ size = 38 }: { size?: number }) {
  return (
    <span className="relative brand-grad grid place-items-center text-white font-extrabold shadow-[0_6px_14px_-4px_rgba(236,26,116,0.5)]"
      style={{ width: size, height: size * 0.78, borderRadius: 10, fontSize: size * 0.42 }}>
      %
      <span className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full bg-white" />
      <span className="absolute -right-[5px] top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full bg-white" />
    </span>
  );
}

export default function Header() {
  const { isLoggedIn, user, openLoginModal, logout } = useAuth();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/coupons?q=${encodeURIComponent(q.trim())}` : '/coupons');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur shadow-[0_2px_14px_-6px_rgba(91,33,182,0.18)]">
      {/* brand gradient hairline */}
      <div className="h-[3.5px] brand-grad" />
      <div className="max-w-[1200px] mx-auto px-3 md:px-4 h-[58px] md:h-[64px] flex items-center gap-2.5 md:gap-7">
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="DamnDeal Coupons" className="h-[38px] md:h-[46px] w-auto drop-shadow-[0_3px_8px_rgba(236,26,116,0.25)]" />
        </Link>

        {/* Location (desktop) */}
        <div className="hidden md:block"><LocationPill /></div>

        {/* Desktop search (top row) */}
        <form onSubmit={submit} className="hidden md:flex flex-1 max-w-md items-center gap-2 bg-[#F7F5FB] border border-transparent rounded-full px-4 py-2.5 focus-within:border-[#F5A623] focus-within:bg-white focus-within:shadow-[0_4px_14px_-6px_rgba(245,166,35,0.5)] transition">
          <Search size={15} className="text-gray-400 shrink-0" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search coupons, brands, categories…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 text-ink"
          />
        </form>

        <nav className="ml-auto flex items-center gap-1 md:gap-2">
          <Link href="/coupons" className="hidden md:flex items-center gap-1.5 text-[13.5px] font-bold text-ink/70 hover:text-primary px-2.5 py-2 rounded-lg hover:bg-primary-light/60 transition">
            <Compass size={16} /> Browse
          </Link>
          <Link href="/my-coupons" className="hidden md:flex items-center gap-1.5 text-[13.5px] font-bold text-ink/70 hover:text-primary px-2.5 py-2 rounded-lg hover:bg-primary-light/60 transition">
            <BadgePercent size={16} /> My Coupons
          </Link>
          {isLoggedIn ? (
            <div className="relative ml-1">
              <button onClick={() => setMenu(m => !m)}
                className="w-9 h-9 rounded-full brand-grad text-white font-extrabold text-sm grid place-items-center shadow-md shadow-pink/30 ring-2 ring-white">
                {(user?.name?.[0] || 'U').toUpperCase()}
              </button>
              {menu && (
                <div className="absolute right-0 top-12 w-52 bg-white rounded-2xl shadow-xl border border-[#F0E9FA] py-1.5 z-50 overflow-hidden">
                  <div className="h-1 brand-grad" />
                  <div className="px-4 py-2.5 border-b border-gray-50">
                    <p className="text-sm font-extrabold truncate text-ink">{user?.name || 'Account'}</p>
                    <p className="text-[11px] text-gray-400 truncate">{user?.phone || user?.email}</p>
                  </div>
                  <Link href="/my-coupons" onClick={() => setMenu(false)} className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-gray-700 hover:bg-band"><BadgePercent size={15} className="text-primary" /> My Coupons</Link>
                  <Link href="/vendor" onClick={() => setMenu(false)} className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-gray-700 hover:bg-band"><Store size={15} className="text-primary" /> Vendor Portal</Link>
                  <button onClick={() => { logout(); setMenu(false); }} className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-red-50">
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => openLoginModal()}
              className="ml-1 flex items-center gap-1.5 text-[13px] font-extrabold text-white bg-primary rounded-full w-9 h-9 justify-center p-0 md:w-auto md:h-auto md:px-5 md:py-2.5 hover:bg-primary-dark shadow-md shadow-primary/25 transition">
              <User size={15} /> <span className="hidden md:inline">Sign in</span>
            </button>
          )}
        </nav>
      </div>

      {/* Mobile: location + search row — home page only */}
      {pathname === '/' && (
      <div className="md:hidden px-3 pb-2.5 flex items-center gap-2">
        <LocationPill compact />
        <form onSubmit={submit} className="flex-1">
          <div className="flex items-center gap-2 bg-[#F7F5FB] rounded-full px-4 py-2.5 border border-transparent focus-within:border-[#F5A623] focus-within:bg-white transition">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search coupons, brands…"
              className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-gray-400 text-ink"
            />
          </div>
        </form>
      </div>
      )}
    </header>
  );
}
