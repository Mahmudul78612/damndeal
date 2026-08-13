'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Claim } from '@/lib/types';
import { BrandMark } from '@/components/CouponCard';
import { Copy, Check, ExternalLink, QrCode, X } from 'lucide-react';

export default function MyCouponsPage() {
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();
  const [items, setItems] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrFor, setQrFor] = useState<Claim | null>(null);
  const [qrData, setQrData] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal('/my-coupons'); setLoading(false); return; }
    api.get('/coupons/my-claims')
      .then((r) => setItems(r.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn, authLoading, openLoginModal]);

  const showQr = async (cl: Claim) => {
    setQrFor(cl); setQrData('');
    try {
      const QRCode = (await import('qrcode')).default;
      setQrData(await QRCode.toDataURL(cl.code, { width: 240, margin: 1, color: { dark: '#1B1530' } }));
    } catch {}
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code); setTimeout(() => setCopied(''), 1500);
    });
  };

  const badge = (s: Claim['status']) => {
    const map: Record<string, string> = {
      claimed: 'bg-primary-light text-primary',
      redeemed: 'bg-emerald-100 text-emerald-700',
      expired: 'bg-gray-100 text-gray-500',
      cancelled: 'bg-red-100 text-red-600',
    };
    return <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${map[s]}`}>{s}</span>;
  };

  return (
    <div className="max-w-[900px] mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold">My coupons</h1>
      <p className="text-sm text-gray-400 mt-1 mb-6">Your claimed codes — show the QR at the store to redeem.</p>

      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading…</div>
      ) : !isLoggedIn ? (
        <div className="py-20 text-center">
          <p className="text-gray-500 font-semibold">Sign in to see your coupons</p>
          <button onClick={() => openLoginModal('/my-coupons')} className="mt-4 px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm">Sign in</button>
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          <p className="text-4xl mb-3">🎟️</p>
          <p className="font-bold text-gray-600">No coupons yet</p>
          <Link href="/coupons" className="inline-block mt-4 px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm">Browse coupons</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((cl) => (
            <div key={cl._id} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 flex-wrap">
              <BrandMark name={cl.vendor?.businessName} logo={cl.vendor?.logo} size={44} />
              <div className="flex-1 min-w-[180px]">
                <p className="font-bold text-[14.5px] leading-snug">{cl.campaign?.title || 'Coupon'}</p>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  {cl.vendor?.businessName} · claimed {new Date(cl.claimedAt).toLocaleDateString()}
                </p>
              </div>
              {badge(cl.status)}
              <button onClick={() => copy(cl.code)}
                className="flex items-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 font-mono font-bold text-[13px]">
                {cl.code}
                {copied === cl.code ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-gray-400" />}
              </button>
              <div className="flex gap-2">
                <button onClick={() => showQr(cl)} className="p-2 rounded-lg bg-primary-light text-primary hover:bg-primary hover:text-white transition" title="Show QR">
                  <QrCode size={17} />
                </button>
                {cl.campaign?.isOnline && cl.campaign?.redirectUrl && (
                  <a href={cl.campaign.redirectUrl} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200" title="Use at site">
                    <ExternalLink size={17} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {qrFor && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setQrFor(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 text-center max-w-xs w-full fade-up">
            <button onClick={() => setQrFor(null)} className="absolute top-3 right-3 p-1 text-gray-400"><X size={18} /></button>
            <p className="font-extrabold">{qrFor.campaign?.offerText}</p>
            <p className="text-[12px] text-gray-400 mb-4">{qrFor.vendor?.businessName}</p>
            {qrData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrData} alt="QR" className="mx-auto rounded-xl" width={220} height={220} />
            ) : <div className="h-[220px] grid place-items-center text-gray-300">Generating…</div>}
            <p className="font-mono font-bold mt-3 tracking-wide">{qrFor.code}</p>
            <p className="text-[11px] text-gray-400 mt-1">Show this at the counter</p>
          </div>
        </div>
      )}
    </div>
  );
}
