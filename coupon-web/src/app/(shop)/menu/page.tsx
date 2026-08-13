'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { IS_US } from '@/lib/api';
import {
  BadgePercent, Store, Compass, Megaphone, Info, Shield, FileText, Mail,
  ChevronRight, LogOut, User, QrCode,
} from 'lucide-react';

/** App-style menu page (mobile) — profile, links, legal, about. */
export default function MenuPage() {
  const { isLoggedIn, user, openLoginModal, logout } = useAuth();
  const router = useRouter();
  const legalBase = IS_US ? 'https://damndeal.com/legal' : 'https://damndeal.in/legal';

  const Row = ({ href, icon, label, sub, external }: { href: string; icon: React.ReactNode; label: string; sub?: string; external?: boolean }) => {
    const inner = (
      <>
        <span className="w-9 h-9 rounded-xl bg-band grid place-items-center text-primary shrink-0">{icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-bold text-ink">{label}</span>
          {sub && <span className="block text-[11.5px] text-gray-400 truncate">{sub}</span>}
        </span>
        <ChevronRight size={16} className="text-gray-300 shrink-0" />
      </>
    );
    const cls = 'flex items-center gap-3 px-4 py-3 active:bg-band transition';
    return external
      ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
      : <Link href={href} className={cls}>{inner}</Link>;
  };
  const Group = ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <div className="mb-4">
      {title && <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-gray-400 px-1 mb-1.5">{title}</p>}
      <div className="bg-white rounded-2xl border border-[#F0E9FA] shadow-[0_2px_10px_-4px_rgba(91,33,182,0.08)] divide-y divide-gray-50 overflow-hidden">
        {children}
      </div>
    </div>
  );

  return (
    <div className="bg-band min-h-screen">
      <div className="max-w-md mx-auto px-4 py-5">
        {/* Profile card */}
        <div className="relative bg-white rounded-2xl border border-[#F0E9FA] shadow-[0_2px_10px_-4px_rgba(91,33,182,0.08)] p-5 mb-5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 brand-grad" />
          {isLoggedIn ? (
            <div className="flex items-center gap-3.5 mt-1">
              <span className="w-14 h-14 rounded-full brand-grad text-white font-extrabold text-xl grid place-items-center ring-4 ring-band">
                {(user?.name?.[0] || 'U').toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="font-extrabold text-[17px] text-ink truncate">{user?.name || 'DamnDeal user'}</p>
                <p className="text-[12.5px] text-gray-400 truncate">{user?.phone || user?.email}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3.5 mt-1">
              <span className="w-14 h-14 rounded-full bg-band grid place-items-center text-gray-400"><User size={26} /></span>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-[16px] text-ink">Sign in to claim coupons</p>
                <p className="text-[12px] text-gray-400">Your codes & QR, saved in one place</p>
              </div>
              <button onClick={() => openLoginModal('/menu')} className="btn-claim px-5 py-2 text-[13px] shrink-0">
                <span className="relative z-10">Sign in</span>
              </button>
            </div>
          )}
        </div>

        <Group title="My stuff">
          <Row href="/my-coupons" icon={<BadgePercent size={18} />} label="My Coupons" sub="Claimed codes & QR" />
          <Row href="/vendor" icon={<Store size={18} />} label="Vendor Portal" sub="Manage your business coupons" />
        </Group>

        <Group title="Explore">
          <Row href="/coupons" icon={<Compass size={18} />} label="Browse all coupons" />
          <Row href="/list-your-coupon" icon={<Megaphone size={18} />} label="List your coupon" sub="Free for brands, clinics & shops" />
        </Group>

        <Group title="About & help">
          <Row href="/list-your-coupon#api" icon={<QrCode size={18} />} label="How verification works" sub="Unique codes, QR, one-time use" />
          <Row href="mailto:info@damndeal.in" external icon={<Mail size={18} />} label="Contact us" sub="info@damndeal.in" />
          <Row href={`${legalBase}/privacy`} external icon={<Shield size={18} />} label="Privacy Policy" />
          <Row href={`${legalBase}/terms`} external icon={<FileText size={18} />} label="Terms & Conditions" />
        </Group>

        <Group>
          <div className="flex items-start gap-3 px-4 py-3.5">
            <span className="w-9 h-9 rounded-xl bg-band grid place-items-center text-primary shrink-0"><Info size={18} /></span>
            <p className="text-[12px] text-gray-500 leading-relaxed">
              <b className="text-ink">DamnDeal Coupons</b> — the coupon marketplace for local brands, clinics, salons and stores.
              Claim a unique code, show the QR, save instantly. Part of the DamnDeal family.
            </p>
          </div>
        </Group>

        {isLoggedIn && (
          <button onClick={() => { logout(); router.push('/'); }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white border border-red-100 text-red-500 font-extrabold text-[14px] active:scale-[0.99] transition mb-4">
            <LogOut size={16} /> Logout
          </button>
        )}

        <p className="text-center text-[10.5px] text-gray-400 pb-4">
          © {new Date().getFullYear()} DamnDeal India Pvt Ltd · damndeal.in · damndeal.com
        </p>
      </div>
    </div>
  );
}
