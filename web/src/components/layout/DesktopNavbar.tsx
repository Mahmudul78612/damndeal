'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useAppConfig, useBrandLogo, useBrandName } from '@/context/ConfigContext';
import { ShoppingCart, User, LogOut, Package, MapPin, Wallet, Heart, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import SearchDropdown from '@/components/SearchDropdown';

export default function DesktopNavbar() {
  const { itemCount } = useCart();
  const { isLoggedIn, user, logout, openLoginModal } = useAuth();
  const config = useAppConfig();
  const brandLogo = useBrandLogo('light');
  const brandName = useBrandName();
  const [showMenu, setShowMenu] = useState(false);
  const menuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const primaryColor = config.brand_primary_color || '#7C3AED';

  const openMenu = () => { if (menuTimer.current) clearTimeout(menuTimer.current); setShowMenu(true); };
  const closeMenu = () => { menuTimer.current = setTimeout(() => setShowMenu(false), 180); };

  useEffect(() => () => { if (menuTimer.current) clearTimeout(menuTimer.current); }, []);

  const menuLinks = [
    { href: '/account', icon: User, label: 'My Account' },
    { href: '/orders', icon: Package, label: 'My Orders' },
    { href: '/wishlist', icon: Heart, label: 'Wishlist' },
    { href: '/addresses', icon: MapPin, label: 'Addresses' },
    { href: '/wallet', icon: Wallet, label: 'Wallet' },
  ];

  return (
    <header className="hidden md:block sticky top-0 z-[90] bg-white/95 backdrop-blur-sm border-b border-gray-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="max-w-[1400px] mx-auto flex items-center h-16 px-5 gap-6">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <Image src={brandLogo} alt={brandName} width={170} height={46} className="h-9 w-auto object-contain" priority unoptimized />
        </Link>

        {/* Search — takes available space */}
        <div className="flex-1 min-w-0 max-w-2xl">
          <SearchDropdown />
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {/* Wishlist */}
          <Link href="/wishlist" title="Wishlist" className="p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition">
            <Heart size={20} />
          </Link>

          {/* Cart */}
          <Link href="/cart" data-cart-icon title="Cart" className="relative p-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition">
            <ShoppingCart size={20} />
            {itemCount > 0 && (
              <span
                className="absolute top-0.5 right-0.5 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center ring-2 ring-white"
                style={{ backgroundColor: primaryColor }}
              >
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </Link>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-200 mx-2" />

          {/* Account / Sign in */}
          {isLoggedIn ? (
            <div className="relative" onMouseEnter={openMenu} onMouseLeave={closeMenu}>
              <button className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-lg hover:bg-gray-100 transition">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: primaryColor }}>
                  {(user?.name?.[0] || 'U').toUpperCase()}
                </div>
                <div className="text-left leading-tight">
                  <p className="text-[10px] text-gray-400 -mb-0.5">Hello,</p>
                  <p className="text-xs font-semibold text-gray-800 max-w-[90px] truncate">{user?.name?.split(' ')[0] || 'Account'}</p>
                </div>
                <ChevronDown size={14} className="text-gray-400" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full pt-2 w-60 z-[200]">
                  <div className="bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                      <p className="text-sm font-bold text-gray-900 truncate">{user?.name || 'User'}</p>
                      <p className="text-[11px] text-gray-400 truncate">{user?.phone || user?.email}</p>
                    </div>
                    {menuLinks.map((l) => (
                      <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition">
                        <l.icon size={16} className="text-gray-400" /> {l.label}
                      </Link>
                    ))}
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={() => { logout(); setShowMenu(false); }} className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-red-500 hover:bg-red-50 w-full transition">
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => openLoginModal()}
              className="flex items-center gap-2 px-5 py-2 text-white rounded-lg text-[13px] font-semibold hover:opacity-90 transition shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              <User size={15} /> Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
