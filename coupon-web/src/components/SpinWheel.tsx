'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, locQSClient } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { X, Copy, Check } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

const COLORS = ['#EC1A74', '#FF7A00', '#FFC93C', '#7C3AED', '#F43F5E', '#F59E0B', '#D946EF', '#FB923C'];

/**
 * Spin & Win — auto-opens once per day on the homepage; server picks the prize
 * (a real claimed coupon) and the wheel animates to it.
 */
export default function SpinWheel({ autoOpen = false }: { autoOpen?: boolean }) {
  const { isLoggedIn, openLoginModal } = useAuth();
  const [segments, setSegments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [won, setWon] = useState<any>(null);
  const [claim, setClaim] = useState<any>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    api.get('/coupons/spin' + locQSClient()).then((r) => {
      if (r.enabled && r.segments?.length >= 2) {
        setSegments(r.segments);
        if (autoOpen) {
          const today = new Date().toDateString();
          if (localStorage.getItem('dd_spin_seen') !== today) {
            setTimeout(() => { setOpen(true); localStorage.setItem('dd_spin_seen', today); }, 1400);
          }
        }
      }
    }).catch(() => {});
    const opener = () => setOpen(true);
    window.addEventListener("dd-open-spin", opener);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("dd-open-spin", opener); };
  }, [autoOpen]);

  const SIZE = 300; // CSS px — canvas backed at devicePixelRatio for crisp render

  const draw = useCallback((rot: number) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (cv.width !== SIZE * dpr) { cv.width = SIZE * dpr; cv.height = SIZE * dpr; }
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 6;
    const n = segments.length;
    const arc = (Math.PI * 2) / n;
    ctx.clearRect(0, 0, SIZE, SIZE);

    for (let i = 0; i < n; i++) {
      const start = rot + i * arc - Math.PI / 2 - arc / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + arc);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Label — flipped on the left half so text is never upside-down
      const mid = start + arc / 2;
      const norm = ((mid % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const onLeft = norm > Math.PI / 2 && norm < Math.PI * 1.5;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(mid + (onLeft ? Math.PI : 0));
      ctx.textAlign = onLeft ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 3;
      const edge = onLeft ? -(r - 14) : (r - 14);
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.fillText((segments[i].vendor?.businessName || '').slice(0, 14), edge, -7);
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillText(segments[i].offerText?.slice(0, 14) || '', edge, 8);
      ctx.restore();
    }
    // outer golden rim
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#F5A623'; ctx.lineWidth = 4; ctx.stroke();
    // hub base (SPIN button sits on top)
    ctx.beginPath(); ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#FFB800'; ctx.lineWidth = 3; ctx.stroke();
  }, [segments]);

  useEffect(() => { if (open) draw(angle); }, [open, angle, draw]);

  const spin = async () => {
    if (spinning || won) return;
    if (!isLoggedIn) { openLoginModal(); return; }
    setSpinning(true); setError('');
    try {
      const r = await api.post('/coupons/spin/play', {});
      const idx = segments.findIndex((s) => String(s._id) === String(r.won.campaignId));
      const n = segments.length, arc = (Math.PI * 2) / n;
      // land pointer (top) on segment idx center
      const target = (Math.PI * 2) * 6 - idx * arc + (Math.random() - 0.5) * arc * 0.5;
      const start = performance.now(), dur = 4200, from = angle % (Math.PI * 2);
      const animate = (t: number) => {
        const p = Math.min(1, (t - start) / dur);
        const ease = 1 - Math.pow(1 - p, 4);
        setAngle(from + (target - from) * ease);
        if (p < 1) rafRef.current = requestAnimationFrame(animate);
        else { setWon(r.won); setClaim(r.claim); setSpinning(false); }
      };
      rafRef.current = requestAnimationFrame(animate);
    } catch (e: any) {
      setSpinning(false);
      if (e.message?.includes('already spun') || e.message?.includes('come back')) {
        setError('🎡 Aaj ka spin ho gaya! Come back tomorrow for another prize.');
      } else setError(e.message || 'Could not spin');
    }
  };

  const copy = () => {
    if (!claim) return;
    navigator.clipboard.writeText(claim.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  if (!segments.length) return null;

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen(true)}
        className="hidden md:flex fixed bottom-5 left-5 z-[60] brand-grad text-white font-extrabold text-[13px] pl-2.5 pr-4 py-2 rounded-full shadow-xl shadow-orange-500/30 items-center gap-1.5 hover:scale-105 transition"
        aria-label="Spin and win a coupon">
        <span className="text-lg">🎡</span> Spin &amp; Win
      </button>

      {open && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !spinning && setOpen(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center pop-in overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 brand-grad" />
            <button onClick={() => !spinning && setOpen(false)} className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>

            {!won ? (
              <>
                <h3 className="font-extrabold text-[20px] brand-grad-text">Spin &amp; Win a Coupon!</h3>
                <p className="text-[12.5px] text-gray-500 mt-0.5 mb-4">Ek spin — kisi ek brand ka coupon pakka 🎁</p>

                <div className="relative mx-auto w-[300px] h-[300px]">
                  {/* pointer */}
                  <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 z-20 w-0 h-0 border-l-[13px] border-r-[13px] border-t-[22px] border-l-transparent border-r-transparent border-t-[#3B2A86] drop-shadow-[0_3px_3px_rgba(0,0,0,0.3)]" />
                  <canvas ref={canvasRef} style={{ width: 300, height: 300 }}
                    className="rounded-full shadow-[0_0_0_8px_#FFE066,0_0_0_10px_#F5A623,0_18px_40px_-12px_rgba(236,26,116,0.4)]" />
                  {/* SPIN button — explicit gradient (always visible on the hub) */}
                  <button type="button" onClick={spin} disabled={spinning}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-[76px] h-[76px] rounded-full font-extrabold text-[16px] tracking-wide text-[#3B2A86] cursor-pointer active:scale-95 transition disabled:opacity-70"
                    style={{
                      background: 'linear-gradient(180deg,#FFE066 0%,#FFC93C 55%,#FFB800 100%)',
                      border: '3px solid #F5A623',
                      boxShadow: '0 6px 18px -4px rgba(245,166,35,.7), inset 0 2px 0 rgba(255,255,255,.7)',
                    }}>
                    {spinning ? '…' : 'SPIN'}
                  </button>
                </div>

                {error && <p className="text-[13px] font-bold text-primary mt-4 bg-primary-light rounded-xl px-4 py-2.5">{error}</p>}
                {!isLoggedIn && !error && <p className="text-[11px] text-gray-400 mt-3">Sign in required to spin</p>}
              </>
            ) : (
              <div className="fade-up">
                <p className="text-4xl mb-1">🎉</p>
                <h3 className="font-extrabold text-[19px] text-ink">You won!</h3>
                <p className="brand-grad-text font-extrabold text-[26px] leading-tight mt-1">{won.offerText}</p>
                <p className="text-[13px] text-gray-500 mt-0.5 mb-4">{won.vendor?.businessName} — {won.title}</p>
                <button onClick={copy}
                  className="mx-auto flex items-center gap-2 bg-band border border-dashed border-[#F5A623] rounded-xl px-5 py-2.5 font-mono font-extrabold text-[15px] tracking-wide text-ink">
                  {claim?.code}
                  {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} className="text-gray-400" />}
                </button>
                <Link href={`/c/${won.slug}`} className="btn-claim w-full py-3 text-[14px] mt-4">
                  <span className="relative z-10">View coupon details</span>
                </Link>
                <Link href="/my-coupons" className="block mt-2.5 text-[12.5px] font-bold text-primary hover:underline">
                  Saved in My Coupons →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
