'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { biz } from '@/lib/bizApi';
import { useBusiness } from '@/context/BusinessContext';
import { Eye, MousePointerClick, Ticket, BadgeCheck, ArrowRight } from 'lucide-react';

const RANGES = [7, 30, 90];

export default function BusinessDashboard() {
  const { member, business, outlets, can } = useBusiness();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { setData(await biz.get(`/coupons/vendor/analytics?days=${days}`)); }
    catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [days]);

  useEffect(() => { if (can('view_dashboard')) load(); else setLoading(false); }, [load, can]);

  // A cashier has no dashboard — send them where they actually work.
  if (member && !can('view_dashboard')) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <p className="text-3xl mb-2">🧾</p>
        <h1 className="font-extrabold text-[17px] text-ink">You are set up for the counter</h1>
        <p className="text-[13px] text-gray-500 mt-1.5">Scan and redeem customer codes from the Counter screen.</p>
        <Link href="/business/counter" className="btn-claim inline-block mt-4 px-6 py-2.5 text-[14px]">
          <span className="relative z-10">Open the counter</span>
        </Link>
      </div>
    );
  }

  const t = data?.totals || {};
  const peak = Math.max(1, ...(data?.series || []).map((s: any) => s.views || 0));

  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-[20px] font-extrabold text-ink head-kick">{business?.name || 'Dashboard'}</h1>
          <p className="text-[12.5px] text-gray-500">
            Hi {member?.name?.split(' ')[0] || 'there'} — here is how your coupons are doing.
          </p>
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {RANGES.map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold transition ${
                days === d ? 'bg-primary text-white' : 'text-gray-500 hover:text-ink'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {err && <div className="rounded-xl bg-red-50 text-red-600 px-4 py-3 mb-3 text-[13px]">{err}</div>}

      {/* Funnel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        <Stat icon={<Eye size={15} />} label="Shown" value={t.impressions} hint="times your coupons appeared" loading={loading} />
        <Stat icon={<MousePointerClick size={15} />} label="Opened" value={t.views} hint="coupon pages viewed" loading={loading} />
        <Stat icon={<Ticket size={15} />} label="Claimed" value={t.claims} hint={`${t.claimRate ?? 0}% of views`} loading={loading} />
        <Stat icon={<BadgeCheck size={15} />} label="Redeemed" value={t.redemptions} hint={`${t.redemptionRate ?? 0}% of claims`} loading={loading} accent />
      </div>

      {/* Views over time — a plain CSS bar chart keeps this page dependency-free */}
      {!!data?.series?.length && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
          <p className="text-[13px] font-extrabold text-ink mb-3">Views per day</p>
          <div className="flex items-end gap-1 h-28">
            {data.series.map((s: any) => (
              <div key={s.date} className="flex-1 group relative" title={`${s.date}: ${s.views} views`}>
                <div className="w-full brand-grad rounded-t transition-all"
                  style={{ height: `${Math.max(3, ((s.views || 0) / peak) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10.5px] text-gray-400 mt-1.5">
            <span>{data.series[0]?.date}</span>
            <span>{data.series[data.series.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Per-campaign */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-[13px] font-extrabold text-ink">Coupon performance</p>
          {can('manage_campaigns') && (
            <Link href="/business/coupons" className="text-[12px] font-bold text-primary hover:underline flex items-center gap-1">
              All coupons <ArrowRight size={12} />
            </Link>
          )}
        </div>
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-400">Loading…</p>
        ) : !data?.campaigns?.length ? (
          <div className="p-8 text-center">
            <p className="text-[13px] text-gray-500">No activity yet in this period.</p>
            {can('manage_campaigns') && (
              <Link href="/business/coupons" className="btn-claim inline-block mt-3 px-5 py-2 text-[13px]">
                <span className="relative z-10">Create a coupon</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-band text-gray-500">
                <tr>
                  <th className="text-left font-bold px-4 py-2">Coupon</th>
                  <th className="text-right font-bold px-3 py-2">Shown</th>
                  <th className="text-right font-bold px-3 py-2">Opened</th>
                  <th className="text-right font-bold px-3 py-2">Claimed</th>
                  <th className="text-right font-bold px-4 py-2">Redeemed</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c: any) => (
                  <tr key={String(c.campaign)} className="border-t border-gray-50">
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-ink truncate max-w-[220px]">{c.title}</p>
                      <p className="text-[11px] text-gray-400 truncate max-w-[220px]">{c.offerText}</p>
                    </td>
                    <td className="text-right px-3 tabular-nums">{c.impressions}</td>
                    <td className="text-right px-3 tabular-nums">{c.views}</td>
                    <td className="text-right px-3 tabular-nums font-bold">{c.claims}</td>
                    <td className="text-right px-4 tabular-nums font-bold text-primary">{c.redemptions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nudges that actually matter */}
      {can('manage_outlets') && outlets.length === 0 && (
        <Nudge href="/business/outlets" title="Add your outlets"
          body="Customers see your coupons based on where your shops are. Without an outlet, only nationwide offers reach them." />
      )}
      {can('manage_members') && (
        <Nudge href="/business/team" title="Invite your team"
          body="Give each shop its own cashier login so redemptions are traced to the right outlet and person." />
      )}
    </div>
  );
}

function Stat({ icon, label, value, hint, loading, accent }: any) {
  return (
    <div className={`bg-white rounded-2xl border p-3.5 ${accent ? 'border-primary/30' : 'border-gray-200'}`}>
      <div className="flex items-center gap-1.5 text-gray-400 mb-1">
        {icon}<span className="text-[11px] font-extrabold uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-[24px] font-extrabold tabular-nums leading-tight ${accent ? 'text-primary' : 'text-ink'}`}>
        {loading ? '—' : (value ?? 0).toLocaleString()}
      </p>
      <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>
    </div>
  );
}

function Nudge({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="block bg-white border border-dashed border-primary/40 rounded-2xl p-4 mb-2.5 hover:border-primary transition">
      <p className="font-extrabold text-[14px] text-ink flex items-center gap-1.5">{title} <ArrowRight size={14} className="text-primary" /></p>
      <p className="text-[12.5px] text-gray-500 mt-0.5">{body}</p>
    </Link>
  );
}
