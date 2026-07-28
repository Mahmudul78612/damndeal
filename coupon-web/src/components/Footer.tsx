import Link from 'next/link';
import { MapPin, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="hidden md:block mt-16">
      {/* ── Vendor CTA band ── */}
      <div className="brand-grad">
        <div className="max-w-[1200px] mx-auto px-4 py-9 flex flex-wrap items-center gap-5 justify-between">
          <div>
            <p className="text-white font-extrabold text-[21px] md:text-[24px] leading-tight drop-shadow-sm">
              Apna business hai? Coupon lagao, customers pao. 🎟️
            </p>
            <p className="text-white/85 text-[13.5px] font-semibold mt-1">
              Free listing · unique QR codes · portal ya API se verify — 2 minute mein live.
            </p>
          </div>
          <Link href="/list-your-coupon" className="btn-claim px-8 py-3.5 text-[15px] shrink-0">
            <span className="relative z-10">List your coupon →</span>
          </Link>
        </div>
      </div>

      {/* ── Main footer ── */}
      <div className="bg-ink text-white/65">
        <div className="max-w-[1200px] mx-auto px-4 py-12 grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="DamnDeal Coupons" className="h-[52px] w-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]" />
            </div>
            <p className="text-[13.5px] leading-relaxed max-w-sm">
              The coupon marketplace for local brands, clinics, salons and stores.
              Claim a unique code, show the QR, save instantly.
            </p>
            <div className="flex flex-col gap-1.5 mt-4 text-[12.5px]">
              <span className="flex items-center gap-2"><MapPin size={13} className="text-[#FFC93C]" /> Patiala, Punjab, India</span>
              <a href="mailto:info@damndeal.in" className="flex items-center gap-2 hover:text-white"><Mail size={13} className="text-[#FFC93C]" /> info@damndeal.in</a>
            </div>
          </div>
          <div>
            <p className="text-white font-extrabold text-[13px] uppercase tracking-wider mb-4">Explore</p>
            <ul className="space-y-2.5 text-[13.5px] font-medium">
              <li><Link href="/coupons" className="hover:text-[#FFC93C] transition">All coupons</Link></li>
              <li><Link href="/coupons?sort=ending" className="hover:text-[#FFC93C] transition">Ending soon</Link></li>
              <li><Link href="/my-coupons" className="hover:text-[#FFC93C] transition">My coupons</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-extrabold text-[13px] uppercase tracking-wider mb-4">For business</p>
            <ul className="space-y-2.5 text-[13.5px] font-medium">
              <li><Link href="/list-your-coupon" className="hover:text-[#FFC93C] transition">List your coupon</Link></li>
              <li><Link href="/vendor" className="hover:text-[#FFC93C] transition">Vendor portal</Link></li>
              <li><Link href="/list-your-coupon#pricing" className="hover:text-[#FFC93C] transition">Coupon packs & pricing</Link></li>
              <li><Link href="/list-your-coupon#api" className="hover:text-[#FFC93C] transition">Verification API</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-[1200px] mx-auto px-4 py-4 text-[12px] flex flex-wrap gap-3 justify-between items-center">
            <span>© {new Date().getFullYear()} DamnDeal India Pvt Ltd. All rights reserved.</span>
            <span className="flex items-center gap-1.5">
              Part of the <a href="https://damndeal.in" className="font-bold brand-grad-text">DamnDeal</a> family — damndeal.in · damndeal.com
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
