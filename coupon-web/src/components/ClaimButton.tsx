'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Campaign, Claim } from '@/lib/types';
import { X, Copy, Check, ExternalLink, QrCode } from 'lucide-react';

/**
 * Claim → unique code + QR modal (Google Play "Install"-style single action).
 * Online offers also get a "Use at site" redirect button.
 */
export default function ClaimButton({ campaign, compact = false, big = false }: { campaign: Campaign; compact?: boolean; big?: boolean }) {
  const { isLoggedIn, openLoginModal } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [already, setAlready] = useState(false);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const soldOut = (campaign.claimedCount || 0) >= (campaign.totalQuota || 0);

  const doClaim = async () => {
    if (!isLoggedIn) { openLoginModal(); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/coupons/claim', { campaignId: campaign._id });
      setClaim(res.claim);
      setAlready(!!res.alreadyClaimed);
      setOpen(true);
      try {
        const QRCode = (await import('qrcode')).default;
        setQr(await QRCode.toDataURL(res.claim.code, { width: 220, margin: 1, color: { dark: '#1B1530' } }));
      } catch {}
    } catch (e) {
      setError((e as Error).message || 'Could not claim');
      setOpen(true);
    }
    setLoading(false);
  };

  const copy = () => {
    if (!claim) return;
    navigator.clipboard.writeText(claim.code).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    });
  };

  const btnCls = big
    ? 'btn-claim w-full py-3.5 text-[16px]'
    : compact
      ? 'btn-claim px-4 py-1.5 text-[12px]'
      : 'btn-claim px-7 py-2.5 text-sm';

  return (
    <>
      <button onClick={doClaim} disabled={loading || soldOut} className={btnCls}>
        <span className="relative z-10">{soldOut ? 'Sold Out' : loading ? 'Claiming…' : '🎟️ Claim Coupon'}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center fade-up">
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>

            {error ? (
              <>
                <p className="text-4xl mb-2">😕</p>
                <h3 className="font-extrabold text-lg text-gray-900">Couldn&apos;t claim</h3>
                <p className="text-sm text-gray-500 mt-1">{error}</p>
              </>
            ) : claim && (
              <>
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 grid place-items-center mb-2">
                  <Check size={24} className="text-emerald-600" />
                </div>
                <h3 className="font-extrabold text-lg text-gray-900">{already ? 'Your coupon' : 'Coupon claimed!'}</h3>
                <p className="text-[13px] text-gray-500 mt-0.5 mb-4">{campaign.offerText} — {campaign.vendor?.businessName}</p>

                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="Coupon QR" className="mx-auto rounded-xl border border-gray-100" width={190} height={190} />
                ) : (
                  <div className="w-[190px] h-[190px] mx-auto rounded-xl bg-gray-50 grid place-items-center"><QrCode size={40} className="text-gray-300" /></div>
                )}

                <button onClick={copy}
                  className="mt-4 mx-auto flex items-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl px-5 py-2.5 font-mono font-bold text-[15px] tracking-wide text-gray-900 hover:border-primary">
                  {claim.code}
                  {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} className="text-gray-400" />}
                </button>
                <p className="text-[11px] text-gray-400 mt-2">
                  {campaign.isOnline ? 'Use this code on the brand’s website.' : 'Show this QR or code at the counter to redeem.'}
                </p>

                {campaign.isOnline && campaign.redirectUrl && (
                  <a href={campaign.redirectUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-dark">
                    Use at site <ExternalLink size={14} />
                  </a>
                )}
                <a href="/my-coupons" className="block mt-2 text-[12px] font-semibold text-primary hover:underline">
                  Saved in My Coupons →
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
