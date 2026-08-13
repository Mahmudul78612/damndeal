'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { biz, setBizSession } from '@/lib/bizApi';
import { CheckCircle2 } from 'lucide-react';

function JoinInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';

  const [invite, setInvite] = useState<any>(null);
  const [loadErr, setLoadErr] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setLoadErr('This link is missing its invitation code.'); return; }
    biz.get(`/coupons/business/invite/${token}`)
      .then((r) => setInvite(r.invite))
      .catch((e) => setLoadErr((e as Error).message));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Choose a password of at least 8 characters.'); return; }
    if (password !== confirm) { setError('Both passwords must match.'); return; }
    setBusy(true); setError('');
    try {
      const r = await biz.post(`/coupons/business/invite/${token}/accept`, { password });
      setBizSession(r.accessToken, r.refreshToken);
      router.replace(r.member?.role === 'cashier' ? '/business/counter' : '/business');
    } catch (err) {
      setError((err as Error).message || 'Could not complete the invitation');
      setBusy(false);
    }
  };

  if (loadErr) {
    return (
      <Center>
        <p className="text-4xl mb-2">🔗</p>
        <h1 className="text-lg font-extrabold text-ink">Invitation not valid</h1>
        <p className="text-[13px] text-gray-500 mt-1.5">{loadErr}</p>
        <p className="text-[12.5px] text-gray-400 mt-4">Ask the business owner to send a fresh invitation.</p>
      </Center>
    );
  }
  if (!invite) return <Center><p className="text-sm text-gray-400">Checking your invitation…</p></Center>;

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-6">
          <span className="inline-grid place-items-center w-12 h-12 rounded-2xl brand-grad text-white text-xl font-extrabold mb-3">D</span>
          <h1 className="text-[21px] font-extrabold text-ink head-kick">You have been invited</h1>
          <p className="text-[13.5px] text-gray-600 mt-2">
            <b>{invite.business}</b> invited you to join as
          </p>
          <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-primary-light text-primary text-[12px] font-extrabold">
            <CheckCircle2 size={13} /> {invite.roleLabel}
          </span>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-[0_2px_16px_-8px_rgba(91,33,182,0.18)]">
          <p className="text-[12.5px] text-gray-500 mb-4">
            Signing in as <b className="text-ink">{invite.email || invite.phone}</b>. Choose a password to finish.
          </p>

          <label className="block text-[12px] font-bold text-gray-500 mb-1.5">Create a password</label>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="At least 8 characters" />

          <label className="block text-[12px] font-bold text-gray-500 mb-1.5 mt-4">Confirm password</label>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Repeat it" />

          {error && <p className="text-red-500 text-[12.5px] mt-3">{error}</p>}

          <button type="submit" disabled={busy} className="btn-claim w-full mt-5 py-3 text-[15px] disabled:opacity-50">
            <span className="relative z-10">{busy ? 'Setting up…' : 'Join the team'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="text-center max-w-sm">{children}</div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<Center><p className="text-sm text-gray-400">Loading…</p></Center>}>
      <JoinInner />
    </Suspense>
  );
}
