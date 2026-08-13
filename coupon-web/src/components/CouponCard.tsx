import Link from 'next/link';
import { Campaign } from '@/lib/types';
import { BadgeCheck, ChevronRight } from 'lucide-react';

/* Card styles: "ticket" (default), "tile" (3:4 voucher grid), "list" (compact rows).
   Admin picks per homepage section. All open the detail page. */

const up = (p?: string) => (p ? (p.startsWith('http') ? p : `/uploads/${p.replace(/^\/?uploads\//, '')}`) : '');

/** Brand avatar: logo image or initials circle. */
export function BrandMark({ name, logo, size = 40, ring = false }: { name?: string; logo?: string; size?: number; ring?: boolean }) {
  const initials = (name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const ringCls = ring ? 'ring-4 ring-white shadow-md' : '';
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={up(logo)} alt={name || ''} width={size} height={size}
      className={`rounded-full object-cover bg-white shrink-0 ${ringCls}`} style={{ width: size, height: size }} />;
  }
  return (
    <span className={`rounded-full brand-grad text-white font-extrabold grid place-items-center shrink-0 ${ringCls}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {initials}
    </span>
  );
}

/** Voucher tile — portrait 3:4 image, name + category + green offer below (gift-card style). */
export function CouponTile({ c }: { c: Campaign }) {
  return (
    <Link href={`/c/${c.slug}`} className="group block">
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_4px_16px_-6px_rgba(42,27,94,0.25)] group-hover:shadow-[0_14px_30px_-8px_rgba(42,27,94,0.4)] group-hover:-translate-y-1 transition-all duration-200">
        {(c.tileImage || c.bannerImage) ? (
          // Prefer the 3:4 crop here; fall back to the wide one for older coupons.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={up(c.tileImage || c.bannerImage)} alt={c.title} className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-300" />
        ) : (
          <div className="w-full h-full brand-grad relative flex flex-col items-center justify-center gap-2 p-3">
            <BrandMark name={c.vendor?.businessName} logo={c.vendor?.logo} size={54} ring />
            <span className="text-white font-extrabold text-[22px] leading-tight text-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.3)]">{c.offerText}</span>
            <span className="absolute -right-4 -bottom-6 text-white/10 font-extrabold text-[110px] leading-none select-none">%</span>
          </div>
        )}
        {c.featured?.active && (
          <span className="absolute top-2 right-2 bg-[#FFE066] text-[#7A5A00] text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full shadow">★</span>
        )}
      </div>
      <div className="pt-2.5 px-0.5">
        <p className="font-extrabold text-[14px] text-ink leading-tight truncate flex items-center gap-1">
          {c.vendor?.businessName}
          {c.vendor?.isVerifiedBadge && <BadgeCheck size={13} className="text-emerald-500 shrink-0" />}
        </p>
        {c.category?.name && <p className="text-[11.5px] text-gray-400 font-semibold mt-0.5 truncate">{c.category.name}</p>}
        <p className="text-[14px] font-extrabold text-emerald-600 mt-0.5">{c.offerText}</p>
      </div>
    </Link>
  );
}

/** Compact list row — logo left, title middle, offer right. */
export function CouponRow({ c }: { c: Campaign }) {
  return (
    <Link href={`/c/${c.slug}`}
      className="group flex items-center gap-3.5 bg-white border border-[#F0E9FA] rounded-2xl px-4 py-3 shadow-[0_2px_8px_-4px_rgba(91,33,182,0.08)] hover:shadow-[0_10px_24px_-8px_rgba(91,33,182,0.25)] hover:-translate-y-0.5 transition-all">
      <BrandMark name={c.vendor?.businessName} logo={c.vendor?.logo} size={46} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-extrabold text-primary truncate flex items-center gap-1">
          {c.vendor?.businessName}
          {c.vendor?.isVerifiedBadge && <BadgeCheck size={12} className="text-emerald-500 shrink-0" />}
        </p>
        <p className="font-bold text-[13.5px] text-ink leading-snug truncate">{c.title}</p>
        <p className="text-[10.5px] text-gray-400 font-semibold">{c.claimedCount.toLocaleString()} claimed · till {new Date(c.endAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="brand-grad-text font-extrabold text-[16px] leading-tight whitespace-nowrap">{c.offerText}</p>
        <span className="inline-flex items-center text-[11px] font-extrabold text-primary group-hover:gap-1 transition-all">View <ChevronRight size={12} /></span>
      </div>
    </Link>
  );
}

/**
 * Brand-forward coupon card — the whole card opens the detail page
 * (claiming happens there, e-commerce style).
 */
export default function CouponCard({ c }: { c: Campaign }) {
  const left = Math.max(0, (c.totalQuota || 0) - (c.claimedCount || 0));
  const ends = new Date(c.endAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <Link href={`/c/${c.slug}`}
      className="group relative bg-white border border-[#F0E9FA] rounded-2xl overflow-hidden shadow-[0_2px_10px_-4px_rgba(91,33,182,0.08)] hover:shadow-[0_14px_30px_-10px_rgba(91,33,182,0.25)] hover:-translate-y-1 transition-all duration-200 flex flex-col">
      {/* Banner / brand band */}
      <div className="relative h-[96px] md:h-[112px] overflow-hidden">
        {c.bannerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={up(c.bannerImage)} alt="" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300" />
        ) : (
          <div className="w-full h-full brand-grad relative">
            <span className="absolute inset-0 grid place-items-center text-white/95 font-extrabold text-[26px] md:text-3xl tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
              {c.offerText}
            </span>
            <span className="absolute -right-5 -bottom-7 text-white/15 font-extrabold text-[90px] leading-none select-none">%</span>
          </div>
        )}
        {/* Offer badge (on image banners) */}
        {c.bannerImage && (
          <span className="absolute top-2.5 left-2.5 brand-grad text-white text-[13px] font-extrabold px-3 py-1 rounded-full shadow">
            {c.offerText}
          </span>
        )}
        {c.featured?.active && (
          <span className="absolute top-2.5 right-2.5 bg-[#FFE066] text-[#7A5A00] text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full shadow">
            ★ Sponsored
          </span>
        )}
      </div>

      {/* Brand logo overlapping */}
      <div className="px-4 -mt-6 relative z-10 flex items-end justify-between">
        <BrandMark name={c.vendor?.businessName} logo={c.vendor?.logo} size={52} ring />
        <span className="text-[10.5px] font-bold text-gray-400 mb-1">Valid till {ends}</span>
      </div>

      {/* Body */}
      <div className="px-4 pt-2 pb-3 flex-1 flex flex-col">
        <p className="text-[12.5px] font-extrabold text-primary flex items-center gap-1">
          {c.vendor?.businessName}
          {c.vendor?.isVerifiedBadge && <BadgeCheck size={13} className="text-emerald-500 shrink-0" />}
          {c.category?.name && <span className="ml-auto text-[10px] font-bold text-gray-400 uppercase tracking-wide">{c.category.name}</span>}
        </p>
        <h3 className="font-bold text-[14.5px] leading-snug mt-1 line-clamp-2 text-ink">{c.title}</h3>

        {/* Ticket footer */}
        <div className="mt-auto pt-3 relative">
          <div className="coupon-dash-h" />
          <span className="notch-l" style={{ top: -8 }} />
          <span className="notch-r" style={{ top: -8 }} />
          <div className="flex items-center justify-between pt-2.5">
            <span className="text-[11px] font-bold text-gray-400">
              {c.claimedCount.toLocaleString()} claimed{left > 0 && left <= 50 ? ` · ${left} left!` : ''}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[12.5px] font-extrabold text-primary group-hover:gap-1.5 transition-all">
              View &amp; Claim <ChevronRight size={14} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
