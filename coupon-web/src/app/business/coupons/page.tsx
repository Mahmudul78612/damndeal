'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { biz } from '@/lib/bizApi';
import { BadgePercent, ExternalLink } from 'lucide-react';

const TONE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-600',
  pending: 'bg-amber-50 text-amber-600',
  rejected: 'bg-red-50 text-red-600',
  paused: 'bg-gray-100 text-gray-500',
  expired: 'bg-gray-100 text-gray-500',
};

export default function CouponsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await biz.get('/coupons/vendor/campaigns');
      setItems(r.items || []);
      setCredits(r.claimCredits || 0);
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <BadgePercent size={18} className="text-primary" />
          <h1 className="text-[19px] font-extrabold text-ink">Coupons</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full bg-primary-light text-primary">
            {credits.toLocaleString()} credits
          </span>
          <Link href="/vendor" className="btn-claim px-4 py-2 text-[13px]">
            <span className="relative z-10">+ New coupon</span>
          </Link>
        </div>
      </div>

      <p className="text-[12.5px] text-gray-500 mb-4">
        Choose which outlets each coupon applies to — nearby customers see it automatically.
      </p>

      {err && <div className="rounded-xl bg-red-50 text-red-600 px-4 py-3 mb-3 text-[13px]">{err}</div>}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-400">Loading coupons…</p>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-3xl mb-2">🎟️</p>
            <p className="font-bold text-ink">No coupons yet</p>
            <p className="text-[13px] text-gray-500 mt-1">Create your first offer and it goes live after a quick review.</p>
          </div>
        ) : items.map((c) => (
          <div key={c._id} className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[14px] text-ink truncate">{c.title}</p>
              <p className="text-[11.5px] text-gray-400 truncate">
                {c.offerText}
                {c.scope === 'selected' ? ` · ${(c.outlets || []).length} outlet(s)` : c.scope === 'online' ? ' · online' : ' · all outlets'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[12.5px] font-bold text-ink tabular-nums">{c.claimedCount}/{c.totalQuota}</p>
              <p className="text-[10.5px] text-gray-400">claimed</p>
            </div>
            <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${TONE[c.status] || 'bg-gray-100 text-gray-500'}`}>
              {c.status}
            </span>
            {c.status === 'active' && (
              <a href={`/c/${c.slug}`} target="_blank" rel="noreferrer" className="p-1.5 text-gray-300 hover:text-primary">
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        ))}
      </div>

      {items.some((c) => c.status === 'rejected' && c.rejectReason) && (
        <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3.5">
          <p className="text-[12.5px] font-bold text-red-700 mb-1">Rejected coupons</p>
          {items.filter((c) => c.status === 'rejected' && c.rejectReason).map((c) => (
            <p key={c._id} className="text-[12px] text-red-600">• <b>{c.title}</b>: {c.rejectReason}</p>
          ))}
        </div>
      )}
    </div>
  );
}
