'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppConfig } from '@/context/ConfigContext';
import {
  User as UserIcon, Package, Wallet, Heart, MapPin, Phone, HelpCircle, FileText, Shield, LogOut, ChevronRight, Globe, Building2, Mail, RotateCcw, Crown, Sparkles,
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

  const primaryColor = config.brand_primary_color || '#7C3AED';
  const supportPhone = config.support_phone || '+91-76968-27211';
  const supportEmail = config.support_email || 'info@damndeal.in';

  const activityItems: MenuItem[] = [
    { href: '/orders', icon: Package, label: 'My Orders', color: 'text-blue-500' },
    { href: '/returns', icon: RotateCcw, label: 'My Returns', color: 'text-orange-500' },
    { href: '/wallet', icon: Wallet, label: 'Wallet', color: 'text-amber-500' },
    { href: '/magic-club', icon: Sparkles, label: 'Magic Club', color: 'text-orange-500' },
    { href: '/magic-pools/mine', icon: Crown, label: 'Magic Pools', color: 'text-fuchsia-500' },
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

  // Compact menu group (shared by sidebar + mobile)
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

  // Shared blocks ----------------------------------------------------------
  const avatar = (size: number) => (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: primaryColor, fontSize: size * 0.42 }}
    >
      {(user?.name?.[0] || 'U').toUpperCase()}
    </div>
  );

  const companyInfo = (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
        <Building2 size={11} /> Company Info
      </h3>
      <p className="text-gray-800 font-bold text-[13px]">DAMNDEAL INDIA PRIVATE LIMITED</p>
      <p className="flex items-start gap-1.5 mt-1.5 text-xs text-gray-500">
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
  );

  const Field = ({ label, value }: { label: string; value?: string }) => (
    <div>
      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
      <div className="mt-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800">{value || '—'}</div>
    </div>
  );

  const loginPrompt = (compact: boolean) => (
    <div className={`bg-white rounded-xl shadow-sm flex items-center gap-3 ${compact ? 'p-4' : 'p-6'}`}>
      <div className="w-11 h-11 bg-primary/10 rounded-full flex items-center justify-center">
        <UserIcon size={20} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-bold text-gray-900">Login to your account</h2>
        <p className="text-[11px] text-gray-400">View orders, manage addresses, and more</p>
      </div>
      <button
        onClick={() => openLoginModal('/account')}
        className="px-4 py-2 text-white rounded-lg font-bold text-xs shrink-0 hover:opacity-90"
        style={{ backgroundColor: primaryColor }}
      >
        Login
      </button>
    </div>
  );

  const logoutBtn = (
    <button
      onClick={() => { logout(); router.push('/'); }}
      className="w-full flex items-center justify-center gap-2 py-3 text-red-500 font-semibold text-sm bg-white rounded-xl shadow-sm hover:bg-red-50 transition"
    >
      <LogOut size={16} /> Logout
    </button>
  );

  return (
    <div className="max-w-[1080px] mx-auto px-3 md:px-4 py-3 md:py-6">
      {/* ================= DESKTOP (Flipkart-style two columns) ================= */}
      <div className="hidden md:grid grid-cols-[270px_1fr] gap-5 items-start">
        {/* Left sidebar */}
        <aside className="space-y-3">
          {!loading && isLoggedIn && user ? (
            <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
              {avatar(48)}
              <div className="min-w-0">
                <p className="text-[11px] text-gray-400 leading-none mb-1">Hello,</p>
                <p className="text-sm font-bold text-gray-900 truncate">{user.name || 'User'}</p>
              </div>
            </div>
          ) : (
            !loading && loginPrompt(true)
          )}

          {isLoggedIn && renderGroup('My Activity', activityItems)}
          {renderGroup('Help & Info', helpItems)}
          {renderGroup('Legal', legalItems)}
          {isLoggedIn && logoutBtn}
        </aside>

        {/* Right content */}
        <main className="space-y-5">
          {!loading && isLoggedIn && user ? (
            <>
              {/* Personal Information */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-5">Personal Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Full Name" value={user.name} />
                  <Field label="Mobile Number" value={user.phone} />
                  <Field label="Email Address" value={user.email} />
                </div>
              </div>

              {/* Quick access cards */}
              <div>
                <h3 className="text-sm font-bold text-gray-800 mb-3">Quick Access</h3>
                <div className="grid grid-cols-3 gap-3">
                  {activityItems.map((item, i) => (
                    <Link
                      key={i}
                      href={item.href}
                      className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-start gap-2.5 border border-transparent hover:border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                        <item.icon size={20} className={item.color} />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                      <span className="text-[11px] text-gray-400">View &rarr;</span>
                    </Link>
                  ))}
                </div>
              </div>

              {companyInfo}
            </>
          ) : (
            !loading && (
              <div className="space-y-5">
                {loginPrompt(false)}
                {companyInfo}
              </div>
            )
          )}
        </main>
      </div>

      {/* ================= MOBILE (single column) ================= */}
      <div className="md:hidden">
        {!loading && isLoggedIn && user ? (
          <div className="bg-white rounded-xl p-3 shadow-sm mb-3 flex items-center gap-3">
            {avatar(44)}
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-gray-900 truncate">{user.name || 'User'}</h2>
              <p className="text-xs text-gray-400">{user.phone}</p>
              {user.email && <p className="text-[10px] text-gray-400">{user.email}</p>}
            </div>
          </div>
        ) : (
          !loading && <div className="mb-3">{loginPrompt(true)}</div>
        )}

        {isLoggedIn && renderGroup('My Activity', activityItems)}
        {renderGroup('Help & Info', helpItems)}
        {renderGroup('Legal', legalItems)}
        <div className="mb-3">{companyInfo}</div>
        {isLoggedIn && logoutBtn}
      </div>

      <p className="text-center text-[10px] text-gray-400 mt-4">&copy; {new Date().getFullYear()} DamnDeal India Pvt Ltd</p>
    </div>
  );
}
