'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useAppConfig, useBrandLogo, useBrandName } from '@/context/ConfigContext';
import { ShoppingCart, User, LogOut, Package, MapPin, Wallet, Heart, Settings } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import SearchDropdown from '@/components/SearchDropdown';

export default function DesktopNavbar() {
  const { itemCount } = useCart();
  const { isLoggedIn, user, logout, openLoginModal } = useAuth();
  const config = useAppConfig();
  const brandLogo = useBrandLogo('light');
  const brandName = useBrandName();
  const [showSettings, setShowSettings] = useState(false);
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const primaryColor = config.brand_primary_color || '#7C3AED';

  const openSettings = () => { if (settingsTimer.current) clearTimeout(settingsTimer.current); setShowSettings(true); };
  const closeSettings = () => { settingsTimer.current = setTimeout(() => setShowSettings(false), 200); };

  useEffect(() => {
    return () => { if (settingsTimer.current) clearTimeout(settingsTimer.current); };
  }, []);

  return (
    <header className="hidden md:block sticky top-0 z-[90] bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-[1400px] mx-auto flex items-center h-14 px-4 relative z-10">
        {/* Logo */}
        <Link href="/" className="shrink-0 mr-6">
          <Image src={brandLogo} alt={brandName} width={160} height={44} className="h-10 w-auto object-contain" priority unoptimized />
        </Link>

        {/* Search - takes available space */}
        <div className="flex-1 min-w-0">
          <SearchDropdown />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1 shrink-0 ml-6">
          {/* Login */}
          {isLoggedIn ? (
            <Link href="/account" className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition">
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor + '18' }}>
                <User size={14} style={{ color: primaryColor }} />
              </div>
              <span className="text-xs font-semibold text-gray-800 max-w-[80px] truncate">
                {user?.name?.split(' ')[0] || 'Account'}
              </span>
            </Link>
          ) : (
            <button onClick={() => openLoginModal()} className="px-5 py-2 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition" style={{ backgroundColor: primaryColor }}>
              Login
            </button>
          )}

          {/* Settings with hover dropdown */}
          <div
            className="relative"
            onMouseEnter={openSettings}
            onMouseLeave={closeSettings}
          >
            <button className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">
              <Settings size={20} />
            </button>

            {showSettings && (
              <div className="absolute right-0 top-full mt-0 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[200]">
                {isLoggedIn && (
                  <div className="px-3 py-2 border-b border-gray-50">
                    <p className="text-xs font-bold text-gray-900">{user?.name || 'User'}</p>
                    <p className="text-[10px] text-gray-400">{user?.phone || user?.email}</p>
                  </div>
                )}
                <Link href="/account" className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition">
                  <User size={14} className="text-gray-400" /> My Account
                </Link>
                <Link href="/orders" className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition">
                  <Package size={14} className="text-gray-400" /> My Orders
                </Link>
                <Link href="/wishlist" className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition">
                  <Heart size={14} className="text-gray-400" /> Wishlist
                </Link>
                <Link href="/addresses" className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition">
                  <MapPin size={14} className="text-gray-400" /> Addresses
                </Link>
                <Link href="/wallet" className="flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition">
                  <Wallet size={14} className="text-gray-400" /> Wallet
                </Link>
                {isLoggedIn && (
                  <>
                    <div className="border-t border-gray-100 my-0.5" />
                    <button onClick={() => { logout(); setShowSettings(false); }} className="flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 w-full transition">
                      <LogOut size={14} /> Logout
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Cart */}
          <Link href="/cart" data-cart-icon className="relative p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">
            <ShoppingCart size={20} />
            {itemCount > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
