'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Home, Search, ShoppingCart, User, Grid3X3, Package, Wallet, LogOut, Heart } from 'lucide-react';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/categories', icon: Grid3X3, label: 'Categories' },
  { href: '/search', icon: Search, label: 'Search' },
  { href: '/cart', icon: ShoppingCart, label: 'Cart', badge: true },
  { href: '/orders', icon: Package, label: 'My Orders' },
  { href: '/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/wishlist', icon: Heart, label: 'Wishlist' },
  { href: '/account', icon: User, label: 'Account' },
];

export default function DesktopSidebar() {
  const path = usePathname();
  const { itemCount } = useCart();
  const { isLoggedIn, user, logout } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-60 h-screen bg-white border-r border-gray-100 fixed left-0 top-0 z-40">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
          <span className="text-white font-extrabold text-sm">DD</span>
        </div>
        <span className="text-lg font-extrabold text-gray-900">DamnDeal</span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(item => {
          const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-5 py-2.5 mx-2 rounded-xl text-sm transition-all
                ${active ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <item.icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span>{item.label}</span>
              {item.badge && itemCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-gray-100 p-4">
        {isLoggedIn ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center">
              <User size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.phone}</p>
            </div>
            <button onClick={logout} className="p-1.5 text-gray-400 hover:text-red-500">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <Link href="/login" className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90">
            <User size={16} />
            Login
          </Link>
        )}
      </div>
    </aside>
  );
}
