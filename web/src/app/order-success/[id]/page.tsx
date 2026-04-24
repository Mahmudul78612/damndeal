'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function OrderSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1000);
    const t3 = setTimeout(() => router.replace('/orders'), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [router]);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-6">
      {/* Green circle with check */}
      <div className="relative">
        {/* Ripple rings */}
        <div className={`absolute -inset-8 rounded-full border-2 border-green-200 transition-all duration-700 ${phase >= 1 ? 'scale-[1.8] opacity-0' : 'scale-100 opacity-60'}`} />
        <div className={`absolute -inset-4 rounded-full border-2 border-green-300 transition-all duration-500 ${phase >= 1 ? 'scale-150 opacity-0' : 'scale-100 opacity-80'}`} />

        <div className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 ${phase >= 1 ? 'bg-green-500 scale-100' : 'bg-green-400 scale-75'}`}>
          <svg viewBox="0 0 24 24" className={`w-14 h-14 text-white transition-all duration-500 ${phase >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" style={{ strokeDasharray: 30, strokeDashoffset: phase >= 1 ? 0 : 30, transition: 'stroke-dashoffset 0.6s ease 0.2s' }} />
          </svg>
        </div>

        {/* Confetti */}
        {phase >= 1 && [...Array(12)].map((_, i) => (
          <div key={i} className="absolute w-2 h-2 rounded-full" style={{
            background: ['#22c55e','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#ec4899'][i % 6],
            left: '50%', top: '50%',
            animation: `confetti-out 0.8s ease-out ${i * 50}ms forwards`,
            // @ts-expect-error custom props
            '--angle': `${i * 30}deg`,
          }} />
        ))}
      </div>

      {/* Text */}
      <div className={`text-center mt-8 transition-all duration-500 ${phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h1 className="text-2xl font-extrabold text-gray-900">Order Placed Successfully!</h1>
        <p className="text-sm text-gray-400 mt-2">Redirecting to your orders...</p>
      </div>

      <style jsx global>{`
        @keyframes confetti-out {
          0% { transform: translate(-50%,-50%) scale(1); opacity:1; }
          100% { transform: translate(calc(-50% + ${`cos(var(--angle))`} * 70px), calc(-50% + ${`sin(var(--angle))`} * 70px)) scale(0); opacity:0; }
        }
      `}</style>
    </div>
  );
}
