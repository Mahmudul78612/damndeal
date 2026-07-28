import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiServer } from '@/lib/server';
import { Campaign, Vendor } from '@/lib/types';
import CouponCard, { BrandMark } from '@/components/CouponCard';
import { BadgeCheck, Globe, MapPin } from 'lucide-react';

export const revalidate = 120;

type P = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { slug } = await params;
  const res = await apiServer<{ vendor: Vendor }>(`/coupons/vendors/${slug}`);
  if (!res?.vendor) return { title: 'Brand not found' };
  return {
    title: `${res.vendor.businessName} coupons & offers`,
    description: res.vendor.description?.slice(0, 155) || `Live coupons and offers from ${res.vendor.businessName} on DamnDeal Coupons.`,
  };
}

export default async function BrandPage({ params }: { params: P }) {
  const { slug } = await params;
  const res = await apiServer<{ vendor: Vendor; campaigns: Campaign[] }>(`/coupons/vendors/${slug}`);
  if (!res?.vendor) notFound();
  const v = res.vendor;
  const campaigns = (res.campaigns || []).map((c) => ({ ...c, vendor: v }));

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <BrandMark name={v.businessName} logo={v.logo} size={72} />
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            {v.businessName}
            {v.isVerifiedBadge && <BadgeCheck size={20} className="text-emerald-500" />}
          </h1>
          {v.description && <p className="text-sm text-gray-500 mt-1 max-w-xl">{v.description}</p>}
          <div className="flex flex-wrap gap-4 mt-2 text-[12.5px] text-gray-400">
            {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary"><Globe size={13} /> Website</a>}
            {v.address && <span className="flex items-center gap-1"><MapPin size={13} /> {v.address}</span>}
          </div>
        </div>
      </div>

      <h2 className="font-extrabold text-lg mb-4">Live coupons ({campaigns.length})</h2>
      {campaigns.length === 0 ? (
        <p className="text-gray-400 text-sm py-10 text-center">No live coupons right now — check back soon.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => <CouponCard key={c._id} c={c} />)}
        </div>
      )}
    </div>
  );
}
