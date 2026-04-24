'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppConfig } from '@/context/ConfigContext';
import {
  User as UserIcon, Package, Wallet, Heart, MapPin, Phone, HelpCircle, FileText, Shield, LogOut, ChevronRight, Globe, Building2, Mail, RotateCcw,
} from 'lucide-react';

type MenuItem = {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  color: string;
  external?: boolean;
};

export default function AccountPage() {
  const { user, isLoggedIn, loading, logout, openLoginModal } = useAuth();
  const router = useRouter();
  const config = useAppConfig();

  const supportPhone = config.support_phone || '+91-76968-27211';
  const supportEmail = config.support_email || 'info@damndeal.in';

  const activityItems: MenuItem[] = [
    { href: '/orders', icon: Package, label: 'My Orders', color: 'text-blue-500' },
    { href: '/returns', icon: RotateCcw, label: 'My Returns', color: 'text-orange-500' },
    { href: '/wallet', icon: Wallet, label: 'Wallet', color: 'text-amber-500' },
    { href: '/wishlist', icon: Heart, label: 'Wishlist', color: 'text-red-400' },
    { href: '/addresses', icon: MapPin, label: 'Saved Addresses', color: 'text-green-500' },
  ];

  const helpItems: MenuItem[] = [
    { href: `tel:${supportPhone}`, icon: Phone, label: 'Contact Support', color: 'text-primary', external: true },
    { href: `mailto:${supportEmail}`, icon: Mail, label: 'Email Support', color: 'text-blue-500', external: true },
    ...(config.instagram_url ? [{ href: config.instagram_url, icon: Globe, label: 'Follow on Instagram', color: 'text-pink-500', external: true }] : []),
  ];

  const legalItems: MenuItem[] = [
    { href: '/legal/terms', icon: FileText, label: 'Terms & Conditions', color: 'text-gray-500' },
    { href: '/legal/privacy', icon: Shield, label: 'Privacy Policy', color: 'text-gray-500' },
    { href: '/legal/refund', icon: HelpCircle, label: 'Refund Policy', color: 'text-gray-500' },
    { href: '/legal/vendor', icon: FileText, label: 'Vendor / Partner Terms', color: 'text-gray-500' },
  ];

  const renderGroup = (title: string, items: MenuItem[]) => (
    <div className="mb-3">
      <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 px-1">{title}</h3>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {items.map((item, i) => {
          const Comp = item.external ? 'a' : Link;
          const extraProps = item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
          return (
            <Comp
              key={i}
              href={item.href}
              {...extraProps}
              className={`flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition ${i > 0 ? 'border-t border-gray-50' : ''}`}
            >
              <item.icon size={16} className={item.color} />
              <span className="text-xs font-medium text-gray-700 flex-1">{item.label}</span>
              <ChevronRight size={14} className="text-gray-300" />
            </Comp>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="px-4 py-3 md:px-4 max-w-2xl mx-auto">
      {!loading && isLoggedIn && user ? (
        <div className="bg-white rounded-xl p-3 shadow-sm mb-3 flex items-center gap-3">
          <div className="w-11 h-11 bg-primary/10 rounded-full flex items-center justify-center">
            <UserIcon size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-gray-900 truncate">{user.name || 'User'}</h2>
            <p className="text-xs text-gray-400">{user.phone}</p>
            {user.email && <p className="text-[10px] text-gray-400">{user.email}</p>}
          </div>
        </div>
      ) : (
        !loading && (
          <div className="bg-white rounded-xl p-4 shadow-sm mb-3 flex items-center gap-3">
            <div className="w-11 h-11 bg-primary/10 rounded-full flex items-center justify-center">
              <UserIcon size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-gray-900">Login to your account</h2>
              <p className="text-[11px] text-gray-400">View orders, manage addresses, and more</p>
            </div>
            <button
              onClick={() => openLoginModal('/account')}
              className="px-3 py-1.5 bg-primary text-white rounded-lg font-bold text-xs hover:bg-primary-dark shrink-0"
            >
              Login
            </button>
          </div>
        )
      )}

      {isLoggedIn && renderGroup('My Activity', activityItems)}
      {renderGroup('Help & Info', helpItems)}
      {renderGroup('Legal', legalItems)}

      <div className="mb-3">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-1.5 px-1 flex items-center gap-1">
          <Building2 size={11} /> Company Info
        </h3>
        <div className="bg-white rounded-xl shadow-sm p-3 text-xs text-gray-500 leading-relaxed">
          <p className="text-gray-800 font-bold text-[13px]">DAMNDEAL INDIA PRIVATE LIMITED</p>
          <p className="flex items-start gap-1.5 mt-1.5">
            <MapPin size={12} className="mt-0.5 shrink-0 text-gray-400" />
            <span>Booth No. 1426, Chotti Baradari, Patiala, Punjab, India - 147001</span>
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2.5 pt-2.5 border-t border-gray-100">
            <div>
              <p className="text-[10px] text-gray-400 uppercase">CIN</p>
              <p className="text-[11px] text-gray-700 font-medium">U47912PB2025PTC064208</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase">GSTIN</p>
              <p className="text-[11px] text-gray-700 font-medium">03AALCD6016H1ZW</p>
            </div>
          </div>
        </div>
      </div>

      {isLoggedIn && (
        <button
          onClick={() => { logout(); router.push('/'); }}
          className="w-full flex items-center justify-center gap-2 py-3 text-red-500 font-semibold text-sm bg-white rounded-2xl shadow-sm hover:bg-red-50 transition"
        >
          <LogOut size={16} /> Logout
        </button>
      )}

      <p className="text-center text-[10px] text-gray-400 mt-4">&copy; {new Date().getFullYear()} DamnDeal India Pvt Ltd</p>
    </div>
  );
}
