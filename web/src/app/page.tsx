'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { api, imgUrl, IS_US } from '@/lib/api';
import { HomeSection, Category } from '@/lib/types';
import { useAppConfig } from '@/context/ConfigContext';
import SectionRenderer from '@/components/SectionRenderer';
import DesktopHome from '@/components/DesktopHome';
import { ChevronRight, LayoutGrid } from 'lucide-react';

export default function HomePage() {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const config = useAppConfig();

  useEffect(() => {
    Promise.all([
      api.get('/user/home?platform=damndeal'),
      api.get('/categories?platform=damndeal'),
    ]).then(([home, cats]) => {
      setSections(home.sections || []);
      setCategories(cats.categories || []);
    }).catch(e => {
      console.error('Home load error:', e);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <HomeShimmer />;

  const catHeadingColor = config.category_heading_color || '#1F2937';
  const catTextColor = config.category_text_color || '#1F2937';
  const catBgColor = config.category_bg_color || '#F3E8FF';

  return (
    <div className="pb-3">
        {/* ── Categories ── */}
        {categories.length > 0 && (
          <div className="px-4 md:px-4 mt-0 md:mt-4 relative z-[60]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs md:text-sm font-bold" style={{ color: catHeadingColor }}>Shop by Category</h2>
              <Link href="/categories" className="flex items-center gap-0.5 text-[10px] md:text-xs font-semibold text-violet-600 hover:underline">
                View All <ChevronRight size={14} />
              </Link>
            </div>
            <div className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar pb-2">
              <Link href="/categories" className="shrink-0 flex flex-col items-center gap-1.5 w-16 md:w-20">
                <div className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-2xl overflow-hidden flex items-center justify-center border-2 border-gray-200 bg-white">
                  <LayoutGrid size={24} className="text-gray-600" />
                </div>
                <span className="text-[10px] md:text-xs font-medium text-center leading-tight line-clamp-2" style={{ color: catTextColor }}>All</span>
              </Link>
              {categories.map(cat => (
                <Link key={cat._id} href={`/categories/${cat._id}`} className="shrink-0 flex flex-col items-center gap-1.5 w-16 md:w-20">
                  <div className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-2xl overflow-hidden flex items-center justify-center" style={{ backgroundColor: catBgColor }}>
                    {(cat.icon || cat.image) ? (
                      <Image src={imgUrl(cat.icon || cat.image || '')} alt={cat.name} width={56} height={56} className="object-contain w-full h-full" />
                    ) : (
                      <span className="text-lg">🏷️</span>
                    )}
                  </div>
                  <span className="text-[10px] md:text-xs font-medium text-center leading-tight line-clamp-2" style={{ color: catTextColor }}>
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Mobile SDUI Sections — India only. US uses the responsive
              DesktopHome section system on all screen sizes. ── */}
        {!IS_US && (
          <div className="mt-0 space-y-3 md:hidden">
            {sections.map((section, i) => (
              <SectionRenderer key={section._id || section.id || i} section={section} />
            ))}
          </div>
        )}

        {/* ── Section system (US: all screens · India: desktop) ── */}
        <DesktopHome categories={categories} config={config} />
    </div>
  );
}

function HomeShimmer() {
  return (
    <div className="animate-pulse">
      <div className="h-48 md:h-56 skeleton" />
      <div className="px-4 mt-4 space-y-3">
        <div className="flex gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-14 h-14 skeleton rounded-2xl shrink-0" />
          ))}
        </div>
        <div className="h-40 skeleton rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-52 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
