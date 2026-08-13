'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { biz, CURRENCY } from '@/lib/bizApi';
import { useBusiness } from '@/context/BusinessContext';
import { CheckCircle2, XCircle, ScanLine, RotateCcw } from 'lucide-react';

/**
 * The till screen.
 *
 * Built for one-handed use on a counter device: a single big input that keeps
 * focus, a result you can read from arm's length, and a reset that is faster
 * than reaching for the keyboard. A cashier is locked to their outlet by the
 * server, so the outlet picker only appears for members who cover several.
 */
export default function CounterPage() {
  const { outlets, member } = useBusiness();
  const [code, setCode] = useState('');
  const [outletId, setOutletId] = useState('');
  const [bill, setBill] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'valid' | 'done' | 'error'>('idle');
  const [claim, setClaim] = useState<any>(null);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const scopedOutlets = member?.scope?.outlets || [];
  const choices = scopedOutlets.length
    ? outlets.filter((o: any) => scopedOutlets.map(String).includes(String(o._id)))
    : outlets;

  useEffect(() => {
    if (choices.length === 1) setOutletId(String(choices[0]._id));
  }, [choices.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { inputRef.current?.focus(); }, [state]);

  const reset = () => {
    setCode(''); setBill(''); setClaim(null); setMessage(''); setState('idle');
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const check = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    setState('checking'); setMessage('');
    try {
      const r = await biz.post('/coupons/vendor/verify', { code: c });
      setClaim(r.claim);
      if (r.valid) { setState('valid'); }
      else { setState('error'); setMessage(labelFor(r.status)); }
    } catch (err) {
      setState('error'); setMessage((err as Error).message || 'Code not found');
    }
  };

  const redeem = async () => {
    setState('checking');
    try {
      const body: any = { code: code.trim().toUpperCase() };
      if (outletId) body.outletId = outletId;
      const n = parseFloat(bill);
      if (Number.isFinite(n) && n > 0) body.billValue = n;
      const r = await biz.post('/coupons/vendor/redeem', body);
      setState('done'); setMessage(r.message || 'Redeemed');
    } catch (err) {
      setState('error'); setMessage((err as Error).message || 'Could not redeem');
    }
  };

  return (
    <div className="max-w-[560px] mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <ScanLine size={18} className="text-primary" />
        <h1 className="text-[19px] font-extrabold text-ink">Counter</h1>
      </div>

      {choices.length > 1 && (
        <div className="mb-3">
          <label className="block text-[12px] font-bold text-gray-500 mb-1.5">Redeeming at</label>
          <select value={outletId} onChange={(e) => setOutletId(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary">
            <option value="">Choose an outlet…</option>
            {choices.map((o: any) => (
              <option key={o._id} value={o._id}>{o.name}{o.city ? ` — ${o.city}` : ''}</option>
            ))}
          </select>
        </div>
      )}
      {choices.length === 1 && (
        <p className="text-[12.5px] text-gray-500 mb-3">
          Redeeming at <b className="text-ink">{choices[0].name}</b>
        </p>
      )}

      <form onSubmit={check} className="bg-white rounded-2xl border border-gray-200 p-4">
        <label className="block text-[12px] font-bold text-gray-500 mb-1.5">Customer code</label>
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); if (state !== 'idle') setState('idle'); }}
          placeholder="DD-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-4 text-center font-mono font-extrabold text-[22px] tracking-widest outline-none focus:border-primary"
        />
        {state !== 'valid' && state !== 'done' && (
          <button type="submit" disabled={state === 'checking' || !code.trim()}
            className="btn-claim w-full mt-3 py-3.5 text-[16px] disabled:opacity-50">
            <span className="relative z-10">{state === 'checking' ? 'Checking…' : 'Check code'}</span>
          </button>
        )}
      </form>

      {state === 'error' && (
        <Result tone="bad" icon={<XCircle size={30} />} title="Not valid" subtitle={message} onReset={reset} />
      )}

      {state === 'valid' && claim && (
        <div className="mt-3 bg-white rounded-2xl border-2 border-emerald-200 overflow-hidden">
          <div className="bg-emerald-50 px-4 py-3 flex items-center gap-2.5">
            <CheckCircle2 size={22} className="text-emerald-600" />
            <div>
              <p className="font-extrabold text-[15px] text-emerald-800">Valid coupon</p>
              <p className="text-[12px] text-emerald-700">{claim.campaign?.offerText}</p>
            </div>
          </div>
          <div className="p-4">
            <Row label="Offer" value={claim.campaign?.title || '—'} />
            <Row label="Customer" value={claim.customer?.name || 'Customer'} />
            {claim.customer?.phone && <Row label="Phone" value={claim.customer.phone} />}
            <Row label="Claimed" value={claim.claimedAt ? new Date(claim.claimedAt).toLocaleString() : '—'} />

            <label className="block text-[12px] font-bold text-gray-500 mb-1.5 mt-4">
              Bill amount <span className="font-normal text-gray-400">(optional — powers ROI reporting)</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-bold">{CURRENCY}</span>
              <input value={bill} onChange={(e) => setBill(e.target.value)} inputMode="decimal" placeholder="0"
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary" />
            </div>

            <button onClick={redeem} disabled={choices.length > 1 && !outletId}
              className="btn-claim w-full mt-4 py-3.5 text-[16px] disabled:opacity-50">
              <span className="relative z-10">Redeem now</span>
            </button>
            {choices.length > 1 && !outletId && (
              <p className="text-[11.5px] text-amber-600 text-center mt-2">Choose the outlet first.</p>
            )}
            <button onClick={reset} className="w-full mt-2 py-2 text-[13px] font-bold text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      {state === 'done' && (
        <Result tone="good" icon={<CheckCircle2 size={30} />} title="Redeemed" subtitle={message} onReset={reset} />
      )}
    </div>
  );
}

function labelFor(status?: string) {
  if (status === 'redeemed') return 'This code has already been used.';
  if (status === 'expired') return 'This coupon has expired.';
  if (status === 'cancelled') return 'This coupon was cancelled.';
  return 'This code cannot be redeemed.';
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-[12.5px] text-gray-400">{label}</span>
      <span className="text-[12.5px] font-bold text-ink text-right truncate">{value}</span>
    </div>
  );
}

function Result({ tone, icon, title, subtitle, onReset }: {
  tone: 'good' | 'bad'; icon: React.ReactNode; title: string; subtitle: string; onReset: () => void;
}) {
  const good = tone === 'good';
  return (
    <div className={`mt-3 rounded-2xl border-2 p-6 text-center ${good ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
      <div className={`mx-auto w-14 h-14 rounded-full grid place-items-center mb-2 ${good ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
        {icon}
      </div>
      <p className={`font-extrabold text-[18px] ${good ? 'text-emerald-800' : 'text-red-700'}`}>{title}</p>
      <p className={`text-[13px] mt-1 ${good ? 'text-emerald-700' : 'text-red-600'}`}>{subtitle}</p>
      <button onClick={onReset}
        className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-gray-200 font-bold text-[13.5px] text-ink hover:border-primary">
        <RotateCcw size={15} /> Next customer
      </button>
    </div>
  );
}
