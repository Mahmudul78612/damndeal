'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useBusiness } from '@/context/BusinessContext';
import {
  LayoutDashboard, BadgePercent, ScanLine, Store, Users2,
  KeyRound, Package2, Building2, LogOut, Menu, X, ChevronDown,
} from 'lucide-react';

/** Pages that must render without the console chrome (no session yet). */
const BARE_ROUTES = ['/business/login', '/business/join'];

interface NavItem { href: string; label: string; icon: React.ReactNode; perm?: string }

const NAV: NavItem[] = [
  { href: '/business', label: 'Dashboard', icon: <LayoutDashboard size={17} />, perm: 'view_dashboard' },
  { href: '/business/counter', label: 'Counter', icon: <ScanLine size={17} />, perm: 'redeem_codes' },
  { href: '/business/coupons', label: 'Coupons', icon: <BadgePercent size={17} />, perm: 'manage_campaigns' },
  { href: '/business/outlets', label: 'Outlets', icon: <Store size={17} />, perm: 'manage_outlets' },
  { href: '/business/team', label: 'Team', icon: <Users2 size={17} />, perm: 'manage_members' },
  { href: '/business/billing', label: 'Credits & Billing', icon: <Package2 size={17} />, perm: 'manage_billing' },
  { href: '/business/profile', label: 'Brand profile', icon: <Building2 size={17} />, perm: 'manage_brands' },
  { href: '/business/api', label: 'API key', icon: <KeyRound size={17} />, perm: 'manage_api' },
];

export default function BusinessShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, member, business, brands, brandId, setBrandId, can, signOut } = useBusiness();
  const [menuOpen, setMenuOpen] = useState(false);

  const bare = BARE_ROUTES.some((r) => pathname?.startsWith(r));

  // Not signed in → the console is not usable at all
  useEffect(() => {
    if (!bare && !loading && !member) router.replace('/business/login');
  }, [bare, loading, member, router]);

  // Close the drawer on navigation
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  if (bare) return <div className="min-h-screen bg-band">{children}</div>;

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-band">
        <p className="text-sm text-gray-400">Loading your console…</p>
      </div>
    );
  }
  if (!member) return null;

  const visible = NAV.filter((n) => !n.perm || can(n.perm));
  const isActive = (href: string) =>
    href === '/business' ? pathname === '/business' : pathname?.startsWith(href);

  const sidebar = (
    <nav className="p-2">
      {visible.map((n) => (
        <Link key={n.href} href={n.href}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-bold mb-0.5 transition ${
            isActive(n.href)
              ? 'bg-primary-light text-primary shadow-[inset_3px_0_0_#7C3AED]'
              : 'text-gray-500 hover:bg-band hover:text-ink'}`}>
          <span className={isActive(n.href) ? 'text-primary' : 'text-gray-400'}>{n.icon}</span>
          {n.label}
        </Link>
      ))}
      <button onClick={signOut}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-bold text-gray-400 hover:bg-band hover:text-red-500 mt-2">
        <LogOut size={17} /> Sign out
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-band">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-[1280px] mx-auto px-3 md:px-4 h-14 flex items-center gap-3">
          <button className="md:hidden p-1.5 text-gray-500" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/business" className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg brand-grad grid place-items-center text-white text-[13px] font-extrabold shrink-0">D</span>
            <span className="font-extrabold text-[15px] text-ink truncate">
              {business?.name || 'Business'}
            </span>
          </Link>

          {/* Brand switcher — only meaningful when a company owns several */}
          {brands.length > 1 && (
            <div className="relative ml-1 hidden sm:block">
              <select value={brandId || ''} onChange={(e) => setBrandId(e.target.value)}
                className="appearance-none bg-band border border-gray-200 rounded-lg pl-3 pr-7 py-1.5 text-[12.5px] font-bold text-gray-600 outline-none focus:border-primary">
                {brands.map((b: any) => <option key={b._id} value={b._id}>{b.businessName}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}

          <div className="ml-auto flex items-center gap-2.5 min-w-0">
            <div className="text-right hidden sm:block min-w-0">
              <p className="text-[12.5px] font-bold text-ink truncate max-w-[140px]">{member.name}</p>
              <p className="text-[10.5px] font-extrabold uppercase tracking-wide text-primary">{member.role}</p>
            </div>
            <span className="w-8 h-8 rounded-full brand-grad grid place-items-center text-white text-[12px] font-extrabold shrink-0">
              {(member.name || '?').charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto md:px-4 md:py-6 md:grid md:grid-cols-[224px_1fr] md:gap-6 md:items-start">
        {/* Desktop sidebar */}
        <aside className="hidden md:block md:sticky md:top-20">
          <div className="bg-white rounded-2xl border border-[#F0E9FA] shadow-[0_2px_12px_-6px_rgba(91,33,182,0.12)] overflow-hidden">
            {sidebar}
          </div>
        </aside>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute left-0 top-0 bottom-0 w-[260px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3.5 border-b border-gray-100">
                <p className="font-extrabold text-[15px] text-ink truncate">{business?.name || 'Business'}</p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{member.role}</p>
              </div>
              {brands.length > 1 && (
                <div className="px-3 pt-3">
                  <select value={brandId || ''} onChange={(e) => setBrandId(e.target.value)}
                    className="w-full bg-band border border-gray-200 rounded-lg px-3 py-2 text-[13px] font-bold text-gray-600 outline-none">
                    {brands.map((b: any) => <option key={b._id} value={b._id}>{b.businessName}</option>)}
                  </select>
                </div>
              )}
              {sidebar}
            </div>
          </div>
        )}

        <main className="px-3 md:px-0 py-4 md:py-0 min-w-0">{children}</main>
      </div>
    </div>
  );
}
