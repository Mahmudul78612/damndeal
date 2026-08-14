'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { api, imgUrl } from '@/lib/api';
import { useCouponMarket } from './layout/CouponMarketLink';
import { ChevronRight, Ticket, Clock } from 'lucide-react';

/**
 * Coupons on the storefront home page.
 *
 * The coupon marketplace runs on a sibling subdomain, but it shares this
 * backend, so the strip is one public call — no cross-origin auth, no SDK.
 * Every card links straight into the marketplace, where the shopper arrives
 * already signed in via the shared-domain session cookie.
 *
 * Counts come from the API, never hard-coded: "more from N brands" is the
 * number of brands that actually have a live coupon right now.
 */
interface Coupon {
  _id: string;
  slug: string;
  title: string;
  offerText: string;
  bannerImage?: string;
  tileImage?: string;
  endAt?: string;
  claimedCount?: number;
  totalQuota?: number;
  vendor?: { businessName?: string; logo?: string; isVerifiedBadge?: boolean };
  category?: { name?: string };
}

export default function CouponStrip() {
  const { enabled, url } = useCouponMarket();
  const [items, setItems] = useState<Coupon[]>([]);
  const [brandCount, setBrandCount] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'empty'>('loading');

  useEffect(() => {
    let alive = true;
    api.get('/coupons/highlights?limit=10')
      .then((r: any) => {
        if (!alive) return;
        const list: Coupon[] = r.items || [];
        setItems(list);
        setBrandCount(r.brandCount || 0);
        setState(list.length ? 'ready' : 'empty');
      })
      .catch(() => { if (alive) setState('empty'); });
    return () => { alive = false; };
  }, []);

  // Hidden until the marketplace is switched on in Settings and there is
  // something real to show — an empty rail looks broken.
  if (!enabled || state !== 'ready') return null;

  return (
    <section className="mt-4 md:mt-6">
      <div className="flex items-end justify-between gap-3 px-3 md:px-4 mb-2.5">
        <div className="min-w-0">
          <h2 className="text-[16px] md:text-[19px] font-bold text-gray-900 flex items-center gap-1.5">
            <Ticket size={17} className="text-primary shrink-0" />
            Coupons &amp; Offers
          </h2>
          <p className="text-[11.5px] md:text-[12.5px] text-gray-500 mt-0.5">
            {brandCount > 0
              ? `Free coupons from ${brandCount} ${brandCount === 1 ? 'brand' : 'brands'} near you`
              : 'Claim a code and save at checkout'}
          </p>
        </div>
        <a href={url} className="shrink-0 text-[12.5px] md:text-[13px] font-semibold text-primary flex items-center gap-0.5 hover:underline">
          View all <ChevronRight size={14} />
        </a>
      </div>

      <div className="flex gap-2.5 md:gap-3 overflow-x-auto no-scrollbar px-3 md:px-4 pb-1 snap-x snap-mandatory">
        {items.map((c) => (
          <CouponCardMini key={c._id} c={c} href={`${url}/c/${c.slug}`} />
        ))}

        {/* Tail card — the real brand count, so it never overstates the catalogue */}
        <a
          href={url}
          className="snap-start shrink-0 w-[128px] md:w-[150px] rounded-xl border border-dashed border-primary/40 bg-primary/5 flex flex-col items-center justify-center gap-1.5 text-center px-3 hover:border-primary transition"
        >
          <span className="w-9 h-9 rounded-full bg-primary/10 grid place-items-center text-primary">
            <ChevronRight size={18} />
          </span>
          <span className="text-[12.5px] font-bold text-gray-900 leading-tight">
            {brandCount > 0 ? `More from ${brandCount} ${brandCount === 1 ? 'brand' : 'brands'}` : 'Browse all coupons'}
          </span>
        </a>
      </div>
    </section>
  );
}

function CouponCardMini({ c, href }: { c: Coupon; href: string }) {
  const img = c.tileImage || c.bannerImage;
  const left = Math.max(0, (c.totalQuota || 0) - (c.claimedCount || 0));
  const endsIn = (() => {
    if (!c.endAt) return '';
    const days = Math.ceil((new Date(c.endAt).getTime() - Date.now()) / 86400000);
    if (days <= 0) return '';
    return days <= 7 ? `${days}d left` : '';
  })();

  return (
    <a
      href={href}
      className="snap-start shrink-0 w-[128px] md:w-[150px] bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div className="relative aspect-[3/4] bg-gray-50">
        {img ? (
          <img src={imgUrl(img)} alt={c.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#EC1A74] via-[#FF7A00] to-[#FFB800] grid place-items-center px-2">
            <span className="text-white font-extrabold text-[15px] text-center leading-tight drop-shadow">
              {c.offerText}
            </span>
          </div>
        )}
        {img && (
          <span className="absolute top-1.5 left-1.5 bg-gradient-to-r from-[#EC1A74] to-[#FF7A00] text-white text-[10.5px] font-bold px-2 py-0.5 rounded-full shadow">
            {c.offerText}
          </span>
        )}
        {endsIn && (
          <span className="absolute bottom-1.5 left-1.5 bg-black/65 text-white text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Clock size={9} /> {endsIn}
          </span>
        )}
      </div>

      <div className="p-2">
        <p className="text-[11.5px] font-semibold text-gray-900 line-clamp-2 leading-snug min-h-[28px]">
          {c.title}
        </p>
        <p className="text-[10.5px] text-gray-500 truncate mt-0.5">
          {c.vendor?.businessName || c.category?.name || ''}
        </p>
        <p className="text-[10px] font-bold text-emerald-600 mt-1">
          {left > 0 ? `${left} left · Free` : 'Free to claim'}
        </p>
      </div>
    </a>
  );
}
