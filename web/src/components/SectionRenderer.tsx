'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { imgUrl } from '@/lib/api';
import { HomeSection } from '@/lib/types';
import ProductCard from '@/components/ProductCard';
import { LayoutGrid } from 'lucide-react';

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

function bannerHref(b: any): string {
  const linkType = normalizeLinkType(b?.linkType || b?.data?.linkType);
  const rawValue = b?.linkValue ?? b?.data?.linkValue ?? b?.categoryId ?? b?.subCategoryId ?? b?.productId ?? b?.link ?? '';
  const linkValue = normalizeLinkValue(rawValue);

  if (linkType === 'category' && linkValue) return `/categories/${linkValue}`;
  if (linkType === 'subcategory' && linkValue) return `/subcategory/${linkValue}`;
  if (linkType === 'product' && linkValue) return `/product/${linkValue}`;
  if (linkType === 'url' && linkValue) return linkValue;

  // Backward compatibility where direct URL/product/category path is stored in `link`
  if (linkValue.startsWith('/')) return linkValue;
  if (/^https?:\/\//i.test(linkValue)) return linkValue;

  return '';
}

/* ── Banner Carousel ── */
function BannerCarousel({ section }: { section: HomeSection }) {
  const banners = section.items || [];
  if (!banners.length) return null;
  return (
    <div className="relative overflow-x-auto no-scrollbar snap-x snap-mandatory flex gap-2 px-4 md:px-0">
      {banners.map((b: any, i: number) => (
        (() => {
          const href = bannerHref(b);
          const cls = 'snap-start shrink-0 w-[calc(100vw-2rem)] md:w-[48%] lg:w-[32%] rounded-xl overflow-hidden';
          if (!href) {
            return (
              <div key={b._id || i} className={cls}>
                <div className="relative aspect-[2/1]">
                  <Image src={imgUrl(b.image)} alt={b.title || 'Banner'} fill className="object-cover" sizes="85vw" />
                </div>
              </div>
            );
          }
          return (
            <Link key={b._id || i} href={href} className={cls}>
              <div className="relative aspect-[2/1]">
                <Image src={imgUrl(b.image)} alt={b.title || 'Banner'} fill className="object-cover" sizes="85vw" />
              </div>
            </Link>
          );
        })()
      ))}
    </div>
  );
}

/* ── Square Banners (2x2) ── */
function SquareBanners({ section }: { section: HomeSection }) {
  const items = section.items || [];
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 px-4 md:px-0 md:grid-cols-4">
      {items.slice(0, 4).map((b: any, i: number) => (
        (() => {
          const href = bannerHref(b);
          if (!href) {
            return (
              <div key={i} className="rounded-xl overflow-hidden">
                <div className="relative aspect-square">
                  <Image src={imgUrl(b.image)} alt={b.title || ''} fill className="object-cover" sizes="50vw" />
                </div>
              </div>
            );
          }
          return (
            <Link key={i} href={href} className="rounded-xl overflow-hidden">
              <div className="relative aspect-square">
                <Image src={imgUrl(b.image)} alt={b.title || ''} fill className="object-cover" sizes="50vw" />
              </div>
            </Link>
          );
        })()
      ))}
    </div>
  );
}

/* ── Category Grid / Strip ── */
function CategoryGrid({ section }: { section: HomeSection }) {
  const categories = section.items || [];
  if (!categories.length) return null;

  return (
    <div className="px-4 md:px-0">
      {section.title && (
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs md:text-sm font-bold text-gray-900">{section.title}</h2>
          <Link href="/categories" className="text-[10px] md:text-xs font-semibold text-violet-600 hover:underline">View All</Link>
        </div>
      )}

      <div className="flex md:grid md:grid-cols-8 gap-3 md:gap-4 overflow-x-auto no-scrollbar pb-2">
        <Link href="/categories" className="shrink-0 flex flex-col items-center gap-1.5 w-16 md:w-auto">
          <div className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-2xl overflow-hidden flex items-center justify-center border-2 border-gray-200 bg-white">
            <LayoutGrid size={24} className="text-gray-600" />
          </div>
          <span className="text-[10px] md:text-xs font-medium text-center leading-tight line-clamp-2 text-gray-800">All</span>
        </Link>

        {categories.map((cat: any, i: number) => (
          <Link key={cat._id || i} href={`/categories/${cat._id}`} className="shrink-0 flex flex-col items-center gap-1.5 w-16 md:w-auto">
            <div className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-2xl overflow-hidden flex items-center justify-center bg-violet-50">
              {(cat.icon || cat.image) ? (
                <Image src={imgUrl(cat.icon || cat.image || '')} alt={cat.name || 'Category'} width={56} height={56} className="object-contain w-full h-full" />
              ) : (
                <span className="text-lg">🏷️</span>
              )}
            </div>
            <span className="text-[10px] md:text-xs font-medium text-center leading-tight line-clamp-2 text-gray-800">
              {cat.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SectionSeeAllBar({ section }: { section: HomeSection }) {
  const showSeeAll = section.data?.showSeeAll !== false;
  const categoryId = section.data?.categoryId;
  const items = (section.items || []).slice(0, 4);
  if (!showSeeAll || !categoryId || !items.length) return null;

  return (
    <Link href={`/categories/${categoryId}`} className="block px-4 md:px-0 mt-2 mb-3">
      <div className="relative h-6 rounded-xl border border-gray-200 bg-gray-50">
        <div className="h-full flex items-center justify-center gap-2 text-[11px] font-semibold text-gray-600">
          <div className="flex items-center">
            {items.map((p: any, i: number) => {
              const img = p?.images?.[0];
              return (
                <span
                  key={p._id || i}
                  className="relative w-5 h-5 rounded-full overflow-hidden border border-white"
                  style={{ marginLeft: i === 0 ? 0 : -6 }}
                >
                  {img ? (
                    <Image src={imgUrl(img)} alt="" fill className="object-cover" sizes="20px" />
                  ) : (
                    <span className="block w-full h-full bg-gray-200" />
                  )}
                </span>
              );
            })}
          </div>
          <span>View All</span>
        </div>
      </div>
    </Link>
  );
}

/* ── Horizontal Product Scroll ── */
function HorizontalProducts({ section }: { section: HomeSection }) {
  const products = section.items || [];
  const cardWidth = Math.max(96, Math.min(220, parseInt(section.data?.itemWidth, 10) || 128));
  if (!products.length) return null;
  return (
    <div>
      {section.title && (
        <h2 className="text-sm font-bold text-gray-900 px-4 md:px-0 mb-2">{section.title}</h2>
      )}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 md:px-0 pb-1">
        {products.map((p: any) => (
          <div key={p._id} className="shrink-0" style={{ minWidth: `${cardWidth}px`, width: `${cardWidth}px` }}>
            <ProductCard product={p} />
          </div>
        ))}
      </div>
      <SectionSeeAllBar section={section} />
    </div>
  );
}

/* ── Grid Products ── */
function GridProducts({ section }: { section: HomeSection }) {
  const products = section.items || [];
  const layout = section.data?.layout || 'grid';
  const columns = Math.max(1, Math.min(5, parseInt(section.data?.columns, 10) || 2));
  const mobileColumns = Math.max(2, Math.min(4, parseInt(section.data?.mobileColumns, 10) || 3));
  const [showAllMobile, setShowAllMobile] = useState(false);
  if (!products.length) return null;

  if (layout === 'list') {
    return (
      <div>
        {section.title && (
          <h2 className="text-sm font-bold text-gray-900 px-4 md:px-0 mb-2">{section.title}</h2>
        )}
        <div className="px-4 md:px-0 space-y-2">
          {products.map((p: any) => (
            <div key={p._id} className="rounded-xl overflow-hidden bg-white border border-gray-100">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {section.title && (
        <h2 className="text-sm font-bold text-gray-900 px-4 md:px-0 mb-2">{section.title}</h2>
      )}
      <div className="grid gap-2 px-4 md:px-0 md:hidden" style={{ gridTemplateColumns: `repeat(${mobileColumns}, minmax(0, 1fr))` }}>
        {(showAllMobile ? products : products.slice(0, 6)).map((p: any) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
      {!showAllMobile && products.length > 6 && (
        <button
          onClick={() => setShowAllMobile(true)}
          className="w-[calc(100%-2rem)] mx-4 mt-2 h-8 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 md:hidden"
        >
          View All
        </button>
      )}
      <div className="hidden md:grid gap-2 px-4 md:px-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {products.map((p: any) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
      <div className="hidden md:block">
        <SectionSeeAllBar section={section} />
      </div>
    </div>
  );
}

/* ── Promo Section (cards overlay on banner) ── */
function PromoSection({ section }: { section: HomeSection }) {
  const items = section.items || [];
  const bgImage = section.bgImage || section.data?.bgImage;
  const bgColor = section.bgColor || section.data?.bgColor || '#EDE9FE';

  return (
    <div className="relative rounded-xl overflow-hidden mx-4 md:mx-0" style={{ backgroundColor: bgColor }}>
      {bgImage && (
        <Image src={imgUrl(bgImage)} alt="" fill className="object-cover" sizes="100vw" />
      )}
      <div className="relative z-10 p-3">
        {section.title && (
          <h2 className="text-sm font-bold text-gray-900 mb-2">{section.title}</h2>
        )}
        <div className="grid grid-cols-4 gap-1.5">
          {items.slice(0, 4).map((item: any, i: number) => (
            (() => {
              const href = bannerHref(item) || (item.categoryId ? `/categories/${item.categoryId}` : '');
              if (!href) {
                return (
                  <div key={item._id || item.categoryId || i} className="rounded-lg overflow-hidden">
                    <div className="relative aspect-[3/4]">
                      <Image src={imgUrl(item.image)} alt={item.title || ''} fill className="object-cover" sizes="25vw" />
                    </div>
                  </div>
                );
              }
              return (
                <Link key={item._id || item.categoryId || i} href={href} className="rounded-lg overflow-hidden">
                  <div className="relative aspect-[3/4]">
                    <Image src={imgUrl(item.image)} alt={item.title || ''} fill className="object-cover" sizes="25vw" />
                  </div>
                </Link>
              );
            })()
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Custom Banner (full-width single image) ── */
function CustomBanner({ section }: { section: HomeSection }) {
  const b = section.data || section.items?.[0];
  if (!b?.image) return null;

  const href = bannerHref(b);
  const content = (
    <div className="relative aspect-[3/1] md:aspect-[4/1]">
      <Image src={imgUrl(b.image)} alt={b.title || 'Banner'} fill className="object-cover" sizes="100vw" />
    </div>
  );

  return (
    <div className="px-4 md:px-0">
      {href ? (
        <Link href={href} className="block rounded-xl overflow-hidden">
          {content}
        </Link>
      ) : (
        <div className="block rounded-xl overflow-hidden">{content}</div>
      )}
    </div>
  );
}

/* ── Section Router ── */
export default function SectionRenderer({ section }: { section: HomeSection }) {
  switch (section.type) {
    case 'banner_carousel':
    case 'hero_carousel':
      return <BannerCarousel section={section} />;
    case 'category_grid':
    case 'featured_categories':
      return <CategoryGrid section={section} />;
    case 'square_banners':
    case 'banner_2col':
    case 'banner_3col':
      return <SquareBanners section={section} />;
    case 'horizontal_products':
    case 'popular_products':
    case 'deal_strip':
      return <HorizontalProducts section={section} />;
    case 'grid_products':
    case 'deal_of_day':
    case 'category_section':
    case 'product_grid':
    case 'category_products':
      return <GridProducts section={section} />;
    case 'promo_section':
    case 'promo_full':
      return <PromoSection section={section} />;
    case 'custom_banner':
    case 'banner_single':
      return <CustomBanner section={section} />;
    default:
      return null;
  }
}
