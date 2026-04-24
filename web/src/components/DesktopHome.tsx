'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { api, imgUrl } from '@/lib/api';
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
    <div className="hidden md:block max-w-[1400px] mx-auto px-4 mt-4 space-y-4 pb-8">
      {sections.map(section => (
        <DesktopSectionRenderer key={section._id} section={section} />
      ))}
    </div>
  );
}

function DesktopSectionRenderer({ section }: { section: DesktopSection }) {
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
    default:
      return null;
  }
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

  const gridClass = cols <= 3 ? 'grid-cols-3' : cols === 4 ? 'grid-cols-4' : cols === 5 ? 'grid-cols-5' : 'grid-cols-6';

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

  const gridClass = cols <= 3 ? 'grid-cols-3' : cols === 4 ? 'grid-cols-4' : cols === 5 ? 'grid-cols-5' : 'grid-cols-6';

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
      <div className="grid grid-cols-6 lg:grid-cols-8 gap-3">
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
