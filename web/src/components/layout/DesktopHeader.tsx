'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Search, ShoppingCart, User } from 'lucide-react';

export default function DesktopHeader() {
  const { itemCount } = useCart();
  const { isLoggedIn, user } = useAuth();

  return (
    <header className="hidden md:flex items-center gap-4 h-16 px-6 bg-white border-b border-gray-100 sticky top-0 z-30 ml-60">
      {/* Search */}
      <Link href="/search" className="flex-1 max-w-xl flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5 text-gray-400 hover:bg-gray-100 transition">
        <Search size={18} />
        <span className="text-sm">Search products...</span>
      </Link>

      <div className="flex items-center gap-3 ml-auto">
        {/* Cart */}
        <Link href="/cart" className="relative p-2 text-gray-600 hover:text-primary transition">
          <ShoppingCart size={22} />
          {itemCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center">
              {itemCount > 9 ? '9+' : itemCount}
            </span>
          )}
        </Link>

        {/* User */}
        {isLoggedIn ? (
          <Link href="/account" className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-50">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <User size={16} className="text-primary" />
            </div>
            <span className="text-sm font-medium text-gray-700">{user?.name?.split(' ')[0] || 'Account'}</span>
          </Link>
        ) : (
          <Link href="/login" className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90">
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
