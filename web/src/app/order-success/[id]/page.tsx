'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Crown, Gift, Sparkles, Package, ChevronRight, Loader2, XCircle } from 'lucide-react';
import { api, IS_US } from '@/lib/api';

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-50 bg-white flex items-center justify-center"><Loader2 size={40} className="text-primary animate-spin" /></div>}>
      <OrderSuccessContent />
    </Suspense>
  );
}

function OrderSuccessContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const stripeSession = params.get('stripe_session');
  const [phase, setPhase] = useState(0);
  // When returning from Stripe we must confirm the payment before celebrating.
  const [verifying, setVerifying] = useState(!!stripeSession);
  const [payFailed, setPayFailed] = useState(false);

  useEffect(() => {
    if (!stripeSession) return;
    let cancelled = false;
    (async () => {
      try {
        await api.post('/user/payments/stripe/verify-checkout', { sessionId: stripeSession });
        if (!cancelled) setVerifying(false);
      } catch {
        if (!cancelled) { setVerifying(false); setPayFailed(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [stripeSession]);

  useEffect(() => {
    if (verifying || payFailed) return;
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1000);
    const t3 = setTimeout(() => setPhase(3), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [verifying, payFailed]);

  if (verifying) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-6">
        <Loader2 size={40} className="text-primary animate-spin mb-4" />
        <p className="text-lg font-bold text-gray-900">Confirming your payment...</p>
        <p className="text-sm text-gray-400 mt-1">Please don&apos;t close this page</p>
      </div>
    );
  }

  if (payFailed) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <XCircle size={32} className="text-red-500" />
        </div>
        <h1 className="text-xl font-extrabold text-gray-900">Payment not completed</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">Your order is saved as unpaid. You can retry payment from your orders.</p>
        <button onClick={() => router.replace(`/orders/${id}`)} className="px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold">View Order</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-start px-6 py-10">
        <div className="relative mt-6">
          <div className={`absolute -inset-8 rounded-full border-2 border-green-200 transition-all duration-700 ${phase >= 1 ? 'scale-[1.8] opacity-0' : 'scale-100 opacity-60'}`} />
          <div className={`absolute -inset-4 rounded-full border-2 border-green-300 transition-all duration-500 ${phase >= 1 ? 'scale-150 opacity-0' : 'scale-100 opacity-80'}`} />

          <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${phase >= 1 ? 'bg-green-500 scale-100' : 'bg-green-400 scale-75'}`}>
            <svg viewBox="0 0 24 24" className={`w-12 h-12 text-white transition-all duration-500 ${phase >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" style={{ strokeDasharray: 30, strokeDashoffset: phase >= 1 ? 0 : 30, transition: 'stroke-dashoffset 0.6s ease 0.2s' }} />
            </svg>
          </div>

          {phase >= 1 && [...Array(12)].map((_, i) => {
            const angle = (i * 30) * Math.PI / 180;
            const tx = Math.cos(angle) * 70;
            const ty = Math.sin(angle) * 70;
            return (
              <div key={i} className="absolute w-2 h-2 rounded-full" style={{
                background: ['#22c55e','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#ec4899'][i % 6],
                left: '50%', top: '50%',
                animation: `confetti-out 0.8s ease-out ${i * 50}ms forwards`,
                // @ts-expect-error custom props
                '--tx': `${tx}px`, '--ty': `${ty}px`,
              }} />
            );
          })}
        </div>

        <div className={`text-center mt-6 transition-all duration-500 ${phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-2xl font-extrabold text-gray-900">Order Placed!</h1>
          <p className="text-sm text-gray-500 mt-1">We'll notify you on every status change.</p>
        </div>

        <div className={`w-full max-w-md mt-6 transition-all duration-700 ${phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {!IS_US && (
          <Link
            href="/magic-pools"
            className="block relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-500 p-5 text-white shadow-xl active:scale-[0.98] transition"
          >
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-yellow-300/30 rounded-full blur-3xl" />
            <Sparkles className="absolute top-3 right-3 text-white/30" size={48} />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl bg-white/25 backdrop-blur-sm flex items-center justify-center">
                  <Crown size={20} className="text-yellow-300" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-yellow-300 text-yellow-900 px-2 py-0.5 rounded-full">
                  ✨ Bonus Unlocked
                </span>
              </div>
              <h3 className="text-lg font-extrabold leading-tight flex items-center gap-1.5">
                <Gift size={18} className="text-yellow-200" />
                Win Big with Magic Pools!
              </h3>
              <p className="text-sm text-white/90 mt-1.5 leading-snug">
                Once your order is delivered, use it as your <strong>free entry</strong> into a Magic Pool draw. Pool fills → wheel spins → <strong>winner takes the prize.</strong>
              </p>
              <div className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-purple-700 text-xs font-bold">
                Browse Live Pools <ChevronRight size={14} />
              </div>
            </div>
          </Link>
          )}

          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <button
              onClick={() => router.replace(`/orders/${id}`)}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold active:scale-[0.98] transition"
            >
              <Package size={15} /> View Order
            </button>
            <button
              onClick={() => router.replace('/orders')}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-bold active:scale-[0.98] transition"
            >
              All Orders
            </button>
          </div>
        </div>

        <style jsx global>{`
          @keyframes confetti-out {
            0% { transform: translate(-50%,-50%) scale(1); opacity:1; }
            100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0); opacity:0; }
          }
        `}</style>
      </div>
    </div>
  );
}
