'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, imgUrl } from '@/lib/api';
import { Category } from '@/lib/types';
import CouponMarketLink from './CouponMarketLink';

export default function CategoryBar() {
  const [categories, setCategories] = useState<Category[]>([]);
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/categories?platform=damndeal')
      .then(res => setCategories(res.categories || []))
      .catch(() => {});
  }, []);

  if (categories.length === 0) return null;

  const activeCatId = pathname.startsWith('/categories/') ? pathname.split('/')[2] : null;
  const isAllActive = pathname === '/categories' || pathname === '/';

  return (
    <div className="hidden md:block bg-white border-b border-gray-50 sticky top-12 z-30">
      <div className="max-w-[1400px] mx-auto">
        <div
          ref={scrollRef}
          className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto no-scrollbar"
        >
          {/* Coupon marketplace — a sibling subdomain, so the session carries over */}
          <CouponMarketLink className="shrink-0 px-3 py-1 rounded-full text-xs brand-grad text-white hover:opacity-90" />

          {/* All */}
          <Link
            href="/categories"
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap
              ${isAllActive ? 'bg-primary text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >
            All
          </Link>

          {/* Category items */}
          {categories.map(cat => {
            const isActive = activeCatId === cat._id;
            return (
              <Link
                key={cat._id}
                href={`/categories/${cat._id}`}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition whitespace-nowrap
                  ${isActive ? 'bg-primary text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                {(cat.icon || cat.image) && (
                  <img src={imgUrl(cat.icon || cat.image || '')} alt="" className="w-4 h-4 rounded-full object-cover" />
                )}
                {cat.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
