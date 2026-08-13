'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { biz, setBizSession } from '@/lib/bizApi';

export default function BusinessLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Enter your email and password'); return; }
    setLoading(true); setError('');
    try {
      const r = await biz.post('/coupons/business/login', { email: email.trim(), password });
      setBizSession(r.accessToken, r.refreshToken);
      router.replace(r.member?.role === 'cashier' ? '/business/counter' : '/business');
    } catch (err) {
      setError((err as Error).message || 'Could not sign in');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-6">
          <span className="inline-grid place-items-center w-12 h-12 rounded-2xl brand-grad text-white text-xl font-extrabold mb-3">D</span>
          <h1 className="text-[22px] font-extrabold text-ink head-kick">Business Console</h1>
          <p className="text-[13px] text-gray-500 mt-1">Sign in to manage your coupons, outlets and team.</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-[0_2px_16px_-8px_rgba(91,33,182,0.18)]">
          <label className="block text-[12px] font-bold text-gray-500 mb-1.5">Work email</label>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="you@yourbusiness.com" />

          <label className="block text-[12px] font-bold text-gray-500 mb-1.5 mt-4">Password</label>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="••••••••" />

          {error && <p className="text-red-500 text-[12.5px] mt-3">{error}</p>}

          <button type="submit" disabled={loading}
            className="btn-claim w-full mt-5 py-3 text-[15px] disabled:opacity-50">
            <span className="relative z-10">{loading ? 'Signing in…' : 'Sign in'}</span>
          </button>
        </form>

        <p className="text-center text-[12.5px] text-gray-500 mt-5">
          Owner without a password yet?{' '}
          <Link href="/vendor" className="font-bold text-primary hover:underline">Sign in with your phone</Link>
        </p>
        <p className="text-center text-[12.5px] text-gray-400 mt-2">
          New here? <Link href="/list-your-coupon" className="font-bold text-primary hover:underline">List your business</Link>
        </p>
      </div>
    </div>
  );
}
