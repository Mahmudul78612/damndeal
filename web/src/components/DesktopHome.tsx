'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { api, imgUrl, IS_US } from '@/lib/api';
import { Category, AppConfig } from '@/lib/types';
import ProductCard from '@/components/ProductCard';

interface DesktopSection {
  _id: string;
  title?: string;
  type: string;
  data?: any;
  items?: any[];
}

function normalizeLinkType(value: any): string {
  return String(value || 'none').trim().toLowerCase();
}

function normalizeLinkValue(value: any): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    return String(value._id || value.id || value.value || '').trim();
  }
  return String(value).trim();
}

function resolveBannerHref(data: any): string {
  const linkType = normalizeLinkType(data?.linkType);
  const raw = data?.linkValue ?? data?.link ?? data?.categoryId ?? data?.subCategoryId ?? data?.productId ?? '';
  const linkValue = normalizeLinkValue(raw);

  if (linkType === 'category' && linkValue) return `/categories/${linkValue}`;
  if (linkType === 'subcategory' && linkValue) return `/subcategory/${linkValue}`;
  if (linkType === 'product' && linkValue) return `/product/${linkValue}`;
  if (linkType === 'url' && linkValue) return linkValue;

  if (linkValue.startsWith('/')) return linkValue;
  if (/^https?:\/\//i.test(linkValue)) return linkValue;
  return '';
}

export default function DesktopHome({ categories, config }: { categories: Category[]; config: AppConfig }) {
  const [sections, setSections] = useState<DesktopSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/user/desktop-home?platform=damndeal')
      .then(res => setSections(res.sections || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DesktopShimmer />;
  if (!sections.length) return null;

  return (
    // US store uses this section system on ALL screens (responsive); India keeps
    // the desktop-only behaviour and its separate mobile home.
    <div className={`${IS_US ? 'block' : 'hidden md:block'} max-w-[1400px] mx-auto px-3 md:px-4 mt-4 space-y-4 pb-8`}>
      {sections.map(section => (
        <DesktopSectionRenderer key={section._id} section={section} />
      ))}
    </div>
  );
}

function DesktopSectionRenderer({ section }: { section: DesktopSection }) {
  const inner = renderInner(section);
  if (!inner) return null;
  return <SectionWrap data={section.data}>{inner}</SectionWrap>;
}

function renderInner(section: DesktopSection) {
  switch (section.type) {
    case 'hero_carousel':
      return <HeroCarousel section={section} />;
    case 'banner_2col':
      return <BannerGrid section={section} cols={2} />;
    case 'banner_3col':
      return <BannerGrid section={section} cols={3} />;
    case 'banner_single':
      return <BannerSingle section={section} />;
    case 'category_products':
      return <CategoryProducts section={section} />;
    case 'product_grid':
      return <ProductGrid section={section} />;
    case 'deal_strip':
      return <DealStrip section={section} />;
    case 'promo_full':
      return <PromoFull section={section} />;
    case 'featured_categories':
      return <FeaturedCategories section={section} />;
    case 'rich_text':
      return <RichText section={section} />;
    case 'image_with_text':
      return <ImageWithText section={section} />;
    case 'trust_badges':
      return <TrustBadges section={section} />;
    case 'newsletter':
      return <Newsletter section={section} />;
    case 'countdown':
      return <Countdown section={section} />;
    case 'testimonials':
      return <Testimonials section={section} />;
    case 'ugc_video':
      return <UgcVideo section={section} />;
    default:
      return null;
  }
}

/* ── Universal design wrapper (Shopify-style per-section controls) ──
   Reads design fields from section.data: bgColor, textColor, paddingY
   (none|sm|md|lg), align (left|center|right), rounded, fullWidth. */
function SectionWrap({ data, children }: { data?: any; children: React.ReactNode }) {
  const d = data || {};
  const padMap: Record<string, string> = { none: 'py-0', sm: 'py-3', md: 'py-6', lg: 'py-10' };
  const alignMap: Record<string, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };
  const pad = padMap[d.paddingY] || '';
  const align = alignMap[d.align] || '';
  const rounded = d.rounded ? 'rounded-2xl' : '';
  const hasBg = !!d.bgColor;

  const style: React.CSSProperties = {};
  if (d.bgColor) style.backgroundColor = d.bgColor;
  if (d.textColor) style.color = d.textColor;

  // Full-bleed band (edge-to-edge) — only meaningful with a background.
  if (d.fullWidth && hasBg) {
    return (
      <div style={{ ...style, marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)', width: '100vw' }} className={pad}>
        <div className={`max-w-[1400px] mx-auto px-4 ${align}`}>{children}</div>
      </div>
    );
  }

  const box = `${pad} ${align} ${rounded} ${hasBg ? 'px-5' : ''}`.replace(/\s+/g, ' ').trim();
  if (!box && !hasBg) return <>{children}</>;
  return <div className={box} style={style}>{children}</div>;
}

/* ── Hero Carousel ── */
function HeroCarousel({ section }: { section: DesktopSection }) {
  const banners = section.items || [];
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => setCurrent(c => (c + 1) % banners.length), 4000);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (!banners.length) return null;

  const b = banners[current];
  const href = resolveBannerHref(b);

  const Wrapper = href ? Link : 'div';
  const wrapperProps = href ? { href } : {};

  return (
    <div className="relative rounded-2xl overflow-hidden">
      <Wrapper {...wrapperProps as any} className="block relative aspect-[3.5/1]">
        <Image
          src={imgUrl(b?.image)}
          alt={b?.title || 'Banner'}
          fill
          className="object-cover transition-opacity duration-500"
          sizes="100vw"
          priority
        />
      </Wrapper>
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {banners.map((_: any, i: number) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white w-5' : 'bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Banner Grid (2 or 3 columns) ── */
function BannerGrid({ section, cols }: { section: DesktopSection; cols: number }) {
  const banners = section.items || section.data?.banners || [];
  if (!banners.length) return null;

  const gridClass = cols === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className={`grid ${gridClass} gap-3`}>
      {banners.slice(0, cols).map((b: any, i: number) => {
        const href = resolveBannerHref(b);
        const card = (
          <div className="relative aspect-[2/1]">
            <Image src={imgUrl(b.image)} alt={b.title || ''} fill className="object-cover" sizes={`${Math.floor(100/cols)}vw`} />
          </div>
        );
        return (
          href ? (
            <Link key={i} href={href} className="block rounded-xl overflow-hidden hover:shadow-lg transition-shadow">{card}</Link>
          ) : (
            <div key={i} className="block rounded-xl overflow-hidden">{card}</div>
          )
        );
      })}
    </div>
  );
}

/* ── Single Full-Width Banner ── */
function BannerSingle({ section }: { section: DesktopSection }) {
  const data = section.data || {};
  const first = section.items?.[0] || {};
  const image = data.image || first.image;
  if (!image) return null;

  // Banner single link can come from data or first banner item in data.banners.
  const href = resolveBannerHref(data) || resolveBannerHref(first);

  return (
    href ? (
      <Link href={href} className="block rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
        <div className="relative aspect-[4/1]">
          <Image src={imgUrl(image)} alt={section.title || ''} fill className="object-cover" sizes="100vw" />
        </div>
      </Link>
    ) : (
      <div className="block rounded-xl overflow-hidden">
        <div className="relative aspect-[4/1]">
          <Image src={imgUrl(image)} alt={section.title || ''} fill className="object-cover" sizes="100vw" />
        </div>
      </div>
    )
  );
}

/* ── Category + Products ── */
function CategoryProducts({ section }: { section: DesktopSection }) {
  const products = section.items || [];
  const cols = section.data?.columns || 5;
  if (!products.length) return null;

  const gridClass = cols <= 3 ? 'grid-cols-2 md:grid-cols-3' : cols === 4 ? 'grid-cols-2 md:grid-cols-4' : cols === 5 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-6';

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-gray-900">{section.title || section.data?.categoryName}</h2>
        {section.data?.categoryId && (
          <Link href={`/categories/${section.data.categoryId}`} className="text-xs text-violet-600 font-semibold hover:underline">
            View All →
          </Link>
        )}
      </div>
      <div className={`grid ${gridClass} gap-3`}>
        {products.map((p: any) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
    </div>
  );
}

/* ── Product Grid ── */
function ProductGrid({ section }: { section: DesktopSection }) {
  const products = section.items || [];
  const cols = section.data?.columns || 5;
  if (!products.length) return null;

  const gridClass = cols <= 3 ? 'grid-cols-2 md:grid-cols-3' : cols === 4 ? 'grid-cols-2 md:grid-cols-4' : cols === 5 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-6';

  return (
    <div>
      {section.title && (
        <h2 className="text-base font-bold text-gray-900 mb-3">{section.title}</h2>
      )}
      <div className={`grid ${gridClass} gap-3`}>
        {products.map((p: any) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
    </div>
  );
}

/* ── Deal Strip ── */
function DealStrip({ section }: { section: DesktopSection }) {
  const products = section.items || [];
  if (!products.length) return null;

  return (
    <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-4">
      {section.title && (
        <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span className="text-lg">⚡</span> {section.title}
        </h2>
      )}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {products.map((p: any) => (
          <div key={p._id} className="shrink-0 w-40">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Promo Full-Width ── */
function PromoFull({ section }: { section: DesktopSection }) {
  const data = section.data || {};
  if (!data.image) return null;

  const href = resolveBannerHref(data);

  const content = (
    <div className="relative aspect-[4/1]" style={{ backgroundColor: data.bgColor || undefined }}>
      <Image src={imgUrl(data.image)} alt={section.title || ''} fill className="object-cover" sizes="100vw" />
    </div>
  );

  return (
    href ? (
      <Link href={href} className="block rounded-xl overflow-hidden hover:shadow-lg transition-shadow">{content}</Link>
    ) : (
      <div className="block rounded-xl overflow-hidden">{content}</div>
    )
  );
}

/* ── Featured Categories ── */
function FeaturedCategories({ section }: { section: DesktopSection }) {
  const cats = section.items || [];
  if (!cats.length) return null;

  return (
    <div>
      {section.title && (
        <h2 className="text-base font-bold text-gray-900 mb-3">{section.title}</h2>
      )}
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {cats.map((cat: any) => (
          <Link key={cat._id} href={`/categories/${cat._id}`} className="flex flex-col items-center gap-1.5 hover:scale-105 transition-transform">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center overflow-hidden">
              {(cat.icon || cat.image) ? (
                <Image src={imgUrl(cat.icon || cat.image)} alt={cat.name} width={48} height={48} className="object-contain w-full h-full" />
              ) : (
                <span className="text-xl">🏷️</span>
              )}
            </div>
            <span className="text-xs font-medium text-center text-gray-700 line-clamp-2">{cat.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Rich Text (heading + paragraph + button) ── */
function RichText({ section }: { section: DesktopSection }) {
  const d = section.data || {};
  const heading = d.heading || section.title;
  if (!heading && !d.text && !d.buttonLabel) return null;
  const href = resolveBannerHref({ linkType: d.buttonLinkType, linkValue: d.buttonLink });
  return (
    <div className="max-w-2xl mx-auto py-2">
      {heading && <h2 className="text-2xl font-extrabold mb-2">{heading}</h2>}
      {d.text && <p className="text-sm opacity-80 leading-relaxed whitespace-pre-line">{d.text}</p>}
      {d.buttonLabel && (
        <Link
          href={href || '#'}
          className="inline-block mt-4 px-6 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
          style={{ backgroundColor: d.buttonColor || '#111827' }}
        >
          {d.buttonLabel}
        </Link>
      )}
    </div>
  );
}

/* ── Image With Text (split layout) ── */
function ImageWithText({ section }: { section: DesktopSection }) {
  const d = section.data || {};
  if (!d.image) return <RichText section={section} />;
  const href = resolveBannerHref({ linkType: d.buttonLinkType, linkValue: d.buttonLink });
  const imageRight = d.imageSide === 'right';
  return (
    <div className={`grid md:grid-cols-2 gap-8 items-center ${imageRight ? 'md:[direction:rtl]' : ''}`}>
      <div className="rounded-2xl overflow-hidden md:[direction:ltr]">
        <Image src={imgUrl(d.image)} alt={d.heading || ''} width={700} height={500} className="w-full h-auto object-cover" />
      </div>
      <div className="md:[direction:ltr]">
        {(d.heading || section.title) && <h2 className="text-2xl font-extrabold mb-3">{d.heading || section.title}</h2>}
        {d.text && <p className="text-sm opacity-80 leading-relaxed whitespace-pre-line">{d.text}</p>}
        {d.buttonLabel && (
          <Link
            href={href || '#'}
            className="inline-block mt-5 px-6 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ backgroundColor: d.buttonColor || '#111827' }}
          >
            {d.buttonLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Trust Badges (icon + title + subtitle row) ── */
function TrustBadges({ section }: { section: DesktopSection }) {
  const badges = (section.data?.badges as any[]) || [];
  if (!badges.length) return null;
  return (
    <div>
      {section.title && <h2 className="text-base font-bold mb-4 text-center">{section.title}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {badges.map((b, i) => (
          <div key={i} className="flex flex-col items-center text-center gap-1.5 px-2">
            <span className="text-3xl">{b.icon || '✅'}</span>
            <span className="text-sm font-bold">{b.title}</span>
            {b.subtitle && <span className="text-xs opacity-70">{b.subtitle}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Newsletter (email signup band) ── */
function Newsletter({ section }: { section: DesktopSection }) {
  const d = section.data || {};
  return (
    <div className="max-w-xl mx-auto text-center py-2">
      <h2 className="text-2xl font-extrabold mb-1.5">{d.heading || section.title || 'Join our newsletter'}</h2>
      {d.text && <p className="text-sm opacity-80 mb-4">{d.text}</p>}
      <form className="flex gap-2 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
        <input
          type="email"
          required
          placeholder={d.placeholder || 'Enter your email'}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
        <button type="submit" className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90" style={{ backgroundColor: d.buttonColor || '#111827' }}>
          {d.buttonLabel || 'Subscribe'}
        </button>
      </form>
    </div>
  );
}

/* ── Countdown (offer timer) ── */
function Countdown({ section }: { section: DesktopSection }) {
  const d = section.data || {};
  const target = d.endTime ? new Date(d.endTime).getTime() : 0;
  const [left, setLeft] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setLeft(Math.max(0, target - Date.now())), 1000);
    return () => clearInterval(t);
  }, [target]);

  if (!target) return <RichText section={section} />;
  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left % 86400000) / 3600000);
  const mins = Math.floor((left % 3600000) / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  const href = resolveBannerHref({ linkType: d.buttonLinkType, linkValue: d.buttonLink });
  const Box = ({ n, l }: { n: number; l: string }) => (
    <div className="flex flex-col items-center">
      <span className="text-2xl md:text-3xl font-extrabold tabular-nums bg-black/10 rounded-lg px-3 py-2 min-w-[58px] text-center">{String(n).padStart(2, '0')}</span>
      <span className="text-[10px] uppercase tracking-wide mt-1 opacity-70">{l}</span>
    </div>
  );

  return (
    <div className="text-center py-2">
      {(d.heading || section.title) && <h2 className="text-2xl font-extrabold mb-1">{d.heading || section.title}</h2>}
      {d.text && <p className="text-sm opacity-80 mb-4">{d.text}</p>}
      <div className="flex items-center justify-center gap-3 md:gap-4">
        {days > 0 && <Box n={days} l="Days" />}
        <Box n={hours} l="Hrs" />
        <Box n={mins} l="Min" />
        <Box n={secs} l="Sec" />
      </div>
      {d.buttonLabel && (
        <Link href={href || '#'} className="inline-block mt-5 px-6 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90" style={{ backgroundColor: d.buttonColor || '#111827' }}>
          {d.buttonLabel}
        </Link>
      )}
    </div>
  );
}

/* ── Testimonials (customer reviews) ── */
function Testimonials({ section }: { section: DesktopSection }) {
  const items = (section.data?.items as any[]) || [];
  if (!items.length) return null;
  return (
    <div>
      {section.title && <h2 className="text-xl font-extrabold mb-5 text-center">{section.title}</h2>}
      <div className="grid md:grid-cols-3 gap-4">
        {items.map((t, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            <div className="text-amber-400 text-sm">{'★'.repeat(Math.max(1, Math.min(5, Number(t.rating) || 5)))}<span className="text-gray-200">{'★'.repeat(5 - Math.max(1, Math.min(5, Number(t.rating) || 5)))}</span></div>
            <p className="text-sm text-gray-700 leading-relaxed flex-1">“{t.text}”</p>
            <div className="flex items-center gap-2.5 pt-1">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">{(t.name?.[0] || 'C').toUpperCase()}</div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-none">{t.name || 'Customer'}</p>
                {t.location && <p className="text-[11px] text-gray-400 mt-0.5">{t.location}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── UGC Video reels (each links to a product/category) ── */
function UgcVideo({ section }: { section: DesktopSection }) {
  const videos = (section.data?.videos as any[]) || [];
  if (!videos.length) return null;
  const ytId = (url: string) => {
    const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    return m ? m[1] : '';
  };
  return (
    <div>
      {section.title && <h2 className="text-xl font-extrabold mb-4">{section.title}</h2>}
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
        {videos.map((v, i) => {
          const href = resolveBannerHref({ linkType: v.linkType, linkValue: v.linkValue });
          const yt = ytId(v.url || '');
          const inner = (
            <div className="relative shrink-0 w-[200px] aspect-[9/16] rounded-2xl overflow-hidden bg-black group">
              {yt ? (
                <iframe className="w-full h-full pointer-events-none" src={`https://www.youtube.com/embed/${yt}?autoplay=1&mute=1&loop=1&controls=0&playlist=${yt}&playsinline=1`} allow="autoplay; encrypted-media" />
              ) : v.url ? (
                <video className="w-full h-full object-cover" src={imgUrl(v.url)} autoPlay muted loop playsInline />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              {v.caption && <span className="absolute bottom-3 left-3 right-3 text-white text-xs font-semibold line-clamp-2">{v.caption}</span>}
              {href && <span className="absolute bottom-3 right-3 bg-white text-gray-900 text-[10px] font-bold px-2 py-1 rounded-full shadow group-hover:scale-105 transition">Shop →</span>}
            </div>
          );
          return href ? <Link key={i} href={href}>{inner}</Link> : <div key={i}>{inner}</div>;
        })}
      </div>
    </div>
  );
}

/* ── Shimmer ── */
function DesktopShimmer() {
  return (
    <div className="hidden md:block max-w-[1400px] mx-auto px-4 mt-4 space-y-4 animate-pulse">
      <div className="h-56 skeleton rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-32 skeleton rounded-xl" />
        <div className="h-32 skeleton rounded-xl" />
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-52 skeleton rounded-xl" />)}
      </div>
    </div>
  );
}
