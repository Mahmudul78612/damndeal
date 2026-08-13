'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Campaign, Claim } from '@/lib/types';
import { X, Copy, Check, ExternalLink, QrCode, CalendarClock, BadgeCheck } from 'lucide-react';

/**
 * Claim → unique code + QR modal.
 * The success state renders as a physical coupon ticket: brand gradient header
 * band, punched side notches at the perforation, and a QR/code stub below.
 */

const INK = '#1B1530';   // deep purple ink — QR modules
const NOTCH = 13;        // notch radius (px)

/**
 * Which campaigns has this user already claimed?
 *
 * Fetched once per session and shared by every button on the page, so a
 * coupon the user already holds says so instead of offering to claim it
 * again. Failures are swallowed: the button just falls back to Claim.
 */
let claimedIdsPromise: Promise<Set<string>> | null = null;
function loadClaimedIds(): Promise<Set<string>> {
  if (!claimedIdsPromise) {
    claimedIdsPromise = (async (): Promise<Set<string>> => {
      const ids = new Set<string>();
      try {
        const r = await api.get('/coupons/my-claims');
        for (const c of (r.items || []) as any[]) {
          if (c.status === 'cancelled') continue;
          ids.add(String(c.campaign?._id || c.campaign));
        }
      } catch {
        // Not signed in, offline, or the call failed — fall back to "Claim".
      }
      return ids;
    })();
  }
  return claimedIdsPromise;
}
/** Called after a fresh claim so other buttons update without a refetch. */
function rememberClaimed(id: string) {
  if (claimedIdsPromise) {
    claimedIdsPromise = claimedIdsPromise.then((set) => { set.add(String(id)); return set; });
  }
}

const up = (p?: string) => (p ? (p.startsWith('http') ? p : `/uploads/${p.replace(/^\/?uploads\//, '')}`) : '');

/**
 * Punches real (transparent) circular bites into an edge so the page behind
 * shows through — header cuts its bottom edge, stub cuts its top edge, and the
 * two halves meet as one round notch at the perforation.
 * Browsers without mask-composite simply render a plain rounded ticket.
 */
const notchMask = (edge: 'top' | 'bottom'): CSSProperties => {
  const y = edge === 'bottom' ? '100%' : '0%';
  const bite = (x: string) =>
    `radial-gradient(${NOTCH}px ${NOTCH}px at ${x} ${y}, transparent ${NOTCH - 0.5}px, #000 ${NOTCH}px)`;
  const img = `${bite('0%')}, ${bite('100%')}`;
  return {
    WebkitMaskImage: img,
    maskImage: img,
    WebkitMaskComposite: 'source-in',
    maskComposite: 'intersect',
  };
};

/** Vendor logo, or initials on a translucent disc (sits on the gradient band). */
function BrandDisc({ name, logo }: { name?: string; logo?: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={up(logo)} alt={name || ''} width={40} height={40}
      className="w-10 h-10 rounded-full object-cover bg-white ring-2 ring-white/70 shadow-sm shrink-0" />;
  }
  const initials = (name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className="w-10 h-10 rounded-full bg-white/25 ring-2 ring-white/70 grid place-items-center font-extrabold text-[14px] text-white shrink-0">
      {initials}
    </span>
  );
}

export default function ClaimButton({ campaign, compact = false, big = false }: { campaign: Campaign; compact?: boolean; big?: boolean }) {
  const { isLoggedIn, openLoginModal } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [already, setAlready] = useState(false);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [held, setHeld] = useState(false);   // already claimed in an earlier visit
  const [mounted, setMounted] = useState(false);

  const soldOut = (campaign.claimedCount || 0) >= (campaign.totalQuota || 0);

  const endsOn = (() => {
    const d = campaign.endAt ? new Date(campaign.endAt) : null;
    return d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  })();

  useEffect(() => { setMounted(true); }, []);

  // Already-claimed lookup — one shared request per session
  useEffect(() => {
    if (!isLoggedIn) { setHeld(false); return; }
    let alive = true;
    loadClaimedIds().then((ids) => { if (alive) setHeld(ids.has(String(campaign._id))); });
    return () => { alive = false; };
  }, [isLoggedIn, campaign._id]);

  // Esc closes the ticket
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const doClaim = async () => {
    if (!isLoggedIn) { openLoginModal(); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/coupons/claim', { campaignId: campaign._id });
      setClaim(res.claim);
      setAlready(!!res.alreadyClaimed);
      setHeld(true);
      rememberClaimed(campaign._id);
      setOpen(true);
      try {
        const QRCode = (await import('qrcode')).default;
        setQr(await QRCode.toDataURL(res.claim.code, {
          width: 420, margin: 2, errorCorrectionLevel: 'M',
          color: { dark: INK, light: '#FFFFFF' },
        }));
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
      <button onClick={doClaim} disabled={loading || (soldOut && !held)} className={btnCls}>
        <span className="relative z-10">
          {loading ? 'Opening…' : held ? '✓ View your coupon' : soldOut ? 'Sold Out' : '🎟️ Claim Coupon'}
        </span>
      </button>

      {open && mounted && createPortal(
        <div role="dialog" aria-modal="true"
          className="fixed inset-0 z-[110] flex items-center justify-center px-4 py-6 overflow-y-auto">
          <div className="fixed inset-0 bg-[#150E2B]/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {error ? (
            <div className="relative w-full max-w-sm my-auto rounded-3xl bg-white shadow-2xl p-6 text-center fade-up">
              <button onClick={() => setOpen(false)} aria-label="Close"
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
              <p className="text-4xl mb-2">😕</p>
              <h3 className="font-extrabold text-lg text-gray-900">Couldn&apos;t claim</h3>
              <p className="text-sm text-gray-500 mt-1">{error}</p>
            </div>
          ) : claim ? (
            <div className="relative w-full max-w-sm my-auto fade-up"
              style={{ filter: 'drop-shadow(0 18px 34px rgba(17,9,40,.45))' }}>

              {/* ── Ticket head: brand gradient band ────────────────────── */}
              <div className="relative brand-grad text-white px-5 pt-5 pb-8 rounded-t-[26px] overflow-hidden"
                style={notchMask('bottom')}>
                {/* glossy sheen, same language as .btn-claim */}
                <span aria-hidden className="pointer-events-none absolute left-[5%] right-[5%] top-0 h-[55%] rounded-b-[999px]"
                  style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.42), rgba(255,255,255,0))' }} />
                <span aria-hidden className="pointer-events-none absolute -right-5 -bottom-9 text-white/15 font-extrabold text-[108px] leading-none select-none">%</span>

                <button onClick={() => setOpen(false)} aria-label="Close"
                  className="absolute top-3.5 right-3.5 z-10 w-7 h-7 grid place-items-center rounded-full bg-white/20 hover:bg-white/35 text-white transition">
                  <X size={15} />
                </button>

                <div className="relative flex items-center gap-3 pr-9">
                  <BrandDisc name={campaign.vendor?.businessName} logo={campaign.vendor?.logo} />
                  <div className="min-w-0">
                    <p className="text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-white/80 flex items-center gap-1">
                      <Check size={11} strokeWidth={3} />{already ? 'Your coupon' : 'Coupon claimed'}
                    </p>
                    <p className="text-[14px] font-extrabold truncate flex items-center gap-1 drop-shadow-[0_1px_2px_rgba(0,0,0,.18)]">
                      <span className="truncate">{campaign.vendor?.businessName}</span>
                      {campaign.vendor?.isVerifiedBadge && <BadgeCheck size={13} className="shrink-0 text-white/90" />}
                    </p>
                  </div>
                </div>

                <p className="relative font-display font-extrabold text-[30px] leading-none mt-3.5 break-words drop-shadow-[0_2px_6px_rgba(0,0,0,.22)]">
                  {campaign.offerText}
                </p>
                <p className="relative text-[12px] font-semibold text-white/85 mt-1.5 line-clamp-2">{campaign.title}</p>
              </div>

              {/* ── Stub: perforation, QR, code ─────────────────────────── */}
              <div className="relative -mt-px bg-white px-5 pt-6 pb-5 rounded-b-[26px] text-center"
                style={notchMask('top')}>
                <div className="coupon-dash-h absolute left-6 right-6 top-0" />

                {/* QR on a subtle dotted ground with scan brackets */}
                <div className="relative mx-auto w-fit">
                  <div className="rounded-2xl p-2.5 ring-1 ring-[#F0E9FA] shadow-[0_10px_26px_-16px_rgba(42,27,94,.75)]"
                    style={{
                      backgroundColor: '#FFFFFF',
                      backgroundImage: 'radial-gradient(rgba(236,26,116,.14) 1px, transparent 1px)',
                      backgroundSize: '9px 9px',
                    }}>
                    <div className="rounded-xl bg-white p-2">
                      {qr ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qr} alt="Coupon QR code" width={168} height={168}
                          className="block w-[168px] h-[168px]" />
                      ) : (
                        <div className="w-[168px] h-[168px] grid place-items-center rounded-lg bg-gray-50 animate-pulse">
                          <QrCode size={40} className="text-gray-300" />
                        </div>
                      )}
                    </div>
                  </div>
                  {[
                    'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
                    'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
                    'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
                    'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
                  ].map(c => (
                    <span key={c} aria-hidden className={`absolute w-4 h-4 border-[#EC1A74]/70 ${c}`} />
                  ))}
                </div>

                {/* Code stub + copy control */}
                <button onClick={copy} aria-label={`Copy coupon code ${claim.code}`}
                  className="mt-4 w-full flex items-stretch text-left rounded-xl border border-dashed border-[#DCCBF5] bg-[#FAF7FF] overflow-hidden hover:border-primary transition-colors">
                  <span className="flex-1 min-w-0 px-3.5 py-2.5">
                    <span className="block text-[9px] font-extrabold uppercase tracking-[0.18em] text-gray-400">Coupon code</span>
                    <span className="block font-mono font-extrabold text-[16px] tracking-[0.08em] text-ink truncate">{claim.code}</span>
                  </span>
                  <span className={`shrink-0 w-[74px] grid place-items-center gap-0.5 border-l border-dashed border-[#DCCBF5] text-[9px] font-extrabold uppercase tracking-wider transition-colors ${copied ? 'bg-emerald-50 text-emerald-600' : 'text-primary'}`}>
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? 'Copied' : 'Copy'}
                  </span>
                </button>

                {endsOn && (
                  <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold text-gray-400">
                    <CalendarClock size={12} className="shrink-0" /> Valid till {endsOn}
                  </p>
                )}
                <p className="text-[11px] text-gray-400 mt-1">
                  {campaign.isOnline ? 'Use this code on the brand’s website.' : 'Show this QR or code at the counter to redeem.'}
                </p>

                {campaign.isOnline && campaign.redirectUrl && (
                  <a href={campaign.redirectUrl} target="_blank" rel="noopener noreferrer"
                    className="btn-claim w-full mt-4 py-3 text-[14px]">
                    <span className="relative z-10 flex items-center gap-1.5">Use at site <ExternalLink size={14} /></span>
                  </a>
                )}
                <a href="/my-coupons" className="block mt-3 text-[12px] font-extrabold text-primary hover:underline">
                  Saved in My Coupons →
                </a>
              </div>
            </div>
          ) : null}
        </div>,
        document.body
      )}
    </>
  );
}
