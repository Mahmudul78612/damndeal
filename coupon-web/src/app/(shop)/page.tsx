import Link from 'next/link';
import { apiServer, serverRegion } from '@/lib/server';
import { Campaign, Category, Section, Vendor } from '@/lib/types';
import CouponCard, { BrandMark, CouponTile, CouponRow } from '@/components/CouponCard';
import SpinWheel from '@/components/SpinWheel';
import { ChevronRight, Store, QrCode, BadgePercent } from 'lucide-react';

export const revalidate = 60;

export default async function HomePage() {
  const region = await serverRegion();
  const data = await apiServer<{ sections: Section[] }>('/coupons/home');
  const sections = data?.sections || [];

  return (
    <div>
      <SpinWheel autoOpen />
      {sections.map((s) => (
        <SectionBlock key={s._id} s={s} />
      ))}

      {/* How it works — always at the bottom */}
      <section className="max-w-[1200px] mx-auto px-4 py-14">
        <h2 className="text-xl md:text-2xl font-extrabold text-center">Claim → Show → Save</h2>
        <p className="text-sm text-gray-500 text-center mt-1 mb-8">How DamnDeal Coupons works</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: <BadgePercent size={20} />, t: 'Claim a coupon', d: 'Tap Claim on any deal — you get a unique code and QR saved to your account.' },
            { icon: <QrCode size={20} />, t: 'Show at the counter', d: 'Walk in and show your QR, or use the code on the brand’s website.' },
            { icon: <Store size={20} />, t: 'Vendor verifies', d: 'The business verifies it in seconds — one-time use, no fake coupons.' },
          ].map((x, i) => (
            <div key={i} className="bg-band rounded-2xl p-6">
              <span className="w-10 h-10 rounded-xl bg-primary text-white grid place-items-center mb-3">{x.icon}</span>
              <p className="font-bold text-[15px]">{x.t}</p>
              <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Vendor strip */}
      <section className="max-w-[1200px] mx-auto px-4 pb-4">
        <div className="rounded-2xl bg-ink text-white p-7 md:p-10 flex flex-wrap items-center gap-6 justify-between">
          <div className="max-w-lg">
            <p className="text-amber-300 text-[11px] font-extrabold uppercase tracking-widest mb-2">For brands · clinics · local pros</p>
            <h3 className="text-xl md:text-2xl font-extrabold leading-snug">Bring customers through the door with your own coupon.</h3>
            <p className="text-white/70 text-sm mt-2">List free, verify redemptions from our portal or your own website via API. Pricing in {region === 'US' ? 'USD' : 'INR'}.</p>
          </div>
          <Link href="/list-your-coupon" className="btn-claim px-7 py-3.5 text-[15px]">
            <span className="relative z-10">List your coupon →</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function SectionBlock({ s }: { s: Section }) {
  switch (s.type) {
    case 'top_strip': {
      const d = s.data || {};
      if (!d.text) return null;
      const custom = d.bgColor && d.bgColor !== '#7C3AED';
      return (
        <Link href={d.link || '/coupons'}
          className={`block text-center text-[11.5px] md:text-[13px] font-extrabold text-white py-2 md:py-2.5 px-4 tracking-wide ${custom ? '' : 'brand-grad'}`}
          style={custom ? { background: d.bgColor } : undefined}>
          <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">{d.text}</span>
        </Link>
      );
    }
    case 'hero_banner': {
      const banners = s.data?.banners || [];
      // Admin-managed layout banners only — nothing renders until they're added.
      if (!banners.length) return null;
      return (
        <section className="max-w-[1200px] mx-auto px-4 pt-5">
          <div className={`flex gap-4 overflow-x-auto no-scrollbar snap-x ${banners.length === 1 ? '' : ''}`}>
            {banners.map((b, i) => (
              <Link key={i} href={b.link || '/coupons'}
                className={`snap-start shrink-0 rounded-2xl overflow-hidden shadow-[0_8px_24px_-10px_rgba(236,26,116,0.3)] hover:shadow-[0_14px_34px_-10px_rgba(236,26,116,0.45)] hover:-translate-y-0.5 transition ${banners.length === 1 ? 'w-full' : 'w-[86%] sm:w-[48.5%]'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image.startsWith('http') ? b.image : `/uploads/${b.image.replace(/^\/?uploads\//, '')}`}
                  alt={b.title || 'offer'} className={`w-full object-cover ${banners.length === 1 ? 'aspect-[32/9]' : 'aspect-[21/9]'}`} />
              </Link>
            ))}
          </div>
        </section>
      );
    }
    case 'category_rail': {
      const cats = (s.items || []) as Category[];
      if (!cats.length) return null;
      return (
        <section className="max-w-[1200px] mx-auto px-4 py-4 md:py-6">
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {cats.map((c) => (
              <Link key={c._id} href={`/coupons?category=${c.slug}`}
                className="shrink-0 flex items-center gap-2.5 bg-white border border-gray-200 rounded-full pl-2.5 pr-5 py-2 hover:border-primary hover:shadow-sm transition group">
                <span className="w-8 h-8 rounded-full bg-band grid place-items-center text-[16px]">{c.icon || '🏷️'}</span>
                <span className="text-[13.5px] font-bold text-gray-700 group-hover:text-primary whitespace-nowrap">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      );
    }
    case 'sponsored': {
      const items = (s.items || []) as Campaign[];
      if (!items.length) return null;
      return (
        <section className="max-w-[1200px] mx-auto px-4 py-5 md:py-7">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber-500">◆ Sponsored</p>
              <h2 className="text-xl md:text-[22px] font-extrabold mt-1 head-kick">{s.title || 'Featured coupons'}</h2>
            </div>
            <Link href="/list-your-coupon" className="text-[13px] font-bold text-primary hover:underline whitespace-nowrap">Feature yours <ChevronRight size={13} className="inline" /></Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {items.map((c) => <CouponCard key={c._id} c={c} />)}
          </div>
        </section>
      );
    }
    case 'coupon_grid': {
      const items = (s.items || []) as Campaign[];
      if (!items.length) return null;
      const style = (s.data?.style as string) || 'ticket'; // ticket | tile | list
      return (
        <section className="bg-band py-6 md:py-8 my-4">
          <div className="max-w-[1200px] mx-auto px-4">
            <div className="flex items-end justify-between mb-4">
              <h2 className="text-xl md:text-[22px] font-extrabold head-kick">{s.title || 'All coupons'}</h2>
              <Link href="/coupons" className="text-[13px] font-bold text-primary hover:underline whitespace-nowrap">View all <ChevronRight size={13} className="inline" /></Link>
            </div>
            {style === 'tile' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-5">
                {items.map((c) => <CouponTile key={c._id} c={c} />)}
              </div>
            ) : style === 'list' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((c) => <CouponRow key={c._id} c={c} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {items.map((c) => <CouponCard key={c._id} c={c} />)}
              </div>
            )}
          </div>
        </section>
      );
    }
    case 'brand_row': {
      const items = (s.items || []) as Vendor[];
      if (!items.length) return null;
      return (
        <section className="max-w-[1200px] mx-auto px-4 py-5 md:py-8">
          <h2 className="text-xl font-extrabold mb-4 head-kick">{s.title || 'Popular brands'}</h2>
          <div className="flex gap-6 overflow-x-auto no-scrollbar">
            {items.map((v) => (
              <Link key={v._id} href={`/brands/${v.slug}`} className="shrink-0 flex flex-col items-center gap-2 group w-20">
                <BrandMark name={v.businessName} logo={v.logo} size={56} />
                <span className="text-[11.5px] font-bold text-gray-600 group-hover:text-primary text-center leading-tight line-clamp-2">{v.businessName}</span>
              </Link>
            ))}
          </div>
        </section>
      );
    }
    case 'banner_single': {
      const d = s.data || {};
      if (!d.banners?.[0]?.image && !(d as { image?: string }).image) return null;
      const img = ((d as { image?: string }).image || d.banners?.[0]?.image) as string;
      return (
        <section className="max-w-[1200px] mx-auto px-4 py-4">
          <Link href={(d.link as string) || '/coupons'} className="block rounded-2xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.startsWith('http') ? img : `/uploads/${img.replace(/^\/?uploads\//, '')}`} alt="banner" className="w-full object-cover" />
          </Link>
        </section>
      );
    }
    default:
      return null;
  }
}
