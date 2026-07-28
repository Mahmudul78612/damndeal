import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiServer } from '@/lib/server';
import { Campaign } from '@/lib/types';
import { BrandMark } from '@/components/CouponCard';
import ClaimButton from '@/components/ClaimButton';
import { BadgeCheck, CalendarDays, Globe, MapPin, Users, ShieldCheck, ListChecks, Info, FileText, Store } from 'lucide-react';

export const revalidate = 60;

type P = Promise<{ slug: string }>;
const up = (p?: string) => (p ? (p.startsWith('http') ? p : `/uploads/${p.replace(/^\/?uploads\//, '')}`) : '');

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { slug } = await params;
  const res = await apiServer<{ campaign: Campaign & { instructions?: string } }>(`/coupons/c/${slug}`);
  const c = res?.campaign;
  if (!c) return { title: 'Coupon not found' };
  return {
    title: `${c.offerText} — ${c.title}`,
    description: (c.description || `Claim ${c.offerText} at ${c.vendor?.businessName} on DamnDeal Coupons.`).slice(0, 155),
    openGraph: { title: `${c.offerText} · ${c.vendor?.businessName}`, description: c.description?.slice(0, 200), images: c.bannerImage ? [up(c.bannerImage)] : undefined },
  };
}

export default async function CouponDetail({ params }: { params: P }) {
  const { slug } = await params;
  const res = await apiServer<{ campaign: Campaign & { instructions?: string } }>(`/coupons/c/${slug}`);
  const c = res?.campaign;
  if (!c) notFound();

  const left = Math.max(0, (c.totalQuota || 0) - (c.claimedCount || 0));
  const ends = new Date(c.endAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const steps = (c.instructions || '').split('\n').map(s => s.trim()).filter(Boolean);
  const defaultSteps = c.isOnline
    ? ['Claim Coupon dabao — aapko unique code milega', 'Brand ki website kholo (button niche milega)', 'Checkout par code apply karo aur save karo']
    : ['Claim Coupon dabao — unique code + QR milega', 'Store par jao aur counter par QR/code dikhao', 'Vendor verify karega — offer turant apply hoga'];

  const ld = {
    '@context': 'https://schema.org', '@type': 'Offer',
    name: c.title, description: c.description,
    seller: { '@type': 'Organization', name: c.vendor?.businessName },
    validThrough: c.endAt, availability: left > 0 ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
  };

  return (
    <div className="bg-band min-h-screen pb-24 md:pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <div className="max-w-[1040px] mx-auto px-4 pt-4">
        <nav className="text-[12px] text-gray-400 mb-3">
          <Link href="/" className="hover:text-primary">Home</Link> <span className="mx-1">›</span>
          <Link href={`/coupons?category=${c.category?.slug || ''}`} className="hover:text-primary">{c.category?.name || 'Coupons'}</Link> <span className="mx-1">›</span>
          <span className="text-gray-600 font-semibold">{c.vendor?.businessName}</span>
        </nav>

        <div className="grid md:grid-cols-[1fr_330px] gap-5 items-start">
          {/* ── LEFT: banner → logo → brand → description → instructions → terms ── */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_20px_-8px_rgba(91,33,182,0.15)]">
            {/* Banner */}
            <div className="relative h-[180px] md:h-[240px] overflow-hidden">
              {c.bannerImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={up(c.bannerImage)} alt={c.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full brand-grad relative">
                  <span className="absolute -right-6 -bottom-14 text-white/15 font-extrabold text-[200px] leading-none select-none">%</span>
                  <span className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 text-white font-extrabold text-3xl md:text-5xl drop-shadow-[0_3px_8px_rgba(0,0,0,0.28)] max-w-[70%] leading-tight">
                    {c.offerText}
                  </span>
                </div>
              )}
              {c.featured?.active && (
                <span className="absolute top-3 left-3 bg-[#FFE066] text-[#7A5A00] text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full shadow">★ Sponsored</span>
              )}
              {/* Offer tag — anchored to the banner's bottom-right */}
              <span className="absolute bottom-3 right-3 md:bottom-4 md:right-4 bg-white text-transparent brand-grad-text font-extrabold text-[15px] md:text-[17px] px-4 py-1.5 rounded-full shadow-[0_6px_18px_-4px_rgba(0,0,0,0.35)] border-2 border-[#FFE066]">
                {c.offerText}
              </span>
            </div>

            {/* Brand block (logo overlapping) */}
            <div className="px-5 md:px-7">
              <div className="-mt-9 relative z-10">
                <BrandMark name={c.vendor?.businessName} logo={c.vendor?.logo} size={76} ring />
              </div>

              <div className="mt-3 pb-4 border-b border-gray-100">
                <h2 className="font-extrabold text-[18px] text-ink flex items-center gap-1.5 flex-wrap">
                  {c.vendor?.businessName}
                  {c.vendor?.isVerifiedBadge && <BadgeCheck size={17} className="text-emerald-500" />}
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-primary bg-primary-light rounded-full px-2.5 py-1 ml-1">
                    {c.category?.name}
                  </span>
                </h2>
                {c.vendor?.description && <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">{c.vendor.description}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5 text-[12.5px] text-gray-500">
                  {c.vendor?.address && <span className="flex items-center gap-1.5"><MapPin size={13} className="text-pink" /> {c.vendor.address}</span>}
                  {c.vendor?.website && <a href={c.vendor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary"><Globe size={13} className="text-pink" /> Website</a>}
                  <Link href={`/brands/${c.vendor?.slug}`} className="flex items-center gap-1.5 text-primary font-bold hover:underline"><Store size={13} /> All offers from this brand</Link>
                </div>
              </div>

              {/* Offer title + description */}
              <div className="py-5">
                <h1 className="text-[21px] md:text-[24px] font-extrabold leading-snug text-ink">{c.title}</h1>
                {c.description && (
                  <div className="mt-3 flex gap-2.5">
                    <Info size={16} className="text-primary shrink-0 mt-0.5" />
                    <p className="text-[14px] text-gray-600 leading-relaxed whitespace-pre-line">{c.description}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-4 mt-4 text-[12.5px] font-semibold text-gray-500">
                  <span className="flex items-center gap-1.5 bg-band rounded-full px-3 py-1.5"><CalendarDays size={14} className="text-orange" /> Valid till {ends}</span>
                  <span className="flex items-center gap-1.5 bg-band rounded-full px-3 py-1.5"><Users size={14} className="text-orange" /> {c.claimedCount.toLocaleString()} claimed</span>
                  <span className="flex items-center gap-1.5 bg-band rounded-full px-3 py-1.5">
                    {c.isOnline ? <><Globe size={14} className="text-orange" /> Online offer</> : <><MapPin size={14} className="text-orange" /> In-store</>}
                  </span>
                </div>
              </div>

              {/* How to redeem */}
              <div className="pb-5">
                <h3 className="flex items-center gap-2 font-extrabold text-[15px] text-ink mb-3">
                  <ListChecks size={17} className="text-primary" /> How to redeem
                </h3>
                <ol className="space-y-2.5">
                  {(steps.length ? steps : defaultSteps).map((s, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="w-6 h-6 rounded-full brand-grad text-white text-[12px] font-extrabold grid place-items-center shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-[13.5px] text-gray-600 leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Terms */}
              {c.terms && (
                <div className="mb-6 bg-band rounded-xl p-4">
                  <p className="flex items-center gap-2 font-extrabold text-[12px] uppercase tracking-wide text-gray-500 mb-1.5"><FileText size={13} /> Terms &amp; conditions</p>
                  <p className="text-[12.5px] text-gray-500 leading-relaxed whitespace-pre-line">{c.terms}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: e-commerce claim box (sticky) ── */}
          <aside className="md:sticky md:top-24 relative bg-white rounded-2xl p-6 shadow-[0_10px_36px_-12px_rgba(236,26,116,0.3)] text-center border-2 border-[#FFE066]">
            <div className="absolute top-0 left-0 right-0 h-1.5 brand-grad rounded-t-2xl" />
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mt-1">This coupon</p>
            <p className="brand-grad-text font-extrabold text-4xl leading-tight mt-1">{c.offerText}</p>
            <p className="text-[12.5px] font-bold text-gray-500 mt-1.5">
              {left > 0 ? `🔥 ${left.toLocaleString()} coupons left` : 'All claimed'} · 1 per user
            </p>

            <div className="my-5 coupon-dash-h relative">
              <span className="notch-l" style={{ top: -8, background: '#fff' }} />
              <span className="notch-r" style={{ top: -8, background: '#fff' }} />
            </div>

            <ClaimButton campaign={c} big />
            <p className="mt-3 text-[11px] text-gray-400 flex items-center justify-center gap-1">
              <ShieldCheck size={12} className="text-emerald-500" /> Unique code + QR · one-time use · vendor verified
            </p>
          </aside>
        </div>
      </div>

      {/* Mobile sticky claim bar */}
      <div className="fixed md:hidden bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="min-w-0">
          <p className="brand-grad-text font-extrabold text-[18px] leading-none">{c.offerText}</p>
          <p className="text-[10.5px] text-gray-400 font-bold truncate mt-0.5">{c.vendor?.businessName}</p>
        </div>
        <div className="ml-auto shrink-0"><ClaimButton campaign={c} /></div>
      </div>
    </div>
  );
}
