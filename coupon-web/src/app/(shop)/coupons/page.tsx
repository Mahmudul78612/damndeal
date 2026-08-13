import Link from 'next/link';
import type { Metadata } from 'next';
import { apiServer } from '@/lib/server';
import { Campaign, Category } from '@/lib/types';
import CouponCard from '@/components/CouponCard';

export const revalidate = 60;

type SP = Promise<{ category?: string; q?: string; sort?: string; page?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  const bits = [sp.category ? `${sp.category.replace(/-/g, ' ')} coupons` : 'All coupons', sp.q ? `“${sp.q}”` : '']
    .filter(Boolean).join(' · ');
  return { title: bits || 'Browse coupons', description: `Browse and claim ${bits || 'live coupons'} on DamnDeal Coupons.` };
}

export default async function CouponsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.category) qs.set('category', sp.category);
  if (sp.q) qs.set('q', sp.q);
  if (sp.sort) qs.set('sort', sp.sort);
  if (sp.page) qs.set('page', sp.page);

  const [listRes, catRes] = await Promise.all([
    apiServer<{ items: Campaign[]; total: number; page: number; pages: number }>(`/coupons/list?${qs.toString()}`),
    apiServer<{ items: Category[] }>('/coupons/categories'),
  ]);
  const items = listRes?.items || [];
  const cats = catRes?.items || [];
  const active = sp.category || '';
  const sort = sp.sort || 'popular';

  const link = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { category: active, q: sp.q, sort, ...over };
    Object.entries(merged).forEach(([k, v]) => { if (v) p.set(k, v); });
    const s = p.toString();
    return `/coupons${s ? `?${s}` : ''}`;
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold">
        {sp.q ? <>Results for “{sp.q}”</> : active ? `${cats.find(c => c.slug === active)?.name || 'Category'} coupons` : 'All coupons'}
      </h1>
      <p className="text-sm text-gray-400 mt-1">{listRes?.total ?? 0} live coupons</p>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mt-5 mb-2">
        <Link href={link({ category: undefined, page: undefined })}
          className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold border transition ${!active ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary'}`}>
          All
        </Link>
        {cats.map((c) => (
          <Link key={c._id} href={link({ category: c.slug, page: undefined })}
            className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold border transition ${active === c.slug ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary'}`}>
            {c.icon} {c.name}
          </Link>
        ))}
      </div>
      {/* Sort */}
      <div className="flex gap-2 mb-6">
        {[['popular', 'Popular'], ['new', 'Newest'], ['ending', 'Ending soon']].map(([k, label]) => (
          <Link key={k} href={link({ sort: k, page: undefined })}
            className={`px-3 py-1 rounded-lg text-[12px] font-bold ${sort === k ? 'bg-primary-light text-primary' : 'text-gray-400 hover:text-gray-600'}`}>
            {label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🎟️</p>
          <p className="font-bold text-gray-600">No coupons found</p>
          <p className="text-sm mt-1">Try a different category or search.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((c) => <CouponCard key={c._id} c={c} />)}
        </div>
      )}

      {(listRes?.pages || 1) > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: Math.min(listRes!.pages, 8) }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={link({ page: String(p) })}
              className={`w-9 h-9 grid place-items-center rounded-lg text-sm font-bold ${p === (listRes!.page || 1) ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary'}`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
